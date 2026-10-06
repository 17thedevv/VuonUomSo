import React, { useState } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import type { ResolvedReservation } from '../../services/reservationService'
import { formatQuantity } from '../../domain/quantity'
import { releaseReservation } from '../../services/reservationService'

export interface ReleaseConfirmModalProps {
  isOpen: boolean
  reservation: ResolvedReservation | null
  onClose: () => void
  onSuccess: (message: string) => void
}

export const ReleaseConfirmModal: React.FC<ReleaseConfirmModalProps> = ({
  isOpen,
  reservation,
  onClose,
  onSuccess
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !reservation) return null

  const handleConfirm = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      await releaseReservation({ reservationId: reservation.id })
      onSuccess(
        `Đã bỏ giữ ${formatQuantity(reservation.quantity)} cây từ ${reservation.sourceLabel}. Số cây này đã trở lại cây còn bán.`
      )
      onClose()
    } catch (err: unknown) {
      console.error('Error releasing reservation:', err)
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Không thể bỏ giữ cây. Vui lòng thử lại.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="release-modal-title"
    >
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 text-rose-600">
          <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <h3 id="release-modal-title" className="font-bold text-slate-900 text-base">
              Xác nhận bỏ giữ cây?
            </h3>
            <p className="text-xs text-slate-500">
              {reservation.sourceLabel}
            </p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs text-slate-700 leading-relaxed">
          Bỏ giữ <strong>{formatQuantity(reservation.quantity)} cây</strong> từ{' '}
          <strong>{reservation.sourceLabel}</strong>?
          <p className="text-slate-500 mt-1">
            Số cây này sẽ trở lại mục <em>Cây còn bán</em> của vườn và đơn hàng sẽ bị thiếu cây tương ứng.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-900 p-2.5 rounded-xl text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-bold text-xs transition-colors"
          >
            Giữ nguyên
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Đang xử lý...</span>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xác nhận bỏ giữ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
