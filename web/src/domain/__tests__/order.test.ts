import { describe, it, expect } from 'vitest'
import type { Order } from '../order'
import type { Reservation } from '../reservation'
import type { Shipment } from '../shipment'
import {
  reservedQuantityForOrder,
  orderShortage,
  deriveOrderDisplayStatus,
  filterOrders,
  type OrderWithDerived
} from '../order'

describe('Domain: Order calculations & filters', () => {
  const createMockOrder = (overrides: Partial<Order>): Order => ({
    id: 'ord_1',
    customerId: 'cust_1',
    variety: 'Keo lai BV16',
    requestedQuantity: 20000,
    requestedDate: '2026-10-15',
    unitPrice: 1200,
    status: 'partially_reserved',
    ...overrides
  })

  describe('reservedQuantityForOrder', () => {
    it('sums active reservations for the given order only', () => {
      const reservations: Reservation[] = [
        {
          id: 'res_1',
          orderId: 'ord_1',
          sourceType: 'own_batch',
          batchId: 'b_1',
          quantity: 8000,
          status: 'active',
          createdAt: '2026-10-01'
        },
        {
          id: 'res_2',
          orderId: 'ord_1',
          sourceType: 'external_supplier',
          supplierId: 'sup_1',
          quantity: 4000,
          status: 'active',
          createdAt: '2026-10-01'
        },
        {
          id: 'res_3',
          orderId: 'ord_1',
          sourceType: 'own_batch',
          batchId: 'b_2',
          quantity: 5000,
          status: 'released', // released should NOT be counted
          createdAt: '2026-10-01'
        },
        {
          id: 'res_4',
          orderId: 'other_ord',
          sourceType: 'own_batch',
          batchId: 'b_1',
          quantity: 9000,
          status: 'active', // different order
          createdAt: '2026-10-01'
        }
      ]

      expect(reservedQuantityForOrder('ord_1', reservations)).toBe(12000)
    })
  })

  describe('orderShortage', () => {
    it('calculates shortage accurately', () => {
      const order = createMockOrder({ requestedQuantity: 30000, status: 'partially_reserved' })
      const reservations: Reservation[] = [
        {
          id: 'res_1',
          orderId: order.id,
          sourceType: 'own_batch',
          quantity: 12000,
          status: 'active',
          createdAt: '2026-10-01'
        }
      ]

      // Shortage = 30000 - 12000 = 18000
      expect(orderShortage(order, reservations)).toBe(18000)
    })

    it('returns 0 when fully reserved or over-reserved', () => {
      const order = createMockOrder({ requestedQuantity: 20000 })
      const reservations: Reservation[] = [
        {
          id: 'res_1',
          orderId: order.id,
          sourceType: 'own_batch',
          quantity: 25000,
          status: 'active',
          createdAt: '2026-10-01'
        }
      ]

      expect(orderShortage(order, reservations)).toBe(0)
    })

    it('returns 0 for shipped or cancelled orders', () => {
      const shippedOrder = createMockOrder({ status: 'shipped', requestedQuantity: 20000 })
      expect(orderShortage(shippedOrder, [])).toBe(0)

      const cancelledOrder = createMockOrder({ status: 'cancelled', requestedQuantity: 20000 })
      expect(orderShortage(cancelledOrder, [])).toBe(0)
    })
  })

  describe('deriveOrderDisplayStatus', () => {
    it('does not fabricate shipped status without completed evidence', () => {
      const order = createMockOrder({ status: 'shipped', requestedQuantity: 10000 })
      const result = deriveOrderDisplayStatus(order, [], [])
      expect(result.kind).toBe('invalid')
      expect(result.label).toBe('Dữ liệu xuất cần kiểm tra')
    })

    it('detects shipped status when shipments cover full requested quantity', () => {
      const order = createMockOrder({ status: 'partially_reserved', requestedQuantity: 10000 })
      const shipments: Shipment[] = [
        {
          id: 'ship_1',
          orderId: order.id,
          plannedQuantity: 10000,
          shippedQuantity: 10000,
          status: 'completed',
          shippedAt: '2026-10-01'
        }
      ]
      const result = deriveOrderDisplayStatus(order, [], shipments)
      expect(result.kind).toBe('shipped')
    })

    it('detects full reservation', () => {
      const order = createMockOrder({ requestedQuantity: 10000 })
      const reservations: Reservation[] = [
        {
          id: 'res_1',
          orderId: order.id,
          sourceType: 'own_batch',
          quantity: 10000,
          status: 'active',
          createdAt: '2026-10-01'
        }
      ]
      const result = deriveOrderDisplayStatus(order, reservations, [])
      expect(result.kind).toBe('full')
      expect(result.label).toBe('Đã giữ đủ')
    })

    it('detects partial reservation with shortage count', () => {
      const order = createMockOrder({ requestedQuantity: 10000 })
      const reservations: Reservation[] = [
        {
          id: 'res_1',
          orderId: order.id,
          sourceType: 'own_batch',
          quantity: 6000,
          status: 'active',
          createdAt: '2026-10-01'
        }
      ]
      const result = deriveOrderDisplayStatus(order, reservations, [])
      expect(result.kind).toBe('partial')
      expect(result.label).toContain('Còn thiếu')
      expect(result.label).toContain('4.000')
    })

    it('detects no reservation', () => {
      const order = createMockOrder({ requestedQuantity: 10000 })
      const result = deriveOrderDisplayStatus(order, [], [])
      expect(result.kind).toBe('none')
      expect(result.label).toBe('Chưa giữ cây')
    })
  })

  describe('filterOrders', () => {
    const orders: OrderWithDerived[] = [
      {
        ...createMockOrder({ id: '1', status: 'partially_reserved' }),
        customerName: 'Khách 1',
        reservedQuantity: 5000,
        shortage: 5000,
        displayStatus: { kind: 'partial', label: 'Còn thiếu 5.000 cây', shortage: 5000 }
      },
      {
        ...createMockOrder({ id: '2', status: 'reserved' }),
        customerName: 'Khách 2',
        reservedQuantity: 10000,
        shortage: 0,
        displayStatus: { kind: 'full', label: 'Đã giữ đủ', shortage: 0 }
      },
      {
        ...createMockOrder({ id: '3', status: 'shipped' }),
        customerName: 'Khách 3',
        reservedQuantity: 10000,
        shortage: 0,
        displayStatus: { kind: 'shipped', label: 'Đã giao', shortage: 0 }
      }
    ]

    it('filters all', () => {
      expect(filterOrders(orders, 'all')).toHaveLength(3)
    })

    it('filters action_needed (orders with shortage)', () => {
      const actionNeeded = filterOrders(orders, 'action_needed')
      expect(actionNeeded).toHaveLength(1)
      expect(actionNeeded[0]?.id).toBe('1')
    })

    it('filters ready_pickup (fully reserved orders)', () => {
      const readyPickup = filterOrders(orders, 'ready_pickup')
      expect(readyPickup).toHaveLength(1)
      expect(readyPickup[0]?.id).toBe('2')
    })

    it('filters shipped', () => {
      const shipped = filterOrders(orders, 'shipped')
      expect(shipped).toHaveLength(1)
      expect(shipped[0]?.id).toBe('3')
    })
  })
})
