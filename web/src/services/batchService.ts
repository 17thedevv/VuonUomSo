import { type Batch, deriveBatchStatus } from '../domain/batch'
import { batchRepository } from '../data/repositories'
import { db } from '../data/db'
import { createDomainEvent } from '../analytics/events'
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
  newReadyQuantity?: number
  note?: string
}

export interface UpdateInventoryResult {
  success: boolean
  batch?: Batch
  previousQuantity?: number
  previousReadyQuantity?: number
  difference?: number
  error?: string
}

export interface UpdateReadyQuantityInput {
  batchId: string
  newReadyQuantity: number
  note?: string
}

export interface UpdateReadyQuantityResult {
  success: boolean
  batch?: Batch
  previousReadyQuantity?: number
  newReadyQuantity?: number
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
    status: deriveBatchStatus({
      currentQuantity: Math.round(input.initialQuantity),
      readyQuantity: 0
    }),
    createdAt,
    preferredSellBefore: input.preferredSellBefore || undefined,
    sourceNote: input.sourceNote?.trim() || undefined
  }

  try {
    await db.transaction('rw', [db.batches, db.events], async () => {
      await db.batches.put(newBatch)

      const createEvent = createDomainEvent('batch_created', 'batch', newBatch.id, {
        message: `Tạo lô ${newBatch.code} (${formatQuantity(newBatch.initialQuantity)} cây ban đầu)`,
        code: newBatch.code,
        variety: newBatch.variety,
        initialQuantity: newBatch.initialQuantity
      })
      await db.events.put(createEvent)
    })

    // Register reversible mutation for Undo after transaction commit
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
 * - If newQuantity < readyQuantity and newReadyQuantity is not provided, requires user confirmation.
 * - When newReadyQuantity is provided, validates 0 <= newReadyQuantity <= newQuantity and commits atomically.
 * - Derived status recomputed via deriveBatchStatus(batch)
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

  // If living stock drops below ready stock, require explicit adjusted ready quantity
  let targetReadyQuantity = batch.readyQuantity
  if (input.newReadyQuantity !== undefined) {
    const parsedReady = Math.round(input.newReadyQuantity)
    if (parsedReady < 0) {
      return { success: false, error: 'Số cây đủ bán không thể âm.' }
    }
    if (parsedReady > newQuantity) {
      return {
        success: false,
        error: `Số cây đủ bán (${formatQuantity(parsedReady)} cây) không thể lớn hơn số cây còn sống (${formatQuantity(newQuantity)} cây).`
      }
    }
    targetReadyQuantity = parsedReady
  } else if (newQuantity < batch.readyQuantity) {
    return {
      success: false,
      error: `Số cây còn sống (${formatQuantity(newQuantity)}) không thể thấp hơn số cây đang được tính là đủ bán (${formatQuantity(batch.readyQuantity)} cây). Vui lòng xác nhận lại số cây đủ bán tương ứng.`
    }
  }

  const previousQuantity = batch.currentQuantity
  const previousReadyQuantity = batch.readyQuantity
  const difference = newQuantity - previousQuantity
  const readyDifference = targetReadyQuantity - previousReadyQuantity

  batch.currentQuantity = newQuantity
  batch.readyQuantity = targetReadyQuantity
  batch.status = deriveBatchStatus(batch)

  try {
    const diffText =
      difference < 0
        ? `Hao hụt ${formatQuantity(Math.abs(difference))} cây`
        : difference > 0
        ? `Tăng ${formatQuantity(difference)} cây`
        : 'Số lượng không đổi'

    const readyText =
      readyDifference !== 0
        ? `, cây đủ bán ${readyDifference > 0 ? `tăng ${formatQuantity(readyDifference)}` : `giảm ${formatQuantity(Math.abs(readyDifference))}`}`
        : ''

    await db.transaction('rw', [db.batches, db.events], async () => {
      await db.batches.put(batch)

      const invEvent = createDomainEvent('batch_inventory_updated', 'batch', batch.id, {
        message: `Kiểm kê còn ${formatQuantity(newQuantity)} cây (${diffText}${readyText})`,
        previousQuantity,
        newQuantity,
        difference,
        previousReadyQuantity: readyDifference !== 0 ? previousReadyQuantity : undefined,
        newReadyQuantity: readyDifference !== 0 ? targetReadyQuantity : undefined,
        readyDifference: readyDifference !== 0 ? readyDifference : undefined,
        note: input.note?.trim() || undefined
      })
      await db.events.put(invEvent)

      // If readyQuantity changed, also emit batch_ready_stock_updated event for timeline clarity
      if (readyDifference !== 0) {
        const readyEvent = createDomainEvent('batch_ready_stock_updated', 'batch', batch.id, {
          message: `Điều chỉnh cây đủ bán theo kiểm kê: ${formatQuantity(targetReadyQuantity)} cây (${readyDifference < 0 ? `Giảm ${formatQuantity(Math.abs(readyDifference))}` : `Tăng ${formatQuantity(readyDifference)}`})`,
          previousReadyQuantity,
          newReadyQuantity: targetReadyQuantity,
          difference: readyDifference,
          note: input.note?.trim() || undefined
        })
        await db.events.put(readyEvent)
      }
    })

    // Register reversible mutation for Undo after transaction commit
    undoService.recordMutation({
      type: 'update_inventory',
      batchId: batch.id,
      batchCode: batch.code,
      previousQuantity,
      previousReadyQuantity: readyDifference !== 0 ? previousReadyQuantity : undefined,
      expectedCurrentQuantity: newQuantity,
      expectedReadyQuantity: targetReadyQuantity,
      description: `Đã cập nhật kiểm kê lô ${batch.code}`
    })

    return {
      success: true,
      batch,
      previousQuantity,
      previousReadyQuantity: readyDifference !== 0 ? previousReadyQuantity : undefined,
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

/**
 * Updates ready quantity (cây đủ bán) of a batch.
 * Input uses absolute quantity.
 * Invariants:
 * - 0 <= newReadyQuantity <= batch.currentQuantity
 * - DOES NOT block if newReadyQuantity < reservedQuantity (commitment shortage surfaces honestly for FC3)
 * - Derives batch.status via deriveBatchStatus(batch)
 * - Emits 'batch_ready_stock_updated' event with previousReadyQuantity, newReadyQuantity, difference, note
 * - Records mutation for Undo
 */
export async function updateBatchReadyQuantity(
  input: UpdateReadyQuantityInput
): Promise<UpdateReadyQuantityResult> {
  const batch = await batchRepository.getById(input.batchId)
  if (!batch) {
    return { success: false, error: 'Lô cây không tồn tại.' }
  }

  const newReadyQuantity = Math.round(input.newReadyQuantity)

  if (newReadyQuantity < 0) {
    return { success: false, error: 'Số cây đủ bán không thể âm.' }
  }

  if (newReadyQuantity > batch.currentQuantity) {
    return {
      success: false,
      error: `Số cây đủ bán (${formatQuantity(newReadyQuantity)} cây) không thể lớn hơn số cây còn sống (${formatQuantity(batch.currentQuantity)} cây).`
    }
  }

  const previousReadyQuantity = batch.readyQuantity
  const difference = newReadyQuantity - previousReadyQuantity

  batch.readyQuantity = newReadyQuantity
  batch.status = deriveBatchStatus(batch)

  try {
    const diffText =
      difference < 0
        ? `Giảm ${formatQuantity(Math.abs(difference))} cây`
        : difference > 0
        ? `Tăng ${formatQuantity(difference)} cây`
        : 'Số lượng không đổi'

    await db.transaction('rw', [db.batches, db.events], async () => {
      await db.batches.put(batch)

      const readyEvent = createDomainEvent('batch_ready_stock_updated', 'batch', batch.id, {
        message: `Cập nhật cây đủ bán: ${formatQuantity(newReadyQuantity)} cây (${diffText})`,
        previousReadyQuantity,
        newReadyQuantity,
        difference,
        note: input.note?.trim() || undefined
      })
      await db.events.put(readyEvent)
    })

    // Register reversible mutation for Undo after transaction commit
    undoService.recordMutation({
      type: 'update_ready_quantity',
      batchId: batch.id,
      batchCode: batch.code,
      previousReadyQuantity,
      expectedReadyQuantity: newReadyQuantity,
      expectedCurrentQuantity: batch.currentQuantity,
      description: `Đã cập nhật cây đủ bán lô ${batch.code}`
    })

    return {
      success: true,
      batch,
      previousReadyQuantity,
      newReadyQuantity,
      difference
    }
  } catch (err) {
    console.error('Failed to update ready quantity:', err)
    return {
      success: false,
      error: 'Chưa cập nhật được số lượng cây đủ bán. Vui lòng thử lại.'
    }
  }
}
