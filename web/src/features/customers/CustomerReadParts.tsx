import { formatQuantity } from '../../domain/quantity'
import type { CustomerSummary } from '../../services/customerQueryService'

export const customerAction = 'min-h-12 px-4 py-3 inline-flex items-center justify-center rounded-xl font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'

export function CustomerMetrics({ customer }: { customer: CustomerSummary }) {
  return <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    {[
      ['Số đơn', customer.orderCount, 'đơn'],
      ['Đang giữ chưa xuất', customer.outstanding, 'cây'],
      ['Đã xuất', customer.shipped, 'cây']
    ].map(([label, value, unit]) => <div key={label} className="min-w-0">
      <dt className="text-slate-600">{label}</dt>
      <dd className="text-2xl font-bold break-words">{formatQuantity(value as number)} <span className="text-base font-normal">{unit}</span></dd>
    </div>)}
  </dl>
}

export function CustomerReadError({ retry }: { retry: () => void }) {
  return <div role="alert" className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
    <p>Chưa đọc được dữ liệu khách. Dữ liệu trên thiết bị có thể cần kiểm tra; hãy thử đọc lại.</p>
    <button type="button" className={`${customerAction} bg-emerald-700 text-white`} onClick={retry}>Thử lại</button>
  </div>
}
