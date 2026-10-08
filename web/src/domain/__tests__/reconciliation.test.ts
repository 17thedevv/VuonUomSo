import { describe, expect, it } from 'vitest'
import type { Reservation } from '../reservation'
import { orderReductionFingerprint, orderReductionIntentKey, projectOrderReduction, reduceReservationOutstanding,
  type OrderReductionState, type OrderReductionPlan } from '../reconciliation'

function state(): OrderReductionState {
  return {
    order: { id: 'order', customerId: 'customer', variety: 'BV16', requestedQuantity: 50000,
      status: 'partially_reserved', requestedDate: '2026-10-20', unitPrice: 1200, note: 'old' },
    reservations: [
      { id: 'own', orderId: 'order', sourceType: 'own_batch', batchId: 'batch', quantity: 20000, fulfilledQuantity: 0, status: 'active', createdAt: '2026-10-08' },
      { id: 'external', orderId: 'order', sourceType: 'external_supplier', supplierId: 'supplier', quantity: 12000, fulfilledQuantity: 0, status: 'active', createdAt: '2026-10-08' },
      { id: 'other', orderId: 'another', sourceType: 'own_batch', batchId: 'batch', quantity: 5000, fulfilledQuantity: 0, status: 'active', createdAt: '2026-10-08' }
    ], shipments: [], historyIds: ['creation'],
    batches: [{ id: 'batch', code: 'B1', variety: 'BV16', initialQuantity: 100000,
      currentQuantity: 80000, readyQuantity: 60000, status: 'ready', createdAt: '2026-10-08' }],
    contacts: [{ id: 'customer', name: 'Khách', roles: ['customer'] }, { id: 'supplier', name: 'Vườn ngoài', roles: ['supplier'] }]
  }
}
const plan: OrderReductionPlan = { orderId: 'order', desiredRequestedQuantity: 25000,
  adjustments: [{ reservationId: 'own', newOutstanding: 15000 }, { reservationId: 'external', newOutstanding: 10000 }] }

describe('FC3-1B pure representation/projection/fingerprint', () => {
  it('projects exact coverage without mutating any input and includes physical/source shortage facts', () => {
    const current = state()
    const before = structuredClone(current)
    const result = projectOrderReduction(current, plan)
    expect(result).toMatchObject({ success: true, projection: {
      orderAfter: { requestedQuantity: 25000, status: 'reserved', note: 'old' },
      coverageBefore: 32000, coverageAfter: 25000, shortageBefore: 18000, shortageAfter: 0,
      batchEffects: [{ livingQuantity: 80000, readyQuantity: 60000, outstandingBefore: 25000,
        outstandingAfter: 20000, availableBefore: 35000, availableAfter: 40000 }]
    } })
    expect(current).toEqual(before)
  })

  it('permits intentional order shortage and derives partially_reserved', () => {
    expect(projectOrderReduction(state(), { ...plan, adjustments: [
      { reservationId: 'own', newOutstanding: 12000 }, { reservationId: 'external', newOutstanding: 10000 }
    ] })).toMatchObject({ success: true, projection: { coverageAfter: 22000, shortageAfter: 3000, orderAfter: { status: 'partially_reserved' } } })
  })

  it.each([0, 8000])('full release preserves positive Q and F=%i; never fakes fulfillment', f => {
    const reservation: Reservation = { ...state().reservations[0], fulfilledQuantity: f }
    expect(reduceReservationOutstanding(reservation, 0)).toEqual({ success: true, reservation: { ...reservation, status: 'released' } })
  })

  it('partial Q20k/F8k/O12k→O7k yields Q15k/F8k active while service guard stays before shipment', () => {
    const current = state()
    current.reservations[0].fulfilledQuantity = 8000
    expect(reduceReservationOutstanding(current.reservations[0], 7000)).toMatchObject({
      success: true, reservation: { quantity: 15000, fulfilledQuantity: 8000, status: 'active' }
    })
    expect(projectOrderReduction(current, plan)).toMatchObject({ success: false, code: 'ALREADY_SHIPPED' })
  })

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid O=%s', newOutstanding => {
    expect(reduceReservationOutstanding(state().reservations[0], newOutstanding)).toMatchObject({ success: false, code: 'INVALID_INPUT' })
  })

  it.each([-1, 0, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid requested=%s', desiredRequestedQuantity => {
    expect(projectOrderReduction(state(), { ...plan, desiredRequestedQuantity })).toMatchObject({ success: false, code: 'INVALID_INPUT' })
  })

  it('rejects unsafe intermediate order coverage even with individually safe Q', () => {
    const current = state()
    current.order.requestedQuantity = Number.MAX_SAFE_INTEGER
    current.reservations[0].quantity = Number.MAX_SAFE_INTEGER
    expect(projectOrderReduction(current, plan)).toMatchObject({ success: false, code: 'INVALID_STATE' })
  })

  it('rejects unsafe batch commitments on other orders before computing stock effects', () => {
    const current = state()
    current.reservations[2].quantity = Number.MAX_SAFE_INTEGER
    expect(projectOrderReduction(current, plan)).toMatchObject({ success: false, code: 'INVALID_STATE' })
  })

  it('fingerprint and intent key are canonical across record/selection ordering', () => {
    const current = state()
    const reversed = { ...current, reservations: [...current.reservations].reverse(), contacts: [...current.contacts].reverse() }
    expect(orderReductionFingerprint(reversed, plan)).toBe(orderReductionFingerprint(current, plan))
    expect(orderReductionIntentKey({ ...plan, adjustments: [...plan.adjustments].reverse() })).toBe(orderReductionIntentKey(plan))
    const reorderedFields = { ...plan, adjustments: plan.adjustments.map(a =>
      ({ newOutstanding: a.newOutstanding, reservationId: a.reservationId })) }
    expect(orderReductionIntentKey(reorderedFields)).toBe(orderReductionIntentKey(plan))
    expect(orderReductionFingerprint(current, reorderedFields)).toBe(orderReductionFingerprint(current, plan))
  })

  it('NO_OP is explicit; increasing demand or reducing only sources is outside Trigger A', () => {
    expect(projectOrderReduction(state(), { orderId: 'order', desiredRequestedQuantity: 50000, adjustments: [] }))
      .toMatchObject({ success: false, code: 'NO_OP' })
    for (const desiredRequestedQuantity of [50000, 60000]) {
      expect(projectOrderReduction(state(), { ...plan, desiredRequestedQuantity })).toMatchObject({ success: false, code: 'INVALID_INPUT' })
    }
  })
})
