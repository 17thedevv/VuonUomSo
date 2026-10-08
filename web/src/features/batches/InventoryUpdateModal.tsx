import React, { useState, useEffect } from 'react'
import type { Batch } from '../../domain/batch'
import type { Reservation } from '../../domain/reservation'
import { updateBatchInventory } from '../../services/batchService'
import { QuantityInput } from '../../shared/components/QuantityInput'
import { availableQuantityForBatch, commitmentShortageForBatch, formatQuantity, reservedQuantityForBatch } from '../../domain/quantity'
import { X, AlertTriangle, Info, ClipboardList } from 'lucide-react'
import { validationTracker } from '../../validation/validationTracker'

export interface InventoryUpdateModalProps {
  batch: Batch
  reservations: Reservation[]
  isOpen: boolean
  onClose: () => void
  onSuccess: (updatedBatch: Batch) => void
}

export const InventoryUpdateModal: React.FC<InventoryUpdateModalProps> = ({
  batch,
  reservations,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [rawInput, setRawInput] = useState(batch.currentQuantity.toString())
  const [parsedQuantity, setParsedQuantity] = useState<number | null>(batch.currentQuantity)
  const [unit, setUnit] = useState<'cay' | 'van'>('cay')
  const [readyInput, setReadyInput] = useState('')
  const [parsedReadyQuantity, setParsedReadyQuantity] = useState<number | null>(null)
  const [readyUnit, setReadyUnit] = useState<'cay' | 'van'>('cay')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setRawInput(batch.currentQuantity.toString())
      setParsedQuantity(batch.currentQuantity)
      setUnit('cay')
      setReadyInput('')
      setParsedReadyQuantity(null)
      setReadyUnit('cay')
      setErrorMessage(null)
      void validationTracker.formStarted('inventory_updated')
    }
  }, [isOpen, batch.currentQuantity])

  if (!isOpen) return null

  const difference =
    parsedQuantity !== null ? parsedQuantity - batch.currentQuantity : null

  // Invariant conditions
  const needsReadyAdjustment =
    parsedQuantity !== null && parsedQuantity < batch.readyQuantity
  const isReadyInvalid =
    needsReadyAdjustment &&
    (parsedReadyQuantity === null ||
      parsedReadyQuantity < 0 ||
      parsedReadyQuantity > parsedQuantity)

  const isGreaterThanInitial =
    parsedQuantity !== null && parsedQuantity > batch.initialQuantity
  const isNegative = parsedQuantity !== null && parsedQuantity < 0
  const isInvalid =
    parsedQuantity === null || isGreaterThanInitial || isNegative || isReadyInvalid

  const projectedReady = needsReadyAdjustment ? parsedReadyQuantity : batch.readyQuantity
  const projectedBatch = !isInvalid && parsedQuantity !== null && projectedReady !== null
    ? {
        ...batch,
        currentQuantity: parsedQuantity,
        readyQuantity: projectedReady
      }
    : null
  const projectedAvailable = projectedBatch ? availableQuantityForBatch(projectedBatch, reservations) : null
  const projectedShortage = projectedBatch ? commitmentShortageForBatch(projectedBatch, reservations) : null
  const previewRows = [
    ['Cây còn sống', batch.currentQuantity, projectedBatch?.currentQuantity ?? null],
    ['Cây đủ bán', batch.readyQuantity, projectedBatch?.readyQuantity ?? null],
    ['Cây còn bán', availableQuantityForBatch(batch, reservations), projectedAvailable],
    ['Thiếu cây đã giữ', commitmentShortageForBatch(batch, reservations), projectedShortage]
  ] as const

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

    const result = await updateBatchInventory({
      batchId: batch.id,
      newQuantity: parsedQuantity,
      newReadyQuantity: needsReadyAdjustment && parsedReadyQuantity !== null ? parsedReadyQuantity : undefined,
      note: note.trim() || undefined
    })

    setIsSubmitting(false)

    if (result.success && result.batch) {
      void validationTracker.actionCompleted('inventory_updated')
      onSuccess(result.batch)
      onClose()
    } else {
      void validationTracker.actionFailed('inventory_updated', 'storage')
      setErrorMessage(result.error || 'Có lỗi xảy ra khi cập nhật kiểm kê.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <h2 id="inventory-modal-title" className="text-base font-bold text-slate-900 leading-tight">
                Kiểm kê lô {batch.code}
              </h2>
              <span className="text-xs text-slate-500 font-medium">{batch.variety}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {/* Quantity Input */}
          <div>
            <QuantityInput
              id="inventory-quantity"
              label="Hiện còn bao nhiêu cây sống?"
              required
              value={rawInput}
              unit={unit}
              onUnitChange={setUnit}
              onChange={(raw, parsed) => {
                setRawInput(raw)
                setParsedQuantity(parsed)
                setErrorMessage(null)
              }}
              placeholder="VD: 4,52 vạn hoặc 45.200"
              showQuickChips={true}
            />
          </div>

          {/* Real-time Invariant & Difference Feedback */}
          {parsedQuantity !== null && !isInvalid && difference !== null && (
            <div className="text-xs space-y-1.5">
              {difference < 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Hao hụt: {formatQuantity(Math.abs(difference))} cây</span>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Số cây sống giảm so với lần kiểm kê trước ({formatQuantity(batch.currentQuantity)} cây).
                    </p>
                  </div>
                </div>
              ) : difference > 0 ? (
                <div className="p-3 bg-sky-50 border border-sky-200 text-sky-900 rounded-xl flex items-start gap-2">
                  <Info className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Tăng: +{formatQuantity(difference)} cây</span>
                    <p className="text-[11px] text-sky-800 mt-0.5">
                      Số mới cao hơn lần kiểm kê trước {formatQuantity(difference)} cây (do đếm lại hoặc điều chỉnh).
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-slate-50 text-slate-600 rounded-xl text-center">
                  Số lượng bằng số kiểm kê trước.
                </div>
              )}
            </div>
          )}

          {/* Dynamic Atomic Adjustment Prompt when Living < Ready */}
          {needsReadyAdjustment && (
            <div className="p-3.5 bg-amber-50/90 border border-amber-300 text-amber-950 rounded-xl space-y-3 text-xs">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold">
                    Bạn vừa kiểm kê còn {formatQuantity(parsedQuantity)} cây sống.
                  </div>
                  <div className="text-amber-800 leading-relaxed">
                    Hiện lô đang ghi <strong>{formatQuantity(batch.readyQuantity)} cây</strong> đủ bán, nên số này cần được điều chỉnh.
                  </div>
                </div>
              </div>

              <div>
                <QuantityInput
                  id="adjusted-ready-quantity"
                  label="Cây đủ bán hiện tại:"
                  required
                  value={readyInput}
                  unit={readyUnit}
                  onUnitChange={setReadyUnit}
                  onChange={(raw, parsed) => {
                    setReadyInput(raw)
                    setParsedReadyQuantity(parsed)
                    setErrorMessage(null)
                  }}
                  placeholder={`Tối đa ${formatQuantity(parsedQuantity)} cây`}
                  showQuickChips={false}
                />
              </div>

              {parsedReadyQuantity !== null && parsedReadyQuantity > parsedQuantity && (
                <div className="text-rose-700 font-bold text-[11px]">
                  Số cây đủ bán ({formatQuantity(parsedReadyQuantity)}) không thể lớn hơn số cây sống ({formatQuantity(parsedQuantity)} cây).
                </div>
              )}
            </div>
          )}

          {isGreaterThanInitial && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Vượt quá số lượng ban đầu</strong>
                <p className="mt-0.5 leading-relaxed">
                  Số cây sống ({formatQuantity(parsedQuantity)}) không thể lớn hơn số cây cắm hom ban đầu ({formatQuantity(batch.initialQuantity)} cây).
                </p>
              </div>
            </div>
          )}

          <section aria-label="Preview kiểm kê" aria-live="polite" className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <h3 className="text-base font-bold text-slate-800">Sau khi cập nhật</h3>
            <p className="text-sm text-slate-600">
              Đang giữ: {formatQuantity(reservedQuantityForBatch(batch.id, reservations))} cây chưa xuất.
            </p>
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-slate-500">
                  <th scope="col" className="text-left py-2 font-medium">Số cây</th>
                  <th scope="col" className="text-right py-2 font-medium">Trước</th>
                  <th scope="col" className="text-right py-2 font-medium">Sau</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map(([label, before, after]) => (
                  <tr key={label} className="border-t border-slate-200">
                    <th scope="row" className="text-left py-2 pr-2 font-medium text-slate-700">{label}</th>
                    <td className="text-right py-2 text-slate-600">{formatQuantity(before)} cây</td>
                    <td className="text-right py-2 pl-2 font-bold text-slate-900">{after === null ? '—' : `${formatQuantity(after)} cây`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!projectedBatch && (
              <p className="text-sm text-slate-600">Nhập số cây hợp lệ{needsReadyAdjustment ? ' và điều chỉnh cây đủ bán' : ''} để xem kết quả sau kiểm kê.</p>
            )}
            {projectedShortage !== null && projectedShortage > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-950">
                <p className="font-bold">Sau kiểm kê thiếu {formatQuantity(projectedShortage)} cây đã giữ.</p>
                <p className="mt-1">Bạn vẫn có thể lưu để ghi đúng thực tế ngoài vườn.</p>
              </div>
            )}
          </section>

          {/* Optional Note */}
          <div>
            <label htmlFor="inventory-note" className="block text-xs font-bold text-slate-700 mb-1">
              Ghi chú kiểm kê (tùy chọn)
            </label>
            <input
              id="inventory-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Kiểm kê sau đợt bão, chuyển luống..."
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
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors min-h-[48px]"
            >
              Hủy
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting || isInvalid}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs min-h-[48px]"
            >
              {isSubmitting ? 'ĐANG LƯU...' : 'CẬP NHẬT'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
