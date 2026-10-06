import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { clearAllData, resetDemoData } from '../../data/seed'
import {
  reserveOwnBatch,
  reserveExternalSupplier,
  releaseReservation,
  getReservationOptions,
  getOrderReservationHistory
} from '../reservationService'
import { undoService } from '../undoService'
import { availableQuantityForBatch, reservedQuantityForBatch } from '../../domain/quantity'
import { reservedQuantityForOrder, orderShortage } from '../../domain/order'
import type { Batch } from '../../domain/batch'
import type { Order } from '../../domain/order'
import type { Contact } from '../../domain/contact'
import type { Reservation } from '../../domain/reservation'

describe('Service: reservationService (Phase P3)', () => {
  beforeEach(async () => {
    await clearAllData()
    undoService.clearLastMutation()
  })

  // =========================================================================
  // Section 52: Critical test — own reservation
  // =========================================================================
  it('reserves from own batch: ready=32k, reserved=10k, available=22k -> reserve 12k -> reserved=22k, available=10k', async () => {
    const batch: Batch = {
      id: 'b_bv16',
      code: 'BV16 #12',
      variety: 'Bạch đàn BV16',
      createdAt: '2026-09-01T00:00:00.000Z',
      initialQuantity: 50000,
      currentQuantity: 45200,
      readyQuantity: 32000,
      status: 'ready'
    }
    const order: Order = {
      id: 'ord_1',
      customerId: 'cust_1',
      variety: 'Bạch đàn BV16',
      requestedQuantity: 30000,
      status: 'open'
    }
    const existingRes: Reservation = {
      id: 'res_old',
      orderId: 'other_order',
      sourceType: 'own_batch',
      batchId: 'b_bv16',
      quantity: 10000,
      status: 'active',
      createdAt: '2026-09-02T00:00:00.000Z'
    }

    await db.batches.put(batch)
    await db.orders.put(order)
    await db.reservations.put(existingRes)

    // Pre-check
    const preReservations = await db.reservations.toArray()
    expect(availableQuantityForBatch(batch, preReservations)).toBe(22000)

    // Action: Reserve 12.000
    const result = await reserveOwnBatch({
      orderId: order.id,
      batchId: batch.id,
      quantity: 12000
    })

    expect(result.success).toBe(true)

    // Post-check
    const postReservations = await db.reservations.toArray()
    expect(reservedQuantityForBatch(batch.id, postReservations)).toBe(22000)
    expect(availableQuantityForBatch(batch, postReservations)).toBe(10000)

    // Physical current quantity remains unchanged
    const reloadedBatch = await db.batches.get(batch.id)
    expect(reloadedBatch?.currentQuantity).toBe(45200)
    expect(reloadedBatch?.readyQuantity).toBe(32000)
  })

  // =========================================================================
  // Section 53: Critical test — over-reserve batch
  // =========================================================================
  it('blocks over-reserving batch: available=22k -> reserve 22.001 -> rejects without persisting', async () => {
    const batch: Batch = {
      id: 'b_bv16',
      code: 'BV16 #12',
      variety: 'Bạch đàn BV16',
      createdAt: '2026-09-01T00:00:00.000Z',
      initialQuantity: 50000,
      currentQuantity: 45200,
      readyQuantity: 22000,
      status: 'ready'
    }
    const order: Order = {
      id: 'ord_1',
      customerId: 'cust_1',
      variety: 'Bạch đàn BV16',
      requestedQuantity: 30000,
      status: 'open'
    }
    await db.batches.put(batch)
    await db.orders.put(order)

    await expect(
      reserveOwnBatch({
        orderId: order.id,
        batchId: batch.id,
        quantity: 22001
      })
    ).rejects.toThrow(/Không đủ cây trong lô này/)

    // Verify nothing persisted
    const allRes = await db.reservations.toArray()
    expect(allRes).toHaveLength(0)
    const allEvents = await db.events.toArray()
    expect(allEvents).toHaveLength(0)
  })

  // =========================================================================
  // Section 54: Critical test — over-reserve order
  // =========================================================================
  it('blocks over-reserving order: shortage=8k, batch available=22k -> reserve 10k -> rejects', async () => {
    const batch: Batch = {
      id: 'b_bv16',
      code: 'BV16 #12',
      variety: 'Bạch đàn BV16',
      createdAt: '2026-09-01T00:00:00.000Z',
      initialQuantity: 50000,
      currentQuantity: 45200,
      readyQuantity: 22000,
      status: 'ready'
    }
    const order: Order = {
      id: 'ord_1',
      customerId: 'cust_1',
      variety: 'Bạch đàn BV16',
      requestedQuantity: 8000, // order only needs 8.000
      status: 'open'
    }
    await db.batches.put(batch)
    await db.orders.put(order)

    await expect(
      reserveOwnBatch({
        orderId: order.id,
        batchId: batch.id,
        quantity: 10000
      })
    ).rejects.toThrow(/Đơn này chỉ còn thiếu 8.000 cây/)

    const allRes = await db.reservations.toArray()
    expect(allRes).toHaveLength(0)
  })

  // =========================================================================
  // Section 55: Critical test — release reservation
  // =========================================================================
  it('releases reservation and restores batch availability: ready=32k, reserved=20k -> release 10k -> reserved=10k, available=22k', async () => {
    const batch: Batch = {
      id: 'b_bv16',
      code: 'BV16 #12',
      variety: 'Bạch đàn BV16',
      createdAt: '2026-09-01T00:00:00.000Z',
      initialQuantity: 50000,
      currentQuantity: 45200,
      readyQuantity: 32000,
      status: 'ready'
    }
    const order: Order = {
      id: 'ord_1',
      customerId: 'cust_1',
      variety: 'Bạch đàn BV16',
      requestedQuantity: 20000,
      status: 'reserved'
    }
    const res1: Reservation = {
      id: 'res_1',
      orderId: 'ord_1',
      sourceType: 'own_batch',
      batchId: 'b_bv16',
      quantity: 10000,
      status: 'active',
      createdAt: '2026-09-01T00:00:00.000Z'
    }
    const res2: Reservation = {
      id: 'res_2',
      orderId: 'ord_1',
      sourceType: 'own_batch',
      batchId: 'b_bv16',
      quantity: 10000,
      status: 'active',
      createdAt: '2026-09-01T00:00:00.000Z'
    }

    await db.batches.put(batch)
    await db.orders.put(order)
    await db.reservations.bulkPut([res1, res2])

    // Pre-check
    let allRes = await db.reservations.toArray()
    expect(reservedQuantityForBatch(batch.id, allRes)).toBe(20000)
    expect(availableQuantityForBatch(batch, allRes)).toBe(12000)

    // Action: Release res1
    const releaseResult = await releaseReservation({ reservationId: 'res_1' })
    expect(releaseResult.success).toBe(true)

    // Post-check
    allRes = await db.reservations.toArray()
    expect(reservedQuantityForBatch(batch.id, allRes)).toBe(10000)
    expect(availableQuantityForBatch(batch, allRes)).toBe(22000)

    // Order status updated
    const updatedOrder = await db.orders.get(order.id)
    expect(updatedOrder?.status).toBe('partially_reserved')
    expect(orderShortage(updatedOrder!, allRes)).toBe(10000)
  })

  // =========================================================================
  // Section 56: Critical test — physical quantity unchanged (regression guard)
  // =========================================================================
  it('guarantees reservation does NOT mutate currentQuantity or readyQuantity', async () => {
    const batch: Batch = {
      id: 'b_bv16',
      code: 'BV16 #12',
      variety: 'Bạch đàn BV16',
      createdAt: '2026-09-01T00:00:00.000Z',
      initialQuantity: 50000,
      currentQuantity: 45200,
      readyQuantity: 32000,
      status: 'ready'
    }
    const order: Order = {
      id: 'ord_1',
      customerId: 'cust_1',
      variety: 'Bạch đàn BV16',
      requestedQuantity: 20000,
      status: 'open'
    }
    await db.batches.put(batch)
    await db.orders.put(order)

    await reserveOwnBatch({
      orderId: order.id,
      batchId: batch.id,
      quantity: 20000
    })

    const reloaded = await db.batches.get(batch.id)
    expect(reloaded?.currentQuantity).toBe(45200) // MUST be strictly unchanged!
    expect(reloaded?.readyQuantity).toBe(32000) // MUST be strictly unchanged!
  })

  // =========================================================================
  // Section 57: Critical test — multiple reservations & multi-source
  // =========================================================================
  it('supports multi-source reservation: order requested 100k fulfilled by own batch + 3 suppliers', async () => {
    const ownBatch: Batch = {
      id: 'b_own',
      code: 'BV16 #12',
      variety: 'Bạch đàn BV16',
      createdAt: '2026-09-01T00:00:00.000Z',
      initialQuantity: 30000,
      currentQuantity: 25000,
      readyQuantity: 22000,
      status: 'ready'
    }
    const supplier1: Contact = {
      id: 'sup_thao',
      name: 'Vườn Thảo',
      roles: ['supplier']
    }
    const supplier2: Contact = {
      id: 'sup_hong',
      name: 'Vườn Hồng',
      roles: ['supplier']
    }
    const supplier3: Contact = {
      id: 'sup_an',
      name: 'Vườn An',
      roles: ['supplier']
    }
    const order: Order = {
      id: 'ord_100k',
      customerId: 'cust_1',
      variety: 'Bạch đàn BV16',
      requestedQuantity: 100000,
      status: 'open'
    }

    await db.batches.put(ownBatch)
    await db.contacts.bulkPut([supplier1, supplier2, supplier3])
    await db.orders.put(order)

    // 1. Reserve 22.000 from own batch
    await reserveOwnBatch({ orderId: order.id, batchId: ownBatch.id, quantity: 22000 })
    let currentRes = await db.reservations.toArray()
    expect(orderShortage(order, currentRes)).toBe(78000)

    // 2. Reserve 35.000 from Vườn Thảo
    await reserveExternalSupplier({ orderId: order.id, supplierId: supplier1.id, quantity: 35000 })
    currentRes = await db.reservations.toArray()
    expect(orderShortage(order, currentRes)).toBe(43000)

    // 3. Reserve 22.000 from Vườn Hồng
    await reserveExternalSupplier({ orderId: order.id, supplierId: supplier2.id, quantity: 22000 })
    currentRes = await db.reservations.toArray()
    expect(orderShortage(order, currentRes)).toBe(21000)

    // 4. Reserve 21.000 from Vườn An
    await reserveExternalSupplier({ orderId: order.id, supplierId: supplier3.id, quantity: 21000 })
    currentRes = await db.reservations.toArray()
    expect(orderShortage(order, currentRes)).toBe(0)
    expect(reservedQuantityForOrder(order.id, currentRes)).toBe(100000)

    const updatedOrder = await db.orders.get(order.id)
    expect(updatedOrder?.status).toBe('reserved')
  })

  // =========================================================================
  // Section 58: Critical test — released excluded
  // =========================================================================
  it('excludes released reservations from order and batch totals', async () => {
    const batch: Batch = {
      id: 'b_bv16',
      code: 'BV16 #12',
      variety: 'Bạch đàn BV16',
      createdAt: '2026-09-01T00:00:00.000Z',
      initialQuantity: 50000,
      currentQuantity: 45000,
      readyQuantity: 30000,
      status: 'ready'
    }
    const order: Order = {
      id: 'ord_1',
      customerId: 'cust_1',
      variety: 'Bạch đàn BV16',
      requestedQuantity: 20000,
      status: 'open'
    }
    await db.batches.put(batch)
    await db.orders.put(order)

    const { reservation } = await reserveOwnBatch({
      orderId: order.id,
      batchId: batch.id,
      quantity: 20000
    })

    // Release it
    await releaseReservation({ reservationId: reservation.id })

    const allRes = await db.reservations.toArray()
    expect(reservedQuantityForBatch(batch.id, allRes)).toBe(0)
    expect(reservedQuantityForOrder(order.id, allRes)).toBe(0)
    expect(availableQuantityForBatch(batch, allRes)).toBe(30000)
    expect(orderShortage(order, allRes)).toBe(20000)
  })

  // =========================================================================
  // Section 59: Critical test — stale availability rechecked at commit
  // =========================================================================
  it('rechecks availability at commit time and rejects if concurrent reservation reduced stock', async () => {
    const batch: Batch = {
      id: 'b_bv16',
      code: 'BV16 #12',
      variety: 'Bạch đàn BV16',
      createdAt: '2026-09-01T00:00:00.000Z',
      initialQuantity: 50000,
      currentQuantity: 45000,
      readyQuantity: 22000,
      status: 'ready'
    }
    const order: Order = {
      id: 'ord_1',
      customerId: 'cust_1',
      variety: 'Bạch đàn BV16',
      requestedQuantity: 20000,
      status: 'open'
    }
    await db.batches.put(batch)
    await db.orders.put(order)

    // Suppose user opened modal seeing 22k available.
    // Meanwhile another reservation of 12k takes place:
    await db.reservations.put({
      id: 'concurrent_res',
      orderId: 'other_ord',
      sourceType: 'own_batch',
      batchId: batch.id,
      quantity: 12000,
      status: 'active',
      createdAt: new Date().toISOString()
    })

    // User tries to reserve 20k: commit-time check must reject because only 10k is left
    await expect(
      reserveOwnBatch({
        orderId: order.id,
        batchId: batch.id,
        quantity: 20000
      })
    ).rejects.toThrow(/Không đủ cây trong lô này/)
  })

  // =========================================================================
  // Undo test: Undo reservation creation
  // =========================================================================
  it('supports single-level undo: releasing newly created reservation', async () => {
    const batch: Batch = {
      id: 'b_bv16',
      code: 'BV16 #12',
      variety: 'Bạch đàn BV16',
      createdAt: '2026-09-01T00:00:00.000Z',
      initialQuantity: 50000,
      currentQuantity: 45000,
      readyQuantity: 22000,
      status: 'ready'
    }
    const order: Order = {
      id: 'ord_1',
      customerId: 'cust_1',
      variety: 'Bạch đàn BV16',
      requestedQuantity: 20000,
      status: 'open'
    }
    await db.batches.put(batch)
    await db.orders.put(order)

    await reserveOwnBatch({
      orderId: order.id,
      batchId: batch.id,
      quantity: 15000
    })

    let allRes = await db.reservations.toArray()
    expect(availableQuantityForBatch(batch, allRes)).toBe(7000)

    // Trigger undo
    const undoResult = await undoService.undoLastMutation()
    expect(undoResult.success).toBe(true)

    allRes = await db.reservations.toArray()
    expect(availableQuantityForBatch(batch, allRes)).toBe(22000)
    expect(reservedQuantityForOrder(order.id, allRes)).toBe(0)
  })

  // =========================================================================
  // getReservationOptions test
  // =========================================================================
  it('loads reservation options with own batches and external suppliers', async () => {
    await resetDemoData()

    const options = await getReservationOptions('order_lan_01')
    expect(options).not.toBeNull()
    expect(options?.order.variety).toBe('Bạch đàn BV16')
    expect(options?.shortage).toBe(18000)
    expect(options?.currentReservations.length).toBeGreaterThan(0)
    expect(options?.externalSuppliers.length).toBeGreaterThan(0)
  })

  // =========================================================================
  // getOrderReservationHistory test
  // =========================================================================
  it('records and retrieves chronological reservation events', async () => {
    const batch: Batch = {
      id: 'b_bv16',
      code: 'BV16 #12',
      variety: 'Bạch đàn BV16',
      createdAt: '2026-09-01T00:00:00.000Z',
      initialQuantity: 50000,
      currentQuantity: 45000,
      readyQuantity: 22000,
      status: 'ready'
    }
    const order: Order = {
      id: 'ord_1',
      customerId: 'cust_1',
      variety: 'Bạch đàn BV16',
      requestedQuantity: 20000,
      status: 'open'
    }
    await db.batches.put(batch)
    await db.orders.put(order)

    const { reservation } = await reserveOwnBatch({
      orderId: order.id,
      batchId: batch.id,
      quantity: 10000
    })

    let history = await getOrderReservationHistory(order.id)
    expect(history.length).toBe(1)
    expect(history[0]?.type).toBe('reservation_created')

    await releaseReservation({ reservationId: reservation.id })

    history = await getOrderReservationHistory(order.id)
    expect(history.length).toBe(2)
    expect(history[0]?.type).toBe('reservation_released')
  })
})
