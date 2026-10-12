import { describe, it, expect } from 'vitest'
import { normalizePhone, validatePhone, arePhonesEqual } from '../phone'
import { parseUnitPrice, MAX_UNIT_PRICE } from '../price'
import { parseQuantity } from '../quantity'
import { isValidCalendarDate, parseDateToIso, isValidRequestedDate, MIN_SUPPORTED_YEAR, MAX_SUPPORTED_YEAR } from '../date'
import { MAX_CONTACT_NAME_LENGTH } from '../contact'

describe('QA-01B: Pure Unit Tests — Field Contracts', () => {
  describe('Phone Contract & Normalization', () => {
    it('accepts valid Vietnamese mobile numbers across multiple standard formats and normalizes to 0xxxxxxxxx', () => {
      const validCases = [
        { raw: '0912345678', expected: '0912345678' },
        { raw: '0912 345 678', expected: '0912345678' },
        { raw: '0912.345.678', expected: '0912345678' },
        { raw: '0912-345-678', expected: '0912345678' },
        { raw: '+84912345678', expected: '0912345678' },
        { raw: '+84 912 345 678', expected: '0912345678' },
        { raw: '+84.912.345.678', expected: '0912345678' },
        { raw: '0381234567', expected: '0381234567' },
        { raw: '0561234567', expected: '0561234567' },
        { raw: '0771234567', expected: '0771234567' },
        { raw: '0881234567', expected: '0881234567' },
      ]

      for (const { raw, expected } of validCases) {
        const res = validatePhone(raw)
        expect(res.valid, `Expected "${raw}" to be valid`).toBe(true)
        expect(res.normalized).toBe(expected)
        expect(normalizePhone(raw)).toBe(expected)
      }
    })

    it('accepts Vietnamese landline numbers (02x)', () => {
      const landlineCases = [
        { raw: '02438521234', expected: '02438521234' },
        { raw: '024 3852 1234', expected: '02438521234' },
        { raw: '(024) 3852 1234', expected: '02438521234' },
        { raw: '+84 24 3852 1234', expected: '02438521234' },
        { raw: '02838521234', expected: '02838521234' },
      ]

      for (const { raw, expected } of landlineCases) {
        expect(normalizePhone(raw)).toBe(expected)
      }
    })

    it('treats empty, null, undefined or whitespace as valid optional phone with undefined normalized', () => {
      expect(validatePhone('')).toEqual({ valid: true, normalized: undefined })
      expect(validatePhone('   ')).toEqual({ valid: true, normalized: undefined })
      expect(validatePhone(undefined)).toEqual({ valid: true, normalized: undefined })
      expect(validatePhone(null)).toEqual({ valid: true, normalized: undefined })
      expect(normalizePhone('')).toBeNull()
      expect(normalizePhone('   ')).toBeNull()
      expect(normalizePhone(undefined)).toBeNull()
    })

    it('strictly rejects phone numbers with invalid characters without silently stripping them', () => {
      const invalidChars = [
        '0912abc5678',
        '0912#345678',
        '0912@345678',
        'abc',
        'sđt 0912345678',
        '0912 345 678 (vợ)',
      ]

      for (const raw of invalidChars) {
        const res = validatePhone(raw)
        expect(res.valid, `Expected "${raw}" to be rejected`).toBe(false)
        expect(res.error).toBeDefined()
        expect(normalizePhone(raw)).toBeNull()
      }
    })

    it('strictly rejects phone numbers with invalid length or invalid prefixes', () => {
      const invalidStructure = [
        '12345',               // Too short
        '0912345',             // 7 digits
        '09123456789012',      // Too long (>11 digits)
        '0123456789',          // Obsolete 01 prefix
        '0412345678',          // Invalid prefix 04
        '0612345678',          // Invalid prefix 06
        '1912345678',          // Missing leading 0
        '+840912345678',       // Redundant 0 after +84
      ]

      for (const raw of invalidStructure) {
        const res = validatePhone(raw)
        expect(res.valid, `Expected "${raw}" to be rejected`).toBe(false)
        expect(normalizePhone(raw)).toBeNull()
      }
    })

    it('correctly detects duplicate phone numbers across equivalent representations (arePhonesEqual)', () => {
      expect(arePhonesEqual('0912345678', '+84 912 345 678')).toBe(true)
      expect(arePhonesEqual('0912 345 678', '0912.345.678')).toBe(true)
      expect(arePhonesEqual('+84912345678', '0912-345-678')).toBe(true)
      expect(arePhonesEqual('0912345678', '0987654321')).toBe(false)
      expect(arePhonesEqual('', '0912345678')).toBe(false)
      expect(arePhonesEqual('', '')).toBe(false)
    })

    it('does not falsely match invalid phone strings by stripping letters (strict comparison)', () => {
      expect(arePhonesEqual('0912abc', '0912')).toBe(false)
      expect(arePhonesEqual('0912345678abc', '0912345678')).toBe(false)
      expect(arePhonesEqual('0912345678', '0912345678')).toBe(true)
      expect(arePhonesEqual('invalid', 'invalid')).toBe(true)
      expect(arePhonesEqual('invalid1', 'invalid2')).toBe(false)
    })
  })

  describe('Forestry Quantity Contract (vạn & cây integers)', () => {
    it('accepts integer quantities and valid vạn notations', () => {
      expect(parseQuantity('30000')).toBe(30000)
      expect(parseQuantity('30.000')).toBe(30000)
      expect(parseQuantity('30,000')).toBe(30000)
      expect(parseQuantity('3 vạn')).toBe(30000)
      expect(parseQuantity('3v')).toBe(30000)
      expect(parseQuantity('3V')).toBe(30000)
      expect(parseQuantity('4,52 vạn')).toBe(45200)
      expect(parseQuantity('4.52 vạn')).toBe(45200)
      expect(parseQuantity('4,5234 vạn')).toBe(45234)
      expect(parseQuantity('0,0001 vạn')).toBe(1)
      expect(parseQuantity(5, 'van')).toBe(50000)
      expect(parseQuantity('5', 'van')).toBe(50000)
      expect(parseQuantity('4,52', 'van')).toBe(45200)
    })

    it('strictly REJECTS quantities that yield fractional trees (no Math.round silently creating trees)', () => {
      // 4.52345 vạn = 45234.5 cây -> MUST BE NULL
      expect(parseQuantity('4,52345 vạn')).toBeNull()
      expect(parseQuantity('4.52345 vạn')).toBeNull()
      expect(parseQuantity('4,52345v')).toBeNull()

      // 0.00001 vạn = 0.1 cây -> MUST BE NULL
      expect(parseQuantity('0,00001 vạn')).toBeNull()
      expect(parseQuantity('0.00001 vạn')).toBeNull()

      // Float number directly passed without unit
      expect(parseQuantity(3.5)).toBeNull()
      expect(parseQuantity(0.5)).toBeNull()

      // Float number passed with 'van' unit that yields fractional trees
      expect(parseQuantity(4.52345, 'van')).toBeNull()
      expect(parseQuantity(0.00001, 'van')).toBeNull()
    })

    it('strictly rejects non-numeric or malformed text and negative numbers', () => {
      expect(parseQuantity('abc1200')).toBeNull()
      expect(parseQuantity('12abc')).toBeNull()
      expect(parseQuantity('3 cây 5')).toBeNull()
      expect(parseQuantity('-100')).toBeNull()
      expect(parseQuantity(-100)).toBeNull()
      expect(parseQuantity('NaN')).toBeNull()
      expect(parseQuantity(NaN)).toBeNull()
      expect(parseQuantity(Infinity)).toBeNull()
      expect(parseQuantity(-Infinity)).toBeNull()
    })

    it('enforces safe integer limit (MAX_SAFE_INTEGER)', () => {
      expect(parseQuantity('9007199254740992')).toBeNull() // MAX_SAFE_INTEGER + 1
      expect(parseQuantity(Number.MAX_SAFE_INTEGER + 1)).toBeNull()
    })
  })

  describe('Unit Price Contract (VNĐ per seedling)', () => {
    it('accepts valid non-negative integer prices formatted with or without thousand separators', () => {
      expect(parseUnitPrice('1200')).toEqual({ valid: true, value: 1200 })
      expect(parseUnitPrice('1.200')).toEqual({ valid: true, value: 1200 })
      expect(parseUnitPrice('1,200')).toEqual({ valid: true, value: 1200 })
      expect(parseUnitPrice('150.000')).toEqual({ valid: true, value: 150000 })
      expect(parseUnitPrice(1200)).toEqual({ valid: true, value: 1200 })
      expect(parseUnitPrice(0)).toEqual({ valid: true, value: 0 })
      expect(parseUnitPrice('0')).toEqual({ valid: true, value: 0 })
    })

    it('treats empty or undefined input as valid with undefined value (optional field)', () => {
      expect(parseUnitPrice('')).toEqual({ valid: true, value: undefined })
      expect(parseUnitPrice('   ')).toEqual({ valid: true, value: undefined })
      expect(parseUnitPrice(undefined)).toEqual({ valid: true, value: undefined })
      expect(parseUnitPrice(null)).toEqual({ valid: true, value: undefined })
    })

    it('strictly rejects prices with letters or symbols without silently stripping them', () => {
      expect(parseUnitPrice('abc1200').valid).toBe(false)
      expect(parseUnitPrice('1200abc').valid).toBe(false)
      expect(parseUnitPrice('thỏa thuận').valid).toBe(false)
      expect(parseUnitPrice('120k').valid).toBe(false)
      expect(parseUnitPrice('1200đ').valid).toBe(false)
    })

    it('strictly rejects negative prices and fractional prices (no cents/xu/hào in VNĐ)', () => {
      expect(parseUnitPrice('-1200').valid).toBe(false)
      expect(parseUnitPrice(-1200).valid).toBe(false)
      expect(parseUnitPrice('12,5').valid).toBe(false)
      expect(parseUnitPrice('1.200,5').valid).toBe(false)
      expect(parseUnitPrice(12.5).valid).toBe(false)
    })

    it('enforces business cap of 1,000,000,000 VNĐ (1 billion)', () => {
      expect(MAX_UNIT_PRICE).toBe(1_000_000_000)
      expect(parseUnitPrice('1.000.000.000')).toEqual({ valid: true, value: 1_000_000_000 })
      expect(parseUnitPrice(1_000_000_000)).toEqual({ valid: true, value: 1_000_000_000 })
      expect(parseUnitPrice('1.000.000.001').valid).toBe(false)
      expect(parseUnitPrice(1_000_000_001).valid).toBe(false)
      expect(parseUnitPrice(Number.MAX_SAFE_INTEGER + 1).valid).toBe(false)
    })
  })

  describe('Date Calendar Validity Contract', () => {
    it('accepts valid calendar dates in YYYY-MM-DD format', () => {
      expect(isValidCalendarDate('2026-10-12')).toBe(true)
      expect(isValidCalendarDate('2024-02-29')).toBe(true) // 2024 is leap year
      expect(parseDateToIso('2026-10-12')).toBe('2026-10-12T00:00:00.000Z')
    })

    it('strictly rejects invalid calendar dates (such as Feb 31st or Feb 29 on non-leap years)', () => {
      expect(isValidCalendarDate('2026-02-31')).toBe(false)
      expect(isValidCalendarDate('2025-02-29')).toBe(false) // 2025 is not leap year
      expect(isValidCalendarDate('2026-04-31')).toBe(false) // April has 30 days
      expect(parseDateToIso('2026-02-31')).toBeNull()
      expect(parseDateToIso('2025-02-29')).toBeNull()
    })

    it('safely handles empty, malformed, or missing date strings without throwing RangeError', () => {
      expect(isValidCalendarDate('')).toBe(false)
      expect(isValidCalendarDate('invalid-date')).toBe(false)
      expect(isValidCalendarDate('2026-1-1')).toBe(false)
      expect(parseDateToIso('')).toBeNull()
      expect(parseDateToIso(undefined)).toBeNull()
      expect(parseDateToIso(null)).toBeNull()
      expect(parseDateToIso('not-a-date')).toBeNull()
    })

    it('enforces supported calendar era bounds (1970 - 2099)', () => {
      expect(MIN_SUPPORTED_YEAR).toBe(1970)
      expect(MAX_SUPPORTED_YEAR).toBe(2099)
      expect(isValidCalendarDate('1970-01-01')).toBe(true)
      expect(isValidCalendarDate('2099-12-31')).toBe(true)
      expect(isValidCalendarDate('1969-12-31')).toBe(false)
      expect(isValidCalendarDate('2100-01-01')).toBe(false)
      expect(isValidCalendarDate('0000-01-01')).toBe(false)
      expect(isValidCalendarDate('0026-10-12')).toBe(false)
      expect(isValidCalendarDate('0099-12-31')).toBe(false)
    })

    it('strictly validates requested dates (YYYY-MM-DD or exact ISO timestamp)', () => {
      expect(isValidRequestedDate('2026-10-12')).toBe(true)
      expect(isValidRequestedDate('2026-10-12T00:00:00.000Z')).toBe(true)
      expect(isValidRequestedDate('2026-10-12T14:30:00Z')).toBe(true)
      expect(isValidRequestedDate('2026-10-12abc')).toBe(false)
      expect(isValidRequestedDate('2026-10-12 10:00:00')).toBe(false)
      expect(isValidRequestedDate('0026-10-12')).toBe(false)
      expect(isValidRequestedDate('2026-02-31')).toBe(false)
      expect(isValidRequestedDate('')).toBe(false)
      expect(isValidRequestedDate(undefined)).toBe(false)
      expect(isValidRequestedDate(null)).toBe(false)
    })
  })

  describe('Contact Contract (Name & Boundaries)', () => {
    it('defines maximum contact name length of 100 characters', () => {
      expect(MAX_CONTACT_NAME_LENGTH).toBe(100)
    })
  })
})
