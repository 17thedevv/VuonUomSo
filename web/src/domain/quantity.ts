import type { Batch } from './batch.js'
import { type Reservation, remainingReservationQuantity } from './reservation.js'

/**
 * Parses user input quantity supporting Vietnamese forestry conventions:
 * e.g., 30000, 30.000, 30,000, 3 vạn, 3v, 4,52 vạn, 4.52 vạn, 4,52v
 */
export function parseQuantity(
  input: string | number | null | undefined,
  defaultUnit?: 'cay' | 'van'
): number | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'number') {
    if (isNaN(input) || !isFinite(input) || input < 0) return null
    if (defaultUnit === 'van') return Math.round(input * 10000)
    return Math.round(input)
  }

  const raw = input.trim().toLowerCase()
  if (!raw) return null

  // Check if expression represents "vạn" (1 vạn = 10,000)
  // e.g. "3 vạn", "3v", "4,52 vạn", "4.52v", "4,52 v"
  const vanMatch = raw.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(?:vạn|v)$/)
  if (vanMatch && vanMatch[1]) {
    const numPart = vanMatch[1].replace(',', '.')
    const parsed = parseFloat(numPart)
    if (isNaN(parsed) || parsed < 0) return null
    return Math.round(parsed * 10000)
  }

  // If defaultUnit is 'van', treat raw numbers (like "5", "4.52", "4,52") as vạn
  if (defaultUnit === 'van') {
    const decimalMatch = raw.match(/^([0-9]+(?:[.,][0-9]+)?)$/)
    if (decimalMatch && decimalMatch[1]) {
      const numPart = decimalMatch[1].replace(',', '.')
      const parsed = parseFloat(numPart)
      if (isNaN(parsed) || parsed < 0) return null
      return Math.round(parsed * 10000)
    }
  }

  // Vietnamese thousand separator: "30.000", "1.500.000"
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    const clean = raw.replace(/\./g, '')
    const num = parseInt(clean, 10)
    return isNaN(num) || num < 0 ? null : num
  }

  // Standard comma thousand separator: "30,000"
  if (/^\d{1,3}(,\d{3})+$/.test(raw)) {
    const clean = raw.replace(/,/g, '')
    const num = parseInt(clean, 10)
    return isNaN(num) || num < 0 ? null : num
  }

  // Plain integers: "30000"
  if (/^\d+$/.test(raw)) {
    const num = parseInt(raw, 10)
    return isNaN(num) || num < 0 ? null : num
  }

  return null
}

/**
 * Total outstanding active reserved quantity for a specific batch.
 * Sums remaining commitment (quantity - fulfilledQuantity) across active reservations.
 */
export function reservedOutstandingQuantityForBatch(batchId: string, reservations: Reservation[]): number {
  return reservations
    .filter((r) => r.batchId === batchId && r.status === 'active')
    .reduce((sum, r) => sum + remainingReservationQuantity(r), 0)
}

/**
 * Total active reserved quantity for a specific batch (preserves backwards compatibility).
 */
export function reservedQuantityForBatch(batchId: string, reservations: Reservation[]): number {
  return reservedOutstandingQuantityForBatch(batchId, reservations)
}

/**
 * Available ready quantity for a batch:
 * max(readyQuantity - reservedOutstanding(batch), 0)
 */
export function availableQuantityForBatch(batch: Batch, reservations: Reservation[]): number {
  const reserved = reservedOutstandingQuantityForBatch(batch.id, reservations)
  return Math.max(batch.readyQuantity - reserved, 0)
}

/**
 * Shortage of commitment on a batch:
 * max(reservedOutstanding(batch) - readyQuantity, 0)
 * Returns positive number when ready stock was reduced below committed reservations.
 */
export function commitmentShortageForBatch(batch: Batch, reservations: Reservation[]): number {
  const reserved = reservedOutstandingQuantityForBatch(batch.id, reservations)
  return Math.max(reserved - batch.readyQuantity, 0)
}

/**
 * Survival rate calculation: currentQuantity / initialQuantity
 */
export function survivalRate(currentQuantity: number, initialQuantity: number): number {
  if (initialQuantity <= 0) return 0
  return currentQuantity / initialQuantity
}

/**
 * Format quantity with Vietnamese thousand separators (e.g. 45.200)
 */
export function formatQuantity(quantity: number): string {
  return new Intl.NumberFormat('vi-VN').format(quantity)
}

/**
 * Format survival rate as percentage (e.g. 90%)
 */
export function formatSurvivalRate(rate: number): string {
  return `${Math.round(rate * 100)}%`
}
