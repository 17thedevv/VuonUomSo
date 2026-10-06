import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  getShipmentDetail,
  confirmShipment,
  cancelShipment,
  type ShipmentDetailData
} from '../../services/shipmentService'
import { formatQuantity } from '../../domain/quantity'
import { formatDate } from '../../domain/date'
import { validationTracker } from '../../validation/validationTracker'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusBadge } from '../../shared/components/StatusBadge'
import { PrimaryButton } from '../../shared/components/PrimaryButton'
import { SecondaryButton } from '../../shared/components/SecondaryButton'
import {
  Phone,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  FileText,
  PackageCheck,
  Ban
} from 'lucide-react'

export const ShipmentDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [data, setData] = useState<ShipmentDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await getShipmentDetail(id)
      setData(res)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
        <PageHeader title="Chi tiết chuyến giao" showBack backTo="/shipments" />
        <div className="p-12 text-center text-xs text-slate-400">Đang tải chi tiết chuyến...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
        <PageHeader title="Chi tiết chuyến giao" showBack backTo="/shipments" />
        <div className="p-4 text-center text-xs text-slate-500">Chuyến giao không tồn tại.</div>
      </div>
    )
  }

  const { shipment, order, customer, linesWithDetails } = data
  const isPlanned = shipment.status === 'planned'
  const isCompleted = shipment.status === 'completed'
  const isCancelled = shipment.status === 'cancelled'

  const displayQuantity = isCompleted ? shipment.shippedQuantity : shipment.plannedQuantity
  const vanQuantity = (displayQuantity / 10000).toLocaleString('vi-VN', {
    maximumFractionDigits: 1
  })

  const handleConfirmShipment = async () => {
    if (isProcessing) return
    setIsProcessing(true)
    setActionError(null)

    try {
      await confirmShipment({ shipmentId: shipment.id })
      void validationTracker.actionCompleted('shipment_completed')
      setShowConfirmModal(false)
      await loadData()
    } catch (err: unknown) {
      void validationTracker.actionFailed('shipment_completed', 'insufficient_stock')
      setActionError(err instanceof Error ? err.message : 'Lỗi khi xác nhận giao hàng.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancelShipment = async () => {
    if (isProcessing) return
    setIsProcessing(true)
    setActionError(null)

    try {
      await cancelShipment({ shipmentId: shipment.id })
      void validationTracker.actionCompleted('shipment_cancelled')
      setShowCancelModal(false)
      await loadData()
    } catch (err: unknown) {
      void validationTracker.actionFailed('shipment_cancelled', 'domain_conflict')
      setActionError(err instanceof Error ? err.message : 'Lỗi khi hủy chuyến giao.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <PageHeader title={`Chuyến giao #${shipment.id}`} showBack backTo="/shipments" />

      <div className="max-w-6xl mx-auto w-full p-4 sm:p-6 pb-16">
        <div className="lg:grid lg:grid-cols-12 lg:gap-6 items-start space-y-4 lg:space-y-0">
          {/* Left Column: Status, Quantity, Customer & Order Info */}
          <div className="lg:col-span-7 space-y-4">
            {/* Status & Quantity Header Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Trạng thái chuyến
                </span>
                <StatusBadge status={shipment.status} />
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500 font-medium">
                    {isCompleted ? 'Số cây đã bốc xuất' : 'Số cây dự kiến bốc'}
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                    {formatQuantity(displayQuantity)} cây
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">
                    {vanQuantity} vạn
                  </span>
                </div>
              </div>

              {/* Date & Meta */}
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    {isCompleted && shipment.shippedAt
                      ? `Xuất vườn: ${formatDate(shipment.shippedAt)}`
                      : shipment.plannedDate
                      ? `Ngày hẹn: ${formatDate(shipment.plannedDate)}`
                      : `Ngày tạo: ${formatDate(shipment.createdAt)}`}
                  </span>
                </div>

                {shipment.note && (
                  <div className="flex items-center gap-1.5 col-span-2 text-slate-500 italic bg-slate-50 p-2 rounded">
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>&ldquo;{shipment.note}&rdquo;</span>
                  </div>
                )}
              </div>
            </div>

            {/* Customer & Order Context Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Thông tin người nhận
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">{customer?.name ?? 'Khách hàng'}</h3>
                  <div className="text-xs text-slate-500 font-medium">{order.variety}</div>
                </div>

                {customer?.phone && (
                  <a
                    href={`tel:${customer.phone}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold border border-emerald-200"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Gọi điện</span>
                  </a>
                )}
              </div>

              <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">Đơn hàng liên kết:</span>
                <Link
                  to={`/orders/${order.id}`}
                  className="font-bold text-emerald-700 hover:underline"
                >
                  #{order.id} (Xem chi tiết)
                </Link>
              </div>
            </div>
          </div>

          {/* Right Column: Physical Stock Breakdown, Invariant Warning, Action Buttons */}
          <div className="lg:col-span-5 space-y-4">

        {/* Physical Stock Reduction Breakdown */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Chi tiết nguồn bốc cây
            </h3>
          </div>

          <div className="space-y-2">
            {linesWithDetails.map((line, idx) => {
              const lineVan = (line.quantity / 10000).toLocaleString('vi-VN', {
                maximumFractionDigits: 1
              })
              return (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">{line.sourceLabel}</div>
                    <div className="text-[11px] text-slate-500">
                      {line.isOwnBatch ? 'Lô sản xuất nội bộ' : 'Nhà vườn liên kết (Gom ngoài)'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-extrabold text-slate-900">
                      {formatQuantity(line.quantity)} cây
                    </div>
                    <div className="text-[10px] text-slate-500">({lineVan} vạn)</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Domain Invariant Stock Explanation Box */}
        {isPlanned && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Tác động tồn kho vật lý</span>
            </div>
            <p className="leading-relaxed">
              Chuyến giao đang ở trạng thái <strong>Kế hoạch (Chưa trừ tồn kho)</strong>. Khi xe bốc
              xong và bạn bấm <strong>&ldquo;Xác nhận đã giao&rdquo;</strong>, tồn kho thực tế của các
              lô cây trên mới bị giảm.
            </p>
          </div>
        )}

        {isCompleted && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-emerald-950">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Tồn kho vật lý đã được trừ</span>
            </div>
            <p className="leading-relaxed">
              Chuyến giao đã hoàn thành xuất vườn. Số lượng thực tế và đủ chuẩn của các lô liên quan
              đã được ghi nhận giảm trực tiếp.
            </p>
          </div>
        )}

        {actionError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
            {actionError}
          </div>
        )}

        {/* Primary Action Buttons */}
        {isPlanned && (
          <div className="space-y-2 pt-2">
            <PrimaryButton
              fullWidth
              onClick={() => setShowConfirmModal(true)}
              className="py-3 flex items-center justify-center gap-2"
            >
              <PackageCheck className="w-4 h-4" />
              <span>XÁC NHẬN ĐÃ GIAO (XUẤT CÂY)</span>
            </PrimaryButton>

            <SecondaryButton
              fullWidth
              onClick={() => setShowCancelModal(true)}
              className="text-rose-600 hover:bg-rose-50 border-rose-200"
            >
              Hủy chuyến giao này
            </SecondaryButton>
          </div>
        )}

        {(isCompleted || isCancelled) && (
          <div className="pt-2">
            <SecondaryButton fullWidth onClick={() => navigate(`/orders/${order.id}`)}>
              Quay lại chi tiết đơn hàng
            </SecondaryButton>
          </div>
        )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Xác nhận xuất cây lên xe?</h3>
                <p className="text-xs text-slate-500">Thao tác này ghi nhận cây đã rời vườn</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
              Bạn đang xác nhận xuất{' '}
              <strong className="text-slate-900 font-extrabold">
                {formatQuantity(displayQuantity)} cây
              </strong>{' '}
              cho đơn của <strong>{customer?.name}</strong>. Tồn kho thực tế trong vườn sẽ giảm ngay
              lập tức.
            </p>

            <div className="flex gap-2">
              <SecondaryButton
                fullWidth
                disabled={isProcessing}
                onClick={() => setShowConfirmModal(false)}
              >
                Chưa, để sau
              </SecondaryButton>
              <PrimaryButton
                fullWidth
                disabled={isProcessing}
                onClick={handleConfirmShipment}
              >
                {isProcessing ? 'Đang xuất...' : 'Xác nhận xuất'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Ban className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Hủy chuyến giao dự kiến?</h3>
                <p className="text-xs text-slate-500">Chuyến chưa xuất cây sẽ bị hủy</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Các khoản giữ cây sẽ được giải phóng khỏi chuyến này để bạn có thể lên lịch chuyến khác.
            </p>

            <div className="flex gap-2">
              <SecondaryButton
                fullWidth
                disabled={isProcessing}
                onClick={() => setShowCancelModal(false)}
              >
                Không hủy
              </SecondaryButton>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleCancelShipment}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
              >
                {isProcessing ? 'Đang hủy...' : 'Hủy chuyến'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
