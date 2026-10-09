import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/db'
import { clearAllData } from '../../data/seed'
import { exportWorkspaceBackup, restoreWorkspaceBackup, validateBackup } from '../../data/backup'
import { orderShortage, reservedQuantityForOrder } from '../../domain/order'
import { availableQuantityForBatch } from '../../domain/quantity'
import { reserveExternalSupplier, reserveOwnBatch, releaseReservation, getReservationOptions, type ReserveExternalSupplierParams } from '../reservationService'
import { createShipment, confirmShipment } from '../shipmentService'
import { cancelOrder, updateOrder } from '../orderService'
import { previewOrderReduction, reconcileOrderReduction } from '../reconciliationService'
import { undoService } from '../undoService'

function params(quantity = 12000, supplierId = 'supplier'): ReserveExternalSupplierParams {
  return { orderId: 'order', supplierId, quantity,
    confirmation: { acknowledged: true, supplierId, variety: 'BV16', quantity } }
}
async function state() {
  return { orders: await db.orders.toArray(), reservations: await db.reservations.toArray(),
    batches: await db.batches.toArray(), shipments: await db.shipments.toArray(),
    events: await db.events.toArray(), contacts: await db.contacts.toArray() }
}
async function roundTrip() {
  const exported = await exportWorkspaceBackup()
  expect(validateBackup(exported.backup).valid).toBe(true)
  await clearAllData()
  await restoreWorkspaceBackup(exported.jsonString)
  db.close()
  await db.open()
  expect((await exportWorkspaceBackup()).backup.data).toEqual(exported.backup.data)
  return exported.backup
}

