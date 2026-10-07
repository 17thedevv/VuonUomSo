import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  getOrderShipmentSummary,
  createShipment,
  type OrderShipmentSummary
} from '../../services/shipmentService'
import { formatQuantity } from '../../domain/quantity'
import { PageHeader } from '../../shared/components/PageHeader'
import { PrimaryButton } from '../../shared/components/PrimaryButton'
import { SecondaryButton } from '../../shared/components/SecondaryButton'
import { AlertCircle, Truck, Calendar, FileText, CheckCircle2 } from 'lucide-react'
import { validationTracker } from '../../validation/validationTracker'

export const ShipmentNewScreen: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')

  const [summary, setSummary] = useState<OrderShipmentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [lineQuantities, setLineQuantities] = useState<Record<string, number>>({})
  const [plannedDate, setPlannedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    void validationTracker.formStarted('shipment_planned')
  }, [])

  useEffect(() => {
    if (!orderId) {
      setLoading(false)
      return
    }

    async function load() {
      setLoading(true)
      try {
        const data = await getOrderShipmentSummary(orderId!)
        setSummary(data)

        // Initialize default line allocations: if only 1 source, auto-fill full remaining
        if (data && data.activeReservations.length > 0) {
          const initial: Record<string, number> = {}
          if (data.activeReservations.length === 1) {
            initial[data.activeReservations[0].reservationId] = data.activeReservations[0].remainingToShip
          } else {
            data.activeReservations.forEach((r) => {
              initial[r.reservationId] = 0
            })
          }
          setLineQuantities(initial)
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Lỗi khi tải thông tin đơn hàng.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [orderId])

  if (!orderId) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
        <PageHeader title="Lên chuyến giao" showBack backTo="/orders" />
        <div className="p-4 text-center text-xs text-slate-500">
          Không tìm thấy mã đơn hàng. Vui lòng chọn đơn hàng từ danh sách.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
        <PageHeader title="Lên chuyến giao" showBack backTo={`/orders/${orderId}`} />
        <div className="p-12 text-center text-xs text-slate-400">Đang tải thông tin đơn...</div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
        <PageHeader title="Lên chuyến giao" showBack backTo={`/orders/${orderId}`} />
        <div className="p-4 text-center text-xs text-slate-500">Đơn hàng không tồn tại.</div>
      </div>
    )
  }

  // Enforce One Open Planned Shipment Rule: If there is already a planned shipment
  if (summary.plannedShipment) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
        <PageHeader title="Lên chuyến giao" showBack backTo={`/orders/${orderId}`} />
        <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>Đơn hàng đã có chuyến giao dự kiến</span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              Mỗi đơn hàng chỉ được có tối đa 1 chuyến giao đang lên lịch. Hiện đang có chuyến #{' '}
              <span className="font-semibold">{summary.plannedShipment.id}</span> với{' '}
              <span className="font-semibold">
                {formatQuantity(summary.plannedShipment.plannedQuantity)} cây
              </span>{' '}
              chưa xuất xe.
            </p>
          </div>

          <PrimaryButton
            fullWidth
            onClick={() => navigate(`/shipments/${summary.plannedShipment!.id}`)}
          >
            Xem chuyến giao dự kiến hiện tại
          </PrimaryButton>

          <SecondaryButton fullWidth onClick={() => navigate(`/orders/${orderId}`)}>
            Quay lại đơn hàng
          </SecondaryButton>
        </div>
      </div>
    )
  }

  // If order has no remaining supply sources ready
  if (summary.activeReservations.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
        <PageHeader title="Lên chuyến giao" showBack backTo={`/orders/${orderId}`} />
        <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-4">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h3 className="text-sm font-bold text-rose-900">Không có nguồn cây sẵn sàng để giao</h3>
            <p className="text-xs text-rose-700">
              Đơn hàng này chưa có khoản giữ cây nào còn hiệu lực hoặc toàn bộ số lượng giữ đã xuất hết.
            </p>
          </div>

          <PrimaryButton fullWidth onClick={() => navigate(`/orders/${orderId}/reserve`)}>
            Giữ cây cho đơn hàng
          </PrimaryButton>
        </div>
      </div>
    )
  }

  // Calculate total planned quantity from line inputs
  const totalPlanned = Object.values(lineQuantities).reduce((sum, q) => sum + (q || 0), 0)
  const vanPlanned = (totalPlanned / 10000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })

  const handleQuantityChange = (reservationId: string, val: string, max: number) => {
    const parsed = parseInt(val.replace(/\D/g, ''), 10)
    const validVal = isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), max)
    setLineQuantities((prev) => ({
      ...prev,
      [reservationId]: validVal
    }))
    setError(null)
  }

  const handleFillMax = (reservationId: string, max: number) => {
    setLineQuantities((prev) => ({
      ...prev,
      [reservationId]: max
    }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    if (totalPlanned <= 0) {
      setError('Vui lòng nhập số lượng cây cần giao lớn hơn 0.')
      void validationTracker.actionFailed('shipment_planned', 'validation')
      return
    }

    const lines = Object.entries(lineQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([resId, qty]) => ({
        reservationId: resId,
        quantity: qty
      }))

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await createShipment({
        orderId: orderId!,
        lines,
        plannedDate,
        note
      })

      void validationTracker.actionCompleted('shipment_planned')
      navigate(`/shipments/${res.shipment.id}`, { replace: true })
    } catch (err: unknown) {
      void validationTracker.actionFailed('shipment_planned', 'insufficient_stock')
      setError(err instanceof Error ? err.message : 'Không thể tạo chuyến giao.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <PageHeader title="Lên chuyến giao" showBack backTo={`/orders/${orderId}`} />

      <form onSubmit={handleSubmit} className="p-4 sm:p-6 max-w-3xl mx-auto w-full space-y-4 pb-12">
        {/* Order Context Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Đơn hàng #{orderId}
              </span>
              <h2 className="text-base font-bold text-slate-900">{summary.customer?.name}</h2>
              <div className="text-xs text-slate-500 font-medium">{summary.order.variety}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
            <div className="bg-slate-50 p-2 rounded-lg">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Đặt mua</div>
              <div className="text-xs font-bold text-slate-900">
                {formatQuantity(summary.order.requestedQuantity)}
              </div>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Đã giao</div>
              <div className="text-xs font-bold text-emerald-700">
                {formatQuantity(summary.totalShipped)}
              </div>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Còn thiếu</div>
              <div className="text-xs font-bold text-amber-700">
                {formatQuantity(summary.remainingToShip)}
              </div>
            </div>
          </div>
        </div>

        {/* Source Allocation Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Chọn nguồn cây bốc lên xe
            </h3>
          </div>

          <div className="space-y-3">
            {summary.activeReservations.map((res) => {
              const currentVal = lineQuantities[res.reservationId] || 0
              return (
                <div
                  key={res.reservationId}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900">{res.sourceLabel}</div>
                      <div className="text-[11px] text-slate-500">
                        {res.isOwnBatch ? 'Lô trong vườn' : 'Vườn liên kết'} • Đã giữ còn lại:{' '}
                        <span className="font-semibold text-slate-800">
                          {formatQuantity(res.remainingToShip)} cây
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleFillMax(res.reservationId, res.remainingToShip)}
                      className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 active:scale-95 transition-all"
                    >
                      Lấy hết ({formatQuantity(res.remainingToShip)})
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={currentVal === 0 ? '' : currentVal.toLocaleString('vi-VN')}
                      onChange={(e) =>
                        handleQuantityChange(res.reservationId, e.target.value, res.remainingToShip)
                      }
                      placeholder="0 cây"
                      className="flex-1 px-3 py-2 text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-right"
                    />
                    <span className="text-xs font-semibold text-slate-500 shrink-0">cây</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Live Total Banner */}
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900">Tổng cây lên chuyến này:</span>
            <div className="text-right">
              <span className="text-base font-extrabold text-emerald-800">
                {formatQuantity(totalPlanned)} cây
              </span>
              <span className="text-xs font-semibold text-emerald-700 ml-1.5">
                ({vanPlanned} vạn)
              </span>
            </div>
          </div>
        </div>

        {/* Date and Note Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Ngày hẹn xe đến bốc</span>
            </label>
            <input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium text-slate-800 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Ghi chú bốc xếp / loại xe</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Xe 5 tấn bốc tại luống 3, tài xế anh Tuấn..."
              className="w-full px-3 py-2 text-xs font-medium text-slate-800 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>

        {/* Invariant Note */}
        <div className="bg-slate-100 p-3 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Tạo chuyến giao dự kiến <strong>chưa làm giảm tồn kho cây trong vườn</strong>. Tồn kho
            vật lý chỉ được trừ khi xe bốc xong và bạn bấm &ldquo;Xác nhận đã giao&rdquo;.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="pt-2">
          <PrimaryButton
            type="submit"
            fullWidth
            disabled={totalPlanned <= 0 || isSubmitting}
          >
            {isSubmitting ? 'Đang tạo...' : 'Tạo chuyến giao dự kiến'}
          </PrimaryButton>
        </div>
      </form>
    </div>
  )
}
