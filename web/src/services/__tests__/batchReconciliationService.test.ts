import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/db'
import { clearAllData } from '../../data/seed'
import { exportWorkspaceBackup, restoreWorkspaceBackup } from '../../data/backup'
import { createDomainEvent } from '../../analytics/events'
import { availableQuantityForBatch, commitmentShortageForBatch } from '../../domain/quantity'
import { reservedQuantityForOrder } from '../../domain/order'
import type { BatchShortagePlan } from '../../domain/batchReconciliation'
import { previewBatchShortageReconciliation, reconcileBatchShortage, type ConfirmBatchShortageInput } from '../batchReconciliationService'
import { previewOrderReduction, reconcileOrderReduction } from '../reconciliationService'
import { reserveOwnBatch, reserveExternalSupplier, releaseReservation } from '../reservationService'
import { createShipment, confirmShipment } from '../shipmentService'
import { updateOrder, cancelOrder } from '../orderService'
import { updateBatchReadyQuantity } from '../batchService'
import { undoService } from '../undoService'

let lan: string
let hung: string
type Undo = NonNullable<ReturnType<typeof undoService.getLastMutation>>
let oldUndo: Undo
async function snapshot() {
  return { batches: await db.batches.toArray(), orders: await db.orders.toArray(), reservations: await db.reservations.toArray(),
    shipments: await db.shipments.toArray(), events: await db.events.toArray() }
}
function plan(newOutstanding = 7000, transfer = 0): BatchShortagePlan {
  return { sourceBatchId: 'A', adjustments: [{ reservationId: lan, newOutstanding,
    ...(transfer ? { transfer: { targetBatchId: 'B', quantity: transfer } } : {}) }] }
}
async function intent(p = plan(), operationId = 'op'): Promise<ConfirmBatchShortageInput> {
  const preview = await previewBatchShortageReconciliation(p)
  const expectedFingerprint = preview.success ? preview.fingerprint : preview.currentFingerprint
  expect(expectedFingerprint).toBeTypeOf('string')
  return { ...p, operationId, expectedFingerprint: expectedFingerprint! }
}
async function reject(input: ConfirmBatchShortageInput, code: string) {
  const before = await snapshot()
  expect(await reconcileBatchShortage(input)).toMatchObject({ success: false, code })
  expect(await snapshot()).toEqual(before)
}