describe('FC4 confirmed external commitments (real Dexie)', () => {
  beforeEach(async () => {
    await clearAllData(); undoService.clearLastMutation()
    await db.contacts.bulkPut([
      { id: 'customer', name: 'Khách', roles: ['customer'] },
      { id: 'supplier', name: 'Vườn Thảo', roles: ['supplier'] },
      { id: 'supplier2', name: 'Nhà vườn mới', roles: ['customer', 'supplier'] }
    ])
    await db.orders.put({ id: 'order', customerId: 'customer', variety: 'BV16', requestedQuantity: 50000, status: 'open' })
    await db.batches.bulkPut([
      { id: 'batch', code: 'BV16 #1', variety: 'BV16', createdAt: '2026-10-08', initialQuantity: 80000,
        currentQuantity: 80000, readyQuantity: 60000, status: 'ready' },
      { id: 'other-batch', code: 'BV16 #2', variety: 'BV16', createdAt: '2026-10-08', initialQuantity: 50000,
        currentQuantity: 50000, readyQuantity: 50000, status: 'ready' }
    ])
  })
  afterEach(() => { vi.restoreAllMocks(); undoService.clearLastMutation() })

  it.each(['missing', 'false', 'supplier', 'quantity', 'variety'] as const)('rejects %s confirmation without writes', async mode => {
    const input = params()
    if (mode === 'missing') delete (input as Partial<ReserveExternalSupplierParams>).confirmation
    if (mode === 'false') input.confirmation.acknowledged = false
    if (mode === 'supplier') input.confirmation.supplierId = 'supplier2'
    if (mode === 'quantity') input.confirmation.quantity = 10000
    if (mode === 'variety') input.confirmation.variety = 'AH1'
    const before = await state()
    await expect(reserveExternalSupplier(input)).rejects.toThrow(/xác nhận/)
    expect(await state()).toEqual(before)
    expect(undoService.getLastMutation()).toBeNull()
  })

  it('re-reads intervening variety change rather than confirming a different order context', async () => {
    const input = params()
    expect(await updateOrder({ orderId: 'order', variety: 'AH1' })).toMatchObject({ success: true, changed: true })
    const before = await state()
    await expect(reserveExternalSupplier(input)).rejects.toThrow(/đã thay đổi/)
    expect(await state()).toEqual(before)
  })

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects unsafe/invalid quantity %s', async quantity => {
    const before = await state()
    await expect(reserveExternalSupplier(params(quantity))).rejects.toThrow(/số nguyên/)
    expect(await state()).toEqual(before)
  })

  it.each(['missing-order', 'missing-supplier', 'role', 'cancelled', 'shipped'] as const)('fails closed for %s', async mode => {
    if (mode === 'missing-order') await db.orders.delete('order')
    if (mode === 'missing-supplier') await db.contacts.delete('supplier')
    if (mode === 'role') await db.contacts.update('supplier', { roles: ['customer'] })
    if (mode === 'cancelled' || mode === 'shipped') await db.orders.update('order', { status: mode })
    const before = await state()
    await expect(reserveExternalSupplier(params())).rejects.toThrow()
    expect(await state()).toEqual(before)
  })

  it('candidate contains only contact facts, with no catalog/fallback/variety inventory', async () => {
    const options = await getReservationOptions('order')
    expect(options?.externalSuppliers).toEqual([
      { supplierId: 'supplier', name: 'Vườn Thảo', phone: undefined },
      { supplierId: 'supplier2', name: 'Nhà vườn mới', phone: undefined }
    ])
  })

  it('accepts confirmed40k above the old estimate; history is truthful, confirmation is not persisted', async () => {
    await db.orders.update('order', { variety: 'Keo lai BV16' })
    const input = params(40000); input.confirmation.variety = 'Keo lai BV16'
    const before = await state()
    const { reservation } = await reserveExternalSupplier(input)
    expect(reservation).toMatchObject({ quantity: 40000, fulfilledQuantity: 0, status: 'active' })
    expect(Object.keys(reservation).sort()).toEqual(['id', 'orderId', 'sourceType', 'supplierId', 'quantity', 'fulfilledQuantity', 'status', 'createdAt'].sort())
    const after = await state()
    expect(after.batches).toEqual(before.batches)
    expect(availableQuantityForBatch(after.batches[0], after.reservations)).toBe(60000)
    expect(orderShortage(after.orders[0], after.reservations)).toBe(10000)
    expect(after.events[0].payload).toMatchObject({ supplierId: 'supplier', supplierName: 'Vườn Thảo',
      variety: 'Keo lai BV16', quantity: 40000, message: 'Đã ghi nhận giữ 40.000 cây từ Vườn Thảo' })
  })

  it('rechecks intervening coverage and quantity corrections at commit time', async () => {
    const input = params(40000)
    await reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity: 20000 })
    const before = await state()
    await expect(reserveExternalSupplier(input)).rejects.toThrow(/30.000/)
    expect(await state()).toEqual(before)
    expect(await updateOrder({ orderId: 'order', requestedQuantity: 25000 })).toMatchObject({ success: true, changed: true })
    const corrected = await state()
    await expect(reserveExternalSupplier(params(10000))).rejects.toThrow(/5.000/)
    expect(await state()).toEqual(corrected)
  })

  it.each(['own', 'external'] as const)('concurrent external versus %s writer cannot over-cover shortage10k', async other => {
    await db.orders.update('order', { requestedQuantity: 10000 })
    const batches = await db.batches.toArray()
    const results = await Promise.allSettled([
      reserveExternalSupplier(params(10000)),
      other === 'own' ? reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity: 10000 }) : reserveExternalSupplier(params(10000, 'supplier2'))
    ])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1)
    const after = await state()
    expect(after.reservations).toHaveLength(1)
    expect(reservedQuantityForOrder('order', after.reservations)).toBe(10000)
    expect(after.events.filter(e => e.entityType === 'order' && e.type === 'reservation_created')).toHaveLength(1)
    expect(after.batches).toEqual(batches)
  })

  it('event failure rolls back reservation/order/history and records no Undo; retry succeeds', async () => {
    const before = await state()
    vi.spyOn(db.events, 'put').mockRejectedValueOnce(new Error('storage failure'))
    await expect(reserveExternalSupplier(params())).rejects.toThrow('storage failure')
    expect(await state()).toEqual(before)
    expect(undoService.getLastMutation()).toBeNull()
    expect((await reserveExternalSupplier(params())).success).toBe(true)
    expect(await db.reservations.count()).toBe(1)
  })

  it.each([8000, 0])('real Trigger A adjusts confirmed12k to outstanding%i; old Undo is stale; backup round-trips', async outstanding => {
    const { reservation } = await reserveExternalSupplier(params())
    const undo = undoService.getLastMutation()!
    const batches = await db.batches.toArray()
    const plan = { orderId: 'order', desiredRequestedQuantity: 10000,
      adjustments: [{ reservationId: reservation.id, newOutstanding: outstanding }] }
    const preview = await previewOrderReduction(plan)
    if (!preview.success) throw new Error(preview.error)
    const input = { ...plan, expectedFingerprint: preview.fingerprint, operationId: `fc4-${outstanding}` }
    expect(await reconcileOrderReduction(input)).toMatchObject({ success: true, idempotent: false })
    const after = await state()
    expect(await reconcileOrderReduction(input)).toMatchObject({ success: true, idempotent: true })
    expect(await state()).toEqual(after)
    expect(after.batches).toEqual(batches)
    expect(await db.reservations.get(reservation.id)).toMatchObject(outstanding > 0
      ? { quantity: 8000, fulfilledQuantity: 0, status: 'active' }
      : { quantity: 12000, fulfilledQuantity: 0, status: 'released' })
    undoService.recordMutation(undo, 0)
    expect((await undoService.undoLastMutation()).success).toBe(false)
    expect(await state()).toEqual(after)
    await roundTrip()
  })

  it('planned allocation blocks independent release and Trigger A; cancel cascades atomically preserving history', async () => {
    const { reservation } = await reserveExternalSupplier(params())
    const { shipment } = await createShipment({ orderId: 'order', lines: [{ reservationId: reservation.id, quantity: 5000 }] })
    const before = await state()
    await expect(releaseReservation({ reservationId: reservation.id })).rejects.toThrow(/chuyến/)
    const preview = await previewOrderReduction({ orderId: 'order', desiredRequestedQuantity: 10000,
      adjustments: [{ reservationId: reservation.id, newOutstanding: 4000 }] })
    expect(preview).toMatchObject({ success: false, code: 'PLANNED_ALLOCATION_CONFLICT' })
    expect(await state()).toEqual(before)
    expect(await cancelOrder({ orderId: 'order' })).toMatchObject({ success: true })
    const after = await state()
    expect(after.batches).toEqual(before.batches)
    expect(await db.reservations.get(reservation.id)).toMatchObject({ quantity: 12000, fulfilledQuantity: 0, status: 'released' })
    expect((await db.shipments.get(shipment.id))?.status).toBe('cancelled')
    expect(after.events).toEqual(expect.arrayContaining(before.events))
    await roundTrip()
  })

  it('external partial shipment leaves all own batches unchanged; old Undo fails; release preserves F coverage', async () => {
    await db.orders.update('order', { requestedQuantity: 20000 })
    const { reservation } = await reserveExternalSupplier(params())
    const undo = undoService.getLastMutation()!
    const batches = await db.batches.toArray()
    const { shipment } = await createShipment({ orderId: 'order', lines: [{ reservationId: reservation.id, quantity: 5000 }] })
    await confirmShipment({ shipmentId: shipment.id })
    expect(await db.batches.toArray()).toEqual(batches)
    expect(await db.reservations.get(reservation.id)).toMatchObject({ fulfilledQuantity: 5000, status: 'active' })
    expect((await db.orders.get('order'))?.status).toBe('partially_shipped')
    const afterShipment = await state()
    undoService.recordMutation(undo, 0)
    expect((await undoService.undoLastMutation()).success).toBe(false)
    expect(await state()).toEqual(afterShipment)
    await releaseReservation({ reservationId: reservation.id })
    expect(await db.reservations.get(reservation.id)).toMatchObject({ quantity: 12000, fulfilledQuantity: 5000, status: 'released' })
    expect(reservedQuantityForOrder('order', await db.reservations.toArray())).toBe(5000)
    await expect(reserveExternalSupplier(params(20000))).rejects.toThrow(/15.000/)
    await reserveExternalSupplier(params(15000))
    expect(reservedQuantityForOrder('order', await db.reservations.toArray())).toBe(20000)
    expect(await db.batches.toArray()).toEqual(batches)
    expect(await cancelOrder({ orderId: 'order' })).toMatchObject({ success: false })
    await roundTrip()
  })

  it('mixed shipment reduces only the own line stock and preserves external/own F after restore', async () => {
    const external = (await reserveExternalSupplier(params())).reservation
    const own = (await reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity: 10000 })).reservation
    const before = await db.batches.toArray()
    const { shipment } = await createShipment({ orderId: 'order', lines: [
      { reservationId: own.id, quantity: 3000 }, { reservationId: external.id, quantity: 5000 }
    ] })
    await confirmShipment({ shipmentId: shipment.id })
    expect(await db.batches.get('batch')).toEqual({ ...before.find(b => b.id === 'batch'), currentQuantity: 77000, readyQuantity: 57000 })
    expect(await db.batches.get('other-batch')).toEqual(before.find(b => b.id === 'other-batch'))
    expect((await db.reservations.get(own.id))?.fulfilledQuantity).toBe(3000)
    expect((await db.reservations.get(external.id))?.fulfilledQuantity).toBe(5000)
    await roundTrip()
  })

  it('legacy external reservations/events with no acknowledgement remain valid on restore/reopen', async () => {
    await db.reservations.put({ id: 'legacy', orderId: 'order', supplierId: 'supplier', sourceType: 'external_supplier',
      quantity: 12000, status: 'active', createdAt: '2026-09-01' })
    await db.events.put({ id: 'legacy-event', type: 'reservation_created', entityType: 'order', entityId: 'order',
      payload: { message: 'Đã giữ 12.000 cây từ Vườn Thảo' }, createdAt: '2026-09-01' })
    await roundTrip()
    expect((await getReservationOptions('order'))?.shortage).toBe(38000)
    await releaseReservation({ reservationId: 'legacy' })
    expect((await db.reservations.get('legacy'))?.status).toBe('released')
    expect(await db.events.get('legacy-event')).toMatchObject({ payload: { message: 'Đã giữ 12.000 cây từ Vườn Thảo' } })
  })

  it.each(['supplier-missing', 'role', 'Q0', 'F>Q', 'status', 'coverage', 'planned>O', 'completed/F'] as const)('backup rejects %s corruption without any supplier stock requirement', async mode => {
    const { reservation } = await reserveExternalSupplier(params())
    const { shipment } = await createShipment({ orderId: 'order', lines: [{ reservationId: reservation.id, quantity: 5000 }] })
    await confirmShipment({ shipmentId: shipment.id })
    const backup = (await exportWorkspaceBackup()).backup
    const r = backup.data.reservations[0]
    if (mode === 'supplier-missing') r.supplierId = 'missing'
    if (mode === 'role') backup.data.contacts.find(c => c.id === 'supplier')!.roles = ['customer']
    if (mode === 'Q0') r.quantity = 0
    if (mode === 'F>Q') r.fulfilledQuantity = 13000
    if (mode === 'status') r.status = 'fulfilled'
    if (mode === 'coverage') r.quantity = 60000
    if (mode === 'planned>O') {
      backup.data.shipments.push({ id: 'bad-plan', orderId: 'order', status: 'planned', plannedQuantity: 8000, shippedQuantity: 0,
        lines: [{ reservationId: r.id, sourceType: 'external_supplier', supplierId: 'supplier', quantity: 8000 }] })
      backup.recordCounts.shipments++
    }
    if (mode === 'completed/F') r.fulfilledQuantity = 4000
    expect(validateBackup(backup).valid).toBe(false)
  })
})
