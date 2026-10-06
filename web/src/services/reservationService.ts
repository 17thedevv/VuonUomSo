import { db } from '../data/db'
import type { Reservation, ReservationSourceType, ReservationStatus } from '../domain/reservation'
import type { Order } from '../domain/order'
import type { Contact } from '../domain/contact'
import type { BatchWithAvailability } from '../domain/batch'
import {
  reservedQuantityForOrder,
  orderShortage,
  deriveOrderDisplayStatus,
  type OrderDisplayStatus
} from '../domain/order'
import {
  reservedQuantityForBatch,
  availableQuantityForBatch,
  formatQuantity
} from '../domain/quantity'
import { isBatchAttention } from '../domain/batch'
import {
  filterBatchCandidatesForOrder,
  sortBatchCandidatesForReservation,
  validateReservationQuantity,
  validateBatchAvailability,
  validateOrderShortage,
  type ExternalSupplierCandidate
} from '../domain/reservation'
import { DEFAULT_SUPPLIER_CATALOG } from '../data/demo/supplierCatalog'
import { undoService } from './undoService'

export interface ReserveOwnBatchParams {
  orderId: string
  batchId: string
  quantity: number
}

export interface ReserveExternalSupplierParams {
  orderId: string
  supplierId: string
  quantity: number
}

export interface ReleaseReservationParams {
  reservationId: string
}

export interface ReservationCandidateBatch extends BatchWithAvailability {
  recommendedQuantity: number
}

export interface ResolvedReservation {
  id: string
  orderId: string
  sourceType: ReservationSourceType
  batchId?: string
  supplierId?: string
  quantity: number
  status: ReservationStatus
  createdAt: string
  sourceLabel: string
  isOwnBatch: boolean
  sourcePhone?: string
}

export interface OrderReservationOptions {
  order: Order
  customer: Contact | null
  reservedQuantity: number
  shortage: number
  displayStatus: OrderDisplayStatus
  ownBatches: ReservationCandidateBatch[]
  externalSuppliers: ExternalSupplierCandidate[]
  currentReservations: ResolvedReservation[]
}

/**
 * Loads order information and all eligible candidate supply sources (own batches & external suppliers).
 */
export async function getReservationOptions(orderId: string): Promise<OrderReservationOptions | null> {
  const [order, allBatches, allReservations, allContacts] = await Promise.all([
    db.orders.get(orderId),
    db.batches.toArray(),
    db.reservations.toArray(),
    db.contacts.toArray()
  ])

  if (!order) return null

  const customer = allContacts.find((c) => c.id === order.customerId) || null
  const reserved = reservedQuantityForOrder(order.id, allReservations)
  const shortage = orderShortage(order, allReservations)
  const displayStatus = deriveOrderDisplayStatus(order, allReservations)

  // Map own batches with live availability
  const mappedBatches: BatchWithAvailability[] = allBatches.map((b) => ({
    ...b,
    reservedQuantity: reservedQuantityForBatch(b.id, allReservations),
    availableQuantity: availableQuantityForBatch(b, allReservations),
    isAttention: isBatchAttention(b)
  }))

  // Filter own batches by order variety, ready status, available > 0
  const candidateBatches = filterBatchCandidatesForOrder(mappedBatches, order.variety)
  const sortedBatches = sortBatchCandidatesForReservation(candidateBatches)

  const ownBatches: ReservationCandidateBatch[] = sortedBatches.map((b) => ({
    ...b,
    recommendedQuantity: Math.min(b.availableQuantity, shortage)
  }))

  // External suppliers: contacts with role 'supplier'
  const supplierContacts = allContacts.filter((c) => c.roles.includes('supplier'))
  const externalSuppliers: ExternalSupplierCandidate[] = supplierContacts.map((c) => {
    // Check if supplier has known mock catalog for this variety
    const catalogMatch = DEFAULT_SUPPLIER_CATALOG.find(
      (entry) =>
        entry.supplierName.trim().toLowerCase() === c.name.trim().toLowerCase() &&
        entry.variety.trim().toLowerCase() === order.variety.trim().toLowerCase()
    )

    const estimatedQuantity = catalogMatch ? catalogMatch.estimatedQuantity : 30000

    return {
      supplierId: c.id,
      name: c.name,
      phone: c.phone,
      variety: order.variety,
      estimatedQuantity,
      note: 'Số lượng tham khảo từ nhà vườn liên kết'
    }
  })

  // Resolved current reservations for this order (active or fulfilled)
  const batchMap = new Map(allBatches.map((b) => [b.id, b]))
  const contactMap = new Map(allContacts.map((c) => [c.id, c]))

  const currentReservations: ResolvedReservation[] = allReservations
    .filter((r) => r.orderId === order.id && r.status !== 'released')
    .map((r) => {
      if (r.sourceType === 'own_batch' && r.batchId) {
        const b = batchMap.get(r.batchId)
        return {
          ...r,
          sourceLabel: b ? `${b.code} (${b.variety})` : 'Lô trong vườn',
          isOwnBatch: true
        }
      } else if (r.sourceType === 'external_supplier' && r.supplierId) {
        const sup = contactMap.get(r.supplierId)
        return {
          ...r,
          sourceLabel: sup ? sup.name : 'Vườn liên kết',
          isOwnBatch: false,
          sourcePhone: sup?.phone
        }
      }
      return {
        ...r,
        sourceLabel: 'Nguồn chưa xác định',
        isOwnBatch: false
      }
    })

  return {
    order,
    customer,
    reservedQuantity: reserved,
    shortage,
    displayStatus,
    ownBatches,
    externalSuppliers,
    currentReservations
  }
}

