import { describe, it, expect } from 'vitest'
import type { BatchWithAvailability } from '../batch'
import {
  filterBatchCandidatesForOrder,
  sortBatchCandidatesForReservation,
  validateReservationQuantity,
  validateBatchAvailability,
  validateOrderShortage
} from '../reservation'
import { DEFAULT_SUPPLIER_CATALOG } from '../../data/demo/supplierCatalog'

describe('Domain: Reservation logic & helpers', () => {
  const createMockBatch = (overrides: Partial<BatchWithAvailability>): BatchWithAvailability => ({
    id: 'batch_1',
    code: 'BV16 #01',
    variety: 'Keo lai BV16',
    createdAt: '2026-09-01T00:00:00.000Z',
    initialQuantity: 50000,
    currentQuantity: 45000,
    readyQuantity: 30000,
    reservedQuantity: 10000,
    availableQuantity: 20000,
    isAttention: false,
    status: 'ready',
    ...overrides
  })

  describe('filterBatchCandidatesForOrder', () => {
    it('filters batches to matching variety and available > 0 regardless of stored batch.status', () => {
      const batches: BatchWithAvailability[] = [
        createMockBatch({ id: '1', variety: 'Keo lai BV16', status: 'ready', availableQuantity: 10000 }),
        createMockBatch({ id: '2', variety: 'keo lai bv16', status: 'ready', availableQuantity: 5000 }), // case-insensitive
        createMockBatch({ id: '3', variety: 'Keo lai AH1', status: 'ready', availableQuantity: 20000 }), // wrong variety
        createMockBatch({ id: '4', variety: 'Keo lai BV16', status: 'propagating', availableQuantity: 15000 }), // propagating but has available stock -> included!
        createMockBatch({ id: '5', variety: 'Keo lai BV16', status: 'ready', availableQuantity: 0 }), // 0 available -> excluded
        createMockBatch({ id: '6', variety: 'Keo lai BV16', status: 'depleted', availableQuantity: 0 }) // depleted & 0 available -> excluded
      ]

      const candidates = filterBatchCandidatesForOrder(batches, 'Keo lai BV16')
      expect(candidates).toHaveLength(3)
      expect(candidates.map((c) => c.id)).toEqual(['1', '2', '4'])
    })
  })

  describe('sortBatchCandidatesForReservation', () => {
    it('prioritizes attention (sắp quá lứa), then preferredSellBefore, then older createdAt', () => {
      const batches: BatchWithAvailability[] = [
        createMockBatch({
          id: 'normal_newer',
          code: 'BV16 #03',
          createdAt: '2026-09-10T00:00:00.000Z',
          isAttention: false,
          availableQuantity: 20000
        }),
        createMockBatch({
          id: 'normal_older',
          code: 'BV16 #01',
          createdAt: '2026-08-01T00:00:00.000Z',
          isAttention: false,
          availableQuantity: 15000
        }),
        createMockBatch({
          id: 'attention_urgent',
          code: 'BV16 #02',
          createdAt: '2026-08-15T00:00:00.000Z',
          isAttention: true,
          preferredSellBefore: '2026-10-08',
          availableQuantity: 18000
        })
      ]

      const sorted = sortBatchCandidatesForReservation(batches)
      expect(sorted[0]?.id).toBe('attention_urgent')
      expect(sorted[1]?.id).toBe('normal_older')
      expect(sorted[2]?.id).toBe('normal_newer')
    })
  })

  describe('validateReservationQuantity', () => {
    it('accepts positive integer numbers', () => {
      expect(validateReservationQuantity(1000).valid).toBe(true)
      expect(validateReservationQuantity(50000).valid).toBe(true)
    })

    it('rejects 0, negative, NaN, fractional or non-finite numbers', () => {
      expect(validateReservationQuantity(0).valid).toBe(false)
      expect(validateReservationQuantity(-500).valid).toBe(false)
      expect(validateReservationQuantity(NaN).valid).toBe(false)
      expect(validateReservationQuantity(Infinity).valid).toBe(false)
      expect(validateReservationQuantity(1.5).valid).toBe(false)
      expect(validateReservationQuantity(10.2).valid).toBe(false)
    })
  })

  describe('validateBatchAvailability', () => {
    it('accepts quantity within batch available', () => {
      const result = validateBatchAvailability(10000, 22000, 'BV16 #12')
      expect(result.valid).toBe(true)
    })

    it('accepts exact batch available', () => {
      const result = validateBatchAvailability(22000, 22000, 'BV16 #12')
      expect(result.valid).toBe(true)
    })

    it('rejects quantity exceeding batch available with friendly message', () => {
      const result = validateBatchAvailability(25000, 22000, 'BV16 #12')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Không đủ cây trong lô này')
      expect(result.error).toContain('22.000')
      expect(result.error).toContain('25.000')
    })
  })

  describe('validateOrderShortage', () => {
    it('accepts quantity within order shortage', () => {
      const result = validateOrderShortage(10000, 20000)
      expect(result.valid).toBe(true)
    })

    it('accepts exact order shortage', () => {
      const result = validateOrderShortage(20000, 20000)
      expect(result.valid).toBe(true)
    })

    it('rejects quantity exceeding order shortage with friendly message', () => {
      const result = validateOrderShortage(25000, 20000)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Đơn này chỉ còn thiếu 20.000 cây')
    })
  })

  describe('DEFAULT_SUPPLIER_CATALOG', () => {
    it('contains reference entries for known local suppliers', () => {
      const supplierNames = DEFAULT_SUPPLIER_CATALOG.map((s) => s.supplierName)
      expect(supplierNames).toContain('Vườn Thảo')
      expect(supplierNames).toContain('Vườn Hồng')
      expect(supplierNames).toContain('Vườn An')
    })
  })
})
