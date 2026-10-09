import { db } from '../data/db'
import { createDomainEvent } from '../analytics/events'
import { formatQuantity } from '../domain/quantity'
import type { Reservation } from '../domain/reservation'
import { batchShortageFingerprint, batchShortageIntentKey, projectBatchShortage, validateBatchShortagePlan,
  type BatchShortagePlan, type BatchShortageState, type BatchShortageProjection, type BatchShortageFailure } from '../domain/batchReconciliation'
import { undoService } from './undoService'

export type ConfirmBatchShortageInput = BatchShortagePlan & { operationId: string; expectedFingerprint: string }
export type BatchShortageResult = { success: true; operationId: string; idempotent: boolean; projection: BatchShortageProjection } | BatchShortageFailure
const tables = [db.orders, db.reservations, db.shipments, db.batches, db.contacts, db.events]
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
const copyPlan = (input: BatchShortagePlan): BatchShortagePlan => ({ sourceBatchId: input.sourceBatchId,
  adjustments: Array.isArray(input.adjustments) ? input.adjustments.map(a => ({ ...a,
    ...(a?.transfer !== undefined ? { transfer: a.transfer && { ...a.transfer } } : {}) })) : input.adjustments })

/** Scope current facts to source/targets, contributing orders and all supply of those orders. */
async function readState(plan: BatchShortagePlan): Promise<BatchShortageState> {
  const [batches, orders, reservations, shipments, contacts, events] = await Promise.all([
    db.batches.toArray(), db.orders.toArray(), db.reservations.toArray(), db.shipments.toArray(), db.contacts.toArray(), db.events.toArray()
  ])
  const planBatchIds = new Set([plan.sourceBatchId, ...plan.adjustments.flatMap(a => a.transfer ? [a.transfer.targetBatchId] : [])])
  const selectedIds = new Set(plan.adjustments.map(a => a.reservationId))
  const orderIds = new Set(reservations.filter(r => (r.batchId && planBatchIds.has(r.batchId)) || selectedIds.has(r.id)).map(r => r.orderId))
  const relevantReservations = reservations.filter(r => orderIds.has(r.orderId) || (r.batchId && planBatchIds.has(r.batchId)))
  const batchIds = new Set([...planBatchIds, ...relevantReservations.flatMap(r => r.batchId ? [r.batchId] : [])])
  const contactIds = new Set([...orders.filter(o => orderIds.has(o.id)).map(o => o.customerId),
    ...relevantReservations.flatMap(r => r.supplierId ? [r.supplierId] : [])])
  const reservationIds = new Set(relevantReservations.map(r => r.id))
  return { sourceBatchId: plan.sourceBatchId, batches: batches.filter(b => batchIds.has(b.id)),
    orders: orders.filter(o => orderIds.has(o.id)), reservations: relevantReservations,
    shipments: shipments.filter(s => orderIds.has(s.orderId) || s.lines?.some(l => reservationIds.has(l.reservationId))),
    contacts: contacts.filter(c => contactIds.has(c.id)), historyIds: events.filter(e =>
      (e.entityType === 'order' && orderIds.has(e.entityId)) || (e.entityType === 'batch' && batchIds.has(e.entityId))).map(e => e.id) }
}

export async function previewBatchShortageReconciliation(input: BatchShortagePlan): Promise<
  { success: true; fingerprint: string; projection: BatchShortageProjection } | BatchShortageFailure
> {
  try {
    const plan = copyPlan(input)
    return await db.transaction('r', tables, async () => {
      const invalid = validateBatchShortagePlan(plan)
      if (invalid) return invalid
      const state = await readState(plan)
      const result = projectBatchShortage(state, plan)
      const fingerprint = batchShortageFingerprint(state, plan)
      return result.success ? { ...result, fingerprint } : { ...result, current: state, currentFingerprint: fingerprint }
    })
  } catch (err) {
    console.error('Failed to preview batch reconciliation:', err)
    return { success: false, code: 'STORAGE_ERROR', error: 'Chưa đọc được dữ liệu để xem trước điều chỉnh lô.' }
  }
}