/**
 * Commits a reservation from an own batch with full commit-time concurrency re-checking.
 * Enforces Invariants:
 * 1. reservation.quantity > 0
 * 2. batchId is required
 * 3. does NOT exceed batch available quantity at commit
 * 4. does NOT exceed order shortage at commit
 * 5. does NOT reduce batch.currentQuantity or batch.readyQuantity
 */
export async function reserveOwnBatch(params: ReserveOwnBatchParams): Promise<{
  success: boolean
  reservation: Reservation
}> {
  const { orderId, batchId, quantity } = params

  const result = await db.transaction('rw', [db.batches, db.orders, db.reservations, db.events, db.contacts], async () => {
    // 1. Re-read batch at commit time
    const batch = await db.batches.get(batchId)
    if (!batch) {
      throw new Error('Lô cây không tồn tại.')
    }
    if (batch.status !== 'ready') {
      throw new Error(`Lô ${batch.code} hiện không ở trạng thái đủ bán.`)
    }

    // 2. Re-read order at commit time
    const order = await db.orders.get(orderId)
    if (!order) {
      throw new Error('Đơn hàng không tồn tại.')
    }
    if (order.status === 'shipped' || order.status === 'cancelled') {
      throw new Error('Đơn hàng đã hoàn thành hoặc đã bị hủy.')
    }

    // 3. Enforce variety matching invariant
    if (batch.variety.trim().toLowerCase() !== order.variety.trim().toLowerCase()) {
      throw new Error(
        `Lô ${batch.code} (${batch.variety}) không cùng giống cây với đơn hàng (${order.variety}).`
      )
    }

    // 3. Re-calculate live available quantity of batch at commit time
    const batchReservations = await db.reservations.where('batchId').equals(batchId).toArray()
    const activeBatchReserved = batchReservations
      .filter((r) => r.status === 'active')
      .reduce((sum, r) => sum + r.quantity, 0)
    const currentAvailable = Math.max(batch.readyQuantity - activeBatchReserved, 0)

    // 4. Validate quantity invariant
    const qtyCheck = validateReservationQuantity(quantity)
    if (!qtyCheck.valid) {
      throw new Error(qtyCheck.error)
    }

    // 5. Invariant: Cannot over-reserve batch
    const availCheck = validateBatchAvailability(quantity, currentAvailable, batch.code)
    if (!availCheck.valid) {
      throw new Error(availCheck.error)
    }

    // 6. Re-calculate live shortage of order at commit time
    const orderReservations = await db.reservations.where('orderId').equals(orderId).toArray()
    const activeOrderReserved = orderReservations
      .filter((r) => r.status === 'active' || r.status === 'fulfilled')
      .reduce((sum, r) => sum + r.quantity, 0)
    const currentShortage = Math.max(order.requestedQuantity - activeOrderReserved, 0)

    // 7. Invariant: Cannot over-reserve order
    const shortageCheck = validateOrderShortage(quantity, currentShortage)
    if (!shortageCheck.valid) {
      throw new Error(shortageCheck.error)
    }

    // 8. Create reservation record
    const reservation: Reservation = {
      id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderId,
      sourceType: 'own_batch',
      batchId,
      quantity,
      status: 'active',
      createdAt: new Date().toISOString()
    }
    await db.reservations.put(reservation)

    // 9. Update order status
    const newTotalReserved = activeOrderReserved + quantity
    if (newTotalReserved >= order.requestedQuantity) {
      order.status = 'reserved'
    } else {
      order.status = 'partially_reserved'
    }
    await db.orders.put(order)

    // 10. Record domain events
    const customer = await db.contacts.get(order.customerId)
    const customerName = customer ? customer.name : 'Khách hàng'

    // Batch event
    await db.events.put({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'reservation_created',
      entityType: 'batch',
      entityId: batchId,
      payload: {
        reservationId: reservation.id,
        orderId,
        sourceType: 'own_batch',
        batchId,
        quantity,
        message: `Đã giữ ${formatQuantity(quantity)} cây cho đơn ${customerName}`
      },
      createdAt: reservation.createdAt
    })

    // Order event
    await db.events.put({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'reservation_created',
      entityType: 'order',
      entityId: orderId,
      payload: {
        reservationId: reservation.id,
        orderId,
        sourceType: 'own_batch',
        batchId,
        batchCode: batch.code,
        quantity,
        message: `Đã giữ ${formatQuantity(quantity)} cây từ ${batch.code}`
      },
      createdAt: reservation.createdAt
    })

    return {
      success: true,
      reservation,
      batchCode: batch.code
    }
  })

  // 11. Record mutation for Undo banner after transaction commit
  undoService.recordMutation({
    type: 'create_reservation',
    reservationId: result.reservation.id,
    orderId,
    description: `Đã giữ ${formatQuantity(quantity)} cây từ ${result.batchCode}.`
  })

  return {
    success: true,
    reservation: result.reservation
  }
}

