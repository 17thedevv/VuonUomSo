import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
  Plus,
  Clock,
  History,
  Trees,
  RotateCcw,
  FileText
} from 'lucide-react'
import {
  batchRepository,
  reservationRepository,
  eventRepository,
  dossierRepository
} from '../../data/repositories'
import type { Batch } from '../../domain/batch'
import type { Reservation } from '../../domain/reservation'
import type { DomainEvent } from '../../analytics/events'
import type { BatchDossier } from '../../domain/dossier'
import {
  deriveDossierCompleteness,
  DOSSIER_COMPLETENESS_LABELS,
  MATERIAL_TYPE_LABELS
} from '../../domain/dossier'
import {
  availableQuantityForBatch,
  reservedQuantityForBatch,
  commitmentShortageForBatch,
  survivalRate,
  formatQuantity,
  formatSurvivalRate
} from '../../domain/quantity'
import { isBatchAttention, getBatchDisplayStatus, deriveBatchStatus } from '../../domain/batch'
import { formatShortDate } from '../../domain/date'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusBadge } from '../../shared/components/StatusBadge'
import { EmptyState } from '../../shared/components/EmptyState'
import { SecondaryButton } from '../../shared/components/SecondaryButton'
import { InventoryUpdateModal } from './InventoryUpdateModal'
import { ReadyQuantityUpdateModal } from './ReadyQuantityUpdateModal'
import { undoService } from '../../services/undoService'
import { BatchReconciliationModal } from './BatchReconciliationModal'
import { gardenReturnPath } from '../garden/gardenNavigation'
import { readQuickUpdateIntent, type QuickUpdateIntent } from '../garden/quickUpdateIntent'

export const BatchDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  // A different route identity must never inherit the previous batch or open modal.
  return <BatchDetailContent key={id} />
}

