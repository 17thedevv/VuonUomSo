import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { PilotSessionPanel } from './PilotSessionPanel'
import { validationRepository } from '../../validation/validation.repository'
import { exportValidationData } from '../../validation/validationExport'
import {
  FileText,
  Download,
  Trash2,
  AlertTriangle,
  BarChart3,
  CheckCircle2
} from 'lucide-react'

export const PilotToolsScreen: React.FC = () => {
  const navigate = useNavigate()
  const [isExporting, setIsExporting] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleExport = async () => {
    setIsExporting(true)
    setStatusMsg(null)
    setErrorMsg(null)
    try {
      const { filename } = await exportValidationData({ includeDemo: true })
      setStatusMsg(`Đã tải về tệp dữ liệu thử nghiệm: ${filename}`)
    } catch (err) {
      console.error(err)
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi khi xuất dữ liệu thử nghiệm.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleClearValidationData = async () => {
    const confirmed = window.confirm(
      'Bạn có chắc chắn muốn xóa toàn bộ phiên và sự kiện thử nghiệm trên máy này?\n\nLưu ý: Dữ liệu sổ cây, đơn hàng và chuyến giao của vườn sẽ KHÔNG bị ảnh hưởng.'
    )
    if (!confirmed) return

    setIsClearing(true)
    setStatusMsg(null)
    setErrorMsg(null)
    try {
      await validationRepository.clearValidationData()
      setStatusMsg('Đã xóa sạch toàn bộ dữ liệu phiên và sự kiện thử nghiệm.')
    } catch (err) {
      console.error(err)
      setErrorMsg('Lỗi khi xóa dữ liệu thử nghiệm.')
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen pb-16">
      <PageHeader
        title="Công cụ thử nghiệm"
        subtitle="Dành cho điều phối viên và nghiên cứu thực địa tại vườn"
        showBack
        backTo="/more"
      />

      <div className="p-4 max-w-xl mx-auto w-full space-y-4">
        {/* Status / Error Toast */}
        {statusMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Pilot Session Control Panel */}
        <PilotSessionPanel />

        {/* 2. Validation Report Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-700" />
            Báo cáo tổng hợp (Validation Report)
          </h2>
          <p className="text-xs text-slate-500">
            Xem phân tích các chỉ số kích hoạt A1/A2/A3, tỷ lệ hoàn thành tác vụ, phản hồi hỗ trợ và mức độ sẵn sàng chi trả (WTP).
          </p>
          <button
            type="button"
            onClick={() => navigate('/validation')}
            className="w-full min-h-[44px] py-2 px-4 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 active:bg-slate-100 transition-colors flex items-center justify-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            Xem bảng điều khiển báo cáo
          </button>
        </div>

        {/* 3. Validation Export Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-700" />
            Xuất dữ liệu thử nghiệm (JSON)
          </h2>
          <p className="text-xs text-slate-500">
            Tải tệp JSON chứa toàn bộ phiên thử nghiệm và sự kiện telemetry để phân tích ngoại tuyến.
            Đảm bảo hoàn toàn không chứa thông tin kinh doanh thực (lô cây, đơn hàng, khách hàng).
          </p>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="w-full min-h-[44px] py-2 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            <FileText className="w-4 h-4" />
            {isExporting ? 'Đang xuất tệp...' : 'Tải tệp dữ liệu thử nghiệm (JSON)'}
          </button>
        </div>

        {/* 4. Privacy & Data Reset Card */}
        <div className="bg-white p-4 rounded-2xl border border-rose-200 space-y-3">
          <h2 className="text-sm font-bold text-rose-700 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-600" />
            Xóa dữ liệu thử nghiệm
          </h2>
          <p className="text-xs text-slate-500">
            Xóa toàn bộ lịch sử phiên nghiên cứu và sự kiện telemetry trên thiết bị này sau khi kết thúc đợt kiểm chứng.
            Dữ liệu sổ sách và nghiệp vụ của vườn vẫn được giữ nguyên vẹn.
          </p>
          <button
            type="button"
            onClick={handleClearValidationData}
            disabled={isClearing}
            className="w-full min-h-[44px] py-2 px-4 rounded-xl border border-rose-300 text-rose-700 font-semibold text-xs hover:bg-rose-50 active:bg-rose-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {isClearing ? 'Đang xóa...' : 'Xóa toàn bộ dữ liệu thử nghiệm'}
          </button>
        </div>
      </div>
    </div>
  )
}
