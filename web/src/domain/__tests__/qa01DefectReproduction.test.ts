import { describe, it, expect } from 'vitest'
import { parseQuantity } from '../quantity'
import { parseUnitPrice, MAX_UNIT_PRICE } from '../price'
import { isValidCalendarDate, parseDateToIso, isValidRequestedDate } from '../date'
import { arePhonesEqual } from '../phone'
import { MAX_CONTACT_NAME_LENGTH } from '../contact'
import { DexieContactRepository } from '../../data/repositories/contact.repository'
import { VuonUomDatabase } from '../../data/db'
import 'fake-indexeddb/auto'

describe('QA-01 Defect Reproduction & Proof of Fix', () => {
  describe('Defect 1: parseQuantity must reject fractional trees instead of rounding', () => {
    it('verifies that fractional vạn amounts are now strictly rejected as null', () => {
      // 4.52345 vạn = 45,234.5 cây (fractional tree)
      // Pre-fix bug: returned 45235 via Math.round()
      // Post-fix contract: returns null
      expect(parseQuantity('4,52345 vạn')).toBeNull()

      // 0.00001 vạn = 0.1 cây (fractional tree)
      // Pre-fix bug: returned 0 via Math.round()
      // Post-fix contract: returns null
      expect(parseQuantity('0,00001 vạn')).toBeNull()

      // Float 3.5 without unit
      // Pre-fix bug: returned 4 via Math.round()
      // Post-fix contract: returns null
      expect(parseQuantity(3.5)).toBeNull()
    })
  })

  describe('Defect 2: contactRepository findByPhone must match +84 with 09xx', () => {
    it('verifies findByPhone matches +84912345678 with existing 0912345678 contact', async () => {
      const testDb = new VuonUomDatabase(`test_db_${Date.now()}`)
      const repo = new DexieContactRepository(testDb)

      await testDb.contacts.put({
        id: 'c1',
        name: 'Anh Hùng',
        phone: '0912345678',
        roles: ['customer']
      })

      // Pre-fix bug: findByPhone('+84912345678') returned null
      // Post-fix contract: findByPhone recognizes +84 as matching 0912345678
      const foundWithPlus84 = await repo.findByPhone('+84912345678')
      expect(foundWithPlus84).not.toBeNull()
      expect(foundWithPlus84?.id).toBe('c1')
      expect(foundWithPlus84?.name).toBe('Anh Hùng')

      // Also matches formatted '+84 912 345 678'
      const foundFormatted = await repo.findByPhone('+84 912 345 678')
      expect(foundFormatted?.id).toBe('c1')

      await testDb.delete()
    })
  })

  describe('Defect 3: Naive replace(/\\D/g, "") mutates invalid price abc1200 to 1200', () => {
    it('verifies parseUnitPrice rejects invalid price strings instead of silently mutating them', () => {
      const naiveParse = (raw: string) => raw.trim() ? parseFloat(raw.replace(/\D/g, '')) : undefined

      // Naive implementation mutates "abc1200" to 1200
      expect(naiveParse('abc1200')).toBe(1200)

      // Contract-driven parseUnitPrice strictly rejects "abc1200"
      expect(parseUnitPrice('abc1200').valid).toBe(false)
      expect(parseUnitPrice('-1200').valid).toBe(false)
    })
  })

  describe('Defect 4: new Date calendar roll-over and RangeError', () => {
    it('verifies isValidCalendarDate and parseDateToIso catch calendar invalidity and empty strings', () => {
      // Raw Date rolls over 2026-02-31 to March 3
      const rollOver = new Date('2026-02-31').toISOString().slice(0, 10)
      expect(rollOver).toBe('2026-03-03')

      // Contract-driven functions reject Feb 31st
      expect(isValidCalendarDate('2026-02-31')).toBe(false)
      expect(parseDateToIso('2026-02-31')).toBeNull()

      // Raw Date crashes on empty string
      expect(() => new Date('').toISOString()).toThrow(RangeError)

      // Contract-driven parseDateToIso safely returns null without throwing
      expect(parseDateToIso('')).toBeNull()
    })
  })

  describe('Defect 5: Naive replace(/\\D/g, "") in phone equality falsely matched "0912abc" with "0912"', () => {
    it('verifies arePhonesEqual does not strip letters and falsely match', () => {
      const naiveStripEqual = (a: string, b: string) => a.replace(/\D/g, '') === b.replace(/\D/g, '')

      // Naive implementation falsely considers "0912abc" and "0912" equal
      expect(naiveStripEqual('0912abc', '0912')).toBe(true)

      // Strict arePhonesEqual rejects false match
      expect(arePhonesEqual('0912abc', '0912')).toBe(false)
    })
  })

  describe('Defect 6: Slicing date prefix .slice(0, 10) silently accepts trailing malformed characters', () => {
    it('verifies isValidRequestedDate strictly rejects dates with trailing characters like "2026-10-12abc"', () => {
      const naiveSlice = (str: string) => str.slice(0, 10)

      // Naive slice truncates "2026-10-12abc" to "2026-10-12"
      expect(naiveSlice('2026-10-12abc')).toBe('2026-10-12')

      // Strict isValidRequestedDate rejects trailing garbage
      expect(isValidRequestedDate('2026-10-12abc')).toBe(false)
      expect(isValidRequestedDate('2026-10-12')).toBe(true)
      expect(isValidRequestedDate('2026-10-12T00:00:00.000Z')).toBe(true)
    })
  })

  describe('Defect 7: Unbounded price without cap allows unrealistic billions per seedling', () => {
    it('verifies MAX_UNIT_PRICE cap of 1,000,000,000 VNĐ is enforced', () => {
      expect(MAX_UNIT_PRICE).toBe(1_000_000_000)
      expect(parseUnitPrice(1_000_000_000).valid).toBe(true)
      expect(parseUnitPrice(1_000_000_001).valid).toBe(false)
    })
  })

  describe('Defect 8: Unbounded contact name allows arbitrary long strings', () => {
    it('verifies MAX_CONTACT_NAME_LENGTH is set to 100 characters', () => {
      expect(MAX_CONTACT_NAME_LENGTH).toBe(100)
    })
  })
})
