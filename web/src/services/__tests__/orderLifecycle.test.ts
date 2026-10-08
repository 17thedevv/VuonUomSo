import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/db'
import { clearAllData } from '../../data/seed'
import { cancelOrder, updateOrder } from '../orderService'
import { createShipment, confirmShipment } from '../shipmentService'
import { reserveOwnBatch, reserveExternalSupplier } from '../reservationService'
import { undoService } from '../undoService'
import { availableQuantityForBatch } from '../../domain/quantity'
import { orderShortage } from '../../domain/order'
import type { Reservation } from '../../domain/reservation'

async function snapshot() {
  return {
    orders: await db.orders.toArray(), batches: await db.batches.toArray(),
    reservations: await db.reservations.toArray(), shipments: await db.shipments.toArray(),
    events: await db.events.toArray()
  }
}

describe('FC2 transactional order corrections', () => {
  beforeEach(async () => {
    await clearAllData()
    undoService.clearLastMutation()
    await db.contacts.bulkPut([
      { id: 'customer', name: 'Bác Ba', roles: ['customer'] },
      { id: 'supplier', name: 'Vườn ngoài', roles: ['supplier'] }
    ])
    await db.batches.put({
      id: 'batch', code: 'BV16 #01', variety: 'BV16', initialQuantity: 100000,
      currentQuantity: 80000, readyQuantity: 60000, status: 'ready', createdAt: '2026-10-08'
    })
    await db.orders.bulkPut([
      { id: 'order', customerId: 'customer', variety: 'BV16', requestedQuantity: 50000,
        status: 'partially_reserved', requestedDate: '2026-10-20', unitPrice: 1200, note: 'old' },
      { id: 'other', customerId: 'customer', variety: 'BV16', requestedQuantity: 5000, status: 'reserved' }
    ])
    const reservations: Reservation[] = [
      { id: 'own', orderId: 'order', sourceType: 'own_batch', batchId: 'batch', quantity: 20000, fulfilledQuantity: 0, status: 'active', createdAt: '2026-10-08' },
      { id: 'external', orderId: 'order', sourceType: 'external_supplier', supplierId: 'supplier', quantity: 12000, fulfilledQuantity: 0, status: 'active', createdAt: '2026-10-08' },
      { id: 'old', orderId: 'order', sourceType: 'own_batch', batchId: 'batch', quantity: 3000, fulfilledQuantity: 0, status: 'released', createdAt: '2026-10-01' },
      { id: 'other-res', orderId: 'other', sourceType: 'own_batch', batchId: 'batch', quantity: 5000, fulfilledQuantity: 0, status: 'active', createdAt: '2026-10-08' }
    ]
    await db.reservations.bulkPut(reservations)
    await db.events.put({ id: 'history', type: 'order_created', entityType: 'order', entityId: 'order', payload: { message: 'old history' }, createdAt: '2026-10-01' })
  })
  afterEach(() => { vi.restoreAllMocks(); undoService.clearLastMutation() })

  it('increases demand without moving reservations or stock; can reserve the increased shortage', async () => {
    const before = await snapshot()
    const result = await updateOrder({ orderId: 'order', requestedQuantity: 60000 })
    expect(result).toMatchObject({ success: true, changed: true, order: { requestedQuantity: 60000, status: 'partially_reserved' } })
    const order = (await db.orders.get('order'))!
    expect(orderShortage(order, await db.reservations.toArray())).toBe(28000)
    expect(await db.reservations.toArray()).toEqual(before.reservations)
    expect(await db.batches.toArray()).toEqual(before.batches)
    await reserveExternalSupplier({ orderId: 'order', supplierId: 'supplier', quantity: 28000 })
    expect((await db.orders.get('order'))?.status).toBe('reserved')
    expect(await db.batches.toArray()).toEqual(before.batches)
  })

  it.each([40000, 32000])('decreases to %s without releasing own or external sources or altering a plan', async (quantity) => {
    await createShipment({ orderId: 'order', lines: [{ reservationId: 'own', quantity: 20000 }] })
    const before = await snapshot()
    const result = await updateOrder({ orderId: 'order', requestedQuantity: quantity })
    expect(result).toMatchObject({ success: true, order: { status: quantity === 32000 ? 'reserved' : 'partially_reserved' } })
    const after = await snapshot()
    expect(after.reservations).toEqual(before.reservations)
    expect(after.shipments).toEqual(before.shipments)
    expect(after.batches).toEqual(before.batches)
    // Existing valid planned shipment remains executable after correction.
    await confirmShipment({ shipmentId: before.shipments[0].id })
    expect((await db.batches.get('batch'))?.currentQuantity).toBe(60000)
  })

  it('returns reconciliation conflict atomically; no hidden release, partial metadata edit or event', async () => {
    const before = await snapshot()
    const result = await updateOrder({ orderId: 'order', requestedQuantity: 30000, note: 'new', requestedDate: '2026-12-01' })
    expect(result).toMatchObject({ success: false, code: 'RECONCILIATION_REQUIRED', conflict: { coveredQuantity: 32000, excessQuantity: 2000 } })
    expect(await snapshot()).toEqual(before)
  })

  it('persists date, zero price and note, preserves old history and logs before/after; no-op is idempotent', async () => {
    const input = { orderId: 'order', requestedDate: '2026-11-01', unitPrice: 0, note: ' new note ' }
    expect(await updateOrder(input)).toMatchObject({ success: true, changed: true })
    expect(await db.orders.get('order')).toMatchObject({ requestedDate: '2026-11-01', unitPrice: 0, note: 'new note' })
    expect(await db.events.get('history')).toBeDefined()
    const events = await db.events.where('type').equals('order_updated').toArray()
    expect(events).toHaveLength(1)
    expect(events[0].payload).toMatchObject({ before: { note: 'old', unitPrice: 1200 }, after: { note: 'new note', unitPrice: 0 } })
    const before = await snapshot()
    expect(await updateOrder(input)).toMatchObject({ success: true, changed: false })
    expect(await snapshot()).toEqual(before)
    expect(await updateOrder({ orderId: 'order', requestedDate: null, unitPrice: null, note: null })).toMatchObject({ success: true })
    expect(await db.orders.get('order')).toMatchObject({ requestedDate: undefined, unitPrice: undefined, note: undefined })
  })

  it('locks variety after any reservation history, including released history', async () => {
    await db.reservations.delete('own')
    await db.reservations.delete('external')
    const before = await snapshot()
    expect(await updateOrder({ orderId: 'order', variety: 'AH1' })).toMatchObject({ success: false, code: 'VARIETY_LOCKED' })
    expect(await snapshot()).toEqual(before)
  })

  it('changes variety only before any reservation; rejects later reservation from the old variety', async () => {
    await db.reservations.where('orderId').equals('order').delete()
    expect(await updateOrder({ orderId: 'order', variety: ' AH1 ' })).toMatchObject({ success: true, order: { variety: 'AH1', status: 'open' } })
    await expect(reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity: 1000 })).rejects.toThrow('không cùng giống')
  })

  it('cancels only this order atomically, releases all active sources and plans while retaining every record', async () => {
    await createShipment({ orderId: 'order', lines: [{ reservationId: 'own', quantity: 10000 }, { reservationId: 'external', quantity: 12000 }] })
    await createShipment({ orderId: 'other', lines: [{ reservationId: 'other-res', quantity: 5000 }] })
    const before = await snapshot()
    const result = await cancelOrder({ orderId: 'order' })
    expect(result).toMatchObject({ success: true, order: { status: 'cancelled' }, releasedReservationIds: ['external', 'own'] })
    const after = await snapshot()
    expect(after.orders).toHaveLength(before.orders.length)
    expect(after.orders.find((o) => o.id === 'order')).toEqual({ ...before.orders.find((o) => o.id === 'order'), status: 'cancelled' })
    expect(after.orders.find((o) => o.id === 'other')).toEqual(before.orders.find((o) => o.id === 'other'))
    expect(after.batches).toEqual(before.batches)
    expect(after.reservations).toHaveLength(before.reservations.length)
    for (const reservation of before.reservations) {
      expect(after.reservations.find((r) => r.id === reservation.id)).toEqual({
        ...reservation, status: reservation.orderId === 'order' && reservation.status === 'active' ? 'released' : reservation.status
      })
    }
    for (const shipment of before.shipments) {
      expect(after.shipments.find((s) => s.id === shipment.id)).toEqual({ ...shipment, status: shipment.orderId === 'order' ? 'cancelled' : 'planned' })
    }
    expect(availableQuantityForBatch(after.batches[0], after.reservations)).toBe(55000)
    for (const event of before.events) expect(after.events).toContainEqual(event)
    expect(after.events.filter((e) => e.type === 'order_cancelled')).toHaveLength(1)
    expect(after.events.some((e) => e.entityType === 'batch' && e.type === 'reservation_released')).toBe(true)
    expect(await cancelOrder({ orderId: 'order' })).toMatchObject({ success: true, releasedReservationIds: [], cancelledShipmentIds: [] })
    expect(await snapshot()).toEqual(after)
    expect(await updateOrder({ orderId: 'order', note: 'revive' })).toMatchObject({ success: false, code: 'ORDER_CANCELLED' })
    await expect(reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity: 1000 })).rejects.toThrow('đã bị hủy')
    await expect(confirmShipment({ shipmentId: before.shipments.find((s) => s.orderId === 'order')!.id })).rejects.toThrow()
  })

  it('cancels a demand with no sources or shipment plans and keeps its metadata', async () => {
    await db.reservations.where('orderId').equals('order').delete()
    expect(await cancelOrder({ orderId: 'order' })).toMatchObject({ success: true, releasedReservationIds: [], cancelledShipmentIds: [], order: { requestedQuantity: 50000, note: 'old' } })
  })

  it('blocks both mutations after completed shipment despite stale order status and preserves every byte', async () => {
    const plan = await createShipment({ orderId: 'order', lines: [{ reservationId: 'own', quantity: 10000 }] })
    await confirmShipment({ shipmentId: plan.shipment.id })
    await db.orders.update('order', { status: 'partially_reserved' })
    const before = await snapshot()
    expect(await cancelOrder({ orderId: 'order' })).toMatchObject({ success: false, code: 'ALREADY_SHIPPED' })
    expect(await updateOrder({ orderId: 'order', requestedQuantity: 70000 })).toMatchObject({ success: false, code: 'ALREADY_SHIPPED' })
    expect(await snapshot()).toEqual(before)
  })

  it.each(['update', 'cancel'] as const)('rolls back %s on event write failure, including cascading status writes', async (operation) => {
    await createShipment({ orderId: 'order', lines: [{ reservationId: 'own', quantity: 10000 }] })
    const before = await snapshot()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const originalWrite = db.events.put.bind(db.events)
    const write = vi.spyOn(db.events, 'put').mockImplementation((event) => {
      if (event.type === (operation === 'update' ? 'order_updated' : 'order_cancelled')) {
        throw new Error('storage failure')
      }
      return originalWrite(event)
    })
    const result = operation === 'update' ? await updateOrder({ orderId: 'order', requestedQuantity: 60000 }) : await cancelOrder({ orderId: 'order' })
    write.mockRestore()
    expect(result).toMatchObject({ success: false, code: 'STORAGE_ERROR' })
    expect(await snapshot()).toEqual(before)
  })

  it('rechecks newly committed reservations when a reduction competes with a reservation', async () => {
    const [reservation, edit] = await Promise.all([
      reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity: 10000 }),
      updateOrder({ orderId: 'order', requestedQuantity: 32000 })
    ])
    expect(reservation.success).toBe(true)
    expect(edit).toMatchObject({ success: false, code: 'RECONCILIATION_REQUIRED', conflict: { coveredQuantity: 42000 } })
    expect((await db.orders.get('order'))?.requestedQuantity).toBe(50000)
    expect((await db.reservations.get('own'))?.status).toBe('active')
  })

  it('serializes duplicate cancellation without duplicate history or incorrect availability', async () => {
    const results = await Promise.all([cancelOrder({ orderId: 'order' }), cancelOrder({ orderId: 'order' })])
    expect(results.every((result) => result.success)).toBe(true)
    expect(await db.events.where('type').equals('order_cancelled').count()).toBe(1)
    expect(availableQuantityForBatch((await db.batches.get('batch'))!, await db.reservations.toArray())).toBe(55000)
  })

  it('serializes cancellation with confirmation: a completed shipment prevents all cascade writes', async () => {
    const plan = await createShipment({ orderId: 'order', lines: [{ reservationId: 'own', quantity: 10000 }] })
    const [shipment, cancel] = await Promise.all([
      confirmShipment({ shipmentId: plan.shipment.id }), cancelOrder({ orderId: 'order' })
    ])
    expect(shipment.success).toBe(true)
    expect(cancel).toMatchObject({ success: false, code: 'ALREADY_SHIPPED' })
    expect((await db.orders.get('order'))?.status).toBe('partially_shipped')
    expect((await db.reservations.get('own'))?.fulfilledQuantity).toBe(10000)
    expect((await db.reservations.get('external'))?.status).toBe('active')
    expect(await db.events.where('type').equals('order_cancelled').count()).toBe(0)
  })

  it('blocks confirmation and new reservations when cancellation commits first', async () => {
    const plan = await createShipment({ orderId: 'order', lines: [{ reservationId: 'own', quantity: 10000 }] })
    const results = await Promise.allSettled([
      cancelOrder({ orderId: 'order' }),
      confirmShipment({ shipmentId: plan.shipment.id }),
      reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity: 1000 })
    ])
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected', 'rejected'])
    expect((await db.orders.get('order'))?.status).toBe('cancelled')
    expect((await db.batches.get('batch'))?.currentQuantity).toBe(80000)
    expect((await db.batches.get('batch'))?.readyQuantity).toBe(60000)
    expect(await db.reservations.count()).toBe(4)
  })

  it('protects old create-order Undo when released reservation history remains on an open order', async () => {
    await db.reservations.where('orderId').equals('order').modify({ status: 'released' })
    await db.orders.update('order', { status: 'open' })
    undoService.recordMutation({ type: 'create_order', orderId: 'order', customerName: 'Bác Ba', description: 'stale' })
    const before = await snapshot()
    expect(await undoService.undoLastMutation()).toMatchObject({ success: false })
    expect(await snapshot()).toEqual(before)
  })

  it.each(['update', 'cancel'] as const)('guards stale create-order Undo after %s even if the old mutation was captured', async (operation) => {
    await db.reservations.where('orderId').equals('order').delete()
    await db.orders.update('order', { status: 'open' })
    const mutation = { type: 'create_order' as const, orderId: 'order', customerName: 'Bác Ba', description: 'old Undo' }
    undoService.recordMutation(mutation)
    const result = operation === 'update' ? await updateOrder({ orderId: 'order', note: 'new' }) : await cancelOrder({ orderId: 'order' })
    expect(result.success).toBe(true)
    expect(undoService.getLastMutation()).toBeNull()
    undoService.recordMutation(mutation)
    const before = await snapshot()
    expect(await undoService.undoLastMutation()).toMatchObject({ success: false })
    expect(await snapshot()).toEqual(before)
  })

  it('rejects invalid input and missing entities without changing history', async () => {
    const before = await snapshot()
    expect(await updateOrder({ orderId: 'order', requestedQuantity: NaN })).toMatchObject({ success: false, code: 'INVALID_INPUT' })
    expect(await updateOrder({ orderId: 'missing', note: 'new' })).toMatchObject({ success: false, code: 'NOT_FOUND' })
    expect(await cancelOrder({ orderId: 'missing' })).toMatchObject({ success: false, code: 'NOT_FOUND' })
    expect(await snapshot()).toEqual(before)
  })
})
