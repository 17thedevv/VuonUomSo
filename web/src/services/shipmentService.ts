import { db } from '../data/db'
import type { Shipment, ShipmentLine } from '../domain/shipment'
import type { Order } from '../domain/order'
import type { Contact } from '../domain/contact'
import type { Batch } from '../domain/batch'
import type { Reservation } from '../domain/reservation'
import {
  shippedQuantityForOrder,
  remainingToShipForOrder,
  validateShipmentLineAllocation,
  validateShipmentQuantity
} from '../domain/shipment'
import { remainingReservationQuantity } from '../domain/reservation'
import { formatQuantity } from '../domain/quantity'
import { createDomainEvent } from '../analytics/events'

export interface CreateShipmentLineInput {
  reservationId: string
  quantity: number
}

export interface CreateShipmentParams {
  orderId: string
  lines: CreateShipmentLineInput[]
  plannedDate?: string
  note?: string
}

export interface ConfirmShipmentParams {
  shipmentId: string
}

export interface CancelShipmentParams {
  shipmentId: string
}

export interface ResolvedShipmentLine extends ShipmentLine {
  sourceLabel: string
  isOwnBatch: boolean
  batchCode?: string
  supplierName?: string
  supplierPhone?: string
}

export interface ShipmentDetailData {
  shipment: Shipment
  order: Order
  customer: Contact | null
  linesWithDetails: ResolvedShipmentLine[]
  orderRequestedQuantity: number
  orderShippedQuantity: number
  orderRemainingToShip: number
}

export interface OrderShipmentSummary {
  order: Order
  customer: Contact | null
  shipments: Shipment[]
  plannedShipment?: Shipment
  totalShipped: number
  remainingToShip: number
  activeReservations: {
    reservationId: string
    sourceType: 'own_batch' | 'external_supplier'
    sourceLabel: string
    isOwnBatch: boolean
    batchId?: string
    supplierId?: string
    totalReserved: number
    alreadyFulfilled: number
    remainingToShip: number
  }[]
  canCreateShipment: boolean
}

/**
 * Creates a planned shipment for an order.
 *
 * Enforces Invariants:
 * 1. One Open Planned Shipment Rule: at most 1 planned shipment per order.
 * 2. Planned shipment creation MUST NOT mutate physical stock or reservation fulfilled quantities.
 * 3. Line quantity must not exceed remaining unfulfilled reservation commitment.
 */