/** Generated target identity, source changes, order status and all histories commit together. */
export async function reconcileBatchShortage(input: ConfirmBatchShortageInput): Promise<BatchShortageResult> {
  try {
    const plan = copyPlan(input)
    const { operationId, expectedFingerprint } = input
    const result = await db.transaction('rw', tables, async (): Promise<BatchShortageResult> => {
      const invalid = validateBatchShortagePlan(plan)
      if (invalid) return invalid
      if (typeof operationId !== 'string' || !operationId.trim() || typeof expectedFingerprint !== 'string' || !expectedFingerprint) {
        return { success: false, code: 'INVALID_INPUT', error: 'Cần mã thao tác và xác nhận bản xem trước hợp lệ.' }
      }
      const intentKey = batchShortageIntentKey(plan)
      // Same registry as Trigger A, so an ID cannot be reused across trigger/order/batch.
      const marker = await db.events.where('type').anyOf(['order_reconciled', 'batch_reconciled', 'order_closed_remaining'])
        .filter(e => isRecord(e.payload) && e.payload.operationId === operationId).first()
      if (marker) {
        const payload = marker.payload
        if (marker.type === 'order_closed_remaining' || !isRecord(payload) || payload.intentKey !== intentKey || payload.trigger !== 'batch_shortage') {
          return { success: false, code: 'OPERATION_ID_CONFLICT', error: 'Mã thao tác đã được dùng cho kế hoạch khác.' }
        }
        const projection = payload.projection
        if (marker.type !== 'batch_reconciled' || marker.entityType !== 'batch' || marker.entityId !== plan.sourceBatchId ||
          !isRecord(projection) || !isRecord(projection.source) || projection.source.batchId !== plan.sourceBatchId ||
          !Array.isArray(projection.orders) || !Array.isArray(projection.adjustments) || !Array.isArray(projection.targets) ||
          !Array.isArray(projection.targetReservations) || projection.targetReservations.some(t => !isRecord(t) ||
            !isRecord(t.reservation) || typeof t.reservation.id !== 'string' || !t.reservation.id ||
            typeof t.reservation.createdAt !== 'string' || !t.reservation.createdAt)) {
          return { success: false, code: 'INVALID_STATE', error: 'Lịch sử thao tác chưa xác minh được; không áp dụng lại.' }
        }
        return { success: true, operationId, idempotent: true, projection: projection as BatchShortageProjection }
      }
      const state = await readState(plan)
      const currentFingerprint = batchShortageFingerprint(state, plan)
      if (currentFingerprint !== expectedFingerprint) return { success: false, code: 'PREVIEW_CHANGED',
        error: 'Lô, đơn, nguồn giữ hoặc chuyến xe đã thay đổi. Hãy xem lại trước khi xác nhận.', current: state, currentFingerprint }
      const checked = projectBatchShortage(state, plan)
      if (!checked.success) return { ...checked, current: state, currentFingerprint }
      const { projection } = checked
      for (const target of projection.targetReservations) {
        target.reservation.id = `res_${crypto.randomUUID()}`
        target.reservation.createdAt = new Date().toISOString()
      }
      for (const a of projection.adjustments) {
        if (a.outstandingBefore !== a.outstandingAfter) await db.reservations.put(a.after)
      }
      for (const t of projection.targetReservations) await db.reservations.add(t.reservation as Reservation)
      for (const o of projection.orders) {
        await db.orders.put(o.after)
        const adjustments = projection.adjustments.filter(a => a.before.orderId === o.before.id)
        const targetReservations = projection.targetReservations.filter(t => t.reservation.orderId === o.before.id)
        await db.events.put(createDomainEvent('reservation_reconciled', 'order', o.before.id, {
          operationId, trigger: 'batch_shortage', sourceBatchId: plan.sourceBatchId, adjustments, targetReservations, effect: o,
          message: `Đã điều chỉnh nguồn giữ: ${formatQuantity(o.coverageBefore)} → ${formatQuantity(o.coverageAfter)} cây. Còn thiếu ${formatQuantity(o.shortageAfter)} cây cho đơn.`
        }))
      }
      await db.events.put(createDomainEvent('batch_reconciled', 'batch', plan.sourceBatchId, {
        operationId, trigger: 'batch_shortage', intentKey, projection,
        message: `Đã điều chỉnh nguồn giữ trên lô. Thiếu cây đã giữ: ${formatQuantity(projection.source.shortageBefore)} → ${formatQuantity(projection.source.shortageAfter)} cây.`
      }))
      for (const effect of projection.targets) {
        await db.events.put(createDomainEvent('reservation_transferred', 'batch', effect.batchId, {
          operationId, trigger: 'batch_shortage', sourceBatchId: plan.sourceBatchId, effect,
          targetReservations: projection.targetReservations.filter(t => t.reservation.batchId === effect.batchId),
          message: `Đã chuyển vào ${formatQuantity(effect.incomingTransfer)} cây đang giữ. Cây còn bán: ${formatQuantity(effect.availableBefore)} → ${formatQuantity(effect.availableAfter)} cây.`
        }))
      }
      return { success: true, operationId, idempotent: false, projection }
    })
    if (result.success && !result.idempotent) undoService.clearLastMutation()
    return result
  } catch (err) {
    console.error('Failed to reconcile batch shortage:', err)
    return { success: false, code: 'STORAGE_ERROR', error: 'Chưa lưu được điều chỉnh. Lô, đơn, nguồn giữ và lịch sử được giữ nguyên.' }
  }
}
