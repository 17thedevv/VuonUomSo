import { describe, it, expect } from 'vitest'
import { parseQuantity } from '../quantity'
import { parseUnitPrice } from '../price'
import { isValidCalendarDate, parseDateToIso } from '../date'
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
})
