import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Calendar,
  Phone,
  Sprout,
  Store,
  Clock,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  Layers
} from 'lucide-react'
import { PageHeader } from '../../shared/components/PageHeader'
import { EmptyState } from '../../shared/components/EmptyState'
import { formatQuantity } from '../../domain/quantity'
import { formatShortDate } from '../../domain/date'
import {
  getReservationOptions,
  type OrderReservationOptions,
  type ResolvedReservation
} from '../../services/reservationService'
import { undoService } from '../../services/undoService'
import {
  ReserveQuantityModal,
  type ReserveSource
} from './ReserveQuantityModal'
import { ReleaseConfirmModal } from './ReleaseConfirmModal'

export const OrderReserveScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const externalSectionRef = useRef<HTMLDivElement>(null)

  const [options, setOptions] = useState<OrderReservationOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)

  // Modals state
  const [activeSource, setActiveSource] = useState<ReserveSource | null>(null)
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false)
  const [reservationToRelease, setReservationToRelease] = useState<ResolvedReservation | null>(null)
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false)

  const fetchData = useCallback(async () => {
    if (!id) return
    try {
      const data = await getReservationOptions(id)
      if (data) {
        setOptions(data)
        setError(null)
      } else {
        setOptions(null)
      }
    } catch (err) {
      console.error('Error fetching reservation options:', err)
      setError('Chưa tải được dữ liệu nguồn cây cho đơn này.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
    const unsubscribe = undoService.subscribe(() => {
      fetchData()
    })
    return unsubscribe
  }, [fetchData])

  const handleOpenReserve = (source: ReserveSource) => {
    setActiveSource(source)
    setIsReserveModalOpen(true)
  }

  const handleOpenRelease = (res: ResolvedReservation) => {
    setReservationToRelease(res)
    setIsReleaseModalOpen(true)
  }

  const handleSuccessAction = (message: string) => {
    setNotification(message)
    fetchData()
    // Auto-dismiss notification after 5s
    setTimeout(() => {
      setNotification((curr) => (curr === message ? null : curr))
    }, 5000)
  }

  const scrollToExternalSources = () => {
    if (externalSectionRef.current) {
      externalSectionRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 space-y-2 min-h-screen">
        <Clock className="w-6 h-6 animate-pulse text-emerald-600" />
        <span className="text-sm font-medium">Đang tìm nguồn cây khả dụng...</span>
      </div>
    )
  }

  if (error || !options) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
        <PageHeader title="Giữ cây cho đơn" showBack backTo={`/orders/${id || ''}`} />
        <div className="p-6 my-auto">
          <EmptyState
            title={error || 'Không tìm thấy đơn hàng'}
            description="Đơn hàng có thể đã bị xóa hoặc không hợp lệ."
            actionText="Quay lại danh sách đơn"
            onAction={() => navigate('/orders')}
            icon={AlertTriangle}
          />
        </div>
      </div>
    )
  }

  const {
    order,
    customer,
    reservedQuantity,
    shortage,
    ownBatches,
    externalSuppliers,
    currentReservations
  } = options

  const progressPercent = Math.min(
    Math.round((reservedQuantity / order.requestedQuantity) * 100),
    100
  )
  const isFullyReserved = shortage === 0

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <PageHeader
        title="Giữ cây cho đơn"
        subtitle={`${customer?.name || 'Khách quen'} · ${order.variety}`}
        showBack
        backTo={`/orders/${order.id}`}
      />

      <div className="p-4 max-w-5xl mx-auto w-full space-y-4">
        {/* Success toast / notification banner */}
        {notification && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded-2xl flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="font-semibold">{notification}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-emerald-700 font-bold hover:underline ml-2"
            >
              Đóng
            </button>
          </div>
        )}

        {/* Responsive Grid: 1 col on mobile, 2 cols (5/7) on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* ========================================================= */}
          {/* LEFT COLUMN: Order Summary & Current Reservations (5 cols) */}
          {/* ========================================================= */}
          <div className="md:col-span-5 space-y-4">
            {/* Order Summary & Customer Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {customer?.name || 'Khách quen'}
                  </h3>
                  {customer?.phone && (
                    <a
                      href={`tel:${customer.phone}`}
                      className="inline-flex items-center gap-1 text-xs text-emerald-700 font-bold mt-0.5 hover:underline"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{customer.phone}</span>
                    </a>
                  )}
                </div>

                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border ${
                    isFullyReserved
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-amber-50 text-amber-900 border-amber-300'
                  }`}
                >
                  {isFullyReserved ? 'Đã giữ đủ' : `Thiếu ${formatQuantity(shortage)}`}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-500">Giống cây:</span>
                  <div className="font-bold text-slate-800 mt-0.5">{order.variety}</div>
                </div>
                <div>
                  <span className="text-slate-500">Số lượng cần:</span>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {formatQuantity(order.requestedQuantity)} cây
                  </div>
                </div>
                {order.requestedDate && (
                  <div className="col-span-2 flex items-center gap-1.5 text-slate-600 mt-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Hẹn lấy: <strong>{formatShortDate(order.requestedDate, true)}</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Tiến độ giữ cây (Reservation Progress) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  TIẾN ĐỘ GIỮ CÂY
                </span>
                <span className="text-xs font-bold text-slate-900">
                  {formatQuantity(reservedQuantity)} / {formatQuantity(order.requestedQuantity)} cây
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    isFullyReserved ? 'bg-emerald-600' : 'bg-amber-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {isFullyReserved ? (
                <div className="bg-emerald-50/90 border border-emerald-200 text-emerald-900 p-3 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div>
                    <span className="font-bold block">✓ Đã giữ đủ {formatQuantity(order.requestedQuantity)} cây.</span>
                    <span className="text-emerald-700">Đơn hàng đã sẵn sàng để xuất giao.</span>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50/90 border border-amber-200 text-amber-900 p-3 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <div>
                    <span className="font-bold block">
                      Còn thiếu {formatQuantity(shortage)} cây.
                    </span>
                    <span className="text-amber-800">
                      Hãy chọn lô trong vườn hoặc gom thêm từ nhà vườn liên kết.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Current Reservations Breakdown with [ Bỏ giữ ] */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Nguồn cây đã giữ ({currentReservations.length})</span>
                </h4>
                {reservedQuantity > 0 && (
                  <span className="text-xs font-bold text-emerald-800">
                    {formatQuantity(reservedQuantity)} cây
                  </span>
                )}
              </div>

              {currentReservations.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">
                  Chưa giữ cây từ nguồn nào. Chọn nguồn khả dụng bên cạnh để bắt đầu giữ cây.
                </p>
              ) : (
                <div className="space-y-2">
                  {currentReservations.map((res) => (
                    <div
                      key={res.id}
                      className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              res.isOwnBatch
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {res.isOwnBatch ? (
                              <Sprout className="w-4 h-4" />
                            ) : (
                              <Store className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">
                              {res.sourceLabel}
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              {res.isOwnBatch ? 'Lô trong vườn' : 'Vườn ngoài gom cây'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-black text-slate-900 text-sm">
                            {formatQuantity(res.quantity)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">cây</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Đang giữ
                        </span>

                        <button
                          type="button"
                          onClick={() => handleOpenRelease(res)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 active:text-rose-800 hover:underline p-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>BỎ GIỮ</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: Available Sources (Own Batches & Suppliers) (7 cols) */}
          {/* ========================================================= */}
          <div className="md:col-span-7 space-y-4">
            {/* Section 1: CÂY Ở VƯỜN MÌNH */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 uppercase tracking-wide">
                  <Sprout className="w-4 h-4 text-emerald-700" />
                  <span>CÂY Ở VƯỜN MÌNH ({order.variety})</span>
                </h4>
                <span className="text-xs text-slate-400">
                  {ownBatches.length} lô đủ bán
                </span>
              </div>

              {ownBatches.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 text-center space-y-2">
                  <p className="text-xs text-slate-600">
                    Vườn mình hiện chưa có <strong>{order.variety}</strong> đủ bán.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Bạn có thể gom thêm từ các nhà vườn liên kết bên dưới.
                  </p>
                  <button
                    type="button"
                    onClick={scrollToExternalSources}
                    className="mt-1 px-3 py-1.5 bg-sky-700 hover:bg-sky-800 active:bg-sky-900 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1"
                  >
                    <span>+ THÊM NGUỒN NGOÀI</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {ownBatches.map((batch) => {
                    const canReserve = !isFullyReserved && batch.availableQuantity > 0

                    return (
                      <div
                        key={batch.id}
                        className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-3"
                      >
                        {/* Header: Code & Variety */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-base">
                                {batch.code}
                              </span>
                              {batch.isAttention && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  <AlertTriangle className="w-3 h-3 text-amber-700" />
                                  <span>Sắp quá lứa</span>
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-500">
                              {batch.variety} · {formatShortDate(batch.createdAt)}
                            </span>
                          </div>

                          <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
                            Đang bán
                          </span>
                        </div>

                        {/* Attention warning if sell before */}
                        {batch.isAttention && batch.preferredSellBefore && (
                          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2 rounded-lg text-[11px] flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span>
                              Nên bán trước <strong>{formatShortDate(batch.preferredSellBefore)}</strong> (tránh rễ ăn sâu)
                            </span>
                          </div>
                        )}

                        {/* Metrics Row: Đủ bán - Đã giữ - Còn bán */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="bg-white p-2 rounded-lg border border-slate-200">
                            <span className="text-[10px] text-slate-400 block">Đủ bán</span>
                            <span className="font-bold text-slate-700 mt-0.5 block">
                              {formatQuantity(batch.readyQuantity)}
                            </span>
                          </div>

                          <div className="bg-white p-2 rounded-lg border border-slate-200">
                            <span className="text-[10px] text-slate-400 block">Đã giữ</span>
                            <span className="font-bold text-amber-800 mt-0.5 block">
                              {formatQuantity(batch.reservedQuantity)}
                            </span>
                          </div>

                          <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                            <span className="text-[10px] text-emerald-800 font-semibold block">
                              Còn bán
                            </span>
                            <span className="font-black text-emerald-700 text-sm mt-0.5 block">
                              {formatQuantity(batch.availableQuantity)}
                            </span>
                          </div>
                        </div>

                        {/* CTA button */}
                        <button
                          type="button"
                          disabled={!canReserve}
                          onClick={() => handleOpenReserve({ type: 'own_batch', batch })}
                          className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors ${
                            canReserve
                              ? 'bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white cursor-pointer shadow-xs'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <Sprout className="w-3.5 h-3.5" />
                          <span>
                            {isFullyReserved
                              ? 'ĐƠN ĐÃ ĐỦ CÂY'
                              : `GIỮ TỪ LÔ NÀY (CÒN ${formatQuantity(batch.availableQuantity)})`}
                          </span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Section 2: NGUỒN NGOÀI GOM CÂY */}
            <div
              ref={externalSectionRef}
              className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 uppercase tracking-wide">
                  <Store className="w-4 h-4 text-sky-700" />
                  <span>NGUỒN NGOÀI GOM CÂY ({order.variety})</span>
                </h4>
                <span className="text-xs text-slate-400">Số lượng tham khảo</span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Khi vườn nhà không đủ cây hoặc muốn giữ nguồn từ các chủ vườn liên kết quanh vùng
                (Hữu Lũng / Tuấn Sơn / Bắc Giang).
              </p>

              <div className="space-y-2.5">
                {externalSuppliers.map((supplier) => {
                  const canReserve = !isFullyReserved

                  return (
                    <div
                      key={supplier.supplierId}
                      className="bg-slate-50/80 border border-slate-200 p-3 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {supplier.name}
                          </span>
                          <span className="text-[10px] bg-sky-100 text-sky-800 font-semibold px-2 py-0.5 rounded">
                            Vườn liên kết
                          </span>
                        </div>

                        <div className="text-slate-600 mt-1">
                          {order.variety} · Có khoảng{' '}
                          <strong className="text-slate-900">
                            {formatQuantity(supplier.estimatedQuantity)} cây
                          </strong>
                        </div>

                        {supplier.phone && (
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            <span>{supplier.phone}</span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        aria-label={`Giữ nguồn từ ${supplier.name}`}
                        disabled={!canReserve}
                        onClick={() =>
                          handleOpenReserve({ type: 'external_supplier', supplier })
                        }
                        className={`px-3 py-2 rounded-xl font-bold text-xs shrink-0 flex items-center gap-1 transition-colors ${
                          canReserve
                            ? 'bg-sky-700 hover:bg-sky-800 active:bg-sky-900 text-white cursor-pointer'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <span>GIỮ NGUỒN</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reserve Quantity Modal */}
      <ReserveQuantityModal
        isOpen={isReserveModalOpen}
        orderId={order.id}
        orderVariety={order.variety}
        orderShortage={shortage}
        source={activeSource}
        onClose={() => setIsReserveModalOpen(false)}
        onSuccess={handleSuccessAction}
      />

      {/* Release Confirmation Modal */}
      <ReleaseConfirmModal
        isOpen={isReleaseModalOpen}
        reservation={reservationToRelease}
        onClose={() => setIsReleaseModalOpen(false)}
        onSuccess={handleSuccessAction}
      />
    </div>
  )
}
