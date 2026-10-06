import { type Reservation, coveredQuantityForReservation } from './reservation'
import { type Shipment, shippedQuantityForOrder } from './shipment'

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
  | 'partially_shipped'
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
  shippedQuantity?: number
  shortage: number
  displayStatus: OrderDisplayStatus
}

export type OrderFilterType = 'all' | 'action_needed' | 'ready_pickup' | 'shipped'

/**
 * Total committed quantity across all sources (own batches and external suppliers) for an order:
 * sum(coveredQuantityForReservation for reservations for order).
 */
export function reservedQuantityForOrder(orderId: string, reservations: Reservation[]): number {
  return reservations
    .filter((r) => r.orderId === orderId)
    .reduce((sum, r) => sum + coveredQuantityForReservation(r), 0)
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
  const shipped = shippedQuantityForOrder(order.id, shipments)

  // If explicitly shipped or fulfilled via shipments
  if (order.status === 'shipped' || (order.requestedQuantity > 0 && shipped >= order.requestedQuantity)) {
    return { kind: 'shipped', label: 'Đã giao', shortage: 0 }
  }

  if (order.status === 'cancelled') {
    return { kind: 'cancelled', label: 'Đã hủy', shortage: 0 }
  }

  const reserved = reservedQuantityForOrder(order.id, reservations)
  const shortage = Math.max(order.requestedQuantity - reserved, 0)

  // Partial shipment
  if (order.status === 'partially_shipped' || shipped > 0) {
    const formattedShipped = new Intl.NumberFormat('vi-VN').format(shipped)
    return {
      kind: 'partially_shipped',
      label: `Đã giao ${formattedShipped} cây`,
      shortage
    }
  }

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
 * - 'ready_pickup': Fully reserved orders ready for pickup/shipment (including partially shipped with 0 shortage)
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
        (o) =>
          (o.displayStatus.kind === 'full' ||
            (o.displayStatus.kind === 'partially_shipped' && o.displayStatus.shortage === 0)) &&
          o.status !== 'shipped'
      )
    case 'shipped':
      return orders.filter((o) => o.displayStatus.kind === 'shipped')
    case 'all':
    default:
      return orders
  }
}
