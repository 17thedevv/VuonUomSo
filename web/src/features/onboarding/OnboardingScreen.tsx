import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sprout, Check } from 'lucide-react'
import type { OrganizationCapability } from '../../domain/organization'
import { organizationRepository, settingsRepository, eventRepository } from '../../data/repositories'
import { resetDemoData } from '../../data/seed'
import { PrimaryButton } from '../../shared/components/PrimaryButton'
import { SecondaryButton } from '../../shared/components/SecondaryButton'
import { OfflineBadge } from '../../shared/components/OfflineBadge'
import { validationTracker } from '../../validation/validationTracker'

interface CapabilityOption {
  key: OrganizationCapability
  label: string
  description: string
}

const CAPABILITY_OPTIONS: CapabilityOption[] = [
  { key: 'produce', label: 'Ươm cây', description: 'Gieo hạt, cấy mô, giâm hom tại vườn' },
  { key: 'sell', label: 'Bán cây', description: 'Bán lẻ hoặc bán buôn cho khách trồng rừng' },
  { key: 'aggregate', label: 'Mua/gom cây từ vườn khác', description: 'Thu gom thêm cây giống khi đơn lớn' },
  { key: 'transport', label: 'Tổ chức giao cây', description: 'Sắp xe, ghép chuyến, giao tới bãi nhận' }
]

export const OnboardingScreen: React.FC = () => {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [selectedCaps, setSelectedCaps] = useState<OrganizationCapability[]>(['produce', 'sell'])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const toggleCapability = (cap: OrganizationCapability) => {
    setSelectedCaps((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Vui lòng nhập tên vườn hoặc cơ sở của bạn')
      return
    }

    if (selectedCaps.length === 0) {
      setError('Vui lòng chọn ít nhất một hoạt động thường làm')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const orgId = `org_${Date.now()}`
      await organizationRepository.save({
        id: orgId,
        name: trimmedName,
        capabilities: selectedCaps
      })

      await settingsRepository.set('onboarding_completed', 'true')
      await settingsRepository.set('app_mode', 'pilot')

      await eventRepository.record({
        type: 'organization_onboarded',
        entityType: 'organization',
        entityId: orgId,
        payload: { name: trimmedName, capabilities: selectedCaps }
      })

      void validationTracker.actionCompleted('onboarding_completed')

      navigate('/today', { replace: true })
    } catch (err) {
      void validationTracker.actionFailed('onboarding_completed', 'storage')
      setError('Có lỗi xảy ra khi lưu. Vui lòng thử lại.')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUseDemoData = async () => {
    setIsSubmitting(true)
    try {
      await resetDemoData()
      navigate('/today', { replace: true })
    } catch (err) {
      setError('Không thể tải dữ liệu mẫu. Vui lòng thử lại.')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 lg:p-12 w-full max-w-6xl mx-auto">
      <OfflineBadge />

      <div className="pt-6 my-auto lg:grid lg:grid-cols-12 lg:gap-12 lg:items-center">
        {/* Branding (Left on Desktop, Top on Mobile) */}
        <div className="lg:col-span-5 text-center lg:text-left mb-8 lg:mb-0">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 mb-4 shadow-xs">
            <Sprout className="w-9 h-9" />
          </div>
          <h1 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">Vườn Ươm</h1>
          <p className="text-base font-semibold text-emerald-800 mt-1">Sổ cây giống trên điện thoại</p>
          <p className="hidden lg:block text-sm text-slate-500 mt-4 leading-relaxed">
            Sổ tay quản lý lâm nghiệp thực tế: phân biệt rõ tồn kho vật lý, cây đủ chuẩn và số lượng còn bán; giữ cây và xuất xe an toàn, không lo bán khống.
          </p>
        </div>

        {/* Form & Actions (Right on Desktop) */}
        <div className="lg:col-span-7 w-full max-w-xl mx-auto lg:mx-0">
          <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <label htmlFor="garden-name" className="block text-sm font-bold text-slate-800 mb-1.5">
                Tên vườn / cơ sở
              </label>
              <input
                id="garden-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (error) setError(null)
                }}
                placeholder="VD: Vườn ươm Tuấn Sơn, Vườn Bác Bình..."
                className="w-full px-4 py-3 text-base rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-slate-900 placeholder:text-slate-400 min-h-[48px]"
              />
            </div>

          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">
              Bạn thường làm gì?
            </label>
            <div className="space-y-2">
              {CAPABILITY_OPTIONS.map((opt) => {
                const checked = selectedCaps.includes(opt.key)
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => toggleCapability(opt.key)}
                    className={`w-full flex items-start gap-3 p-3 text-left rounded-xl border transition-all min-h-[52px] ${
                      checked
                        ? 'border-emerald-600 bg-emerald-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md mt-0.5 flex items-center justify-center shrink-0 border ${
                        checked
                          ? 'bg-emerald-700 border-emerald-700 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{opt.label}</div>
                      <div className="text-xs text-slate-500">{opt.description}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {error}
            </div>
          )}

          <div className="pt-2">
            <PrimaryButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'ĐANG LƯU...' : 'BẮT ĐẦU'}
            </PrimaryButton>
          </div>
        </form>

        {/* Demo Seed Shortcut for Prototype Evaluation */}
        <div className="py-6 text-center space-y-3">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-50 px-2 text-slate-400">hoặc thử nghiệm ngay</span>
            </div>
          </div>
          <SecondaryButton
            fullWidth
            type="button"
            onClick={handleUseDemoData}
            disabled={isSubmitting}
          >
            Dùng thử với dữ liệu mẫu (Vườn Hồng Anh)
          </SecondaryButton>
        </div>
      </div>
    </div>
  </div>
  )
}
