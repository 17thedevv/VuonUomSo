import { useId } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import type { GardenVarietyGroup, GardenBatchAvailability } from '../../services/gardenQueryService'
import { formatQuantity } from '../../domain/quantity'

export function VarietyAvailabilityCard({ group, expanded, onToggle, returnTo, searching, onQuickUpdate }: {
  group: GardenVarietyGroup
  expanded: boolean
  onToggle: () => void
  returnTo: string
  searching: boolean
  onQuickUpdate: (batch: GardenBatchAvailability) => void
}) {
  const listId = useId()
  return (
    <article aria-label={group.label} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 min-w-0 self-start">
      <h3 className="text-[22px] font-bold break-words">{group.label}</h3>
      <div>
        <p className="text-emerald-900 font-semibold">Còn bán</p>
        <p className="text-2xl text-emerald-800 font-black break-words">{formatQuantity(group.totals.available)} <span className="text-base font-semibold">cây</span></p>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <div><dt className="text-slate-600">Cây đủ bán</dt><dd className="text-[22px] font-bold break-words">{formatQuantity(group.totals.ready)} cây</dd></div>
        <div><dt className="text-slate-600">Đang giữ</dt><dd className="text-[22px] font-bold break-words">{formatQuantity(group.totals.outstanding)} cây</dd></div>
      </dl>
      {group.totals.commitmentShortage > 0 && (
        <p className="flex items-start gap-2 text-amber-900 bg-amber-50 rounded-xl p-3">
          <AlertTriangle aria-hidden="true" className="w-5 h-5 shrink-0 mt-0.5" />
          <span>Thiếu cây đã giữ: <strong>{formatQuantity(group.totals.commitmentShortage)} cây</strong></span>
        </p>
      )}
      <p className="text-slate-600">Số lô: {group.batchIds.length}</p>
      <Link to={`/orders/new?${new URLSearchParams({ variety: group.label })}`} state={{ gardenReturnTo: returnTo }}
        aria-label={`Ghi đơn giống ${group.label}`} className="min-h-12 px-3 py-3 flex items-center justify-center rounded-xl bg-emerald-700 text-white font-bold break-words">Ghi đơn</Link>
      <button type="button" aria-expanded={expanded} aria-controls={listId} onClick={onToggle}
        className="w-full min-h-11 px-3 py-2 flex items-center justify-center gap-2 bg-slate-100 rounded-xl font-semibold text-slate-800">
        {expanded ? 'Ẩn các lô' : 'Xem các lô'}
        {expanded ? <ChevronUp aria-hidden="true" className="w-5 h-5" /> : <ChevronDown aria-hidden="true" className="w-5 h-5" />}
      </button>
      {expanded && (
        <ul id={listId} className="space-y-3">
          {group.batches.map((batch) => (
            <li key={batch.id}>
              <Link to={`/batches/${encodeURIComponent(batch.id)}`} state={{ gardenReturnTo: returnTo }}
                aria-label={`Mở lô ${batch.code}`} className="block rounded-xl border border-slate-300 p-3 hover:bg-slate-50 focus:outline-2 focus:outline-emerald-700">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="font-bold break-all">{batch.code}</span>
                  {searching && group.matchedBatchIds.includes(batch.id) && <span className="text-emerald-900 bg-emerald-100 rounded-lg px-2 py-1">Khớp tìm kiếm</span>}
                </div>
                <dl className="grid grid-cols-2 gap-3">
                  {([['Đủ bán', batch.ready], ['Đang giữ', batch.outstanding], ['Còn bán', batch.available], ['Thiếu cây đã giữ', batch.commitmentShortage]] as const).map(([label, quantity]) => (
                    <div key={label} className={label === 'Thiếu cây đã giữ' && quantity > 0 ? 'text-amber-900' : ''}>
                      <dt className="text-base">{label}</dt>
                      <dd className="text-[22px] font-bold break-words">{formatQuantity(quantity)} cây</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-emerald-800 font-semibold mt-3">Mở chi tiết lô →</p>
              </Link>
              <button type="button" data-update-batch-id={batch.id} aria-label={`Cập nhật lô ${batch.code}`} onClick={() => onQuickUpdate(batch)} className="min-h-11 w-full mt-2 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-800 font-semibold">Cập nhật lô</button>
              <Link to={`/orders/new?${new URLSearchParams({ variety: batch.variety.trim() })}`} state={{ gardenReturnTo: returnTo }}
                aria-label={`Ghi đơn từ lô ${batch.code}`} className="min-h-12 mt-2 px-3 py-3 flex items-center justify-center rounded-xl border border-emerald-700 text-emerald-800 font-semibold">Ghi đơn</Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
