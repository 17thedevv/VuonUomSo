import type { Order } from './order'
import { isTerminalOrder } from './order'
import type { OrderReductionState } from './reconciliation'
import { nonNegativeInteger, safeSum, validReservation, plannedReservationAllocations, orderReductionFingerprint } from './reconciliation'
import { coveredQuantityForReservation, remainingReservationQuantity, type Reservation } from './reservation'
import type { Shipment } from './shipment'
import type { Contact } from './contact'
import { availableQuantityForBatch, commitmentShortageForBatch } from './quantity'

export type CloseRemainingState = OrderReductionState
export type CloseRemainingFailure = {
  success: false
  code: 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_STATE' | 'ORDER_TERMINAL' | 'NOT_PARTIALLY_SHIPPED' |
    'PREVIEW_CHANGED' | 'OPERATION_ID_CONFLICT' | 'STORAGE_ERROR'
  error: string
  current?: CloseRemainingState
  currentFingerprint?: string
}
export type CloseRemainingReleaseEffect = { before: Reservation; after: Reservation; releasedOutstanding: number }
export type CloseRemainingShipmentEffect = { before: Shipment; after: Shipment }
export type CloseRemainingProjection = {
  orderBefore: Order; orderAfter: Order
  customer: Contact
  requestedQuantity: number; shippedQuantity: number; stoppedQuantity: number
  coverageBefore: number; coverageAfter: number; releasedOutstanding: number
  releases: CloseRemainingReleaseEffect[]; cancelledPlans: CloseRemainingShipmentEffect[]
  sources: { before: Reservation; after: Reservation; sourceLabel: string }[]; completedShipments: Shipment[]
  batchEffects: { batchId: string; livingQuantity: number; readyQuantity: number;
    availableBefore: number; availableAfter: number; shortageBefore: number; shortageAfter: number }[]
}
const fail = (code: CloseRemainingFailure['code'], error: string): CloseRemainingFailure => ({ success: false, code, error })
const validId = (id: unknown): id is string => typeof id === 'string' && !!id.trim()
const sameSource = (line: NonNullable<Shipment['lines']>[number], r: Reservation) =>
  line.sourceType === r.sourceType && line.batchId === r.batchId && line.supplierId === r.supplierId

