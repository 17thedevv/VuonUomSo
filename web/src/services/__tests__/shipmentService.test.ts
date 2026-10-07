import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import type { Batch } from '../../domain/batch'
import type { Order } from '../../domain/order'
import type { Reservation } from '../../domain/reservation'
import { availableQuantityForBatch } from '../../domain/quantity'
import {
  createShipment,
  cancelShipment,
  confirmShipment,
  getOrderShipmentSummary,
  getShipmentDetail
} from '../shipmentService'
import { releaseReservation } from '../reservationService'

describe('Service: Shipment & Physical Fulfillment', () => {
  const BATCH_ID = 'b_test_bv16'
  const ORDER_ID = 'ord_test_01'
  const RES_OWN_ID = 'res_test_own'
  const RES_EXT_ID = 'res_test_ext'

  beforeEach(async () => {
    await db.batches.clear()
    await db.orders.clear()
    await db.reservations.clear()
    await db.shipments.clear()
    await db.events.clear()
    await db.contacts.clear()

    // Seed test customer
    await db.contacts.add({
      id: 'cust_01',
      name: 'Bác Hùng',
      phone: '0912345678',
      roles: ['customer']
    })

    // Seed test supplier
    await db.contacts.add({
      id: 'sup_01',
      name: 'Vườn Thảo',
      phone: '0987654321',
      roles: ['supplier']
    })

    // Seed test batch: initial 50k, current 45.2k, ready 32k
    const batch: Batch = {
      id: BATCH_ID,
      code: 'BV16 #01',
      variety: 'Keo lai BV16',
      initialQuantity: 50000,
      currentQuantity: 45200,
      readyQuantity: 32000,
      status: 'ready',
      createdAt: '2026-09-01'
    }
    await db.batches.add(batch)

    // Seed test order: 30k requested
    const order: Order = {
      id: ORDER_ID,
      customerId: 'cust_01',
      variety: 'Keo lai BV16',
      requestedQuantity: 30000,
      status: 'reserved'
    }
    await db.orders.add(order)

    // Seed own batch reservation: 20k
    const ownReservation: Reservation = {
      id: RES_OWN_ID,
      orderId: ORDER_ID,
      sourceType: 'own_batch',
      batchId: BATCH_ID,
      quantity: 20000,
      fulfilledQuantity: 0,
      status: 'active',
      createdAt: '2026-09-02'
    }
    await db.reservations.add(ownReservation)

    // Seed external supplier reservation: 10k
    const extReservation: Reservation = {
      id: RES_EXT_ID,
      orderId: ORDER_ID,
      sourceType: 'external_supplier',
      supplierId: 'sup_01',
      quantity: 10000,
      fulfilledQuantity: 0,
      status: 'active',
      createdAt: '2026-09-02'
    }
    await db.reservations.add(extReservation)
  })

  describe('createShipment', () => {
    it('creates a planned shipment without mutating stock or reservation counts', async () => {
      const res = await createShipment({
        orderId: ORDER_ID,
        lines: [{ reservationId: RES_OWN_ID, quantity: 10000 }],
        plannedDate: '2026-10-10',
        note: 'Xe 5 tấn'
      })

      expect(res.success).toBe(true)
      expect(res.shipment.status).toBe('planned')
      expect(res.shipment.plannedQuantity).toBe(10000)
      expect(res.shipment.shippedQuantity).toBe(0)

      // INVARIANT: Stock MUST NOT be modified upon planning
      const batch = await db.batches.get(BATCH_ID)
      expect(batch?.currentQuantity).toBe(45200)
      expect(batch?.readyQuantity).toBe(32000)

      // INVARIANT: Reservation fulfilled quantity MUST NOT change
      const reservation = await db.reservations.get(RES_OWN_ID)
      expect(reservation?.fulfilledQuantity).toBe(0)
      expect(reservation?.status).toBe('active')
    })

    it('enforces the One Open Planned Shipment Rule', async () => {
      // First planned shipment
      await createShipment({
        orderId: ORDER_ID,
        lines: [{ reservationId: RES_OWN_ID, quantity: 5000 }]
      })

      // Attempting to create a second planned shipment for the same order MUST reject
      await expect(
        createShipment({
          orderId: ORDER_ID,
          lines: [{ reservationId: RES_OWN_ID, quantity: 5000 }]
        })
      ).rejects.toThrow(/chuyến giao dự kiến chưa xuất xe/)
    })

    it('rejects line quantity exceeding remaining reservation quantity', async () => {
      await expect(
        createShipment({
          orderId: ORDER_ID,
          lines: [{ reservationId: RES_OWN_ID, quantity: 25000 }] // Reserved only 20000
        })
      ).rejects.toThrow(/vượt quá số lượng giữ còn lại/)
    })

    it('rejects shipping from a released reservation', async () => {
      const res = await db.reservations.get(RES_OWN_ID)
      res!.status = 'released'
      await db.reservations.put(res!)

      await expect(
        createShipment({
          orderId: ORDER_ID,
          lines: [{ reservationId: RES_OWN_ID, quantity: 5000 }]
        })
      ).rejects.toThrow(/đã bị hủy/)
    })
  })

  describe('cancelShipment', () => {
    it('cancels a planned shipment without affecting stock', async () => {
      const createRes = await createShipment({
        orderId: ORDER_ID,
        lines: [{ reservationId: RES_OWN_ID, quantity: 10000 }]
      })

      const cancelRes = await cancelShipment({ shipmentId: createRes.shipment.id })
      expect(cancelRes.success).toBe(true)

      const shipment = await db.shipments.get(createRes.shipment.id)
      expect(shipment?.status).toBe('cancelled')

      // Verifies order can now create another planned shipment
      const secondCreate = await createShipment({
        orderId: ORDER_ID,
        lines: [{ reservationId: RES_OWN_ID, quantity: 10000 }]
      })
      expect(secondCreate.success).toBe(true)
    })

    it('rejects cancellation of a completed shipment', async () => {
      const createRes = await createShipment({
        orderId: ORDER_ID,
        lines: [{ reservationId: RES_OWN_ID, quantity: 10000 }]
      })
      await confirmShipment({ shipmentId: createRes.shipment.id })

      await expect(
        cancelShipment({ shipmentId: createRes.shipment.id })
      ).rejects.toThrow(/Không thể hủy chuyến giao đã hoàn thành/)
    })
  })

  describe('confirmShipment (Physical Fulfillment & Available Invariant)', () => {
    it('reduces physical stock atomically and preserves available quantity invariant', async () => {
      // Check pre-condition
      const allResBefore = await db.reservations.toArray()
      const batchBefore = (await db.batches.get(BATCH_ID))!
      // Ready: 32000, Reserved: 20000 -> Available: 12000
      expect(availableQuantityForBatch(batchBefore, allResBefore)).toBe(12000)

      // Plan shipment of 10.000 from own batch
      const { shipment } = await createShipment({
        orderId: ORDER_ID,
        lines: [{ reservationId: RES_OWN_ID, quantity: 10000 }]
      })

      // CONFIRM SHIPMENT
      const confirmRes = await confirmShipment({ shipmentId: shipment.id })
      expect(confirmRes.success).toBe(true)
      expect(confirmRes.shipment.status).toBe('completed')
      expect(confirmRes.shipment.shippedQuantity).toBe(10000)

      // 1. Physical stock reduced:
      const batchAfter = (await db.batches.get(BATCH_ID))!
      expect(batchAfter.currentQuantity).toBe(35200) // 45200 - 10000
      expect(batchAfter.readyQuantity).toBe(22000)   // 32000 - 10000

      // 2. Reservation fulfilled quantity updated:
      const resAfter = (await db.reservations.get(RES_OWN_ID))!
      expect(resAfter.fulfilledQuantity).toBe(10000)
      expect(resAfter.status).toBe('active') // 10000 remaining, still active

      // 3. CRITICAL INVARIANT: Available quantity remains identical!
      const allResAfter = await db.reservations.toArray()
      expect(availableQuantityForBatch(batchAfter, allResAfter)).toBe(12000)

      // 4. Order status becomes partially_shipped (10k of 30k delivered)
      const orderAfter = (await db.orders.get(ORDER_ID))!
      expect(orderAfter.status).toBe('partially_shipped')
    })

    it('completes order status to shipped when full requested quantity is fulfilled', async () => {
      // First shipment: 20.000 from own batch
      const { shipment: s1 } = await createShipment({
        orderId: ORDER_ID,
        lines: [{ reservationId: RES_OWN_ID, quantity: 20000 }]
      })
      await confirmShipment({ shipmentId: s1.id })

      // Second shipment: 10.000 from external supplier
      const { shipment: s2 } = await createShipment({
        orderId: ORDER_ID,
        lines: [{ reservationId: RES_EXT_ID, quantity: 10000 }]
      })
      await confirmShipment({ shipmentId: s2.id })

      // Check external supplier shipment did NOT reduce own batch stock
      const batch = (await db.batches.get(BATCH_ID))!
      expect(batch.currentQuantity).toBe(25200) // 45200 - 20000 (only s1)
      expect(batch.readyQuantity).toBe(12000)   // 32000 - 20000

      // Check reservations both marked as fulfilled
      const resOwn = (await db.reservations.get(RES_OWN_ID))!
      expect(resOwn.status).toBe('fulfilled')
      expect(resOwn.fulfilledQuantity).toBe(20000)

      const resExt = (await db.reservations.get(RES_EXT_ID))!
      expect(resExt.status).toBe('fulfilled')
      expect(resExt.fulfilledQuantity).toBe(10000)

      // Check order status is now fully 'shipped'
      const order = (await db.orders.get(ORDER_ID))!
      expect(order.status).toBe('shipped')
    })

    it('Scenario G: marks batch as depleted when shipment exhausts remaining stock (10k/10k -> 0/0 -> depleted)', async () => {
      const depleteBatch: Batch = {
        id: 'b_deplete',
        code: 'DEP #01',
        variety: 'Keo lai BV16',
        initialQuantity: 10000,
        currentQuantity: 10000,
        readyQuantity: 10000,
        status: 'ready',
        createdAt: '2026-09-01'
      }
      await db.batches.add(depleteBatch)

      const depleteOrder: Order = {
        id: 'ord_deplete',
        customerId: 'cust_01',
        variety: 'Keo lai BV16',
        requestedQuantity: 10000,
        status: 'reserved'
      }
      await db.orders.add(depleteOrder)

      const depleteRes: Reservation = {
        id: 'res_deplete',
        orderId: 'ord_deplete',
        sourceType: 'own_batch',
        batchId: 'b_deplete',
        quantity: 10000,
        status: 'active',
        createdAt: '2026-09-01'
      }
      await db.reservations.add(depleteRes)

      const { shipment } = await createShipment({
        orderId: 'ord_deplete',
        lines: [{ reservationId: 'res_deplete', quantity: 10000 }]
      })

      await confirmShipment({ shipmentId: shipment.id })

      const updatedBatch = (await db.batches.get('b_deplete'))!
      expect(updatedBatch.currentQuantity).toBe(0)
      expect(updatedBatch.readyQuantity).toBe(0)
      expect(updatedBatch.status).toBe('depleted')
    })

    it('is idempotent on duplicate confirmation calls', async () => {
      const { shipment } = await createShipment({
        orderId: ORDER_ID,
        lines: [{ reservationId: RES_OWN_ID, quantity: 10000 }]
      })

      // First confirmation
      await confirmShipment({ shipmentId: shipment.id })
      const batchAfterFirst = (await db.batches.get(BATCH_ID))!
      expect(batchAfterFirst.currentQuantity).toBe(35200)

      // Duplicate confirmation call (e.g. double click)
      const duplicateRes = await confirmShipment({ shipmentId: shipment.id })
      expect(duplicateRes.success).toBe(true)

      // Stock MUST NOT be decremented again
      const batchAfterSecond = (await db.batches.get(BATCH_ID))!
      expect(batchAfterSecond.currentQuantity).toBe(35200)
    })
  })

  describe('getOrderShipmentSummary & getShipmentDetail', () => {
    it('returns accurate summary and detail breakdowns', async () => {
      // Plan and confirm a partial shipment
      const { shipment } = await createShipment({
        orderId: ORDER_ID,
        lines: [{ reservationId: RES_OWN_ID, quantity: 10000 }],
        note: 'Bốc tại luống 3'
      })
      await confirmShipment({ shipmentId: shipment.id })

      const summary = await getOrderShipmentSummary(ORDER_ID)
      expect(summary).not.toBeNull()
      expect(summary?.totalShipped).toBe(10000)
      expect(summary?.remainingToShip).toBe(20000)
      expect(summary?.canCreateShipment).toBe(true)
      expect(summary?.plannedShipment).toBeUndefined()

      const detail = await getShipmentDetail(shipment.id)
      expect(detail).not.toBeNull()
      expect(detail?.shipment.id).toBe(shipment.id)
      expect(detail?.orderRequestedQuantity).toBe(30000)
      expect(detail?.orderShippedQuantity).toBe(10000)
      expect(detail?.orderRemainingToShip).toBe(20000)
      expect(detail?.linesWithDetails[0].sourceLabel).toContain('BV16 #01')
    })
  })

  describe('Safety & Transaction Atomicity (Boundary Audits)', () => {
    it('rejects duplicate reservationId in createShipment', async () => {
      await expect(
        createShipment({
          orderId: ORDER_ID,
          lines: [
            { reservationId: RES_OWN_ID, quantity: 5000 },
            { reservationId: RES_OWN_ID, quantity: 5000 }
          ]
        })
      ).rejects.toThrow('Một nguồn cây không được xuất hiện hai lần trong cùng chuyến.')

      const shipments = await db.shipments.toArray()
      expect(shipments.length).toBe(0)
    })

    it('rejects createShipment when total planned exceeds order remaining quantity', async () => {
      // Order requested: 30.000. Complete a shipment of 20.000 first
      const { shipment: firstShipment } = await createShipment({
        orderId: ORDER_ID,
        lines: [{ reservationId: RES_OWN_ID, quantity: 20000 }]
      })
      await confirmShipment({ shipmentId: firstShipment.id })

      // Now order remaining to ship is 10.000.
      // Trying to plan 15.000 must be rejected
      const extRes = (await db.reservations.get(RES_EXT_ID))!
      extRes.quantity = 15000
      await db.reservations.put(extRes)

      await expect(
        createShipment({
          orderId: ORDER_ID,
          lines: [{ reservationId: RES_EXT_ID, quantity: 15000 }]
        })
      ).rejects.toThrow('vượt quá số lượng còn thiếu của đơn hàng')
    })

    it('rolls back and rejects confirmShipment when line quantity is negative', async () => {
      const { shipment } = await createShipment({
        orderId: ORDER_ID,
        lines: [{ reservationId: RES_OWN_ID, quantity: 5000 }]
      })

      // Corrupt persisted shipment line
      shipment.lines![0].quantity = -1000
      await db.shipments.put(shipment)

      await expect(
        confirmShipment({ shipmentId: shipment.id })
      ).rejects.toThrow('Số lượng giao phải lớn hơn 0.')

      // Verify batch stock untouched
      const batch = (await db.batches.get(BATCH_ID))!
      expect(batch.currentQuantity).toBe(45200)
      expect(batch.readyQuantity).toBe(32000)

      // Verify reservation fulfilledQuantity untouched
      const res = (await db.reservations.get(RES_OWN_ID))!
      expect(res.fulfilledQuantity).toBe(0)

      // Verify shipment remains planned
      const persistedShip = (await db.shipments.get(shipment.id))!
      expect(persistedShip.status).toBe('planned')
    })

    it('rolls back and rejects confirmShipment when line quantity is fractional', async () => {
      const { shipment } = await createShipment({
        orderId: ORDER_ID,
        lines: [{ reservationId: RES_OWN_ID, quantity: 5000 }]
      })

      // Corrupt persisted shipment line
      shipment.lines![0].quantity = 1.5
      await db.shipments.put(shipment)

      await expect(
        confirmShipment({ shipmentId: shipment.id })
      ).rejects.toThrow('Số lượng giao phải là số nguyên (không có phần thập phân).')

      const batch = (await db.batches.get(BATCH_ID))!
      expect(batch.currentQuantity).toBe(45200)
      expect(batch.readyQuantity).toBe(32000)

      const res = (await db.reservations.get(RES_OWN_ID))!
      expect(res.fulfilledQuantity).toBe(0)
    })

    it('rolls back and rejects confirmShipment when reservation belongs to another order', async () => {
      const { shipment } = await createShipment({
        orderId: ORDER_ID,
        lines: [{ reservationId: RES_OWN_ID, quantity: 5000 }]
      })

      // Corrupt reservation to point to different order
      const res = (await db.reservations.get(RES_OWN_ID))!
      res.orderId = 'other_order_999'
      await db.reservations.put(res)

      await expect(
        confirmShipment({ shipmentId: shipment.id })
      ).rejects.toThrow('Nguồn cây trong chuyến không thuộc đơn hàng này.')

      const batch = (await db.batches.get(BATCH_ID))!
      expect(batch.currentQuantity).toBe(45200)
      expect(batch.readyQuantity).toBe(32000)
    })

    it('rolls back and rejects confirmShipment when line sourceType mismatches reservation', async () => {
      const { shipment } = await createShipment({
        orderId: ORDER_ID,
        lines: [{ reservationId: RES_OWN_ID, quantity: 5000 }]
      })

      // Corrupt line sourceType
      shipment.lines![0].sourceType = 'external_supplier'
      await db.shipments.put(shipment)

      await expect(
        confirmShipment({ shipmentId: shipment.id })
      ).rejects.toThrow('Loại nguồn cây trong chuyến không khớp với bản ghi giữ cây.')

      const batch = (await db.batches.get(BATCH_ID))!
      expect(batch.currentQuantity).toBe(45200)
      expect(batch.readyQuantity).toBe(32000)

      const res = (await db.reservations.get(RES_OWN_ID))!
      expect(res.fulfilledQuantity).toBe(0)
    })

    it('rolls back and rejects confirmShipment when line batchId mismatches reservation', async () => {
      // Add second batch B
      const BATCH_ID_2 = 'b_test_02'
      await db.batches.add({
        id: BATCH_ID_2,
        code: 'BV16 #02',
        variety: 'Keo lai BV16',
        initialQuantity: 10000,
        currentQuantity: 10000,
        readyQuantity: 10000,
        status: 'ready',
        createdAt: '2026-09-01'
      })

      const { shipment } = await createShipment({
        orderId: ORDER_ID,
        lines: [{ reservationId: RES_OWN_ID, quantity: 5000 }]
      })

      // Corrupt line batchId to point to batch 2
      shipment.lines![0].batchId = BATCH_ID_2
      await db.shipments.put(shipment)

      await expect(
        confirmShipment({ shipmentId: shipment.id })
      ).rejects.toThrow('Mã lô cây trong chuyến không khớp với bản ghi giữ cây.')

      // Neither batch A nor batch B is modified
      const batch1 = (await db.batches.get(BATCH_ID))!
      expect(batch1.currentQuantity).toBe(45200)
      expect(batch1.readyQuantity).toBe(32000)

      const batch2 = (await db.batches.get(BATCH_ID_2))!
      expect(batch2.currentQuantity).toBe(10000)
      expect(batch2.readyQuantity).toBe(10000)
    })

    it('rejects releaseReservation when reservation is allocated in an open planned shipment', async () => {
      // Plan shipment referencing RES_OWN_ID
      await createShipment({
        orderId: ORDER_ID,
        lines: [{ reservationId: RES_OWN_ID, quantity: 5000 }]
      })

      // Attempt to release reservation
      await expect(
        releaseReservation({ reservationId: RES_OWN_ID })
      ).rejects.toThrow(
        'Nguồn cây này đang nằm trong một chuyến chờ giao. Hãy hủy chuyến đó trước khi bỏ giữ cây.'
      )

      // Reservation remains active
      const res = (await db.reservations.get(RES_OWN_ID))!
      expect(res.status).toBe('active')
    })

    it('guarantees atomicity: multi-line shipment rolls back line 1 when line 2 fails', async () => {
      // Setup batch 2 with limited readyQuantity (2.000)
      const BATCH_ID_2 = 'b_test_02'
      const RES_OWN_ID_2 = 'res_test_own_2'
      await db.batches.add({
        id: BATCH_ID_2,
        code: 'BV16 #02',
        variety: 'Keo lai BV16',
        initialQuantity: 5000,
        currentQuantity: 5000,
        readyQuantity: 2000,
        status: 'ready',
        createdAt: '2026-09-01'
      })
      await db.reservations.add({
        id: RES_OWN_ID_2,
        orderId: ORDER_ID,
        sourceType: 'own_batch',
        batchId: BATCH_ID_2,
        quantity: 5000,
        fulfilledQuantity: 0,
        status: 'active',
        createdAt: '2026-09-02'
      })

      // Plan shipment: line 1 = 5.000 from batch 1 (valid), line 2 = 3.000 from batch 2
      // (Line 2 planned is 3.000, which exceeds batch 2 readyQuantity = 2.000)
      const { shipment } = await createShipment({
        orderId: ORDER_ID,
        lines: [
          { reservationId: RES_OWN_ID, quantity: 5000 },
          { reservationId: RES_OWN_ID_2, quantity: 3000 }
        ]
      })

      // Attempt confirmShipment: Line 1 succeeds, but Line 2 fails because batch 2 only has 2.000 ready
      await expect(
        confirmShipment({ shipmentId: shipment.id })
      ).rejects.toThrow('không đủ tồn kho thực tế để xuất')

      // ATOMICITY VERIFICATION: Line 1 stock deduction MUST BE ROLLED BACK
      const batch1 = (await db.batches.get(BATCH_ID))!
      expect(batch1.currentQuantity).toBe(45200)
      expect(batch1.readyQuantity).toBe(32000)

      const batch2 = (await db.batches.get(BATCH_ID_2))!
      expect(batch2.currentQuantity).toBe(5000)
      expect(batch2.readyQuantity).toBe(2000)

      const res1 = (await db.reservations.get(RES_OWN_ID))!
      expect(res1.fulfilledQuantity).toBe(0)
      expect(res1.status).toBe('active')

      const res2 = (await db.reservations.get(RES_OWN_ID_2))!
      expect(res2.fulfilledQuantity).toBe(0)
      expect(res2.status).toBe('active')

      // Shipment remains planned
      const persistedShip = (await db.shipments.get(shipment.id))!
      expect(persistedShip.status).toBe('planned')
    })

    it('rejects confirmShipment when persisted shipment has empty lines', async () => {
      const { shipment } = await createShipment({
        orderId: ORDER_ID,
        lines: [{ reservationId: RES_OWN_ID, quantity: 5000 }]
      })

      // Corrupt persisted shipment: lines = []
      shipment.lines = []
      await db.shipments.put(shipment)

      await expect(
        confirmShipment({ shipmentId: shipment.id })
      ).rejects.toThrow('Chuyến giao không có dòng phân bổ cây.')

      const batch = (await db.batches.get(BATCH_ID))!
      expect(batch.currentQuantity).toBe(45200)
      expect(batch.readyQuantity).toBe(32000)
    })

    it('rejects confirmShipment when sum of lines does not match plannedQuantity', async () => {
      const { shipment } = await createShipment({
        orderId: ORDER_ID,
        lines: [{ reservationId: RES_OWN_ID, quantity: 5000 }]
      })

      // Corrupt persisted shipment: plannedQuantity modified to 8000 but line is 5000
      shipment.plannedQuantity = 8000
      await db.shipments.put(shipment)

      await expect(
        confirmShipment({ shipmentId: shipment.id })
      ).rejects.toThrow('Tổng số cây trong các dòng không khớp với số lượng dự kiến của chuyến giao.')

      const batch = (await db.batches.get(BATCH_ID))!
      expect(batch.currentQuantity).toBe(45200)
      expect(batch.readyQuantity).toBe(32000)
    })

    it('rejects confirmShipment when persisted shipment has duplicate reservation lines', async () => {
      const { shipment } = await createShipment({
        orderId: ORDER_ID,
        lines: [{ reservationId: RES_OWN_ID, quantity: 5000 }]
      })

      // Corrupt persisted shipment: duplicate line for same reservationId
      shipment.lines = [
        { reservationId: RES_OWN_ID, sourceType: 'own_batch', batchId: BATCH_ID, quantity: 2000 },
        { reservationId: RES_OWN_ID, sourceType: 'own_batch', batchId: BATCH_ID, quantity: 3000 }
      ]
      await db.shipments.put(shipment)

      await expect(
        confirmShipment({ shipmentId: shipment.id })
      ).rejects.toThrow('Chuyến giao có dòng giữ cây bị trùng lặp.')

      const batch = (await db.batches.get(BATCH_ID))!
      expect(batch.currentQuantity).toBe(45200)
      expect(batch.readyQuantity).toBe(32000)
    })
  })
})
