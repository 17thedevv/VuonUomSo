import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Calendar,
  Phone,
  Layers,
  Sprout,
  Store,
  Clock,
  AlertTriangle,
  RotateCcw,
  ClipboardList,
  History
} from 'lucide-react'
import {
  orderRepository,
  contactRepository,
  reservationRepository,
  batchRepository,
  shipmentRepository
} from '../../data/repositories'
import type { Order } from '../../domain/order'
import type { Contact } from '../../domain/contact'
import type { Reservation } from '../../domain/reservation'
import type { Batch } from '../../domain/batch'
import type { Shipment } from '../../domain/shipment'
import type { DomainEvent } from '../../analytics/events'
import { formatQuantity } from '../../domain/quantity'
import { formatShortDate } from '../../domain/date'
import {
  reservedQuantityForOrder,
  orderShortage,
  deriveOrderDisplayStatus
} from '../../domain/order'
import { PageHeader } from '../../shared/components/PageHeader'
import { SecondaryButton } from '../../shared/components/SecondaryButton'
import { EmptyState } from '../../shared/components/EmptyState'
import { undoService } from '../../services/undoService'
import { getOrderReservationHistory, type ResolvedReservation } from '../../services/reservationService'
import { ReleaseConfirmModal } from './ReleaseConfirmModal'

interface ReservationSourceDetail {
  reservation: Reservation
  sourceLabel: string
  isOwnBatch: boolean
}

