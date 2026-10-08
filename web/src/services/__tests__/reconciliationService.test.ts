import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/db'
import { clearAllData } from '../../data/seed'
import { availableQuantityForBatch } from '../../domain/quantity'
import { reservedQuantityForOrder } from '../../domain/order'
import type { OrderReductionPlan } from '../../domain/reconciliation'
import { exportWorkspaceBackup, restoreWorkspaceBackup } from '../../data/backup'
import { reserveOwnBatch, reserveExternalSupplier, releaseReservation } from '../reservationService'
import { createShipment, confirmShipment } from '../shipmentService'
import { updateOrder, cancelOrder } from '../orderService'
import { previewOrderReduction, reconcileOrderReduction, type ConfirmOrderReductionInput } from '../reconciliationService'
import { undoService } from '../undoService'

let ownId: string
let externalId: string

async function snapshot() {
  return { orders: await db.orders.toArray(), reservations: await db.reservations.toArray(),
    shipments: await db.shipments.toArray(), batches: await db.batches.toArray(), events: await db.events.toArray() }
}
function plan(own = 15000, external = 10000, requested = 25000): OrderReductionPlan {
  return { orderId: 'order', desiredRequestedQuantity: requested,
    adjustments: [{ reservationId: ownId, newOutstanding: own }, { reservationId: externalId, newOutstanding: external }] }
}
async function intent(proposal = plan(), operationId = 'operation'): Promise<ConfirmOrderReductionInput> {
  const preview = await previewOrderReduction(proposal)
  const expectedFingerprint = preview.success ? preview.fingerprint : preview.currentFingerprint
  expect(expectedFingerprint).toBeTypeOf('string')
  return { ...proposal, operationId, expectedFingerprint: expectedFingerprint! }
}
async function expectRejected(input: ConfirmOrderReductionInput, code: string) {
  const before = await snapshot()
  const result = await reconcileOrderReduction(input)
  expect(result).toMatchObject({ success: false, code })
  expect(await snapshot()).toEqual(before)
  return result
}