/** Shared close/completion proof. Legacy missing lines cannot authorize a new mutation. */
export function validateOrderFulfillment(order: Order, reservations: Reservation[], shipments: Shipment[]):
  { success: true; shippedQuantity: number; coverage: number; outstanding: number } | CloseRemainingFailure {
  try {
    return proveOrderFulfillment(order, reservations, shipments)
  } catch {
    return fail('INVALID_STATE', 'Dữ liệu nguồn hoặc chuyến xuất không đủ chi tiết để xác minh.')
  }
}
function proveOrderFulfillment(order: Order, reservations: Reservation[], shipments: Shipment[]):
  { success: true; shippedQuantity: number; coverage: number; outstanding: number } | CloseRemainingFailure {
  if (!validId(order.id) || !Number.isSafeInteger(order.requestedQuantity) || order.requestedQuantity <= 0) {
    return fail('INVALID_STATE', 'Số đặt không hợp lệ.')
  }
  const rs = reservations.filter(r => r.orderId === order.id)
  if (new Set(rs.map(r => r.id)).size !== rs.length || rs.some(r => !validId(r.id) || !validReservation(r))) {
    return fail('INVALID_STATE', 'Nguồn giữ có số lượng, định danh hoặc trạng thái không hợp lệ.')
  }
  const ids = new Set(rs.map(r => r.id))
  const related = shipments.filter(s => s.orderId === order.id || s.lines?.some(l => ids.has(l.reservationId)))
  if (new Set(related.map(s => s.id)).size !== related.length || related.some(s => !validId(s.id) || s.orderId !== order.id ||
    !['planned', 'completed', 'cancelled'].includes(s.status) || !nonNegativeInteger(s.plannedQuantity) ||
    !nonNegativeInteger(s.shippedQuantity) || (s.status !== 'completed' && s.shippedQuantity !== 0))) {
    return fail('INVALID_STATE', 'Chuyến xuất có số lượng, trạng thái hoặc tham chiếu sai đơn.')
  }
  for (const s of related) {
    const seen = new Set<string>()
    for (const line of s.lines ?? []) {
      const r = rs.find(r => r.id === line.reservationId)
      if (!r || seen.has(line.reservationId) || !sameSource(line, r) ||
        !Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
        return fail('INVALID_STATE', `Chuyến ${s.id}: dòng phân bổ hoặc tham chiếu nguồn không hợp lệ.`)
      }
      seen.add(line.reservationId)
    }
    if (s.lines?.length && safeSum(s.lines.map(l => l.quantity)) !== s.plannedQuantity) {
      return fail('INVALID_STATE', `Chuyến ${s.id}: tổng dòng phân bổ không khớp số dự kiến.`)
    }
  }
  const fulfilled = new Map<string, number>()
  for (const s of related.filter(s => s.status === 'completed')) {
    if (!s.lines?.length || s.shippedQuantity <= 0 || s.plannedQuantity !== s.shippedQuantity ||
      safeSum(s.lines.map(l => l.quantity)) !== s.shippedQuantity) {
      return fail('INVALID_STATE', `Chuyến ${s.id}: lịch sử xuất chưa đủ chi tiết để xác minh.`)
    }
    const seen = new Set<string>()
    for (const line of s.lines) {
      const r = rs.find(r => r.id === line.reservationId)
      const total = safeSum([fulfilled.get(line.reservationId) ?? 0, line.quantity])
      if (!r || seen.has(line.reservationId) || !sameSource(line, r) || !Number.isSafeInteger(line.quantity) ||
        line.quantity <= 0 || total === undefined) return fail('INVALID_STATE', `Chuyến ${s.id}: phân bổ đã xuất không khớp nguồn.`)
      seen.add(line.reservationId)
      fulfilled.set(line.reservationId, total)
    }
  }
  if (rs.some(r => (r.fulfilledQuantity ?? 0) !== (fulfilled.get(r.id) ?? 0))) {
    return fail('INVALID_STATE', 'Số đã xuất của nguồn giữ không khớp lịch sử chuyến xuất.')
  }
  const planned = plannedReservationAllocations(rs, related, [order.id])
  if (!planned.success) return fail('INVALID_STATE', planned.error)
  if (related.some(s => s.status === 'planned' && new Set(s.lines?.map(l => l.reservationId)).size !== s.lines?.length)) {
    return fail('INVALID_STATE', 'Phân bổ chuyến chờ xuất bị trùng nguồn.')
  }
  const shippedQuantity = safeSum(related.filter(s => s.status === 'completed').map(s => s.shippedQuantity))
  const coverage = safeSum(rs.map(coveredQuantityForReservation))
  const outstanding = safeSum(rs.map(remainingReservationQuantity))
  const plannedTotal = safeSum(related.filter(s => s.status === 'planned').map(s => s.plannedQuantity))
  if (shippedQuantity === undefined || coverage === undefined || outstanding === undefined || plannedTotal === undefined ||
    shippedQuantity > order.requestedQuantity || coverage > order.requestedQuantity ||
    safeSum(rs.map(r => r.fulfilledQuantity ?? 0)) !== shippedQuantity || plannedTotal > order.requestedQuantity - shippedQuantity) {
    return fail('INVALID_STATE', 'Tổng đã xuất, cam kết hoặc chuyến chờ xuất không hợp lệ; không tự sửa lịch sử.')
  }
  return { success: true, shippedQuantity, coverage, outstanding }
}

export function closeRemainingIntentKey(orderId: string, fingerprint: string): string {
  return JSON.stringify({ action: 'close_remaining', orderId, approvedFingerprint: fingerprint })
}
export function closeRemainingFingerprint(state: CloseRemainingState): string {
  // Reuse the established deterministic facts encoding, with a distinct action discriminator.
  return JSON.stringify({ action: 'close_remaining', facts: orderReductionFingerprint(state,
    { orderId: state.order.id, desiredRequestedQuantity: state.order.requestedQuantity, adjustments: [] }) })
}

