import React from 'react'
import { ChevronRight, Calendar, CheckCircle2, AlertTriangle, CheckCheck } from 'lucide-react'
import type { OrderWithDerived } from '../../domain/order'
import { formatQuantity } from '../../domain/quantity'
import { formatShortDate } from '../../domain/date'

export interface OrderCardProps {
  order: OrderWithDerived
  onClick?: () => void
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, onClick }) => {
  const { displayStatus } = order

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 active:bg-slate-50 transition-all cursor-pointer space-y-2.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-base tracking-tight truncate">
              {order.customerName}
            </h3>
            {order.customerPhone && (
              <span className="text-[11px] text-slate-400 font-normal">
                ({order.customerPhone})
              </span>
            )}
          </div>
          <div className="text-xs text-slate-600 font-semibold mt-0.5">
            {formatQuantity(order.requestedQuantity)} cây {order.variety}
          </div>
        </div>

        {/* Status Badge */}
        <div className="shrink-0">
          {displayStatus.kind === 'shipped' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              <CheckCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>Đã giao</span>
            </span>
          ) : displayStatus.kind === 'full' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Đã giữ đủ</span>
            </span>
          ) : displayStatus.kind === 'partial' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              <span>{displayStatus.label}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>Chưa giữ cây</span>
            </span>
          )}
        </div>
      </div>

      {/* Date row & progress summary */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>
            {order.requestedDate
              ? `Lấy ${formatShortDate(order.requestedDate)}`
              : 'Chưa chốt ngày lấy'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[11px] text-slate-400">
            Giữ {formatQuantity(order.reservedQuantity)}/{formatQuantity(order.requestedQuantity)}
          </span>
          <ChevronRight className="w-4 h-4 text-slate-400 ml-1" />
        </div>
      </div>
    </div>
  )
}
