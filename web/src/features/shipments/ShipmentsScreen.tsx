import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { shipmentRepository } from '../../data/repositories'
import type { Shipment } from '../../domain/shipment'
import { formatQuantity } from '../../domain/quantity'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusBadge } from '../../shared/components/StatusBadge'
import { EmptyState } from '../../shared/components/EmptyState'

export const ShipmentsScreen: React.FC = () => {
  const navigate = useNavigate()
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const list = await shipmentRepository.getAll()
      setShipments(list)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <PageHeader title="Chuyến giao" subtitle="Giao cây & xe vận chuyển" />

      <div className="p-4 space-y-2 flex-1">
        {loading ? (
          <div className="text-center py-8 text-xs text-slate-400">Đang tải...</div>
        ) : shipments.length === 0 ? (
          <EmptyState
            title="Chưa có chuyến giao nào"
            description="Các chuyến xe giao cây cho khách sẽ hiển thị tại đây khi thực hiện xuất hàng."
          />
        ) : (
          shipments.map((shipment) => (
            <div
              key={shipment.id}
              onClick={() => navigate(`/shipments/${shipment.id}`)}
              className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between cursor-pointer active:bg-slate-50"
            >
              <div>
                <div className="font-bold text-slate-900 text-sm">Chuyến #{shipment.id}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Đã giao: {formatQuantity(shipment.shippedQuantity)} / {formatQuantity(shipment.plannedQuantity)} cây
                </div>
              </div>
              <StatusBadge status={shipment.status} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
