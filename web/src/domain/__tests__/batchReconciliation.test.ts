import { describe, expect, it } from 'vitest'
import { batchShortageFingerprint, batchShortageIntentKey, projectBatchShortage,
  type BatchShortagePlan, type BatchShortageState } from '../batchReconciliation'

function state(): BatchShortageState {
  return { sourceBatchId: 'A', contacts: [{ id: 'c', name: 'Khách', roles: ['customer'] }], historyIds: ['h2', 'h1'], shipments: [],
    batches: ['A', 'B'].map(id => ({ id, code: id, variety: 'BV16', initialQuantity: 50000, currentQuantity: 30000,
      readyQuantity: id === 'A' ? 15000 : 10000, status: 'ready', createdAt: '2026-10-08' })),
    orders: ['Lan', 'Hung'].map(id => ({ id, customerId: 'c', variety: 'BV16', requestedQuantity: 30000, status: 'partially_reserved', note: 'old' })),
    reservations: ['Lan', 'Hung'].map((orderId, i) => ({ id: `r${i}`, orderId, sourceType: 'own_batch', batchId: 'A',
      quantity: i ? 8000 : 10000, fulfilledQuantity: 0, status: 'active', createdAt: '2026-10-08' })) }
}
const plan = (newOutstanding = 7000, transfer = 0): BatchShortagePlan => ({ sourceBatchId: 'A',
  adjustments: [{ reservationId: 'r0', newOutstanding, ...(transfer ? { transfer: { targetBatchId: 'B', quantity: transfer } } : {}) }] })

