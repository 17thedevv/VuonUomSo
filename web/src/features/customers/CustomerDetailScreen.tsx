import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCustomerDetail } from '../../services/customerQueryService'
import { formatQuantity } from '../../domain/quantity'
import { formatShortDate } from '../../domain/date'
import { PageHeader } from '../../shared/components/PageHeader'
import { CustomerMetrics, CustomerReadError, customerAction } from './CustomerReadParts'
import { customerCallHref } from './customerNavigation'
import { useCustomerRead } from './useCustomerRead'

export function CustomerDetailScreen() {
  const { id } = useParams<{ id: string }>()
  return <CustomerDetail key={id} id={id ?? ''} />
}
function CustomerDetail({ id }: { id: string }) {
  const read = useCallback(() => getCustomerDetail(id), [id])
  const { state, reload } = useCustomerRead(read)
  const data = state.status === 'ready' ? state.data : null
  const returnTo = `/customers/${encodeURIComponent(id)}`
  const callHref = customerCallHref(data?.customer.phone)
  return <div className="flex-1 flex flex-col bg-slate-50 text-base min-w-0">
    <PageHeader title="Chi tiết khách" rightAction={<button type="button" className={`${customerAction} bg-emerald-50 text-emerald-800`} onClick={() => { void reload() }}>Đọc lại</button>} />
    <div className="p-4 sm:p-6 space-y-5 w-full max-w-5xl mx-auto min-w-0">
      <Link to="/customers" className={`${customerAction} text-emerald-800`}>Về danh sách khách</Link>
      {state.status === 'loading' ? <p role="status">Đang đọc dữ liệu khách...</p> : state.status === 'error' ? <CustomerReadError retry={() => { void reload() }} />
        : !data ? <p className="bg-white border rounded-xl p-5">Không tìm thấy khách hàng này. Khách có thể đã bị xóa hoặc không có vai trò khách hàng.</p> : <>
          <section aria-label="Thông tin khách" className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 min-w-0">
            <h2 className="text-2xl font-bold break-words">{data.customer.name}</h2>
            <p className="break-all">{data.customer.phone || 'Chưa có số điện thoại'}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/orders/new" state={{ customerIntentId: data.customer.id, customerReturnTo: returnTo }} className={`${customerAction} bg-emerald-700 text-white`}>Ghi đơn cho khách</Link>
              {callHref && <a href={callHref} className={`${customerAction} border border-emerald-700 text-emerald-800`}>Gọi</a>}
            </div>
            <CustomerMetrics customer={data.customer} />
          </section>
          <section aria-label="Đơn hàng của khách" className="space-y-3">
            <h2 className="text-xl font-bold">Đơn hàng của khách</h2>
            {!data.orders.length ? <p>Khách chưa có đơn hàng.</p> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.orders.map(order => <article key={order.orderId} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 min-w-0">
                <h3 className="font-bold break-all">{order.referenceLabel}</h3><p className="font-semibold break-words">{order.variety}</p><p>{order.displayStatus.label}</p>
                {order.requestedDate && <p>Ngày hẹn: {formatShortDate(order.requestedDate)}</p>}
                <dl className="space-y-2">
                  {([['Đặt', order.requestedQuantity], ['Đang giữ chưa xuất', order.outstanding], ['Đã xuất', order.shipped], ['Thiếu nguồn', order.shortage]] as const)
                    .map(([label, value]) => <div key={label}><dt className="text-slate-600">{label}</dt><dd className="font-bold break-words">{formatQuantity(value)} cây</dd></div>)}
                </dl>
                <Link to={`/orders/${encodeURIComponent(order.orderId)}`} state={{ customerReturnTo: returnTo }} aria-label={`Xem ${order.referenceLabel}`}
                  className={`${customerAction} bg-emerald-50 text-emerald-800`}>Xem đơn</Link>
              </article>)}
            </div>}
          </section>
          <section aria-label="Lịch sử xuất cây" className="space-y-3">
            <h2 className="text-xl font-bold">Lịch sử xuất cây</h2>
            {!data.completedShipments.length ? <p>Chưa có lịch sử xuất cây.</p> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.completedShipments.map(shipment => <article key={shipment.shipmentId} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 min-w-0">
                <h3 className="font-bold">Đã xuất {formatQuantity(shipment.shippedQuantity)} cây</h3><p className="break-all">{shipment.referenceLabel}</p>
                <p>{shipment.shippedAt ? `Ngày xuất: ${formatShortDate(shipment.shippedAt)}` : 'Chưa có thời điểm xuất'}</p>
                <Link to={`/shipments/${encodeURIComponent(shipment.shipmentId)}`} className={`${customerAction} bg-emerald-50 text-emerald-800`}>Xem chuyến</Link>
              </article>)}
            </div>}
          </section>
        </>}
    </div>
  </div>
}
