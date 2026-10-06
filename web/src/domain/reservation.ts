export type ReservationSourceType =
  | 'own_batch'
  | 'external_supplier'

export type ReservationStatus =
  | 'active'
  | 'fulfilled'
  | 'released'

export type Reservation = {
  id: string
  orderId: string

  sourceType: ReservationSourceType

  batchId?: string
  supplierId?: string

  quantity: number

  status: ReservationStatus

  createdAt: string
}
