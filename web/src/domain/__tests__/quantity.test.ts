import { describe, it, expect } from 'vitest'
import {
  parseQuantity,
  reservedQuantityForBatch,
  availableQuantityForBatch,
  survivalRate,
  formatQuantity,
  formatSurvivalRate
} from '../quantity'
import type { Batch } from '../batch'
import type { Reservation } from '../reservation'

describe('Quantity Parser Foundation', () => {
  it('parses standard integer strings and numbers', () => {
    expect(parseQuantity('30000')).toBe(30000)
    expect(parseQuantity(30000)).toBe(30000)
    expect(parseQuantity('0')).toBe(0)
    expect(parseQuantity(0)).toBe(0)
  })

  it('parses dot thousand separator (Vietnamese standard)', () => {
    expect(parseQuantity('30.000')).toBe(30000)
    expect(parseQuantity('1.500.000')).toBe(1500000)
  })

  it('parses comma thousand separator', () => {
    expect(parseQuantity('30,000')).toBe(30000)
    expect(parseQuantity('1,500,000')).toBe(1500000)
  })

  it('parses "vạn" notation (1 vạn = 10,000 cây)', () => {
    expect(parseQuantity('3 vạn')).toBe(30000)
    expect(parseQuantity('3v')).toBe(30000)
    expect(parseQuantity('3V')).toBe(30000)
    expect(parseQuantity('4,52 vạn')).toBe(45200)
    expect(parseQuantity('4.52 vạn')).toBe(45200)
    expect(parseQuantity('4,52v')).toBe(45200)
    expect(parseQuantity('0,5 vạn')).toBe(5000)
  })

  it('handles whitespace gracefully', () => {
    expect(parseQuantity('  30.000  ')).toBe(30000)
    expect(parseQuantity('  4,52 vạn  ')).toBe(45200)
  })

  it('returns null for invalid inputs', () => {
    expect(parseQuantity('')).toBeNull()
    expect(parseQuantity('   ')).toBeNull()
    expect(parseQuantity(null)).toBeNull()
    expect(parseQuantity(undefined)).toBeNull()
    expect(parseQuantity('abc')).toBeNull()
    expect(parseQuantity('-100')).toBeNull()
    expect(parseQuantity(NaN)).toBeNull()
  })
})

describe('Derived Quantity Domain Functions', () => {
  const dummyBatch: Batch = {
    id: 'batch_1',
    code: 'BV16 #12',
    variety: 'Keo lai BV16',
    createdAt: '2026-01-01T00:00:00.000Z',
    initialQuantity: 50000,
    currentQuantity: 45200,
    readyQuantity: 32000,
    status: 'ready'
  }

  const dummyReservations: Reservation[] = [
    {
      id: 'res_1',
      orderId: 'ord_1',
      sourceType: 'own_batch',
      batchId: 'batch_1',
      quantity: 10000,
      status: 'active',
      createdAt: '2026-01-02T00:00:00.000Z'
    },
    {
      id: 'res_2',
      orderId: 'ord_2',
      sourceType: 'own_batch',
      batchId: 'batch_1',
      quantity: 2000,
      status: 'released', // released should NOT count
      createdAt: '2026-01-02T00:00:00.000Z'
    },
    {
      id: 'res_3',
      orderId: 'ord_3',
      sourceType: 'own_batch',
      batchId: 'other_batch', // different batch
      quantity: 5000,
      status: 'active',
      createdAt: '2026-01-02T00:00:00.000Z'
    }
  ]

  it('calculates reservedQuantityForBatch correctly', () => {
    const reserved = reservedQuantityForBatch('batch_1', dummyReservations)
    expect(reserved).toBe(10000)
  })

  it('calculates availableQuantityForBatch correctly (readyQuantity - reserved)', () => {
    const available = availableQuantityForBatch(dummyBatch, dummyReservations)
    // readyQuantity = 32000, reserved = 10000 => available = 22000
    expect(available).toBe(22000)
  })

  it('clamps available quantity to 0 when reservations exceed readyQuantity', () => {
    const overReservedBatch: Batch = {
      ...dummyBatch,
      readyQuantity: 8000
    }
    const available = availableQuantityForBatch(overReservedBatch, dummyReservations)
    expect(available).toBe(0)
  })

  it('calculates survival rate correctly', () => {
    // 45200 / 50000 = 0.904
    const rate = survivalRate(dummyBatch.currentQuantity, dummyBatch.initialQuantity)
    expect(rate).toBeCloseTo(0.904, 3)
    expect(formatSurvivalRate(rate)).toBe('90%')
  })

  it('handles division by zero for survival rate', () => {
    expect(survivalRate(100, 0)).toBe(0)
    expect(survivalRate(0, 0)).toBe(0)
  })

  it('formats quantity with Vietnamese thousand separators', () => {
    expect(formatQuantity(45200)).toBe('45.200')
    expect(formatQuantity(1000)).toBe('1.000')
  })
})
