import React, { useState } from 'react'
import type {
  SupportLevel,
  ReturnIntention,
  WillingnessToPay,
  UsefulArea,
  PilotSession
} from '../../validation/validation.types'
import { completePilotSession } from '../../validation/validationSession'
import { PrimaryButton } from '../../shared/components/PrimaryButton'
import { SecondaryButton } from '../../shared/components/SecondaryButton'
import { ClipboardCheck, X } from 'lucide-react'

export interface PilotEndSurveyModalProps {
  session: PilotSession
  isOpen: boolean
  onClose: () => void
  onSuccess: (updated: PilotSession) => void
}

export const PilotEndSurveyModal: React.FC<PilotEndSurveyModalProps> = ({
  session,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [supportLevel, setSupportLevel] = useState<SupportLevel>('none')
  const [wouldUseNextWeek, setWouldUseNextWeek] = useState<ReturnIntention>('yes')
  const [willingnessToPay, setWillingnessToPay] = useState<WillingnessToPay>('50_100k')
  const [mostUsefulArea, setMostUsefulArea] = useState<UsefulArea>('stock')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const updated = await completePilotSession({
        sessionId: session.id,
        supportLevel,
        wouldUseNextWeek,
        willingnessToPay,
        mostUsefulArea
      })
      onSuccess(updated)
      onClose()
    } catch (err) {
      console.error('Error completing session:', err)
      setError(err instanceof Error ? err.message : 'Có lỗi khi kết thúc buổi thử.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="survey-modal-title"
    >
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
            <ClipboardCheck className="w-5 h-5 text-emerald-600" />
            <span id="survey-modal-title">Khảo sát kết thúc buổi thử ({session.participantCode})</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-5 text-xs text-slate-700">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Question 1: Support Level */}
          <div className="space-y-2">
            <label className="font-bold text-slate-900 block text-sm">
              1. Trong buổi thử này người dùng cần trợ giúp bao nhiêu?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: 'none', label: 'Không cần' },
                { val: 'once', label: '1 lần' },
                { val: 'few', label: '2–3 lần' },
                { val: 'many', label: 'Nhiều lần' }
              ].map((opt) => (
                <label
                  key={opt.val}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                    supportLevel === opt.val
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="supportLevel"
                    value={opt.val}
                    checked={supportLevel === opt.val}
                    onChange={() => setSupportLevel(opt.val as SupportLevel)}
                    className="accent-emerald-600"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Question 2: Return Intention */}
          <div className="space-y-2">
            <label className="font-bold text-slate-900 block text-sm">
              2. Nếu tuần tới có việc thật, anh/chị có muốn dùng lại Vườn Ươm không?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 'yes', label: 'Có' },
                { val: 'maybe', label: 'Có thể' },
                { val: 'no', label: 'Không' }
              ].map((opt) => (
                <label
                  key={opt.val}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                    wouldUseNextWeek === opt.val
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="wouldUseNextWeek"
                    value={opt.val}
                    checked={wouldUseNextWeek === opt.val}
                    onChange={() => setWouldUseNextWeek(opt.val as ReturnIntention)}
                    className="accent-emerald-600"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Question 3: Willingness to Pay */}
          <div className="space-y-2">
            <label className="font-bold text-slate-900 block text-sm">
              3. Nếu phần mềm giúp được công việc như hôm nay, mức phí tháng nào anh/chị thấy chấp nhận được?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: 'zero', label: 'Không trả phí' },
                { val: 'under_50k', label: 'Dưới 50.000đ' },
                { val: '50_100k', label: '50.000 – 100.000đ' },
                { val: '100_200k', label: '100.000 – 200.000đ' },
                { val: 'over_200k', label: 'Trên 200.000đ' },
                { val: 'unsure', label: 'Chưa biết' }
              ].map((opt) => (
                <label
                  key={opt.val}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                    willingnessToPay === opt.val
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="willingnessToPay"
                    value={opt.val}
                    checked={willingnessToPay === opt.val}
                    onChange={() => setWillingnessToPay(opt.val as WillingnessToPay)}
                    className="accent-emerald-600"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Question 4: Most Useful Area */}
          <div className="space-y-2">
            <label className="font-bold text-slate-900 block text-sm">
              4. Phần nào hữu ích nhất?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: 'stock', label: 'Xem cây còn bán' },
                { val: 'orders', label: 'Ghi đơn' },
                { val: 'reservation', label: 'Giữ cây' },
                { val: 'shipment', label: 'Giao cây' },
                { val: 'dossier', label: 'Hồ sơ nguồn gốc' },
                { val: 'backup', label: 'Sao lưu dữ liệu' },
                { val: 'other', label: 'Khác' }
              ].map((opt) => (
                <label
                  key={opt.val}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                    mostUsefulArea === opt.val
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="mostUsefulArea"
                    value={opt.val}
                    checked={mostUsefulArea === opt.val}
                    onChange={() => setMostUsefulArea(opt.val as UsefulArea)}
                    className="accent-emerald-600"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <SecondaryButton fullWidth type="button" onClick={onClose} disabled={isSubmitting}>
              Đóng
            </SecondaryButton>
            <PrimaryButton fullWidth type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : 'Lưu & Hoàn thành'}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  )
}
