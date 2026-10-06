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
 * Checks if a batch requires attention due to upcoming or passed sell-before date.
 */
export function isBatchAttention(batch: Batch, referenceDate?: Date): boolean {
  if (batch.status !== 'ready') return false
  return isBatchOverageAttention(batch.preferredSellBefore, referenceDate)
}

/**
 * Maps internal BatchStatus and attention flag to Vietnamese user-facing display label.
 */
export function getBatchDisplayStatus(batch: Batch, isAttention: boolean): string {
  if (isAttention) return 'Sắp quá lứa'
  switch (batch.status) {
    case 'ready':
      return 'Đang bán'
    case 'nearly_ready':
      return 'Sắp bán được'
    case 'propagating':
      return 'Đang ươm'
    case 'depleted':
      return 'Đã xuất hết'
    default:
      return 'Đang ươm'
  }
}

/**
 * Pure sorting function for batches in user-facing order:
 * 1. Cần chú ý (Attention/Sắp quá lứa)
 * 2. Đang bán (Ready)
 * 3. Sắp bán được (Nearly Ready)
 * 4. Đang ươm (Propagating)
 * 5. Đã hết (Depleted)
 */
export function sortBatchesForDisplay(batches: BatchWithAvailability[]): BatchWithAvailability[] {
  const getRank = (b: BatchWithAvailability): number => {
    if (b.isAttention) return 1
    if (b.status === 'ready') return 2
    if (b.status === 'nearly_ready') return 3
    if (b.status === 'propagating') return 4
    if (b.status === 'depleted') return 5
    return 6
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
      return batches.filter((b) => b.status === 'ready')
    case 'attention':
      return batches.filter((b) => b.isAttention)
    case 'propagating':
      return batches.filter((b) => b.status === 'propagating' || b.status === 'nearly_ready')
    case 'all':
    default:
      return batches
  }
}
