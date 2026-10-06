import React, { useState } from 'react'
import type { Contact } from '../../domain/contact'
import { createContact } from '../../services/contactService'
import { X, UserPlus, AlertCircle, Phone, Check } from 'lucide-react'
import { validationTracker } from '../../validation/validationTracker'

export interface ContactQuickCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (contact: Contact) => void
}

export const ContactQuickCreateModal: React.FC<ContactQuickCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<Contact | null>(null)

  if (!isOpen) return null

  const handleSave = async (forceAllowDuplicate = false) => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Vui lòng nhập tên khách hàng.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const result = await createContact({
      name: trimmedName,
      phone: phone.trim() || undefined,
      allowDuplicatePhone: forceAllowDuplicate
    })

    setIsSubmitting(false)

    if (result.success && result.contact) {
      void validationTracker.actionCompleted('contact_created')
      onSuccess(result.contact)
      onClose()
    } else if (result.duplicateWarning && result.existingContact) {
      setDuplicateWarning(result.existingContact)
    } else {
      void validationTracker.actionFailed('contact_created', 'validation')
      setError(result.error || 'Chưa lưu được thông tin khách hàng.')
    }
  }

  const handleUseExisting = () => {
    if (duplicateWarning) {
      onSuccess(duplicateWarning)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <UserPlus className="w-4 h-4" />
            </div>
            <h2 id="contact-modal-title" className="text-base font-bold text-slate-900">
              Thêm khách mới
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSave(false)
          }}
          className="p-4 sm:p-5 space-y-4"
        >
          <div>
            <label htmlFor="contact-name" className="block text-xs font-bold text-slate-800 mb-1">
              Tên khách hàng / Cơ sở <span className="text-rose-600">*</span>
            </label>
            <input
              id="contact-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
                setDuplicateWarning(null)
              }}
              placeholder="VD: Anh Hùng, Chị Lan..."
              autoFocus
              className="w-full px-3.5 py-2.5 text-base rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-semibold min-h-[46px]"
            />
          </div>

          <div>
            <label htmlFor="contact-phone" className="block text-xs font-bold text-slate-800 mb-1">
              Số điện thoại (tùy chọn)
            </label>
            <div className="relative">
              <input
                id="contact-phone"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value)
                  setError(null)
                  setDuplicateWarning(null)
                }}
                placeholder="VD: 0912 345 678"
                className="w-full pl-9 pr-3.5 py-2.5 text-base rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-semibold min-h-[46px]"
              />
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
            </div>
          </div>

          {/* Duplicate Phone Notice */}
          {duplicateWarning && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2">
              <div className="flex items-start gap-1.5 text-amber-900 font-semibold">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>Số điện thoại này đã có trong danh bạ: <strong>{duplicateWarning.name}</strong></span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleUseExisting}
                  className="flex-1 py-2 px-3 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 shadow-2xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Dùng khách này</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs border border-slate-300"
                >
                  Vẫn tạo mới
                </button>
              </div>
            </div>
          )}

          {error && !duplicateWarning && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-1.5 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors min-h-[46px]"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-sm disabled:opacity-50 transition-all min-h-[46px]"
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu khách'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
