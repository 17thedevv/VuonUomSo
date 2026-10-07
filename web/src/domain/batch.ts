import { isBatchOverageAttention } from './date'

export type BatchStatus =
  | 'propagating'
  | 'nearly_ready'
  | 'ready'
  | 'depleted'

export type Batch = {
  id: string
  code: string
  variety: string
  createdAt: string

  initialQuantity: number
  currentQuantity: number
  readyQuantity: number

  preferredSellBefore?: string
  sourceNote?: string

  status: BatchStatus
}

export type BatchWithAvailability = Batch & {
  reservedQuantity: number
  availableQuantity: number
  isAttention: boolean
}

export type BatchFilterType = 'all' | 'ready' | 'attention' | 'propagating'

/**
 * Derives batch presentation status strictly from quantities:
 * - currentQuantity <= 0 -> 'depleted'
 * - currentQuantity > 0 && readyQuantity > 0 -> 'ready'
 * - currentQuantity > 0 && readyQuantity === 0 -> 'propagating'
 */
export function deriveBatchStatus(
  batch: Pick<Batch, 'currentQuantity' | 'readyQuantity'>
): BatchStatus {
  if (batch.currentQuantity <= 0) {
    return 'depleted'
  }
  if (batch.readyQuantity > 0) {
    return 'ready'
  }
  return 'propagating'
}

/**
 * Checks if a batch requires attention due to upcoming or passed sell-before date.
 */
export function isBatchAttention(batch: Batch, referenceDate?: Date): boolean {
  if (deriveBatchStatus(batch) !== 'ready') return false
  return isBatchOverageAttention(batch.preferredSellBefore, referenceDate)
}

/**
 * Maps internal BatchStatus and attention flag to Vietnamese user-facing display label.
 */
export function getBatchDisplayStatus(batch: Batch, isAttention: boolean): string {
  if (isAttention) return 'Sắp quá lứa'
  switch (deriveBatchStatus(batch)) {
    case 'ready':
      return 'Đang bán'
    case 'depleted':
      return 'Đã xuất hết'
    case 'propagating':
    default:
      return 'Đang ươm'
  }
}

/**
 * Pure sorting function for batches in user-facing order:
 * 1. Cần chú ý (Attention/Sắp quá lứa)
 * 2. Đang bán (Ready)
 * 3. Đang ươm (Propagating)
 * 4. Đã hết (Depleted)
 */
export function sortBatchesForDisplay(batches: BatchWithAvailability[]): BatchWithAvailability[] {
  const getRank = (b: BatchWithAvailability): number => {
    if (b.isAttention) return 1
    const status = deriveBatchStatus(b)
    if (status === 'ready') return 2
    if (status === 'propagating') return 3
    if (status === 'depleted') return 4
    return 5
  }

  return [...batches].sort((a, b) => {
    const rankDiff = getRank(a) - getRank(b)
    if (rankDiff !== 0) return rankDiff
    // Secondary sort by code
    return a.code.localeCompare(b.code, 'vi')
  })
}

/**
 * Pure filter function for batches based on user filter pill.
 */
export function filterBatches(
  batches: BatchWithAvailability[],
  filter: BatchFilterType
): BatchWithAvailability[] {
  switch (filter) {
    case 'ready':
      return batches.filter((b) => deriveBatchStatus(b) === 'ready')
    case 'attention':
      return batches.filter((b) => b.isAttention)
    case 'propagating':
      return batches.filter((b) => deriveBatchStatus(b) === 'propagating')
    case 'all':
    default:
      return batches
  }
}
