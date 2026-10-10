import { Link, useSearchParams } from 'react-router-dom'
import { getCustomers } from '../../services/customerQueryService'
import { PageHeader } from '../../shared/components/PageHeader'
import { CustomerMetrics, CustomerReadError, customerAction } from './CustomerReadParts'
import { useCustomerRead } from './useCustomerRead'

export function CustomersScreen() {
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const { state, reload } = useCustomerRead(getCustomers)
  const normalized = search.trim().toLowerCase()
  const matches = state.status === 'ready' ? state.data.customers.filter(customer =>
    customer.name.toLowerCase().includes(normalized) || customer.phone?.toLowerCase().includes(normalized)) : []
  const changeSearch = (value: string) => {
    const next = new URLSearchParams()
    if (value) next.set('q', value)
    setParams(next, { replace: true })
  }
  return <div className="flex-1 flex flex-col bg-slate-50 text-base min-w-0">
    <PageHeader title="Khách hàng" rightAction={<button type="button" className={`${customerAction} text-emerald-800 bg-emerald-50`} onClick={() => { void reload() }}>Đọc lại</button>} />
    <div className="p-4 sm:p-6 space-y-5 w-full max-w-5xl mx-auto min-w-0">
      <Link to="/more" className={`${customerAction} text-emerald-800`}>Về Thêm</Link>
      <div>
        <label htmlFor="customer-search" className="block font-semibold mb-2">Tìm tên hoặc số điện thoại</label>
        <input id="customer-search" type="search" value={search} onChange={event => changeSearch(event.target.value)} placeholder="Tìm tên hoặc số điện thoại..."
          className="w-full min-h-12 px-4 py-3 rounded-xl border border-slate-300 bg-white focus:outline-2 focus:outline-emerald-700" />
      </div>
      {state.status === 'loading' ? <p role="status">Đang đọc dữ liệu khách...</p> : state.status === 'error' ? <CustomerReadError retry={() => { void reload() }} />
        : !state.data.customers.length ? <p className="bg-white border rounded-xl p-5">Chưa có khách hàng trong danh bạ.</p>
          : !matches.length ? <div className="bg-white border rounded-xl p-5 space-y-3"><p>Không tìm thấy khách phù hợp.</p><button type="button" className={`${customerAction} bg-emerald-50 text-emerald-800`} onClick={() => changeSearch('')}>Xóa tìm kiếm</button></div>
            : <section aria-label="Danh sách khách" className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matches.map(customer => <Link key={customer.id} to={`/customers/${encodeURIComponent(customer.id)}`} aria-label={`Xem khách ${customer.name}`}
                className="block min-w-0 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 focus-visible:outline-2 focus-visible:outline-emerald-700">
                <div className="break-words"><h2 className="text-xl font-bold">{customer.name}</h2><p className="text-slate-600 break-all">{customer.phone || 'Chưa có số điện thoại'}</p></div>
                <CustomerMetrics customer={customer} /><span className="inline-flex min-h-11 items-center text-emerald-800 font-semibold">Xem khách</span>
              </Link>)}
            </section>}
    </div>
  </div>
}
