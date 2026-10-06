export type ShipmentStatus =
  | 'planned'
  | 'completed'
  | 'cancelled'

export type ShipmentLine = {
  reservationId: string
  sourceType: 'own_batch' | 'external_supplier'
  batchId?: string
  supplierId?: string
  quantity: number
}

export type Shipment = {
  id: string
  orderId: string
  lines?: ShipmentLine[]
  plannedQuantity: number
  shippedQuantity: number
  plannedDate?: string
  shippedAt?: string
  status: ShipmentStatus
  note?: string
  createdAt?: string
}

/**
 * Returns total completed shipped quantity for an order:
 * sum(completed shipments for order). Ignores planned and cancelled.
 */
export function shippedQuantityForOrder(orderId: string, shipments: Shipment[]): number {
  return shipments
    .filter((s) => s.orderId === orderId && s.status === 'completed')
    .reduce((sum, s) => sum + s.shippedQuantity, 0)
}

/**
 * Calculates remaining plants still needed to be shipped for an order:
 * max(requestedQuantity - shippedQuantity, 0).
 */
export function remainingToShipForOrder(
  requestedQuantity: number,
  orderId: string,
  shipments: Shipment[]
): number {
  const shipped = shippedQuantityForOrder(orderId, shipments)
  return Math.max(requestedQuantity - shipped, 0)
}

/**
 * Checks if order currently has a shipment with status 'planned'.
 * (Enforces One Open Planned Shipment Rule: at most 1 planned shipment per order).
 */
export function hasPlannedShipmentForOrder(orderId: string, shipments: Shipment[]): boolean {
  return shipments.some((s) => s.orderId === orderId && s.status === 'planned')
}

/**
 * Finds the current planned shipment for an order if one exists.
 */
export function getPlannedShipmentForOrder(orderId: string, shipments: Shipment[]): Shipment | undefined {
  return shipments.find((s) => s.orderId === orderId && s.status === 'planned')
}

/**
 * Validates a shipment quantity (must be a positive whole integer).
 */
export function validateShipmentQuantity(quantity: number): { valid: boolean; error?: string } {
  if (typeof quantity !== 'number' || isNaN(quantity) || !Number.isFinite(quantity)) {
    return { valid: false, error: 'Số lượng giao không hợp lệ.' }
  }
  if (!Number.isInteger(quantity)) {
    return { valid: false, error: 'Số lượng giao phải là số nguyên (không có phần thập phân).' }
  }
  if (quantity <= 0) {
    return { valid: false, error: 'Số lượng giao phải lớn hơn 0.' }
  }
  return { valid: true }
}

/**
 * Validates line allocation against remaining reserved commitment.
 */
export function validateShipmentLineAllocation(
  quantity: number,
  remainingReserved: number
): { valid: boolean; error?: string } {
  const qtyCheck = validateShipmentQuantity(quantity)
  if (!qtyCheck.valid) return qtyCheck

  if (quantity > remainingReserved) {
    return {
      valid: false,
      error: `Số lượng xuất (${quantity.toLocaleString('vi-VN')}) vượt quá số lượng giữ còn lại (${remainingReserved.toLocaleString('vi-VN')}).`
    }
  }
  return { valid: true }
}
