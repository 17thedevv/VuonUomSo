import { db } from '../data/db'
import { createDomainEvent } from '../analytics/events'
import { formatQuantity } from '../domain/quantity'
import { closeRemainingFingerprint, closeRemainingIntentKey, projectCloseRemaining, validCloseRemainingMarker,
  type CloseRemainingState, type CloseRemainingProjection, type CloseRemainingFailure } from '../domain/orderCompletion'
import { undoService } from './undoService'

export type CloseOrderRemainingInput = { orderId: string; operationId: string; expectedFingerprint: string }
export type CloseOrderRemainingResult = { success: true; operationId: string; idempotent: boolean;
  projection: CloseRemainingProjection } | CloseRemainingFailure
const tables = [db.orders, db.reservations, db.shipments, db.batches, db.contacts, db.events]
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

async function readState(orderId: string): Promise<CloseRemainingState | undefined> {
  const order = await db.orders.get(orderId)
  if (!order) return undefined
  const [reservations, shipments, batches, contacts] = await Promise.all([
    db.reservations.toArray(), db.shipments.toArray(), db.batches.toArray(), db.contacts.toArray()
  ])
  const sources = reservations.filter(r => r.orderId === order.id)
  const batchIds = new Set(sources.filter(r => r.sourceType === 'own_batch').map(r => r.batchId))
  const sourceIds = new Set(sources.map(r => r.id))
  const contactIds = new Set([order.customerId, ...sources.map(r => r.supplierId)])
  const historyIds = await db.events.filter(e => (e.entityType === 'order' && e.entityId === order.id) ||
    (e.entityType === 'batch' && batchIds.has(e.entityId))).primaryKeys()
  return { order, reservations: reservations.filter(r => r.orderId === order.id ||
    (r.sourceType === 'own_batch' && batchIds.has(r.batchId))),
    shipments: shipments.filter(s => s.orderId === order.id || s.lines?.some(l => sourceIds.has(l.reservationId))),
    batches: batches.filter(b => batchIds.has(b.id)), contacts: contacts.filter(c => contactIds.has(c.id)), historyIds }
}

export async function previewCloseOrderRemaining(input: { orderId: string }): Promise<
  { success: true; fingerprint: string; projection: CloseRemainingProjection } | CloseRemainingFailure> {
  const { orderId } = input
  try {
    if (typeof orderId !== 'string' || !orderId.trim()) return { success: false, code: 'INVALID_INPUT', error: 'Cần chọn đơn hàng.' }
    return await db.transaction('r', tables, async () => {
      const state = await readState(orderId)
      if (!state) return { success: false, code: 'NOT_FOUND', error: 'Đơn hàng không tồn tại.' } as const
      const result = projectCloseRemaining(state)
      const fingerprint = closeRemainingFingerprint(state)
      return result.success ? { ...result, fingerprint } : { ...result, current: state, currentFingerprint: fingerprint }
    })
  } catch (err) {
    console.error('Failed to preview close remaining:', err)
    return { success: false, code: 'STORAGE_ERROR', error: 'Chưa đọc được dữ liệu để xem trước.' }
  }
}

