import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ChevronRight, AlertTriangle, Clock, RotateCcw, Sprout, Truck } from 'lucide-react'
import type { Organization } from '../../domain/organization'
import type { BatchWithAvailability } from '../../domain/batch'
import type { OrderWithDerived } from '../../domain/order'
import type { Contact } from '../../domain/contact'
import type { Shipment } from '../../domain/shipment'
import {
  organizationRepository,
  batchRepository,
  reservationRepository,
  orderRepository,
  contactRepository,
  shipmentRepository,
  settingsRepository
} from '../../data/repositories'
import {
  availableQuantityForBatch,
  reservedQuantityForBatch,
  formatQuantity
} from '../../domain/quantity'
import { isBatchAttention, deriveBatchStatus } from '../../domain/batch'
import {
  reservedQuantityForOrder,
  orderShortage,
  deriveOrderDisplayStatus
} from '../../domain/order'
import { formatHeaderDate, formatShortDate } from '../../domain/date'
import { PrimaryButton } from '../../shared/components/PrimaryButton'
import { undoService } from '../../services/undoService'

export const TodayScreen: React.FC = () => {
  const navigate = useNavigate()
  const [org, setOrg] = useState<Organization | null>(null)
  const [batches, setBatches] = useState<BatchWithAvailability[]>([])
  const [orders, setOrders] = useState<OrderWithDerived[]>([])
  const [plannedShipments, setPlannedShipments] = useState<Shipment[]>([])
  const [appMode, setAppMode] = useState<string>('pilot')
  const [todayDate, setTodayDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [
        loadedOrg,
        loadedBatches,
        loadedReservations,
        loadedOrders,
        loadedContacts,
        loadedShipments,
        mode
      ] = await Promise.all([
        organizationRepository.getCurrent(),
        batchRepository.getAll(),
        reservationRepository.getAll(),
        orderRepository.getAll(),
        contactRepository.getAll(),
        shipmentRepository.getAll(),
        settingsRepository.get('app_mode')
      ])

      // Map batches with derived numbers
      const mappedBatches: BatchWithAvailability[] = loadedBatches.map((b) => {
        const reserved = reservedQuantityForBatch(b.id, loadedReservations)
        const available = availableQuantityForBatch(b, loadedReservations)
        const attention = isBatchAttention(b)
        return {
          ...b,
          reservedQuantity: reserved,
          availableQuantity: available,
          isAttention: attention
        }
      })

      // Map contacts lookup
      const contactMap = new Map<string, Contact>(loadedContacts.map((c) => [c.id, c]))

      // Map orders with derived numbers
      const mappedOrders: OrderWithDerived[] = loadedOrders.map((o) => {
        const contact = contactMap.get(o.customerId)
        const reserved = reservedQuantityForOrder(o.id, loadedReservations)
        const shortage = orderShortage(o, loadedReservations)
        const displayStatus = deriveOrderDisplayStatus(o, loadedReservations, loadedShipments)
        return {
          ...o,
          customerName: contact?.name || 'Khách quen',
          customerPhone: contact?.phone,
          reservedQuantity: reserved,
          shortage,
          displayStatus
        }
      })

      const plannedList = loadedShipments.filter((s) => s.status === 'planned')

      setOrg(loadedOrg)
      setBatches(mappedBatches)
      setOrders(mappedOrders)
      setPlannedShipments(plannedList)
      setAppMode(mode || 'pilot')
      setTodayDate(formatHeaderDate(new Date()))
      setError(null)
    } catch (err) {
      console.error('Error loading today data:', err)
      setError('Chưa đọc được dữ liệu trên thiết bị.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const unsubscribe = undoService.subscribe(() => {
      fetchData()
    })
    return unsubscribe
  }, [fetchData])

  const handleRetry = () => {
    setLoading(true)
    fetchData()
  }

  // Derived aggregates for CÂY HÔM NAY
  const totalAvailable = batches
    .filter((b) => deriveBatchStatus(b) === 'ready')
    .reduce((sum, b) => sum + b.availableQuantity, 0)

  const totalReserved = batches.reduce((sum, b) => sum + b.reservedQuantity, 0)

  const attentionBatches = batches.filter((b) => b.isAttention)

  // Orders needing attention: shortage > 0 and active (not shipped, not cancelled)
  const attentionOrders = orders.filter(
    (o) => o.shortage > 0 && o.status !== 'shipped' && o.status !== 'cancelled'
  )
  const pendingOrdersCount = orders.filter(
    (o) => o.status !== 'shipped' && o.status !== 'cancelled'
  ).length

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 space-y-2">
        <Clock className="w-6 h-6 animate-pulse text-emerald-600" />
        <span className="text-sm font-medium">Đang mở sổ cây...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
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
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      {/* Brand & Organization Header */}
      <div className="bg-emerald-800 text-white px-4 sm:px-6 pt-5 pb-6">
        <div className="max-w-6xl mx-auto w-full">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-emerald-200 font-bold">
                Vườn Ươm
              </span>
              {appMode === 'demo' && (
                <span className="bg-emerald-900/80 border border-emerald-600 text-emerald-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  Bản mẫu
                </span>
              )}
            </div>
            <span className="text-xs text-emerald-200 font-medium">{todayDate}</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-white truncate">
            {org?.name || 'Vườn của tôi'}
          </h1>
          <p className="text-xs text-emerald-200/90 mt-0.5">Sổ cây giống trên điện thoại</p>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 -mt-3">
        <div className="shadow-md rounded-xl overflow-hidden max-w-sm">
          <PrimaryButton
            onClick={() => navigate('/orders/new')}
            className="text-base font-bold py-3.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>GHI ĐƠN</span>
          </PrimaryButton>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 space-y-6 lg:space-y-0">
          {/* Left Column: Stats & Shipments */}
          <div className="lg:col-span-7 space-y-6">
            {/* SECTION: CÂY HÔM NAY */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              CÂY HÔM NAY
            </h2>
            <button
              onClick={() => navigate('/batches')}
              className="text-xs text-emerald-700 font-semibold hover:underline inline-flex items-center gap-0.5 py-2 px-1 -mr-1 min-h-[44px] touch-manipulation"
            >
              Xem tất cả ({batches.length})
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Đủ bán -> tap navigates to /batches?filter=ready */}
            <div
              onClick={() => navigate('/batches?filter=ready')}
              role="button"
              tabIndex={0}
              className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs active:bg-emerald-50 transition-colors cursor-pointer"
            >
              <span className="text-xs text-slate-500 font-medium block">Đủ bán</span>
              <span className="text-lg font-black text-emerald-700 tracking-tight block mt-0.5">
                {formatQuantity(totalAvailable)}
              </span>
              <span className="text-[10px] text-slate-400">cây sẵn sàng</span>
            </div>

            {/* Đã giữ */}
            <div
              onClick={() => navigate('/orders?filter=ready_pickup')}
              role="button"
              tabIndex={0}
              className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs active:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="text-xs text-slate-500 font-medium block">Đã giữ</span>
              <span className="text-lg font-black text-slate-800 tracking-tight block mt-0.5">
                {formatQuantity(totalReserved)}
              </span>
              <span className="text-[10px] text-slate-400">chờ giao</span>
            </div>

            {/* Sắp quá lứa -> tap navigates to /batches?filter=attention */}
            <div
              onClick={() => navigate('/batches?filter=attention')}
              role="button"
              tabIndex={0}
              className={`bg-white p-3 rounded-xl border shadow-xs active:bg-amber-50 transition-colors cursor-pointer ${
                attentionBatches.length > 0 ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'
              }`}
            >
              <span className="text-xs text-slate-500 font-medium block">Sắp quá lứa</span>
              <span
                className={`text-lg font-black tracking-tight block mt-0.5 ${
                  attentionBatches.length > 0 ? 'text-amber-700' : 'text-slate-700'
                }`}
              >
                {attentionBatches.length}
              </span>
              <span className="text-[10px] text-slate-400">lô cần xuất</span>
            </div>
          </div>
        </div>

        {/* SECTION: CHUYẾN CẦN GIAO (Planned Shipments) */}
        {plannedShipments.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-emerald-700" />
                <span>CHUYẾN CẦN GIAO ({plannedShipments.length})</span>
              </h2>
              <button
                onClick={() => navigate('/shipments?filter=planned')}
                className="text-xs text-emerald-700 font-semibold hover:underline inline-flex items-center gap-0.5 py-2 px-1 -mr-1 min-h-[44px] touch-manipulation"
              >
                Xem tất cả
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {plannedShipments.map((s) => {
                const order = orders.find((o) => o.id === s.orderId)
                return (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/shipments/${s.id}`)}
                    role="button"
                    tabIndex={0}
                    className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between cursor-pointer active:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-slate-900 text-sm truncate">
                          {order?.customerName || 'Khách hàng'}
                        </span>
                        <span className="text-[10px] bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.5 rounded font-bold">
                          Chờ xuất xe
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {order?.variety} • {formatQuantity(s.plannedQuantity)} cây
                        {s.plannedDate ? ` • Hẹn: ${formatShortDate(s.plannedDate)}` : ''}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                  </div>
                )
              })}
            </div>
          </div>
        )}

          </div>

          {/* Right Column: Attention & Tasks */}
          <div className="lg:col-span-5 space-y-6">
            {/* SECTION: VIỆC CẦN LÀM */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  VIỆC CẦN LÀM
                </h2>
                <button
                  onClick={() => navigate('/orders')}
                  className="text-xs text-emerald-700 font-semibold hover:underline inline-flex items-center gap-0.5 py-2 px-1 -mr-1 min-h-[44px] touch-manipulation"
                >
                  Xem đơn hàng ({pendingOrdersCount})
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2">
                {/* Attention batches notification */}
                {attentionBatches.map((b) => (
                  <div
                    key={`att_${b.id}`}
                    onClick={() => navigate(`/batches/${b.id}`)}
                    role="button"
                    tabIndex={0}
                    className="bg-amber-50/90 border border-amber-300 p-3.5 rounded-xl flex items-start gap-3 cursor-pointer active:bg-amber-100 transition-colors"
                  >
                    <div className="w-5 h-5 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="font-bold text-amber-950">
                        {b.code} · Sắp quá lứa
                      </div>
                      <div className="text-amber-900 mt-0.5">
                        {b.variety} — Nên bán trước{' '}
                        <strong>{formatShortDate(b.preferredSellBefore)}</strong> (tránh rễ ăn sâu)
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-amber-700 shrink-0 self-center" />
                  </div>
                ))}

                {/* Orders requiring attention (shortage > 0) */}
                {attentionOrders.map((order) => {
                  const isShortage = order.shortage > 0

                  return (
                    <div
                      key={`ord_${order.id}`}
                      onClick={() => navigate(`/orders/${order.id}`)}
                      role="button"
                      tabIndex={0}
                      className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between cursor-pointer active:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-slate-900 text-sm">
                            {order.customerName}
                          </span>
                          {isShortage ? (
                            <span className="text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-md">
                              {order.displayStatus.label}
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-md">
                              Đã giữ đủ
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-600">
                          {formatQuantity(order.requestedQuantity)} cây {order.variety}
                        </div>
                        {order.requestedDate && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Lấy ngày: {formatShortDate(order.requestedDate)}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                    </div>
                  )
                })}

                {batches.length === 0 && (
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                      <Sprout className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm">Chưa có dữ liệu trong vườn</h3>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      Hãy tạo lô giống đầu tiên để theo dõi số lượng cây đang ươm, cây đủ bán và ghi đơn cho khách.
                    </p>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => navigate('/batches/new')}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>+ Tạo lô đầu tiên</span>
                      </button>
                    </div>
                  </div>
                )}

                {batches.length > 0 &&
                  attentionBatches.length === 0 &&
                  attentionOrders.length === 0 &&
                  plannedShipments.length === 0 && (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                      Không có việc gấp nào cần xử lý hôm nay.
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