/**
 * Commits an external supplier reservation.
 * Enforces Invariants:
 * 1. reservation.quantity > 0
 * 2. supplierId is required
 * 3. does NOT affect own batch stock or availability
 * 4. does NOT exceed order shortage at commit
 */
export async function reserveExternalSupplier(params: ReserveExternalSupplierParams): Promise<{
  success: boolean
  reservation: Reservation
}> {
  const { orderId, supplierId, quantity } = params

  const result = await db.transaction('rw', [db.orders, db.reservations, db.events, db.contacts], async () => {
    // 1. Re-read order at commit time
    const order = await db.orders.get(orderId)
    if (!order) {
      throw new Error('Đơn hàng không tồn tại.')
    }
    if (order.status === 'shipped' || order.status === 'cancelled') {
      throw new Error('Đơn hàng đã hoàn thành hoặc đã bị hủy.')
    }

    // 2. Validate supplier contact
    const supplier = await db.contacts.get(supplierId)
    if (!supplier) {
      throw new Error('Không tìm thấy nhà vườn liên kết.')
    }
    if (!supplier.roles.includes('supplier')) {
      throw new Error('Liên hệ này không phải nguồn cung cây.')
    }

    // 3. Validate quantity invariant
    const qtyCheck = validateReservationQuantity(quantity)
    if (!qtyCheck.valid) {
      throw new Error(qtyCheck.error)
    }

    // 4. Re-calculate live shortage of order at commit time
    const orderReservations = await db.reservations.where('orderId').equals(orderId).toArray()
    const activeOrderReserved = orderReservations
      .filter((r) => r.status === 'active' || r.status === 'fulfilled')
      .reduce((sum, r) => sum + r.quantity, 0)
    const currentShortage = Math.max(order.requestedQuantity - activeOrderReserved, 0)

    // 5. Invariant: Cannot over-reserve order
    const shortageCheck = validateOrderShortage(quantity, currentShortage)
    if (!shortageCheck.valid) {
      throw new Error(shortageCheck.error)
    }

    // 6. Create reservation record
    const reservation: Reservation = {
      id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderId,
      sourceType: 'external_supplier',
      supplierId,
      quantity,
      status: 'active',
      createdAt: new Date().toISOString()
    }
    await db.reservations.put(reservation)

    // 7. Update order status
    const newTotalReserved = activeOrderReserved + quantity
    if (newTotalReserved >= order.requestedQuantity) {
      order.status = 'reserved'
    } else {
      order.status = 'partially_reserved'
    }
    await db.orders.put(order)

    // 8. Record domain event for order
    await db.events.put({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'reservation_created',
      entityType: 'order',
      entityId: orderId,
      payload: {
        reservationId: reservation.id,
        orderId,
        sourceType: 'external_supplier',
        supplierId,
        supplierName: supplier.name,
        quantity,
        message: `Đã giữ ${formatQuantity(quantity)} cây từ ${supplier.name}`
      },
      createdAt: reservation.createdAt
    })

    return {
      success: true,
      reservation,
      supplierName: supplier.name
    }
  })

  // 9. Record mutation for Undo banner after transaction commit
  undoService.recordMutation({
    type: 'create_reservation',
    reservationId: result.reservation.id,
    orderId,
    description: `Đã giữ ${formatQuantity(quantity)} cây từ ${result.supplierName}.`
  })

  return {
    success: true,
    reservation: result.reservation
  }
}