const BatchDetailContent: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const backTo = gardenReturnPath(location.state?.gardenReturnTo) ?? '/batches'
  const [batch, setBatch] = useState<Batch | null>(null)
  const [dossier, setDossier] = useState<BatchDossier | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [events, setEvents] = useState<DomainEvent[]>([])
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false)
  const [isReadyModalOpen, setIsReadyModalOpen] = useState(false)
  const [reconcileOpen, setReconcileOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sequence = useRef(0)
  const initialIntent = useRef(readQuickUpdateIntent(location.state?.quickUpdateIntent, id))
  const quickReturn = useRef<string | undefined>(undefined)

  // Remove the intent from browser history before reading. Retry/back/remount cannot replay it.
  useEffect(() => {
    if (!location.state || !Object.hasOwn(location.state, 'quickUpdateIntent')) return
    const state = { ...location.state }
    delete state.quickUpdateIntent
    navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true, state })
  }, [location, navigate])

  const fetchData = useCallback(async (intent?: QuickUpdateIntent) => {
    if (!id) return
    const ticket = ++sequence.current
    try {
      const [b, r, allEvents, dos] = await Promise.all([
        batchRepository.getById(id),
        reservationRepository.getByBatchId(id),
        eventRepository.getAll(),
        dossierRepository.getByBatchId(id)
      ])

      if (ticket !== sequence.current) return
      initialIntent.current = undefined
      setBatch(b)
      setReservations(r)
      setDossier(dos)

      // Filter events related to this batch
      const batchEvents = allEvents.filter(
        (e) => e.entityId === id || (e.payload && typeof e.payload === 'object' && 'batchId' in e.payload && (e.payload as { batchId: string }).batchId === id)
      )
      setEvents(batchEvents)
      setError(null)
      if (b && intent?.batchId === b.id) {
        quickReturn.current = backTo
        if (intent.kind === 'inventory') setIsInventoryModalOpen(true)
        else setIsReadyModalOpen(true)
      }
    } catch (err) {
      if (ticket !== sequence.current) return
      initialIntent.current = undefined
      console.error('Error loading batch detail:', err)
      setError('Chưa tải được chi tiết lô cây.')
    } finally {
      if (ticket === sequence.current) setLoading(false)
    }
  }, [id, backTo])

  useEffect(() => {
    const requestSequence = sequence
    // Kept across StrictMode's effect replay; only the latest successful read may open it.
    void fetchData(initialIntent.current)
    const unsubscribe = undoService.subscribe(() => {
      fetchData()
    })
    return () => { ++requestSequence.current; unsubscribe() }
  }, [fetchData])

  const finishQuickUpdate = () => {
    const returnTo = quickReturn.current
    quickReturn.current = undefined
    if (returnTo) { navigate(returnTo, { state: { focusGardenUpdate: id } }); return true }
    return false
  }
  const closeInventory = () => { setIsInventoryModalOpen(false); finishQuickUpdate() }
  const closeReady = () => { setIsReadyModalOpen(false); finishQuickUpdate() }
  const updateSucceeded = () => {
    if (!finishQuickUpdate()) void fetchData()
  }

  useEffect(() => {
    if (!quickReturn.current || (!isInventoryModalOpen && !isReadyModalOpen)) return
    const modal = document.querySelector<HTMLElement>('[role="dialog"]')
    modal?.querySelector<HTMLInputElement>('input')?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      const controls = Array.from(modal?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select') ?? [])
      if (event.key === 'Escape' && !modal?.textContent?.includes('ĐANG LƯU...')) {
        event.preventDefault()
        modal?.querySelector<HTMLButtonElement>('[aria-label="Đóng cửa sổ"]')?.click()
      }
      if (event.key !== 'Tab') return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isInventoryModalOpen, isReadyModalOpen])

  const handleRetry = () => {
    setLoading(true)
    fetchData()
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 space-y-2">
        <Clock className="w-6 h-6 animate-pulse text-emerald-600" />
        <span className="text-sm font-medium">Đang tải thông tin lô...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50">
        <PageHeader title="Chi tiết lô cây" showBack backTo={backTo} />
        <div className="p-8 text-center space-y-3 flex-1 flex flex-col items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-amber-600" />
          <p className="text-sm text-slate-700 font-semibold">{error}</p>
          <button
            onClick={handleRetry}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl active:bg-emerald-800"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Thử lại</span>
          </button>
        </div>
      </div>
    )
  }

  if (!batch) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50">
        <PageHeader title="Chi tiết lô cây" showBack backTo={backTo} />
        <div className="p-6 my-auto">
          <EmptyState
            title="Không tìm thấy lô cây này"
            description="Lô cây có thể đã bị xóa hoặc đường dẫn không chính xác."
            actionText={backTo === '/batches' ? 'Quay lại danh sách lô' : 'Quay lại Vườn'}
            onAction={() => navigate(backTo)}
            icon={Trees}
          />
        </div>
      </div>
    )
  }

  const available = availableQuantityForBatch(batch, reservations)
  const reserved = reservedQuantityForBatch(batch.id, reservations)
  const shortage = commitmentShortageForBatch(batch, reservations)
  const rate = survivalRate(batch.currentQuantity, batch.initialQuantity)
  const attention = isBatchAttention(batch)
  const displayStatus = getBatchDisplayStatus(batch, attention)

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <PageHeader
        title={`${batch.code}`}
        subtitle={batch.variety}
        showBack
        backTo={backTo}
        rightAction={<StatusBadge status={deriveBatchStatus(batch)} />}
      />

      <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full pb-16">
        {notice && <p role="status" className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl mb-4 text-base">{notice}</p>}
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 space-y-5 lg:space-y-0">
          {/* Left Column: Metrics, Attention, Actions, Batch Info */}
          <div className="lg:col-span-7 space-y-5">
            {/* Quantity overview cards */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
            <span className="text-sm font-bold text-emerald-800">Cây còn bán</span>
            <div className="flex items-baseline gap-2 mt-1 text-emerald-700">
              <span className="text-3xl font-black tracking-tight">{formatQuantity(available)}</span>
              <span className="text-base font-semibold">cây</span>
            </div>
            <p className="text-sm text-emerald-800 mt-1">Cây đủ bán trừ số đang giữ chưa xuất.</p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-600 font-medium block min-h-8">Cây còn sống</span>
              <span className="text-base font-bold text-slate-800 block mt-0.5">
                {formatQuantity(batch.currentQuantity)}
              </span>
              <span className="text-xs text-slate-600">cây</span>
            </div>

            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-600 font-medium block min-h-8">Cây đủ bán</span>
              <span className="text-base font-bold text-slate-800 block mt-0.5">
                {formatQuantity(batch.readyQuantity)}
              </span>
              <span className="text-xs text-slate-600">cây</span>
            </div>

            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-600 font-medium block min-h-8">Đang giữ</span>
              <span className="text-base font-bold text-amber-800 block mt-0.5">
                {formatQuantity(reserved)}
              </span>
              <span className="text-xs text-slate-600">cây</span>
            </div>
          </div>

          {shortage > 0 && (
            <div className="bg-amber-50 border border-amber-300 text-amber-950 p-3 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-bold">Thiếu {formatQuantity(shortage)} cây đã giữ cho khách</div>
                <p className="mt-1">Cây đủ bán thấp hơn số đang giữ chưa xuất.</p>
                <SecondaryButton fullWidth className="mt-3" onClick={() => setReconcileOpen(true)}>ĐIỀU CHỈNH NGUỒN GIỮ</SecondaryButton>
              </div>
            </div>
          )}
        </div>

        {/* Warning if attention (Sắp quá lứa) */}
        {attention && batch.preferredSellBefore && (
          <div className="bg-amber-50/90 border border-amber-300 text-amber-950 p-3.5 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-bold">Nên bán trước {formatShortDate(batch.preferredSellBefore)}</div>
              <div className="text-amber-800 mt-0.5 leading-relaxed">
                Cây đã đạt chuẩn. Để lâu rễ ăn sâu vào đất bãi, nhổ cây dễ vỡ bầu và đứt rễ non.
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons: Split Mental Models */}
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setIsInventoryModalOpen(true)}
              className="min-h-[46px] px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ClipboardList className="w-4 h-4 text-emerald-700" />
              <span>KIỂM KÊ CÂY SỐNG</span>
            </button>

            <button
              type="button"
              onClick={() => setIsReadyModalOpen(true)}
              className="min-h-[46px] px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>CẬP NHẬT CÂY ĐỦ BÁN</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate(`/orders/new?batchId=${batch.id}&variety=${encodeURIComponent(batch.variety)}`)}
            className="w-full min-h-[46px] px-3 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>GHI ĐƠN</span>
          </button>
        </div>

        {/* Thông tin lô (Batch Info) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-2.5 text-xs">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-1">
            Thông tin lô giống
          </h4>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">Trạng thái:</span>
            <span className="font-bold text-slate-800">{displayStatus}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">Ngày tạo lô:</span>
            <span className="font-semibold text-slate-800">
              {formatShortDate(batch.createdAt, true)}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">Số lượng ban đầu:</span>
            <span className="font-semibold text-slate-800">
              {formatQuantity(batch.initialQuantity)} cây
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">Tỷ lệ sống:</span>
            <span className="font-bold text-emerald-700">
              {formatSurvivalRate(rate)}
            </span>
          </div>
          {batch.sourceNote && (
            <div className="pt-1">
              <span className="text-slate-500 block mb-1">Ghi chú nguồn gốc:</span>
              <p className="bg-slate-50 p-2.5 rounded-lg text-slate-700 leading-relaxed">
                {batch.sourceNote}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Dossier & History */}
      <div className="lg:col-span-5 space-y-5">
        {/* Hồ sơ nguồn gốc (Batch Dossier) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-700" />
              <span>Hồ sơ nguồn gốc</span>
            </h4>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                dossier
                  ? deriveDossierCompleteness(dossier) === 'referenced'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-sky-100 text-sky-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {DOSSIER_COMPLETENESS_LABELS[deriveDossierCompleteness(dossier)]}
            </span>
          </div>

          {dossier ? (
            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Loại vật liệu:</span>
                  <span className="font-semibold text-slate-800">
                    {MATERIAL_TYPE_LABELS[dossier.materialType]}
                  </span>
                </div>
                {dossier.sourceName && (
                  <div className="flex justify-between text-slate-600">
                    <span>Nguồn / nơi lấy:</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[200px]">
                      {dossier.sourceName}
                    </span>
                  </div>
                )}
                {dossier.sourceLotCode && (
                  <div className="flex justify-between text-slate-600">
                    <span>Mã lô nguồn:</span>
                    <span className="font-semibold text-slate-800">
                      {dossier.sourceLotCode}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200/60">
                  <span>Chứng từ tham chiếu:</span>
                  <span className="font-bold text-emerald-700">
                    {dossier.documents.length > 0 ? `${dossier.documents.length} chứng từ` : 'Chưa có'}
                  </span>
                </div>
              </div>

              <SecondaryButton
                fullWidth
                onClick={() => navigate(`/dossiers/${batch.id}`)}
              >
                XEM HỒ SƠ
              </SecondaryButton>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">
                Chưa ghi nhận thông tin nguồn vật liệu ban đầu và chứng từ tham chiếu cho lô cây này.
              </p>
              <SecondaryButton
                fullWidth
                onClick={() => navigate(`/dossiers/${batch.id}`)}
              >
                THÊM HỒ SƠ
              </SecondaryButton>
            </div>
          )}
        </div>

        {/* Lịch sử lô cây (Lightweight History) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-emerald-700" />
            <span>Nhật ký lô cây</span>
          </h4>

          {events.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Chưa có nhật ký ghi nhận.</p>
          ) : (
            <div className="space-y-2.5 pl-2 border-l-2 border-emerald-200 ml-1">
              {events.map((evt) => {
                const payloadMsg =
                  evt.payload && typeof evt.payload === 'object' && 'message' in evt.payload
                    ? (evt.payload as { message: string }).message
                    : evt.type

                return (
                  <div key={evt.id} className="relative pl-3 text-xs">
                    <div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-600 border-2 border-white" />
                    <div className="text-[11px] text-slate-400">
                      {formatShortDate(evt.createdAt, true)}
                    </div>
                    <div className="font-medium text-slate-800 mt-0.5">
                      {payloadMsg}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>

      {/* Inventory Update Modal */}
      {reconcileOpen && <BatchReconciliationModal batch={batch} onClose={() => setReconcileOpen(false)} onSuccess={async (projection, transferMessage) => {
        await fetchData()
        setNotice((projection.source.shortageAfter > 0
          ? `Đã điều chỉnh nguồn giữ. Lô còn thiếu ${formatQuantity(projection.source.shortageAfter)} cây đã giữ.`
          : 'Đã điều chỉnh nguồn giữ. Lô không còn thiếu cây đã giữ.') + (transferMessage ? ` ${transferMessage}` : ''))
        setReconcileOpen(false)
      }} />}
      <InventoryUpdateModal
        batch={batch}
        reservations={reservations}
        isOpen={isInventoryModalOpen}
        onClose={closeInventory}
        onSuccess={updateSucceeded}
      />

      {/* Ready Quantity Update Modal */}
      <ReadyQuantityUpdateModal
        batch={batch}
        reservedQuantity={reserved}
        isOpen={isReadyModalOpen}
        onClose={closeReady}
        onSuccess={updateSucceeded}
      />
    </div>
  )
}
