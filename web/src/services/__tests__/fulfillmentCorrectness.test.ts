import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/db'
import { clearAllData } from '../../data/seed'
import { reserveOwnBatch, reserveExternalSupplier } from '../reservationService'
import { createShipment, confirmShipment } from '../shipmentService'
import { previewCloseOrderRemaining, closeOrderRemaining } from '../orderCompletionService'
import { exportWorkspaceBackup, restoreWorkspaceBackup } from '../../data/backup'
import { validateBackup } from '../../data/backup/backup.validate'
import { undoService } from '../undoService'
import { reservedQuantityForOrder } from '../../domain/order'
import { createOrder } from '../orderService'
import { createBatch, updateBatchInventory, updateBatchReadyQuantity } from '../batchService'

async function snapshot() {
  return { orders: await db.orders.toArray(), reservations: await db.reservations.toArray(), shipments: await db.shipments.toArray(),
    batches: await db.batches.toArray(), events: await db.events.toArray() }
}
async function close() {
  const p = await previewCloseOrderRemaining({ orderId: 'order' })
  if (!p.success) throw new Error(JSON.stringify(p))
  expect(await closeOrderRemaining({ orderId: 'order', operationId: 'close', expectedFingerprint: p.fingerprint })).toMatchObject({ success: true })
}
describe('FC5 completion-path and terminal backup correctness — real Dexie', () => {
  beforeEach(async () => {
    await clearAllData(); undoService.clearLastMutation()
    await db.contacts.bulkPut([{ id: 'customer', name: 'Khách', roles: ['customer'] }, { id: 'supplier', name: 'Vườn ngoài', roles: ['supplier'] }])
    await db.batches.put({ id: 'batch', code: 'BV16 #1', variety: 'BV16', initialQuantity: 100000, currentQuantity: 80000,
      readyQuantity: 60000, status: 'ready', createdAt: '2026-10-09' })
    await db.orders.put({ id: 'order', customerId: 'customer', variety: 'BV16', requestedQuantity: 50000, status: 'open' })
  })
  afterEach(() => { vi.restoreAllMocks(); undoService.clearLastMutation() })

  it.each(['own', 'external', 'mixed'])('multiple %s shipments → exact full terminal, no outstanding/plans, retry never deducts twice', async source => {
    const ownQ = source === 'external' ? 0 : source === 'mixed' ? 32000 : 50000
    const extQ = 50000 - ownQ
    const own = ownQ ? (await reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity: ownQ })).reservation : undefined
    const external = extQ ? (await reserveExternalSupplier({ orderId: 'order', supplierId: 'supplier', quantity: extQ,
      confirmation: { acknowledged: true, supplierId: 'supplier', variety: 'BV16', quantity: extQ } })).reservation : undefined
    const before = await snapshot()
    const firstLines = [...(own ? [{ reservationId: own.id, quantity: 15000 }] : []), ...(external ? [{ reservationId: external.id, quantity: 5000 }] : [])]
    const first = (await createShipment({ orderId: 'order', lines: firstLines })).shipment
    await confirmShipment({ shipmentId: first.id })
    expect((await db.orders.get('order'))?.status).toBe('partially_shipped')
    const final = (await createShipment({ orderId: 'order', lines: [
      ...(own ? [{ reservationId: own.id, quantity: ownQ - 15000 }] : []),
      ...(external ? [{ reservationId: external.id, quantity: extQ - 5000 }] : [])
    ] })).shipment
    await confirmShipment({ shipmentId: final.id })
    const after = await snapshot()
    expect(after.orders[0].status).toBe('shipped')
    expect(after.shipments.filter(s => s.status === 'planned')).toEqual([])
    expect(after.shipments.filter(s => s.status === 'completed').reduce((s, x) => s + x.shippedQuantity, 0)).toBe(50000)
    expect(after.reservations.every(r => r.status === 'fulfilled' && r.fulfilledQuantity === r.quantity)).toBe(true)
    expect(reservedQuantityForOrder('order', after.reservations)).toBe(50000)
    expect(after.batches[0].currentQuantity).toBe(before.batches[0].currentQuantity - ownQ)
    expect(after.batches[0].readyQuantity).toBe(before.batches[0].readyQuantity - ownQ)
    if (source === 'external') expect(after.batches).toEqual(before.batches)
    await confirmShipment({ shipmentId: final.id })
    expect(await snapshot()).toEqual(after)
    const { backup } = await exportWorkspaceBackup()
    expect(validateBackup(backup).valid).toBe(true)
  })

  it.each(['overship', 'coverage', 'unsafe quantity', 'unmatched F', 'extra planned', 'legacy completed', 'stale status'])
  ('corrupt %s fails before even the first physical stock write; no normalization/auto-release', async kind => {
    const own = (await reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity: 50000 })).reservation
    const first = (await createShipment({ orderId: 'order', lines: [{ reservationId: own.id, quantity: 20000 }] })).shipment
    await confirmShipment({ shipmentId: first.id })
    const final = (await createShipment({ orderId: 'order', lines: [{ reservationId: own.id, quantity: 30000 }] })).shipment
    if (kind === 'overship') await db.orders.update('order', { requestedQuantity: 49000 })
    if (kind === 'coverage') await db.reservations.update(own.id, { quantity: 51000 })
    if (kind === 'unsafe quantity') await db.shipments.update(final.id, { plannedQuantity: Number.MAX_SAFE_INTEGER + 1,
      lines: [{ ...final.lines![0], quantity: Number.MAX_SAFE_INTEGER + 1 }] })
    if (kind === 'unmatched F') await db.reservations.update(own.id, { fulfilledQuantity: 19000 })
    if (kind === 'extra planned') await db.shipments.put({ ...final, id: 'extra-plan', plannedQuantity: 1000, lines: [{ ...final.lines![0], quantity: 1000 }] })
    if (kind === 'legacy completed') await db.shipments.update(first.id, { lines: [] })
    if (kind === 'stale status') await db.orders.update('order', { status: 'reserved' })
    const before = await snapshot()
    const writes = vi.spyOn(db.batches, 'put')
    await expect(confirmShipment({ shipmentId: final.id })).rejects.toThrow()
    expect(writes).not.toHaveBeenCalled()
    expect(await snapshot()).toEqual(before)
  })

  it.each(['closed S0', 'closed S=R', 'closed S>R', 'closed active', 'closed planned', 'closed F mismatch',
    'closed no lines', 'shipped wrong S', 'shipped outstanding', 'cancelled fulfillment', 'cancelled completed', 'unsafe sum'])
  ('backup %s is rejected before full replace and keeps the workspace', async kind => {
    const own = (await reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity: 32000 })).reservation
    const first = (await createShipment({ orderId: 'order', lines: [{ reservationId: own.id, quantity: 20000 }] })).shipment
    await confirmShipment({ shipmentId: first.id }); await close()
    const { backup } = await exportWorkspaceBackup()
    // Test terminal invariants independently of marker validation.
    backup.data.events = backup.data.events.filter(e => e.type !== 'order_closed_remaining')
    const order = backup.data.orders[0]
    const r = backup.data.reservations[0]
    const shipment = backup.data.shipments[0]
    if (kind === 'closed S0') { r.fulfilledQuantity = 0; shipment.status = 'cancelled'; shipment.shippedQuantity = 0 }
    if (kind === 'closed S=R') order.requestedQuantity = 20000
    if (kind === 'closed S>R') order.requestedQuantity = 19000
    if (kind === 'closed active' || kind === 'shipped outstanding') r.status = 'active'
    if (kind === 'closed planned') backup.data.shipments.push({ ...first, id: 'new-plan', status: 'planned', shippedQuantity: 0 })
    if (kind === 'closed F mismatch') r.fulfilledQuantity = 19000
    if (kind === 'closed no lines') shipment.lines = []
    if (kind === 'shipped wrong S' || kind === 'shipped outstanding') order.status = 'shipped'
    if (kind === 'cancelled fulfillment' || kind === 'cancelled completed') order.status = 'cancelled'
    if (kind === 'cancelled fulfillment') { shipment.status = 'cancelled'; shipment.shippedQuantity = 0 }
    if (kind === 'cancelled completed') { r.fulfilledQuantity = 0 }
    if (kind === 'unsafe sum') backup.data.shipments.push({ ...shipment, id: 'huge', shippedQuantity: Number.MAX_SAFE_INTEGER, plannedQuantity: Number.MAX_SAFE_INTEGER })
    expect(validateBackup(backup).valid).toBe(false)
    const before = await snapshot()
    await expect(restoreWorkspaceBackup(JSON.stringify(backup))).rejects.toThrow()
    expect(await snapshot()).toEqual(before)
  })

  it('Dexie5 / backupV1 remain; a closed backup with complete proof but no marker is valid, without inferring closure for partial legacy', async () => {
    const own = (await reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity: 32000 })).reservation
    const first = (await createShipment({ orderId: 'order', lines: [{ reservationId: own.id, quantity: 20000 }] })).shipment
    await confirmShipment({ shipmentId: first.id })
    const partial = await exportWorkspaceBackup()
    expect(partial.backup.data.orders[0].status).toBe('partially_shipped')
    await restoreWorkspaceBackup(partial.jsonString)
    expect((await db.orders.get('order'))?.status).toBe('partially_shipped')
    await close()
    const { backup } = await exportWorkspaceBackup()
    expect(db.verno).toBe(5)
    expect(backup.formatVersion).toBe(1)
    backup.data.events = backup.data.events.filter(e => e.type !== 'order_closed_remaining')
    expect(validateBackup(backup).valid).toBe(true)
    await restoreWorkspaceBackup(JSON.stringify(backup))
    expect((await db.orders.get('order'))?.status).toBe('closed_remaining')
  })

  it('old create-order Undo cannot delete a closed order or history', async () => {
    await db.orders.delete('order')
    const created = await createOrder({ customerId: 'customer', variety: 'BV16', requestedQuantity: 50000 })
    expect(created.success).toBe(true)
    if (!created.success || !created.order) return
    const old = undoService.getLastMutation()
    const orderId = created.order.id
    const own = (await reserveOwnBatch({ orderId, batchId: 'batch', quantity: 32000 })).reservation
    const first = (await createShipment({ orderId, lines: [{ reservationId: own.id, quantity: 20000 }] })).shipment
    await confirmShipment({ shipmentId: first.id })
    const preview = await previewCloseOrderRemaining({ orderId })
    expect(preview.success).toBe(true)
    if (!preview.success) return
    await closeOrderRemaining({ orderId, operationId: 'close', expectedFingerprint: preview.fingerprint })
    if (old) undoService.recordMutation(old, 0)
    const before = await snapshot()
    expect((await undoService.undoLastMutation()).success).toBe(false)
    expect(await snapshot()).toEqual(before)
  })

  it('old create-batch Undo cannot delete source authority after a real close', async () => {
    const created = await createBatch({ variety: 'BV16', initialQuantity: 50000 })
    expect(created.success).toBe(true)
    if (!created.batch) return
    const old = undoService.getLastMutation()
    await updateBatchReadyQuantity({ batchId: created.batch.id, newReadyQuantity: 40000 })
    const r = (await reserveOwnBatch({ orderId: 'order', batchId: created.batch.id, quantity: 32000 })).reservation
    const s = (await createShipment({ orderId: 'order', lines: [{ reservationId: r.id, quantity: 20000 }] })).shipment
    await confirmShipment({ shipmentId: s.id }); await close()
    if (old) undoService.recordMutation(old, 0)
    const before = await snapshot()
    expect((await undoService.undoLastMutation()).success).toBe(false)
    expect(await snapshot()).toEqual(before)
  })

  it('a closed order does not block legitimate independent inventory edits and their Undo', async () => {
    const r = (await reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity: 32000 })).reservation
    const s = (await createShipment({ orderId: 'order', lines: [{ reservationId: r.id, quantity: 20000 }] })).shipment
    await confirmShipment({ shipmentId: s.id }); await close()
    const before = await snapshot()
    expect(await updateBatchInventory({ batchId: 'batch', newQuantity: 59000, newReadyQuantity: 30000 })).toMatchObject({ success: true })
    expect((await undoService.undoLastMutation()).success).toBe(true)
    expect((await snapshot()).batches).toEqual(before.batches)
    expect((await snapshot()).orders).toEqual(before.orders)
    expect((await snapshot()).reservations).toEqual(before.reservations)
    expect((await snapshot()).shipments).toEqual(before.shipments)
  })
})
