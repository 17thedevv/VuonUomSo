import { describe, expect, it } from 'vitest'
import { isTerminalOrder, deriveOrderDisplayStatus, orderShortage, filterOrders, reservedQuantityForOrder, type Order } from '../order'
import { actionableRemainingToShipForOrder, remainingToShipForOrder } from '../shipment'
import { projectCloseRemaining, validCloseRemainingProjection, type CloseRemainingState } from '../orderCompletion'
import type { Reservation } from '../reservation'

function fixture(): CloseRemainingState {
  const order: Order = { id: 'order', customerId: 'customer', variety: 'BV16', requestedQuantity: 50000, status: 'partially_shipped' }
  const reservation: Reservation = { id: 'source', orderId: order.id, sourceType: 'own_batch', batchId: 'batch',
    quantity: 12000, fulfilledQuantity: 5000, status: 'active', createdAt: '2026-10-09' }
  return { order, reservations: [reservation], batches: [{ id: 'batch', code: 'BV16 #1', variety: 'BV16', initialQuantity: 50000,
    currentQuantity: 40000, readyQuantity: 3000, status: 'ready', createdAt: '2026-10-09' }],
    contacts: [{ id: 'customer', name: 'Khách', roles: ['customer'] }], historyIds: [],
    shipments: [{ id: 'done', orderId: 'order', status: 'completed', plannedQuantity: 5000, shippedQuantity: 5000,
      lines: [{ reservationId: 'source', sourceType: 'own_batch', batchId: 'batch', quantity: 5000 }] }] }
}
describe('FC5 pure terminal projection and quantities', () => {
  it.each(['own_batch', 'external_supplier'] as const)('Q12/F5/O7 %s keeps Q/F; stopped45 is not released7', sourceType => {
    const state = fixture()
    if (sourceType === 'external_supplier') {
      state.reservations[0] = { ...state.reservations[0], sourceType, batchId: undefined, supplierId: 'supplier' }
      state.shipments[0].lines![0] = { ...state.shipments[0].lines![0], sourceType, batchId: undefined, supplierId: 'supplier' }
      state.contacts.push({ id: 'supplier', name: 'Ngoài', roles: ['supplier'] })
    }
    const before = structuredClone(state)
    const result = projectCloseRemaining(state)
    expect(result).toMatchObject({ success: true, projection: { stoppedQuantity: 45000, releasedOutstanding: 7000,
      coverageAfter: 5000, releases: [{ before: { quantity: 12000, fulfilledQuantity: 5000 }, after: { quantity: 12000, fulfilledQuantity: 5000, status: 'released' } }] } })
    expect(state).toEqual(before)
    if (result.success) {
      expect(validCloseRemainingProjection(JSON.parse(JSON.stringify(result.projection)), 'order')).toBe(true)
      if (sourceType === 'own_batch') expect(result.projection.batchEffects[0]).toMatchObject({ availableBefore: 0, availableAfter: 3000, shortageBefore: 4000, shortageAfter: 0 })
      else expect(result.projection.batchEffects).toEqual([])
    }
  })
  it('fulfilled and previously released sources preserve history and are not released again', () => {
    const state = fixture()
    state.reservations[0] = { ...state.reservations[0], quantity: 5000, status: 'fulfilled' }
    state.reservations.push({ ...state.reservations[0], id: 'old', quantity: 10000, fulfilledQuantity: 0, status: 'released' })
    const result = projectCloseRemaining(state)
    expect(result).toMatchObject({ success: true, projection: { releases: [], releasedOutstanding: 0, coverageAfter: 5000 } })
    if (result.success) expect(result.projection.sources.every(s => JSON.stringify(s.before) === JSON.stringify(s.after))).toBe(true)
  })
  it('historical remaining45 survives closure while actionable remaining and operational shortage become zero', () => {
    const state = fixture()
    const result = projectCloseRemaining(state)
    expect(result.success).toBe(true)
    if (!result.success) return
    const order = result.projection.orderAfter
    const rs = result.projection.sources.map(s => s.after)
    expect(isTerminalOrder(order)).toBe(true)
    expect(reservedQuantityForOrder(order.id, rs)).toBe(5000)
    expect(orderShortage(order, rs)).toBe(0)
    expect(remainingToShipForOrder(order.requestedQuantity, order.id, state.shipments)).toBe(45000)
    expect(actionableRemainingToShipForOrder(order, state.shipments)).toBe(0)
    const displayStatus = deriveOrderDisplayStatus(order, rs, state.shipments)
    expect(displayStatus).toMatchObject({ kind: 'closed_remaining', shortage: 0, label: 'Đã xuất 5.000 / 50.000 · Đã dừng 45.000 còn lại' })
    const rows = [{ ...order, customerName: 'Khách', reservedQuantity: 5000, shortage: 0, displayStatus }]
    expect(filterOrders(rows, 'all')).toEqual(rows)
    for (const filter of ['ready_pickup', 'action_needed', 'shipped'] as const) expect(filterOrders(rows, filter)).toEqual([])
  })
  it('exact S=R alone is full completion; >R and stale terminal status fail informationally closed', () => {
    const state = fixture()
    state.order.requestedQuantity = 5000
    expect(deriveOrderDisplayStatus(state.order, state.reservations, state.shipments)).toMatchObject({ kind: 'shipped', label: 'Đã xuất đủ' })
    state.order.requestedQuantity = 4000
    expect(deriveOrderDisplayStatus(state.order, state.reservations, state.shipments).kind).toBe('invalid')
    state.order.status = 'shipped'
    state.order.requestedQuantity = 50000
    expect(deriveOrderDisplayStatus(state.order, state.reservations, state.shipments).kind).toBe('invalid')
  })
  it('S=R on a nonterminal stored order cannot close or normalize it', () => {
    const state = fixture()
    state.order.requestedQuantity = 5000
    state.reservations[0] = { ...state.reservations[0], quantity: 5000, status: 'fulfilled' }
    expect(projectCloseRemaining(state)).toMatchObject({ success: false, code: 'NOT_PARTIALLY_SHIPPED' })
    expect(state.order.status).toBe('partially_shipped')
  })
})
