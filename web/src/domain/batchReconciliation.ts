import type { Batch } from './batch'
import type { Contact } from './contact'
import { type Order, orderShortage } from './order'
import { availableQuantityForBatch, commitmentShortageForBatch } from './quantity'
import { type Reservation, coveredQuantityForReservation, remainingReservationQuantity } from './reservation'
import type { Shipment } from './shipment'
import { nonNegativeInteger, safeSum, validReservation, reduceReservationOutstanding,
  plannedReservationAllocations, type ReconciliationFailure, type ReservationReduction } from './reconciliation'

export type BatchShortagePlan = {
  sourceBatchId: string
  adjustments: { reservationId: string; newOutstanding: number; transfer?: { targetBatchId: string; quantity: number } }[]
}
export type BatchShortageState = {
  sourceBatchId: string; batches: Batch[]; orders: Order[]; reservations: Reservation[]
  shipments: Shipment[]; contacts: Contact[]; historyIds: string[]
}
export type BatchShortageFailure = Omit<ReconciliationFailure, 'current' | 'code' | 'conflict'> & {
  code: ReconciliationFailure['code'] | 'TARGET_UNAVAILABLE' | 'VARIETY_MISMATCH'
  current?: BatchShortageState
  conflict?: ReconciliationFailure['conflict'] & { batchId?: string; availableQuantity?: number; incomingQuantity?: number }
}
export type BatchEffect = {
  batchId: string; livingQuantity: number; readyQuantity: number; outstandingBefore: number; outstandingAfter: number
  availableBefore: number; availableAfter: number; shortageBefore: number; shortageAfter: number
}
export type BatchShortageProjection = {
  source: BatchEffect
  targets: (BatchEffect & { incomingTransfer: number })[]
  orders: { before: Order; after: Order; coverageBefore: number; coverageAfter: number
    shortageBefore: number; shortageAfter: number }[]
  adjustments: (ReservationReduction & { releasedQuantity: number; transferredQuantity: number; plannedQuantity: number })[]
  // Preview has no persistent IDs. Commit fills identity in its transaction before any write.
  targetReservations: { sourceReservationId: string; reservation: Omit<Reservation, 'id' | 'createdAt'> &
    { id?: string; createdAt?: string } }[]
}
const fail = (code: BatchShortageFailure['code'], error: string): BatchShortageFailure => ({ success: false, code, error })
const idValid = (id: string) => typeof id === 'string' && !!id.trim()
const variety = (v: string) => typeof v === 'string' ? v.trim().toLowerCase() : ''
const validBatch = (b: Batch) => !!variety(b.variety) &&
  [b.initialQuantity, b.currentQuantity, b.readyQuantity].every(nonNegativeInteger) &&
  b.readyQuantity <= b.currentQuantity && b.currentQuantity <= b.initialQuantity

export function validateBatchShortagePlan(plan: BatchShortagePlan): BatchShortageFailure | undefined {
  if (!idValid(plan.sourceBatchId) || !Array.isArray(plan.adjustments)) return fail('INVALID_INPUT', 'Cần lô thiếu và danh sách nguồn đã chọn.')
  const seen = new Set<string>()
  for (const a of plan.adjustments) {
    if (!a || !idValid(a.reservationId) || seen.has(a.reservationId) || !nonNegativeInteger(a.newOutstanding) ||
      (a.transfer !== undefined && (!a.transfer || !idValid(a.transfer.targetBatchId) ||
        !Number.isSafeInteger(a.transfer.quantity) || a.transfer.quantity <= 0))) {
      return fail('INVALID_INPUT', 'Mỗi nguồn chỉ chọn một lần; số còn giữ và số chuyển phải là số nguyên hợp lệ.')
    }
    seen.add(a.reservationId)
  }
}

export function batchShortageIntentKey(plan: BatchShortagePlan): string {
  return JSON.stringify({ trigger: 'batch_shortage', sourceBatchId: plan.sourceBatchId,
    adjustments: [...plan.adjustments].sort((a, b) => a.reservationId.localeCompare(b.reservationId))
      .map(a => [a.reservationId, a.newOutstanding, a.transfer ? [a.transfer.targetBatchId, a.transfer.quantity] : null]) })
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)]))
  return value
}
export function batchShortageFingerprint(state: BatchShortageState, plan: BatchShortagePlan): string {
  const records = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id))
  return JSON.stringify(canonical({ intent: batchShortageIntentKey(plan), sourceBatchId: state.sourceBatchId,
    batches: records(state.batches), orders: records(state.orders), reservations: records(state.reservations),
    contacts: records(state.contacts), shipments: records(state.shipments).map(s => ({ ...s,
      lines: s.lines && [...s.lines].sort((a, b) => JSON.stringify(canonical(a)).localeCompare(JSON.stringify(canonical(b)))) })),
    historyIds: [...state.historyIds].sort() }))
}

