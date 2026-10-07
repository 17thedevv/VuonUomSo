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
      variety: 'Keo lai BV16',
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
      variety: 'Keo lai BV16',
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

  it('successfully undoes "update_ready_quantity" mutation and restores previous ready quantity and status', async () => {
    const testBatch: Batch = {
      id: 'batch_test_ready',
      code: 'AH1 #02',
      variety: 'Keo lai AH1',
      initialQuantity: 30000,
      currentQuantity: 30000,
      readyQuantity: 15000,
      status: 'ready',
      createdAt: new Date().toISOString()
    }
    await batchRepository.save(testBatch)

    undoService.recordMutation({
      type: 'update_ready_quantity',
      batchId: testBatch.id,
      batchCode: testBatch.code,
      previousReadyQuantity: 0,
      description: 'Đã cập nhật cây đủ bán'
    })

    const result = await undoService.undoLastMutation()
    expect(result.success).toBe(true)
    expect(result.revertedType).toBe('update_ready_quantity')

    const updated = await batchRepository.getById(testBatch.id)
    expect(updated?.readyQuantity).toBe(0)
    expect(updated?.status).toBe('propagating')
  })

  it('rejects undo for update_ready_quantity if batch was modified in the interim', async () => {
    const testBatch: Batch = {
      id: 'batch_test_intervene_ready',
      code: 'AH1 #03',
      variety: 'Keo lai AH1',
      initialQuantity: 30000,
      currentQuantity: 30000,
      readyQuantity: 20000,
      status: 'ready',
      createdAt: new Date().toISOString()
    }
    await batchRepository.save(testBatch)

    // Recorded mutation expecting current: 30000, ready: 20000
    undoService.recordMutation({
      type: 'update_ready_quantity',
      batchId: testBatch.id,
      batchCode: testBatch.code,
      previousReadyQuantity: 10000,
      expectedReadyQuantity: 20000,
      expectedCurrentQuantity: 30000,
      description: 'Đã cập nhật cây đủ bán'
    })

    // Intervening event occurs (e.g. shipment exported 10k trees)
    testBatch.currentQuantity = 20000
    testBatch.readyQuantity = 10000
    await batchRepository.save(testBatch)

    // Attempt undo
    const result = await undoService.undoLastMutation()
    expect(result.success).toBe(false)
    expect(result.message).toBe('Không thể hoàn tác vì lô đã thay đổi sau thao tác này.')

    // Inventory must remain untouched (no resurrection)
    const current = await batchRepository.getById(testBatch.id)
    expect(current?.currentQuantity).toBe(20000)
    expect(current?.readyQuantity).toBe(10000)
  })

  it('rejects undo for update_inventory if batch was modified in the interim', async () => {
    const testBatch: Batch = {
      id: 'batch_test_intervene_inv',
      code: 'AH1 #04',
      variety: 'Keo lai AH1',
      initialQuantity: 30000,
      currentQuantity: 25000,
      readyQuantity: 15000,
      status: 'ready',
      createdAt: new Date().toISOString()
    }
    await batchRepository.save(testBatch)

    // Recorded mutation expecting current: 25000, ready: 15000
    undoService.recordMutation({
      type: 'update_inventory',
      batchId: testBatch.id,
      batchCode: testBatch.code,
      previousQuantity: 30000,
      previousReadyQuantity: 20000,
      expectedCurrentQuantity: 25000,
      expectedReadyQuantity: 15000,
      description: 'Đã cập nhật kiểm kê'
    })

    // Intervening event occurs (ready quantity modified)
    testBatch.readyQuantity = 12000
    await batchRepository.save(testBatch)

    // Attempt undo
    const result = await undoService.undoLastMutation()
    expect(result.success).toBe(false)
    expect(result.message).toBe('Không thể hoàn tác vì lô đã thay đổi sau thao tác này.')

    // Inventory must remain untouched
    const current = await batchRepository.getById(testBatch.id)
    expect(current?.currentQuantity).toBe(25000)
    expect(current?.readyQuantity).toBe(12000)
  })
})
