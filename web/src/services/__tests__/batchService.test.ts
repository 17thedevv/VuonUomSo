import { describe, it, expect, beforeEach } from 'vitest'
import {
  extractVarietyPrefix,
  generateBatchCode,
  createBatch,
  updateBatchInventory,
  updateBatchReadyQuantity
} from '../batchService'
import { batchRepository, eventRepository } from '../../data/repositories'
import { db } from '../../data/db'
import { clearAllData } from '../../data/seed'
import { undoService } from '../undoService'
import { type Batch, deriveBatchStatus, getBatchDisplayStatus } from '../../domain/batch'
import { availableQuantityForBatch, commitmentShortageForBatch } from '../../domain/quantity'
import type { Reservation } from '../../domain/reservation'

describe('batchService', () => {
  beforeEach(async () => {
    await clearAllData()
    undoService.clearLastMutation()
  })

  describe('extractVarietyPrefix', () => {
    it('extracts uppercase alphanumeric code from variety name', () => {
      expect(extractVarietyPrefix('Keo lai BV16')).toBe('BV16')
      expect(extractVarietyPrefix('Keo lai AH1')).toBe('AH1')
      expect(extractVarietyPrefix('Keo lai BV523')).toBe('BV523')
      expect(extractVarietyPrefix('Keo mô GLSE9')).toBe('GLSE9')
    })

    it('falls back to initials when no alphanumeric code is detected', () => {
      expect(extractVarietyPrefix('Bạch đàn trắng')).toBe('BĐT')
      expect(extractVarietyPrefix('Keo lá tràm')).toBe('KLT')
    })
  })

  describe('generateBatchCode', () => {
    it('generates sequential batch code based on existing batches of that variety', () => {
      const existing: Batch[] = [
        {
          id: 'b1',
          code: 'BV16 #12',
          variety: 'Keo lai BV16',
          initialQuantity: 50000,
          currentQuantity: 50000,
          readyQuantity: 0,
          status: 'propagating',
          createdAt: new Date().toISOString()
        }
      ]

      const code = generateBatchCode('Keo lai BV16', existing)
      expect(code).toBe('BV16 #13')
    })

    it('starts with #01 if no existing batch for that variety exists', () => {
      const code = generateBatchCode('Keo lai AH1', [])
      expect(code).toBe('AH1 #01')
    })
  })

  describe('createBatch', () => {
    it('creates batch with correct forestry invariants: current=initial, ready=0, status=propagating', async () => {
      const result = await createBatch({
        variety: 'Keo lai BV16',
        initialQuantity: 40000,
        sourceNote: 'Cây hom vườn ươm Ba Vì'
      })

      expect(result.success).toBe(true)
      expect(result.batch).toBeDefined()
      const batch = result.batch!

      expect(batch.code).toBe('BV16 #01')
      expect(batch.variety).toBe('Keo lai BV16')
      expect(batch.initialQuantity).toBe(40000)
      expect(batch.currentQuantity).toBe(40000)
      expect(batch.readyQuantity).toBe(0)
      expect(batch.status).toBe('propagating')
      expect(batch.sourceNote).toBe('Cây hom vườn ươm Ba Vì')

      // Verify repository persistence
      const saved = await batchRepository.getById(batch.id)
      expect(saved).not.toBeNull()
      expect(saved?.initialQuantity).toBe(40000)

      // Verify event logged
      const events = await eventRepository.getAll()
      expect(events.some((e) => e.type === 'batch_created' && e.entityId === batch.id)).toBe(true)

      // Verify undo registered
      const lastMutation = undoService.getLastMutation()
      expect(lastMutation).toEqual({
        type: 'create_batch',
        batchId: batch.id,
        batchCode: batch.code,
        description: `Đã tạo lô ${batch.code}`
      })
    })

    it('rejects invalid initial quantity <= 0', async () => {
      const result = await createBatch({
        variety: 'Keo lai BV16',
        initialQuantity: 0
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('phải lớn hơn 0')
    })

    it('rejects empty variety', async () => {
      const result = await createBatch({
        variety: '   ',
        initialQuantity: 10000
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('tên giống cây')
    })

    it('rejects duplicate batch code', async () => {
      await createBatch({
        code: 'BV16 #99',
        variety: 'Keo lai BV16',
        initialQuantity: 10000
      })

      const duplicate = await createBatch({
        code: 'BV16 #99',
        variety: 'Keo lai BV16',
        initialQuantity: 20000
      })

      expect(duplicate.success).toBe(false)
      expect(duplicate.error).toContain('đã tồn tại')
    })
  })

  describe('updateBatchInventory', () => {
    it('updates currentQuantity and logs difference event', async () => {
      const created = await createBatch({
        variety: 'Keo lai BV16',
        initialQuantity: 50000
      })
      const batchId = created.batch!.id

      // Physical inventory counts 45.200 living trees
      const result = await updateBatchInventory({
        batchId,
        newQuantity: 45200,
        note: 'Đảo bầu đợt 1, loại bỏ cây chết'
      })

      expect(result.success).toBe(true)
      expect(result.previousQuantity).toBe(50000)
      expect(result.difference).toBe(-4800)
      expect(result.batch?.currentQuantity).toBe(45200)

      // Verify persisted
      const batch = await batchRepository.getById(batchId)
      expect(batch?.currentQuantity).toBe(45200)

      // Verify undo registered
      const lastMutation = undoService.getLastMutation()
      expect(lastMutation?.type).toBe('update_inventory')
      if (lastMutation?.type === 'update_inventory') {
        expect(lastMutation.previousQuantity).toBe(50000)
      }
    })

    it('rejects update if newQuantity > initialQuantity', async () => {
      const created = await createBatch({
        variety: 'Keo lai AH1',
        initialQuantity: 30000
      })
      const batchId = created.batch!.id

      const result = await updateBatchInventory({
        batchId,
        newQuantity: 35000
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('không thể lớn hơn số lượng cắm hom ban đầu')
    })

    it('rejects update if newQuantity < readyQuantity', async () => {
      const created = await createBatch({
        variety: 'Keo lai AH1',
        initialQuantity: 30000
      })
      const batch = created.batch!
      batch.readyQuantity = 20000
      await batchRepository.save(batch)

      const result = await updateBatchInventory({
        batchId: batch.id,
        newQuantity: 15000
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('không thể thấp hơn số cây đang được tính là đủ bán')
    })

    it('marks batch as depleted when newQuantity is 0', async () => {
      const created = await createBatch({
        variety: 'Keo lai BV16',
        initialQuantity: 10000
      })
      const batchId = created.batch!.id

      const result = await updateBatchInventory({
        batchId,
        newQuantity: 0,
        note: 'Cây chết toàn bộ do ngập úng'
      })

      expect(result.success).toBe(true)
      expect(result.batch?.status).toBe('depleted')
    })

    // Scenario E: Atomic inventory correction when living < ready
    it('Scenario E: requires confirmation when living < ready and commits atomically when provided', async () => {
      const created = await createBatch({
        variety: 'Keo lai BV16',
        initialQuantity: 50000
      })
      const batch = created.batch!
      // Set living=45.200, ready=32.000
      await updateBatchInventory({ batchId: batch.id, newQuantity: 45200 })
      await updateBatchReadyQuantity({ batchId: batch.id, newReadyQuantity: 32000 })

      // 1. User checks inventory: living = 28.000 without newReadyQuantity -> rejected
      const failResult = await updateBatchInventory({
        batchId: batch.id,
        newQuantity: 28000
      })
      expect(failResult.success).toBe(false)
      expect(failResult.error).toContain('không thể thấp hơn số cây đang được tính là đủ bán')

      // 2. User tries newReadyQuantity > newLiving (29.000 > 28.000) -> rejected
      const failReadyResult = await updateBatchInventory({
        batchId: batch.id,
        newQuantity: 28000,
        newReadyQuantity: 29000
      })
      expect(failReadyResult.success).toBe(false)
      expect(failReadyResult.error).toContain('không thể lớn hơn số cây còn sống')

      // 3. User enters living = 28.000 and confirmed ready = 27.000 -> committed atomically
      const successResult = await updateBatchInventory({
        batchId: batch.id,
        newQuantity: 28000,
        newReadyQuantity: 27000,
        note: 'Kiểm kê sau đợt bão'
      })
      expect(successResult.success).toBe(true)
      expect(successResult.batch?.currentQuantity).toBe(28000)
      expect(successResult.batch?.readyQuantity).toBe(27000)
      expect(successResult.batch?.status).toBe('ready')

      // Verify persisted
      const saved = await batchRepository.getById(batch.id)
      expect(saved?.currentQuantity).toBe(28000)
      expect(saved?.readyQuantity).toBe(27000)

      // Verify events recorded
      const events = await eventRepository.getAll()
      const invEvent = events.find((e) => e.type === 'batch_inventory_updated' && e.entityId === batch.id)
      expect(invEvent).toBeDefined()
      const readyEvent = events.find((e) => e.type === 'batch_ready_stock_updated' && e.entityId === batch.id)
      expect(readyEvent).toBeDefined()
    })
  })

  describe('updateBatchReadyQuantity', () => {
    // Scenario A: Propagating -> partial ready increase
    it('Scenario A: supports partial ready increase from 0, updates status to ready', async () => {
      const created = await createBatch({
        variety: 'Keo lai BV16',
        initialQuantity: 45200
      })
      const batch = created.batch!
      expect(batch.readyQuantity).toBe(0)
      expect(batch.status).toBe('propagating')

      // Update ready partially to 10.000
      const result = await updateBatchReadyQuantity({
        batchId: batch.id,
        newReadyQuantity: 10000,
        note: 'Lứa đầu đạt chuẩn'
      })

      expect(result.success).toBe(true)
      expect(result.batch?.readyQuantity).toBe(10000)
      expect(result.batch?.status).toBe('ready')
      expect(result.previousReadyQuantity).toBe(0)
      expect(result.difference).toBe(10000)

      // Available quantity is 10.000
      expect(availableQuantityForBatch(result.batch!, [])).toBe(10000)
    })

    // Scenario B: Progressive ready increase
    it('Scenario B: allows progressive ready quantity increases (10k -> 25k -> 32k)', async () => {
      const created = await createBatch({
        variety: 'Keo lai BV16',
        initialQuantity: 45200
      })
      const batch = created.batch!

      await updateBatchReadyQuantity({ batchId: batch.id, newReadyQuantity: 10000 })
      const step2 = await updateBatchReadyQuantity({ batchId: batch.id, newReadyQuantity: 25000 })
      expect(step2.success).toBe(true)
      expect(step2.batch?.readyQuantity).toBe(25000)
      expect(step2.difference).toBe(15000)

      const step3 = await updateBatchReadyQuantity({ batchId: batch.id, newReadyQuantity: 32000 })
      expect(step3.success).toBe(true)
      expect(step3.batch?.readyQuantity).toBe(32000)
      expect(step3.difference).toBe(7000)
    })

    // Scenario C: Decrease ready below reserved allows commitment shortage to surface
    it('Scenario C: allows decreasing ready below reservations without blocking (reveals shortage)', async () => {
      const created = await createBatch({
        variety: 'Keo lai BV16',
        initialQuantity: 30000
      })
      const batch = created.batch!

      // Batch ready = 20.000
      await updateBatchReadyQuantity({ batchId: batch.id, newReadyQuantity: 20000 })

      // Active reservation of 18.000
      const reservations: Reservation[] = [
        {
          id: 'res_c',
          orderId: 'ord_c',
          sourceType: 'own_batch',
          batchId: batch.id,
          quantity: 18000,
          status: 'active',
          createdAt: new Date().toISOString()
        }
      ]

      // Culling / mortality reduces ready to 15.000 (< 18.000 reserved)
      const result = await updateBatchReadyQuantity({
        batchId: batch.id,
        newReadyQuantity: 15000,
        note: 'Loại 5.000 cây bị sâu ngọn'
      })

      expect(result.success).toBe(true)
      expect(result.batch?.readyQuantity).toBe(15000)

      // Invariants check: available = 0, shortage = 3.000
      expect(availableQuantityForBatch(result.batch!, reservations)).toBe(0)
      expect(commitmentShortageForBatch(result.batch!, reservations)).toBe(3000)
    })

    // Scenario D: Reject update ready > living or < 0
    it('Scenario D: rejects newReadyQuantity > currentQuantity or < 0', async () => {
      const created = await createBatch({
        variety: 'Keo lai BV16',
        initialQuantity: 45000
      })
      const batch = created.batch!

      // Try ready = 50.000 > living (45.000)
      const overResult = await updateBatchReadyQuantity({
        batchId: batch.id,
        newReadyQuantity: 50000
      })
      expect(overResult.success).toBe(false)
      expect(overResult.error).toContain('không thể lớn hơn số cây còn sống')

      // Try ready < 0
      const negativeResult = await updateBatchReadyQuantity({
        batchId: batch.id,
        newReadyQuantity: -100
      })
      expect(negativeResult.success).toBe(false)
      expect(negativeResult.error).toContain('không thể âm')
    })

    // Scenario H: Undo restores previous readyQuantity and derived status
    it('Scenario H: supports undo for updateBatchReadyQuantity', async () => {
      const created = await createBatch({
        variety: 'Keo lai BV16',
        initialQuantity: 40000
      })
      const batch = created.batch!

      // Update ready to 15.000
      await updateBatchReadyQuantity({ batchId: batch.id, newReadyQuantity: 15000 })
      let current = await batchRepository.getById(batch.id)
      expect(current?.readyQuantity).toBe(15000)
      expect(current?.status).toBe('ready')

      // Perform undo
      const undoRes = await undoService.undoLastMutation()
      expect(undoRes.success).toBe(true)
      expect(undoRes.revertedType).toBe('update_ready_quantity')

      // Verified restored to 0, status restored to propagating
      current = await batchRepository.getById(batch.id)
      expect(current?.readyQuantity).toBe(0)
      expect(current?.status).toBe('propagating')
    })

    // Scenario I: Intervening mutation prevents undo and protects stock from resurrection
    it('Scenario I: rejects undo if batch was modified after updateBatchReadyQuantity', async () => {
      const created = await createBatch({
        variety: 'Keo lai BV16',
        initialQuantity: 30000
      })
      const batch = created.batch!

      // 1. Update ready to 20.000
      await updateBatchReadyQuantity({ batchId: batch.id, newReadyQuantity: 20000 })

      // 2. Intervening mutation: simulate a shipment or inventory check that reduced stock
      const intermediate = (await batchRepository.getById(batch.id))!
      intermediate.currentQuantity = 20000
      intermediate.readyQuantity = 5000
      await batchRepository.save(intermediate)

      // 3. Attempt undo: must be safely rejected
      const undoRes = await undoService.undoLastMutation()
      expect(undoRes.success).toBe(false)
      expect(undoRes.message).toBe('Không thể hoàn tác vì lô đã thay đổi sau thao tác này.')

      // 4. Stock must NOT be resurrected
      const finalBatch = await batchRepository.getById(batch.id)
      expect(finalBatch?.currentQuantity).toBe(20000)
      expect(finalBatch?.readyQuantity).toBe(5000)
    })

    // Scenario J: Consecutive and interleaved mutations do not lose updates
    it('Scenario J: consecutive and interleaved mutations do not lose updates', async () => {
      const created = await createBatch({
        variety: 'Keo lai BV16',
        initialQuantity: 50000
      })
      const batchId = created.batch!.id

      // Mutation 1: Update ready quantity to 20.000
      const res1 = await updateBatchReadyQuantity({ batchId, newReadyQuantity: 20000 })
      expect(res1.success).toBe(true)

      // Mutation 2: Inventory check reports 48.000 living, keeping ready at 20.000
      const res2 = await updateBatchInventory({
        batchId,
        newQuantity: 48000,
        newReadyQuantity: 20000
      })
      expect(res2.success).toBe(true)

      // Verify persisted state has both updates
      const finalBatch = await batchRepository.getById(batchId)
      expect(finalBatch?.currentQuantity).toBe(48000)
      expect(finalBatch?.readyQuantity).toBe(20000)
      expect(finalBatch?.status).toBe('ready')
    })

    // Scenario K: Intervening shipment is not overwritten by inventory update or Undo
    it('Scenario K: intervening shipment is not overwritten by inventory update or Undo', async () => {
      const created = await createBatch({
        variety: 'Keo lai BV16',
        initialQuantity: 40000
      })
      const batchId = created.batch!.id

      // 1. Set ready quantity to 25.000 (Undo recorded expecting current=40.000, ready=25.000)
      await updateBatchReadyQuantity({ batchId, newReadyQuantity: 25000 })

      // 2. Interleaved shipment occurs transactionally: reduces physical current to 25.000 and ready to 10.000
      await db.transaction('rw', [db.batches, db.events], async () => {
        const b = (await db.batches.get(batchId))!
        b.currentQuantity = 25000
        b.readyQuantity = 10000
        b.status = 'ready'
        await db.batches.put(b)
      })

      // 3. Inventory update attempts to set living to 20.000 without newReadyQuantity:
      // It validates against REAL post-shipment persisted state (ready=10.000), not the pre-shipment state (ready=25.000)!
      // Since living (20.000) >= real ready (10.000), this succeeds without forcing user to lower ready below 20.000!
      const invRes = await updateBatchInventory({ batchId, newQuantity: 20000 })
      expect(invRes.success).toBe(true)
      expect(invRes.batch?.currentQuantity).toBe(20000)
      expect(invRes.batch?.readyQuantity).toBe(10000) // Preserved shipment ready quantity

      // 4. Stale Undo from step 1 attempts to run:
      // Must be rejected because batch quantities changed, protecting shipment stock from resurrection
      undoService.recordMutation({
        type: 'update_ready_quantity',
        batchId,
        batchCode: 'BV16 #01',
        previousReadyQuantity: 0,
        expectedReadyQuantity: 25000,
        expectedCurrentQuantity: 40000,
        description: 'Stale mutation'
      })
      const staleUndoRes = await undoService.undoLastMutation()
      expect(staleUndoRes.success).toBe(false)
      expect(staleUndoRes.message).toBe('Không thể hoàn tác vì lô đã thay đổi sau thao tác này.')

      // Verify stock remains current=20.000, ready=10.000
      const finalBatch = await batchRepository.getById(batchId)
      expect(finalBatch?.currentQuantity).toBe(20000)
      expect(finalBatch?.readyQuantity).toBe(10000)
    })

    // Scenario L: NaN / Infinity rejected and data kept intact
    it('Scenario L: explicitly rejects NaN and Infinity on boundary and preserves data', async () => {
      // 1. createBatch rejects NaN and Infinity
      const nanCreate = await createBatch({
        variety: 'Keo lai BV16',
        initialQuantity: NaN
      })
      expect(nanCreate.success).toBe(false)
      expect(nanCreate.error).toContain('lớn hơn 0')

      const infCreate = await createBatch({
        variety: 'Keo lai BV16',
        initialQuantity: Infinity
      })
      expect(infCreate.success).toBe(false)
      expect(infCreate.error).toContain('lớn hơn 0')

      // Create valid batch
      const created = await createBatch({
        variety: 'Keo lai BV16',
        initialQuantity: 30000
      })
      const batchId = created.batch!.id

      // 2. updateBatchInventory rejects NaN and Infinity
      const nanInv = await updateBatchInventory({
        batchId,
        newQuantity: NaN
      })
      expect(nanInv.success).toBe(false)
      expect(nanInv.error).toContain('không thể âm')

      const infInv = await updateBatchInventory({
        batchId,
        newQuantity: Infinity
      })
      expect(infInv.success).toBe(false)
      expect(infInv.error).toContain('không thể âm')

      const nanReadyInv = await updateBatchInventory({
        batchId,
        newQuantity: 25000,
        newReadyQuantity: NaN
      })
      expect(nanReadyInv.success).toBe(false)
      expect(nanReadyInv.error).toContain('không thể âm')

      // 3. updateBatchReadyQuantity rejects NaN and Infinity
      const nanReady = await updateBatchReadyQuantity({
        batchId,
        newReadyQuantity: NaN
      })
      expect(nanReady.success).toBe(false)
      expect(nanReady.error).toContain('không thể âm')

      const infReady = await updateBatchReadyQuantity({
        batchId,
        newReadyQuantity: Infinity
      })
      expect(infReady.success).toBe(false)
      expect(infReady.error).toContain('không thể âm')

      // Verify batch remains completely intact
      const intact = await batchRepository.getById(batchId)
      expect(intact?.currentQuantity).toBe(30000)
      expect(intact?.readyQuantity).toBe(0)
    })

    // Scenario M: Batch with current=0 derives depleted ("Đã hết")
    it('Scenario M: derives status as depleted ("Đã hết") when current reaches 0', async () => {
      const created = await createBatch({
        variety: 'Keo lai BV16',
        initialQuantity: 10000
      })
      const batchId = created.batch!.id

      // Inventory check reports 0 living trees (e.g. all dead or culled)
      const result = await updateBatchInventory({
        batchId,
        newQuantity: 0,
        newReadyQuantity: 0
      })
      expect(result.success).toBe(true)
      expect(result.batch?.status).toBe('depleted')

      const reloaded = (await batchRepository.getById(batchId))!
      expect(deriveBatchStatus(reloaded)).toBe('depleted')
      expect(getBatchDisplayStatus(reloaded, false)).toBe('Đã hết')
    })
  })
})
