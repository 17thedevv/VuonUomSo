import type { BatchWithAvailability } from './batch'

export type ReservationSourceType =
  | 'own_batch'
  | 'external_supplier'

export type ReservationStatus =
  | 'active'
  | 'fulfilled'
  | 'released'

export type Reservation = {
  id: string
  orderId: string

  sourceType: ReservationSourceType

  batchId?: string
  supplierId?: string

  quantity: number
  fulfilledQuantity?: number

  status: ReservationStatus

  createdAt: string
}

/**
 * Returns the quantity already fulfilled (shipped) for this reservation.
 */
export function fulfilledQuantityForReservation(r: Reservation): number {
  return r.fulfilledQuantity ?? 0
}

/**
 * Returns outstanding commitment remaining to be fulfilled:
 * - active: max(quantity - fulfilledQuantity, 0)
 * - fulfilled: 0
 * - released: 0
 */
export function remainingReservationQuantity(r: Reservation): number {
  if (r.status === 'released' || r.status === 'fulfilled') return 0
  const fulfilled = r.fulfilledQuantity ?? 0
  return Math.max(r.quantity - fulfilled, 0)
}

/**
 * Returns the quantity of supply covered by this reservation towards an order:
 * - active: quantity
 * - fulfilled: quantity
 * - released: fulfilledQuantity (already shipped portion remains covered historically)
 */
export function coveredQuantityForReservation(r: Reservation): number {
  if (r.status === 'active' || r.status === 'fulfilled') {
    return r.quantity
  }
  // Released: only previously fulfilled portion remains covered
  return r.fulfilledQuantity ?? 0
}

export type ExternalSupplierCandidate = {
  supplierId: string
  name: string
  phone?: string
  variety: string
  estimatedQuantity: number
  note?: string
}

/**
 * Filters own batches that can be reserved for an order:
 * 1. Must match order variety (case-insensitive)
 * 2. Status must be 'ready'
 * 3. Available quantity must be > 0
 */
export function filterBatchCandidatesForOrder(
  batches: BatchWithAvailability[],
  orderVariety: string
): BatchWithAvailability[] {
  const targetVariety = orderVariety.trim().toLowerCase()
  return batches.filter(
    (b) =>
      b.variety.trim().toLowerCase() === targetVariety &&
      b.status === 'ready' &&
      b.availableQuantity > 0
  )
}

/**
 * Sorts candidate batches to help sell priority batches first:
 * 1. Batch sắp quá lứa (isAttention) first
 * 2. Earlier preferredSellBefore first
 * 3. Older batch (createdAt ascending) first
 * 4. Larger availableQuantity first
 */
export function sortBatchCandidatesForReservation(
  candidates: BatchWithAvailability[]
): BatchWithAvailability[] {
  return [...candidates].sort((a, b) => {
    // 1. Attention first
    if (a.isAttention && !b.isAttention) return -1
    if (!a.isAttention && b.isAttention) return 1

    // 2. preferredSellBefore ascending
    if (a.preferredSellBefore && b.preferredSellBefore) {
      const diff = new Date(a.preferredSellBefore).getTime() - new Date(b.preferredSellBefore).getTime()
      if (diff !== 0) return diff
    }
    if (a.preferredSellBefore && !b.preferredSellBefore) return -1
    if (!a.preferredSellBefore && b.preferredSellBefore) return 1

    // 3. Older batch (createdAt ascending)
    const createDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    if (createDiff !== 0) return createDiff

    // 4. Larger available quantity
    return b.availableQuantity - a.availableQuantity
  })
}

/**
 * Validates reservation quantity invariant: quantity > 0 and integer.
 */
export function validateReservationQuantity(
  quantity: number
): { valid: boolean; error?: string } {
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
    return { valid: false, error: 'Số lượng giữ phải là số nguyên dương lớn hơn 0 cây.' }
  }
  return { valid: true }
}

/**
 * Validates that requested reservation does not exceed batch available quantity.
 */
export function validateBatchAvailability(
  requestedQuantity: number,
  availableQuantity: number,
  batchCode: string
): { valid: boolean; error?: string } {
  if (requestedQuantity > availableQuantity) {
    const availFormatted = new Intl.NumberFormat('vi-VN').format(availableQuantity)
    const reqFormatted = new Intl.NumberFormat('vi-VN').format(requestedQuantity)
    return {
      valid: false,
      error: `Không đủ cây trong lô này. Lô ${batchCode} hiện còn bán ${availFormatted} cây. Bạn đang muốn giữ ${reqFormatted} cây.`
    }
  }
  return { valid: true }
}

/**
 * Validates that requested reservation does not exceed remaining order shortage.
 */
export function validateOrderShortage(
  requestedQuantity: number,
  shortage: number
): { valid: boolean; error?: string } {
  if (requestedQuantity > shortage) {
    const shortageFormatted = new Intl.NumberFormat('vi-VN').format(shortage)
    return {
      valid: false,
      error: `Đơn này chỉ còn thiếu ${shortageFormatted} cây. Bạn có thể giữ tối đa ${shortageFormatted} cây nữa.`
    }
  }
  return { valid: true }
}
