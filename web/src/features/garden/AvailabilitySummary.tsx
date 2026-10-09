import { AlertTriangle } from 'lucide-react'
import type { QuantityTotals } from '../../services/gardenQueryService'
import { formatQuantity } from '../../domain/quantity'

export function AvailabilitySummary({ totals }: { totals: QuantityTotals }) {
  return (
    <section aria-label="Tổng vườn" className="rounded-2xl border border-emerald-200 bg-white p-4 sm:p-6 space-y-4">
      <h2 className="text-base font-bold text-slate-700">Tổng vườn</h2>
      <div className="rounded-xl bg-emerald-50 p-4">
        <p className="font-semibold text-emerald-900">Cây còn bán</p>
        <p className="text-[28px] font-black text-emerald-800 mt-1 break-words">
          {formatQuantity(totals.available)} <span className="text-base font-semibold">cây</span>
        </p>
      </div>
      <dl className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {([['Cây còn sống', totals.living], ['Cây đủ bán', totals.ready], ['Đang giữ', totals.outstanding]] as const).map(([label, quantity]) => (
          <div key={label} className="min-w-0">
            <dt className="text-slate-600">{label}</dt>
            <dd className="text-[22px] font-bold break-words">{formatQuantity(quantity)} <span className="text-base font-normal">cây</span></dd>
          </div>
        ))}
        <div className={totals.commitmentShortage > 0 ? 'text-amber-900 min-w-0' : 'text-slate-600 min-w-0'}>
          <dt className="flex gap-1.5 items-start">
            {totals.commitmentShortage > 0 && <AlertTriangle aria-hidden="true" className="w-5 h-5 shrink-0 mt-0.5" />}
            Thiếu cây đã giữ
          </dt>
          <dd className="text-[22px] font-bold break-words">{formatQuantity(totals.commitmentShortage)} <span className="text-base font-normal">cây</span></dd>
        </div>
      </dl>
    </section>
  )
}
