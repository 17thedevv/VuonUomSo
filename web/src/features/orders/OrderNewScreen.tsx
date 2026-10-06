import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { QuantityInput } from '../../shared/components/QuantityInput'
import { ContactQuickCreateModal } from './ContactQuickCreateModal'
import { createOrder, getVarietyAvailability, type VarietyAvailabilityInfo } from '../../services/orderService'
import { contactRepository, batchRepository } from '../../data/repositories'
import type { Contact } from '../../domain/contact'
import type { Batch } from '../../domain/batch'
import { formatQuantity } from '../../domain/quantity'
import { UserPlus, Calendar, Plus, AlertCircle, Info, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import { validationTracker } from '../../validation/validationTracker'

const COMMON_VARIETIES = [
  'Keo lai BV16',
  'Keo lai AH1',
  'Keo lai BV523',
  'Keo tai tượng',
  'Bạch đàn U6'
]

export const OrderNewScreen: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefillVariety = searchParams.get('variety') || COMMON_VARIETIES[0]

  // Data baseline
  const [contacts, setContacts] = useState<Contact[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)

  // Form states
  const [customerId, setCustomerId] = useState<string>('')
  const [variety, setVariety] = useState<string>(prefillVariety)
  const [rawQuantity, setRawQuantity] = useState('3')
  const [parsedQuantity, setParsedQuantity] = useState<number | null>(30000)
  const [unit, setUnit] = useState<'cay' | 'van'>('van')

  const [dateOption, setDateOption] = useState<'today' | 'tomorrow' | '3days' | 'custom'>('tomorrow')
  const [customDate, setCustomDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })

  const [showMoreInfo, setShowMoreInfo] = useState(false)
  const [unitPrice, setUnitPrice] = useState('')
  const [note, setNote] = useState('')

  // Live availability feedback
  const [availabilityInfo, setAvailabilityInfo] = useState<VarietyAvailabilityInfo | null>(null)

  // Contact quick-create modal
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadBaseData = useCallback(async () => {
    try {
      const [allContacts, allBatches] = await Promise.all([
        contactRepository.getAll(),
        batchRepository.getAll()
      ])
      const customerContacts = allContacts.filter(
        (c) => c.roles.includes('customer') || !c.roles.includes('supplier')
      )
      setContacts(customerContacts)
      setBatches(allBatches)

      if (customerContacts.length > 0 && !customerId) {
        setCustomerId(customerContacts[0].id)
      }
    } catch (err) {
      console.error('Failed to load baseline data:', err)
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    loadBaseData()
  }, [loadBaseData])

  // Recalculate live availability when variety or quantity changes
  useEffect(() => {
    let ignore = false
    const fetchAvail = async () => {
      const info = await getVarietyAvailability(variety, parsedQuantity || 0)
      if (!ignore) {
        setAvailabilityInfo(info)
      }
    }
    fetchAvail()
    return () => {
      ignore = true
    }
  }, [variety, parsedQuantity])

  // Calculate actual requested date from shortcut
  const getRequestedDateIso = (): string => {
    const now = new Date()
    if (dateOption === 'today') {
      return now.toISOString()
    }
    if (dateOption === 'tomorrow') {
      now.setDate(now.getDate() + 1)
      return now.toISOString()
    }
    if (dateOption === '3days') {
      now.setDate(now.getDate() + 3)
      return now.toISOString()
    }
    return new Date(customDate).toISOString()
  }

  useEffect(() => {
    void validationTracker.formStarted('order_created')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    if (!customerId) {
      setFormError('Vui lòng chọn hoặc thêm khách hàng.')
      void validationTracker.actionFailed('order_created', 'validation')
      return
    }

    if (!variety) {
      setFormError('Vui lòng chọn giống cây.')
      void validationTracker.actionFailed('order_created', 'validation')
      return
    }

    if (!parsedQuantity || parsedQuantity <= 0) {
      setFormError('Vui lòng nhập số lượng cây đặt lớn hơn 0.')
      void validationTracker.actionFailed('order_created', 'validation')
      return
    }

    setIsSubmitting(true)
    setFormError(null)

    const parsedPrice = unitPrice.trim() ? parseFloat(unitPrice.replace(/\D/g, '')) : undefined

    const result = await createOrder({
      customerId,
      variety,
      requestedQuantity: parsedQuantity,
      requestedDate: getRequestedDateIso(),
      unitPrice: isNaN(parsedPrice as number) ? undefined : parsedPrice,
      note: note.trim() || undefined
    })

    setIsSubmitting(false)

    if (result.success && result.order) {
      void validationTracker.actionCompleted('order_created')
      navigate(`/orders/${result.order.id}`, { replace: true })
    } else {
      void validationTracker.actionFailed('order_created', 'storage')
      setFormError(result.error || 'Chưa lưu được đơn hàng. Vui lòng thử lại.')
    }
  }

  const estimatedTotal =
    parsedQuantity && unitPrice.trim()
      ? parsedQuantity * parseFloat(unitPrice.replace(/\D/g, ''))
      : null

  // Batches matching current variety for context panel
  const matchingBatches = batches.filter(
    (b) => b.variety.toLowerCase().trim() === variety.toLowerCase().trim()
  )

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <PageHeader title="Ghi đơn mới" subtitle="Tiếp nhận nhu cầu đặt cây" showBack backTo="/orders" />

      <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form Column */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-5">
              {/* Customer selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="order-customer" className="block text-sm font-bold text-slate-800">
                    Khách đặt cây <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsContactModalOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 active:text-emerald-900"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Khách mới</span>
                  </button>
                </div>

                {loading ? (
                  <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
                ) : contacts.length === 0 ? (
                  <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-slate-500">Chưa có khách trong danh bạ.</span>
                    <button
                      type="button"
                      onClick={() => setIsContactModalOpen(true)}
                      className="px-3 py-1.5 bg-emerald-700 text-white font-bold rounded-lg"
                    >
                      + Thêm ngay
                    </button>
                  </div>
                ) : (
                  <select
                    id="order-customer"
                    value={customerId}
                    onChange={(e) => {
                      setCustomerId(e.target.value)
                      setFormError(null)
                    }}
                    className="w-full px-3.5 py-3 text-base rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 bg-white text-slate-900 font-semibold min-h-[48px]"
                  >
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Variety selection */}
              <div>
                <label htmlFor="order-variety" className="block text-sm font-bold text-slate-800 mb-1.5">
                  Loại cây giống <span className="text-rose-600">*</span>
                </label>
                <select
                  id="order-variety"
                  value={variety}
                  onChange={(e) => {
                    setVariety(e.target.value)
                    setFormError(null)
                  }}
                  className="w-full px-3.5 py-3 text-base rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 bg-white text-slate-900 font-semibold min-h-[48px]"
                >
                  {COMMON_VARIETIES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity Input */}
              <div>
                <QuantityInput
                  id="order-requested-quantity"
                  label="Số lượng đặt"
                  required
                  value={rawQuantity}
                  unit={unit}
                  onUnitChange={setUnit}
                  onChange={(raw, parsed) => {
                    setRawQuantity(raw)
                    setParsedQuantity(parsed)
                    setFormError(null)
                  }}
                  placeholder="VD: 3 vạn hoặc 30.000"
                  showQuickChips={true}
                />
              </div>

              {/* Live Informational Availability Feedback Banner */}
              {availabilityInfo && (
                <div className="text-xs">
                  {availabilityInfo.availableQuantity > 0 ? (
                    availabilityInfo.isShortage ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold">
                            Đơn cần {formatQuantity(parsedQuantity || 0)} cây • Hiện vườn còn{' '}
                            {formatQuantity(availabilityInfo.availableQuantity)} cây có thể bán
                          </div>
                          <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                            Còn thiếu {formatQuantity(availabilityInfo.shortageAmount)} cây. Bạn vẫn có thể ghi đơn
                            bình thường, sau đó giữ thêm từ các lô trong vườn hoặc gom từ vườn ngoài ở bước sau.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>
                          Vườn hiện có <strong>{formatQuantity(availabilityInfo.availableQuantity)} cây</strong>{' '}
                          {variety} sẵn sàng bán (đủ đáp ứng đơn này).
                        </span>
                      </div>
                    )
                  ) : (
                    <div className="p-2.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl flex items-center gap-2">
                      <Info className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>
                        Hiện trong vườn chưa có sẵn cây {variety} đủ bán. Đơn sẽ ghi nhận nhu cầu để giữ hoặc gom sau.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Requested Date */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span>Ngày hẹn lấy cây</span>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { key: 'today', label: 'Hôm nay' },
                    { key: 'tomorrow', label: 'Ngày mai' },
                    { key: '3days', label: '3 ngày tới' },
                    { key: 'custom', label: 'Khác...' }
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setDateOption(opt.key as typeof dateOption)}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all text-center min-h-[40px] ${
                        dateOption === opt.key
                          ? 'bg-emerald-700 border-emerald-700 text-white shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {dateOption === 'custom' && (
                  <div className="mt-2">
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-base rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 bg-white font-semibold min-h-[44px]"
                    />
                  </div>
                )}
              </div>

              {/* Collapsible Additional Info */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowMoreInfo(!showMoreInfo)}
                  className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-900 py-1 transition-colors"
                >
                  {showMoreInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <span>{showMoreInfo ? 'Thu gọn thông tin' : '+ Thêm thông tin (đơn giá, ghi chú bãi nhận...)'}</span>
                </button>

                {showMoreInfo && (
                  <div className="mt-3 space-y-3.5 bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 text-xs">
                    <div>
                      <label htmlFor="order-unit-price" className="block font-bold text-slate-700 mb-1">
                        Giá / cây (VNĐ, tùy chọn)
                      </label>
                      <input
                        id="order-unit-price"
                        type="text"
                        inputMode="numeric"
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(e.target.value)}
                        placeholder="VD: 1200 hoặc 1.200"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-semibold"
                      />
                      {estimatedTotal !== null && !isNaN(estimatedTotal) && estimatedTotal > 0 && (
                        <span className="block mt-1 font-bold text-emerald-800">
                          = Ước tính thành tiền: {estimatedTotal.toLocaleString('vi-VN')} đ
                        </span>
                      )}
                    </div>

                    <div>
                      <label htmlFor="order-note" className="block font-bold text-slate-700 mb-1">
                        Ghi chú giao nhận / bãi nhận
                      </label>
                      <input
                        id="order-note"
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="VD: Xe ghép về bãi Lục Nam, hẹn bốc lúc 7h sáng"
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

              {/* Submit CTA - Sticky bottom on mobile for one-thumb reach */}
              <div className="sticky bottom-0 bg-white/95 backdrop-blur-xs pt-3 pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pt-2 sm:pb-0 sm:bg-transparent sm:static border-t border-slate-100 sm:border-0 z-10 shadow-xs sm:shadow-none">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] py-3.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>{isSubmitting ? 'ĐANG LƯU ĐƠN...' : 'LƯU ĐƠN HÀNG'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Desktop/Tablet Context Panel: TỒN HIỆN TẠI */}
          <div className="hidden lg:block lg:col-span-1 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5 text-xs">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 pb-2 border-b border-slate-100">
                <Info className="w-4 h-4 text-emerald-700" />
                <span>Tồn hiện tại: {variety}</span>
              </h3>

              <div className="space-y-2">
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Cây còn bán:</span>
                  <strong className="text-emerald-700 text-base font-black">
                    {formatQuantity(availabilityInfo?.availableQuantity || 0)} cây
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-100">
                  <span className="text-slate-500">Đã giữ cho khách:</span>
                  <span className="font-bold text-amber-800">
                    {formatQuantity(availabilityInfo?.reservedQuantity || 0)} cây
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-100">
                  <span className="text-slate-500">Tổng cây đủ chuẩn:</span>
                  <span className="font-bold text-slate-800">
                    {formatQuantity(availabilityInfo?.readyQuantity || 0)} cây
                  </span>
                </div>
              </div>

              {/* List of batches containing this variety */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
                  Các lô giống này ({matchingBatches.length} lô)
                </span>
                {matchingBatches.length === 0 ? (
                  <p className="text-slate-400 italic">Chưa có lô nào của giống này.</p>
                ) : (
                  matchingBatches.map((b) => (
                    <div key={b.id} className="p-2 bg-slate-50 rounded-lg flex justify-between items-center">
                      <span className="font-bold text-slate-800">{b.code}</span>
                      <span className="text-slate-600 font-semibold">{formatQuantity(b.readyQuantity)} đủ bán</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick create contact modal */}
      <ContactQuickCreateModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        onSuccess={(newContact) => {
          setContacts((prev) => [newContact, ...prev])
          setCustomerId(newContact.id)
        }}
      />
    </div>
  )
}
