import React from 'react'
import { ChevronRight, AlertTriangle, CheckCircle2, Sprout, Archive } from 'lucide-react'
import { type BatchWithAvailability, deriveBatchStatus } from '../../domain/batch'
import { formatQuantity } from '../../domain/quantity'
import { formatShortDate } from '../../domain/date'

export interface BatchCardProps {
  batch: BatchWithAvailability
  onClick?: () => void
}

export const BatchCard: React.FC<BatchCardProps> = ({ batch, onClick }) => {
  const derivedStatus = deriveBatchStatus(batch)
  const isReady = derivedStatus === 'ready'
  const isDepleted = derivedStatus === 'depleted'

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 active:bg-slate-50 transition-all cursor-pointer space-y-3"
    >
      {/* Header: Code, Variety & Status Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-base tracking-tight truncate">
              {batch.code}
            </h3>
            {batch.isAttention ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                <AlertTriangle className="w-3 h-3 text-amber-700" />
                <span>Sắp quá lứa</span>
              </span>
            ) : isReady ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Đang bán</span>
              </span>
            ) : isDepleted ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                <Archive className="w-3 h-3 text-slate-500" />
                <span>Đã xuất hết</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                <Sprout className="w-3 h-3 text-sky-600" />
                <span>Đang ươm</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
            {batch.variety} · {formatQuantity(batch.currentQuantity)} cây còn sống
          </p>
        </div>

        <div className="text-slate-400 shrink-0 mt-1">
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>

      {/* Attention banner if close to sell-before */}
      {batch.isAttention && batch.preferredSellBefore && (
        <div className="bg-amber-50/80 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>
            Nên bán trước <strong>{formatShortDate(batch.preferredSellBefore)}</strong> (tránh rễ ăn sâu)
          </span>
        </div>
      )}

      {/* Quantities Row */}
      {isReady ? (
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-center">
          <div className="bg-slate-50/80 p-2 rounded-xl">
            <span className="text-[11px] text-slate-500 block">Đủ bán</span>
            <span className="text-sm font-bold text-slate-700 block mt-0.5">
              {formatQuantity(batch.readyQuantity)}
            </span>
          </div>
          <div className="bg-slate-50/80 p-2 rounded-xl">
            <span className="text-[11px] text-slate-500 block">Đã giữ</span>
            <span className="text-sm font-bold text-amber-800 block mt-0.5">
              {formatQuantity(batch.reservedQuantity)}
            </span>
          </div>
          <div className="bg-emerald-50/80 p-2 rounded-xl border border-emerald-100/60">
            <span className="text-[11px] text-emerald-800 font-medium block">Còn bán</span>
            <span className="text-sm font-black text-emerald-700 block mt-0.5">
              {formatQuantity(batch.availableQuantity)}
            </span>
          </div>
        </div>
      ) : isDepleted ? (
        <div className="pt-1 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
          <span>Ươm cắm: {formatQuantity(batch.initialQuantity)} cây</span>
          <span className="font-semibold text-slate-600">Đã xuất hết</span>
        </div>
      ) : (
        <div className="pt-1 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
          <span>Ươm cắm: {formatQuantity(batch.initialQuantity)} cây</span>
          <span className="font-semibold text-slate-700">Đang phát triển</span>
        </div>
      )}
    </div>
  )
}
