import { describe, it, expect, beforeEach } from 'vitest'
import { createOrder, getVarietyAvailability } from '../orderService'
import {
  contactRepository,
  batchRepository,
  reservationRepository,
  orderRepository,
  eventRepository
} from '../../data/repositories'
import { clearAllData, resetDemoData } from '../../data/seed'
import { undoService } from '../undoService'
import { availableQuantityForBatch } from '../../domain/quantity'

describe('orderService', () => {
  beforeEach(async () => {
    await clearAllData()
    undoService.clearLastMutation()
  })

  describe('getVarietyAvailability', () => {
    it('accurately calculates available stock and shortage for a given variety', async () => {
      await resetDemoData()

      // Demo data has BV16: ready = 32000, reserved = 10000 => available = 22000
      const availability1 = await getVarietyAvailability('Keo lai BV16', 20000)
      expect(availability1.readyQuantity).toBe(32000)
      expect(availability1.reservedQuantity).toBe(10000)
      expect(availability1.availableQuantity).toBe(22000)
      expect(availability1.isShortage).toBe(false)
      expect(availability1.shortageAmount).toBe(0)

      // Requesting 30.000 while 22.000 available => shortage of 8.000
      const availability2 = await getVarietyAvailability('Keo lai BV16', 30000)
      expect(availability2.isShortage).toBe(true)
      expect(availability2.shortageAmount).toBe(8000)
    })
  })

  describe('createOrder', () => {
    it('creates order with status="open" WITHOUT creating any reservation or changing stock', async () => {
      await resetDemoData()

      // Snapshot batches and reservations before order creation
      const reservationsBefore = await reservationRepository.getAll()
      const batchesBefore = await batchRepository.getAll()
      const bv16Before = batchesBefore.find((b) => b.code === 'BV16 #12')!
      const availBefore = availableQuantityForBatch(bv16Before, reservationsBefore)

      // Create new order for 30.000 trees
      const result = await createOrder({
        customerId: 'contact_hung',
        variety: 'Keo lai BV16',
        requestedQuantity: 30000,
        unitPrice: 1200,
        requestedDate: '2026-10-20',
        note: 'Giao tại bãi Tuấn Sơn'
      })

      expect(result.success).toBe(true)
      expect(result.order).toBeDefined()
      const order = result.order!

      // Strict domain invariants for Phase P2
      expect(order.status).toBe('open')
      expect(order.requestedQuantity).toBe(30000)
      expect(order.unitPrice).toBe(1200)

      // CRITICAL: NO reservations created
      const reservationsAfter = await reservationRepository.getAll()
      expect(reservationsAfter.length).toBe(reservationsBefore.length)

      // CRITICAL: Batch inventory unmodified
      const batchesAfter = await batchRepository.getAll()
      const bv16After = batchesAfter.find((b) => b.code === 'BV16 #12')!
      expect(bv16After.currentQuantity).toBe(bv16Before.currentQuantity)
      expect(bv16After.readyQuantity).toBe(bv16Before.readyQuantity)
      const availAfter = availableQuantityForBatch(bv16After, reservationsAfter)
      expect(availAfter).toBe(availBefore)

      // Informational shortage feedback provided
      expect(result.availabilityInfo?.isShortage).toBe(true)
      expect(result.availabilityInfo?.shortageAmount).toBe(8000)

      // Order saved in repository
      const saved = await orderRepository.getById(order.id)
      expect(saved).not.toBeNull()
      expect(saved?.variety).toBe('Keo lai BV16')

      // Event logged
      const events = await eventRepository.getAll()
      expect(events.some((e) => e.type === 'order_created' && e.entityId === order.id)).toBe(true)

      // Undo registered
      const lastMutation = undoService.getLastMutation()
      expect(lastMutation).toEqual({
        type: 'create_order',
        orderId: order.id,
        customerName: 'Anh Hùng',
        description: 'Đã ghi đơn cho Anh Hùng'
      })
    })

    it('rejects order with invalid requested quantity <= 0', async () => {
      await contactRepository.save({
        id: 'c1',
        name: 'Bác Ba',
        roles: ['customer']
      })

      const result = await createOrder({
        customerId: 'c1',
        variety: 'Keo lai AH1',
        requestedQuantity: 0
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('phải lớn hơn 0')
    })

    it('rejects order with non-existent customer', async () => {
      const result = await createOrder({
        customerId: 'unknown_customer',
        variety: 'Keo lai AH1',
        requestedQuantity: 5000
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('không tồn tại trong danh bạ')
    })
  })
})
