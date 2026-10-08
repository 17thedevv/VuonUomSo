import { describe, it, expect } from 'vitest'
import type { Order } from '../order'
import type { Reservation } from '../reservation'
import type { Shipment } from '../shipment'
import { validateOrderChanges, validateOrderCancellation, orderCancellationFingerprint } from '../orderLifecycle'

const order: Order = { id: 'o1', customerId: 'c1', variety: 'BV16', requestedQuantity: 50000, status: 'partially_reserved' }
const reservation: Reservation = { id: 'r1', orderId: 'o1', sourceType: 'own_batch', batchId: 'b1', quantity: 32000, status: 'active', createdAt: '2026-10-08' }

describe('FC2 order correction rules', () => {
  it('allows increasing demand and decreasing to exactly the covered amount', () => {
    expect(validateOrderChanges(order, { requestedQuantity: 60000 }, [reservation], []))
      .toMatchObject({ success: true, order: { requestedQuantity: 60000, status: 'partially_reserved' } })
    expect(validateOrderChanges(order, { requestedQuantity: 32000 }, [reservation], []))
      .toMatchObject({ success: true, order: { requestedQuantity: 32000, status: 'reserved' } })
  })

  it('returns actionable reconciliation quantities without mutating the inputs', () => {
    const result = validateOrderChanges(order, { requestedQuantity: 30000 }, [reservation], [])
    expect(result).toMatchObject({ success: false, code: 'RECONCILIATION_REQUIRED', conflict: {
      requestedQuantity: 30000, coveredQuantity: 32000, excessQuantity: 2000
    } })
    expect(order.requestedQuantity).toBe(50000)
    expect(reservation.status).toBe('active')
  })

  it('counts own and external commitments, ignores other orders and released unshipped history', () => {
    const reservations: Reservation[] = [
      { ...reservation, quantity: 20000 },
      { ...reservation, id: 'external', sourceType: 'external_supplier', quantity: 12000 },
      { ...reservation, id: 'released', status: 'released', quantity: 18000 },
      { ...reservation, id: 'other', orderId: 'o2', quantity: 50000 }
    ]
    expect(validateOrderChanges(order, { requestedQuantity: 32000 }, reservations, [])).toMatchObject({ success: true })
  })

  it('locks variety after released history but allows unrelated order reservations', () => {
    expect(validateOrderChanges(order, { variety: 'AH1' }, [{ ...reservation, status: 'released' }], []))
      .toMatchObject({ success: false, code: 'VARIETY_LOCKED' })
    expect(validateOrderChanges(order, { variety: ' AH1 ' }, [{ ...reservation, orderId: 'o2' }], []))
      .toMatchObject({ success: true, order: { variety: 'AH1', status: 'open' } })
  })

  it.each([0, -1, 3.2, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects unsafe requested quantity %s', (quantity) => {
    expect(validateOrderChanges(order, { requestedQuantity: quantity }, [], []))
      .toMatchObject({ success: false, code: 'INVALID_INPUT' })
  })

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid unit price %s', (price) => {
    expect(validateOrderChanges(order, { unitPrice: price }, [], []))
      .toMatchObject({ success: false, code: 'INVALID_INPUT' })
  })

  it.each(['2026-02-29', '2026-02-30', '2026-13-01', 'bad-date', '2026-1-1'])('rejects invalid requested date %s', (date) => {
    expect(validateOrderChanges(order, { requestedDate: date }, [], []))
      .toMatchObject({ success: false, code: 'INVALID_INPUT' })
  })

  it('accepts zero price, leap-day, trims note and explicitly clears optional fields', () => {
    expect(validateOrderChanges(order, { unitPrice: 0, requestedDate: '2028-02-29', note: ' hẹn gọi ' }, [], []))
      .toMatchObject({ success: true, order: { unitPrice: 0, requestedDate: '2028-02-29', note: 'hẹn gọi' } })
    expect(validateOrderChanges(order, { unitPrice: null, requestedDate: null, note: null }, [], []))
      .toMatchObject({ success: true, order: { unitPrice: undefined, requestedDate: undefined, note: undefined } })
  })

  it('blocks edits and whole cancellation if any completed shipment exists, even with stale status', () => {
    const shipment: Shipment = { id: 's1', orderId: order.id, status: 'completed', plannedQuantity: 10000, shippedQuantity: 10000 }
    expect(validateOrderChanges(order, { note: 'changed' }, [], [shipment])).toMatchObject({ success: false, code: 'ALREADY_SHIPPED' })
    expect(validateOrderCancellation(order, [], [shipment])).toMatchObject({ success: false, code: 'ALREADY_SHIPPED' })
  })

  it.each(['active', 'released', 'fulfilled'] as const)('protects %s reservation fulfillment history even without shipment data', (status) => {
    expect(validateOrderCancellation(order, [{ ...reservation, status, fulfilledQuantity: 10000 }], []))
      .toMatchObject({ success: false, code: 'ALREADY_SHIPPED' })
  })

  it('rejects editing cancelled orders and permits cancellation before shipment', () => {
    expect(validateOrderChanges({ ...order, status: 'cancelled' }, { note: 'changed' }, [], []))
      .toMatchObject({ success: false, code: 'ORDER_CANCELLED' })
    expect(validateOrderCancellation(order, [reservation], [])).toEqual({ success: true })
  })

  it('compares cancellation effects independent of read order and ignores released/unrelated records', () => {
    const external: Reservation = { ...reservation, id: 'r2', sourceType: 'external_supplier', supplierId: 's1', quantity: 10000 }
    const fingerprint = orderCancellationFingerprint(order, [reservation, external], [])
    expect(orderCancellationFingerprint(order, [external, reservation, { ...reservation, id: 'old', status: 'released' }, { ...reservation, id: 'other', orderId: 'other' }], [])).toBe(fingerprint)
    expect(orderCancellationFingerprint(order, [reservation, { ...external, quantity: 12000 }], [])).not.toBe(fingerprint)
  })

  it('detects planned shipment changes before approving cancellation', () => {
    const plan: Shipment = { id: 's1', orderId: order.id, plannedQuantity: 10000, shippedQuantity: 0, status: 'planned', plannedDate: '2026-10-20' }
    const fingerprint = orderCancellationFingerprint(order, [reservation], [plan])
    expect(orderCancellationFingerprint(order, [reservation], [{ ...plan, plannedQuantity: 12000 }])).not.toBe(fingerprint)
    expect(orderCancellationFingerprint(order, [reservation], [{ ...plan, plannedDate: '2026-10-21' }])).not.toBe(fingerprint)
  })
})
