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
import { db } from '../data/db'
import { createDomainEvent } from '../analytics/events'
import { validateOrderChanges, validateOrderCancellation, orderCancellationFingerprint, type OrderChanges, type OrderLifecycleFailure } from '../domain/orderLifecycle'

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

  if (!Number.isSafeInteger(input.requestedQuantity) || input.requestedQuantity <= 0) {
    return { success: false, error: 'Số lượng cây đặt phải lớn hơn 0 và là số nguyên an toàn hợp lệ.' }
  }

  if (input.unitPrice !== undefined && (!Number.isSafeInteger(input.unitPrice) || input.unitPrice < 0)) {
    return { success: false, error: 'Giá mỗi cây phải là số nguyên không âm hợp lệ.' }
  }

  const id = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  const requestedQuantity = input.requestedQuantity

  // Status MUST be 'open' in P2 (demand created, no reservation yet)
  const newOrder: Order = {
    id,
    customerId,
    variety,
    requestedQuantity,
    requestedDate: input.requestedDate || undefined,
    unitPrice: input.unitPrice,
    note: input.note?.trim() || undefined,
    status: 'open'
  }

  let result: CreateOrderResult
  try {
    // Repositories join this transaction, including reads needed by the result/history.
    result = await db.transaction('rw', [db.orders, db.events, db.contacts, db.batches, db.reservations], async (): Promise<CreateOrderResult> => {
      const customer = await contactRepository.getById(customerId)
      if (!customer) {
        return { success: false, error: 'Khách hàng không tồn tại trong danh bạ.' }
      }
      await orderRepository.save(newOrder)
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

      return { success: true, order: newOrder, customerName: customer.name, availabilityInfo }
    })
  } catch (err) {
    console.error('Failed to create order:', err)
    return {
      success: false,
      error: 'Chưa lưu được đơn hàng trên thiết bị. Dữ liệu bạn vừa nhập vẫn còn trên màn hình.'
    }
  }

  // UI-local Undo is optional and only registered after the transaction commits.
  // A notification failure must not report a durable order as a failed create/retry.
  if (result.success && result.order && result.customerName !== undefined) {
    try {
      undoService.recordMutation({
        type: 'create_order',
        orderId: result.order.id,
        customerName: result.customerName,
        description: `Đã ghi đơn cho ${result.customerName}`
      })
    } catch (err) {
      console.error('Failed to register order Undo:', err)
    }
  }
  return result
}

export type UpdateOrderInput = OrderChanges & { orderId: string }
export type UpdateOrderResult = { success: true; order: Order; changed: boolean } | OrderLifecycleFailure
export type CancelOrderResult = {
  success: true; order: Order; releasedReservationIds: string[]; cancelledShipmentIds: string[]
} | OrderLifecycleFailure

/** Commit-time checks and audit record share the same transaction. Never alters supply. */
export async function updateOrder(input: UpdateOrderInput): Promise<UpdateOrderResult> {
  try {
    const result = await db.transaction('rw', [db.orders, db.reservations, db.shipments, db.events], async (): Promise<UpdateOrderResult> => {
      const previous = await db.orders.get(input.orderId)
      if (!previous) return { success: false, code: 'NOT_FOUND', error: 'Đơn hàng không tồn tại.' }
      const reservations = await db.reservations.where('orderId').equals(previous.id).toArray()
      const shipments = await db.shipments.where('orderId').equals(previous.id).toArray()
      const validation = validateOrderChanges(previous, input, reservations, shipments)
      if (!validation.success) return validation
      const order = validation.order
      const fieldLabels = { requestedQuantity: 'số lượng', requestedDate: 'hẹn lấy', unitPrice: 'giá mỗi cây', note: 'ghi chú', variety: 'giống cây', status: 'trạng thái' }
      const changedFields = (['requestedQuantity', 'requestedDate', 'unitPrice', 'note', 'variety', 'status'] as const)
        .filter((key) => previous[key] !== order[key])
      if (changedFields.length === 0) return { success: true, order: previous, changed: false }
      await db.orders.put(order)
      await db.events.put(createDomainEvent('order_updated', 'order', order.id, {
        before: previous, after: order, changedFields,
        message: `Đã sửa đơn (${changedFields.map((key) => fieldLabels[key]).join(', ')}): ${formatQuantity(previous.requestedQuantity)} → ${formatQuantity(order.requestedQuantity)} cây.`
      }))
      return { success: true, order, changed: true }
    })
    // No rollback semantics for corrections yet; discard any stale Undo banner.
    if (result.success && result.changed) undoService.clearLastMutation()
    return result
  } catch (err) {
    console.error('Failed to update order:', err)
    return { success: false, code: 'STORAGE_ERROR', error: 'Chưa lưu được thay đổi đơn hàng. Dữ liệu cũ được giữ nguyên.' }
  }
}