/** Completed/F facts must agree before touching the remaining commitment. No repairs. */
function validateFulfillment(order: Order, reservations: Reservation[], shipments: Shipment[]): BatchShortageFailure | undefined {
  const completed = shipments.filter(s => s.orderId === order.id && s.status === 'completed')
  const fulfilled = new Map<string, number>()
  for (const s of completed) {
    if (!s.lines?.length || !Number.isSafeInteger(s.shippedQuantity) || s.shippedQuantity <= 0 ||
      s.plannedQuantity !== s.shippedQuantity || safeSum(s.lines.map(l => l.quantity)) !== s.shippedQuantity) {
      return fail('INVALID_STATE', 'Lịch sử xuất chưa xác minh được; không sửa phần đã xuất.')
    }
    const seen = new Set<string>()
    for (const line of s.lines) {
      const r = reservations.find(r => r.id === line.reservationId && r.orderId === order.id)
      const total = safeSum([fulfilled.get(line.reservationId) ?? 0, line.quantity])
      if (!r || seen.has(line.reservationId) || !Number.isSafeInteger(line.quantity) || line.quantity <= 0 ||
        line.sourceType !== r.sourceType || line.batchId !== r.batchId || line.supplierId !== r.supplierId || total === undefined) {
        return fail('INVALID_STATE', 'Phân bổ lịch sử xuất không khớp nguồn giữ.')
      }
      seen.add(line.reservationId)
      fulfilled.set(line.reservationId, total)
    }
  }
  if (reservations.some(r => (r.fulfilledQuantity ?? 0) !== (fulfilled.get(r.id) ?? 0))) {
    return fail('INVALID_STATE', 'Số đã xuất của nguồn giữ không khớp lịch sử chuyến xe.')
  }
  const shipped = safeSum(completed.map(s => s.shippedQuantity))
  if (shipped === undefined) return fail('INVALID_STATE', 'Tổng đã xuất không hợp lệ.')
  if (shipped >= order.requestedQuantity) return fail('ALREADY_SHIPPED', 'Đơn đã xuất đủ không được điều chỉnh nguồn.')
  if ((order.status === 'partially_shipped') !== (shipped > 0)) {
    return fail('INVALID_STATE', 'Trạng thái đơn không khớp lịch sử xuất; không tự sửa.')
  }
}