describe('FC3-1B atomic order reduction (real Dexie/service)', () => {
  beforeEach(async () => {
    undoService.clearLastMutation()
    await clearAllData()
    await db.contacts.bulkPut([{ id: 'customer', name: 'Khách', roles: ['customer'] },
      { id: 'supplier', name: 'Vườn ngoài', roles: ['supplier'] }])
    await db.batches.put({ id: 'batch', code: 'BV16 #12', variety: 'BV16', initialQuantity: 100000,
      currentQuantity: 80000, readyQuantity: 60000, status: 'ready', createdAt: '2026-10-08' })
    await db.orders.bulkPut([
      { id: 'order', customerId: 'customer', variety: 'BV16', requestedQuantity: 50000,
        status: 'open', requestedDate: '2026-10-20', unitPrice: 1200, note: 'old' },
      { id: 'other', customerId: 'customer', variety: 'BV16', requestedQuantity: 10000, status: 'open' }
    ])
    ownId = (await reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity: 20000 })).reservation.id
    externalId = (await reserveExternalSupplier({ orderId: 'order', supplierId: 'supplier', quantity: 12000 })).reservation.id
    await reserveOwnBatch({ orderId: 'other', batchId: 'batch', quantity: 5000 })
    await db.reservations.put({ id: 'old', orderId: 'order', sourceType: 'own_batch', batchId: 'batch',
      quantity: 3000, fulfilledQuantity: 0, status: 'released', createdAt: '2026-10-01' })
    undoService.clearLastMutation()
  })
  afterEach(() => { vi.restoreAllMocks(); undoService.clearLastMutation() })

  it.each([15000, 12000])('atomic 50k/32k→25k/%i+10k preserves metadata, unselected sources, shipments and stock', async own => {
    const before = await snapshot()
    const input = await intent(plan(own))
    expect(await snapshot()).toEqual(before) // Preview is read-only.
    const result = await reconcileOrderReduction(input)
    expect(result).toMatchObject({ success: true, idempotent: false, projection: {
      coverageBefore: 32000, coverageAfter: own + 10000, shortageAfter: 25000 - own - 10000,
      orderAfter: { requestedQuantity: 25000, requestedDate: '2026-10-20', unitPrice: 1200, note: 'old',
        status: own === 15000 ? 'reserved' : 'partially_reserved' }
    } })
    const after = await snapshot()
    expect(after.batches).toEqual(before.batches)
    expect(after.shipments).toEqual(before.shipments)
    expect(after.orders.find(o => o.id === 'other')).toEqual(before.orders.find(o => o.id === 'other'))
    for (const r of before.reservations.filter(r => ![ownId, externalId].includes(r.id))) {
      expect(after.reservations).toContainEqual(r)
    }
    expect((await db.reservations.get(ownId))?.quantity).toBe(own)
    expect((await db.reservations.get(externalId))?.quantity).toBe(10000)
    expect(reservedQuantityForOrder('order', after.reservations)).toBe(own + 10000)
    expect(availableQuantityForBatch(after.batches[0], after.reservations)).toBe(60000 - own - 5000)
    for (const event of before.events) expect(after.events).toContainEqual(event)
    expect(after.events.filter(e => e.type === 'order_reconciled')).toHaveLength(1)
    expect(after.events.find(e => e.type === 'order_reconciled')?.payload).toMatchObject({
      operationId: 'operation', trigger: 'order_reduction', selectedReservationIds: [ownId, externalId],
      projection: { orderBefore: { requestedQuantity: 50000 }, orderAfter: { requestedQuantity: 25000 },
        adjustments: [{ before: { quantity: 20000, fulfilledQuantity: 0 }, after: { quantity: own, status: 'active' },
          outstandingBefore: 20000, outstandingAfter: own }, { before: { supplierId: 'supplier' }, after: { quantity: 10000 } }] }
    })
    expect(after.events.filter(e => e.type === 'reservation_reconciled')).toHaveLength(1)
  })

  it('full release keeps Q positive, F0, records/history and derives open; backup remains valid', async () => {
    const before = await snapshot()
    expect(await reconcileOrderReduction(await intent(plan(0, 0)))).toMatchObject({
      success: true, projection: { coverageAfter: 0, shortageAfter: 25000, orderAfter: { status: 'open' } }
    })
    expect(await db.reservations.get(ownId)).toEqual({ ...before.reservations.find(r => r.id === ownId), status: 'released' })
    expect(await db.reservations.get(externalId)).toEqual({ ...before.reservations.find(r => r.id === externalId), status: 'released' })
    expect(await db.batches.toArray()).toEqual(before.batches)
    await expect(exportWorkspaceBackup()).resolves.toBeDefined()
  })

  it.each([10000, 0])('reduces/releases only existing external source to %i; own record and timeline are untouched', async newOutstanding => {
    const before = await snapshot()
    const proposal: OrderReductionPlan = { orderId: 'order', desiredRequestedQuantity: 35000,
      adjustments: [{ reservationId: externalId, newOutstanding }] }
    expect(await reconcileOrderReduction(await intent(proposal))).toMatchObject({ success: true })
    expect(await db.reservations.get(ownId)).toEqual(before.reservations.find(r => r.id === ownId))
    expect(await db.batches.toArray()).toEqual(before.batches)
    expect((await db.events.toArray()).filter(e => e.entityType === 'batch')).toEqual(before.events.filter(e => e.entityType === 'batch'))
  })

  it('insufficient reconciliation (28k>25k) returns remaining excess without any writes', async () => {
    const result = await expectRejected(await intent(plan(18000)), 'COVERAGE_EXCEEDS_REQUESTED')
    expect(result).toMatchObject({ conflict: { coveredQuantity: 28000, requestedQuantity: 25000, excessQuantity: 3000 } })
  })

  it('rejects a foreign or released reservation selected', async () => {
    const foreign = await db.reservations.where('orderId').equals('other').first()
    for (const reservationId of [foreign!.id, 'old', 'missing']) {
      const input = await intent({ ...plan(), adjustments: [{ reservationId, newOutstanding: 0 }] })
      await expectRejected(input, 'INVALID_SELECTION')
    }
  })

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 21000])('rejects O=%s atomically', async newOutstanding => {
    const input = await intent()
    input.adjustments = [{ reservationId: ownId, newOutstanding }]
    if (newOutstanding === 21000) Object.assign(input, await intent({ ...plan(), adjustments: input.adjustments }))
    await expectRejected(input, 'INVALID_INPUT')
  })

  it.each([-1, 0, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects requested=%s atomically', async desiredRequestedQuantity => {
    const input = await intent()
    await expectRejected({ ...input, desiredRequestedQuantity }, 'INVALID_INPUT')
  })

  it('rejects duplicate source selections and missing operationId/confirmation', async () => {
    const input = await intent()
    await expectRejected({ ...input, adjustments: [input.adjustments[0], input.adjustments[0]] }, 'INVALID_INPUT')
    await expectRejected({ ...input, operationId: ' ' }, 'INVALID_INPUT')
    await expectRejected({ ...input, expectedFingerprint: '' }, 'INVALID_INPUT')
    await expectRejected({ ...input, orderId: 'missing' }, 'NOT_FOUND')
  })

  it('O15k/P10k allows O12k, blocks O5k/release and keeps the actual plan executable', async () => {
    expect(await reconcileOrderReduction(await intent(plan(15000, 12000, 40000), 'prepare'))).toMatchObject({ success: true })
    const { shipment } = await createShipment({ orderId: 'order', lines: [{ reservationId: ownId, quantity: 10000 }] })
    const before = await snapshot()
    for (const own of [5000, 0]) {
      const result = await expectRejected(await intent(plan(own)), 'PLANNED_ALLOCATION_CONFLICT')
      expect(result).toMatchObject({ conflict: { reservationId: ownId, shipmentIds: [shipment.id], plannedQuantity: 10000, newOutstanding: own } })
    }
    expect(await reconcileOrderReduction(await intent(plan(12000)))).toMatchObject({ success: true })
    expect(await db.shipments.toArray()).toEqual(before.shipments)
    expect(await db.batches.toArray()).toEqual(before.batches)
    await confirmShipment({ shipmentId: shipment.id })
    expect((await db.reservations.get(ownId))?.fulfilledQuantity).toBe(10000)
  })

  it('sums allocations across all planned shipments and duplicate lines, rather than using the first', async () => {
    const { shipment } = await createShipment({ orderId: 'order', lines: [{ reservationId: ownId, quantity: 6000 }] })
    await db.shipments.put({ ...shipment, id: 'second-plan', plannedQuantity: 4000, lines: [
      { ...shipment.lines![0], quantity: 1000 }, { ...shipment.lines![0], quantity: 3000 }
    ] })
    const result = await expectRejected(await intent(plan(9000)), 'PLANNED_ALLOCATION_CONFLICT')
    expect(result).toMatchObject({ conflict: { plannedQuantity: 10000 } })
    if (!result.success) expect(result.conflict?.shipmentIds).toHaveLength(2)
  })

  it.each(['missing lines', 'empty lines', 'wrong total', 'unknown source'])('fails closed on legacy/corrupt planned allocation: %s', async corruption => {
    const { shipment } = await createShipment({ orderId: 'order', lines: [{ reservationId: ownId, quantity: 10000 }] })
    if (corruption === 'missing lines') await db.shipments.update(shipment.id, { lines: undefined })
    if (corruption === 'empty lines') await db.shipments.update(shipment.id, { lines: [] })
    if (corruption === 'wrong total') await db.shipments.update(shipment.id, { plannedQuantity: 9999 })
    if (corruption === 'unknown source') await db.shipments.update(shipment.id, { lines: [{ ...shipment.lines![0], reservationId: 'missing' }] })
    const result = await expectRejected(await intent(), 'UNVERIFIABLE_PLANNED_SHIPMENT')
    expect(result).toMatchObject({ conflict: { shipmentIds: [shipment.id] } })
  })

  it.each(['completed', 'fulfillment', 'fulfilled', 'partially_shipped', 'shipped', 'cancelled'] as const)('blocks Trigger A on current %s evidence', async evidence => {
    if (evidence === 'completed') {
      const { shipment } = await createShipment({ orderId: 'order', lines: [{ reservationId: ownId, quantity: 3000 }] })
      await confirmShipment({ shipmentId: shipment.id })
      await db.orders.update('order', { status: 'partially_reserved' }) // Stored status cannot conceal export.
    } else if (evidence === 'fulfillment') await db.reservations.update(ownId, { fulfilledQuantity: 1000 })
    else if (evidence === 'fulfilled') await db.reservations.update(ownId, { status: 'fulfilled', fulfilledQuantity: 20000 })
    else if (evidence === 'cancelled') await cancelOrder({ orderId: 'order' })
    else await db.orders.update('order', { status: evidence })
    await expectRejected(await intent(), evidence === 'cancelled' ? 'ORDER_CANCELLED' : 'ALREADY_SHIPPED')
  })

  it.each(['Q', 'F', 'status', 'source', 'batch reference', 'supplier reference', 'new source', 'release source',
    'new plan', 'plan line', 'completed shipment', 'requested', 'note', 'date', 'price', 'variety', 'cancelled',
    'ready', 'other batch commitment'])('rejects stale preview after %s and preserves the intervening state', async change => {
    let shipmentId: string | undefined
    if (change === 'plan line' || change === 'completed shipment') {
      shipmentId = (await createShipment({ orderId: 'order', lines: [{ reservationId: ownId, quantity: 10000 }] })).shipment.id
    }
    const input = await intent()
    if (change === 'Q') await db.reservations.update(ownId, { quantity: 19000 })
    if (change === 'F') await db.reservations.update(ownId, { fulfilledQuantity: 1000 })
    if (change === 'status') await db.reservations.update(ownId, { status: 'released' })
    if (change === 'source') await db.reservations.update(ownId, { sourceType: 'external_supplier', supplierId: 'supplier', batchId: undefined })
    if (change === 'batch reference') await db.reservations.update(ownId, { batchId: 'another-batch' })
    if (change === 'supplier reference') await db.reservations.update(externalId, { supplierId: 'another-supplier' })
    if (change === 'new source') await reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity: 1000 })
    if (change === 'release source') await releaseReservation({ reservationId: externalId })
    if (change === 'new plan') await createShipment({ orderId: 'order', lines: [{ reservationId: ownId, quantity: 10000 }] })
    if (change === 'plan line') {
      const ship = (await db.shipments.get(shipmentId!))!
      await db.shipments.update(ship.id, { plannedQuantity: 9000, lines: [{ ...ship.lines![0], quantity: 9000 }] })
    }
    if (change === 'completed shipment') await confirmShipment({ shipmentId: shipmentId! })
    if (change === 'requested') await updateOrder({ orderId: 'order', requestedQuantity: 60000 })
    if (change === 'note') await updateOrder({ orderId: 'order', note: 'morning' })
    if (change === 'date') await updateOrder({ orderId: 'order', requestedDate: '2026-11-01' })
    if (change === 'price') await updateOrder({ orderId: 'order', unitPrice: 1300 })
    if (change === 'variety') await db.orders.update('order', { variety: 'AH1' })
    if (change === 'cancelled') await cancelOrder({ orderId: 'order' })
    if (change === 'ready') await db.batches.update('batch', { readyQuantity: 40000 })
    if (change === 'other batch commitment') await reserveOwnBatch({ orderId: 'other', batchId: 'batch', quantity: 1000 })
    const result = await expectRejected(input, 'PREVIEW_CHANGED')
    expect(result).toMatchObject({ current: { order: { id: 'order' } } })
    if (!result.success) expect(result.currentFingerprint).not.toBe(input.expectedFingerprint)
  })

  it('does not write incidental date/price/note snapshots supplied outside the API shape', async () => {
    const input = { ...await intent(), note: 'stale', requestedDate: '2026-12-01', unitPrice: 10 }
    expect(await reconcileOrderReduction(input)).toMatchObject({ success: true })
    expect(await db.orders.get('order')).toMatchObject({ note: 'old', requestedDate: '2026-10-20', unitPrice: 1200 })
  })

  it('requires another preview when the absolute intent changes, even if persisted facts are unchanged', async () => {
    const input = await intent()
    await expectRejected({ ...input, adjustments: [{ reservationId: ownId, newOutstanding: 12000 }, input.adjustments[1]] }, 'PREVIEW_CHANGED')
    await expectRejected({ ...input, desiredRequestedQuantity: 24000 }, 'PREVIEW_CHANGED')
  })

  it('copies preview and commit intent before awaiting database reads', async () => {
    const proposal = plan()
    const previewPromise = previewOrderReduction(proposal)
    proposal.adjustments[0].newOutstanding = 12000
    const preview = await previewPromise
    expect(preview).toMatchObject({ success: true, projection: { coverageAfter: 25000 } })
    if (!preview.success) throw new Error(preview.error)
    const input = { ...plan(), operationId: 'copied', expectedFingerprint: preview.fingerprint }
    const commitPromise = reconcileOrderReduction(input)
    input.adjustments[0].newOutstanding = 0
    input.desiredRequestedQuantity = 1
    expect(await commitPromise).toMatchObject({ success: true, projection: { coverageAfter: 25000 } })
    expect((await db.reservations.get(ownId))?.quantity).toBe(15000)
  })

  it('same operationId + canonical same intent retries once; different intent/order conflicts', async () => {
    const input = await intent()
    const first = await reconcileOrderReduction(input)
    const committed = await snapshot()
    const retry = await reconcileOrderReduction({ ...input, adjustments: [...input.adjustments].reverse()
      .map(a => ({ newOutstanding: a.newOutstanding, reservationId: a.reservationId })), expectedFingerprint: 'new-token' })
    expect(retry).toMatchObject({ success: true, idempotent: true })
    if (first.success && retry.success) expect(retry.projection).toEqual(first.projection)
    expect(await snapshot()).toEqual(committed)
    await expectRejected({ ...input, desiredRequestedQuantity: 24000 }, 'OPERATION_ID_CONFLICT')
    await expectRejected({ ...input, orderId: 'other' }, 'OPERATION_ID_CONFLICT')
  })

  it('fails closed on an incomplete committed marker instead of falsely succeeding or applying it twice', async () => {
    const input = await intent()
    expect((await reconcileOrderReduction(input)).success).toBe(true)
    const marker = (await db.events.where('type').equals('order_reconciled').first())!
    const payload = marker.payload as Record<string, unknown>
    const projection = payload.projection as Record<string, unknown>
    await db.events.update(marker.id, { payload: { ...payload, projection: { ...projection, coverageAfter: undefined } } })
    await expectRejected(input, 'INVALID_STATE')
  })

  it('rollback includes source/order writes and marker event; same-ID retry succeeds once', async () => {
    const input = await intent()
    const before = await snapshot()
    const originalPut = db.events.put.bind(db.events)
    const put = vi.spyOn(db.events, 'put').mockImplementation(event => {
      if (event.type === 'reservation_reconciled') throw new Error('batch event failure')
      return originalPut(event)
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await reconcileOrderReduction(input)).toMatchObject({ success: false, code: 'STORAGE_ERROR' })
    expect(await snapshot()).toEqual(before)
    put.mockRestore()
    expect(await reconcileOrderReduction(input)).toMatchObject({ success: true, idempotent: false })
    expect(await reconcileOrderReduction(input)).toMatchObject({ success: true, idempotent: true })
    expect(await db.events.where('type').equals('order_reconciled').count()).toBe(1)
  })

  it('duplicate concurrent submit serializes to one marker and one source change', async () => {
    const input = await intent()
    const before = await db.batches.toArray()
    const results = await Promise.all([reconcileOrderReduction(input), reconcileOrderReduction(input)])
    expect(results.map(r => r.success && r.idempotent)).toEqual([false, true])
    expect(await db.events.where('type').equals('order_reconciled').count()).toBe(1)
    expect(await db.events.where('type').equals('reservation_reconciled').count()).toBe(1)
    expect((await db.reservations.get(ownId))?.quantity).toBe(15000)
    expect(await db.batches.toArray()).toEqual(before)
  })

  it('confirm wins race: reconciliation sees the new export and does not touch stock/history', async () => {
    const { shipment } = await createShipment({ orderId: 'order', lines: [{ reservationId: ownId, quantity: 10000 }] })
    const input = await intent()
    const [confirm, reduction] = await Promise.all([confirmShipment({ shipmentId: shipment.id }), reconcileOrderReduction(input)])
    expect(confirm.success).toBe(true)
    expect(reduction).toMatchObject({ success: false, code: 'PREVIEW_CHANGED' })
    expect((await db.orders.get('order'))?.requestedQuantity).toBe(50000)
    expect(await db.reservations.get(ownId)).toMatchObject({ quantity: 20000, fulfilledQuantity: 10000, status: 'active' })
    expect((await db.batches.get('batch'))?.currentQuantity).toBe(70000)
    expect((await db.batches.get('batch'))?.readyQuantity).toBe(50000)
    expect(await db.events.where('type').equals('order_reconciled').count()).toBe(0)
  })

  it('reconciliation wins race: unchanged planned lines can still confirm using post-state', async () => {
    const { shipment } = await createShipment({ orderId: 'order', lines: [{ reservationId: ownId, quantity: 10000 }] })
    const input = await intent()
    const [reduction, confirm] = await Promise.all([reconcileOrderReduction(input), confirmShipment({ shipmentId: shipment.id })])
    expect(reduction.success).toBe(true)
    expect(confirm.success).toBe(true)
    expect(await db.orders.get('order')).toMatchObject({ requestedQuantity: 25000, status: 'partially_shipped' })
    expect(await db.reservations.get(ownId)).toMatchObject({ quantity: 15000, fulfilledQuantity: 10000 })
    expect((await db.shipments.get(shipment.id))?.lines).toEqual(shipment.lines)
    expect((await db.batches.get('batch'))?.currentQuantity).toBe(70000)
  })

  it('cancel wins race: reconciliation does not resurrect or change cancelled demand/sources', async () => {
    const input = await intent()
    const before = await db.batches.toArray()
    const [cancel, reduction] = await Promise.all([cancelOrder({ orderId: 'order' }), reconcileOrderReduction(input)])
    expect(cancel.success).toBe(true)
    expect(reduction).toMatchObject({ success: false, code: 'PREVIEW_CHANGED' })
    expect(await db.orders.get('order')).toMatchObject({ status: 'cancelled', requestedQuantity: 50000 })
    expect((await db.reservations.get(ownId))?.status).toBe('released')
    expect(await db.batches.toArray()).toEqual(before)
    expect(await db.events.where('type').equals('order_reconciled').count()).toBe(0)
  })

  it('reconciliation wins race then cancellation preserves reduced quantities; retry returns original result without undoing cancel', async () => {
    const input = await intent()
    const before = await db.batches.toArray()
    const [reduction, cancel] = await Promise.all([reconcileOrderReduction(input), cancelOrder({ orderId: 'order' })])
    expect(reduction.success).toBe(true)
    expect(cancel.success).toBe(true)
    const cancelled = await snapshot()
    expect(await db.orders.get('order')).toMatchObject({ status: 'cancelled', requestedQuantity: 25000 })
    expect(await db.reservations.get(ownId)).toMatchObject({ quantity: 15000, status: 'released' })
    expect(await reconcileOrderReduction(input)).toMatchObject({ success: true, idempotent: true })
    expect(await snapshot()).toEqual(cancelled)
    expect(await db.batches.toArray()).toEqual(before)
  })

  it('real reconciliation with remaining batch shortage round-trips history and operation marker', async () => {
    await db.batches.update('batch', { readyQuantity: 13000 })
    const input = await intent(plan(10000, 10000))
    const result = await reconcileOrderReduction(input)
    expect(result).toMatchObject({ success: true, projection: { shortageAfter: 5000,
      batchEffects: [{ shortageBefore: 12000, shortageAfter: 2000 }] } })
    const exported = await exportWorkspaceBackup()
    await restoreWorkspaceBackup(exported.jsonString)
    db.close()
    await db.open()
    expect((await exportWorkspaceBackup()).backup.data).toEqual(exported.backup.data)
    const restored = await snapshot()
    expect(await reconcileOrderReduction(input)).toMatchObject({ success: true, idempotent: true })
    expect(await snapshot()).toEqual(restored)
    expect((await db.batches.get('batch'))?.readyQuantity).toBe(13000)
  })

  it('NO_OP creates no marker; old create-order Undo is blocked after a source-free real correction', async () => {
    await expectRejected(await intent({ orderId: 'order', desiredRequestedQuantity: 50000, adjustments: [] }), 'NO_OP')
    await db.reservations.where('orderId').equals('order').delete()
    await db.orders.update('order', { status: 'open' })
    const oldUndo = { type: 'create_order' as const, orderId: 'order', customerName: 'Khách', description: 'old' }
    expect(await reconcileOrderReduction(await intent({ orderId: 'order', desiredRequestedQuantity: 25000, adjustments: [] })))
      .toMatchObject({ success: true, projection: { orderAfter: { status: 'open' } } })
    undoService.recordMutation(oldUndo, 0)
    const after = await snapshot()
    expect((await undoService.undoLastMutation()).success).toBe(false)
    expect(await snapshot()).toEqual(after)
  })
})