describe('FC3-2 Trigger B + own transfer (real Dexie/services)', () => {
  beforeEach(async () => {
    undoService.clearLastMutation(); await clearAllData()
    await db.contacts.bulkPut([{ id: 'c', name: 'Khách', roles: ['customer'] }, { id: 'supplier', name: 'Ngoài', roles: ['supplier'] }])
    await db.batches.bulkPut(['A', 'B', 'C'].map(id => ({ id, code: `BV16 ${id}`, variety: 'BV16', initialQuantity: 50000,
      currentQuantity: 40000, readyQuantity: id === 'A' ? 30000 : 10000, status: 'ready', createdAt: '2026-10-08' })))
    await db.orders.bulkPut(['Lan', 'Hung', 'Other'].map(id => ({ id, customerId: 'c', variety: 'BV16', requestedQuantity: 30000,
      status: 'open', requestedDate: '2026-10-20', unitPrice: 1200, note: 'old' })))
    lan = (await reserveOwnBatch({ orderId: 'Lan', batchId: 'A', quantity: 10000 })).reservation.id
    oldUndo = undoService.getLastMutation()!
    hung = (await reserveOwnBatch({ orderId: 'Hung', batchId: 'A', quantity: 8000 })).reservation.id
    expect((await updateBatchReadyQuantity({ batchId: 'A', newReadyQuantity: 15000 })).success).toBe(true)
    undoService.clearLastMutation()
  })
  afterEach(() => { vi.restoreAllMocks(); undoService.clearLastMutation() })

  it.each([9000, 7000, 5000, 0])('partial/exact/over/full reduction %i only changes selected commitment', async n => {
    const before = await snapshot(); const input = await intent(plan(n))
    expect(await snapshot()).toEqual(before)
    expect(await reconcileBatchShortage(input)).toMatchObject({ success: true, projection: {
      source: { shortageBefore: 3000, shortageAfter: Math.max(n + 8000 - 15000, 0) },
      orders: [{ coverageBefore: 10000, coverageAfter: n, shortageAfter: 30000 - n,
        after: { requestedQuantity: 30000, variety: 'BV16', requestedDate: '2026-10-20', unitPrice: 1200, note: 'old' } }] } })
    const after = await snapshot()
    expect(after.batches).toEqual(before.batches); expect(after.shipments).toEqual(before.shipments)
    expect(after.reservations.find(r => r.id === hung)).toEqual(before.reservations.find(r => r.id === hung))
    expect(after.orders.filter(o => o.id !== 'Lan')).toEqual(before.orders.filter(o => o.id !== 'Lan'))
    expect(await db.reservations.get(lan)).toMatchObject({ quantity: n || 10000, fulfilledQuantity: 0, status: n ? 'active' : 'released' })
    expect(after.events.filter(e => e.type === 'batch_reconciled')).toHaveLength(1)
  })
  it.each([[7000, 3000, 0, 10000], [5000, 3000, 2000, 8000], [0, 10000, 0, 10000]])('atomic transfer/release %i/%i', async (n, t, released, c) => {
    await db.batches.update('B', { variety: ' bv16 ', status: 'depleted' })
    const before = await snapshot(); const preview = await previewBatchShortageReconciliation(plan(n, t))
    expect(preview.success).toBe(true)
    if (!preview.success) throw new Error(preview.error)
    expect(preview.projection.targetReservations[0].reservation.id).toBeUndefined()
    expect(await snapshot()).toEqual(before)
    const result = await reconcileBatchShortage({ ...plan(n, t), operationId: 'transfer', expectedFingerprint: preview.fingerprint })
    expect(result).toMatchObject({ success: true, projection: { source: { shortageAfter: 0 },
      adjustments: [{ releasedQuantity: released, transferredQuantity: t }], orders: [{ coverageAfter: c }],
      targets: [{ incomingTransfer: t, availableAfter: 10000 - t, shortageAfter: 0 }] } })
    if (!result.success) throw new Error(result.error)
    const target = result.projection.targetReservations[0]
    expect(target.reservation.id).toBeTypeOf('string'); expect(target.reservation.id).not.toBe(lan)
    expect(await db.reservations.get(target.reservation.id!)).toEqual(target.reservation)
    expect(await db.reservations.get(lan)).toMatchObject({ batchId: 'A', orderId: 'Lan', createdAt: before.reservations.find(r => r.id === lan)!.createdAt })
    expect(await db.batches.toArray()).toEqual(before.batches)
    expect(await db.shipments.toArray()).toEqual(before.shipments)
    const events = (await db.events.toArray()).filter(e => (e.payload as { operationId?: string }).operationId === 'transfer')
    expect(events.map(e => [e.type, e.entityType, e.entityId])).toEqual(expect.arrayContaining([
      ['batch_reconciled', 'batch', 'A'], ['reservation_transferred', 'batch', 'B'], ['reservation_reconciled', 'order', 'Lan']
    ]))
  })
  it('does not merge into an existing target source; aggregates transfers from two customers', async () => {
    const existing = (await reserveOwnBatch({ orderId: 'Lan', batchId: 'B', quantity: 3000 })).reservation
    const p = plan(7000, 3000); p.adjustments.push({ reservationId: hung, newOutstanding: 5000, transfer: { targetBatchId: 'B', quantity: 3000 } })
    const before = await snapshot()
    expect(await reconcileBatchShortage(await intent(p))).toMatchObject({ success: true, projection: {
      targets: [{ incomingTransfer: 6000, availableBefore: 7000, availableAfter: 1000 }], targetReservations: [{}, {}] } })
    expect(await db.reservations.get(existing.id)).toEqual(existing)
    expect(await db.reservations.where('batchId').equals('B').count()).toBe(3)
    expect(reservedQuantityForOrder('Lan', await db.reservations.toArray())).toBe(13000)
    expect(reservedQuantityForOrder('Hung', await db.reservations.toArray())).toBe(8000)
    expect(await db.batches.toArray()).toEqual(before.batches)
  })
  it('aggregate capacity prevents two individually valid incoming allocations from overselling', async () => {
    await db.batches.update('B', { readyQuantity: 5000 })
    const p = plan(7000, 3000); p.adjustments.push({ reservationId: hung, newOutstanding: 5000, transfer: { targetBatchId: 'B', quantity: 3000 } })
    await reject(await intent(p), 'TARGET_UNAVAILABLE')
  })
  it.each(['same', 'missing', 'variety', 'capacity', 'target-shortage', 'invalid-stock', 'excess', 'external', 'wrong-batch', 'released', 'fulfilled', 'chain-cycle'])('no writes on invalid %s', async mode => {
    const p = plan(7000, 3000); let code = 'INVALID_INPUT'
    if (mode === 'same') p.adjustments[0].transfer!.targetBatchId = 'A'
    if (mode === 'missing') { p.adjustments[0].transfer!.targetBatchId = 'missing'; code = 'NOT_FOUND' }
    if (mode === 'variety') { await db.batches.update('B', { variety: 'AH1' }); code = 'VARIETY_MISMATCH' }
    if (mode === 'capacity') { await db.batches.update('B', { readyQuantity: 2000 }); code = 'TARGET_UNAVAILABLE' }
    if (mode === 'target-shortage') {
      await reserveOwnBatch({ orderId: 'Other', batchId: 'B', quantity: 10000 }); await db.batches.update('B', { readyQuantity: 9000 }); code = 'TARGET_UNAVAILABLE'
    }
    if (mode === 'invalid-stock') { await db.batches.update('B', { currentQuantity: 0 }); code = 'INVALID_STATE' }
    if (mode === 'excess') p.adjustments[0].transfer!.quantity = 3001
    if (mode === 'external') {
      p.adjustments[0].reservationId = (await reserveExternalSupplier({ orderId: 'Lan', supplierId: 'supplier', quantity: 10000 })).reservation.id; code = 'INVALID_SELECTION'
    }
    if (mode === 'wrong-batch') {
      p.adjustments[0].reservationId = (await reserveOwnBatch({ orderId: 'Other', batchId: 'B', quantity: 5000 })).reservation.id; code = 'INVALID_SELECTION'
    }
    if (mode === 'released') { await releaseReservation({ reservationId: lan }); code = 'INVALID_SELECTION' }
    if (mode === 'fulfilled') { await db.reservations.update(lan, { status: 'fulfilled', fulfilledQuantity: 10000 }); code = 'INVALID_SELECTION' }
    if (mode === 'chain-cycle') {
      const r = (await reserveOwnBatch({ orderId: 'Other', batchId: 'B', quantity: 5000 })).reservation
      p.adjustments.push({ reservationId: r.id, newOutstanding: 0, transfer: { targetBatchId: 'A', quantity: 5000 } }); code = 'INVALID_SELECTION'
    }
    await reject(await intent(p), code)
  })
  it.each([0, -1, 0.2, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('no writes on invalid transfer quantity %s', async n => {
    const p = plan(7000, 3000); p.adjustments[0].transfer!.quantity = n
    await reject({ ...p, operationId: 'invalid', expectedFingerprint: 'invalid' }, 'INVALID_INPUT')
  })
  it.each(['cancelled', 'shipped', 'orphan', 'Q0', 'F>Q', 'mismatch-F', 'overcoverage'])('invalid order/source integrity %s', async mode => {
    let code = 'INVALID_STATE'
    if (mode === 'cancelled') { await cancelOrder({ orderId: 'Lan' }); await db.reservations.update(lan, { status: 'active' }); code = 'ORDER_CANCELLED' }
    if (mode === 'shipped') { await db.orders.update('Lan', { status: 'shipped' }); code = 'ALREADY_SHIPPED' }
    if (mode === 'orphan') await db.reservations.update(lan, { orderId: 'missing' })
    if (mode === 'Q0') await db.reservations.update(lan, { quantity: 0 })
    if (mode === 'F>Q') await db.reservations.update(lan, { fulfilledQuantity: 10001 })
    if (mode === 'mismatch-F') await db.reservations.update(lan, { fulfilledQuantity: 1 })
    if (mode === 'overcoverage') await db.orders.update('Lan', { requestedQuantity: 5000 })
    // Q=0 and F>Q have no selectable positive O and fail selection first.
    if (mode === 'Q0' || mode === 'F>Q') code = 'INVALID_SELECTION'
    await reject(await intent(), code)
  })
  it('all planned shipments/lines are summed; transfer cannot bypass source guard', async () => {
    const { shipment } = await createShipment({ orderId: 'Lan', lines: [{ reservationId: lan, quantity: 4000 }] })
    await db.shipments.put({ ...shipment, id: 'second-plan', plannedQuantity: 2000,
      lines: [{ ...shipment.lines![0], quantity: 2000 }] })
    const before = await db.shipments.toArray()
    await reject(await intent(plan(5000, 5000)), 'PLANNED_ALLOCATION_CONFLICT')
    expect(await reconcileBatchShortage(await intent(plan(7000, 3000)))).toMatchObject({ success: true,
      projection: { adjustments: [{ plannedQuantity: 6000 }] } })
    expect(await db.shipments.toArray()).toEqual(before)
  })
  it.each(['missing-lines', 'wrong-order', 'wrong-reference', 'wrong-sum'])('planned %s fails closed', async mode => {
    const { shipment } = await createShipment({ orderId: 'Lan', lines: [{ reservationId: lan, quantity: 4000 }] })
    if (mode === 'missing-lines') await db.shipments.update(shipment.id, { lines: [] })
    if (mode === 'wrong-order') await db.shipments.update(shipment.id, { orderId: 'Hung' })
    if (mode === 'wrong-reference') await db.shipments.update(shipment.id, { lines: [{ ...shipment.lines![0], batchId: 'B' }] })
    if (mode === 'wrong-sum') await db.shipments.update(shipment.id, { plannedQuantity: 4001 })
    await reject(await intent(), 'UNVERIFIABLE_PLANNED_SHIPMENT')
  })
  it.each([false, true])('partially shipped Trigger B preserves F/completed/requested/status (transfer=%s)', async transfer => {
    await db.batches.update('A', { readyQuantity: 40000 })
    await reserveOwnBatch({ orderId: 'Lan', batchId: 'A', quantity: 15000 })
    const { shipment } = await createShipment({ orderId: 'Lan', lines: [{ reservationId: lan, quantity: 10000 }] })
    expect((await confirmShipment({ shipmentId: shipment.id })).success).toBe(true)
    const r = (await db.reservations.where('orderId').equals('Lan').toArray()).find(r => r.status === 'active')!
    await db.batches.update('A', { readyQuantity: 20000 }) // O15k + Hung8k, shortage3k.
    const p: BatchShortagePlan = { sourceBatchId: 'A', adjustments: [{ reservationId: r.id, newOutstanding: 12000,
      ...(transfer ? { transfer: { targetBatchId: 'B', quantity: 3000 } } : {}) }] }
    const { shipment: planned } = await createShipment({ orderId: 'Lan', lines: [{ reservationId: r.id, quantity: 10000 }] })
    const before = await snapshot()
    expect(await reconcileBatchShortage(await intent(p))).toMatchObject({ success: true, projection: {
      orders: [{ after: { requestedQuantity: 30000, status: 'partially_shipped' }, coverageAfter: transfer ? 25000 : 22000 }] } })
    expect(await db.shipments.toArray()).toEqual(before.shipments)
    expect(await db.batches.toArray()).toEqual(before.batches)
    expect(await db.reservations.get(lan)).toMatchObject({ quantity: 10000, fulfilledQuantity: 10000, status: 'fulfilled' })
    expect(await db.reservations.get(r.id)).toMatchObject({ quantity: 12000, fulfilledQuantity: 0 })
    expect((await db.shipments.get(planned.id))!.lines).toEqual(planned.lines)
  })
  it.each([12000, 0])('selected partially fulfilled Q25k/F10k/O15k → O%i retains F/source and completed history', async n => {
    await db.batches.update('A', { readyQuantity: 40000 }); await db.reservations.update(lan, { quantity: 25000 })
    const { shipment } = await createShipment({ orderId: 'Lan', lines: [{ reservationId: lan, quantity: 10000 }] })
    expect((await confirmShipment({ shipmentId: shipment.id })).success).toBe(true)
    await db.batches.update('A', { readyQuantity: 20000 })
    const before = await snapshot()
    expect(await reconcileBatchShortage(await intent(plan(n)))).toMatchObject({ success: true })
    expect(await db.reservations.get(lan)).toMatchObject({ quantity: n ? 10000 + n : 25000, fulfilledQuantity: 10000,
      status: n ? 'active' : 'released', batchId: 'A' })
    expect((await db.orders.get('Lan'))!.status).toBe('partially_shipped')
    expect(await db.shipments.toArray()).toEqual(before.shipments); expect(await db.batches.toArray()).toEqual(before.batches)
  })
  it.each(['ready', 'source-added', 'source-released', 'target-added', 'target-ready', 'selected-Q', 'selected-F', 'selected-status',
    'note', 'date', 'price', 'quantity', 'variety', 'target-facts', 'source-history', 'target-history', 'order-history', 'contact', 'planned', 'planned-line', 'completed', 'cancel'])('strict stale preview: %s', async change => {
    let shipmentId = ''
    if (['planned-line', 'completed'].includes(change)) shipmentId = (await createShipment({ orderId: 'Lan', lines: [{ reservationId: lan, quantity: 2000 }] })).shipment.id
    const input = await intent(plan(7000, 3000))
    if (change === 'ready') await updateBatchReadyQuantity({ batchId: 'A', newReadyQuantity: 14000 })
    if (change === 'source-added') { await db.batches.update('A', { readyQuantity: 20000 }); await reserveOwnBatch({ orderId: 'Other', batchId: 'A', quantity: 1000 }) }
    if (change === 'source-released') await releaseReservation({ reservationId: hung })
    if (change === 'target-added') await reserveOwnBatch({ orderId: 'Other', batchId: 'B', quantity: 1000 })
    if (change === 'target-ready') await updateBatchReadyQuantity({ batchId: 'B', newReadyQuantity: 9000 })
    if (change === 'selected-Q') await db.reservations.update(lan, { quantity: 9000 })
    if (change === 'selected-F') await db.reservations.update(lan, { fulfilledQuantity: 1 })
    if (change === 'selected-status') await releaseReservation({ reservationId: lan })
    if (change === 'note') await updateOrder({ orderId: 'Lan', note: 'changed' })
    if (change === 'date') await updateOrder({ orderId: 'Lan', requestedDate: '2026-11-01' })
    if (change === 'price') await updateOrder({ orderId: 'Lan', unitPrice: 1500 })
    if (change === 'quantity') await updateOrder({ orderId: 'Lan', requestedQuantity: 35000 })
    if (change === 'variety') await db.orders.update('Lan', { variety: 'AH1' })
    if (change === 'target-facts') await db.batches.update('B', { currentQuantity: 35000 })
    if (['source-history', 'target-history', 'order-history'].includes(change)) await db.events.put(createDomainEvent('history',
      change === 'order-history' ? 'order' : 'batch', change === 'order-history' ? 'Lan' : change === 'source-history' ? 'A' : 'B'))
    if (change === 'contact') await db.contacts.update('c', { name: 'Changed' })
    if (change === 'planned') await createShipment({ orderId: 'Lan', lines: [{ reservationId: lan, quantity: 2000 }] })
    if (change === 'planned-line') await db.shipments.update(shipmentId, { plannedQuantity: 1000,
      lines: [{ reservationId: lan, sourceType: 'own_batch', batchId: 'A', quantity: 1000 }] })
    if (change === 'completed') await confirmShipment({ shipmentId })
    if (change === 'cancel') await cancelOrder({ orderId: 'Lan' })
    await reject(input, 'PREVIEW_CHANGED')
  })
  it('plan itself is fingerprint-bound, and nested intent is copied before awaiting', async () => {
    const p = plan(7000, 3000); const input = await intent(p)
    await reject({ ...input, adjustments: [{ ...p.adjustments[0], newOutstanding: 6000 }] }, 'PREVIEW_CHANGED')
    await reject({ ...input, adjustments: [{ ...p.adjustments[0], transfer: { targetBatchId: 'C', quantity: 3000 } }] }, 'PREVIEW_CHANGED')
    const promise = reconcileBatchShortage(input); input.adjustments[0].transfer!.quantity = 1000
    expect(await promise).toMatchObject({ success: true, projection: { targets: [{ incomingTransfer: 3000 }] } })
  })
  it('same ID returns original committed target IDs after later cancellation; canonical retries do not write', async () => {
    const input = await intent(plan(7000, 3000)); const first = await reconcileBatchShortage(input)
    expect(first.success).toBe(true)
    await cancelOrder({ orderId: 'Lan' }); const after = await snapshot()
    const retry = await reconcileBatchShortage({ ...input, expectedFingerprint: 'later-token' })
    expect(retry).toMatchObject({ success: true, idempotent: true })
    if (first.success && retry.success) expect(retry.projection).toEqual(first.projection)
    expect(await snapshot()).toEqual(after)
    await reject({ ...input, adjustments: [{ reservationId: lan, newOutstanding: 6000 }] }, 'OPERATION_ID_CONFLICT')
    await reject({ ...input, sourceBatchId: 'C' }, 'OPERATION_ID_CONFLICT')
  })
  it('operation IDs cannot collide across Trigger A/B in either direction', async () => {
    const b = await intent(); expect((await reconcileBatchShortage(b)).success).toBe(true)
    const a = { orderId: 'Lan', desiredRequestedQuantity: 20000, adjustments: [] }
    const preview = await previewOrderReduction(a); expect(preview.success).toBe(true)
    if (!preview.success) throw new Error(preview.error)
    const before = await snapshot()
    expect(await reconcileOrderReduction({ ...a, operationId: 'op', expectedFingerprint: preview.fingerprint })).toMatchObject({ success: false, code: 'OPERATION_ID_CONFLICT' })
    expect(await snapshot()).toEqual(before)
    expect((await reconcileOrderReduction({ ...a, operationId: 'a-op', expectedFingerprint: preview.fingerprint })).success).toBe(true)
    await reject({ ...await intent(plan(6000)), operationId: 'a-op' }, 'OPERATION_ID_CONFLICT')
  })
  it('duplicate concurrent submit creates one marker and one target identity', async () => {
    const input = await intent(plan(7000, 3000))
    const results = await Promise.all([reconcileBatchShortage(input), reconcileBatchShortage(input)])
    expect(results.map(r => r.success && r.idempotent).sort()).toEqual([false, true])
    if (results[0].success && results[1].success) expect(results[0].projection).toEqual(results[1].projection)
    expect(await db.reservations.where('batchId').equals('B').count()).toBe(1)
    expect(await db.events.where('type').equals('batch_reconciled').count()).toBe(1)
  })
  it.each([1, 2, 3])('event failure at write %i rolls back source/target/order/marker; retry once', async failAt => {
    const input = await intent(plan(5000, 3000)); const before = await snapshot()
    const original = db.events.put.bind(db.events); let count = 0
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const spy = vi.spyOn(db.events, 'put').mockImplementation((...args) => { if (++count === failAt) return Promise.reject(new Error('injected')) as ReturnType<typeof db.events.put>; return original(...args) })
    expect(await reconcileBatchShortage(input)).toMatchObject({ success: false, code: 'STORAGE_ERROR' })
    expect(await snapshot()).toEqual(before); spy.mockRestore()
    expect((await reconcileBatchShortage(input)).success).toBe(true)
    expect(await reconcileBatchShortage(input)).toMatchObject({ success: true, idempotent: true })
    expect(await db.reservations.where('batchId').equals('B').count()).toBe(1)
  })
  it.each([false, true])('real Trigger B old Undo regression (transfer=%s)', async transfer => {
    expect((await reconcileBatchShortage(await intent(plan(7000, transfer ? 3000 : 0)))).success).toBe(true)
    undoService.recordMutation(oldUndo, 0); const after = await snapshot()
    expect((await undoService.undoLastMutation()).success).toBe(false)
    expect(await snapshot()).toEqual(after)
    expect(await db.events.where('type').equals('reservation_released').count()).toBe(0)
  })
  it('old Undo of unchanged selected source is stale after another selected source reduces shortage', async () => {
    const p = plan(10000); p.adjustments.push({ reservationId: hung, newOutstanding: 5000 })
    expect((await reconcileBatchShortage(await intent(p))).success).toBe(true)
    undoService.recordMutation(oldUndo, 0); const after = await snapshot()
    expect((await undoService.undoLastMutation()).success).toBe(false); expect(await snapshot()).toEqual(after)
  })
  it.each([false, true])('backup/reopen preserves partial shortage or transfer and marker identity (%s)', async transfer => {
    const input = await intent(plan(9000, transfer ? 1000 : 0)); const result = await reconcileBatchShortage(input)
    expect(result).toMatchObject({ success: true, projection: { source: { shortageAfter: 2000 } } })
    const exported = await exportWorkspaceBackup(); await restoreWorkspaceBackup(exported.jsonString); db.close(); await db.open()
    expect((await exportWorkspaceBackup()).backup.data).toEqual(exported.backup.data)
    const restored = await snapshot(); const retry = await reconcileBatchShortage(input)
    expect(retry).toMatchObject({ success: true, idempotent: true })
    if (result.success && retry.success) expect(retry.projection).toEqual(result.projection)
    expect(await snapshot()).toEqual(restored)
    expect(commitmentShortageForBatch((await db.batches.get('A'))!, restored.reservations)).toBe(2000)
  })
  it.each(['ready', 'source', 'target', 'confirm', 'cancel'])('intervening %s writer wins real transaction race, stale B writes nothing', async writer => {
    let shipmentId = ''
    if (writer === 'confirm') shipmentId = (await createShipment({ orderId: 'Lan', lines: [{ reservationId: lan, quantity: 2000 }] })).shipment.id
    const input = await intent(plan(7000, 3000))
    const write = writer === 'ready' ? updateBatchReadyQuantity({ batchId: 'A', newReadyQuantity: 14000 }) :
      writer === 'source' ? db.transaction('rw', [db.batches, db.orders, db.reservations, db.contacts, db.events], async () => {
        await db.batches.update('A', { readyQuantity: 20000 })
        return reserveOwnBatch({ orderId: 'Other', batchId: 'A', quantity: 1000 })
      }) :
      writer === 'target' ? reserveOwnBatch({ orderId: 'Other', batchId: 'B', quantity: 9000 }) :
      writer === 'confirm' ? confirmShipment({ shipmentId }) : cancelOrder({ orderId: 'Lan' })
    const [changed, result] = await Promise.all([write, reconcileBatchShortage(input)])
    expect(changed.success).toBe(true); expect(result).toMatchObject({ success: false, code: 'PREVIEW_CHANGED' })
    expect(await db.events.where('type').equals('batch_reconciled').count()).toBe(0)
    expect(await db.reservations.where('batchId').equals('B').count()).toBe(writer === 'target' ? 1 : 0)
    if (writer !== 'cancel' && writer !== 'confirm') expect((await db.reservations.get(lan))!.quantity).toBe(10000)
  })
  it.each(['ready', 'source', 'target', 'confirm', 'cancel'])('B wins before %s writer; both re-read current commitments', async writer => {
    let shipmentId = ''
    if (writer === 'confirm') shipmentId = (await createShipment({ orderId: 'Lan', lines: [{ reservationId: lan, quantity: 2000 }] })).shipment.id
    const input = await intent(plan(5000, 3000)); const stock = await db.batches.toArray()
    const reduction = reconcileBatchShortage(input)
    const write = writer === 'ready' ? updateBatchReadyQuantity({ batchId: 'A', newReadyQuantity: 14000 }) :
      writer === 'source' ? reserveOwnBatch({ orderId: 'Other', batchId: 'A', quantity: 2000 }) :
      writer === 'target' ? reserveOwnBatch({ orderId: 'Other', batchId: 'B', quantity: 8000 }).catch(() => ({ success: false })) :
      writer === 'confirm' ? confirmShipment({ shipmentId }) : cancelOrder({ orderId: 'Lan' })
    const [result, changed] = await Promise.all([reduction, write])
    expect(result.success).toBe(true)
    expect(changed.success).toBe(writer !== 'target') // B took3k first, so new8k cannot fit available7k.
    expect(await db.events.where('type').equals('batch_reconciled').count()).toBe(1)
    if (writer === 'target') expect(availableQuantityForBatch((await db.batches.get('B'))!, await db.reservations.toArray())).toBe(7000)
    if (!['ready', 'confirm'].includes(writer)) expect(await db.batches.toArray()).toEqual(stock)
    if (writer === 'confirm') {
      expect((await db.reservations.get(lan))!.fulfilledQuantity).toBe(2000)
      expect((await db.batches.get('A'))!.currentQuantity).toBe(stock.find(b => b.id === 'A')!.currentQuantity - 2000)
    }
  })
  it('NO_OP / no-shortage have no marker or writes', async () => {
    await reject(await intent(plan(10000)), 'NO_OP')
    await db.batches.update('A', { readyQuantity: 18000 }); await reject(await intent(), 'NO_OP')
    await reject(await intent({ sourceBatchId: 'A', adjustments: [] }), 'NO_OP')
  })
  it.each([12000, 5000])('O15k/P10k source-after %i protects planned source even when transferring', async n => {
    await db.batches.update('A', { readyQuantity: 40000 }); await db.reservations.update(lan, { quantity: 15000 })
    const { shipment } = await createShipment({ orderId: 'Lan', lines: [{ reservationId: lan, quantity: 10000 }] })
    await db.batches.update('A', { readyQuantity: 20000 })
    const before = await snapshot()
    const input = await intent(plan(n, 15000 - n))
    if (n < 10000) await reject(input, 'PLANNED_ALLOCATION_CONFLICT')
    else {
      expect(await reconcileBatchShortage(input)).toMatchObject({ success: true, projection: { adjustments: [{ plannedQuantity: 10000 }] } })
      expect(await db.shipments.get(shipment.id)).toEqual(shipment)
      expect(await db.batches.toArray()).toEqual(before.batches)
    }
  })
  it('transfer from partially fulfilled record keeps F on source and creates fresh F0 target', async () => {
    await db.batches.update('A', { readyQuantity: 40000 }); await db.reservations.update(lan, { quantity: 25000 })
    const { shipment } = await createShipment({ orderId: 'Lan', lines: [{ reservationId: lan, quantity: 10000 }] })
    expect((await confirmShipment({ shipmentId: shipment.id })).success).toBe(true)
    await db.batches.update('A', { readyQuantity: 20000 })
    const before = await snapshot()
    const result = await reconcileBatchShortage(await intent(plan(12000, 3000)))
    expect(result).toMatchObject({ success: true, projection: { orders: [{ coverageBefore: 25000, coverageAfter: 25000,
      after: { status: 'partially_shipped', requestedQuantity: 30000 } }], targetReservations: [{ reservation: { quantity: 3000, fulfilledQuantity: 0 } }] } })
    expect(await db.reservations.get(lan)).toMatchObject({ quantity: 22000, fulfilledQuantity: 10000, batchId: 'A' })
    expect(await db.shipments.toArray()).toEqual(before.shipments); expect(await db.batches.toArray()).toEqual(before.batches)
  })
  it.each(['target-add', 'order-put'])('record write failure %s rolls back whole transfer and remains retryable', async target => {
    const input = await intent(plan(5000, 3000)); const before = await snapshot()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const spy = target === 'target-add' ? vi.spyOn(db.reservations, 'add').mockRejectedValueOnce(new Error('injected')) :
      vi.spyOn(db.orders, 'put').mockRejectedValueOnce(new Error('injected'))
    expect(await reconcileBatchShortage(input)).toMatchObject({ success: false, code: 'STORAGE_ERROR' })
    expect(await snapshot()).toEqual(before); spy.mockRestore()
    expect((await reconcileBatchShortage(input)).success).toBe(true)
    expect(await db.reservations.where('batchId').equals('B').count()).toBe(1)
  })
  it('preview copies nested transfer intent before read and canonical multi-source retry keeps target IDs', async () => {
    const p = plan(8000, 2000); p.adjustments.push({ reservationId: hung, newOutstanding: 6000, transfer: { targetBatchId: 'C', quantity: 2000 } })
    const promise = previewBatchShortageReconciliation(p); p.adjustments[0].transfer!.quantity = 1
    const preview = await promise
    expect(preview).toMatchObject({ success: true, projection: { targets: [{ incomingTransfer: 2000 }, { incomingTransfer: 2000 }] } })
    p.adjustments[0].transfer!.quantity = 2000
    const input = await intent(p); const first = await reconcileBatchShortage(input)
    const after = await snapshot()
    const retry = await reconcileBatchShortage({ ...input, adjustments: [...input.adjustments].reverse().map(a => ({
      transfer: { quantity: a.transfer!.quantity, targetBatchId: a.transfer!.targetBatchId },
      newOutstanding: a.newOutstanding, reservationId: a.reservationId })) })
    expect(retry).toMatchObject({ success: true, idempotent: true })
    if (first.success && retry.success) expect(retry.projection).toEqual(first.projection)
    expect(await snapshot()).toEqual(after)
  })
  it('different concurrent intent with same operationId loses without additional target/marker', async () => {
    const first = await intent(plan(7000, 3000)); const second = { ...await intent(plan(6000, 3000)), operationId: first.operationId }
    const results = await Promise.all([reconcileBatchShortage(first), reconcileBatchShortage(second)])
    expect(results[0].success).toBe(true); expect(results[1]).toMatchObject({ success: false, code: 'OPERATION_ID_CONFLICT' })
    expect(await db.reservations.where('batchId').equals('B').count()).toBe(1)
    expect(await db.events.where('type').equals('batch_reconciled').count()).toBe(1)
  })
  it('retry after confirm returns original target IDs/projection without changing fulfilled stock/state', async () => {
    const input = await intent(plan(7000, 3000)); const first = await reconcileBatchShortage(input)
    expect(first.success).toBe(true)
    if (!first.success) throw new Error(first.error)
    const targetId = first.projection.targetReservations[0].reservation.id!
    const { shipment } = await createShipment({ orderId: 'Lan', lines: [{ reservationId: targetId, quantity: 3000 }] })
    expect((await confirmShipment({ shipmentId: shipment.id })).success).toBe(true)
    const after = await snapshot(); const retry = await reconcileBatchShortage(input)
    expect(retry).toMatchObject({ success: true, idempotent: true })
    if (retry.success) expect(retry.projection).toEqual(first.projection)
    expect(await snapshot()).toEqual(after)
  })
  it('incomplete marker target identity fails closed without a second transfer', async () => {
    const input = await intent(plan(7000, 3000)); expect((await reconcileBatchShortage(input)).success).toBe(true)
    const marker = (await db.events.where('type').equals('batch_reconciled').first())!
    const payload = marker.payload as { projection: { targetReservations: { reservation: { id?: string } }[] } }
    delete payload.projection.targetReservations[0].reservation.id
    await db.events.update(marker.id, { payload })
    await reject(input, 'INVALID_STATE')
    expect(await db.reservations.where('batchId').equals('B').count()).toBe(1)
  })
})
