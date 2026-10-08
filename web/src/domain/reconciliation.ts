import type { Batch } from './batch'
import type { Contact } from './contact'
import { type Order, orderShortage } from './order'
import { hasOrderShipmentHistory } from './orderLifecycle'
import { type Reservation, coveredQuantityForReservation, remainingReservationQuantity } from './reservation'
import type { Shipment } from './shipment'
import { availableQuantityForBatch, commitmentShortageForBatch } from './quantity'

export type ReservationAdjustment = { reservationId: string; newOutstanding: number }
export type OrderReductionPlan = {
  orderId: string
  desiredRequestedQuantity: number
  adjustments: ReservationAdjustment[]
}
/** Relevant order/source facts, read together in a transaction. */
export type OrderReductionState = {
  order: Order
  reservations: Reservation[]
  shipments: Shipment[]
  batches: Batch[]
  contacts: Contact[]
  historyIds: string[]
}
export type ReconciliationFailure = {
  success: false
  code: 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_STATE' | 'ORDER_CANCELLED' | 'ALREADY_SHIPPED' |
    'INVALID_SELECTION' | 'PLANNED_ALLOCATION_CONFLICT' | 'UNVERIFIABLE_PLANNED_SHIPMENT' |
    'COVERAGE_EXCEEDS_REQUESTED' | 'PREVIEW_CHANGED' | 'OPERATION_ID_CONFLICT' | 'NO_OP' | 'STORAGE_ERROR'
  error: string
  conflict?: {
    reservationId?: string; shipmentIds?: string[]; plannedQuantity?: number; newOutstanding?: number
    coveredQuantity?: number; requestedQuantity?: number; excessQuantity?: number
  }
  current?: OrderReductionState
  currentFingerprint?: string
}
export type ReservationReduction = {
  before: Reservation; after: Reservation; outstandingBefore: number; outstandingAfter: number
}
export type OrderReductionProjection = {
  orderBefore: Order; orderAfter: Order
  coverageBefore: number; coverageAfter: number; shortageBefore: number; shortageAfter: number
  adjustments: ReservationReduction[]
  batchEffects: {
    batchId: string; livingQuantity: number; readyQuantity: number
    outstandingBefore: number; outstandingAfter: number
    availableBefore: number; availableAfter: number; shortageBefore: number; shortageAfter: number
  }[]
}

const failure = (code: ReconciliationFailure['code'], error: string): ReconciliationFailure => ({ success: false, code, error })
export const nonNegativeInteger = (value: number) => Number.isSafeInteger(value) && value >= 0
const nonEmptyId = (value: string) => typeof value === 'string' && value.trim().length > 0
const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)

export function safeSum(values: number[]): number | undefined {
  let total = 0
  for (const value of values) {
    if (!nonNegativeInteger(value) || !Number.isSafeInteger(total + value)) return undefined
    total += value
  }
  return total
}

export function validReservation(r: Reservation): boolean {
  const f = r.fulfilledQuantity ?? 0
  return ((r.sourceType === 'own_batch' && !!r.batchId && !r.supplierId) ||
    (r.sourceType === 'external_supplier' && !!r.supplierId && !r.batchId)) &&
    Number.isSafeInteger(r.quantity) && r.quantity > 0 && nonNegativeInteger(f) && f <= r.quantity &&
    (r.status === 'released' || (r.status === 'active' && f < r.quantity) || (r.status === 'fulfilled' && f === r.quantity))
}

