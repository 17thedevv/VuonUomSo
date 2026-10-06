export type ShipmentStatus =
  | 'planned'
  | 'partial'
  | 'completed'

export type Shipment = {
  id: string
  orderId: string
  plannedQuantity: number
  shippedQuantity: number
  shippedAt?: string

  status: ShipmentStatus
}
