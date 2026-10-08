import { useRef, useState } from 'react'
import type { Order } from '../../domain/order'
import type { Reservation } from '../../domain/reservation'
import type { Shipment } from '../../domain/shipment'
import { remainingReservationQuantity } from '../../domain/reservation'
import { orderCancellationFingerprint, validateOrderCancellation } from '../../domain/orderLifecycle'
import { formatQuantity } from '../../domain/quantity'
import { formatDate } from '../../domain/date'
import { cancelOrder } from '../../services/orderService'
import { OrderActionDialog } from './OrderActionDialog'

export function OrderCancelModal({ order, reservations, shipments, sourceLabels, onClose, onRefresh, onSuccess }: {
  order: Order; reservations: Reservation[]; shipments: Shipment[]; sourceLabels: Map<string, string>;
  onClose: () => void; onRefresh: () => Promise<void>; onSuccess: (message: string) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitting = useRef(false)
  const active = reservations.filter((r) => r.status === 'active')
  const planned = shipments.filter((s) => s.status === 'planned')
  const releasedQuantity = active.reduce((sum, r) => sum + remainingReservationQuantity(r), 0)
  const validation = validateOrderCancellation(order, reservations, shipments)
  const impact = orderCancellationFingerprint(order, reservations, shipments)
  const submit = async () => {
    if (submitting.current || !validation.success) return
    submitting.current = true; setBusy(true); setError(null)
    try {
      const result = await cancelOrder({ orderId: order.id, expectedImpact: impact })
      if (result.success) await onSuccess('Đã hủy đơn. Nguồn giữ và chuyến chờ xuất đã được xử lý; lịch sử được giữ lại.')
      else { setError(result.code === 'ALREADY_SHIPPED' ? 'Đơn đã xuất cây, không thể hủy toàn bộ.' : result.error); await onRefresh() }
    } finally { submitting.current = false; setBusy(false) }
  }
  return <OrderActionDialog title="Xác nhận hủy đơn" busy={busy} onClose={onClose} footer={
    validation.success && order.status !== 'cancelled' ? <button type="button" onClick={submit} disabled={busy}
      className="w-full min-h-12 py-3 px-4 bg-rose-700 text-white rounded-xl font-bold disabled:opacity-50">{busy ? 'Đang hủy...' : 'XÁC NHẬN HỦY ĐƠN'}</button>
      : <button type="button" onClick={onClose} className="w-full min-h-12 py-3 border border-slate-300 rounded-xl font-bold">QUAY LẠI ĐƠN</button>
  }>
    <p>Hủy đơn <strong>{formatQuantity(order.requestedQuantity)} cây {order.variety}</strong>?</p>
    {validation.success && order.status !== 'cancelled' && <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl space-y-3">
      <p className="font-bold">Sẽ nhả {active.length} nguồn giữ, tổng {formatQuantity(releasedQuantity)} cây.</p>
      {active.length > 0 && <ul className="space-y-2">{active.map((r) => <li key={r.id}>{sourceLabels.get(r.id) ?? 'Nguồn đã giữ'}: <strong>{formatQuantity(remainingReservationQuantity(r))} cây</strong></li>)}</ul>}
      <p className="font-bold">Sẽ hủy {planned.length} chuyến chờ xuất.</p>
      {planned.length > 0 && <ul className="space-y-2">{planned.map((s) => <li key={s.id}>{formatQuantity(s.plannedQuantity)} cây{s.plannedDate ? ` · ${formatDate(s.plannedDate)}` : ''}</li>)}</ul>}
    </div>}
    <p>Cây còn sống và cây đủ bán không đổi. Đơn hàng, nguồn giữ và các chuyến xe vẫn được giữ trong lịch sử.</p>
    <p className="font-semibold">Hủy đơn chưa có thao tác hoàn tác. Chọn Đóng để giữ nguyên đơn.</p>
    {!validation.success && <p role="alert" className="text-rose-800">Đơn đã xuất cây, không thể hủy toàn bộ.</p>}
    {error && <p role="alert" className="text-rose-800 bg-rose-50 p-3 rounded-xl">{error}</p>}
  </OrderActionDialog>
}