/** Shared Trigger A/B guard; sums every planned allocation without moving shipment lines. */
export function plannedReservationAllocations(reservations: Reservation[], shipments: Shipment[], orderIds: string[]):
  { success: true; allocations: Map<string, { quantity: number; shipmentIds: string[] }> } | ReconciliationFailure {
  const allocations = new Map<string, { quantity: number; shipmentIds: string[] }>()
  for (const s of shipments.filter(s => s.status === 'planned')) {
    const unverified = (): ReconciliationFailure => ({ ...failure('UNVERIFIABLE_PLANNED_SHIPMENT',
      'Chuyến chờ xuất có phân bổ chưa xác minh được. Hãy xem hoặc hủy chuyến trước khi điều chỉnh.'),
      conflict: { shipmentIds: [s.id] } })
    if (!orderIds.includes(s.orderId) || !s.lines?.length || !Number.isSafeInteger(s.plannedQuantity) ||
      s.plannedQuantity <= 0 || s.shippedQuantity !== 0) return unverified()
    if (safeSum(s.lines.map(l => l.quantity)) !== s.plannedQuantity) return unverified()
    for (const line of s.lines) {
      const r = reservations.find(r => r.id === line.reservationId)
      if (!r || r.orderId !== s.orderId || r.status !== 'active' || !Number.isSafeInteger(line.quantity) || line.quantity <= 0 ||
        line.sourceType !== r.sourceType || line.batchId !== r.batchId || line.supplierId !== r.supplierId) return unverified()
      const previous = allocations.get(r.id) ?? { quantity: 0, shipmentIds: [] }
      const quantity = safeSum([previous.quantity, line.quantity])
      if (quantity === undefined || quantity > remainingReservationQuantity(r)) return unverified()
      allocations.set(r.id, { quantity, shipmentIds: [...new Set([...previous.shipmentIds, s.id])] })
    }
  }
  return { success: true, allocations }
}

export function validateOrderReductionPlan(plan: OrderReductionPlan): ReconciliationFailure | undefined {
  if (!nonEmptyId(plan.orderId) || !Number.isSafeInteger(plan.desiredRequestedQuantity) ||
    plan.desiredRequestedQuantity <= 0 || !Array.isArray(plan.adjustments)) {
    return failure('INVALID_INPUT', 'Số đặt mới phải là số nguyên dương hợp lệ; cần danh sách nguồn đã chọn.')
  }
  const ids = new Set<string>()
  for (const adjustment of plan.adjustments) {
    if (!adjustment || !nonEmptyId(adjustment.reservationId) ||
      !nonNegativeInteger(adjustment.newOutstanding) || ids.has(adjustment.reservationId)) {
      return failure('INVALID_INPUT', 'Mỗi nguồn chỉ được chọn một lần, với số còn giữ là số nguyên không âm hợp lệ.')
    }
    ids.add(adjustment.reservationId)
  }
}

/** Canonical absolute intent. Confirmation token is separate from retry identity. */
export function orderReductionIntentKey(plan: OrderReductionPlan): string {
  return JSON.stringify({ orderId: plan.orderId, desiredRequestedQuantity: plan.desiredRequestedQuantity,
    adjustments: [...plan.adjustments].sort((a, b) => a.reservationId.localeCompare(b.reservationId))
      .map(a => [a.reservationId, a.newOutstanding]) })
}

/** No timestamps/hash shortcuts: strict, deterministic confirmation of all related facts. */
export function orderReductionFingerprint(state: OrderReductionState, plan: OrderReductionPlan): string {
  const { order } = state
  const orderReservations = state.reservations.filter(r => r.orderId === order.id)
  const batchIds = new Set(orderReservations.filter(r => r.sourceType === 'own_batch').map(r => r.batchId))
  const supplierIds = new Set(orderReservations.map(r => r.supplierId))
  return JSON.stringify({
    intent: orderReductionIntentKey(plan),
    order: [order.id, order.customerId, order.requestedQuantity, order.variety, order.status,
      order.requestedDate ?? null, order.unitPrice ?? null, order.note ?? null],
    reservations: state.reservations.filter(r => r.orderId === order.id ||
      (r.sourceType === 'own_batch' && batchIds.has(r.batchId))).sort(byId)
      .map(r => [r.id, r.orderId, r.quantity, r.fulfilledQuantity ?? 0, r.status, r.sourceType,
        r.batchId ?? null, r.supplierId ?? null, r.createdAt]),
    batches: state.batches.filter(b => batchIds.has(b.id)).sort(byId)
      .map(b => [b.id, b.code, b.variety, b.initialQuantity, b.currentQuantity, b.readyQuantity, b.status]),
    contacts: state.contacts.filter(c => c.id === order.customerId || supplierIds.has(c.id)).sort(byId)
      .map(c => [c.id, c.name, c.phone ?? null, [...c.roles].sort()]),
    shipments: [...state.shipments].sort(byId).map(s => [s.id, s.orderId, s.status, s.plannedQuantity,
      s.shippedQuantity, s.plannedDate ?? null, s.shippedAt ?? null, s.note ?? null, s.createdAt ?? null,
      s.lines === undefined ? null : s.lines.map(l =>
        [l.reservationId, l.sourceType, l.batchId ?? null, l.supplierId ?? null, l.quantity])
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))]),
    historyIds: [...state.historyIds].sort()
  })
}