/** Validate the complete cascade before any write. Batches are only read in this transaction. */
export async function closeOrderRemaining(input: CloseOrderRemainingInput): Promise<CloseOrderRemainingResult> {
  const { orderId, operationId, expectedFingerprint } = input
  try {
    const result = await db.transaction('rw', tables, async (): Promise<CloseOrderRemainingResult> => {
      if (![orderId, operationId, expectedFingerprint].every(v => typeof v === 'string' && !!v.trim())) {
        return { success: false, code: 'INVALID_INPUT', error: 'Cần đơn, mã thao tác và xác nhận bản xem trước.' }
      }
      const intentKey = closeRemainingIntentKey(orderId, expectedFingerprint)
      const markers = await db.events.where('type').anyOf(['order_reconciled', 'batch_reconciled', 'order_closed_remaining'])
        .filter(e => record(e.payload) && e.payload.operationId === operationId).toArray()
      if (markers.length > 1) return { success: false, code: 'INVALID_STATE', error: 'Mã thao tác có lịch sử trùng lặp.' }
      const marker = markers[0]
      if (marker) {
        const p = marker.payload
        if (!record(p) || marker.type !== 'order_closed_remaining' || marker.entityType !== 'order' ||
          marker.entityId !== orderId || p.intentKey !== intentKey) {
          return { success: false, code: 'OPERATION_ID_CONFLICT', error: 'Mã thao tác đã được dùng cho một xác nhận khác.' }
        }
        if (p.approvedFingerprint !== expectedFingerprint || !validCloseRemainingMarker(p, orderId)) {
          return { success: false, code: 'INVALID_STATE', error: 'Lịch sử dừng đơn chưa xác minh được; không áp dụng lại.' }
        }
        return { success: true, operationId, idempotent: true, projection: p.projection }
      }
      const state = await readState(orderId)
      if (!state) return { success: false, code: 'NOT_FOUND', error: 'Đơn hàng không tồn tại.' }
      const currentFingerprint = closeRemainingFingerprint(state)
      if (currentFingerprint !== expectedFingerprint) return { success: false, code: 'PREVIEW_CHANGED',
        error: 'Đơn, nguồn hoặc chuyến xuất đã thay đổi. Hãy xem lại và xác nhận lần nữa.', current: state, currentFingerprint }
      const checked = projectCloseRemaining(state)
      if (!checked.success) return checked
      const { projection } = checked
      for (const e of projection.releases) await db.reservations.put(e.after)
      for (const e of projection.cancelledPlans) await db.shipments.put(e.after)
      await db.orders.put(projection.orderAfter)
      for (const e of projection.releases) {
        await db.events.put(createDomainEvent('reservation_released', 'order', orderId, {
          operationId, reservationId: e.before.id, orderId, sourceType: e.before.sourceType,
          batchId: e.before.batchId, supplierId: e.before.supplierId, quantity: e.before.quantity,
          releasedQuantity: e.releasedOutstanding, fulfilledQuantity: e.before.fulfilledQuantity ?? 0,
          message: `Đã nhả ${formatQuantity(e.releasedOutstanding)} cây chưa xuất do dừng phần còn lại của đơn.`
        }))
        if (e.before.sourceType === 'own_batch') await db.events.put(createDomainEvent('reservation_released', 'batch', e.before.batchId!, {
          operationId, reservationId: e.before.id, orderId, quantity: e.before.quantity,
          releasedQuantity: e.releasedOutstanding, fulfilledQuantity: e.before.fulfilledQuantity ?? 0,
          message: `Đã nhả ${formatQuantity(e.releasedOutstanding)} cây chưa xuất; cây còn bán được tính lại.`
        }))
      }
      for (const e of projection.cancelledPlans) await db.events.put(createDomainEvent('shipment_cancelled', 'order', orderId, {
        operationId, shipmentId: e.before.id, plannedQuantity: e.before.plannedQuantity,
        message: 'Đã hủy chuyến chờ xuất do dừng phần còn lại của đơn.'
      }))
      await db.events.put(createDomainEvent('order_closed_remaining', 'order', orderId, {
        operationId, intentKey, approvedFingerprint: expectedFingerprint, projection,
        requestedQuantity: projection.requestedQuantity, shippedQuantity: projection.shippedQuantity, stoppedQuantity: projection.stoppedQuantity,
        message: `Đã xuất ${formatQuantity(projection.shippedQuantity)} / ${formatQuantity(projection.requestedQuantity)} cây; dừng ${formatQuantity(projection.stoppedQuantity)} cây còn lại.`
      }))
      return { success: true, operationId, idempotent: false, projection }
    })
    if (result.success && !result.idempotent) undoService.clearLastMutation()
    return result
  } catch (err) {
    console.error('Failed to close remaining:', err)
    return { success: false, code: 'STORAGE_ERROR', error: 'Chưa lưu được. Đơn, nguồn giữ và chuyến xuất được giữ nguyên.' }
  }
}
