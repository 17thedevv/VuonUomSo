import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getShipmentsList } from '../../services/shipmentService'
import { formatQuantity } from '../../domain/quantity'
import { formatDate } from '../../domain/date'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusBadge } from '../../shared/components/StatusBadge'
import { EmptyState } from '../../shared/components/EmptyState'
import { Phone, Calendar, Truck } from 'lucide-react'

type TabFilter = 'all' | 'planned' | 'completed'

interface ShipmentItem {
  id: string
  orderId: string
  variety: string
  customerName: string
  customerPhone?: string
  plannedQuantity: number
  shippedQuantity: number
  plannedDate?: string
  shippedAt?: string
  status: 'planned' | 'completed' | 'cancelled'
  note?: string
  createdAt?: string
}

export const ShipmentsScreen: React.FC = () => {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<TabFilter>('all')
  const [shipments, setShipments] = useState<ShipmentItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    async function load() {
      setLoading(true)
      try {
        const list = await getShipmentsList(filter)
        if (isMounted) setShipments(list)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [filter])

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <PageHeader title="Chuyến giao" subtitle="Lên lịch xe & xuất cây rời vườn" />

      {/* Tabs */}
      <div className="px-4 pt-2 pb-1 bg-white border-b border-slate-200">
        <div className="flex gap-2 max-w-2xl mx-auto">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => setFilter('planned')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
              filter === 'planned'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Chờ giao
          </button>
          <button
            type="button"
            onClick={() => setFilter('completed')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
              filter === 'completed'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Đã giao
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3 flex-1 max-w-2xl mx-auto w-full">
        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400">Đang tải danh sách chuyến giao...</div>
        ) : shipments.length === 0 ? (
          <EmptyState
            title={
              filter === 'planned'
                ? 'Không có chuyến nào đang chờ giao'
                : filter === 'completed'
                ? 'Chưa có chuyến giao nào hoàn thành'
                : 'Chưa có chuyến giao nào'
            }
            description="Để tạo chuyến giao mới, hãy vào chi tiết đơn hàng đã giữ cây và bấm 'Lên chuyến giao'."
          />
        ) : (
          shipments.map((shipment) => {
            const isCompleted = shipment.status === 'completed'
            const displayQty = isCompleted ? shipment.shippedQuantity : shipment.plannedQuantity
            const vanQty = (displayQty / 10000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })

            return (
              <div
                key={shipment.id}
                onClick={() => navigate(`/shipments/${shipment.id}`)}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all cursor-pointer active:bg-slate-50 space-y-2.5"
              >
                {/* Header: Customer name & Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm leading-tight">
                      {shipment.customerName}
                    </h3>
                    <div className="text-xs text-slate-500 font-medium mt-0.5">
                      {shipment.variety}
                    </div>
                  </div>
                  <StatusBadge status={shipment.status} />
                </div>

                {/* Body: Quantity & Van */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800">
                      {isCompleted ? 'Đã xuất' : 'Kế hoạch'}:
                    </span>
                    <span className="text-sm font-extrabold text-slate-900">
                      {formatQuantity(displayQty)} cây
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">({vanQty} vạn)</span>
                </div>

                {/* Footer: Date & Quick Actions */}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {isCompleted && shipment.shippedAt
                        ? `Giao: ${formatDate(shipment.shippedAt)}`
                        : shipment.plannedDate
                        ? `Ngày hẹn: ${formatDate(shipment.plannedDate)}`
                        : `Tạo: ${formatDate(shipment.createdAt)}`}
                    </span>
                  </div>

                  {shipment.customerPhone && (
                    <a
                      href={`tel:${shipment.customerPhone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-emerald-700 font-medium hover:underline p-1 -m-1"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{shipment.customerPhone}</span>
                    </a>
                  )}
                </div>

                {shipment.note && (
                  <p className="text-xs text-slate-500 italic border-t border-slate-100 pt-2">
                    &ldquo;{shipment.note}&rdquo;
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
