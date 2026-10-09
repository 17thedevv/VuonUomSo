import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/db'
import { clearAllData } from '../../data/seed'
import { exportWorkspaceBackup, restoreWorkspaceBackup } from '../../data/backup'
import { validateBackup } from '../../data/backup/backup.validate'
import { closeOrderRemaining, previewCloseOrderRemaining, type CloseOrderRemainingInput } from '../orderCompletionService'
import { reserveOwnBatch, reserveExternalSupplier, releaseReservation } from '../reservationService'
import { createShipment, confirmShipment, cancelShipment, getOrderShipmentSummary } from '../shipmentService'
import { updateOrder, cancelOrder } from '../orderService'
import { previewOrderReduction, reconcileOrderReduction } from '../reconciliationService'
import { previewBatchShortageReconciliation, reconcileBatchShortage } from '../batchReconciliationService'
import { undoService } from '../undoService'
import { reservedQuantityForOrder } from '../../domain/order'
import { createDomainEvent } from '../../analytics/events'
import type { Shipment } from '../../domain/shipment'
import type { Reservation } from '../../domain/reservation'

let own: Reservation
let external: Reservation
let plan: Shipment
let completed: Shipment
async function snapshot() {
  return { orders: await db.orders.toArray(), reservations: await db.reservations.toArray(), shipments: await db.shipments.toArray(),
    batches: await db.batches.toArray(), contacts: await db.contacts.toArray(), events: await db.events.toArray() }
}
async function intent(operationId = 'close'): Promise<CloseOrderRemainingInput> {
  const preview = await previewCloseOrderRemaining({ orderId: 'order' })
  if (!preview.success) throw new Error(JSON.stringify(preview))
  return { orderId: 'order', operationId, expectedFingerprint: preview.fingerprint }
}
async function base() {
  await db.contacts.bulkPut([{ id: 'customer', name: 'Khách', roles: ['customer'] },
    { id: 'supplier', name: 'Vườn ngoài', roles: ['supplier'] }])
  await db.batches.put({ id: 'batch', code: 'BV16 #1', variety: 'BV16', initialQuantity: 100000,
    currentQuantity: 80000, readyQuantity: 60000, status: 'ready', createdAt: '2026-10-09' })
  await db.orders.put({ id: 'order', customerId: 'customer', variety: 'BV16', requestedQuantity: 50000,
    requestedDate: '2026-10-20', unitPrice: 1000, note: 'Buổi sáng', status: 'open' })
  own = (await reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity: 20000 })).reservation
  external = (await reserveExternalSupplier({ orderId: 'order', supplierId: 'supplier', quantity: 12000,
    confirmation: { acknowledged: true, supplierId: 'supplier', variety: 'BV16', quantity: 12000 } })).reservation
}
async function shipPartial() {
  completed = (await createShipment({ orderId: 'order', lines: [{ reservationId: own.id, quantity: 15000 },
    { reservationId: external.id, quantity: 5000 }] })).shipment
  await confirmShipment({ shipmentId: completed.id })
  plan = (await createShipment({ orderId: 'order', lines: [{ reservationId: external.id, quantity: 5000 }],
    plannedDate: '2026-10-22', note: 'Chờ xe' })).shipment
}
async function expectNoWrite(input: CloseOrderRemainingInput, code: string) {
  const before = await snapshot()
  expect(await closeOrderRemaining(input)).toMatchObject({ success: false, code })
  expect(await snapshot()).toEqual(before)
}

