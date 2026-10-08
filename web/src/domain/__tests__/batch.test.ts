import { describe, it, expect } from 'vitest'
import type { Batch } from '../batch'
import {
  isBatchAttention,
  getBatchDisplayStatus,
  deriveBatchStatus,
  sortBatchesForDisplay,
  filterBatches,
  type BatchWithAvailability
} from '../batch'

describe('Domain: Batch calculations & filters', () => {
  const createMockBatch = (overrides: Partial<Batch>): Batch => {
    const current = overrides.currentQuantity ?? (overrides.status === 'depleted' ? 0 : 9500)
    const ready =
      overrides.readyQuantity ??
      (overrides.status === 'propagating' || overrides.status === 'nearly_ready' || overrides.status === 'depleted'
        ? 0
        : 9000)
    return {
      id: 'test_batch_1',
      code: 'TEST #01',
      variety: 'Keo lai BV16',
      initialQuantity: 10000,
      currentQuantity: current,
      readyQuantity: ready,
      status: 'ready',
      createdAt: '2026-06-01',
      ...overrides
    }
  }

  describe('isBatchAttention', () => {
    it('returns true if batch is ready and preferredSellBefore is within 14 days', () => {
      const now = new Date()
      const closeDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString()
      const batch = createMockBatch({
        readyQuantity: 9000,
        preferredSellBefore: closeDate
      })
      expect(isBatchAttention(batch, now)).toBe(true)
    })

    it('returns false if batch is ready but preferredSellBefore is far away (> 14 days)', () => {
      const now = new Date()
      const farDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const batch = createMockBatch({
        readyQuantity: 9000,
        preferredSellBefore: farDate
      })
      expect(isBatchAttention(batch, now)).toBe(false)
    })

    it('returns false if batch is not ready (readyQuantity = 0) even if preferredSellBefore is close', () => {
      const now = new Date()
      const closeDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
      const batch = createMockBatch({
        status: 'nearly_ready',
        readyQuantity: 0,
        preferredSellBefore: closeDate
      })
      expect(isBatchAttention(batch, now)).toBe(false)
    })

    it('returns false if batch has no preferredSellBefore', () => {
      const batch = createMockBatch({
        readyQuantity: 9000,
        preferredSellBefore: undefined
      })
      expect(isBatchAttention(batch)).toBe(false)
    })
  })

  describe('getBatchDisplayStatus', () => {
    it('returns correct Vietnamese terminology based on derived status', () => {
      const readyBatch = createMockBatch({ currentQuantity: 9500, readyQuantity: 9000 })
      expect(getBatchDisplayStatus(readyBatch, false)).toBe('Đang bán')
      expect(getBatchDisplayStatus(readyBatch, true)).toBe('Sắp quá lứa')

      const propagatingBatch = createMockBatch({ currentQuantity: 9500, readyQuantity: 0 })
      expect(getBatchDisplayStatus(propagatingBatch, false)).toBe('Đang ươm')

      const depletedBatch = createMockBatch({ currentQuantity: 0, readyQuantity: 0 })
      expect(getBatchDisplayStatus(depletedBatch, false)).toBe('Đã hết')
    })

    it('derives legacy batch with status nearly_ready and ready=0 as "Đang ươm" (propagating)', () => {
      const demoBatch = createMockBatch({
        code: 'AH1 #07',
        currentQuantity: 30100,
        readyQuantity: 0,
        status: 'nearly_ready' as any
      })
      expect(deriveBatchStatus(demoBatch)).toBe('propagating')
      expect(getBatchDisplayStatus(demoBatch, false)).toBe('Đang ươm')
    })

    it('derives legacy batch with status propagating but ready > 0 as "Đang bán" (ready)', () => {
      const legacyBatch = createMockBatch({
        code: 'LEGACY #01',
        currentQuantity: 10000,
        readyQuantity: 5000,
        status: 'propagating' as any
      })
      expect(deriveBatchStatus(legacyBatch)).toBe('ready')
      expect(getBatchDisplayStatus(legacyBatch, false)).toBe('Đang bán')
    })
  })

  describe('sortBatchesForDisplay', () => {
    it('sorts attention batches first, followed by ready, propagating, depleted', () => {
      const batches: BatchWithAvailability[] = [
        {
          ...createMockBatch({ id: '1', code: 'B1', currentQuantity: 9500, readyQuantity: 0 }),
          reservedQuantity: 0,
          availableQuantity: 0,
          isAttention: false
        },
        {
          ...createMockBatch({ id: '2', code: 'B2', currentQuantity: 9500, readyQuantity: 5000 }),
          reservedQuantity: 0,
          availableQuantity: 5000,
          isAttention: false
        },
        {
          ...createMockBatch({ id: '3', code: 'B3', currentQuantity: 9500, readyQuantity: 3000 }),
          reservedQuantity: 0,
          availableQuantity: 3000,
          isAttention: true // attention should be first!
        },
        {
          ...createMockBatch({ id: '4', code: 'B4', currentQuantity: 0, readyQuantity: 0 }),
          reservedQuantity: 0,
          availableQuantity: 0,
          isAttention: false
        }
      ]

      const sorted = sortBatchesForDisplay(batches)
      expect(sorted.map((b) => b.id)).toEqual(['3', '2', '1', '4'])
    })
  })

  describe('filterBatches', () => {
    const batches: BatchWithAvailability[] = [
      {
        ...createMockBatch({ id: '1', currentQuantity: 9500, readyQuantity: 5000 }),
        reservedQuantity: 0,
        availableQuantity: 5000,
        isAttention: false
      },
      {
        ...createMockBatch({ id: '2', currentQuantity: 9500, readyQuantity: 3000 }),
        reservedQuantity: 0,
        availableQuantity: 3000,
        isAttention: true
      },
      {
        ...createMockBatch({ id: '3', currentQuantity: 9500, readyQuantity: 0, status: 'nearly_ready' as any }),
        reservedQuantity: 0,
        availableQuantity: 0,
        isAttention: false
      },
      {
        ...createMockBatch({ id: '4', currentQuantity: 0, readyQuantity: 0 }),
        reservedQuantity: 0,
        availableQuantity: 0,
        isAttention: false
      }
    ]

    it('filters all', () => {
      expect(filterBatches(batches, 'all')).toHaveLength(4)
    })

    it('filters ready', () => {
      const filtered = filterBatches(batches, 'ready')
      expect(filtered).toHaveLength(2)
      expect(filtered.map((b) => b.id)).toEqual(['1', '2'])
    })

    it('filters attention', () => {
      const filtered = filterBatches(batches, 'attention')
      expect(filtered).toHaveLength(1)
      expect(filtered[0]?.id).toBe('2')
    })

    it('filters propagating/nurturing', () => {
      const filtered = filterBatches(batches, 'propagating')
      expect(filtered).toHaveLength(1)
      expect(filtered[0]?.id).toBe('3')
    })
  })

  describe('deriveBatchStatus', () => {
    it('returns depleted when currentQuantity is 0 or negative', () => {
      expect(deriveBatchStatus({ currentQuantity: 0, readyQuantity: 0 })).toBe('depleted')
      expect(deriveBatchStatus({ currentQuantity: -5, readyQuantity: 0 })).toBe('depleted')
      expect(deriveBatchStatus({ currentQuantity: 0, readyQuantity: 100 })).toBe('depleted')
    })

    it('returns ready when currentQuantity > 0 and readyQuantity > 0', () => {
      expect(deriveBatchStatus({ currentQuantity: 10000, readyQuantity: 5000 })).toBe('ready')
      expect(deriveBatchStatus({ currentQuantity: 10000, readyQuantity: 10000 })).toBe('ready')
    })

    it('returns propagating when currentQuantity > 0 and readyQuantity === 0', () => {
      expect(deriveBatchStatus({ currentQuantity: 10000, readyQuantity: 0 })).toBe('propagating')
    })
  })
})
