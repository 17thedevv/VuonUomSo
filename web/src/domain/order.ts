import type { Reservation } from './reservation'
import type { Shipment } from './shipment'

export type OrderStatus =
  | 'open'
  | 'partially_reserved'
  | 'reserved'
  | 'partially_shipped'
  | 'shipped'
  | 'cancelled'

export type Order = {
  id: string
  customerId: string
  variety: string
  requestedQuantity: number
  requestedDate?: string
  unitPrice?: number
  note?: string

  status: OrderStatus
}

export type OrderDisplayStatusKind =
  | 'full'
  | 'partial'
  | 'none'
  | 'shipped'
  | 'cancelled'

export type OrderDisplayStatus = {
  kind: OrderDisplayStatusKind
  label: string
  shortage: number
}

export type OrderWithDerived = Order & {
  customerName: string
  customerPhone?: string
  reservedQuantity: number
  shortage: number
  displayStatus: OrderDisplayStatus
}

export type OrderFilterType = 'all' | 'action_needed' | 'ready_pickup' | 'shipped'

/**
 * Total committed quantity across all sources (own batches and external suppliers) for an order:
 * sum(active + fulfilled reservations for order).
 */
export function reservedQuantityForOrder(orderId: string, reservations: Reservation[]): number {
  return reservations
    .filter((r) => r.orderId === orderId && (r.status === 'active' || r.status === 'fulfilled'))
    .reduce((sum, r) => sum + r.quantity, 0)
}

/**
 * Calculates remaining plants needed for an order: max(requestedQuantity - reserved, 0).
 */
export function orderShortage(order: Order, reservations: Reservation[]): number {
  if (order.status === 'shipped' || order.status === 'cancelled') return 0
  const reserved = reservedQuantityForOrder(order.id, reservations)
  return Math.max(order.requestedQuantity - reserved, 0)
}

/**
 * Derives user-facing Vietnamese display status for an order based on reservation and shipment data.
 * Does not show raw technical enums.
 */
export function deriveOrderDisplayStatus(
  order: Order,
  reservations: Reservation[],
  shipments: Shipment[] = []
): OrderDisplayStatus {
  // If explicitly shipped or fulfilled via shipments
  const hasCompletedShipment = shipments.some(
    (s) => s.orderId === order.id && s.shippedQuantity >= order.requestedQuantity
  )
  if (order.status === 'shipped' || hasCompletedShipment) {
    return { kind: 'shipped', label: 'Đã giao', shortage: 0 }
  }

  if (order.status === 'cancelled') {
    return { kind: 'cancelled', label: 'Đã hủy', shortage: 0 }
  }

  const reserved = reservedQuantityForOrder(order.id, reservations)
  const shortage = Math.max(order.requestedQuantity - reserved, 0)

  if (reserved >= order.requestedQuantity) {
    return { kind: 'full', label: 'Đã giữ đủ', shortage: 0 }
  }

  if (reserved > 0) {
    const formattedShortage = new Intl.NumberFormat('vi-VN').format(shortage)
    return {
      kind: 'partial',
      label: `Còn thiếu ${formattedShortage} cây`,
      shortage
    }
  }

  return {
    kind: 'none',
    label: 'Chưa giữ cây',
    shortage: order.requestedQuantity
  }
}

/**
 * Filter orders by user-facing tab categories:
 * - 'action_needed': Orders needing reservation (shortage > 0, not shipped/cancelled)
 * - 'ready_pickup': Fully reserved orders ready for pickup/shipment
 * - 'shipped': Already shipped orders
 * - 'all': All orders
 */
export function filterOrders(
  orders: OrderWithDerived[],
  filter: OrderFilterType
): OrderWithDerived[] {
  switch (filter) {
    case 'action_needed':
      return orders.filter(
        (o) =>
          o.displayStatus.shortage > 0 &&
          o.displayStatus.kind !== 'shipped' &&
          o.displayStatus.kind !== 'cancelled'
      )
    case 'ready_pickup':
      return orders.filter(
        (o) => o.displayStatus.kind === 'full' && o.status !== 'shipped'
      )
    case 'shipped':
      return orders.filter((o) => o.displayStatus.kind === 'shipped')
    case 'all':
    default:
      return orders
  }
}
