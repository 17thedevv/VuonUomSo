import React from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { SecondaryButton } from '../../shared/components/SecondaryButton'

export const OrderNewScreen: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <PageHeader title="Ghi đơn mới" showBack backTo="/orders" />

      <div className="p-4 space-y-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center space-y-3">
          <span className="inline-block bg-slate-100 text-slate-600 font-mono text-xs px-2.5 py-1 rounded-md">
            Route: /orders/new
          </span>
          <h2 className="text-base font-bold text-slate-800">Màn hình ghi đơn hàng mới</h2>
          <p className="text-xs text-slate-500">
            Biểu mẫu ghi đơn nhanh bằng ngôn ngữ tự nhiên (số lượng dạng "3 vạn", chọn khách quen Zalo) sẽ được hoàn thiện ở Phase P1.
          </p>
          <div className="pt-2">
            <SecondaryButton fullWidth onClick={() => navigate('/orders')}>
              Quay lại danh sách đơn
            </SecondaryButton>
          </div>
        </div>
      </div>
    </div>
  )
}
