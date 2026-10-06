import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { batchRepository } from '../../data/repositories'
import type { Batch } from '../../domain/batch'
import { PageHeader } from '../../shared/components/PageHeader'
import { SecondaryButton } from '../../shared/components/SecondaryButton'

export const BatchDossierScreen: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>()
  const navigate = useNavigate()
  const [batch, setBatch] = useState<Batch | null>(null)

  useEffect(() => {
    async function load() {
      if (!batchId) return
      const b = await batchRepository.getById(batchId)
      setBatch(b)
    }
    load()
  }, [batchId])

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <PageHeader
        title="Hồ sơ nguồn gốc"
        subtitle={batch ? `${batch.code} - ${batch.variety}` : `Lô #${batchId}`}
        showBack
        backTo={batchId ? `/batches/${batchId}` : '/batches'}
      />

      <div className="p-4 space-y-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center space-y-3">
          <span className="inline-block bg-slate-100 text-slate-600 font-mono text-xs px-2.5 py-1 rounded-md">
            Route: /dossiers/{batchId}
          </span>
          <h2 className="text-base font-bold text-slate-800">Hồ sơ nguồn gốc cây giống (Traceability)</h2>
          <p className="text-xs text-slate-500">
            Xuất hồ sơ nguồn gốc giống cây lâm nghiệp (chứng chỉ nguồn giống, hóa đơn bầu cây, nhật ký sinh trưởng) sẽ được hoàn thiện ở Phase P3.
          </p>
          <div className="pt-2">
            <SecondaryButton
              fullWidth
              onClick={() => (batchId ? navigate(`/batches/${batchId}`) : navigate('/batches'))}
            >
              Quay lại chi tiết lô
            </SecondaryButton>
          </div>
        </div>
      </div>
    </div>
  )
}
