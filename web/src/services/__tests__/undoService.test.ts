import { describe, it, expect, beforeEach, vi } from 'vitest'
import { undoService } from '../undoService'
import { batchRepository, orderRepository, eventRepository } from '../../data/repositories'
import { clearAllData } from '../../data/seed'
import type { Batch } from '../../domain/batch'
import type { Order } from '../../domain/order'

describe('undoService', () => {
  beforeEach(async () => {
    await clearAllData()
    undoService.clearLastMutation()
  })

  it('notifies subscribers when mutation is recorded or cleared', () => {
    const listener = vi.fn()
    const unsubscribe = undoService.subscribe(listener)

    undoService.recordMutation({
      type: 'create_batch',
      batchId: 'b1',
      batchCode: 'BV16 #01',
      description: 'Đã tạo lô'
    })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(undoService.getLastMutation()).not.toBeNull()

    undoService.clearLastMutation()
    expect(listener).toHaveBeenCalledTimes(2)
    expect(undoService.getLastMutation()).toBeNull()

    unsubscribe()
  })

  it('successfully undoes "create_batch" mutation', async () => {
    const testBatch: Batch = {
      id: 'batch_test_1',
      code: 'BV16 #01',
      variety: 'Bạch đàn BV16',
      initialQuantity: 10000,
      currentQuantity: 10000,
      readyQuantity: 0,
      status: 'propagating',
      createdAt: new Date().toISOString()
    }
    await batchRepository.save(testBatch)

    undoService.recordMutation({
      type: 'create_batch',
      batchId: testBatch.id,
      batchCode: testBatch.code,
      description: 'Đã tạo lô BV16 #01'
    })

    const result = await undoService.undoLastMutation()
    expect(result.success).toBe(true)
    expect(result.revertedType).toBe('create_batch')

    // Batch must be removed
    const found = await batchRepository.getById(testBatch.id)
    expect(found).toBeNull()

    // Undo event logged
    const events = await eventRepository.getAll()
    expect(events.some((e) => e.type === 'mutation_undone' && e.entityId === testBatch.id)).toBe(true)
  })

  it('successfully undoes "update_inventory" mutation and restores previous quantity', async () => {
    const testBatch: Batch = {
      id: 'batch_test_2',
      code: 'AH1 #01',
      variety: 'Keo lai AH1',
      initialQuantity: 20000,
      currentQuantity: 15000, // Updated quantity
      readyQuantity: 0,
      status: 'propagating',
      createdAt: new Date().toISOString()
    }
    await batchRepository.save(testBatch)

    undoService.recordMutation({
      type: 'update_inventory',
      batchId: testBatch.id,
      batchCode: testBatch.code,
      previousQuantity: 20000, // Previous quantity was 20.000
      description: 'Đã cập nhật kiểm kê'
    })

    const result = await undoService.undoLastMutation()
    expect(result.success).toBe(true)
    expect(result.revertedType).toBe('update_inventory')

    // Current quantity restored
    const updated = await batchRepository.getById(testBatch.id)
    expect(updated?.currentQuantity).toBe(20000)

    // Undo event logged
    const events = await eventRepository.getAll()
    expect(events.some((e) => e.type === 'mutation_undone' && e.entityId === testBatch.id)).toBe(true)
  })

  it('successfully undoes "create_order" mutation', async () => {
    const testOrder: Order = {
      id: 'order_test_1',
      customerId: 'customer_1',
      variety: 'Bạch đàn BV16',
      requestedQuantity: 5000,
      status: 'open'
    }
    await orderRepository.save(testOrder)

    undoService.recordMutation({
      type: 'create_order',
      orderId: testOrder.id,
      customerName: 'Bác Ba',
      description: 'Đã ghi đơn cho Bác Ba'
    })

    const result = await undoService.undoLastMutation()
    expect(result.success).toBe(true)
    expect(result.revertedType).toBe('create_order')

    // Order must be deleted
    const found = await orderRepository.getById(testOrder.id)
    expect(found).toBeNull()

    // Undo event logged
    const events = await eventRepository.getAll()
    expect(events.some((e) => e.type === 'mutation_undone' && e.entityId === testOrder.id)).toBe(true)
  })
})
