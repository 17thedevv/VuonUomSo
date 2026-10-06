import React, { useState, useEffect } from 'react'
import { X, Sprout, Store, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { BatchWithAvailability } from '../../domain/batch'
import type { ExternalSupplierCandidate } from '../../domain/reservation'
import { formatQuantity } from '../../domain/quantity'
import { QuantityInput } from '../../shared/components/QuantityInput'
import { PrimaryButton } from '../../shared/components/PrimaryButton'
import { reserveOwnBatch, reserveExternalSupplier } from '../../services/reservationService'

export type ReserveSource =
  | {
      type: 'own_batch'
      batch: BatchWithAvailability
    }
  | {
      type: 'external_supplier'
      supplier: ExternalSupplierCandidate
    }

export interface ReserveQuantityModalProps {
  isOpen: boolean
  orderId: string
  orderVariety: string
  orderShortage: number
  source: ReserveSource | null
  onClose: () => void
  onSuccess: (message: string) => void
}

export const ReserveQuantityModal: React.FC<ReserveQuantityModalProps> = ({
  isOpen,
  orderId,
  orderVariety,
  orderShortage,
  source,
  onClose,
  onSuccess
}) => {
  const [quantity, setQuantity] = useState<number | null>(null)
  const [rawInput, setRawInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Initialize default quantity when modal opens or source changes
  useEffect(() => {
    if (!isOpen || !source) {
      setQuantity(null)
      setRawInput('')
      setError(null)
      return
    }

    let defaultQty = orderShortage
    if (source.type === 'own_batch') {
      defaultQty = Math.min(source.batch.availableQuantity, orderShortage)
    } else {
      defaultQty = Math.min(source.supplier.estimatedQuantity, orderShortage)
    }

    if (defaultQty > 0) {
      setQuantity(defaultQty)
      setRawInput(defaultQty.toString())
    } else {
      setQuantity(null)
      setRawInput('')
    }
    setError(null)
  }, [isOpen, source, orderShortage])

  if (!isOpen || !source) return null

  const isOwnBatch = source.type === 'own_batch'
  const sourceName = isOwnBatch ? source.batch.code : source.supplier.name
  const sourceAvailable = isOwnBatch
    ? source.batch.availableQuantity
    : source.supplier.estimatedQuantity

  // Over-reservation checks
  const isOverBatch = isOwnBatch && quantity !== null && quantity > sourceAvailable
  const isOverOrder = quantity !== null && quantity > orderShortage
  const isInvalid = quantity === null || quantity <= 0 || isOverBatch || isOverOrder

  const handleSetMaxBatch = () => {
    if (isOwnBatch) {
      setQuantity(source.batch.availableQuantity)
      setRawInput(source.batch.availableQuantity.toString())
      setError(null)
    }
  }

  const handleSetMaxOrder = () => {
    setQuantity(orderShortage)
    setRawInput(orderShortage.toString())
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isInvalid || quantity === null || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      if (isOwnBatch) {
        await reserveOwnBatch({
          orderId,
          batchId: source.batch.id,
          quantity
        })
        const remaining = orderShortage - quantity
        const msg =
          remaining === 0
            ? `Đã giữ ${formatQuantity(quantity)} cây từ ${sourceName}. Đơn đã giữ đủ!`
            : `Đã giữ ${formatQuantity(quantity)} cây từ ${sourceName}. Đơn còn thiếu ${formatQuantity(remaining)} cây.`
        onSuccess(msg)
      } else {
        await reserveExternalSupplier({
          orderId,
          supplierId: source.supplier.supplierId,
          quantity
        })
        const remaining = orderShortage - quantity
        const msg =
          remaining === 0
            ? `Đã giữ ${formatQuantity(quantity)} cây từ ${sourceName}. Đơn đã giữ đủ!`
            : `Đã giữ ${formatQuantity(quantity)} cây từ ${sourceName}. Đơn còn thiếu ${formatQuantity(remaining)} cây.`
        onSuccess(msg)
      }
      onClose()
    } catch (err: unknown) {
      console.error('Error reserving trees:', err)
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Không thể giữ cây. Vui lòng thử lại.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reserve-modal-title"
    >
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isOwnBatch ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
              }`}
            >
              {isOwnBatch ? <Sprout className="w-4 h-4" /> : <Store className="w-4 h-4" />}
            </div>
            <div>
              <h3 id="reserve-modal-title" className="font-bold text-slate-900 text-base">
                Giữ cây từ {sourceName}
              </h3>
              <p className="text-xs text-slate-500">
                {isOwnBatch ? `Lô trong vườn · ${orderVariety}` : `Nhà vườn ngoài · ${orderVariety}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto">
          {/* Status info bar */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
              <span className="text-slate-500 block">
                {isOwnBatch ? 'Lô còn bán:' : 'Tham khảo nguồn:'}
              </span>
              <span className="text-sm font-black text-slate-900 mt-0.5 block">
                {formatQuantity(sourceAvailable)} cây
              </span>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
              <span className="text-amber-800 block">Đơn còn thiếu:</span>
              <span className="text-sm font-black text-amber-950 mt-0.5 block">
                {formatQuantity(orderShortage)} cây
              </span>
            </div>
          </div>

          {/* Quantity Input */}
          <QuantityInput
            label="Số lượng giữ"
            value={rawInput}
            onChange={(val, num) => {
              setRawInput(val)
              setQuantity(num)
              setError(null)
            }}
            unit="van"
            required
            autoFocus
          />

          {/* Quick selection chips */}
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={handleSetMaxOrder}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold border border-slate-200"
            >
              Giữ đủ đơn ({formatQuantity(orderShortage)} cây)
            </button>
            {isOwnBatch && source.batch.availableQuantity < orderShortage && (
              <button
                type="button"
                onClick={handleSetMaxBatch}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 font-semibold border border-emerald-200"
              >
                Giữ hết lô ({formatQuantity(source.batch.availableQuantity)} cây)
              </button>
            )}
          </div>

          {/* Over-reservation error warnings */}
          {isOverBatch && (
            <div className="bg-rose-50 border border-rose-300 text-rose-900 p-3 rounded-xl text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Không đủ cây trong lô này.</span>
                  <span>
                    Lô {sourceName} hiện chỉ còn bán {formatQuantity(sourceAvailable)} cây. Bạn đang muốn giữ{' '}
                    {formatQuantity(quantity!)} cây.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSetMaxBatch}
                className="w-full py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold rounded-lg text-xs"
              >
                Giữ tối đa {formatQuantity(sourceAvailable)} cây
              </button>
            </div>
          )}

          {isOverOrder && !isOverBatch && (
            <div className="bg-rose-50 border border-rose-300 text-rose-900 p-3 rounded-xl text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Vượt quá số cây đơn cần.</span>
                  <span>
                    Đơn này chỉ còn thiếu {formatQuantity(orderShortage)} cây. Bạn có thể giữ tối đa{' '}
                    {formatQuantity(orderShortage)} cây nữa.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSetMaxOrder}
                className="w-full py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold rounded-lg text-xs"
              >
                Giữ đủ đơn ({formatQuantity(orderShortage)} cây)
              </button>
            </div>
          )}

          {/* Server / Service error */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 p-3 rounded-xl text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 space-y-2">
            <PrimaryButton
              type="submit"
              disabled={isInvalid || isSubmitting}
              fullWidth
            >
              {isSubmitting ? (
                <span>Đang ghi nhận...</span>
              ) : quantity && quantity > 0 && !isOverBatch && !isOverOrder ? (
                <span className="flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>GIỮ {formatQuantity(quantity)} CÂY</span>
                </span>
              ) : (
                <span>XÁC NHẬN GIỮ CÂY</span>
              )}
            </PrimaryButton>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              Hủy bỏ
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
