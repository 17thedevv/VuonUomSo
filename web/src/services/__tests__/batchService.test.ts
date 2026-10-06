import { describe, it, expect, beforeEach } from 'vitest'
import {
  extractVarietyPrefix,
  generateBatchCode,
  createBatch,
  updateBatchInventory
} from '../batchService'
import { batchRepository, eventRepository } from '../../data/repositories'
import { clearAllData } from '../../data/seed'
import { undoService } from '../undoService'
import type { Batch } from '../../domain/batch'

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
  })
})
