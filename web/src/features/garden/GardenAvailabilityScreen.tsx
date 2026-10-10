import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, RotateCcw, Trees } from 'lucide-react'
import { getGardenAvailability, type GardenAvailabilityView, type GardenBatchAvailability } from '../../services/gardenQueryService'
import { undoService } from '../../services/undoService'
import { PageHeader } from '../../shared/components/PageHeader'
import { EmptyState } from '../../shared/components/EmptyState'
import { AvailabilitySummary } from './AvailabilitySummary'
import { VarietyAvailabilityCard } from './VarietyAvailabilityCard'
import { GardenFilters } from './GardenFilters'
import { QuickUpdateChooser } from './QuickUpdateChooser'

type LoadState =
  | { key: string; status: 'loading' }
  | { key: string; status: 'error' }
  | { key: string; status: 'ready'; data: GardenAvailabilityView; emptyGarden: boolean }

export function GardenAvailabilityScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const rawView = params.get('view')
  const view = rawView === 'all' ? 'all' : 'available'
  const open = params.get('open')
  const key = JSON.stringify([search, view])
  const [loadState, setLoadState] = useState<LoadState>({ key, status: 'loading' })
  const sequence = useRef(0)
  const [chooser, setChooser] = useState<{ batch?: GardenBatchAvailability } | null>(null)
  const updateButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const focusId = location.state?.focusGardenUpdate
    if (typeof focusId !== 'string' || loadState.key !== key || loadState.status === 'loading') return
    const leaf = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-update-batch-id]'))
      .find((button) => button.dataset.updateBatchId === focusId)
    const target = leaf ?? updateButton.current
    target?.focus()
    const state = { ...location.state }
    delete state.focusGardenUpdate
    navigate(location.pathname + location.search, { replace: true, state })
  }, [loadState, key, location, navigate])

  const load = useCallback(async () => {
    const ticket = ++sequence.current
    setLoadState({ key, status: 'loading' })
    try {
      let data = await getGardenAvailability({ search, view })
      if (ticket !== sequence.current) return
      let emptyGarden = !search.trim() && view === 'all' && data.groups.length === 0
      if (!search.trim() && view === 'available' && data.groups.length === 0) {
        // A filtered DTO alone cannot distinguish an empty garden from depleted batches.
        // Use the ENTIRE latest all-view snapshot; never mix totals across reads.
        const all = await getGardenAvailability({ view: 'all' })
        emptyGarden = all.groups.length === 0
        data = { ...all, groups: all.groups.filter((group) => group.totals.available > 0) }
      }
      if (ticket === sequence.current) setLoadState({ key, status: 'ready', data, emptyGarden })
    } catch {
      if (ticket === sequence.current) setLoadState({ key, status: 'error' })
    }
  }, [search, view, key])

  useEffect(() => {
    const requestSequence = sequence
    void load()
    const unsubscribe = undoService.subscribe(() => { void load() })
    const onFocus = () => { void load() }
    const onVisibility = () => { if (document.visibilityState === 'visible') void load() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      ++requestSequence.current
      unsubscribe()
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load])

  useEffect(() => {
    if (rawView && rawView !== 'available' && rawView !== 'all') {
      const next = new URLSearchParams(params)
      next.set('view', 'available')
      setParams(next, { replace: true })
    }
  }, [rawView, params, setParams])

  const update = (name: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    setParams(next, { replace: name === 'q' || name === 'open' })
  }
  const current = loadState.key === key ? loadState : { key, status: 'loading' as const }
  const returnTo = `/garden?${params}`
  return (
    <div className="flex-1 flex flex-col bg-slate-50 text-base">
      <PageHeader title="Vườn" rightAction={
        <button type="button" onClick={() => { void load() }} className="min-h-11 px-3 flex items-center gap-2 text-emerald-800 font-semibold rounded-xl bg-emerald-50">
          <RotateCcw aria-hidden="true" className="w-4 h-4" />Đọc lại
        </button>
      } />
      <div className="p-4 sm:p-6 w-full max-w-5xl mx-auto space-y-5">
        <p className="text-slate-600">Số cây theo dữ liệu đang lưu trên thiết bị</p>
        <div className="flex flex-wrap items-center gap-3">
          <button ref={updateButton} type="button" onClick={() => setChooser({})} className="min-h-12 px-5 rounded-xl bg-emerald-700 text-white font-bold">Cập nhật</button>
          <Link to="/batches" className="min-h-11 flex items-center px-3 text-emerald-800 font-semibold">Xem danh sách lô</Link>
        </div>
        <GardenFilters search={search} view={view} onSearch={(value) => update('q', value)} onView={(value) => update('view', value)} />
        {current.status === 'loading' ? (
          <p role="status" className="py-10 text-center text-slate-600">Đang đọc dữ liệu vườn...</p>
        ) : current.status === 'error' ? (
          <div role="alert" className="rounded-2xl border border-amber-200 bg-white p-6 space-y-4">
            <p className="flex gap-2 font-semibold"><AlertTriangle aria-hidden="true" className="w-6 h-6 shrink-0 text-amber-700" />Chưa đọc được dữ liệu vườn. Dữ liệu lưu trên thiết bị có thể cần kiểm tra.</p>
            <button type="button" onClick={() => { void load() }} className="min-h-12 px-4 rounded-xl bg-emerald-700 text-white font-semibold">Thử lại</button>
          </div>
        ) : (
          <>
            <AvailabilitySummary totals={current.data.ownTotals} />
            {current.emptyGarden ? (
              <EmptyState title="Chưa có lô cây nào" description="Thêm lô cây để xem số cây còn sống, đủ bán và còn bán." icon={Trees} actionText="Thêm lô cây" onAction={() => navigate('/batches/new')} />
            ) : current.data.groups.length === 0 ? (
              <EmptyState title={search.trim() ? 'Không tìm thấy giống hoặc mã lô phù hợp' : 'Chưa có cây còn bán'}
                description={search.trim() ? 'Thử tìm tên giống hoặc một mã lô khác.' : 'Chuyển sang Tất cả để xem các lô và số cây đã giữ.'}
                actionText={search.trim() ? 'Xóa tìm kiếm' : 'Xem tất cả'} onAction={() => search.trim() ? update('q', '') : update('view', 'all')} />
            ) : (
              <section aria-label="Các giống cây" className="space-y-3">
                <h2 className="text-lg font-bold">Các giống cây</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {current.data.groups.map((group) => (
                    <VarietyAvailabilityCard key={group.key} group={group} expanded={open === group.key} onToggle={() => update('open', open === group.key ? '' : group.key)} returnTo={returnTo} searching={!!search.trim()} onQuickUpdate={(batch) => setChooser({ batch })} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      {chooser && <QuickUpdateChooser initialBatch={chooser.batch} returnTo={returnTo} onClose={() => setChooser(null)} />}
    </div>
  )
}
