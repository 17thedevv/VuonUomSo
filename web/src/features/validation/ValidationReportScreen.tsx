import React, { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '../../shared/components/PageHeader'
import { validationRepository } from '../../validation/validation.repository'
import {
  buildValidationSummary
} from '../../validation/validationMetrics'
import type { ValidationSummary } from '../../validation/validation.types'
import {
  BarChart3,
  Users,
  Target,
  HelpCircle,
  CreditCard,
  Calendar,
  CheckCircle2,
  Clock
} from 'lucide-react'

export const ValidationReportScreen: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [includeDemo, setIncludeDemo] = useState(false)
  const [summary, setSummary] = useState<ValidationSummary | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [sList, eList] = await Promise.all([
        validationRepository.getAllPilotSessions(),
        validationRepository.getAllValidationEvents()
      ])
      setSummary(buildValidationSummary(sList, eList, { includeDemo }))
    } catch (err) {
      console.error('Failed to load validation report data:', err)
    } finally {
      setLoading(false)
    }
  }, [includeDemo])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading || !summary) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 space-y-2 min-h-screen bg-slate-50">
        <Clock className="w-6 h-6 animate-pulse text-emerald-600" />
        <span className="text-sm font-medium">Đang tổng hợp báo cáo thử nghiệm...</span>
      </div>
    )
  }

  const {
    totalParticipants,
    totalSessions,
    completedSessions,
    activeSessions,
    returningParticipants,
    activation,
    tasks,
    support,
    willingnessToPay,
    returnIntention,
    evidence
  } = summary

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen pb-16">
      <PageHeader
        title="Báo cáo thử nghiệm"
        subtitle="Dữ liệu thực địa phục vụ quyết định GO / PIVOT / STOP"
        showBack
        backTo="/more"
      />

      <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-5">
        {/* Filter Toggle */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 flex items-center justify-between text-xs">
          <span className="text-slate-600 font-medium">Bao gồm thao tác thử mẫu (Demo):</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeDemo}
              onChange={(e) => setIncludeDemo(e.target.checked)}
              className="accent-emerald-600 rounded"
            />
            <span className="font-semibold text-slate-800">{includeDemo ? 'BẬT' : 'TẮT (Chuẩn)'}</span>
          </label>
        </div>

        <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-5 lg:space-y-0 items-start">
          {/* Column 1: Sample, Activation, Tasks, Support */}
          <div className="space-y-5">
            {/* Section 1: Thử nghiệm (Sample) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Users className="w-4 h-4 text-emerald-600" />
            <span>THỬ NGHIỆM</span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-slate-50 rounded-xl">
              <div className="text-[11px] text-slate-500 font-medium">Người thử</div>
              <div className="text-xl font-bold text-slate-900">{totalParticipants}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <div className="text-[11px] text-slate-500 font-medium">Buổi thử</div>
              <div className="text-xl font-bold text-slate-900">{totalSessions}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {completedSessions} xong / {activeSessions} mở
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <div className="text-[11px] text-slate-500 font-medium">Quay lại ngày khác</div>
              <div className="text-xl font-bold text-emerald-700">{returningParticipants}</div>
            </div>
          </div>
        </div>

        {/* Section 2: Kích hoạt (Activation) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Target className="w-4 h-4 text-emerald-600" />
            <span>KÍCH HOẠT</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">A1 — Có nhập dữ liệu</span>
                <p className="text-[11px] text-slate-500">Tạo lô cây, cập nhật tồn hoặc ghi đơn</p>
              </div>
              <span className="text-sm font-bold text-slate-900">
                {activation.a1Count} / {totalParticipants}
              </span>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl flex items-center justify-between">
              <div>
                <span className="font-bold text-emerald-950">A2 — Hoàn thành workflow chính</span>
                <p className="text-[11px] text-emerald-700">Tạo đơn + giữ cây hoặc lên/xuất chuyến</p>
              </div>
              <span className="text-sm font-bold text-emerald-900">
                {activation.a2Count} / {totalParticipants}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">A3 — Quay lại và tiếp tục dùng</span>
                <p className="text-[11px] text-slate-500">Đạt A2 và quay lại dùng vào ngày khác</p>
              </div>
              <span className="text-sm font-bold text-slate-900">
                {activation.a3Count} / {totalParticipants}
              </span>
            </div>
          </div>
        </div>

        {/* Section 3 & 4: Thao tác thành công & Khó khăn (Friction) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            <span>THAO TÁC & KHÓ KHĂN</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {tasks.map((t) => (
              <div key={t.action} className="py-2.5 flex items-center justify-between">
                <span className="text-slate-800 font-medium">{t.label}</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-emerald-700 font-bold">{t.completedCount} xong</span>
                  {t.failedCount > 0 && (
                    <span className="text-rose-600 font-semibold">/ {t.failedCount} lỗi</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 5: Trợ giúp (Support) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <HelpCircle className="w-4 h-4 text-emerald-600" />
            <span>MỨC ĐỘ TRỢ GIÚP KHI DÙNG</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-xl flex justify-between">
              <span className="text-slate-600">Không cần</span>
              <span className="font-bold text-slate-900">{support.none}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl flex justify-between">
              <span className="text-slate-600">1 lần</span>
              <span className="font-bold text-slate-900">{support.once}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl flex justify-between">
              <span className="text-slate-600">2–3 lần</span>
              <span className="font-bold text-slate-900">{support.few}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl flex justify-between">
              <span className="text-slate-600">Nhiều lần</span>
              <span className="font-bold text-rose-600">{support.many}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Column 2: WTP, Return intention, Evidence */}
      <div className="space-y-5">
        {/* Section 6: Mức phí chấp nhận (WTP) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <span>MỨC PHÍ CHẤP NHẬN (WTP)</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-xl flex justify-between">
              <span className="text-slate-600">0đ</span>
              <span className="font-bold text-slate-900">{willingnessToPay.zero}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl flex justify-between">
              <span className="text-slate-600">&lt;50k</span>
              <span className="font-bold text-slate-900">{willingnessToPay.under_50k}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl flex justify-between">
              <span className="text-slate-600">50–100k</span>
              <span className="font-bold text-emerald-700">{willingnessToPay['50_100k']}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl flex justify-between">
              <span className="text-slate-600">100–200k</span>
              <span className="font-bold text-emerald-700">{willingnessToPay['100_200k']}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl flex justify-between">
              <span className="text-slate-600">&gt;200k</span>
              <span className="font-bold text-emerald-700">{willingnessToPay.over_200k}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl flex justify-between">
              <span className="text-slate-600">Chưa biết</span>
              <span className="font-bold text-slate-500">{willingnessToPay.unsure}</span>
            </div>
          </div>
        </div>

        {/* Section 7: Ý định quay lại */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>MUỐN DÙNG TUẦN TỚI</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div className="p-2.5 bg-emerald-50 rounded-xl">
              <div className="text-slate-600">Có</div>
              <div className="text-base font-bold text-emerald-800">{returnIntention.yes}</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <div className="text-slate-600">Có thể</div>
              <div className="text-base font-bold text-slate-800">{returnIntention.maybe}</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <div className="text-slate-600">Không</div>
              <div className="text-base font-bold text-slate-800">{returnIntention.no}</div>
            </div>
          </div>
        </div>

        {/* Section 8: Bằng chứng Validation */}
        <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-4 shadow-md">
          <div className="flex items-center gap-2 font-bold text-sm text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>BẰNG CHỨNG VALIDATION (SO VỚI MỤC TIÊU)</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
              <span className="text-slate-300">Activated (A2):</span>
              <span className="font-bold text-white">
                {evidence.activatedA2.current} / mục tiêu {evidence.activatedA2.target}
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
              <span className="text-slate-300">Returned (≥2 ngày khác nhau):</span>
              <span className="font-bold text-white">
                {evidence.returned.current} / mục tiêu {evidence.returned.target}
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
              <span className="text-slate-300">Có WTP (&gt;0đ):</span>
              <span className="font-bold text-white">
                {evidence.positiveWtp.current} / mục tiêu {evidence.positiveWtp.target}
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5">
              <span className="text-slate-300">Cần hỗ trợ nhiều:</span>
              <span className="font-bold text-white">
                {evidence.heavySupport.current} / {evidence.heavySupport.total} người thử
              </span>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-800 leading-relaxed italic">
            Báo cáo chỉ phản ánh bằng chứng thực tế khách quan. Quyết định GO / PIVOT / STOP do nhóm phát triển quyết định dựa trên dữ liệu.
          </div>
        </div>
        </div>
      </div>
    </div>
  </div>
  )
}
