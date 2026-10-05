import React from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { SecondaryButton } from '../../shared/components/SecondaryButton'

export const BatchNewScreen: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <PageHeader title="Thêm lô cây mới" showBack backTo="/batches" />

      <div className="p-4 space-y-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center space-y-3">
          <span className="inline-block bg-slate-100 text-slate-600 font-mono text-xs px-2.5 py-1 rounded-md">
            Route: /batches/new
          </span>
          <h2 className="text-base font-bold text-slate-800">Màn hình tạo lô cây mới</h2>
          <p className="text-xs text-slate-500">
            Tính năng nhập lô cây chi tiết (mã lô, giống cây, số lượng ban đầu, ngày vào bầu) sẽ hoàn thiện ở Phase P1.
          </p>
          <div className="pt-2">
            <SecondaryButton fullWidth onClick={() => navigate('/batches')}>
              Quay lại danh sách lô
            </SecondaryButton>
          </div>
        </div>
      </div>
    </div>
  )
}
