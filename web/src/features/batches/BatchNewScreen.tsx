import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { QuantityInput } from '../../shared/components/QuantityInput'
import { createBatch } from '../../services/batchService'
import { Sprout, ChevronDown, ChevronUp, AlertCircle, Info } from 'lucide-react'

const COMMON_VARIETIES = [
  'Keo lai BV16',
  'Keo lai AH1',
  'Keo lai BV523',
  'Keo tai tượng',
  'Bạch đàn U6'
]

export const BatchNewScreen: React.FC = () => {
  const navigate = useNavigate()

  // Form states
  const [selectedVariety, setSelectedVariety] = useState<string>(COMMON_VARIETIES[0])
  const [customVariety, setCustomVariety] = useState('')
  const [isCustomVariety, setIsCustomVariety] = useState(false)

  const [rawQuantity, setRawQuantity] = useState('5')
  const [parsedQuantity, setParsedQuantity] = useState<number | null>(50000)
  const [unit, setUnit] = useState<'cay' | 'van'>('van')

  const [createdAt, setCreatedAt] = useState(() => new Date().toISOString().split('T')[0])
  const [showMoreInfo, setShowMoreInfo] = useState(false)
  const [customCode, setCustomCode] = useState('')
  const [preferredSellBefore, setPreferredSellBefore] = useState('')
  const [sourceNote, setSourceNote] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const effectiveVariety = isCustomVariety ? customVariety.trim() : selectedVariety

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    if (!effectiveVariety) {
      setFormError('Vui lòng chọn hoặc nhập tên giống cây.')
      return
    }

    if (!parsedQuantity || parsedQuantity <= 0) {
      setFormError('Vui lòng nhập số lượng cây ban đầu lớn hơn 0.')
      return
    }

    setIsSubmitting(true)
    setFormError(null)

    const result = await createBatch({
      variety: effectiveVariety,
      initialQuantity: parsedQuantity,
      createdAt: new Date(createdAt).toISOString(),
      code: customCode.trim() || undefined,
      preferredSellBefore: preferredSellBefore ? new Date(preferredSellBefore).toISOString() : undefined,
      sourceNote: sourceNote.trim() || undefined
    })

    setIsSubmitting(false)

    if (result.success && result.batch) {
      navigate(`/batches/${result.batch.id}`, { replace: true })
    } else {
      setFormError(result.error || 'Chưa lưu được lô cây. Dữ liệu bạn vừa nhập vẫn còn trên màn hình.')
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <PageHeader title="Tạo lô mới" subtitle="Nhập đợt ươm giống vào vườn" showBack backTo="/batches" />

      <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form Column */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-5">
              {/* Variety Selection */}
              <div>
                <label htmlFor="batch-variety" className="block text-sm font-bold text-slate-800 mb-1.5">
                  Giống cây <span className="text-rose-600">*</span>
                </label>
                <div className="space-y-2">
                  <select
                    id="batch-variety"
                    value={isCustomVariety ? '__other__' : selectedVariety}
                    onChange={(e) => {
                      if (e.target.value === '__other__') {
                        setIsCustomVariety(true)
                      } else {
                        setIsCustomVariety(false)
                        setSelectedVariety(e.target.value)
                      }
                      setFormError(null)
                    }}
                    className="w-full px-3.5 py-3 text-base rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 bg-white text-slate-900 font-semibold min-h-[48px]"
                  >
                    {COMMON_VARIETIES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                    <option value="__other__">+ Giống khác...</option>
                  </select>

                  {isCustomVariety && (
                    <input
                      type="text"
                      value={customVariety}
                      onChange={(e) => {
                        setCustomVariety(e.target.value)
                        setFormError(null)
                      }}
                      placeholder="Nhập tên giống cây khác..."
                      autoFocus
                      className="w-full px-3.5 py-2.5 text-base rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 bg-slate-50 text-slate-900 font-semibold min-h-[44px]"
                    />
                  )}
                </div>
              </div>

              {/* Initial Quantity */}
              <div>
                <QuantityInput
                  id="batch-initial-quantity"
                  label="Số lượng ban đầu"
                  required
                  value={rawQuantity}
                  unit={unit}
                  onUnitChange={setUnit}
                  onChange={(raw, parsed) => {
                    setRawQuantity(raw)
                    setParsedQuantity(parsed)
                    setFormError(null)
                  }}
                  placeholder="VD: 5 vạn hoặc 50000"
                  showQuickChips={true}
                />
              </div>

              {/* Created Date */}
              <div>
                <label htmlFor="batch-created-date" className="block text-sm font-bold text-slate-800 mb-1.5">
                  Ngày tạo lô (ngày cắm hom / gieo hạt)
                </label>
                <input
                  id="batch-created-date"
                  type="date"
                  value={createdAt}
                  onChange={(e) => setCreatedAt(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-base rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 bg-white text-slate-800 font-semibold min-h-[48px]"
                />
              </div>

              {/* Collapsible Additional Info */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowMoreInfo(!showMoreInfo)}
                  className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-900 py-1 transition-colors"
                >
                  {showMoreInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <span>{showMoreInfo ? 'Thu gọn thông tin' : '+ Thêm thông tin (mã lô, ngày xuất dự kiến...)'}</span>
                </button>

                {showMoreInfo && (
                  <div className="mt-3 space-y-3.5 bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 text-xs">
                    <div>
                      <label htmlFor="batch-code" className="block font-bold text-slate-700 mb-1">
                        Mã lô tùy chỉnh (để trống sẽ tự tạo: VD BV16 #13)
                      </label>
                      <input
                        id="batch-code"
                        type="text"
                        value={customCode}
                        onChange={(e) => setCustomCode(e.target.value)}
                        placeholder="Để trống để tự tạo mã"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-semibold"
                      />
                    </div>

                    <div>
                      <label htmlFor="batch-sell-before" className="block font-bold text-slate-700 mb-1">
                        Nên xuất bán trước (tránh quá lứa rễ ăn sâu)
                      </label>
                      <input
                        id="batch-sell-before"
                        type="date"
                        value={preferredSellBefore}
                        onChange={(e) => setPreferredSellBefore(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-semibold"
                      />
                    </div>

                    <div>
                      <label htmlFor="batch-source-note" className="block font-bold text-slate-700 mb-1">
                        Ghi chú nguồn gốc / nhà cung cấp giống
                      </label>
                      <input
                        id="batch-source-note"
                        type="text"
                        value={sourceNote}
                        onChange={(e) => setSourceNote(e.target.value)}
                        placeholder="VD: Cắt hom từ vườn đầu dòng Tuấn Sơn, Lạng Sơn"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Error notice */}
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Primary Submit CTA */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] py-3.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs flex items-center justify-center gap-2"
                >
                  <Sprout className="w-5 h-5" />
                  <span>{isSubmitting ? 'ĐANG LƯU LÔ...' : 'LƯU LÔ CÂY'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Desktop/Tablet Context Panel */}
          <div className="hidden lg:block lg:col-span-1 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3 text-xs">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Info className="w-4 h-4 text-emerald-700" />
                <span>Quy ước tạo lô cây</span>
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Mỗi <strong>lô cây</strong> là một đợt ươm giống cụ thể (cùng giống cây, cùng thời điểm vào bầu đất).
              </p>
              <div className="space-y-2 pt-2 border-t border-slate-100 text-slate-700">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-emerald-700">1.</span>
                  <span>Lô mới sẽ bắt đầu ở trạng thái <strong>Đang ươm</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-emerald-700">2.</span>
                  <span>Số cây đủ bán khởi điểm bằng 0 cây cho đến khi được kiểm kê đạt chuẩn.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-emerald-700">3.</span>
                  <span>Mã lô sẽ tự động tăng số (VD: <em>BV16 #13</em>) để tránh trùng lặp.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