export function projectCloseRemaining(state: CloseRemainingState):
  { success: true; projection: CloseRemainingProjection } | CloseRemainingFailure {
  const { order } = state
  if (isTerminalOrder(order)) return fail('ORDER_TERMINAL', 'Đơn đã kết thúc; không thể dừng phần còn lại lần nữa.')
  const checked = validateOrderFulfillment(order, state.reservations, state.shipments)
  if (!checked.success) return checked
  if (checked.shippedQuantity === 0 || checked.shippedQuantity === order.requestedQuantity) {
    return fail('NOT_PARTIALLY_SHIPPED', 'Chỉ dừng phần còn lại khi đơn đã xuất một phần, chưa xuất đủ.')
  }
  if (order.status !== 'partially_shipped' || !order.variety?.trim() ||
    !state.contacts.some(c => c.id === order.customerId && c.roles.includes('customer'))) {
    return fail('INVALID_STATE', 'Trạng thái đơn hoặc khách hàng không khớp dữ liệu đã xuất.')
  }
  const rs = state.reservations.filter(r => r.orderId === order.id)
  const batchIds = new Set(rs.filter(r => r.sourceType === 'own_batch').map(r => r.batchId))
  for (const r of rs) {
    const b = state.batches.find(b => b.id === r.batchId)
    if ((r.sourceType === 'own_batch' && (!b || ![b.initialQuantity, b.currentQuantity, b.readyQuantity].every(nonNegativeInteger) ||
      b.readyQuantity > b.currentQuantity || b.currentQuantity > b.initialQuantity ||
      b.variety.trim().toLowerCase() !== order.variety.trim().toLowerCase())) ||
      (r.sourceType === 'external_supplier' && !state.contacts.some(c => c.id === r.supplierId && c.roles.includes('supplier')))) {
      return fail('INVALID_STATE', 'Tham chiếu lô hoặc nhà vườn của nguồn giữ không hợp lệ.')
    }
  }
  if (state.reservations.some(r => r.sourceType === 'own_batch' && batchIds.has(r.batchId) && !validReservation(r))) {
    return fail('INVALID_STATE', 'Cam kết khác trên lô không hợp lệ.')
  }
  const releases = rs.filter(r => r.status === 'active').map(before => ({ before: { ...before },
    after: { ...before, status: 'released' as const }, releasedOutstanding: remainingReservationQuantity(before) }))
  const afterSources = state.reservations.map(r => releases.find(e => e.before.id === r.id)?.after ?? r)
  const coverageAfter = safeSum(afterSources.filter(r => r.orderId === order.id).map(coveredQuantityForReservation))
  if (coverageAfter !== checked.shippedQuantity) return fail('INVALID_STATE', 'Cam kết sau khi dừng không khớp số đã xuất.')
  const batchEffects: CloseRemainingProjection['batchEffects'] = []
  for (const b of state.batches.filter(b => batchIds.has(b.id))) {
    if (safeSum(state.reservations.filter(r => r.batchId === b.id).map(remainingReservationQuantity)) === undefined) {
      return fail('INVALID_STATE', 'Tổng cam kết lô vượt giới hạn số nguyên an toàn.')
    }
    batchEffects.push({ batchId: b.id, livingQuantity: b.currentQuantity, readyQuantity: b.readyQuantity,
      availableBefore: availableQuantityForBatch(b, state.reservations), availableAfter: availableQuantityForBatch(b, afterSources),
      shortageBefore: commitmentShortageForBatch(b, state.reservations), shortageAfter: commitmentShortageForBatch(b, afterSources) })
  }
  const projection: CloseRemainingProjection = { orderBefore: { ...order }, orderAfter: { ...order, status: 'closed_remaining' },
    customer: structuredClone(state.contacts.find(c => c.id === order.customerId)!),
    requestedQuantity: order.requestedQuantity, shippedQuantity: checked.shippedQuantity,
    stoppedQuantity: order.requestedQuantity - checked.shippedQuantity, coverageBefore: checked.coverage,
    coverageAfter, releasedOutstanding: checked.outstanding, releases, batchEffects,
    sources: rs.map(before => ({ before: structuredClone(before), after: structuredClone(afterSources.find(r => r.id === before.id)!),
      sourceLabel: before.sourceType === 'own_batch' ? state.batches.find(b => b.id === before.batchId)!.code :
        state.contacts.find(c => c.id === before.supplierId)!.name })),
    completedShipments: state.shipments.filter(s => s.orderId === order.id && s.status === 'completed').map(s => structuredClone(s)),
    cancelledPlans: state.shipments.filter(s => s.orderId === order.id && s.status === 'planned')
      .map(before => ({ before: structuredClone(before), after: { ...structuredClone(before), status: 'cancelled' } })) }
  return validCloseRemainingProjection(projection, order.id) ? { success: true, projection } :
    fail('INVALID_STATE', 'Dữ liệu xem trước chưa đủ để lưu và bảo toàn lịch sử dừng đơn.')
}

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (record(value)) return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => [key, canonical(v)]))
  return value
}
export const sameCompletionFacts = (a: unknown, b: unknown): boolean => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
export function validCloseRemainingMarker(payload: unknown, orderId: string): payload is {
  operationId: string; approvedFingerprint: string; intentKey: string; projection: CloseRemainingProjection
} {
  return record(payload) && validId(payload.operationId) && validId(payload.approvedFingerprint) &&
    payload.intentKey === closeRemainingIntentKey(orderId, payload.approvedFingerprint) &&
    validCloseRemainingProjection(payload.projection, orderId) &&
    payload.requestedQuantity === payload.projection.requestedQuantity &&
    payload.shippedQuantity === payload.projection.shippedQuantity && payload.stoppedQuantity === payload.projection.stoppedQuantity
}
/** Historical marker validation is deliberately independent of current inventory/state. */
export function validCloseRemainingProjection(value: unknown, orderId: string): value is CloseRemainingProjection {
  try {
    return validHistoricalProjection(value, orderId)
  } catch {
    return false // Malformed persisted payload is corruption, never a storage failure or replay.
  }
}
function validHistoricalProjection(value: unknown, orderId: string): value is CloseRemainingProjection {
  if (!record(value) || !record(value.orderBefore) || !record(value.orderAfter) || value.orderBefore.id !== orderId ||
    value.orderAfter.id !== orderId || value.orderBefore.status !== 'partially_shipped' || value.orderAfter.status !== 'closed_remaining' ||
    !['requestedQuantity', 'shippedQuantity', 'stoppedQuantity', 'coverageBefore', 'coverageAfter', 'releasedOutstanding']
      .every(k => typeof value[k] === 'number' && nonNegativeInteger(value[k] as number)) ||
    !Array.isArray(value.releases) || !Array.isArray(value.cancelledPlans) || !Array.isArray(value.batchEffects) ||
    !Array.isArray(value.sources) || !Array.isArray(value.completedShipments) || !record(value.customer)) return false
  const p = value as CloseRemainingProjection
  if (!validId(p.orderBefore.customerId) || p.customer.id !== p.orderBefore.customerId || !validId(p.customer.name) ||
    !Array.isArray(p.customer.roles) || !p.customer.roles.includes('customer') ||
    typeof p.orderBefore.variety !== 'string' || !p.orderBefore.variety.trim() ||
    (p.orderBefore.unitPrice !== undefined && !nonNegativeInteger(p.orderBefore.unitPrice)) ||
    (p.orderBefore.note !== undefined && typeof p.orderBefore.note !== 'string') ||
    (p.orderBefore.requestedDate !== undefined && typeof p.orderBefore.requestedDate !== 'string') ||
    p.shippedQuantity <= 0 || p.stoppedQuantity <= 0 || p.shippedQuantity + p.stoppedQuantity !== p.requestedQuantity ||
    p.orderBefore.requestedQuantity !== p.requestedQuantity || p.orderAfter.requestedQuantity !== p.requestedQuantity ||
    !sameCompletionFacts({ ...p.orderBefore, status: 'closed_remaining' }, p.orderAfter) ||
    p.coverageBefore > p.requestedQuantity || p.coverageAfter !== p.shippedQuantity ||
    p.coverageBefore - p.coverageAfter !== p.releasedOutstanding) return false
  const ids = new Set<string>()
  for (const e of p.releases) {
    if (!record(e) || !record(e.before) || !record(e.after) || !validId(e.before.id) || ids.has(e.before.id) ||
      e.before.orderId !== orderId || !validReservation(e.before) || !validReservation(e.after) ||
      e.before.status !== 'active' || e.after.status !== 'released' || e.releasedOutstanding !== remainingReservationQuantity(e.before) ||
      !sameCompletionFacts({ ...e.before, status: 'released' }, e.after)) return false
    ids.add(e.before.id)
  }
  if (safeSum(p.releases.map(e => e.releasedOutstanding)) !== p.releasedOutstanding) return false
  ids.clear()
  for (const e of p.cancelledPlans) {
    if (!record(e) || !record(e.before) || !record(e.after) || !validId(e.before.id) || ids.has(e.before.id) ||
      e.before.orderId !== orderId || e.before.status !== 'planned' || e.after.status !== 'cancelled' ||
      !Number.isSafeInteger(e.before.plannedQuantity) || e.before.plannedQuantity <= 0 || e.before.shippedQuantity !== 0 ||
      !e.before.lines?.length || safeSum(e.before.lines.map(l => l.quantity)) !== e.before.plannedQuantity ||
      !sameCompletionFacts({ ...e.before, status: 'cancelled' }, e.after)) return false
    const seen = new Set<string>()
    for (const l of e.before.lines) {
      const r = p.releases.find(r => r.before.id === l.reservationId)?.before
      if (!r || seen.has(l.reservationId) || !sameSource(l, r) || !Number.isSafeInteger(l.quantity) || l.quantity <= 0) return false
      seen.add(l.reservationId)
    }
    ids.add(e.before.id)
  }
  if (!plannedReservationAllocations(p.releases.map(e => e.before), p.cancelledPlans.map(e => e.before), [orderId]).success) return false
  const sourceIds = new Set<string>()
  for (const e of p.sources) {
    if (!record(e) || !record(e.before) || !record(e.after) || !validId(e.before.id) || sourceIds.has(e.before.id) ||
      e.before.orderId !== orderId || !validReservation(e.before) || !validReservation(e.after) || !validId(e.sourceLabel)) return false
    const release = p.releases.find(r => r.before.id === e.before.id)
    if (e.before.status === 'active' ? !release || !sameCompletionFacts(e.before, release.before) || !sameCompletionFacts(e.after, release.after) :
      !sameCompletionFacts(e.before, e.after)) return false
    sourceIds.add(e.before.id)
  }
  if (p.releases.some(r => !sourceIds.has(r.before.id))) return false
  const before = validateOrderFulfillment(p.orderBefore, p.sources.map(e => e.before),
    [...p.completedShipments, ...p.cancelledPlans.map(e => e.before)])
  const after = validateOrderFulfillment(p.orderAfter, p.sources.map(e => e.after),
    [...p.completedShipments, ...p.cancelledPlans.map(e => e.after)])
  if (!before.success || !after.success || before.shippedQuantity !== p.shippedQuantity || before.coverage !== p.coverageBefore ||
    before.outstanding !== p.releasedOutstanding || after.outstanding !== 0 || after.coverage !== p.coverageAfter) return false
  ids.clear()
  const batchIds = new Set(p.sources.filter(e => e.before.sourceType === 'own_batch').map(e => e.before.batchId))
  if (p.batchEffects.length !== batchIds.size) return false
  return p.batchEffects.every(e => {
    if (!record(e) || !validId(e.batchId) || ids.has(e.batchId) || !batchIds.has(e.batchId)) return false
    ids.add(e.batchId)
    return [e.livingQuantity, e.readyQuantity, e.availableBefore, e.availableAfter, e.shortageBefore, e.shortageAfter]
      .every(nonNegativeInteger) && e.readyQuantity <= e.livingQuantity && e.availableAfter >= e.availableBefore &&
      e.availableAfter <= e.readyQuantity && e.shortageAfter <= e.shortageBefore
  })
}