/** Atomic cascade, preserving every order, reservation and shipment record. */
export async function cancelOrder(input: { orderId: string; expectedImpact?: string }): Promise<CancelOrderResult> {
  try {
    const result = await db.transaction('rw', [db.orders, db.reservations, db.shipments, db.events], async (): Promise<CancelOrderResult> => {
      const previous = await db.orders.get(input.orderId)
      if (!previous) return { success: false, code: 'NOT_FOUND', error: 'Đơn hàng không tồn tại.' }
      const reservations = await db.reservations.where('orderId').equals(previous.id).toArray()
      const shipments = await db.shipments.where('orderId').equals(previous.id).toArray()
      const validation = validateOrderCancellation(previous, reservations, shipments)
      if (!validation.success) return validation
      if (previous.status === 'cancelled') {
        return { success: true, order: previous, releasedReservationIds: [], cancelledShipmentIds: [] }
      }
      if (input.expectedImpact !== undefined && input.expectedImpact !== orderCancellationFingerprint(previous, reservations, shipments)) {
        return { success: false, code: 'PREVIEW_CHANGED', error: 'Nguồn giữ hoặc chuyến chờ xuất đã thay đổi. Hãy xem lại tác động trước khi xác nhận hủy.' }
      }
      const released = reservations.filter((r) => r.status === 'active')
      const cancelled = shipments.filter((s) => s.status === 'planned')
      const order: Order = { ...previous, status: 'cancelled' }
      for (const reservation of released) {
        await db.reservations.put({ ...reservation, status: 'released' })
        const payload = {
          orderId: order.id, reservationId: reservation.id, sourceType: reservation.sourceType,
          batchId: reservation.batchId, supplierId: reservation.supplierId, quantity: reservation.quantity,
          reason: 'order_cancelled', message: `Đã nhả ${formatQuantity(reservation.quantity)} cây do hủy đơn.`
        }
        await db.events.put(createDomainEvent('reservation_released', 'order', order.id, payload))
        if (reservation.sourceType === 'own_batch' && reservation.batchId) {
          await db.events.put(createDomainEvent('reservation_released', 'batch', reservation.batchId, payload))
        }
      }
      for (const shipment of cancelled) {
        await db.shipments.put({ ...shipment, status: 'cancelled' })
        await db.events.put(createDomainEvent('shipment_cancelled', 'order', order.id, {
          shipmentId: shipment.id, plannedQuantity: shipment.plannedQuantity, reason: 'order_cancelled',
          message: `Đã hủy chuyến chờ xuất ${formatQuantity(shipment.plannedQuantity)} cây do hủy đơn.`
        }))
      }
      await db.orders.put(order)
      const releasedReservationIds = released.map((r) => r.id)
      const cancelledShipmentIds = cancelled.map((s) => s.id)
      await db.events.put(createDomainEvent('order_cancelled', 'order', order.id, {
        before: previous, after: order, releasedReservationIds, cancelledShipmentIds,
        message: `Đã hủy đơn, nhả ${released.length} nguồn giữ và hủy ${cancelled.length} chuyến chờ xuất.`
      }))
      return { success: true, order, releasedReservationIds, cancelledShipmentIds }
    })
    if (result.success) undoService.clearLastMutation()
    return result
  } catch (err) {
    console.error('Failed to cancel order:', err)
    return { success: false, code: 'STORAGE_ERROR', error: 'Chưa hủy được đơn hàng. Đơn, nguồn giữ và chuyến xe được giữ nguyên.' }
  }
}