/**
 * Releases an existing reservation (sets status to 'released').
 * Restores own batch available quantity without modifying physical stock.
 * Increases order shortage.
 */
export async function releaseReservation(params: ReleaseReservationParams): Promise<{
  success: boolean
}> {
  const { reservationId } = params

  return await db.transaction('rw', [db.batches, db.orders, db.reservations, db.events, db.contacts], async () => {
    const reservation = await db.reservations.get(reservationId)
    if (!reservation) {
      throw new Error('Bản ghi giữ cây không tồn tại.')
    }

    // Idempotent: If already released, return success
    if (reservation.status === 'released') {
      return { success: true }
    }

    if (reservation.status !== 'active') {
      throw new Error('Chỉ có thể bỏ giữ cây đang được giữ.')
    }

    // Update reservation status to 'released'
    reservation.status = 'released'
    await db.reservations.put(reservation)

    // Recompute order status
    const order = await db.orders.get(reservation.orderId)
    if (order && order.status !== 'shipped' && order.status !== 'cancelled') {
      const orderReservations = await db.reservations.where('orderId').equals(reservation.orderId).toArray()
      const remainingReserved = orderReservations
        .filter((r) => (r.status === 'active' || r.status === 'fulfilled') && r.id !== reservationId)
        .reduce((sum, r) => sum + r.quantity, 0)

      if (remainingReserved === 0) {
        order.status = 'open'
      } else if (remainingReserved < order.requestedQuantity) {
        order.status = 'partially_reserved'
      } else {
        order.status = 'reserved'
      }
      await db.orders.put(order)
    }

    // Record domain events
    let sourceName = 'nguồn cây'
    if (reservation.sourceType === 'own_batch' && reservation.batchId) {
      const batch = await db.batches.get(reservation.batchId)
      sourceName = batch ? batch.code : 'lô trong vườn'

      const customer = order ? await db.contacts.get(order.customerId) : null
      const customerName = customer ? customer.name : 'đơn hàng'

      await db.events.put({
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'reservation_released',
        entityType: 'batch',
        entityId: reservation.batchId,
        payload: {
          reservationId,
          orderId: reservation.orderId,
          sourceType: 'own_batch',
          batchId: reservation.batchId,
          quantity: reservation.quantity,
          message: `Đã bỏ giữ ${formatQuantity(reservation.quantity)} cây đơn ${customerName}`
        },
        createdAt: new Date().toISOString()
      })
    } else if (reservation.sourceType === 'external_supplier' && reservation.supplierId) {
      const supplier = await db.contacts.get(reservation.supplierId)
      sourceName = supplier ? supplier.name : 'vườn ngoài'
    }

    // Order event
    await db.events.put({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'reservation_released',
      entityType: 'order',
      entityId: reservation.orderId,
      payload: {
        reservationId,
        orderId: reservation.orderId,
        sourceType: reservation.sourceType,
        quantity: reservation.quantity,
        message: `Đã bỏ giữ ${formatQuantity(reservation.quantity)} cây từ ${sourceName}`
      },
      createdAt: new Date().toISOString()
    })

    return { success: true }
  })
}

/**
 * Gets chronological reservation events for an order.
 */
export async function getOrderReservationHistory(orderId: string) {
  const events = await db.events.where('entityId').equals(orderId).toArray()
  return events
    .filter((e) => e.type === 'reservation_created' || e.type === 'reservation_released')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
