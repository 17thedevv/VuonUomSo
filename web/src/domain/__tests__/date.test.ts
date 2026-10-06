import { describe, it, expect } from 'vitest'
import {
  formatShortDate,
  formatHeaderDate,
  isBatchOverageAttention,
  OVERAGE_ATTENTION_DAYS
} from '../date'

describe('Domain: Date utilities', () => {
  it('formats short dates correctly (DD/MM and DD/MM/YYYY)', () => {
    const iso = '2026-10-15T00:00:00.000Z'
    expect(formatShortDate(iso, false)).toBe('15/10')
    expect(formatShortDate(iso, true)).toBe('15/10/2026')
    expect(formatShortDate('', false)).toBe('')
    expect(formatShortDate('invalid-date', false)).toBe('')
  })

  it('formats header date in Vietnamese format', () => {
    const fixedDate = new Date('2026-10-06T10:00:00')
    const headerStr = formatHeaderDate(fixedDate)
    expect(headerStr).toContain('06/10')
    expect(headerStr.startsWith('Thứ') || headerStr.startsWith('Chủ')).toBe(true)
  })

  it('calculates overage attention within 14 days', () => {
    const now = new Date()

    // 5 days in the future (within 14 days threshold) -> attention = true
    const in5Days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString()
    expect(isBatchOverageAttention(in5Days, now)).toBe(true)

    // 2 days in the past (overdue / quá tuổi) -> attention = true
    const past2Days = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    expect(isBatchOverageAttention(past2Days, now)).toBe(true)

    // 25 days in the future (> 14 days) -> attention = false
    const in25Days = new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000).toISOString()
    expect(isBatchOverageAttention(in25Days, now)).toBe(false)

    // undefined / null -> false
    expect(isBatchOverageAttention(undefined, now)).toBe(false)
  })

  it('verifies OVERAGE_ATTENTION_DAYS constant equals 14', () => {
    expect(OVERAGE_ATTENTION_DAYS).toBe(14)
  })
})
