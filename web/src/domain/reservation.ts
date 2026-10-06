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

  status: ReservationStatus

  createdAt: string
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
 * Deterministic default catalog for external suppliers in prototype.
 * Provides reference quantities for external suppliers when variety matches.
 */
export const DEFAULT_SUPPLIER_CATALOG: {
  supplierName: string
  phone?: string
  variety: string
  estimatedQuantity: number
}[] = [
  {
    supplierName: 'Vườn Thảo',
    phone: '0977 123 456',
    variety: 'Bạch đàn BV16',
    estimatedQuantity: 35000
  },
  {
    supplierName: 'Vườn Hồng',
    phone: '0966 234 567',
    variety: 'Bạch đàn BV16',
    estimatedQuantity: 22000
  },
  {
    supplierName: 'Vườn An',
    phone: '0955 345 678',
    variety: 'Bạch đàn BV16',
    estimatedQuantity: 48000
  },
  {
    supplierName: 'Vườn Thảo',
    phone: '0977 123 456',
    variety: 'Keo lai AH1',
    estimatedQuantity: 25000
  }
]

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
  if (isNaN(quantity) || !isFinite(quantity) || quantity <= 0) {
    return { valid: false, error: 'Số lượng giữ phải lớn hơn 0 cây.' }
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
