import { db } from '../data/db'
import { createDomainEvent } from '../analytics/events'
import { formatQuantity } from '../domain/quantity'
import {
  type OrderReductionPlan, type OrderReductionState, type OrderReductionProjection, type ReconciliationFailure,
  orderReductionFingerprint, orderReductionIntentKey, projectOrderReduction, validateOrderReductionPlan
} from '../domain/reconciliation'
import { undoService } from './undoService'

export type ConfirmOrderReductionInput = OrderReductionPlan & { operationId: string; expectedFingerprint: string }
export type OrderReductionResult = {
  success: true; operationId: string; idempotent: boolean; projection: OrderReductionProjection
} | ReconciliationFailure

const tables = [db.orders, db.reservations, db.shipments, db.batches, db.contacts, db.events]
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object'
const copyPlan = (plan: OrderReductionPlan): OrderReductionPlan => ({
  orderId: plan.orderId, desiredRequestedQuantity: plan.desiredRequestedQuantity,
  adjustments: Array.isArray(plan.adjustments) ? plan.adjustments.map(a => ({ ...a })) : plan.adjustments
})

/** Called only inside preview/commit transactions; other orders on source batches matter too. */
async function readState(orderId: string): Promise<OrderReductionState | undefined> {
  const order = await db.orders.get(orderId)
  if (!order) return undefined
  const [allReservations, allShipments, allBatches, allContacts] = await Promise.all([
    db.reservations.toArray(), db.shipments.toArray(), db.batches.toArray(), db.contacts.toArray()
  ])
  const own = allReservations.filter(r => r.orderId === order.id)
  const batchIds = new Set(own.filter(r => r.sourceType === 'own_batch').map(r => r.batchId))
  const reservationIds = new Set(own.map(r => r.id))
  const supplierIds = new Set(own.map(r => r.supplierId))
  const history = await db.events.where('entityId').anyOf([order.id, ...[...batchIds].filter((id): id is string => !!id)])
    .filter(e => (e.entityType === 'order' && e.entityId === order.id) ||
      (e.entityType === 'batch' && batchIds.has(e.entityId))).primaryKeys()
  return { order,
    reservations: allReservations.filter(r => r.orderId === order.id ||
      (r.sourceType === 'own_batch' && batchIds.has(r.batchId))),
    shipments: allShipments.filter(s => s.orderId === order.id || s.lines?.some(l => reservationIds.has(l.reservationId))),
    batches: allBatches.filter(b => batchIds.has(b.id)),
    contacts: allContacts.filter(c => c.id === order.customerId || supplierIds.has(c.id)), historyIds: history }
}

/** Read-only consistent preview. Its token grants no authority until commit re-reads it. */
export async function previewOrderReduction(input: OrderReductionPlan): Promise<
  { success: true; fingerprint: string; projection: OrderReductionProjection } | ReconciliationFailure
> {
  try {
    const plan = copyPlan(input)
    return await db.transaction('r', tables, async () => {
      const invalid = validateOrderReductionPlan(plan)
      if (invalid) return invalid
      const state = await readState(plan.orderId)
      if (!state) return { success: false, code: 'NOT_FOUND', error: 'Đơn hàng không tồn tại.' } as const
      const result = projectOrderReduction(state, plan)
      return result.success ? { ...result, fingerprint: orderReductionFingerprint(state, plan) } :
        { ...result, current: state, currentFingerprint: orderReductionFingerprint(state, plan) }
    })
  } catch (err) {
    console.error('Failed to preview order reduction:', err)
    return { success: false, code: 'STORAGE_ERROR', error: 'Chưa đọc được dữ liệu để xem trước điều chỉnh.' }
  }
}

