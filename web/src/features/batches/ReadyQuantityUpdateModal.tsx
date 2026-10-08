import React, { useState, useEffect } from 'react'
import type { Batch } from '../../domain/batch'
import { updateBatchReadyQuantity } from '../../services/batchService'
import { QuantityInput } from '../../shared/components/QuantityInput'
import { formatQuantity } from '../../domain/quantity'
import { X, AlertTriangle, Info, CheckCircle2 } from 'lucide-react'
import { validationTracker } from '../../validation/validationTracker'

export interface ReadyQuantityUpdateModalProps {
  batch: Batch
  reservedQuantity: number
  isOpen: boolean
  onClose: () => void
  onSuccess: (updatedBatch: Batch) => void
}

export const ReadyQuantityUpdateModal: React.FC<ReadyQuantityUpdateModalProps> = ({
  batch,
  reservedQuantity,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [rawInput, setRawInput] = useState(batch.readyQuantity.toString())
  const [parsedQuantity, setParsedQuantity] = useState<number | null>(batch.readyQuantity)
  const [unit, setUnit] = useState<'cay' | 'van'>('cay')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setRawInput(batch.readyQuantity.toString())
      setParsedQuantity(batch.readyQuantity)
      setNote('')
      setErrorMessage(null)
      void validationTracker.formStarted('inventory_updated')
    }
  }, [isOpen, batch.readyQuantity])

  if (!isOpen) return null

  const currentAvailable = Math.max(batch.readyQuantity - reservedQuantity, 0)
  const difference = parsedQuantity !== null ? parsedQuantity - batch.readyQuantity : null

  // Invariant validation
  const isNegative = parsedQuantity !== null && parsedQuantity < 0
  const isGreaterThanLiving =
    parsedQuantity !== null && parsedQuantity > batch.currentQuantity
  const isInvalid = parsedQuantity === null || isNegative || isGreaterThanLiving

  // Commitment shortage projection (DOES NOT block submission, only warns)
  const projectedShortage =
    parsedQuantity !== null ? Math.max(reservedQuantity - parsedQuantity, 0) : 0
  const projectedAvailable =
    parsedQuantity !== null ? Math.max(parsedQuantity - reservedQuantity, 0) : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || parsedQuantity === null || isInvalid) {
      if (isInvalid) {
        void validationTracker.actionFailed('inventory_updated', 'validation')
      }
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    const result = await updateBatchReadyQuantity({
      batchId: batch.id,
      newReadyQuantity: parsedQuantity,
      note: note.trim() || undefined
    })

    setIsSubmitting(false)

    if (result.success && result.batch) {
      void validationTracker.actionCompleted('inventory_updated')
      onSuccess(result.batch)
      onClose()
    } else {
      void validationTracker.actionFailed('inventory_updated', 'storage')
      setErrorMessage(result.error || 'Có lỗi xảy ra khi cập nhật số cây đủ bán.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ready-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h2 id="ready-modal-title" className="text-base font-bold text-slate-900 leading-tight">
                Cập nhật cây đủ bán
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                Lô {batch.code} • {batch.variety}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {/* 4-Value Forestry Stock Context */}
          <div className="grid grid-cols-4 gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center text-xs">
            <div>
              <span className="text-[11px] text-slate-500 block">Còn sống</span>
              <strong className="text-slate-800 text-xs block mt-0.5">
                {formatQuantity(batch.currentQuantity)}
              </strong>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Đủ bán cũ</span>
              <strong className="text-slate-700 text-xs block mt-0.5">
                {formatQuantity(batch.readyQuantity)}
              </strong>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Đã giữ</span>
              <strong className="text-amber-800 text-xs block mt-0.5">
                {formatQuantity(reservedQuantity)}
              </strong>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Còn bán</span>
              <strong className="text-emerald-700 text-xs block mt-0.5">
                {formatQuantity(currentAvailable)}
              </strong>
            </div>
          </div>

          {/* Quantity Input */}
          <div>
            <QuantityInput
              id="ready-quantity"
              label="Tổng số cây đủ chuẩn hiện tại"
              required
              value={rawInput}
              unit={unit}
              onUnitChange={setUnit}
              onChange={(raw, parsed) => {
                setRawInput(raw)
                setParsedQuantity(parsed)
                setErrorMessage(null)
              }}
              placeholder="VD: 3,2 vạn hoặc 32.000"
              showQuickChips={true}
            />
          </div>

          {/* Real-time Difference Feedback */}
          {parsedQuantity !== null && !isInvalid && difference !== null && (
            <div className="text-xs space-y-1.5">
              {difference > 0 ? (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-start gap-2">
                  <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Tăng: +{formatQuantity(difference)} cây đủ chuẩn</span>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      Cây sinh trưởng đạt chuẩn xuất vườn thêm {formatQuantity(difference)} cây.
                    </p>
                  </div>
                </div>
              ) : difference < 0 ? (
                <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Giảm: -{formatQuantity(Math.abs(difference))} cây</span>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Giảm số cây đủ chuẩn (do loại bỏ, cây xấu hoặc điều chỉnh đếm lại).
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-slate-50 text-slate-600 rounded-xl text-center">
                  Số lượng bằng số đang ghi nhận.
                </div>
              )}
            </div>
          )}

          {/* Warning if commitment shortage appears (DOES NOT BLOCK) */}
          {parsedQuantity !== null && !isInvalid && projectedShortage > 0 && (
            <div className="p-3.5 bg-amber-50/90 border border-amber-300 text-amber-950 rounded-xl space-y-1 text-xs">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">
                    Sau cập nhật sẽ thiếu {formatQuantity(projectedShortage)} cây đã giữ cho khách.
                  </strong>
                  <p className="mt-0.5 text-amber-800 leading-relaxed">
                    Bạn vẫn có thể lưu để phản ánh sự thật ngoài vườn. Hệ thống sẽ ghi nhận thiếu nguồn cam kết để bạn điều phối lại sau.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Validation Violations */}
          {isGreaterThanLiving && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Vượt quá số cây còn sống</strong>
                <p className="mt-0.5 leading-relaxed">
                  Số cây đủ bán ({formatQuantity(parsedQuantity)}) không thể lớn hơn tổng số cây còn sống ({formatQuantity(batch.currentQuantity)} cây).
                </p>
              </div>
            </div>
          )}

          {/* Projected Remaining Sellable */}
          {parsedQuantity !== null && !isInvalid && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Cây còn bán sau cập nhật:</span>
              <strong className="text-emerald-700 text-sm font-black">
                {formatQuantity(projectedAvailable)} cây
              </strong>
            </div>
          )}

          {/* Optional Note */}
          <div>
            <label htmlFor="ready-note" className="block text-xs font-bold text-slate-700 mb-1">
              Ghi chú (tùy chọn)
            </label>
            <input
              id="ready-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Cây đạt chuẩn lứa đầu, loại 2.000 cây đốm lá..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 bg-white"
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
              {errorMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors min-h-[48px] cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isInvalid}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs min-h-[48px] cursor-pointer"
            >
              {isSubmitting ? 'ĐANG LƯU...' : 'CẬP NHẬT'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