export const OrderDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [order, setOrder] = useState<Order | null>(null)
  const [customer, setCustomer] = useState<Contact | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [sourceDetails, setSourceDetails] = useState<ReservationSourceDetail[]>([])
  const [historyEvents, setHistoryEvents] = useState<DomainEvent[]>([])
  const [reservationToRelease, setReservationToRelease] = useState<ResolvedReservation | null>(null)
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!id) return
    try {
      const [o, allReservations, allContacts, allBatches, allShipments, events] =
        await Promise.all([
          orderRepository.getById(id),
          reservationRepository.getByOrderId(id),
          contactRepository.getAll(),
          batchRepository.getAll(),
          shipmentRepository.getByOrderId(id),
          getOrderReservationHistory(id)
        ])

      if (o) {
        setOrder(o)
        setReservations(allReservations)
        setShipments(allShipments)

        const cust = allContacts.find((c) => c.id === o.customerId) || null
        setCustomer(cust)

        // Resolve sources for reservations
        const batchMap = new Map<string, Batch>(allBatches.map((b) => [b.id, b]))
        const supplierMap = new Map<string, Contact>(allContacts.map((c) => [c.id, c]))

        const resolvedSources: ReservationSourceDetail[] = allReservations
          .filter((r) => r.status === 'active' || r.status === 'fulfilled')
          .map((r) => {
            if (r.sourceType === 'own_batch' && r.batchId) {
              const b = batchMap.get(r.batchId)
              return {
                reservation: r,
                sourceLabel: b ? `${b.code} (${b.variety})` : 'Lô trong vườn',
                isOwnBatch: true
              }
            } else if (r.sourceType === 'external_supplier' && r.supplierId) {
              const sup = supplierMap.get(r.supplierId)
              return {
                reservation: r,
                sourceLabel: sup ? `${sup.name}` : 'Vườn liên kết',
                isOwnBatch: false
              }
            }
            return {
              reservation: r,
              sourceLabel: 'Nguồn chưa xác định',
              isOwnBatch: false
            }
          })

        setSourceDetails(resolvedSources)
        setHistoryEvents(events)
        setError(null)
      } else {
        setOrder(null)
      }
    } catch (err) {
      console.error('Error loading order detail:', err)
      setError('Chưa tải được chi tiết đơn hàng.')
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

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    fetchData()
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 space-y-2">
        <Clock className="w-6 h-6 animate-pulse text-emerald-600" />
        <span className="text-sm font-medium">Đang tải thông tin đơn...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50">
        <PageHeader title="Chi tiết đơn" showBack backTo="/orders" />
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

  if (!order) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50">
        <PageHeader title="Chi tiết đơn" showBack backTo="/orders" />
        <div className="p-6 my-auto">
          <EmptyState
            title="Không tìm thấy đơn hàng này"
            description="Đơn hàng có thể đã bị xóa hoặc đường dẫn không chính xác."
            actionText="Quay lại danh sách đơn"
            onAction={() => navigate('/orders')}
            icon={ClipboardList}
          />
        </div>
      </div>
    )
  }

  const reserved = reservedQuantityForOrder(order.id, reservations)
  const shortage = orderShortage(order, reservations)
  const displayStatus = deriveOrderDisplayStatus(order, reservations, shipments)
  const progressPercent = Math.min(
    Math.round((reserved / order.requestedQuantity) * 100),
    100
  )

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <PageHeader
        title={customer?.name || 'Chi tiết đơn'}
        subtitle={`Đơn đặt ${order.variety}`}
        showBack
        backTo="/orders"
      />

      <div className="p-4 space-y-4">
        {/* Customer & Requested Summary */}
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

            {/* Display Badge */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border ${
                displayStatus.kind === 'shipped'
                  ? 'bg-slate-100 text-slate-700 border-slate-300'
                  : displayStatus.kind === 'full'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : displayStatus.kind === 'partial'
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-rose-50 text-rose-800 border-rose-300'
              }`}
            >
              {displayStatus.label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
            <div>
              <span className="text-slate-500">Giống cây:</span>
              <div className="font-bold text-slate-800 mt-0.5">{order.variety}</div>
            </div>
            <div>
              <span className="text-slate-500">Số lượng đặt:</span>
              <div className="font-bold text-slate-900 mt-0.5">
                {formatQuantity(order.requestedQuantity)} cây
              </div>
            </div>
            {order.requestedDate && (
              <div className="col-span-2 flex items-center gap-1.5 text-slate-600 mt-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Ngày hẹn lấy: <strong>{formatShortDate(order.requestedDate, true)}</strong>
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
            <span className="text-xs font-bold text-slate-800">
              {formatQuantity(reserved)} / {formatQuantity(order.requestedQuantity)} cây
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${
                progressPercent >= 100 ? 'bg-emerald-600' : 'bg-amber-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {shortage > 0 ? (
            <div className="bg-amber-50/80 border border-amber-200 text-amber-900 p-2.5 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Còn thiếu <strong>{formatQuantity(shortage)} cây</strong> để đủ đơn giao.
              </span>
            </div>
          ) : (
            <div className="text-xs text-emerald-800 font-medium">
              ✓ Đã chuẩn bị đủ toàn bộ cây cho đơn hàng.
            </div>
          )}
        </div>

        {/* Nguồn cây (Breakdown of Reservation Sources) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-700" />
            <span>Nguồn cây đã giữ ({sourceDetails.length} nguồn)</span>
          </h4>

          {sourceDetails.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Chưa phân bổ giữ cây từ nguồn nào.</p>
          ) : (
            <div className="space-y-2">
              {sourceDetails.map(({ reservation, sourceLabel, isOwnBatch }) => (
                <div
                  key={reservation.id}
                  className="bg-slate-50/80 border border-slate-200/80 p-3 rounded-xl space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isOwnBatch
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {isOwnBatch ? (
                          <Sprout className="w-4 h-4" />
                        ) : (
                          <Store className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 truncate">{sourceLabel}</div>
                        <div className="text-[11px] text-slate-400">
                          {isOwnBatch ? 'Lô trong vườn' : 'Vườn ngoài gom cây'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-slate-800 text-sm">
                        {formatQuantity(reservation.quantity)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">cây</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        reservation.status === 'fulfilled'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {reservation.status === 'fulfilled' ? 'Đã giao' : 'Đang giữ'}
                    </span>

                    {reservation.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => {
                          setReservationToRelease({
                            ...reservation,
                            sourceLabel,
                            isOwnBatch
                          })
                          setIsReleaseModalOpen(true)
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 active:text-rose-800 hover:underline p-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>BỎ GIỮ</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action button to Reserve */}
          <div className="pt-1">
            <SecondaryButton
              fullWidth
              onClick={() => navigate(`/orders/${order.id}/reserve`)}
            >
              {reserved === 0 ? 'GIỮ CÂY' : shortage > 0 ? 'GIỮ THÊM CÂY' : 'ĐIỀU CHỈNH GIỮ CÂY'}
            </SecondaryButton>
          </div>
        </div>

        {/* Lịch sử giữ cây (Reservation History) */}
        {historyEvents.length > 0 && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-emerald-700" />
              <span>Lịch sử giữ cây</span>
            </h4>

            <div className="space-y-2.5 pl-2 border-l-2 border-emerald-200 ml-1">
              {historyEvents.map((evt) => {
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
          </div>
        )}

        {/* Note if exists */}
        {order.note && (
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 text-xs space-y-1">
            <span className="text-slate-500 font-medium">Ghi chú giao nhận:</span>
            <p className="text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-lg">
              {order.note}
            </p>
          </div>
        )}
      </div>

      {/* Release Confirmation Modal */}
      <ReleaseConfirmModal
        isOpen={isReleaseModalOpen}
        reservation={reservationToRelease}
        onClose={() => setIsReleaseModalOpen(false)}
        onSuccess={() => {
          fetchData()
        }}
      />
    </div>
  )
}