/** Representation helper also covers F>0; Trigger A separately forbids fulfillment. */
export function reduceReservationOutstanding(
  reservation: Reservation, newOutstanding: number
): { success: true; reservation: Reservation } | ReconciliationFailure {
  if (!validReservation(reservation)) return failure('INVALID_STATE', 'Nguồn giữ có số lượng hoặc trạng thái không hợp lệ.')
  if (reservation.status !== 'active' || remainingReservationQuantity(reservation) <= 0) {
    return failure('INVALID_SELECTION', 'Chỉ được điều chỉnh nguồn đang giữ và còn cây chưa xuất.')
  }
  if (!nonNegativeInteger(newOutstanding) || newOutstanding > remainingReservationQuantity(reservation)) {
    return failure('INVALID_INPUT', 'Số còn giữ phải là số nguyên không âm và không vượt lượng đang giữ chưa xuất.')
  }
  const next = newOutstanding === 0
    ? { ...reservation, status: 'released' as const }
    : { ...reservation, quantity: (reservation.fulfilledQuantity ?? 0) + newOutstanding }
  return { success: true, reservation: next }
}

export function projectOrderReduction(
  state: OrderReductionState, plan: OrderReductionPlan
): { success: true; projection: OrderReductionProjection } | ReconciliationFailure {
  const invalid = validateOrderReductionPlan(plan)
  if (invalid) return invalid
  const { order } = state
  if (order.id !== plan.orderId) return failure('NOT_FOUND', 'Đơn hàng không tồn tại.')
  const reservations = state.reservations.filter(r => r.orderId === order.id)
  if (order.status === 'cancelled') return failure('ORDER_CANCELLED', 'Không thể điều chỉnh đơn đã hủy.')
  if (hasOrderShipmentHistory(order, reservations, state.shipments)) {
    return failure('ALREADY_SHIPPED', 'Chỉ được giảm số đặt trước khi xuất cây.')
  }
  if (!Number.isSafeInteger(order.requestedQuantity) || order.requestedQuantity <= 0 ||
    !['open', 'partially_reserved', 'reserved'].includes(order.status) || reservations.some(r => !validReservation(r)) ||
    !state.contacts.some(c => c.id === order.customerId && c.roles.includes('customer'))) {
    return failure('INVALID_STATE', 'Đơn hoặc nguồn giữ có dữ liệu không hợp lệ; không tự sửa lịch sử.')
  }
  for (const r of reservations) {
    if (r.sourceType === 'own_batch') {
      const batch = state.batches.find(b => b.id === r.batchId)
      if (!batch || batch.variety.trim().toLowerCase() !== order.variety.trim().toLowerCase() ||
        ![batch.initialQuantity, batch.currentQuantity, batch.readyQuantity].every(nonNegativeInteger) ||
        batch.readyQuantity > batch.currentQuantity || batch.currentQuantity > batch.initialQuantity) {
        return failure('INVALID_STATE', 'Lô nguồn không tồn tại hoặc dữ liệu lô không hợp lệ.')
      }
    } else if (r.sourceType !== 'external_supplier' ||
      !state.contacts.some(c => c.id === r.supplierId && c.roles.includes('supplier'))) {
      return failure('INVALID_STATE', 'Nguồn ngoài không còn tham chiếu nhà vườn hợp lệ.')
    }
  }
  const coverageBefore = safeSum(reservations.map(coveredQuantityForReservation))
  if (coverageBefore === undefined || coverageBefore > order.requestedQuantity) {
    return failure('INVALID_STATE', 'Tổng nguồn giữ không hợp lệ hoặc vượt số đặt hiện tại.')
  }

  const planned = plannedReservationAllocations(reservations, state.shipments, [order.id])
  if (!planned.success) return planned
  const { allocations } = planned

  const adjustments: ReservationReduction[] = []
  for (const input of plan.adjustments) {
    const before = reservations.find(r => r.id === input.reservationId)
    if (!before) return { ...failure('INVALID_SELECTION', 'Nguồn được chọn không thuộc đơn này.'), conflict: { reservationId: input.reservationId } }
    const reduced = reduceReservationOutstanding(before, input.newOutstanding)
    if (!reduced.success) return { ...reduced, conflict: { reservationId: before.id } }
    const planned = allocations.get(before.id)
    if (planned && input.newOutstanding < planned.quantity) {
      return { ...failure('PLANNED_ALLOCATION_CONFLICT', 'Số còn giữ thấp hơn lượng đã phân bổ trong chuyến chờ xuất.'),
        conflict: { reservationId: before.id, shipmentIds: planned.shipmentIds,
          plannedQuantity: planned.quantity, newOutstanding: input.newOutstanding } }
    }
    adjustments.push({ before: { ...before }, after: reduced.reservation,
      outstandingBefore: remainingReservationQuantity(before), outstandingAfter: input.newOutstanding })
  }
  const requestedChanged = plan.desiredRequestedQuantity !== order.requestedQuantity
  const sourcesChanged = adjustments.some(a => a.outstandingBefore !== a.outstandingAfter)
  if (!requestedChanged && !sourcesChanged) return failure('NO_OP', 'Kế hoạch không thay đổi số đặt hoặc nguồn giữ.')
  if (plan.desiredRequestedQuantity >= order.requestedQuantity) {
    return failure('INVALID_INPUT', 'Thao tác này chỉ dùng để giảm số đặt; không điều chỉnh nguồn riêng hoặc tăng đơn.')
  }
  const afterReservations = state.reservations.map(r => adjustments.find(a => a.before.id === r.id)?.after ?? r)
  const coverageAfter = safeSum(afterReservations.filter(r => r.orderId === order.id).map(coveredQuantityForReservation))
  if (coverageAfter === undefined) return failure('INVALID_STATE', 'Tổng nguồn sau điều chỉnh vượt giới hạn số nguyên an toàn.')
  if (coverageAfter > plan.desiredRequestedQuantity) return {
    ...failure('COVERAGE_EXCEEDS_REQUESTED', 'Chưa giảm đủ nguồn giữ cho số đặt mới. Hãy chọn rõ nguồn cần điều chỉnh thêm.'),
    conflict: { coveredQuantity: coverageAfter, requestedQuantity: plan.desiredRequestedQuantity,
      excessQuantity: coverageAfter - plan.desiredRequestedQuantity }
  }
  const orderAfter: Order = { ...order, requestedQuantity: plan.desiredRequestedQuantity,
    status: coverageAfter === 0 ? 'open' : coverageAfter === plan.desiredRequestedQuantity ? 'reserved' : 'partially_reserved' }
  const batchEffects: OrderReductionProjection['batchEffects'] = []
  const affectedBatchIds = new Set(adjustments.filter(a => a.before.sourceType === 'own_batch' &&
    a.outstandingBefore !== a.outstandingAfter).map(a => a.before.batchId))
  for (const batch of state.batches.filter(b => affectedBatchIds.has(b.id)).sort(byId)) {
    const batchReservations = state.reservations.filter(r => r.sourceType === 'own_batch' && r.batchId === batch.id)
    if (batchReservations.some(r => !validReservation(r))) return failure('INVALID_STATE', 'Cam kết trên lô có dữ liệu không hợp lệ.')
    const outstandingBefore = safeSum(batchReservations.map(remainingReservationQuantity))
    const outstandingAfter = safeSum(afterReservations.filter(r => r.sourceType === 'own_batch' && r.batchId === batch.id).map(remainingReservationQuantity))
    if (outstandingBefore === undefined || outstandingAfter === undefined) return failure('INVALID_STATE', 'Tổng cam kết lô vượt giới hạn số nguyên an toàn.')
    batchEffects.push({ batchId: batch.id, livingQuantity: batch.currentQuantity, readyQuantity: batch.readyQuantity,
      outstandingBefore, outstandingAfter, availableBefore: availableQuantityForBatch(batch, state.reservations),
      availableAfter: availableQuantityForBatch(batch, afterReservations),
      shortageBefore: commitmentShortageForBatch(batch, state.reservations),
      shortageAfter: commitmentShortageForBatch(batch, afterReservations) })
  }
  return { success: true, projection: { orderBefore: { ...order }, orderAfter, coverageBefore, coverageAfter,
    shortageBefore: orderShortage(order, state.reservations), shortageAfter: orderShortage(orderAfter, afterReservations),
    adjustments, batchEffects } }
}
