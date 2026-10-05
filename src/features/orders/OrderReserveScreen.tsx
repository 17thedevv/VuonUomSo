import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { SecondaryButton } from '../../shared/components/SecondaryButton'

export const OrderReserveScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <PageHeader title="Giữ cây cho đơn" showBack backTo={`/orders/${id}`} />

      <div className="p-4 space-y-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center space-y-3">
          <span className="inline-block bg-slate-100 text-slate-600 font-mono text-xs px-2.5 py-1 rounded-md">
            Route: /orders/{id}/reserve
          </span>
          <h2 className="text-base font-bold text-slate-800">Màn hình phân bổ & giữ cây</h2>
          <p className="text-xs text-slate-500">
            Cho phép chọn giữ từ lô trong vườn hoặc gom từ nguồn ngoài (external supplier) sẽ được triển khai ở Phase P1.
          </p>
          <div className="pt-2">
            <SecondaryButton fullWidth onClick={() => navigate(`/orders/${id}`)}>
              Quay lại chi tiết đơn
            </SecondaryButton>
          </div>
        </div>
      </div>
    </div>
  )
}
