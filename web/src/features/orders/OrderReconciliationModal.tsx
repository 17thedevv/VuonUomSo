import { useCallback, useEffect, useState } from 'react'
import { batchRepository, contactRepository, reservationRepository, shipmentRepository } from '../../data/repositories'
import type { Reservation } from '../../domain/reservation'
import { remainingReservationQuantity } from '../../domain/reservation'
import type { OrderReductionProjection } from '../../domain/reconciliation'
import { formatQuantity } from '../../domain/quantity'
import { previewOrderReduction, reconcileOrderReduction } from '../../services/reconciliationService'
import { PrimaryButton } from '../../shared/components/PrimaryButton'
import { SecondaryButton } from '../../shared/components/SecondaryButton'
import { OrderActionDialog } from './OrderActionDialog'
import { useConfirmation } from '../reconciliation/useConfirmation'
import { AbsoluteQuantity, Impact, ReconciliationError } from '../reconciliation/ReconciliationFields'
import { quantityDraft, type QuantityDraft } from '../reconciliation/quantityDraft'

export function OrderReconciliationModal({ orderId, desiredRequestedQuantity, metadataPending, onClose, onSuccess }: {
  orderId: string; desiredRequestedQuantity: number; metadataPending: boolean; onClose: () => void
  onSuccess: (projection: OrderReductionProjection) => Promise<void>
}) {
  const [rows, setRows] = useState<{ reservation: Reservation; label: string; planned: number }[]>([])
  const [drafts, setDrafts] = useState<Record<string, QuantityDraft>>({})
  const [loadError, setLoadError] = useState(false)
  const refresh = useCallback(async () => {
    const [reservations, batches, contacts, shipments] = await Promise.all([reservationRepository.getByOrderId(orderId),
      batchRepository.getAll(), contactRepository.getAll(), shipmentRepository.getByOrderId(orderId)])
    const next = reservations.filter(r => r.status === 'active' && remainingReservationQuantity(r) > 0).map(reservation => ({ reservation,
      label: reservation.sourceType === 'own_batch' ? batches.find(b => b.id === reservation.batchId)?.code ?? 'Lô trong vườn'
        : contacts.find(c => c.id === reservation.supplierId)?.name ?? 'Nhà vườn ngoài',
      planned: shipments.filter(s => s.status === 'planned').flatMap(s => s.lines ?? [])
        .filter(l => l.reservationId === reservation.id).reduce((sum, l) => sum + l.quantity, 0) }))
    setRows(previous => [...next, ...previous.filter(row => !next.some(n => n.reservation.id === row.reservation.id))])
    setLoadError(false)
  }, [orderId])
  useEffect(() => { refresh().catch(() => setLoadError(true)) }, [refresh])
  const flow = useConfirmation(previewOrderReduction, reconcileOrderReduction, refresh, onSuccess)
  const inputsValid = Object.values(drafts).every(d => d.value !== null && Number.isSafeInteger(d.value) && d.value >= 0)
  const plan = { orderId, desiredRequestedQuantity, adjustments: Object.entries(drafts)
    .map(([reservationId, draft]) => ({ reservationId, newOutstanding: draft.value! })) }
  const p = flow.snapshot?.projection
  return <OrderActionDialog title="Điều chỉnh nguồn giữ cho đơn" busy={flow.busy} onClose={onClose} footer={
    <div className="space-y-2">
      {p ? <PrimaryButton disabled={flow.busy} onClick={flow.confirm}>{flow.busy ? 'Đang xử lý...' : flow.error?.code === 'STORAGE_ERROR' ? 'THỬ LẠI ĐIỀU CHỈNH' : 'XÁC NHẬN ĐIỀU CHỈNH'}</PrimaryButton>
        : <PrimaryButton disabled={flow.busy || !inputsValid || !Object.keys(drafts).length} onClick={() => flow.showPreview(plan)}>XEM TRƯỚC ĐIỀU CHỈNH</PrimaryButton>}
      <SecondaryButton fullWidth disabled={flow.busy} onClick={onClose}>QUAY LẠI SỬA ĐƠN</SecondaryButton>
    </div>
  }>
    <p>Số đặt mới: <strong>{formatQuantity(desiredRequestedQuantity)} cây</strong>. Chọn rõ nguồn muốn giảm; nhập số còn giữ sau điều chỉnh.</p>
    {metadataPending && <p className="bg-amber-50 p-3 rounded-xl">Ngày hẹn, giá, ghi chú hoặc giống bạn vừa sửa <strong>chưa được lưu</strong>. Sau điều chỉnh nguồn, quay lại xác nhận lưu những thông tin đó.</p>}
    {loadError && <button type="button" className="min-h-12 underline" onClick={() => refresh().catch(() => setLoadError(true))}>Chưa tải được nguồn. THỬ LẠI</button>}
    {rows.map(({ reservation: r, label, planned }) => <div key={r.id} className="border border-slate-200 rounded-xl p-3 space-y-2">
      <label className="flex gap-3 items-center min-h-12 font-bold"><input type="checkbox" checked={!!drafts[r.id]} disabled={flow.busy}
        onChange={e => { flow.invalidate(); setDrafts(previous => { const next = { ...previous }; if (e.target.checked) next[r.id] = quantityDraft(remainingReservationQuantity(r)); else delete next[r.id]; return next }) }} />{label}</label>
      <p>{r.sourceType === 'own_batch' ? 'Lô trong vườn' : 'Nhà vườn ngoài'} · Đang giữ {formatQuantity(remainingReservationQuantity(r))} cây</p>
      {(r.fulfilledQuantity ?? 0) > 0 && <p>Đã xuất {formatQuantity(r.fulfilledQuantity!)} cây</p>}
      {planned > 0 && <p>Trong chuyến chờ xuất: {formatQuantity(planned)} cây</p>}
      {drafts[r.id] && <AbsoluteQuantity id={`order-source-${r.id}`} label={`Còn giữ sau điều chỉnh · ${label}`} draft={drafts[r.id]} disabled={flow.busy}
        onChange={draft => { flow.invalidate(); setDrafts(previous => ({ ...previous, [r.id]: draft })) }} />}
    </div>)}
    <ReconciliationError error={flow.error} />
    {p && <div aria-live="polite" className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
      <h3 className="font-bold">Xem trước điều chỉnh</h3>
      <Impact label="Số đặt" before={p.orderBefore.requestedQuantity} after={p.orderAfter.requestedQuantity} />
      <Impact label="Nguồn đang giữ" before={p.coverageBefore} after={p.coverageAfter} />
      <Impact label="Thiếu nguồn sau điều chỉnh" after={p.shortageAfter} />
      {p.adjustments.map(a => <Impact key={a.before.id} label={rows.find(r => r.reservation.id === a.before.id)?.label ?? 'Nguồn giữ'} before={a.outstandingBefore} after={a.outstandingAfter} />)}
      <p>Cây còn sống và cây đủ bán không đổi.</p>
    </div>}
  </OrderActionDialog>
}
