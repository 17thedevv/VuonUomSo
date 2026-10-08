import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { batchRepository, contactRepository, orderRepository, reservationRepository, shipmentRepository } from '../../data/repositories'
import type { Batch } from '../../domain/batch'
import type { Reservation } from '../../domain/reservation'
import type { Order } from '../../domain/order'
import { formatShortDate } from '../../domain/date'
import { remainingReservationQuantity } from '../../domain/reservation'
import { availableQuantityForBatch, formatQuantity } from '../../domain/quantity'
import type { BatchShortageProjection } from '../../domain/batchReconciliation'
import { previewBatchShortageReconciliation, reconcileBatchShortage } from '../../services/batchReconciliationService'
import { PrimaryButton } from '../../shared/components/PrimaryButton'
import { OrderActionDialog } from '../orders/OrderActionDialog'
import { useConfirmation } from '../reconciliation/useConfirmation'
import { AbsoluteQuantity, Impact, ReconciliationError } from '../reconciliation/ReconciliationFields'
import { quantityDraft, type QuantityDraft } from '../reconciliation/quantityDraft'

type Draft = { outstanding: QuantityDraft; transfer?: { targetBatchId: string; quantity: QuantityDraft } }
export function BatchReconciliationModal({ batch, onClose, onSuccess }: {
  batch: Batch; onClose: () => void; onSuccess: (projection: BatchShortageProjection, transferMessage: string) => Promise<void>
}) {
  const [rows, setRows] = useState<{ reservation: Reservation; customer: string; order?: Order; planned: number }[]>([])
  const [targets, setTargets] = useState<{ batch: Batch; available: number }[]>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [loadError, setLoadError] = useState(false)
  const refresh = useCallback(async () => {
    const [reservations, batches, orders, contacts, shipments] = await Promise.all([reservationRepository.getAll(),
      batchRepository.getAll(), orderRepository.getAll(), contactRepository.getAll(), shipmentRepository.getAll()])
    const next = reservations.filter(r => r.sourceType === 'own_batch' && r.batchId === batch.id && r.status === 'active' && remainingReservationQuantity(r) > 0)
      .map(reservation => ({ reservation, order: orders.find(o => o.id === reservation.orderId), customer: contacts.find(c => c.id === orders.find(o => o.id === reservation.orderId)?.customerId)?.name ?? 'Khách hàng',
        planned: shipments.filter(s => s.status === 'planned').flatMap(s => s.lines ?? [])
          .filter(l => l.reservationId === reservation.id).reduce((sum, l) => sum + l.quantity, 0) }))
    setRows(previous => [...next, ...previous.filter(row => !next.some(n => n.reservation.id === row.reservation.id))])
    const source = batches.find(b => b.id === batch.id) ?? batch
    setTargets(batches.filter(b => b.id !== batch.id && b.variety.trim().toLowerCase() === source.variety.trim().toLowerCase())
      .map(b => ({ batch: b, available: availableQuantityForBatch(b, reservations) })).filter(t => t.available > 0))
    setLoadError(false)
  }, [batch])
  useEffect(() => { refresh().catch(() => setLoadError(true)) }, [refresh])
  const flow = useConfirmation(previewBatchShortageReconciliation, reconcileBatchShortage, refresh, async projection => {
    const transferMessage = projection.targets.map(t => `Đã chuyển ${formatQuantity(t.incomingTransfer)} cây: ${batch.code} → ${targets.find(target => target.batch.id === t.batchId)?.batch.code ?? t.batchId}.`).join(' ')
    await onSuccess(projection, transferMessage)
  })
  const update = (id: string, draft: Draft) => { flow.invalidate(); setDrafts(previous => ({ ...previous, [id]: draft })) }
  const valid = Object.values(drafts).every(d => d.outstanding.value !== null && Number.isSafeInteger(d.outstanding.value) && d.outstanding.value >= 0 &&
    (!d.transfer || (!!d.transfer.targetBatchId && d.transfer.quantity.value !== null && Number.isSafeInteger(d.transfer.quantity.value) && d.transfer.quantity.value > 0)))
  const plan = { sourceBatchId: batch.id, adjustments: Object.entries(drafts).map(([reservationId, d]) => ({ reservationId,
    newOutstanding: d.outstanding.value!, ...(d.transfer ? { transfer: { targetBatchId: d.transfer.targetBatchId, quantity: d.transfer.quantity.value! } } : {}) })) }
  const p = flow.snapshot?.projection
  const label = (id: string) => targets.find(t => t.batch.id === id)?.batch.code ?? id
  return <OrderActionDialog title={`Điều chỉnh nguồn giữ · ${batch.code}`} busy={flow.busy} onClose={onClose} footer={
    p ? <PrimaryButton disabled={flow.busy} onClick={flow.confirm}>{flow.busy ? 'Đang xử lý...' : flow.error?.code === 'STORAGE_ERROR' ? 'THỬ LẠI ĐIỀU CHỈNH' : 'XÁC NHẬN ĐIỀU CHỈNH'}</PrimaryButton>
      : <PrimaryButton disabled={flow.busy || !valid || !Object.keys(drafts).length} onClick={() => flow.showPreview(plan)}>XEM TRƯỚC ĐIỀU CHỈNH</PrimaryButton>
  }>
    <p>Tự chọn khách và nguồn cần giảm hoặc chuyển. Số đặt của khách và cây trong vườn không đổi.</p>
    {loadError && <button type="button" className="min-h-12 underline" onClick={() => refresh().catch(() => setLoadError(true))}>Chưa tải được nguồn. THỬ LẠI</button>}
    {rows.map(({ reservation: r, customer, order, planned }) => {
      const d = drafts[r.id]
      return <div key={r.id} className="border border-slate-200 rounded-xl p-3 space-y-3">
        <label className="flex items-center gap-3 min-h-12 font-bold"><input type="checkbox" checked={!!d} disabled={flow.busy}
          onChange={e => { flow.invalidate(); setDrafts(previous => { const next = { ...previous }; if (e.target.checked) next[r.id] = { outstanding: quantityDraft(remainingReservationQuantity(r)) }; else delete next[r.id]; return next }) }} />{customer} · {batch.code}</label>
        <Link className="flex items-center min-h-11 font-semibold underline" to={`/orders/${encodeURIComponent(r.orderId)}`}>
          XEM ĐƠN{order && ` · ${formatQuantity(order.requestedQuantity)} cây${order.requestedDate ? ` · hẹn ${formatShortDate(order.requestedDate, true)}` : ''}`}
        </Link>
        <p>Đang giữ {formatQuantity(remainingReservationQuantity(r))} cây</p>
        {(r.fulfilledQuantity ?? 0) > 0 && <p>Đã xuất {formatQuantity(r.fulfilledQuantity!)} cây · phần đã xuất giữ nguyên</p>}
        {planned > 0 && <p>Trong chuyến chờ xuất: {formatQuantity(planned)} cây</p>}
        {d && <>
          <AbsoluteQuantity id={`batch-source-${r.id}`} label={`Còn giữ sau điều chỉnh · ${customer}`} draft={d.outstanding} disabled={flow.busy} onChange={outstanding => update(r.id, { ...d, outstanding })} />
          <label className="flex items-center gap-3 min-h-12 font-semibold"><input type="checkbox" checked={!!d.transfer} disabled={flow.busy}
            onChange={e => update(r.id, { ...d, transfer: e.target.checked ? { targetBatchId: '', quantity: quantityDraft(0) } : undefined })} />CHUYỂN SANG LÔ KHÁC</label>
          {d.transfer && <>
            <label className="block font-semibold">Lô đích · {customer}<select className="w-full min-h-12 border border-slate-300 rounded-xl px-3 bg-white text-base" value={d.transfer.targetBatchId} disabled={flow.busy}
              onChange={e => update(r.id, { ...d, transfer: { ...d.transfer!, targetBatchId: e.target.value } })}>
              <option value="">Chọn lô cùng giống</option>
              {d.transfer.targetBatchId && !targets.some(t => t.batch.id === d.transfer!.targetBatchId) && <option value={d.transfer.targetBatchId}>Lô đã chọn không còn cây còn bán</option>}
              {targets.map(t => <option key={t.batch.id} value={t.batch.id}>{t.batch.code} · Còn bán: {formatQuantity(t.available)} cây</option>)}
            </select></label>
            <AbsoluteQuantity id={`transfer-${r.id}`} label={`Số cây chuyển · ${customer}`} draft={d.transfer.quantity} disabled={flow.busy} onChange={quantity => update(r.id, { ...d, transfer: { ...d.transfer!, quantity } })} />
          </>}
        </>}
      </div>
    })}
    <ReconciliationError error={flow.error} />
    {p && <div aria-live="polite" className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-3">
      <h3 className="font-bold">Xem trước điều chỉnh · {batch.code}</h3>
      <Impact label="Cây đủ bán" after={p.source.readyQuantity} />
      <Impact label="Đang giữ" before={p.source.outstandingBefore} after={p.source.outstandingAfter} />
      <Impact label="Thiếu cây đã giữ" before={p.source.shortageBefore} after={p.source.shortageAfter} />
      <p className="font-bold">{p.source.shortageAfter > 0 ? `Sau điều chỉnh lô vẫn còn thiếu ${formatQuantity(p.source.shortageAfter)} cây đã giữ.` : 'Sau điều chỉnh lô không còn thiếu cây đã giữ.'}</p>
      {p.adjustments.map(a => <div key={a.before.id} className="border-t border-emerald-200 pt-2">
        <p className="font-bold">{rows.find(r => r.reservation.id === a.before.id)?.customer}</p>
        <Impact label="Đang giữ" before={a.outstandingBefore} after={a.outstandingAfter} />
        <Impact label="Chuyển sang lô khác" after={a.transferredQuantity} /><Impact label="Nhả khỏi cam kết" after={a.releasedQuantity} />
      </div>)}
      {p.targets.map(t => <div key={t.batchId} className="border-t border-emerald-200 pt-2"><p className="font-bold">{label(t.batchId)}</p>
        <Impact label="Cây còn bán" before={t.availableBefore} after={t.availableAfter} /><Impact label="Chuyển vào" after={t.incomingTransfer} /></div>)}
      {p.orders.map(o => <div key={o.before.id} className="border-t border-emerald-200 pt-2"><p className="font-bold">{rows.find(r => r.reservation.orderId === o.before.id)?.customer}</p>
        <Impact label="Số đặt giữ nguyên" after={o.after.requestedQuantity} /><Impact label="Nguồn giữ" before={o.coverageBefore} after={o.coverageAfter} />
        <Impact label="Thiếu nguồn" before={o.shortageBefore} after={o.shortageAfter} /></div>)}
      <p>Cây còn sống, cây đủ bán và phần đã xuất giữ nguyên.</p>
    </div>}
  </OrderActionDialog>
}
