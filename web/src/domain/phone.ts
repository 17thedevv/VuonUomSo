/**
 * Vietnamese phone number validation and normalization.
 * Contract (Option A):
 * - Raw string as entered by user is preserved in DB (trimmed only).
 * - Normalization is performed for deduplication, search, and validation.
 * - Mobile: 10 digits starting with 03, 05, 07, 08, 09
 * - Landline: 10 or 11 digits starting with 02
 * - International prefix: +84 (or 84 without redundant 0) converts to domestic 0...
 * - Allowed input separators: space, dot, dash, parentheses.
 * - Any letters or illegal symbols cause strict validation failure (no silent stripping).
 */

export interface PhoneValidationResult {
  valid: boolean
  normalized?: string
  error?: string
}

/**
 * Validates a phone string. Empty/undefined is treated as valid (optional field).
 */
export function validatePhone(input: string | undefined | null): PhoneValidationResult {
  if (input === null || input === undefined) {
    return { valid: true, normalized: undefined }
  }

  const raw = input.trim()
  if (!raw) {
    return { valid: true, normalized: undefined }
  }

  // Strictly reject if string contains any character other than digits, +, -, ., space, (, )
  if (!/^[0-9+\-.\s()]+$/.test(raw)) {
    return { valid: false, error: 'Số điện thoại chứa ký tự không hợp lệ.' }
  }

  // + sign is only allowed as the very first character
  if (raw.includes('+') && !raw.startsWith('+')) {
    return { valid: false, error: 'Dấu + chỉ được đứng ở đầu số điện thoại.' }
  }

  // Strip formatting characters
  let digitsOnly = raw.replace(/[\s.\-()]/g, '')

  // Handle +84 prefix
  if (digitsOnly.startsWith('+84')) {
    const afterPlus84 = digitsOnly.slice(3)
    // Redundant 0 after +84 (e.g. +8409...) is invalid
    if (afterPlus84.startsWith('0')) {
      return { valid: false, error: 'Đầu số +84 không được đi kèm số 0 tiếp theo.' }
    }
    digitsOnly = '0' + afterPlus84
  } else if (digitsOnly.startsWith('84') && (digitsOnly.length === 11 || digitsOnly.length === 12)) {
    // 84 without + followed by 9-10 digits
    const after84 = digitsOnly.slice(2)
    if (!after84.startsWith('0')) {
      digitsOnly = '0' + after84
    }
  }

  // Must now start with 0
  if (!digitsOnly.startsWith('0')) {
    return { valid: false, error: 'Số điện thoại phải bắt đầu bằng số 0 hoặc +84.' }
  }

  // Mobile: 10 digits starting with 03, 05, 07, 08, 09
  const isMobile = /^0[35789]\d{8}$/.test(digitsOnly)
  // Landline: 10 or 11 digits starting with 02
  const isLandline = /^02\d{8,9}$/.test(digitsOnly)

  if (isMobile || isLandline) {
    return { valid: true, normalized: digitsOnly }
  }

  return { valid: false, error: 'Số điện thoại không đúng độ dài hoặc đầu số của Việt Nam.' }
}

/**
 * Returns normalized phone (0xxxxxxxxx) if valid, or null if invalid / empty.
 */
export function normalizePhone(input: string | undefined | null): string | null {
  const result = validatePhone(input)
  return result.valid && result.normalized ? result.normalized : null
}

/**
 * Compares two phone numbers for semantic equality (e.g. 0912 345 678 === +84912345678).
 * Handles legacy raw digits gracefully without failing.
 */
export function arePhonesEqual(
  phone1: string | undefined | null,
  phone2: string | undefined | null
): boolean {
  const p1 = phone1?.trim()
  const p2 = phone2?.trim()
  if (!p1 || !p2) return false

  const norm1 = normalizePhone(p1)
  const norm2 = normalizePhone(p2)

  if (norm1 && norm2) {
    return norm1 === norm2
  }

  // If one or both are not valid phone formats, do NOT strip arbitrary characters.
  // Only exact trimmed equality matches, preventing invalid numbers (e.g. "0912abc" and "0912") from false-matching.
  return p1 === p2
}
