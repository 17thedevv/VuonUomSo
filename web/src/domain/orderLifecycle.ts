import { reservedQuantityForOrder, type Order, type OrderStatus } from './order'
import type { Reservation } from './reservation'
import type { Shipment } from './shipment'

export type OrderChanges = {
  requestedQuantity?: number
  requestedDate?: string | null
  unitPrice?: number | null
  note?: string | null
  variety?: string
}

export type OrderLifecycleFailure = {
  success: false
  code: 'NOT_FOUND' | 'INVALID_INPUT' | 'ORDER_CANCELLED' | 'ALREADY_SHIPPED' |
    'VARIETY_LOCKED' | 'RECONCILIATION_REQUIRED' | 'STORAGE_ERROR'
  error: string
  conflict?: { coveredQuantity: number; requestedQuantity: number; excessQuantity: number }
}

/** Includes historical evidence even if a stored order status is stale. */
export function hasOrderShipmentHistory(order: Order, reservations: Reservation[], shipments: Shipment[]): boolean {
  return order.status === 'shipped' || order.status === 'partially_shipped' ||
    shipments.some((s) => s.orderId === order.id && s.status === 'completed') ||
    reservations.some((r) => r.orderId === order.id &&
      (r.status === 'fulfilled' || (r.fulfilledQuantity ?? 0) > 0))
}

export function validateOrderChanges(
  order: Order, changes: OrderChanges, reservations: Reservation[], shipments: Shipment[]
): { success: true; order: Order } | OrderLifecycleFailure {
  if (order.status === 'cancelled') {
    return { success: false, code: 'ORDER_CANCELLED', error: 'Không thể sửa đơn đã hủy.' }
  }
  if (hasOrderShipmentHistory(order, reservations, shipments)) {
    return { success: false, code: 'ALREADY_SHIPPED', error: 'Chỉ có thể sửa đơn trước khi xuất cây.' }
  }

  const next = { ...order }
  if (changes.requestedQuantity !== undefined) {
    if (!Number.isSafeInteger(changes.requestedQuantity) || changes.requestedQuantity <= 0) {
      return { success: false, code: 'INVALID_INPUT', error: 'Số lượng cây đặt phải là số nguyên dương hợp lệ.' }
    }
    next.requestedQuantity = changes.requestedQuantity
  }
  if (changes.variety !== undefined) {
    const variety = changes.variety.trim()
    if (!variety) return { success: false, code: 'INVALID_INPUT', error: 'Vui lòng nhập giống cây.' }
    if (variety !== order.variety && reservations.some((r) => r.orderId === order.id)) {
      return { success: false, code: 'VARIETY_LOCKED', error: 'Không thể đổi giống cây khi đơn đã có lịch sử giữ cây.' }
    }
    next.variety = variety
  }
  if (changes.requestedDate !== undefined) {
    const date = changes.requestedDate?.trim() || undefined
    if (date) {
      const parsed = new Date(date)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== date) {
        return { success: false, code: 'INVALID_INPUT', error: 'Ngày hẹn lấy không hợp lệ.' }
      }
    }
    next.requestedDate = date
  }
  if (changes.unitPrice !== undefined) {
    if (changes.unitPrice !== null && (!Number.isSafeInteger(changes.unitPrice) || changes.unitPrice < 0)) {
      return { success: false, code: 'INVALID_INPUT', error: 'Giá mỗi cây phải là số nguyên không âm hợp lệ.' }
    }
    next.unitPrice = changes.unitPrice ?? undefined
  }
  if (changes.note !== undefined) next.note = changes.note?.trim() || undefined

  const coveredQuantity = reservedQuantityForOrder(order.id, reservations)
  if (next.requestedQuantity < coveredQuantity) {
    return {
      success: false, code: 'RECONCILIATION_REQUIRED',
      error: 'Số đặt mới thấp hơn lượng cây đã giữ. Cần chọn nguồn để điều phối lại trước khi giảm đơn.',
      conflict: { coveredQuantity, requestedQuantity: next.requestedQuantity, excessQuantity: coveredQuantity - next.requestedQuantity }
    }
  }
  const status: OrderStatus = coveredQuantity === 0 ? 'open' :
    coveredQuantity >= next.requestedQuantity ? 'reserved' : 'partially_reserved'
  next.status = status
  return { success: true, order: next }
}

export function validateOrderCancellation(
  order: Order, reservations: Reservation[], shipments: Shipment[]
): { success: true } | OrderLifecycleFailure {
  if (hasOrderShipmentHistory(order, reservations, shipments)) {
    return { success: false, code: 'ALREADY_SHIPPED', error: 'Đơn đã xuất cây không thể hủy toàn bộ. Dừng phần còn lại thuộc FC5.' }
  }
  return { success: true }
}
