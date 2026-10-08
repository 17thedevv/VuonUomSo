import { useRef, useState } from 'react'
import type { Order } from '../../domain/order'
import type { Reservation } from '../../domain/reservation'
import type { Shipment } from '../../domain/shipment'
import { orderShortage, reservedQuantityForOrder } from '../../domain/order'
import { validateOrderChanges, type OrderChanges } from '../../domain/orderLifecycle'
import { formatQuantity } from '../../domain/quantity'
import { updateOrder } from '../../services/orderService'
import { QuantityInput } from '../../shared/components/QuantityInput'
import { PrimaryButton } from '../../shared/components/PrimaryButton'
import { OrderActionDialog } from './OrderActionDialog'

export function OrderEditModal({ order, reservations, shipments, onClose, onRefresh, onSuccess }: {
  order: Order; reservations: Reservation[]; shipments: Shipment[];
  onClose: () => void; onRefresh: () => Promise<void>; onSuccess: (message: string) => Promise<void>
}) {
  const [initial] = useState(order)
  const [raw, setRaw] = useState(String(order.requestedQuantity))
  const [quantity, setQuantity] = useState<number | null>(order.requestedQuantity)
  const [unit, setUnit] = useState<'cay' | 'van'>('cay')
  const [variety, setVariety] = useState(order.variety)
  const [date, setDate] = useState(order.requestedDate?.slice(0, 10) ?? '')
  const [price, setPrice] = useState(order.unitPrice === undefined ? '' : String(order.unitPrice))
  const [note, setNote] = useState(order.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitting = useRef(false)
  const changes: OrderChanges = { requestedQuantity: quantity ?? NaN }
  if (variety !== initial.variety) changes.variety = variety
  if (date !== (initial.requestedDate?.slice(0, 10) ?? '')) changes.requestedDate = date || null
  if (price !== (initial.unitPrice === undefined ? '' : String(initial.unitPrice))) changes.unitPrice = price.trim() ? Number(price) : null
  if (note !== (initial.note ?? '')) changes.note = note || null
  const validation = validateOrderChanges(order, changes, reservations, shipments)
  const coverage = reservedQuantityForOrder(order.id, reservations)
  const conflict = !validation.success ? validation.conflict : undefined
  const fieldClass = 'w-full min-h-12 border border-slate-300 rounded-xl px-3 py-2 text-base bg-white'
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting.current || !validation.success) return
    submitting.current = true
    setBusy(true); setError(null)
    try {
      const result = await updateOrder({ orderId: order.id, ...changes })
      if (result.success) await onSuccess(result.changed ? 'Đã cập nhật đơn hàng.' : 'Đơn hàng không có thay đổi.')
      else {
        setError(result.code === 'RECONCILIATION_REQUIRED' && result.conflict
          ? `Đang giữ dư ${formatQuantity(result.conflict.excessQuantity)} cây so với số đặt mới. Nguồn giữ vẫn được giữ nguyên.` : result.error)
        await onRefresh()
      }
    } finally { submitting.current = false; setBusy(false) }
  }
  return (
    <OrderActionDialog title="Sửa đơn" busy={busy} onClose={onClose} footer={
      <PrimaryButton type="submit" form="edit-order-form" disabled={busy || !validation.success}>{busy ? 'Đang cập nhật...' : 'CẬP NHẬT ĐƠN'}</PrimaryButton>
    }>
      <form id="edit-order-form" onSubmit={submit} className="space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          {reservations.length === 0 ? <label className="block font-semibold">Giống cây
            <input className={fieldClass} value={variety} onChange={(e) => { setVariety(e.target.value); setError(null) }} />
          </label> : <div className="bg-slate-50 rounded-xl p-3"><p className="font-bold">{order.variety}</p><p>Giống cây đã khóa vì đơn có lịch sử giữ cây.</p></div>}
          <div className="[&_select]:min-h-11 [&_label]:text-base">
            <QuantityInput id="edit-order-quantity" label="Số lượng đặt" value={raw} unit={unit} onUnitChange={setUnit}
              onChange={(value, parsed) => { setRaw(value); setQuantity(parsed); setError(null) }} required showQuickChips={false} />
          </div>
          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl space-y-1" aria-live="polite">
            <p>Số đặt hiện tại: <strong>{formatQuantity(order.requestedQuantity)} cây</strong></p>
            <p>Đã có nguồn giữ: <strong>{formatQuantity(coverage)} cây</strong></p>
            {validation.success && <><p>Số đặt sau sửa: <strong>{formatQuantity(validation.order.requestedQuantity)} cây</strong></p>
              <p>Thiếu nguồn sau sửa: <strong>{formatQuantity(orderShortage(validation.order, reservations))} cây</strong></p>
              <p>Nguồn giữ và cây trong vườn được giữ nguyên.</p></>}
          </div>
          {conflict ? <div role="alert" className="bg-amber-50 border border-amber-300 p-3 rounded-xl text-amber-950 space-y-1">
            <p className="font-bold">Đang giữ dư {formatQuantity(conflict.excessQuantity)} cây so với số đặt mới.</p>
            <p>Chưa thể giảm đơn xuống {formatQuantity(conflict.requestedQuantity)} cây. Nguồn giữ vẫn được giữ nguyên; hãy xem lại nguồn đã giữ trước khi giảm đơn.</p>
          </div> : !validation.success && <div role="alert" className="text-rose-800 space-y-2"><p>{validation.error}</p>
            {validation.code === 'VARIETY_LOCKED' && <button type="button" className="min-h-12 px-3 border border-slate-300 rounded-xl font-semibold"
              onClick={() => { setVariety(order.variety); setError(null) }}>Giữ giống cây hiện tại</button>}
          </div>}
          <label className="block font-semibold">Ngày hẹn lấy<input type="date" className={fieldClass} value={date} onChange={(e) => { setDate(e.target.value); setError(null) }} /></label>
          <label className="block font-semibold">Giá mỗi cây (đồng)<input type="number" min="0" step="1" inputMode="numeric" className={fieldClass} value={price} onChange={(e) => { setPrice(e.target.value); setError(null) }} /></label>
          <label className="block font-semibold">Ghi chú<textarea rows={3} className={fieldClass} value={note} onChange={(e) => { setNote(e.target.value); setError(null) }} /></label>
        </fieldset>
        {error && <p role="alert" className="text-rose-800 bg-rose-50 p-3 rounded-xl">{error}</p>}
      </form>
    </OrderActionDialog>
  )
}
