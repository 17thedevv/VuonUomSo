import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, RotateCcw, ClipboardList, AlertTriangle } from 'lucide-react'
import {
  orderRepository,
  contactRepository,
  reservationRepository,
  shipmentRepository
} from '../../data/repositories'
import type { OrderWithDerived, OrderFilterType } from '../../domain/order'
import type { Contact } from '../../domain/contact'
import {
  reservedQuantityForOrder,
  orderShortage,
  deriveOrderDisplayStatus,
  filterOrders
} from '../../domain/order'
import { PageHeader } from '../../shared/components/PageHeader'
import { OrderCard } from '../../shared/components/OrderCard'
import { EmptyState } from '../../shared/components/EmptyState'
import { undoService } from '../../services/undoService'

interface FilterOption {
  key: OrderFilterType
  label: string
}

const FILTER_OPTIONS: FilterOption[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'action_needed', label: 'Cần xử lý' },
  { key: 'ready_pickup', label: 'Sắp lấy' },
  { key: 'shipped', label: 'Đã giao' }
]

export const OrdersScreen: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialFilter = (searchParams.get('filter') as OrderFilterType) || 'all'

  const [orders, setOrders] = useState<OrderWithDerived[]>([])
  const [filter, setFilter] = useState<OrderFilterType>(
    ['all', 'action_needed', 'ready_pickup', 'shipped'].includes(initialFilter)
      ? initialFilter
      : 'all'
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [allOrders, allContacts, allReservations, allShipments] = await Promise.all([
        orderRepository.getAll(),
        contactRepository.getAll(),
        reservationRepository.getAll(),
        shipmentRepository.getAll()
      ])

      const contactMap = new Map<string, Contact>(allContacts.map((c) => [c.id, c]))

      const mapped: OrderWithDerived[] = allOrders.map((o) => {
        const contact = contactMap.get(o.customerId)
        const reserved = reservedQuantityForOrder(o.id, allReservations)
        const shortage = orderShortage(o, allReservations)
        const displayStatus = deriveOrderDisplayStatus(o, allReservations, allShipments)

        return {
          ...o,
          customerName: contact?.name || 'Khách quen',
          customerPhone: contact?.phone,
          reservedQuantity: reserved,
          shortage,
          displayStatus
        }
      })

      // Sort orders: action_needed first, then by requestedDate
      mapped.sort((a, b) => {
        if (a.displayStatus.kind === 'shipped' && b.displayStatus.kind !== 'shipped') return 1
        if (b.displayStatus.kind === 'shipped' && a.displayStatus.kind !== 'shipped') return -1
        if (a.shortage > 0 && b.shortage === 0) return -1
        if (b.shortage > 0 && a.shortage === 0) return 1
        return (a.requestedDate || '').localeCompare(b.requestedDate || '')
      })

      setOrders(mapped)
      setError(null)
    } catch (err) {
      console.error('Error loading orders:', err)
      setError('Chưa tải được danh sách đơn hàng.')
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

  const handleFilterChange = (newFilter: OrderFilterType) => {
    setFilter(newFilter)
    if (newFilter === 'all') {
      searchParams.delete('filter')
      setSearchParams(searchParams, { replace: true })
    } else {
      setSearchParams({ filter: newFilter }, { replace: true })
    }
  }

  const displayedOrders = filterOrders(orders, filter)

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <PageHeader
        title="Đơn hàng"
        subtitle="Danh sách đơn đặt & giữ cây"
        rightAction={
          <button
            onClick={() => navigate('/orders/new')}
            className="flex items-center gap-1 bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg active:bg-emerald-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ghi đơn</span>
          </button>
        }
      />

      {/* Filter Tabs / Pills */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 overflow-x-auto no-scrollbar">
        <div className="max-w-6xl mx-auto flex items-center gap-2 min-w-max">
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
      <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-4 flex-1 flex flex-col">
        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400">
            Đang tải danh sách đơn hàng...
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
        ) : displayedOrders.length === 0 ? (
          <div className="my-auto">
            <EmptyState
              title={
                filter === 'all'
                  ? 'Chưa có đơn hàng nào.'
                  : `Không có đơn nào ở mục "${FILTER_OPTIONS.find((f) => f.key === filter)?.label}".`
              }
              description={
                filter === 'all'
                  ? 'Bấm "Ghi đơn" để lưu thông tin khách đặt và giữ cây từ các lô giống.'
                  : 'Hãy chuyển về mục "Tất cả" hoặc tạo thêm đơn hàng mới.'
              }
              actionText={filter === 'all' ? '+ Ghi đơn mới' : 'Xem tất cả đơn'}
              onAction={() =>
                filter === 'all' ? navigate('/orders/new') : handleFilterChange('all')
              }
              icon={ClipboardList}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {displayedOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onClick={() => navigate(`/orders/${order.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
