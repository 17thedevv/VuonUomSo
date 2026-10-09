import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { getGardenAvailability, type GardenAvailabilityView, type GardenBatchAvailability } from '../../services/gardenQueryService'
import { formatQuantity } from '../../domain/quantity'
import { gardenReturnPath } from './gardenNavigation'
import type { QuickUpdateIntent } from './quickUpdateIntent'

type PickerState =
  | { search: string; status: 'loading' }
  | { search: string; status: 'error' }
  | { search: string; status: 'ready'; data: GardenAvailabilityView }

export function QuickUpdateChooser({ initialBatch, returnTo, onClose }: {
  initialBatch?: GardenBatchAvailability
  returnTo: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  const titleId = useId()
  const dialog = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState(initialBatch)
  const [search, setSearch] = useState('')
  const [state, setState] = useState<PickerState>({ search: '', status: 'loading' })
  const sequence = useRef(0)
  const leaving = useRef(false)
  const gardenReturnTo = gardenReturnPath(returnTo) ?? '/garden'

  const load = useCallback(async () => {
    const ticket = ++sequence.current
    setState({ search, status: 'loading' })
    try {
      // All batches remain eligible, including zero availability. A1 owns grouping/totals.
      const data = await getGardenAvailability({ view: 'all', search })
      if (ticket === sequence.current) setState({ search, status: 'ready', data })
    } catch {
      if (ticket === sequence.current) setState({ search, status: 'error' })
    }
  }, [search])

  useEffect(() => {
    if (selected) return
    const requestSequence = sequence
    void load()
    return () => { ++requestSequence.current }
  }, [load, selected])

  useEffect(() => {
    const trigger = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus()
    }
  }, [])

  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>('[data-initial-focus]')?.focus()
  }, [selected])

  const chooseAction = (kind: QuickUpdateIntent['kind']) => {
    if (!selected || leaving.current) return
    leaving.current = true
    navigate(`/batches/${encodeURIComponent(selected.id)}`, {
      state: { gardenReturnTo, quickUpdateIntent: { kind, batchId: selected.id } satisfies QuickUpdateIntent }
    })
  }
  const addBatch = () => {
    if (leaving.current) return
    leaving.current = true
    navigate('/batches/new', { state: { gardenReturnTo } })
  }
  const current = state.search === search ? state : { search, status: 'loading' as const }
  const buttonClass = 'min-h-12 rounded-xl px-4 py-3 font-semibold text-left w-full border border-slate-300 hover:bg-slate-50 focus:outline-2 focus:outline-emerald-700'

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-2xl p-4 sm:p-6 space-y-4 text-base"
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.preventDefault(); onClose() }
          if (event.key !== 'Tab') return
          const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, [href]') ?? [])
          const first = controls[0]
          const last = controls[controls.length - 1]
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
        }}>
        <div className="flex gap-3 items-center justify-between">
          <h2 id={titleId} className="text-[22px] font-bold">Cập nhật lô cây</h2>
          <button type="button" aria-label="Đóng chọn cập nhật" onClick={onClose} className="min-h-11 min-w-11 rounded-xl bg-slate-100 flex items-center justify-center"><X aria-hidden="true" className="w-5 h-5" /></button>
        </div>
        {selected ? (
          <>
            <div className="bg-emerald-50 rounded-xl p-3 space-y-2">
              <p className="font-bold break-words">{selected.variety}</p>
              <p className="font-semibold break-all">Lô {selected.code}</p>
              <button type="button" onClick={() => { setSelected(undefined); setSearch('') }} className="min-h-11 px-3 rounded-xl border border-emerald-300 font-semibold">Chọn lô khác</button>
            </div>
            <button type="button" data-initial-focus onClick={() => chooseAction('inventory')} className={buttonClass}>
              <span className="block font-bold">Kiểm kê số sống</span>
              <span className="block font-normal text-slate-600 mt-1">Nhập tổng số cây còn sống thực tế của lô.</span>
            </button>
            <button type="button" onClick={() => chooseAction('ready')} className={buttonClass}>
              <span className="block font-bold">Cập nhật cây đủ bán</span>
              <span className="block font-normal text-slate-600 mt-1">Nhập tổng số cây hiện đủ tiêu chuẩn xuất bán.</span>
            </button>
          </>
        ) : (
          <>
            <p className="text-slate-600">Chọn lô cần kiểm kê hoặc cập nhật cây đủ bán.</p>
            <label className="block font-semibold" htmlFor={`${titleId}-search`}>Tìm lô theo giống hoặc mã lô</label>
            <input id={`${titleId}-search`} data-initial-focus type="search" value={search} onChange={(event) => setSearch(event.target.value)}
              className="w-full min-h-12 px-3 border border-slate-300 rounded-xl focus:outline-2 focus:outline-emerald-700" />
            {current.status === 'loading' ? <p role="status">Đang đọc các lô...</p>
              : current.status === 'error' ? <div role="alert" className="space-y-3">
                <p>Chưa đọc được các lô. Dữ liệu lưu trên thiết bị có thể cần kiểm tra.</p>
                <button type="button" onClick={() => { void load() }} className={buttonClass}>Thử lại</button>
              </div>
              : current.data.groups.length === 0 ? <div className="space-y-3">
                <p>{search.trim() ? 'Không tìm thấy lô phù hợp' : 'Chưa có lô cây nào'}</p>
                {search.trim() && <button type="button" onClick={() => setSearch('')} className={buttonClass}>Xóa tìm kiếm lô</button>}
              </div> : <div className="space-y-4">
                {current.data.groups.map((group) => <section key={group.key} aria-label={`Chọn lô giống ${group.label}`} className="space-y-3">
                  <h3 className="text-lg font-bold break-words">{group.label}</h3>
                  <p className="text-slate-600">Còn bán: {formatQuantity(group.totals.available)} cây · Thiếu cây đã giữ: {formatQuantity(group.totals.commitmentShortage)} cây</p>
                  {group.batches.map((batch) => <button key={batch.id} type="button" aria-label={`Chọn lô ${batch.code}`} onClick={() => setSelected(batch)} className={buttonClass}>
                    <span className="block font-bold break-all">{batch.code}</span>
                    {search.trim() && group.matchedBatchIds.includes(batch.id) && <span className="block text-emerald-800">Khớp tìm kiếm</span>}
                    <span className="grid grid-cols-2 gap-2 mt-2 font-normal">
                      {([['Còn sống', batch.living], ['Đủ bán', batch.ready], ['Còn bán', batch.available], ['Thiếu cây đã giữ', batch.commitmentShortage]] as const).map(([label, quantity]) =>
                        <span key={label} className="min-w-0"><span className="block">{label}</span><strong className="block text-[22px] break-words">{formatQuantity(quantity)} cây</strong></span>)}
                    </span>
                  </button>)}
                </section>)}
              </div>}
          </>
        )}
        <button type="button" onClick={addBatch} className={`${buttonClass} text-emerald-800`}>Thêm lô mới</button>
        <button type="button" onClick={onClose} className={`${buttonClass} text-center`}>Hủy</button>
      </div>
    </div>
  )
}
