import type { Batch } from '../domain/batch'
import { batchRepository, eventRepository } from '../data/repositories'
import { undoService } from './undoService'
import { formatQuantity } from '../domain/quantity'

export interface CreateBatchInput {
  variety: string
  initialQuantity: number
  createdAt?: string
  code?: string
  preferredSellBefore?: string
  sourceNote?: string
}

export interface CreateBatchResult {
  success: boolean
  batch?: Batch
  error?: string
}

export interface UpdateInventoryInput {
  batchId: string
  newQuantity: number
  note?: string
}

export interface UpdateInventoryResult {
  success: boolean
  batch?: Batch
  previousQuantity?: number
  difference?: number
  error?: string
}

export function extractVarietyPrefix(variety: string): string {
  const trimmed = variety.trim()
  if (!trimmed) return 'LO'

  const tokens = trimmed.split(/\s+/).filter(Boolean)

  // Look for an explicit variety code token (contains digits, e.g. BV16, AH1, BV523, GLSE9, U6)
  const codeToken = tokens.find((t) => /^[A-Za-z0-9_-]*\d+[A-Za-z0-9_-]*$/.test(t))
  if (codeToken) {
    return codeToken.toUpperCase()
  }

  // Fallback: take first letters of each word (supporting unicode)
  if (tokens.length >= 2) {
    return tokens
      .map((w) => Array.from(w)[0])
      .join('')
      .toUpperCase()
      .substring(0, 5)
  }

  return trimmed.substring(0, 4).toUpperCase()
}

/**
 * Generates an auto-incrementing, collision-free batch code like "BV16 #13".
 */
export function generateBatchCode(variety: string, existingBatches: Batch[]): string {
  const prefix = extractVarietyPrefix(variety)
  const regex = new RegExp(`^${prefix}\\s*#(\\d+)$`, 'i')

  let maxNum = 0
  for (const b of existingBatches) {
    const match = b.code.match(regex)
    if (match && match[1]) {
      const num = parseInt(match[1], 10)
      if (!isNaN(num) && num > maxNum) {
        maxNum = num
      }
    }
  }

  const nextNum = maxNum + 1
  const candidate = `${prefix} #${nextNum.toString().padStart(2, '0')}`

  // Double check exact collision
  const exists = existingBatches.some((b) => b.code.toLowerCase() === candidate.toLowerCase())
  if (exists) {
    return `${prefix} #${(nextNum + 1).toString().padStart(2, '0')}`
  }

  return candidate
}

/**
 * Creates a new batch with forestry domain invariants:
 * - initialQuantity > 0
 * - currentQuantity = initialQuantity
 * - readyQuantity = 0
 * - status = 'propagating'
 */
export async function createBatch(input: CreateBatchInput): Promise<CreateBatchResult> {
  const variety = input.variety.trim()
  if (!variety) {
    return { success: false, error: 'Vui lòng chọn hoặc nhập tên giống cây.' }
  }

  if (!input.initialQuantity || input.initialQuantity <= 0) {
    return { success: false, error: 'Số lượng cây ban đầu phải lớn hơn 0.' }
  }

  const allBatches = await batchRepository.getAll()
  const code = input.code?.trim() || generateBatchCode(variety, allBatches)

  // Verify unique code
  const codeExists = allBatches.some((b) => b.code.toLowerCase() === code.toLowerCase())
  if (codeExists) {
    return { success: false, error: `Mã lô "${code}" đã tồn tại. Vui lòng chọn mã khác.` }
  }

  const id = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  const createdAt = input.createdAt || new Date().toISOString()

  const newBatch: Batch = {
    id,
    code,
    variety,
    initialQuantity: Math.round(input.initialQuantity),
    currentQuantity: Math.round(input.initialQuantity),
    readyQuantity: 0,
    status: 'propagating',
    createdAt,
    preferredSellBefore: input.preferredSellBefore || undefined,
    sourceNote: input.sourceNote?.trim() || undefined
  }

  try {
    await batchRepository.save(newBatch)

    // Record creation event
    await eventRepository.record({
      type: 'batch_created',
      entityType: 'batch',
      entityId: newBatch.id,
      payload: {
        message: `Tạo lô ${newBatch.code} (${formatQuantity(newBatch.initialQuantity)} cây ban đầu)`,
        code: newBatch.code,
        variety: newBatch.variety,
        initialQuantity: newBatch.initialQuantity
      }
    })

    // Register reversible mutation for Undo
    undoService.recordMutation({
      type: 'create_batch',
      batchId: newBatch.id,
      batchCode: newBatch.code,
      description: `Đã tạo lô ${newBatch.code}`
    })

    return { success: true, batch: newBatch }
  } catch (err) {
    console.error('Failed to create batch:', err)
    return {
      success: false,
      error: 'Chưa lưu được lô cây trên thiết bị. Dữ liệu bạn vừa nhập vẫn còn trên màn hình.'
    }
  }
}

/**
 * Updates physical living inventory (currentQuantity) of a batch.
 * Enforces:
 * - newQuantity >= 0
 * - newQuantity <= initialQuantity
 * - newQuantity >= readyQuantity
 */
export async function updateBatchInventory(
  input: UpdateInventoryInput
): Promise<UpdateInventoryResult> {
  const batch = await batchRepository.getById(input.batchId)
  if (!batch) {
    return { success: false, error: 'Lô cây không tồn tại.' }
  }

  const newQuantity = Math.round(input.newQuantity)

  if (newQuantity < 0) {
    return { success: false, error: 'Số lượng cây sống không thể âm.' }
  }

  if (newQuantity > batch.initialQuantity) {
    return {
      success: false,
      error: `Số cây còn sống (${formatQuantity(newQuantity)} cây) không thể lớn hơn số lượng cắm hom ban đầu (${formatQuantity(batch.initialQuantity)} cây).`
    }
  }

  if (newQuantity < batch.readyQuantity) {
    return {
      success: false,
      error: `Số cây còn sống (${formatQuantity(newQuantity)}) không thể thấp hơn số cây đang được tính là đủ bán (${formatQuantity(batch.readyQuantity)} cây). Hãy kiểm tra lại số lượng.`
    }
  }

  const previousQuantity = batch.currentQuantity
  const difference = newQuantity - previousQuantity

  batch.currentQuantity = newQuantity

  if (newQuantity === 0) {
    batch.status = 'depleted'
  }

  try {
    await batchRepository.save(batch)

    const diffText =
      difference < 0
        ? `Hao hụt ${formatQuantity(Math.abs(difference))} cây`
        : difference > 0
        ? `Tăng ${formatQuantity(difference)} cây`
        : 'Số lượng không đổi'

    await eventRepository.record({
      type: 'batch_inventory_updated',
      entityType: 'batch',
      entityId: batch.id,
      payload: {
        message: `Kiểm kê còn ${formatQuantity(newQuantity)} cây (${diffText})`,
        previousQuantity,
        newQuantity,
        difference,
        note: input.note?.trim() || undefined
      }
    })

    // Register reversible mutation for Undo
    undoService.recordMutation({
      type: 'update_inventory',
      batchId: batch.id,
      batchCode: batch.code,
      previousQuantity,
      description: `Đã cập nhật kiểm kê lô ${batch.code}`
    })

    return {
      success: true,
      batch,
      previousQuantity,
      difference
    }
  } catch (err) {
    console.error('Failed to update batch inventory:', err)
    return {
      success: false,
      error: 'Chưa cập nhật được số lượng kiểm kê. Vui lòng thử lại.'
    }
  }
}