export async function createShipment(params: CreateShipmentParams): Promise<{
  success: boolean
  shipment: Shipment
}> {
  const { orderId, lines, plannedDate, note } = params

  return await db.transaction('rw', [db.orders, db.reservations, db.shipments, db.events], async () => {
    // 1. Re-read order
    const order = await db.orders.get(orderId)
    if (!order) {
      throw new Error('Đơn hàng không tồn tại.')
    }
    if (order.status === 'shipped') {
      throw new Error('Đơn hàng đã giao đủ toàn bộ cây.')
    }
    if (order.status === 'cancelled') {
      throw new Error('Đơn hàng đã bị hủy, không thể lên chuyến giao.')
    }

    // 2. Enforce One Open Planned Shipment Rule
    const existingPlanned = await db.shipments
      .where('orderId')
      .equals(orderId)
      .filter((s) => s.status === 'planned')
      .first()

    if (existingPlanned) {
      throw new Error(
        'Đơn hàng đang có một chuyến giao dự kiến chưa xuất xe. Vui lòng xác nhận hoặc hủy chuyến cũ trước khi tạo chuyến mới.'
      )
    }

    // 3. Validate lines
    const positiveLines = lines.filter((l) => l.quantity > 0)
    if (positiveLines.length === 0) {
      throw new Error('Chuyến giao phải có ít nhất một dòng với số lượng lớn hơn 0.')
    }

    const seenReservationIds = new Set<string>()
    const shipmentLines: ShipmentLine[] = []
    let totalPlanned = 0

    for (const inputLine of positiveLines) {
      if (seenReservationIds.has(inputLine.reservationId)) {
        throw new Error('Một nguồn cây không được xuất hiện hai lần trong cùng chuyến.')
      }
      seenReservationIds.add(inputLine.reservationId)

      const reservation = await db.reservations.get(inputLine.reservationId)
      if (!reservation) {
        throw new Error('Bản ghi giữ cây không tồn tại.')
      }
      if (reservation.orderId !== orderId) {
        throw new Error('Bản ghi giữ cây không thuộc đơn hàng này.')
      }
      if (reservation.status === 'released') {
        throw new Error('Không thể giao từ khoản giữ cây đã bị hủy.')
      }

      const remaining = remainingReservationQuantity(reservation)
      const lineCheck = validateShipmentLineAllocation(inputLine.quantity, remaining)
      if (!lineCheck.valid) {
        throw new Error(lineCheck.error)
      }

      shipmentLines.push({
        reservationId: reservation.id,
        sourceType: reservation.sourceType,
        batchId: reservation.batchId,
        supplierId: reservation.supplierId,
        quantity: inputLine.quantity
      })
      totalPlanned += inputLine.quantity
    }

    // Explicit total shipment guard: cannot exceed remaining unfulfilled order quantity
    const existingShipments = await db.shipments.where('orderId').equals(orderId).toArray()
    const remainingOrder = remainingToShipForOrder(
      order.requestedQuantity,
      orderId,
      existingShipments
    )
    if (totalPlanned > remainingOrder) {
      throw new Error(
        `Tổng số cây lên chuyến (${formatQuantity(totalPlanned)}) vượt quá số lượng còn thiếu của đơn hàng (${formatQuantity(remainingOrder)} cây).`
      )
    }

    // 4. Create planned shipment
    const shipment: Shipment = {
      id: `ship_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderId,
      lines: shipmentLines,
      plannedQuantity: totalPlanned,
      shippedQuantity: 0,
      plannedDate: plannedDate || new Date().toISOString().split('T')[0],
      status: 'planned',
      note: note?.trim() || undefined,
      createdAt: new Date().toISOString()
    }

    await db.shipments.put(shipment)

    // 5. Record domain event
    await db.events.put(
      createDomainEvent('shipment_planned', 'order', orderId, {
        shipmentId: shipment.id,
        plannedQuantity: totalPlanned,
        plannedDate: shipment.plannedDate,
        message: `Đã lên kế hoạch chuyến giao ${formatQuantity(totalPlanned)} cây`
      })
    )

    return {
      success: true,
      shipment
    }
  })
}

/**
 * Cancels a planned shipment.
 *
 * Enforces Invariants:
 * 1. Only 'planned' shipments can be cancelled. Completed shipments CANNOT be cancelled.
 * 2. Idempotent: cancelling an already cancelled shipment returns success.
 * 3. Does NOT mutate stock or reservations.
 */
export async function cancelShipment(params: CancelShipmentParams): Promise<{
  success: boolean
}> {
  const { shipmentId } = params

  return await db.transaction('rw', [db.shipments, db.events], async () => {
    const shipment = await db.shipments.get(shipmentId)
    if (!shipment) {
      throw new Error('Chuyến giao không tồn tại.')
    }

    if (shipment.status === 'completed') {
      throw new Error('Không thể hủy chuyến giao đã hoàn thành và xuất cây.')
    }

    if (shipment.status === 'cancelled') {
      return { success: true }
    }

    shipment.status = 'cancelled'
    await db.shipments.put(shipment)

    await db.events.put(
      createDomainEvent('shipment_cancelled', 'order', shipment.orderId, {
        shipmentId: shipment.id,
        message: `Đã hủy chuyến giao dự kiến (${formatQuantity(shipment.plannedQuantity)} cây)`
      })
    )

    return { success: true }
  })
}

/**
 * Confirms a shipment (Physical Fulfillment).
 *
 * Enforces Invariants:
 * 1. Idempotency: Double-clicking / repeating confirmation does not double-decrement stock.
 * 2. Only 'planned' shipments can be confirmed.
 * 3. For own batch lines:
 *    - Reduces batch.currentQuantity -= Q
 *    - Reduces batch.readyQuantity -= Q
 *    - Stock cannot become negative.
 *    - Crucial invariant: batch available quantity before === batch available quantity after!
 * 4. For external supplier lines:
 *    - Does NOT mutate any own batch stock.
 * 5. Updates reservation:
 *    - reservation.fulfilledQuantity += Q
 *    - If fulfilledQuantity === quantity -> reservation.status = 'fulfilled'
 * 6. Updates shipment:
 *    - shipment.status = 'completed'
 *    - shipment.shippedQuantity = plannedQuantity
 *    - shipment.shippedAt = now
 * 7. Updates order:
 *    - If total completed shipped >= order.requestedQuantity -> 'shipped'
 *    - Else -> 'partially_shipped'
 * 8. All changes committed atomically in one Dexie transaction.
 */
export async function confirmShipment(params: ConfirmShipmentParams): Promise<{
  success: boolean
  shipment: Shipment
}> {
  const { shipmentId } = params

  return await db.transaction(
    'rw',
    [db.shipments, db.orders, db.reservations, db.batches, db.events, db.contacts],
    async () => {
      // 1. Re-read shipment at commit time
      const shipment = await db.shipments.get(shipmentId)
      if (!shipment) {
        throw new Error('Chuyến giao không tồn tại.')
      }

      // Idempotency check: Already completed
      if (shipment.status === 'completed') {
        return { success: true, shipment }
      }

      if (shipment.status !== 'planned') {
        throw new Error('Chỉ có thể xác nhận chuyến giao đang ở trạng thái dự kiến.')
      }

      // Verify lines non-empty
      if (!shipment.lines || shipment.lines.length === 0) {
        throw new Error('Chuyến giao không có dòng phân bổ cây.')
      }

      // Verify line quantities and uniqueness first
      const seenReservationIds = new Set<string>()
      for (const line of shipment.lines) {
        const qtyCheck = validateShipmentQuantity(line.quantity)
        if (!qtyCheck.valid) {
          throw new Error(qtyCheck.error)
        }
        if (seenReservationIds.has(line.reservationId)) {
          throw new Error('Chuyến giao có dòng giữ cây bị trùng lặp.')
        }
        seenReservationIds.add(line.reservationId)
      }

      // Verify sum of lines equals plannedQuantity
      const totalLinesQuantity = shipment.lines.reduce((sum, l) => sum + l.quantity, 0)
      if (totalLinesQuantity !== shipment.plannedQuantity) {
        throw new Error('Tổng số cây trong các dòng không khớp với số lượng dự kiến của chuyến giao.')
      }

      // 2. Re-read order at commit time
      const order = await db.orders.get(shipment.orderId)
      if (!order) {
        throw new Error('Đơn hàng không tồn tại.')
      }

      // Re-verify total completed shipped does not exceed requested quantity
      const allOrderShipments = await db.shipments.where('orderId').equals(order.id).toArray()
      const alreadyShipped = allOrderShipments
        .filter((s) => s.status === 'completed' && s.id !== shipment.id)
        .reduce((sum, s) => sum + s.shippedQuantity, 0)

      if (alreadyShipped + shipment.plannedQuantity > order.requestedQuantity) {
        throw new Error('Tổng số cây xuất vượt quá số lượng khách đặt của đơn hàng.')
      }

      const now = new Date().toISOString()

      // 3. Process each line atomically
      for (const line of shipment.lines ?? []) {
        const reservation = await db.reservations.get(line.reservationId)
        if (!reservation) {
          throw new Error('Bản ghi giữ cây không tồn tại.')
        }

        // Re-validate reservation belongs to the same order
        if (reservation.orderId !== shipment.orderId) {
          throw new Error('Nguồn cây trong chuyến không thuộc đơn hàng này.')
        }

        if (reservation.status === 'released') {
          throw new Error('Không thể giao từ khoản giữ cây đã bị hủy.')
        }

        // Re-validate line quantity allocation at commit time (integer, > 0, finite, <= remaining)
        const remaining = remainingReservationQuantity(reservation)
        const lineCheck = validateShipmentLineAllocation(line.quantity, remaining)
        if (!lineCheck.valid) {
          throw new Error(lineCheck.error)
        }

        // Reconcile line metadata against authoritative reservation
        if (line.sourceType !== reservation.sourceType) {
          throw new Error('Loại nguồn cây trong chuyến không khớp với bản ghi giữ cây.')
        }
        if (reservation.sourceType === 'own_batch') {
          if (line.batchId !== reservation.batchId) {
            throw new Error('Mã lô cây trong chuyến không khớp với bản ghi giữ cây.')
          }
        } else if (reservation.sourceType === 'external_supplier') {
          if (line.supplierId !== reservation.supplierId) {
            throw new Error('Nhà cung cấp trong chuyến không khớp với bản ghi giữ cây.')
          }
        }

        // Authoritative source of truth: reservation.sourceType and reservation.batchId
        if (reservation.sourceType === 'own_batch') {
          if (!reservation.batchId) {
            throw new Error('Dòng xuất từ lô nội bộ thiếu mã lô.')
          }
          const batch = await db.batches.get(reservation.batchId)
          if (!batch) {
            throw new Error(`Lô cây không tồn tại.`)
          }

          if (batch.currentQuantity < line.quantity || batch.readyQuantity < line.quantity) {
            throw new Error(
              `Lô cây ${batch.code} không đủ tồn kho thực tế để xuất (còn ${formatQuantity(batch.readyQuantity)} cây đủ bán).`
            )
          }

          // Atomically decrement physical stock
          batch.currentQuantity -= line.quantity
          batch.readyQuantity -= line.quantity
          await db.batches.put(batch)

          // Record batch domain event
          await db.events.put(
            createDomainEvent('batch_stock_reduced', 'batch', batch.id, {
              shipmentId: shipment.id,
              orderId: order.id,
              quantityReduced: line.quantity,
              remainingCurrentQuantity: batch.currentQuantity,
              remainingReadyQuantity: batch.readyQuantity,
              message: `Đã xuất ${formatQuantity(line.quantity)} cây cho đơn ${order.id}. Tồn thực tế còn ${formatQuantity(batch.currentQuantity)}.`
            })
          )
        }

        // Update reservation fulfilledQuantity and status
        reservation.fulfilledQuantity = (reservation.fulfilledQuantity ?? 0) + line.quantity
        if (reservation.fulfilledQuantity >= reservation.quantity) {
          reservation.status = 'fulfilled'
        }
        await db.reservations.put(reservation)
      }

      // 4. Update shipment status
      shipment.shippedQuantity = shipment.plannedQuantity
      shipment.shippedAt = now
      shipment.status = 'completed'
      await db.shipments.put(shipment)

      // 5. Update order status based on total completed shipments
      const orderShipments = await db.shipments.where('orderId').equals(order.id).toArray()
      const completedShipped = orderShipments
        .filter((s) => s.status === 'completed' || s.id === shipment.id)
        .reduce((sum, s) => sum + (s.id === shipment.id ? shipment.shippedQuantity : s.shippedQuantity), 0)

      if (completedShipped >= order.requestedQuantity) {
        order.status = 'shipped'
      } else {
        order.status = 'partially_shipped'
      }
      await db.orders.put(order)

      // 6. Record shipment completion domain event
      await db.events.put(
        createDomainEvent('shipment_completed', 'order', order.id, {
          shipmentId: shipment.id,
          shippedQuantity: shipment.shippedQuantity,
          totalShipped: completedShipped,
          orderStatus: order.status,
          message: `Xác nhận đã bốc xe xuất ${formatQuantity(shipment.shippedQuantity)} cây (${order.status === 'shipped' ? 'Hoàn thành toàn bộ đơn' : 'Giao một phần'})`
        })
      )

      return {
        success: true,
        shipment
      }
    }
  )
}

/**
 * Gets full details of a specific shipment for viewing.
 */
export async function getShipmentDetail(shipmentId: string): Promise<ShipmentDetailData | null> {
  const [shipment, allBatches, allContacts, allShipments] = await Promise.all([
    db.shipments.get(shipmentId),
    db.batches.toArray(),
    db.contacts.toArray(),
    db.shipments.toArray()
  ])

  if (!shipment) return null

  const order = await db.orders.get(shipment.orderId)
  if (!order) return null

  const customer = allContacts.find((c: Contact) => c.id === order.customerId) || null
  const batchMap = new Map<string, Batch>(allBatches.map((b: Batch) => [b.id, b]))
  const contactMap = new Map<string, Contact>(allContacts.map((c: Contact) => [c.id, c]))

  const shipmentLines = shipment.lines ?? []
  const linesWithDetails: ResolvedShipmentLine[] = shipmentLines.map((l) => {
    if (l.sourceType === 'own_batch' && l.batchId) {
      const b = batchMap.get(l.batchId)
      return {
        ...l,
        sourceLabel: b ? `${b.code} (${b.variety})` : 'Lô nội bộ',
        isOwnBatch: true,
        batchCode: b?.code
      }
    } else if (l.sourceType === 'external_supplier' && l.supplierId) {
      const sup = contactMap.get(l.supplierId)
      return {
        ...l,
        sourceLabel: sup ? sup.name : 'Vườn liên kết',
        isOwnBatch: false,
        supplierName: sup?.name,
        supplierPhone: sup?.phone
      }
    }
    return {
      ...l,
      sourceLabel: 'Nguồn chưa xác định',
      isOwnBatch: false
    }
  })

  const orderShipped = shippedQuantityForOrder(order.id, allShipments)
  const orderRemaining = remainingToShipForOrder(order.requestedQuantity, order.id, allShipments)

  return {
    shipment,
    order,
    customer,
    linesWithDetails,
    orderRequestedQuantity: order.requestedQuantity,
    orderShippedQuantity: orderShipped,
    orderRemainingToShip: orderRemaining
  }
}

/**
 * Returns shipment summary and active plan for an order.
 */
export async function getOrderShipmentSummary(orderId: string): Promise<OrderShipmentSummary | null> {
  const [order, allReservations, orderShipments, allBatches, allContacts] = await Promise.all([
    db.orders.get(orderId),
    db.reservations.where('orderId').equals(orderId).toArray(),
    db.shipments.where('orderId').equals(orderId).toArray(),
    db.batches.toArray(),
    db.contacts.toArray()
  ])

  if (!order) return null

  const customer = allContacts.find((c: Contact) => c.id === order.customerId) || null
  const batchMap = new Map<string, Batch>(allBatches.map((b: Batch) => [b.id, b]))
  const contactMap = new Map<string, Contact>(allContacts.map((c: Contact) => [c.id, c]))

  const totalShipped = shippedQuantityForOrder(order.id, orderShipments)
  const remainingToShip = remainingToShipForOrder(order.requestedQuantity, order.id, orderShipments)
  const plannedShipment = orderShipments.find((s) => s.status === 'planned')

  // Filter reservations that still have remaining plants to deliver
  const activeReservations = allReservations
    .filter((r: Reservation) => r.status === 'active' && remainingReservationQuantity(r) > 0)
    .map((r: Reservation) => {
      const rem = remainingReservationQuantity(r)
      const ful = r.fulfilledQuantity ?? 0
      if (r.sourceType === 'own_batch' && r.batchId) {
        const b = batchMap.get(r.batchId)
        return {
          reservationId: r.id,
          sourceType: r.sourceType,
          sourceLabel: b ? `${b.code} (${b.variety})` : 'Lô trong vườn',
          isOwnBatch: true,
          batchId: r.batchId,
          totalReserved: r.quantity,
          alreadyFulfilled: ful,
          remainingToShip: rem
        }
      } else {
        const sup = r.supplierId ? contactMap.get(r.supplierId) : null
        return {
          reservationId: r.id,
          sourceType: r.sourceType,
          sourceLabel: sup ? sup.name : 'Vườn liên kết',
          isOwnBatch: false,
          supplierId: r.supplierId,
          totalReserved: r.quantity,
          alreadyFulfilled: ful,
          remainingToShip: rem
        }
      }
    })

  const hasRemainingSupply = activeReservations.reduce((sum: number, r) => sum + r.remainingToShip, 0) > 0
  const canCreateShipment =
    order.status !== 'shipped' &&
    order.status !== 'cancelled' &&
    remainingToShip > 0 &&
    !plannedShipment &&
    hasRemainingSupply

  return {
    order,
    customer,
    shipments: orderShipments.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    plannedShipment,
    totalShipped,
    remainingToShip,
    activeReservations,
    canCreateShipment
  }
}

/**
 * Returns list of shipments with customer and variety details for the shipments screen.
 */
export async function getShipmentsList(statusFilter: 'all' | 'planned' | 'completed' = 'all') {
  const [allShipments, allOrders, allContacts] = await Promise.all([
    db.shipments.toArray(),
    db.orders.toArray(),
    db.contacts.toArray()
  ])

  const orderMap = new Map<string, Order>(allOrders.map((o: Order) => [o.id, o]))
  const contactMap = new Map<string, Contact>(allContacts.map((c: Contact) => [c.id, c]))

  const filtered = allShipments.filter((s) => {
    if (statusFilter === 'all') return true
    return s.status === statusFilter
  })

  return filtered
    .map((s) => {
      const order = orderMap.get(s.orderId)
      const customer = order ? contactMap.get(order.customerId) : null
      return {
        ...s,
        variety: order?.variety ?? 'Chưa rõ giống',
        customerName: customer?.name ?? 'Khách chưa rõ',
        customerPhone: customer?.phone
      }
    })
    .sort((a, b) => {
      const aDate = (a.status === 'planned' ? a.plannedDate : a.shippedAt) || a.createdAt || ''
      const bDate = (b.status === 'planned' ? b.plannedDate : b.shippedAt) || b.createdAt || ''
      if (a.status === 'planned' && b.status === 'planned') {
        return aDate.localeCompare(bDate)
      }
      return bDate.localeCompare(aDate)
    })
}
