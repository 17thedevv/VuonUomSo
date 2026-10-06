import { describe, it, expect } from 'vitest'
import {
  shippedQuantityForOrder,
  remainingToShipForOrder,
  hasPlannedShipmentForOrder,
  getPlannedShipmentForOrder,
  type Shipment
} from '../shipment'
import {
  fulfilledQuantityForReservation,
  remainingReservationQuantity,
  coveredQuantityForReservation,
  type Reservation
} from '../reservation'

describe('Domain: Shipment & Fulfillment formulas', () => {
  const createMockShipment = (overrides: Partial<Shipment>): Shipment => ({
    id: 'ship_1',
    orderId: 'ord_1',
    lines: [
      {
        reservationId: 'res_1',
        sourceType: 'own_batch',
        batchId: 'b_1',
        quantity: 10000
      }
    ],
    plannedQuantity: 10000,
    shippedQuantity: 10000,
    status: 'completed',
    shippedAt: '2026-10-05T08:00:00Z',
    createdAt: '2026-10-04T10:00:00Z',
    ...overrides
  })

  describe('shippedQuantityForOrder', () => {
    it('sums only completed shipments for the target order', () => {
      const shipments: Shipment[] = [
        createMockShipment({ id: 's1', orderId: 'ord_1', shippedQuantity: 10000, status: 'completed' }),
        createMockShipment({ id: 's2', orderId: 'ord_1', plannedQuantity: 5000, shippedQuantity: 0, status: 'planned' }),
        createMockShipment({ id: 's3', orderId: 'ord_1', plannedQuantity: 5000, shippedQuantity: 0, status: 'cancelled' }),
        createMockShipment({ id: 's4', orderId: 'ord_2', shippedQuantity: 8000, status: 'completed' })
      ]

      expect(shippedQuantityForOrder('ord_1', shipments)).toBe(10000)
      expect(shippedQuantityForOrder('ord_2', shipments)).toBe(8000)
      expect(shippedQuantityForOrder('ord_3', shipments)).toBe(0)
    })
  })

  describe('remainingToShipForOrder', () => {
    it('calculates remaining quantity to be delivered', () => {
      const shipments: Shipment[] = [
        createMockShipment({ id: 's1', orderId: 'ord_1', shippedQuantity: 12000, status: 'completed' })
      ]

      // Requested 30000, shipped 12000 -> remaining 18000
      expect(remainingToShipForOrder(30000, 'ord_1', shipments)).toBe(18000)
    })

    it('returns 0 if shipped exceeds or meets requested quantity', () => {
      const shipments: Shipment[] = [
        createMockShipment({ id: 's1', orderId: 'ord_1', shippedQuantity: 20000, status: 'completed' })
      ]

      expect(remainingToShipForOrder(20000, 'ord_1', shipments)).toBe(0)
      expect(remainingToShipForOrder(15000, 'ord_1', shipments)).toBe(0)
    })
  })

  describe('hasPlannedShipmentForOrder and getPlannedShipmentForOrder', () => {
    it('detects active planned shipment', () => {
      const shipments: Shipment[] = [
        createMockShipment({ id: 's1', orderId: 'ord_1', status: 'completed' }),
        createMockShipment({ id: 's2', orderId: 'ord_1', status: 'planned', plannedQuantity: 5000 })
      ]

      expect(hasPlannedShipmentForOrder('ord_1', shipments)).toBe(true)
      expect(getPlannedShipmentForOrder('ord_1', shipments)?.id).toBe('s2')
      expect(hasPlannedShipmentForOrder('ord_2', shipments)).toBe(false)
      expect(getPlannedShipmentForOrder('ord_2', shipments)).toBeUndefined()
    })
  })

  describe('Reservation partial fulfillment tracking', () => {
    it('calculates fulfilled and remaining reservation quantities correctly', () => {
      const res: Reservation = {
        id: 'res_1',
        orderId: 'ord_1',
        sourceType: 'own_batch',
        batchId: 'b_1',
        quantity: 20000,
        fulfilledQuantity: 8000,
        status: 'active',
        createdAt: '2026-10-01'
      }

      expect(fulfilledQuantityForReservation(res)).toBe(8000)
      expect(remainingReservationQuantity(res)).toBe(12000)
      expect(coveredQuantityForReservation(res)).toBe(20000)
    })

    it('returns 0 remaining for fulfilled or released reservations', () => {
      const fulfilledRes: Reservation = {
        id: 'res_2',
        orderId: 'ord_1',
        sourceType: 'own_batch',
        batchId: 'b_1',
        quantity: 15000,
        fulfilledQuantity: 15000,
        status: 'fulfilled',
        createdAt: '2026-10-01'
      }
      expect(remainingReservationQuantity(fulfilledRes)).toBe(0)
      expect(coveredQuantityForReservation(fulfilledRes)).toBe(15000)

      const releasedRes: Reservation = {
        id: 'res_3',
        orderId: 'ord_1',
        sourceType: 'own_batch',
        batchId: 'b_1',
        quantity: 20000,
        fulfilledQuantity: 5000,
        status: 'released',
        createdAt: '2026-10-01'
      }
      expect(remainingReservationQuantity(releasedRes)).toBe(0)
      // For released, covered quantity preserves previously fulfilled portion
      expect(coveredQuantityForReservation(releasedRes)).toBe(5000)
    })
  })
})
