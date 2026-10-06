import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, RotateCcw, Trees, AlertTriangle } from 'lucide-react'
import { batchRepository, reservationRepository } from '../../data/repositories'
import type { BatchWithAvailability, BatchFilterType } from '../../domain/batch'
import {
  availableQuantityForBatch,
  reservedQuantityForBatch
} from '../../domain/quantity'
import {
  isBatchAttention,
  sortBatchesForDisplay,
  filterBatches
} from '../../domain/batch'
import { PageHeader } from '../../shared/components/PageHeader'
import { BatchCard } from '../../shared/components/BatchCard'
import { EmptyState } from '../../shared/components/EmptyState'
import { undoService } from '../../services/undoService'

interface FilterOption {
  key: BatchFilterType
  label: string
}

const FILTER_OPTIONS: FilterOption[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'ready', label: 'Đang bán' },
  { key: 'attention', label: 'Cần chú ý' },
  { key: 'propagating', label: 'Đang ươm' }
]

export const BatchesScreen: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialFilter = (searchParams.get('filter') as BatchFilterType) || 'all'

  const [batches, setBatches] = useState<BatchWithAvailability[]>([])
  const [filter, setFilter] = useState<BatchFilterType>(
    ['all', 'ready', 'attention', 'propagating'].includes(initialFilter)
      ? initialFilter
      : 'all'
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [allBatches, allReservations] = await Promise.all([
        batchRepository.getAll(),
        reservationRepository.getAll()
      ])

      const mapped: BatchWithAvailability[] = allBatches.map((b) => ({
        ...b,
        reservedQuantity: reservedQuantityForBatch(b.id, allReservations),
        availableQuantity: availableQuantityForBatch(b, allReservations),
        isAttention: isBatchAttention(b)
      }))

      setBatches(sortBatchesForDisplay(mapped))
      setError(null)
    } catch (err) {
      console.error('Error loading batches:', err)
      setError('Chưa tải được danh sách lô cây.')
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

  const handleFilterChange = (newFilter: BatchFilterType) => {
    setFilter(newFilter)
    if (newFilter === 'all') {
      searchParams.delete('filter')
      setSearchParams(searchParams, { replace: true })
    } else {
      setSearchParams({ filter: newFilter }, { replace: true })
    }
  }

  const displayedBatches = filterBatches(batches, filter)

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <PageHeader
        title="Lô cây"
        subtitle="Quản lý nguồn giống & số lượng"
        rightAction={
          <button
            onClick={() => navigate('/batches/new')}
            className="flex items-center gap-1 bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg active:bg-emerald-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm lô</span>
          </button>
        }
      />

      {/* Filter Tabs / Pills */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 min-w-max">
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleFilterChange(opt.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all min-h-[36px] ${
                  active
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400">
            Đang tải danh sách lô cây...
          </div>
        ) : error ? (
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
        ) : displayedBatches.length === 0 ? (
          <div className="my-auto">
            <EmptyState
              title={
                filter === 'all'
                  ? 'Chưa có lô cây nào.'
                  : `Không có lô nào ở mục "${FILTER_OPTIONS.find((f) => f.key === filter)?.label}".`
              }
              description={
                filter === 'all'
                  ? 'Khi tạo lô cây, bạn sẽ xem được số cây còn sống, đủ bán và còn bán tại đây.'
                  : 'Hãy chuyển về mục "Tất cả" hoặc tạo thêm lô cây mới.'
              }
              actionText={filter === 'all' ? '+ Tạo lô cây' : 'Xem tất cả lô'}
              onAction={() =>
                filter === 'all' ? navigate('/batches/new') : handleFilterChange('all')
              }
              icon={Trees}
            />
          </div>
        ) : (
          displayedBatches.map((batch) => (
            <BatchCard
              key={batch.id}
              batch={batch}
              onClick={() => navigate(`/batches/${batch.id}`)}
            />
          ))
        )}
      </div>
    </div>
  )
}