describe('FC3-2 pure batch shortage projection', () => {
  it.each([9000, 7000, 5000, 0])('absolute reduction to %i preserves stock, demand and unselected source', newO => {
    const s = state()
    const before = structuredClone(s)
    const result = projectBatchShortage(s, plan(newO))
    expect(result).toMatchObject({ success: true, projection: { source: { shortageBefore: 3000,
      shortageAfter: Math.max(newO + 8000 - 15000, 0) }, orders: [{ before: { requestedQuantity: 30000 },
      after: { requestedQuantity: 30000, note: 'old', status: newO ? 'partially_reserved' : 'open' }, coverageAfter: newO }] } })
    expect(s).toEqual(before)
    if (!result.success) throw new Error(result.error)
    expect(result.projection.adjustments[0].after).toEqual({ ...s.reservations[0], quantity: newO || 10000,
      status: newO ? 'active' : 'released' })
    expect(result.projection.orders).toHaveLength(1)
    expect(result.projection.targetReservations).toHaveLength(0)
  })
  it.each([[7000, 3000, 0, 10000], [5000, 3000, 2000, 8000]])('transfer/release split (%i/%i)', (newO, t, released, covered) => {
    const result = projectBatchShortage(state(), plan(newO, t))
    expect(result).toMatchObject({ success: true, projection: { adjustments: [{ releasedQuantity: released, transferredQuantity: t }],
      targets: [{ incomingTransfer: t, availableBefore: 10000, availableAfter: 10000 - t, shortageAfter: 0 }],
      orders: [{ coverageAfter: covered }], targetReservations: [{ sourceReservationId: 'r0',
        reservation: { batchId: 'B', orderId: 'Lan', quantity: t, fulfilledQuantity: 0, status: 'active' } }] } })
  })
  it('multiple affected orders share one aggregate target capacity', () => {
    const s = state()
    s.batches[1].readyQuantity = 3000
    const p = plan(8000, 2000)
    p.adjustments.push({ reservationId: 'r1', newOutstanding: 6000, transfer: { targetBatchId: 'B', quantity: 2000 } })
    expect(projectBatchShortage(s, p)).toMatchObject({ success: false, code: 'TARGET_UNAVAILABLE',
      conflict: { availableQuantity: 3000, incomingQuantity: 4000 } })
    s.batches[1].readyQuantity = 4000
    expect(projectBatchShortage(s, p)).toMatchObject({ success: true, projection: { orders: [{ coverageAfter: 8000 }, { coverageAfter: 10000 }] } })
  })
  it.each([0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid transfer %s', quantity => {
    const p = plan(7000, 3000); p.adjustments[0].transfer!.quantity = quantity
    expect(projectBatchShortage(state(), p)).toMatchObject({ success: false, code: 'INVALID_INPUT' })
  })
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 10001])('rejects invalid remaining %s', n => {
    expect(projectBatchShortage(state(), plan(n))).toMatchObject({ success: false, code: 'INVALID_INPUT' })
  })
  it('normalizes variety and ignores target stored sellability status', () => {
    const s = state(); s.batches[1].variety = ' bv16 '; s.batches[1].status = 'depleted'
    expect(projectBatchShortage(s, plan(7000, 3000)).success).toBe(true)
  })
  it.each(['same', 'missing', 'variety', 'capacity', 'shortage', 'invalid-stock', 'excess-transfer', 'chain', 'external', 'released', 'fulfilled'])('rejects %s', mode => {
    const s = state(); const p = plan(7000, 3000)
    if (mode === 'same') p.adjustments[0].transfer!.targetBatchId = 'A'
    if (mode === 'missing') p.adjustments[0].transfer!.targetBatchId = 'missing'
    if (mode === 'variety') s.batches[1].variety = 'AH1'
    if (mode === 'capacity') s.batches[1].readyQuantity = 2000
    if (mode === 'shortage') s.reservations.push({ ...s.reservations[1], id: 'target', batchId: 'B', quantity: 11000 })
    if (mode === 'invalid-stock') s.batches[1].readyQuantity = 40000
    if (mode === 'excess-transfer') p.adjustments[0].transfer!.quantity = 3001
    if (mode === 'chain') { s.reservations[1].batchId = 'B'; p.adjustments.push({ reservationId: 'r1', newOutstanding: 0 }) }
    if (mode === 'external') { s.reservations[0].sourceType = 'external_supplier'; delete s.reservations[0].batchId; s.reservations[0].supplierId = 'supplier' }
    if (mode === 'released') s.reservations[0].status = 'released'
    if (mode === 'fulfilled') { s.reservations[0].status = 'fulfilled'; s.reservations[0].fulfilledQuantity = 10000 }
    expect(projectBatchShortage(s, p).success).toBe(false)
  })
  it('cannot net a release on full target or build A↔B', () => {
    const s = state(); s.reservations[1].batchId = 'B'; s.batches[1].readyQuantity = 8000
    const p = plan(7000, 3000); p.adjustments.push({ reservationId: 'r1', newOutstanding: 3000, transfer: { targetBatchId: 'A', quantity: 1000 } })
    expect(projectBatchShortage(s, p)).toMatchObject({ success: false, code: 'INVALID_SELECTION' })
  })
  it('strict canonical facts/intent bind confirmation independent of record/property/selection ordering', () => {
    const s = state(); const p = plan(7000, 3000)
    p.adjustments.push({ reservationId: 'r1', newOutstanding: 7000 })
    const reversed = structuredClone(s)
    reversed.orders.reverse(); reversed.reservations.reverse(); reversed.batches.reverse(); reversed.historyIds.reverse()
    const p2: BatchShortagePlan = { adjustments: [...p.adjustments].reverse(), sourceBatchId: 'A' }
    expect(batchShortageIntentKey(p2)).toBe(batchShortageIntentKey(p))
    expect(batchShortageFingerprint(reversed, p2)).toBe(batchShortageFingerprint(s, p))
    reversed.orders[0].note = 'changed'
    expect(batchShortageFingerprint(reversed, p)).not.toBe(batchShortageFingerprint(s, p))
    expect(batchShortageFingerprint(s, plan(6000, 3000))).not.toBe(batchShortageFingerprint(s, p))
  })
  it.each([{ adjustments: [] }, { adjustments: [{ reservationId: 'r0', newOutstanding: 10000 }] }])('no-op has no successful projection', ({ adjustments }) => {
    expect(projectBatchShortage(state(), { sourceBatchId: 'A', adjustments })).toMatchObject({ success: false, code: 'NO_OP' })
  })
  it('safe sum overflow in untouched batch commitment fails closed', () => {
    const s = state(); s.reservations[1].quantity = Number.MAX_SAFE_INTEGER
    expect(projectBatchShortage(s, plan())).toMatchObject({ success: false, code: 'INVALID_STATE' })
  })
})
