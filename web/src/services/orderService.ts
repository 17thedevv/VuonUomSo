import type { Order } from '../domain/order'
import {
  orderRepository,
  contactRepository,
  batchRepository,
  reservationRepository,
  eventRepository
} from '../data/repositories'
import { availableQuantityForBatch, reservedQuantityForBatch, formatQuantity } from '../domain/quantity'
import { undoService } from './undoService'

export interface CreateOrderInput {
  customerId: string
  variety: string
  requestedQuantity: number
  requestedDate?: string
  unitPrice?: number
  note?: string
}

export interface VarietyAvailabilityInfo {
  variety: string
  readyQuantity: number
  reservedQuantity: number
  availableQuantity: number
  isShortage: boolean
  shortageAmount: number
}

export interface CreateOrderResult {
  success: boolean
  order?: Order
  customerName?: string
  availabilityInfo?: VarietyAvailabilityInfo
  error?: string
}

/**
 * Calculates real-time total available stock of a specific variety across the garden.
 */
export async function getVarietyAvailability(
  variety: string,
  requestedQuantity: number = 0
): Promise<VarietyAvailabilityInfo> {
  const [allBatches, allReservations] = await Promise.all([
    batchRepository.getAll(),
    reservationRepository.getAll()
  ])

  const matchingBatches = allBatches.filter(
    (b) => b.variety.toLowerCase().trim() === variety.toLowerCase().trim()
  )

  let totalReady = 0
  let totalReserved = 0
  let totalAvailable = 0

  for (const b of matchingBatches) {
    const res = reservedQuantityForBatch(b.id, allReservations)
    const avail = availableQuantityForBatch(b, allReservations)
    totalReady += b.readyQuantity
    totalReserved += res
    totalAvailable += avail
  }

  const shortageAmount = Math.max(requestedQuantity - totalAvailable, 0)

  return {
    variety,
    readyQuantity: totalReady,
    reservedQuantity: totalReserved,
    availableQuantity: totalAvailable,
    isShortage: shortageAmount > 0,
    shortageAmount
  }
}

/**
 * Creates a new order in Phase P2:
 * - status = 'open'
 * - MUST NOT create reservations
 * - MUST NOT alter batch physical stock or availability
 * - Informs of availability feedback without blocking
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const customerId = input.customerId.trim()
  if (!customerId) {
    return { success: false, error: 'Vui lòng chọn hoặc thêm khách hàng.' }
  }

  const variety = input.variety.trim()
  if (!variety) {
    return { success: false, error: 'Vui lòng chọn loại cây giống.' }
  }

  if (!input.requestedQuantity || input.requestedQuantity <= 0) {
    return { success: false, error: 'Số lượng cây đặt phải lớn hơn 0.' }
  }

  const customer = await contactRepository.getById(customerId)
  if (!customer) {
    return { success: false, error: 'Khách hàng không tồn tại trong danh bạ.' }
  }

  const id = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  const requestedQuantity = Math.round(input.requestedQuantity)

  // Status MUST be 'open' in P2 (demand created, no reservation yet)
  const newOrder: Order = {
    id,
    customerId,
    variety,
    requestedQuantity,
    requestedDate: input.requestedDate || undefined,
    unitPrice: input.unitPrice !== undefined && input.unitPrice >= 0 ? Math.round(input.unitPrice) : undefined,
    note: input.note?.trim() || undefined,
    status: 'open'
  }

  try {
    await orderRepository.save(newOrder)

    // Calculate informational availability feedback
    const availabilityInfo = await getVarietyAvailability(variety, requestedQuantity)

    await eventRepository.record({
      type: 'order_created',
      entityType: 'order',
      entityId: newOrder.id,
      payload: {
        message: `Ghi đơn mới cho ${customer.name}: ${formatQuantity(newOrder.requestedQuantity)} cây ${newOrder.variety}`,
        customerId: newOrder.customerId,
        variety: newOrder.variety,
        requestedQuantity: newOrder.requestedQuantity,
        availableAtGarden: availabilityInfo.availableQuantity
      }
    })

    // Register reversible mutation for Undo
    undoService.recordMutation({
      type: 'create_order',
      orderId: newOrder.id,
      customerName: customer.name,
      description: `Đã ghi đơn cho ${customer.name}`
    })

    return {
      success: true,
      order: newOrder,
      customerName: customer.name,
      availabilityInfo
    }
  } catch (err) {
    console.error('Failed to create order:', err)
    return {
      success: false,
      error: 'Chưa lưu được đơn hàng trên thiết bị. Dữ liệu bạn vừa nhập vẫn còn trên màn hình.'
    }
  }
}
