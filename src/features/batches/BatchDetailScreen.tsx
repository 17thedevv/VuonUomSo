import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ClipboardList,
  Plus,
  Clock,
  History,
  Trees,
  RotateCcw
} from 'lucide-react'
import {
  batchRepository,
  reservationRepository,
  eventRepository
} from '../../data/repositories'
import type { Batch } from '../../domain/batch'
import type { Reservation } from '../../domain/reservation'
import type { DomainEvent } from '../../analytics/events'
import {
  availableQuantityForBatch,
  reservedQuantityForBatch,
  survivalRate,
  formatQuantity,
  formatSurvivalRate
} from '../../domain/quantity'
import { isBatchAttention, getBatchDisplayStatus } from '../../domain/batch'
import { formatShortDate } from '../../domain/date'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusBadge } from '../../shared/components/StatusBadge'
import { EmptyState } from '../../shared/components/EmptyState'

export const BatchDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [batch, setBatch] = useState<Batch | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [events, setEvents] = useState<DomainEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!id) return
    try {
      const [b, r, allEvents] = await Promise.all([
        batchRepository.getById(id),
        reservationRepository.getByBatchId(id),
        eventRepository.getAll()
      ])

      setBatch(b)
      setReservations(r)

      // Filter events related to this batch
      const batchEvents = allEvents.filter(
        (e) => e.entityId === id || (e.payload && typeof e.payload === 'object' && 'batchId' in e.payload && (e.payload as { batchId: string }).batchId === id)
      )
      setEvents(batchEvents)
      setError(null)
    } catch (err) {
      console.error('Error loading batch detail:', err)
      setError('Chưa tải được chi tiết lô cây.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
        <PageHeader title="Chi tiết lô cây" showBack backTo="/batches" />
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
        <PageHeader title="Chi tiết lô cây" showBack backTo="/batches" />
        <div className="p-6 my-auto">
          <EmptyState
            title="Không tìm thấy lô cây này"
            description="Lô cây có thể đã bị xóa hoặc đường dẫn không chính xác."
            actionText="Quay lại danh sách lô"
            onAction={() => navigate('/batches')}
            icon={Trees}
          />
        </div>
      </div>
    )
  }

  const available = availableQuantityForBatch(batch, reservations)
  const reserved = reservedQuantityForBatch(batch.id, reservations)
  const rate = survivalRate(batch.currentQuantity, batch.initialQuantity)
  const attention = isBatchAttention(batch)
  const displayStatus = getBatchDisplayStatus(batch, attention)

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <PageHeader
        title={`${batch.code}`}
        subtitle={batch.variety}
        showBack
        backTo="/batches"
        rightAction={<StatusBadge status={batch.status} />}
      />

      <div className="p-4 space-y-4">
        {/* Quantity overview cards */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[11px] text-slate-500 font-medium block">Còn sống</span>
              <span className="text-base font-bold text-slate-800 block mt-0.5">
                {formatQuantity(batch.currentQuantity)}
              </span>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[11px] text-slate-500 font-medium block">Đủ bán</span>
              <span className="text-base font-bold text-slate-800 block mt-0.5">
                {formatQuantity(batch.readyQuantity)}
              </span>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[11px] text-slate-500 font-medium block">Đã giữ</span>
              <span className="text-base font-bold text-amber-800 block mt-0.5">
                {formatQuantity(reserved)}
              </span>
            </div>
          </div>

          {/* Prominent CÒN BÁN banner */}
          <div className="bg-emerald-50/90 border border-emerald-200 p-3.5 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                CÂY CÒN BÁN
              </span>
              <p className="text-[11px] text-emerald-600 mt-0.5">
                Sẵn sàng xuất cho khách mới
              </p>
            </div>
            <div className="text-2xl font-black text-emerald-700 tracking-tight">
              {formatQuantity(available)}
            </div>
          </div>
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

        {/* Action Buttons (Read-only / Placeholder) */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled
            title="Tính năng kiểm kê thực tế sẽ có ở Phase P2"
            className="min-h-[46px] px-3 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
          >
            <ClipboardList className="w-4 h-4" />
            <span>KIỂM KÊ (P2)</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/orders/new?batchId=${batch.id}`)}
            className="min-h-[46px] px-3 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
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
  )
}
