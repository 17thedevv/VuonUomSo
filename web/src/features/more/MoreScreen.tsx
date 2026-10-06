import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RotateCcw, Trash2, Download, CheckCircle, Info, ShieldCheck } from 'lucide-react'
import { resetDemoData, clearAllData } from '../../data/seed'
import { exportDatabaseToJson } from '../../data/backup'
import { settingsRepository, organizationRepository } from '../../data/repositories'
import { PageHeader } from '../../shared/components/PageHeader'
import { PrimaryButton } from '../../shared/components/PrimaryButton'
import { SecondaryButton } from '../../shared/components/SecondaryButton'

export const MoreScreen: React.FC = () => {
  const navigate = useNavigate()
  const [mode, setMode] = useState<string>('pilot')
  const [orgName, setOrgName] = useState<string>('')
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    async function loadInfo() {
      const currentMode = await settingsRepository.get('app_mode')
      const currentOrg = await organizationRepository.getCurrent()
      setMode(currentMode || 'pilot')
      setOrgName(currentOrg?.name || 'Chưa thiết lập')
    }
    loadInfo()
  }, [])

  const handleResetDemo = async () => {
    if (!window.confirm('Cài đặt lại toàn bộ dữ liệu mẫu (Vườn Hồng Anh)? Dữ liệu hiện tại sẽ được thay thế.')) {
      return
    }
    setIsProcessing(true)
    try {
      await resetDemoData()
      setStatusMsg('Đã khôi phục dữ liệu mẫu thành công.')
      setMode('demo')
      setOrgName('Vườn Hồng Anh')
      setTimeout(() => {
        navigate('/today')
      }, 700)
    } catch (err) {
      console.error(err)
      setStatusMsg('Có lỗi xảy ra khi khôi phục.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleResetWorkspace = async () => {
    if (!window.confirm('Xóa trắng dữ liệu và bắt đầu lại từ màn hình mở sổ?')) {
      return
    }
    setIsProcessing(true)
    try {
      await clearAllData()
      navigate('/onboarding', { replace: true })
    } catch (err) {
      console.error(err)
      setStatusMsg('Có lỗi khi xóa dữ liệu.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExportBackup = async () => {
    try {
      const json = await exportDatabaseToJson()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vuonuom_backup_${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      setStatusMsg('Đã tải tệp sao lưu về máy.')
    } catch (err) {
      console.error(err)
      setStatusMsg('Không thể xuất dữ liệu.')
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <PageHeader title="Thêm" subtitle="Cài đặt & Quản lý dữ liệu" />

      <div className="p-4 space-y-4">
        {/* Status notification */}
        {statusMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Current State Info */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Cơ sở:</span>
            <span className="font-bold text-slate-800">{orgName}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Chế độ hoạt động:</span>
            <span
              className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
                mode === 'demo'
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              {mode === 'demo' ? 'Dữ liệu mẫu (Demo)' : 'Thực tế (Pilot)'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Lưu trữ:</span>
            <span className="text-xs text-slate-600 flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              IndexedDB trên máy
            </span>
          </div>
        </div>

        {/* Demo / Pilot Controls */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-emerald-700" />
            Dữ liệu thử nghiệm
          </h2>
          <p className="text-xs text-slate-500">
            Khôi phục bộ dữ liệu vườn mẫu (BV16, AH1, BV523 và các đơn hàng) để trải nghiệm app.
          </p>
          <PrimaryButton onClick={handleResetDemo} disabled={isProcessing}>
            Cài lại dữ liệu mẫu (Reset demo data)
          </PrimaryButton>
        </div>

        {/* Local Backup */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-700" />
            Sao lưu dữ liệu
          </h2>
          <p className="text-xs text-slate-500">
            Xuất toàn bộ sổ cây, đơn hàng và lịch sử ra tệp JSON trên điện thoại của bạn.
          </p>
          <SecondaryButton fullWidth onClick={handleExportBackup} disabled={isProcessing}>
            Tải tệp sao lưu JSON
          </SecondaryButton>
        </div>

        {/* Reset Workspace */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
          <h2 className="text-sm font-bold text-rose-700 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-600" />
            Vùng nguy hiểm
          </h2>
          <p className="text-xs text-slate-500">
            Xóa sạch cơ sở dữ liệu trên thiết bị này và đưa ứng dụng về trạng thái mở sổ ban đầu.
          </p>
          <button
            type="button"
            onClick={handleResetWorkspace}
            disabled={isProcessing}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-rose-300 text-rose-700 text-sm font-semibold hover:bg-rose-50 active:bg-rose-100 transition-colors disabled:opacity-50"
          >
            Xóa dữ liệu & Bắt đầu lại
          </button>
        </div>

        {/* App Info */}
        <div className="text-center pt-2 pb-4 text-xs text-slate-400 space-y-1">
          <div className="flex items-center justify-center gap-1 font-semibold text-slate-500">
            <Info className="w-3.5 h-3.5" />
            <span>Vườn Ươm — Sổ cây giống trên điện thoại</span>
          </div>
          <div>Bản thử nghiệm xác thực hành vi người dùng (PWA)</div>
          <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-center gap-2">
            <span>Giấy phép: <strong>AGPL-3.0</strong></span>
            <span>•</span>
            <a
              href="https://github.com/17thedevv/VuonUomSo"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-700 hover:underline font-medium"
            >
              Mã nguồn (Source)
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
