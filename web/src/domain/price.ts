/**
 * Unit price validation and parsing for seedlings (VNĐ per seedling).
 * Contract:
 * - Integer VNĐ: 0 <= price <= 1,000,000,000 (1 billion VNĐ)
 * - Optional: empty string / null / undefined returns { valid: true, value: undefined }
 * - Thousand separators: dot (1.200, 150.000) or comma (1,200)
 * - Strictly rejects letters, negative numbers, decimals, non-safe integers.
 */

export const MAX_UNIT_PRICE = 1_000_000_000

export interface PriceValidationResult {
  valid: boolean
  value?: number
  error?: string
}

export function parseUnitPrice(input: string | number | null | undefined): PriceValidationResult {
  if (input === null || input === undefined) {
    return { valid: true, value: undefined }
  }

  if (typeof input === 'number') {
    if (isNaN(input) || !Number.isSafeInteger(input) || input < 0) {
      return { valid: false, error: 'Giá mỗi cây phải là số nguyên không âm hợp lệ.' }
    }
    if (input > MAX_UNIT_PRICE) {
      return { valid: false, error: `Giá mỗi cây không được vượt quá ${MAX_UNIT_PRICE.toLocaleString('vi-VN')} đ.` }
    }
    return { valid: true, value: input }
  }

  const raw = input.trim()
  if (!raw) {
    return { valid: true, value: undefined }
  }

  // Reject negative sign
  if (raw.startsWith('-')) {
    return { valid: false, error: 'Giá mỗi cây không được là số âm.' }
  }

  // Strictly reject letters or special characters (other than digits, dot, comma)
  if (!/^[0-9.,]+$/.test(raw)) {
    return { valid: false, error: 'Giá mỗi cây chỉ được chứa chữ số và dấu phân cách.' }
  }

  // Vietnamese dot thousand separator: e.g. "1.200", "150.000", "1.000.000.000"
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    const clean = raw.replace(/\./g, '')
    const num = parseInt(clean, 10)
    if (!Number.isSafeInteger(num) || num > MAX_UNIT_PRICE) {
      return { valid: false, error: `Giá mỗi cây không được vượt quá ${MAX_UNIT_PRICE.toLocaleString('vi-VN')} đ.` }
    }
    return { valid: true, value: num }
  }

  // Standard comma thousand separator: e.g. "1,200", "150,000"
  if (/^\d{1,3}(,\d{3})+$/.test(raw)) {
    const clean = raw.replace(/,/g, '')
    const num = parseInt(clean, 10)
    if (!Number.isSafeInteger(num) || num > MAX_UNIT_PRICE) {
      return { valid: false, error: `Giá mỗi cây không được vượt quá ${MAX_UNIT_PRICE.toLocaleString('vi-VN')} đ.` }
    }
    return { valid: true, value: num }
  }

  // Plain integers: e.g. "1200", "0"
  if (/^\d+$/.test(raw)) {
    const num = parseInt(raw, 10)
    if (!Number.isSafeInteger(num) || num > MAX_UNIT_PRICE) {
      return { valid: false, error: `Giá mỗi cây không được vượt quá ${MAX_UNIT_PRICE.toLocaleString('vi-VN')} đ.` }
    }
    return { valid: true, value: num }
  }

  // If it contains dots or commas not matching standard thousand groupings (e.g. decimals "12,5" or malformed "1..200")
  return { valid: false, error: 'Giá mỗi cây phải là số nguyên VNĐ hợp lệ.' }
}