/** Requested/source/status/history writes share one transaction. Physical stock is read-only. */
export async function reconcileOrderReduction(input: ConfirmOrderReductionInput): Promise<OrderReductionResult> {
  try {
    // Copy mutation intent before the first await; callers cannot change it mid-commit.
    const plan = copyPlan(input)
    const { operationId, expectedFingerprint } = input
    const result = await db.transaction('rw', tables, async (): Promise<OrderReductionResult> => {
      const invalid = validateOrderReductionPlan(plan)
      if (invalid) return invalid
      if (typeof operationId !== 'string' || !operationId.trim() ||
        typeof expectedFingerprint !== 'string' || !expectedFingerprint) {
        return { success: false, code: 'INVALID_INPUT', error: 'Cần mã thao tác và xác nhận bản xem trước hợp lệ.' }
      }
      const intentKey = orderReductionIntentKey(plan)
      const marker = await db.events.where('type').anyOf(['order_reconciled', 'batch_reconciled'])
        .filter(e => isRecord(e.payload) && e.payload.operationId === operationId).first()
      if (marker) {
        const payload = marker.payload
        if (!isRecord(payload) || payload.intentKey !== intentKey) return {
          success: false, code: 'OPERATION_ID_CONFLICT', error: 'Mã thao tác này đã được dùng cho một kế hoạch khác.'
        }
        const projection = payload.projection
        if (payload.trigger !== 'order_reduction' || marker.entityId !== plan.orderId || !isRecord(projection) ||
          !isRecord(projection.orderBefore) || projection.orderBefore.id !== plan.orderId ||
          !isRecord(projection.orderAfter) || projection.orderAfter.id !== plan.orderId ||
          projection.orderAfter.requestedQuantity !== plan.desiredRequestedQuantity ||
          !['coverageBefore', 'coverageAfter', 'shortageBefore', 'shortageAfter'].every(key =>
            typeof projection[key] === 'number' && Number.isSafeInteger(projection[key]) && projection[key] >= 0) ||
          !Array.isArray(projection.adjustments) || !Array.isArray(projection.batchEffects)) {
          return { success: false, code: 'INVALID_STATE', error: 'Lịch sử thao tác chưa xác minh được; không áp dụng lại.' }
        }
        return { success: true, operationId, idempotent: true,
          projection: projection as OrderReductionProjection }
      }
      const state = await readState(plan.orderId)
      if (!state) return { success: false, code: 'NOT_FOUND', error: 'Đơn hàng không tồn tại.' }
      const currentFingerprint = orderReductionFingerprint(state, plan)
      if (currentFingerprint !== expectedFingerprint) return {
        success: false, code: 'PREVIEW_CHANGED', error: 'Đơn, nguồn giữ hoặc chuyến xe đã thay đổi. Hãy xem lại trước khi xác nhận.',
        current: state, currentFingerprint
      }
      const checked = projectOrderReduction(state, plan)
      if (!checked.success) return { ...checked, current: state, currentFingerprint }
      const { projection } = checked
      for (const adjustment of projection.adjustments) {
        if (adjustment.outstandingBefore !== adjustment.outstandingAfter) await db.reservations.put(adjustment.after)
      }
      await db.orders.put(projection.orderAfter)
      await db.events.put(createDomainEvent('order_reconciled', 'order', plan.orderId, {
        operationId, trigger: 'order_reduction', intentKey, projection,
        selectedReservationIds: projection.adjustments.map(a => a.before.id),
        message: `Đã giảm đơn: ${formatQuantity(projection.orderBefore.requestedQuantity)} → ${formatQuantity(projection.orderAfter.requestedQuantity)} cây. Nguồn giữ: ${formatQuantity(projection.coverageBefore)} → ${formatQuantity(projection.coverageAfter)} cây.`
      }))
      for (const effect of projection.batchEffects) {
        const adjustments = projection.adjustments.filter(a => a.before.sourceType === 'own_batch' && a.before.batchId === effect.batchId)
        await db.events.put(createDomainEvent('reservation_reconciled', 'batch', effect.batchId, {
          operationId, trigger: 'order_reduction', orderId: plan.orderId, adjustments, effect,
          coverageBefore: projection.coverageBefore, coverageAfter: projection.coverageAfter,
          shortageBefore: projection.shortageBefore, shortageAfter: projection.shortageAfter,
          message: `Đã điều chỉnh nguồn giữ: ${formatQuantity(effect.outstandingBefore)} → ${formatQuantity(effect.outstandingAfter)} cây đang giữ.`
        }))
      }
      return { success: true, operationId, idempotent: false, projection }
    })
    if (result.success && !result.idempotent) undoService.clearLastMutation()
    return result
  } catch (err) {
    console.error('Failed to reconcile order reduction:', err)
    return { success: false, code: 'STORAGE_ERROR', error: 'Chưa lưu được điều chỉnh. Đơn, nguồn giữ và lịch sử được giữ nguyên.' }
  }
}