export function projectBatchShortage(state: BatchShortageState, plan: BatchShortagePlan):
  { success: true; projection: BatchShortageProjection } | BatchShortageFailure {
  const invalid = validateBatchShortagePlan(plan)
  if (invalid) return invalid
  const source = state.batches.find(b => b.id === plan.sourceBatchId)
  if (!source || state.sourceBatchId !== plan.sourceBatchId) return fail('NOT_FOUND', 'Lô thiếu không tồn tại.')
  if (!validBatch(source)) return fail('INVALID_STATE', 'Số lượng vật lý của lô không hợp lệ.')
  const intended = state.reservations.filter(r => plan.adjustments.some(a => a.reservationId === r.id))
  if (intended.some(r => state.orders.some(o => o.id === r.orderId && o.status === 'closed_remaining'))) {
    return fail('ORDER_TERMINAL', 'Kế hoạch chứa đơn đã dừng phần còn lại; không áp dụng bất kỳ dòng nào.')
  }
  const selected = plan.adjustments.map(a => state.reservations.find(r => r.id === a.reservationId))
  if (selected.some(r => !r || r.sourceType !== 'own_batch' || r.batchId !== source.id ||
    r.status !== 'active' || remainingReservationQuantity(r) <= 0)) {
    return fail('INVALID_SELECTION', 'Chỉ chọn nguồn đang giữ chưa xuất trên chính lô thiếu; không chuyển chuỗi hoặc nguồn ngoài.')
  }
  const affectedIds = [...new Set(selected.map(r => r!.orderId))].sort()
  const orders = affectedIds.map(id => state.orders.find(o => o.id === id))
  if (orders.some(o => !o)) return fail('INVALID_STATE', 'Đơn của nguồn giữ không tồn tại.')
  for (const order of orders as Order[]) {
    if (order.status === 'cancelled') return fail('ORDER_CANCELLED', 'Không điều chỉnh nguồn của đơn đã hủy.')
    if (order.status === 'shipped') return fail('ALREADY_SHIPPED', 'Không điều chỉnh nguồn của đơn đã xuất đủ.')
    if (!Number.isSafeInteger(order.requestedQuantity) || order.requestedQuantity <= 0 || !variety(order.variety) ||
      !['open', 'partially_reserved', 'reserved', 'partially_shipped'].includes(order.status) ||
      !state.contacts.some(c => c.id === order.customerId && c.roles.includes('customer'))) {
      return fail('INVALID_STATE', 'Đơn hoặc khách hàng chưa xác minh được.')
    }
    const rs = state.reservations.filter(r => r.orderId === order.id)
    for (const r of rs) {
      const b = state.batches.find(b => b.id === r.batchId)
      if (!validReservation(r) || (r.sourceType === 'own_batch' && (!b || !validBatch(b) || variety(b.variety) !== variety(order.variety))) ||
        (r.sourceType === 'external_supplier' && !state.contacts.some(c => c.id === r.supplierId && c.roles.includes('supplier')))) {
        return fail('INVALID_STATE', 'Nguồn giữ hoặc tham chiếu lô/nhà vườn không hợp lệ.')
      }
    }
    const c = safeSum(rs.map(coveredQuantityForReservation))
    if (c === undefined || c > order.requestedQuantity) return fail('INVALID_STATE', 'Coverage hiện tại không hợp lệ hoặc vượt số đặt.')
    const fulfillmentError = validateFulfillment(order, rs, state.shipments)
    if (fulfillmentError) return fulfillmentError
  }
  const touchedBatchIds = new Set([source.id, ...plan.adjustments.flatMap(a => a.transfer ? [a.transfer.targetBatchId] : [])])
  for (const r of state.reservations.filter(r => r.batchId && touchedBatchIds.has(r.batchId))) {
    const order = state.orders.find(o => o.id === r.orderId)
    const batch = state.batches.find(b => b.id === r.batchId)
    if (r.sourceType !== 'own_batch' || !validReservation(r) || !order || !batch || variety(order.variety) !== variety(batch.variety)) {
      return fail('INVALID_STATE', 'Cam kết trên lô có dữ liệu hoặc tham chiếu không hợp lệ.')
    }
  }
  const relatedShipments = state.shipments.filter(s => affectedIds.includes(s.orderId) ||
    s.lines?.some(l => selected.some(r => r!.id === l.reservationId)))
  if (relatedShipments.some(s => s.status === 'completed' && s.lines?.some(l => {
    const r = state.reservations.find(r => r.id === l.reservationId)
    return !r || r.orderId !== s.orderId
  }))) return fail('INVALID_STATE', 'Lịch sử chuyến đã xuất tham chiếu sai đơn hoặc nguồn.')
  const planned = plannedReservationAllocations(state.reservations.filter(r => affectedIds.includes(r.orderId)), relatedShipments, affectedIds)
  if (!planned.success) return planned as BatchShortageFailure
  const adjustments: BatchShortageProjection['adjustments'] = []
  const targetReservations: BatchShortageProjection['targetReservations'] = []
  const incoming = new Map<string, number>()
  for (const input of [...plan.adjustments].sort((a, b) => a.reservationId.localeCompare(b.reservationId))) {
    const before = state.reservations.find(r => r.id === input.reservationId)!
    const reduced = reduceReservationOutstanding(before, input.newOutstanding)
    if (!reduced.success) return reduced as BatchShortageFailure
    const p = planned.allocations.get(before.id)
    if (p && input.newOutstanding < p.quantity) return { ...fail('PLANNED_ALLOCATION_CONFLICT', 'Số còn giữ thấp hơn phân bổ chuyến chờ xuất.'),
      conflict: { reservationId: before.id, shipmentIds: p.shipmentIds, plannedQuantity: p.quantity, newOutstanding: input.newOutstanding } }
    const transferredQuantity = input.transfer?.quantity ?? 0
    const reduction = remainingReservationQuantity(before) - input.newOutstanding
    if (transferredQuantity > reduction) return fail('INVALID_INPUT', 'Lượng chuyển vượt phần giảm trên nguồn.')
    adjustments.push({ before: { ...before }, after: reduced.reservation, outstandingBefore: remainingReservationQuantity(before),
      outstandingAfter: input.newOutstanding, plannedQuantity: p?.quantity ?? 0, transferredQuantity, releasedQuantity: reduction - transferredQuantity })
    if (input.transfer) {
      const target = state.batches.find(b => b.id === input.transfer!.targetBatchId)
      if (input.transfer.targetBatchId === source.id) return fail('INVALID_INPUT', 'Lô đích phải khác lô nguồn; không chuyển vòng.')
      if (!target) return fail('NOT_FOUND', 'Lô đích không tồn tại.')
      if (!validBatch(target)) return fail('INVALID_STATE', 'Số lượng vật lý lô đích không hợp lệ.')
      if (variety(target.variety) !== variety(source.variety) ||
        variety(target.variety) !== variety(state.orders.find(o => o.id === before.orderId)!.variety)) {
        return fail('VARIETY_MISMATCH', 'Chỉ chuyển sang lô cùng giống với lô nguồn và đơn.')
      }
      const total = safeSum([incoming.get(target.id) ?? 0, transferredQuantity])
      if (total === undefined) return fail('INVALID_INPUT', 'Tổng lượng chuyển vượt giới hạn số nguyên an toàn.')
      incoming.set(target.id, total)
      targetReservations.push({ sourceReservationId: before.id, reservation: { orderId: before.orderId, sourceType: 'own_batch',
        batchId: target.id, quantity: transferredQuantity, fulfilledQuantity: 0, status: 'active' } })
    }
  }
  const after = state.reservations.map(r => adjustments.find(a => a.before.id === r.id)?.after ?? r)
  const drafts: Reservation[] = targetReservations.map((t, i) => ({ ...t.reservation, id: `preview_${i}`, createdAt: '' }))
  const allAfter = [...after, ...drafts]
  const effect = (batch: Batch): BatchEffect | undefined => {
    const rs = state.reservations.filter(r => r.sourceType === 'own_batch' && r.batchId === batch.id)
    const next = allAfter.filter(r => r.sourceType === 'own_batch' && r.batchId === batch.id)
    const outstandingBefore = safeSum(rs.map(remainingReservationQuantity))
    const outstandingAfter = safeSum(next.map(remainingReservationQuantity))
    if (outstandingBefore === undefined || outstandingAfter === undefined) return undefined
    return { batchId: batch.id, livingQuantity: batch.currentQuantity, readyQuantity: batch.readyQuantity,
      outstandingBefore, outstandingAfter, availableBefore: availableQuantityForBatch(batch, state.reservations),
      availableAfter: availableQuantityForBatch(batch, allAfter), shortageBefore: commitmentShortageForBatch(batch, state.reservations),
      shortageAfter: commitmentShortageForBatch(batch, allAfter) }
  }
  const sourceEffect = effect(source)
  if (!sourceEffect) return fail('INVALID_STATE', 'Tổng cam kết lô vượt giới hạn số nguyên an toàn.')
  if (sourceEffect.shortageBefore === 0 || sourceEffect.shortageAfter >= sourceEffect.shortageBefore) {
    return fail('NO_OP', 'Kế hoạch phải giảm thực sự lượng thiếu cây đã giữ trên lô.')
  }
  const targets: BatchShortageProjection['targets'] = []
  for (const [batchId, incomingTransfer] of [...incoming].sort(([a], [b]) => a.localeCompare(b))) {
    const e = effect(state.batches.find(b => b.id === batchId)!)
    if (!e) return fail('INVALID_STATE', 'Tổng cam kết lô đích vượt giới hạn số nguyên an toàn.')
    if (e.availableBefore <= 0 || incomingTransfer > e.availableBefore || e.shortageAfter !== 0) return {
      ...fail('TARGET_UNAVAILABLE', 'Lô đích không đủ cây còn bán cho tổng lượng chuyển vào.'),
      conflict: { batchId, availableQuantity: e.availableBefore, incomingQuantity: incomingTransfer }
    }
    targets.push({ ...e, incomingTransfer })
  }
  const orderEffects: BatchShortageProjection['orders'] = []
  for (const before of orders as Order[]) {
    const coverageBefore = safeSum(state.reservations.filter(r => r.orderId === before.id).map(coveredQuantityForReservation))!
    const coverageAfter = safeSum(allAfter.filter(r => r.orderId === before.id).map(coveredQuantityForReservation))
    if (coverageAfter === undefined) return fail('INVALID_STATE', 'Tổng coverage sau điều chỉnh không hợp lệ.')
    if (coverageAfter > before.requestedQuantity || coverageAfter > coverageBefore) return fail('COVERAGE_EXCEEDS_REQUESTED', 'Chuyển nguồn không được tăng coverage hoặc vượt số đặt.')
    const afterOrder: Order = { ...before, status: before.status === 'partially_shipped' ? 'partially_shipped' :
      coverageAfter === 0 ? 'open' : coverageAfter === before.requestedQuantity ? 'reserved' : 'partially_reserved' }
    orderEffects.push({ before: { ...before }, after: afterOrder, coverageBefore, coverageAfter,
      shortageBefore: orderShortage(before, state.reservations), shortageAfter: orderShortage(afterOrder, allAfter) })
  }
  return { success: true, projection: { source: sourceEffect, targets, orders: orderEffects, adjustments, targetReservations } }
}
