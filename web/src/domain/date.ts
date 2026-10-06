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
