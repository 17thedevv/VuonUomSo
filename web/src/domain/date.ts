/**
 * Number of days before preferredSellBefore where a batch requires attention (Sắp quá lứa).
 */
export const OVERAGE_ATTENTION_DAYS = 14

/**
 * Checks if a batch's preferredSellBefore date requires attention.
 * Returns true if preferredSellBefore exists and is within attentionDays (or already past).
 */
export function isBatchOverageAttention(
  preferredSellBefore: string | undefined,
  referenceDate: Date = new Date(),
  attentionDays: number = OVERAGE_ATTENTION_DAYS
): boolean {
  if (!preferredSellBefore) return false

  const sellDate = new Date(preferredSellBefore)
  if (isNaN(sellDate.getTime())) return false

  // Set time to end of day for fair comparison
  const ref = new Date(referenceDate)
  ref.setHours(0, 0, 0, 0)

  const diffMs = sellDate.getTime() - ref.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  // Requires attention if it's within attentionDays or already past
  return diffDays <= attentionDays
}

/**
 * Formats ISO date or Date object to short Vietnamese date (e.g., "09/10" or "09/10/2026").
 */
export function formatShortDate(
  dateInput: string | Date | undefined,
  includeYear: boolean = false
): string {
  if (!dateInput) return ''
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (isNaN(d.getTime())) return ''

  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')

  if (includeYear) {
    return `${day}/${month}/${d.getFullYear()}`
  }
  return `${day}/${month}`
}

/**
 * Formats standard Vietnamese date (dd/mm/yyyy).
 */
export function formatDate(dateInput: string | Date | undefined): string {
  return formatShortDate(dateInput, true)
}

/**
 * Formats full Vietnamese date for headers (e.g., "Thứ năm, 09/10").
 */
export function formatHeaderDate(dateInput: string | Date = new Date()): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (isNaN(d.getTime())) return ''

  const weekdays = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
  const weekday = weekdays[d.getDay()]
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')

  return `${weekday}, ${day}/${month}`
}

/**
 * Strictly checks if a date string is a valid real calendar date in YYYY-MM-DD format.
 * Prevents calendar roll-overs such as Feb 31st or Feb 29 on non-leap years.
 */
export function isValidCalendarDate(dateString: string | undefined | null): boolean {
  if (!dateString) return false
  const trimmed = dateString.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false

  const [yStr, mStr, dStr] = trimmed.split('-')
  const year = parseInt(yStr, 10)
  const month = parseInt(mStr, 10)
  const day = parseInt(dStr, 10)

  if (month < 1 || month > 12 || day < 1 || day > 31) return false

  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (isNaN(parsed.getTime())) return false

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

/**
 * Safely parses a date string to an ISO string without throwing RangeError.
 * Returns null if the date is invalid or empty.
 */
export function parseDateToIso(dateString: string | undefined | null): string | null {
  if (!dateString) return null
  const trimmed = dateString.trim()
  if (!isValidCalendarDate(trimmed)) return null

  const [yStr, mStr, dStr] = trimmed.split('-')
  const year = parseInt(yStr, 10)
  const month = parseInt(mStr, 10)
  const day = parseInt(dStr, 10)

  return new Date(Date.UTC(year, month - 1, day)).toISOString()
}