describe('FC5-1 atomic close remaining — real Dexie', () => {
  beforeEach(async () => { undoService.clearLastMutation(); await clearAllData(); await base(); await shipPartial() })
  afterEach(() => { vi.restoreAllMocks(); undoService.clearLastMutation() })

  it('R50/S20/O12/P5: preview writes nothing, cascade preserves Q/F/history/metadata/stock and separates stopped from released', async () => {
    const before = await snapshot()
    const input = await intent()
    expect(await snapshot()).toEqual(before)
    const result = await closeOrderRemaining(input)
    expect(result).toMatchObject({ success: true, idempotent: false, projection: { requestedQuantity: 50000,
      shippedQuantity: 20000, stoppedQuantity: 30000, releasedOutstanding: 12000, coverageBefore: 32000, coverageAfter: 20000 } })
    const after = await snapshot()
    expect(after.batches).toEqual(before.batches)
    expect(after.contacts).toEqual(before.contacts)
    expect(after.orders[0]).toEqual({ ...before.orders[0], status: 'closed_remaining' })
    for (const r of before.reservations) expect(after.reservations).toContainEqual({ ...r, status: 'released' })
    expect(after.shipments).toContainEqual(before.shipments.find(s => s.id === completed.id))
    expect(after.shipments).toContainEqual({ ...plan, status: 'cancelled' })
    for (const e of before.events) expect(after.events).toContainEqual(e)
    expect(reservedQuantityForOrder('order', after.reservations)).toBe(20000)
    const releaseEvents = after.events.filter(e => e.type === 'reservation_released' && e.entityType === 'order')
    expect(releaseEvents.map(e => e.payload)).toEqual(expect.arrayContaining([
      expect.objectContaining({ quantity: 20000, fulfilledQuantity: 15000, releasedQuantity: 5000 }),
      expect.objectContaining({ quantity: 12000, fulfilledQuantity: 5000, releasedQuantity: 7000 })
    ]))
    expect(await getOrderShipmentSummary('order')).toMatchObject({ remainingToShip: 0, totalShipped: 20000, canCreateShipment: false })
  })

  it('no active source closes successfully without rewriting released or fulfilled records', async () => {
    await cancelShipment({ shipmentId: plan.id })
    await releaseReservation({ reservationId: own.id })
    await releaseReservation({ reservationId: external.id })
    const before = await snapshot()
    expect(await closeOrderRemaining(await intent())).toMatchObject({ success: true, projection: { stoppedQuantity: 30000, releasedOutstanding: 0, releases: [] } })
    expect((await snapshot()).reservations).toEqual(before.reservations)
    expect((await snapshot()).batches).toEqual(before.batches)
  })

  it('availability recalculates truthfully under shortage; another order and physical objects stay unchanged', async () => {
    await db.orders.put({ id: 'other', customerId: 'customer', variety: 'BV16', requestedQuantity: 10000, status: 'open' })
    await reserveOwnBatch({ orderId: 'other', batchId: 'batch', quantity: 8000 })
    await db.batches.update('batch', { readyQuantity: 10000 })
    const before = await snapshot()
    expect(await closeOrderRemaining(await intent())).toMatchObject({ success: true, projection: { batchEffects: [
      { availableBefore: 0, availableAfter: 2000, shortageBefore: 3000, shortageAfter: 0 } ] } })
    const after = await snapshot()
    expect(after.batches).toEqual(before.batches)
    expect(after.orders.find(o => o.id === 'other')).toEqual(before.orders.find(o => o.id === 'other'))
    expect(after.reservations.filter(r => r.orderId === 'other')).toEqual(before.reservations.filter(r => r.orderId === 'other'))
  })

  it('cancels every verifiable planned shipment, summing multiple allocations atomically', async () => {
    const extra = { ...plan, id: 'another-plan', plannedQuantity: 2000,
      lines: [{ ...plan.lines![0], quantity: 2000 }] }
    await db.shipments.put(extra)
    const result = await closeOrderRemaining(await intent())
    expect(result).toMatchObject({ success: true, projection: { cancelledPlans: expect.any(Array) } })
    expect(await db.shipments.where('orderId').equals('order').filter(s => s.status === 'planned').count()).toBe(0)
    expect(await db.shipments.get(extra.id)).toEqual({ ...extra, status: 'cancelled' })
  })

  it.each(['order quantity', 'note', 'date', 'price', 'variety', 'source quantity', 'source status', 'new source', 'deleted source',
    'contact', 'supplier role', 'stock', 'other commitment', 'planned date', 'planned line', 'completed date', 'order event', 'batch event'])
  ('strict confirmation invalidates changed %s with zero writes', async kind => {
    const input = await intent()
    if (kind === 'order quantity') await db.orders.update('order', { requestedQuantity: 60000 })
    if (kind === 'note') await db.orders.update('order', { note: 'Mới' })
    if (kind === 'date') await db.orders.update('order', { requestedDate: '2026-10-25' })
    if (kind === 'price') await db.orders.update('order', { unitPrice: 1500 })
    if (kind === 'variety') await db.orders.update('order', { variety: 'BV10' })
    if (kind === 'source quantity') await db.reservations.update(own.id, { quantity: 19000 })
    if (kind === 'source status') await db.reservations.update(own.id, { status: 'released' })
    if (kind === 'new source') await db.reservations.put({ ...own, id: 'new-source', quantity: 1000 })
    if (kind === 'deleted source') await db.reservations.delete(own.id)
    if (kind === 'contact') await db.contacts.update('supplier', { name: 'Tên mới' })
    if (kind === 'supplier role') await db.contacts.update('supplier', { roles: ['customer'] })
    if (kind === 'stock') await db.batches.update('batch', { readyQuantity: 25000 })
    if (kind === 'other commitment') await db.reservations.put({ ...own, id: 'other-source', orderId: 'other', quantity: 1000 })
    if (kind === 'planned date') await db.shipments.update(plan.id, { plannedDate: '2026-10-30' })
    if (kind === 'planned line') await db.shipments.update(plan.id, { lines: [{ ...plan.lines![0], quantity: 4000 }], plannedQuantity: 4000 })
    if (kind === 'completed date') await db.shipments.update(completed.id, { shippedAt: '2026-10-08' })
    if (kind === 'order event') await db.events.put(createDomainEvent('order_updated', 'order', 'order', {}))
    if (kind === 'batch event') await db.events.put(createDomainEvent('batch_counted', 'batch', 'batch', {}))
    await expectNoWrite(input, 'PREVIEW_CHANGED')
  })

  it.each(['Q0', 'F>Q', 'F mismatch', 'completed no lines', 'foreign reference', 'wrong source', 'planned over O',
    'planned no lines', 'unsafe R', 'unsafe sum', 'coverage > R', 'overship', 'stale status'])
  ('rejects corrupt/unverifiable %s at preview without writing', async kind => {
    if (kind === 'Q0') await db.reservations.update(own.id, { quantity: 0 })
    if (kind === 'F>Q') await db.reservations.update(own.id, { fulfilledQuantity: 21000 })
    if (kind === 'F mismatch') await db.reservations.update(own.id, { fulfilledQuantity: 14000 })
    if (kind === 'completed no lines') await db.shipments.update(completed.id, { lines: [] })
    if (kind === 'foreign reference') await db.shipments.update(completed.id, { orderId: 'other' })
    if (kind === 'wrong source') await db.shipments.update(completed.id, { lines: [{ ...completed.lines![0], batchId: 'missing' }, completed.lines![1]] })
    if (kind === 'planned over O') await db.shipments.update(plan.id, { plannedQuantity: 8000, lines: [{ ...plan.lines![0], quantity: 8000 }] })
    if (kind === 'planned no lines') await db.shipments.update(plan.id, { lines: [] })
    if (kind === 'unsafe R') await db.orders.update('order', { requestedQuantity: Number.MAX_SAFE_INTEGER + 1 })
    if (kind === 'unsafe sum') await db.reservations.bulkPut([{ ...own, id: 'huge1', quantity: Number.MAX_SAFE_INTEGER }, { ...own, id: 'huge2', quantity: 1 }])
    if (kind === 'coverage > R') await db.orders.update('order', { requestedQuantity: 25000 })
    if (kind === 'overship') await db.orders.update('order', { requestedQuantity: 19000 })
    if (kind === 'stale status') await db.orders.update('order', { status: 'reserved' })
    const before = await snapshot()
    expect(await previewCloseOrderRemaining({ orderId: 'order' })).toMatchObject({ success: false, code: 'INVALID_STATE' })
    expect(await snapshot()).toEqual(before)
  })

  it('S0 / S=R reject close; terminal state cannot create a new closure', async () => {
    await clearAllData(); await base()
    expect(await previewCloseOrderRemaining({ orderId: 'order' })).toMatchObject({ success: false, code: 'NOT_PARTIALLY_SHIPPED' })
    await db.orders.update('order', { requestedQuantity: 32000 })
    const s = (await createShipment({ orderId: 'order', lines: [{ reservationId: own.id, quantity: 20000 }, { reservationId: external.id, quantity: 12000 }] })).shipment
    await confirmShipment({ shipmentId: s.id })
    expect(await previewCloseOrderRemaining({ orderId: 'order' })).toMatchObject({ success: false, code: 'ORDER_TERMINAL' })
  })

  it('double submit, reload/reopen, restore retry produce exactly one cascade and marker', async () => {
    const input = await intent()
    const results = await Promise.all([closeOrderRemaining(input), closeOrderRemaining(input)])
    expect(results).toEqual(expect.arrayContaining([expect.objectContaining({ success: true, idempotent: false }), expect.objectContaining({ success: true, idempotent: true })]))
    const before = await snapshot()
    const { backup } = await exportWorkspaceBackup()
    expect(validateBackup(backup)).toEqual({ valid: true, errors: [] })
    db.close(); await db.open()
    expect(await closeOrderRemaining(input)).toMatchObject({ success: true, idempotent: true })
    expect(await snapshot()).toEqual(before)
    await restoreWorkspaceBackup(JSON.stringify(backup))
    db.close(); await db.open()
    expect(await closeOrderRemaining(input)).toMatchObject({ success: true, idempotent: true })
    expect(await snapshot()).toEqual(before)
    await db.batches.update('batch', { readyQuantity: 10000 })
    const changed = await snapshot()
    expect(await closeOrderRemaining(input)).toMatchObject({ success: true, idempotent: true })
    expect(await snapshot()).toEqual(changed)
    expect(await db.events.where('type').equals('order_closed_remaining').count()).toBe(1)
  })

  it.each(['order', 'fingerprint'])('same operationId with different %s is a no-write conflict', async kind => {
    const input = await intent()
    await closeOrderRemaining(input)
    await expectNoWrite({ ...input, ...(kind === 'order' ? { orderId: 'other' } : { expectedFingerprint: 'changed' }) }, 'OPERATION_ID_CONFLICT')
  })

  it.each(['stopped', 'Q/F', 'release total', 'plan identity', 'completed proof', 'top-level', 'duplicate marker', 'bad shape'])
  ('corrupt %s marker cannot return fabricated retry or restore', async kind => {
    const input = await intent()
    await closeOrderRemaining(input)
    const { backup } = await exportWorkspaceBackup()
    const marker = (await db.events.where('type').equals('order_closed_remaining').first())!
    const payload = structuredClone(marker.payload) as { stoppedQuantity: number; projection: { stoppedQuantity: number; releasedOutstanding: number;
      releases: { before: Reservation }[]; cancelledPlans: { before: Shipment }[]; completedShipments: Shipment[] } }
    if (kind === 'stopped') payload.projection.stoppedQuantity++
    if (kind === 'Q/F') payload.projection.releases[0].before.fulfilledQuantity = 1
    if (kind === 'release total') payload.projection.releasedOutstanding++
    if (kind === 'plan identity') payload.projection.cancelledPlans[0].before.id = 'fake'
    if (kind === 'completed proof') payload.projection.completedShipments[0].lines = []
    if (kind === 'top-level') payload.stoppedQuantity++
    if (kind === 'bad shape') payload.projection.releases = [null as unknown as { before: Reservation }]
    if (kind === 'duplicate marker') await db.events.put({ ...marker, id: 'duplicate' })
    else await db.events.put({ ...marker, payload })
    await expectNoWrite(input, 'INVALID_STATE')
    await expect(exportWorkspaceBackup()).rejects.toThrow()
    backup.data.events = await db.events.toArray()
    expect(validateBackup(backup).valid).toBe(false)
    const before = await snapshot()
    await expect(restoreWorkspaceBackup(JSON.stringify(backup))).rejects.toThrow()
    expect(await snapshot()).toEqual(before)
  })

  it.each(['reservation write', 'shipment write', 'order write', 'source event', 'shipment event', 'marker'])
  ('%s failure rolls the entire cascade back; the same identity can retry', async kind => {
    const input = await intent()
    const before = await snapshot()
    if (kind === 'reservation write') vi.spyOn(db.reservations, 'put').mockRejectedValueOnce(new Error('disk'))
    if (kind === 'shipment write') vi.spyOn(db.shipments, 'put').mockRejectedValueOnce(new Error('disk'))
    if (kind === 'order write') vi.spyOn(db.orders, 'put').mockRejectedValueOnce(new Error('disk'))
    if (kind.endsWith('event') || kind === 'marker') {
      const original = db.events.put.bind(db.events)
      vi.spyOn(db.events, 'put').mockImplementation(event => {
        if (event.type === (kind === 'source event' ? 'reservation_released' : kind === 'shipment event' ? 'shipment_cancelled' : 'order_closed_remaining')) {
          throw new Error('disk')
        }
        return original(event)
      })
    }
    expect(await closeOrderRemaining(input)).toMatchObject({ success: false, code: 'STORAGE_ERROR' })
    expect(await snapshot()).toEqual(before)
    vi.restoreAllMocks()
    expect(await closeOrderRemaining(input)).toMatchObject({ success: true, idempotent: false })
  })

  it.each([true, false])('real concurrent close ↔ confirm; close first = %s', async closeFirst => {
    const input = await intent()
    const before = await snapshot()
    const calls = closeFirst ? [closeOrderRemaining(input), confirmShipment({ shipmentId: plan.id })] :
      [confirmShipment({ shipmentId: plan.id }), closeOrderRemaining(input)]
    const results = await Promise.allSettled(calls)
    if (closeFirst) {
      expect(results[0]).toMatchObject({ status: 'fulfilled', value: { success: true } })
      expect(results[1].status).toBe('rejected')
      expect((await snapshot()).batches).toEqual(before.batches)
    } else {
      expect(results[0]).toMatchObject({ status: 'fulfilled', value: { success: true } })
      expect(results[1]).toMatchObject({ status: 'fulfilled', value: { success: false, code: 'PREVIEW_CHANGED' } })
      expect((await db.orders.get('order'))?.status).toBe('partially_shipped')
      expect((await db.reservations.get(external.id))?.fulfilledQuantity).toBe(10000)
    }
  })

  it.each(['reserve', 'release', 'Trigger B'])('real %s wins first → stale close; close wins → no resurrection', async kind => {
    await cancelShipment({ shipmentId: plan.id })
    let bInput: Parameters<typeof reconcileBatchShortage>[0] | undefined
    if (kind === 'Trigger B') {
      await db.batches.update('batch', { readyQuantity: 2000 })
      const p = { sourceBatchId: 'batch', adjustments: [{ reservationId: own.id, newOutstanding: 4000 }] }
      const preview = await previewBatchShortageReconciliation(p)
      expect(preview.success).toBe(true)
      if (preview.success) bInput = { ...p, operationId: 'batch-change', expectedFingerprint: preview.fingerprint }
    }
    const input = await intent()
    const change = () => kind === 'reserve' ? reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity: 1000 }) :
      kind === 'release' ? releaseReservation({ reservationId: own.id }) : reconcileBatchShortage(bInput!)
    const first = await Promise.allSettled([change(), closeOrderRemaining(input)])
    expect(first[0]).toMatchObject({ status: 'fulfilled', value: { success: true } })
    expect(first[1]).toMatchObject({ status: 'fulfilled', value: { success: false, code: 'PREVIEW_CHANGED' } })
    const refreshed = await intent('new-close')
    expect(await closeOrderRemaining(refreshed)).toMatchObject({ success: true })
    const before = await snapshot()
    if (kind === 'reserve') await expect(change()).rejects.toThrow()
    else if (kind === 'release') {
      // Already released is a legitimate no-write retry. A forged new active source is explicitly blocked.
      await db.reservations.put({ ...own, status: 'active' })
      const corrupt = await snapshot()
      await expect(change()).rejects.toThrow(/dừng phần còn lại/)
      expect(await snapshot()).toEqual(corrupt)
      return
    } else expect(await change()).toMatchObject({ success: true, idempotent: true }) // exact old retry is allowed
    expect(await snapshot()).toEqual(before)
  })

  it('all new terminal entry points reject; existing cancelled/completed retries write nothing', async () => {
    await closeOrderRemaining(await intent())
    const before = await snapshot()
    await expect(reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity: 1000 })).rejects.toThrow()
    await expect(reserveExternalSupplier({ orderId: 'order', supplierId: 'supplier', quantity: 1000,
      confirmation: { acknowledged: true, supplierId: 'supplier', variety: 'BV16', quantity: 1000 } })).rejects.toThrow()
    await expect(createShipment({ orderId: 'order', lines: [{ reservationId: own.id, quantity: 1000 }] })).rejects.toThrow()
    expect(await updateOrder({ orderId: 'order', note: 'Không' })).toMatchObject({ success: false, code: 'ORDER_TERMINAL' })
    expect(await cancelOrder({ orderId: 'order' })).toMatchObject({ success: false, code: 'ORDER_TERMINAL' })
    expect(await previewOrderReduction({ orderId: 'order', desiredRequestedQuantity: 30000, adjustments: [] })).toMatchObject({ success: false, code: 'ORDER_TERMINAL' })
    expect(await previewBatchShortageReconciliation({ sourceBatchId: 'batch', adjustments: [{ reservationId: own.id, newOutstanding: 0 }] })).toMatchObject({ success: false, code: 'ORDER_TERMINAL' })
    expect(await confirmShipment({ shipmentId: completed.id })).toMatchObject({ success: true })
    expect(await cancelShipment({ shipmentId: plan.id })).toMatchObject({ success: true })
    expect(await releaseReservation({ reservationId: own.id })).toMatchObject({ success: true })
    expect(await snapshot()).toEqual(before)
    await db.shipments.put({ ...plan, status: 'planned' })
    const corrupt = await snapshot()
    await expect(confirmShipment({ shipmentId: plan.id })).rejects.toThrow(/ORDER_TERMINAL/)
    await expect(cancelShipment({ shipmentId: plan.id })).rejects.toThrow(/kết thúc/)
    expect(await snapshot()).toEqual(corrupt)
  })

  it.each(['reserve', 'release', 'Trigger B'])('close commits first in a real concurrent %s request, preserving terminal authority', async kind => {
    await cancelShipment({ shipmentId: plan.id })
    let bInput: Parameters<typeof reconcileBatchShortage>[0] | undefined
    if (kind === 'Trigger B') {
      await db.batches.update('batch', { readyQuantity: 2000 })
      const p = { sourceBatchId: 'batch', adjustments: [{ reservationId: own.id, newOutstanding: 4000 }] }
      const preview = await previewBatchShortageReconciliation(p)
      if (!preview.success) throw new Error(JSON.stringify(preview))
      bInput = { ...p, operationId: 'uncommitted-b', expectedFingerprint: preview.fingerprint }
    }
    const input = await intent()
    const before = await snapshot()
    const closing = closeOrderRemaining(input)
    const other = kind === 'reserve' ? reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity: 1000 }) :
      kind === 'release' ? releaseReservation({ reservationId: own.id }) : reconcileBatchShortage(bInput!)
    const results = await Promise.allSettled([closing, other])
    expect(results[0]).toMatchObject({ status: 'fulfilled', value: { success: true } })
    if (kind === 'reserve') expect(results[1].status).toBe('rejected')
    if (kind === 'release') expect(results[1]).toMatchObject({ status: 'fulfilled', value: { success: true } }) // already-released no-write retry
    if (kind === 'Trigger B') expect(results[1]).toMatchObject({ status: 'fulfilled', value: { success: false, code: 'PREVIEW_CHANGED' } })
    const after = await snapshot()
    expect(after.orders[0].status).toBe('closed_remaining')
    expect(after.batches).toEqual(before.batches)
    expect(after.reservations.every(r => r.status === 'released')).toBe(true)
    expect(after.events.filter(e => e.type === 'order_closed_remaining')).toHaveLength(1)
    const newEventTypes = after.events.filter(e => !before.events.some(old => old.id === e.id)).map(e => e.type)
    expect(newEventTypes.every(type => ['reservation_released', 'order_closed_remaining'].includes(type))).toBe(true)
    if (bInput) {
      const refreshed = await previewBatchShortageReconciliation(bInput)
      expect(refreshed).toMatchObject({ success: false, code: 'ORDER_TERMINAL' })
    }
  })

  it('Trigger B multi-order with a closed order rejects the whole plan, including other valid commitments', async () => {
    await closeOrderRemaining(await intent())
    await db.orders.put({ id: 'other', customerId: 'customer', variety: 'BV16', requestedQuantity: 10000, status: 'open' })
    const other = (await reserveOwnBatch({ orderId: 'other', batchId: 'batch', quantity: 10000 })).reservation
    await db.batches.update('batch', { readyQuantity: 1000 })
    const p = { sourceBatchId: 'batch', adjustments: [{ reservationId: other.id, newOutstanding: 5000 }, { reservationId: own.id, newOutstanding: 0 }] }
    const before = await snapshot()
    const preview = await previewBatchShortageReconciliation(p)
    expect(preview).toMatchObject({ success: false, code: 'ORDER_TERMINAL' })
    expect(await reconcileBatchShortage({ ...p, operationId: 'new-batch', expectedFingerprint: !preview.success ? preview.currentFingerprint! : '' }))
      .toMatchObject({ success: false, code: 'ORDER_TERMINAL' })
    expect(await snapshot()).toEqual(before)
  })

  it.each(['A', 'B'])('real FC3 %s ↔ FC5 operationId collisions are rejected in both directions', async trigger => {
    await clearAllData(); await base()
    const aPlan = { orderId: 'order', desiredRequestedQuantity: 45000, adjustments: [] }
    const bPlan = { sourceBatchId: 'batch', adjustments: [{ reservationId: own.id, newOutstanding: 18000 }] }
    if (trigger === 'A') {
      const p = await previewOrderReduction(aPlan)
      expect(p.success).toBe(true)
      if (!p.success) return
      expect(await reconcileOrderReduction({ ...aPlan, operationId: 'collision', expectedFingerprint: p.fingerprint })).toMatchObject({ success: true })
    } else {
      await db.batches.update('batch', { readyQuantity: 19000 })
      const p = await previewBatchShortageReconciliation(bPlan)
      expect(p.success).toBe(true)
      if (!p.success) return
      expect(await reconcileBatchShortage({ ...bPlan, operationId: 'collision', expectedFingerprint: p.fingerprint })).toMatchObject({ success: true })
      await db.batches.update('batch', { readyQuantity: 60000 })
    }
    await shipPartial()
    await expectNoWrite(await intent('collision'), 'OPERATION_ID_CONFLICT')
    await closeOrderRemaining(await intent('fc5'))
    const before = await snapshot()
    const result = trigger === 'A' ? await reconcileOrderReduction({ ...aPlan, operationId: 'fc5', expectedFingerprint: 'unused' }) :
      await reconcileBatchShortage({ ...bPlan, operationId: 'fc5', expectedFingerprint: 'unused' })
    expect(result).toMatchObject({ success: false, code: 'OPERATION_ID_CONFLICT' })
    expect(await snapshot()).toEqual(before)
  })

  it('captured old reservation Undo is rejected after real close, even if its banner intent is restored', async () => {
    await clearAllData(); await base()
    const old = undoService.getLastMutation()
    expect(old?.type).toBe('create_reservation')
    await shipPartial()
    await closeOrderRemaining(await intent())
    // Exercise the persisted guard, not clearLastMutation().
    if (old) undoService.recordMutation(old, 0)
    const before = await snapshot()
    expect((await undoService.undoLastMutation()).success).toBe(false)
    expect(await snapshot()).toEqual(before)
  })
})
