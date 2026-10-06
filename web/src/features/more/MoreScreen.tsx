import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RotateCcw,
  Trash2,
  Download,
  Upload,
  CheckCircle,
  Info,
  ShieldCheck,
  Truck,
  AlertTriangle
} from 'lucide-react'
import { resetDemoData, clearAllData } from '../../data/seed'
import {
  exportWorkspaceBackup,
  downloadBackupFile,
  generateBackupFilename,
  parseAndPreviewBackup,
  restoreWorkspaceBackup,
  type BackupPreviewData
} from '../../data/backup'
import { settingsRepository, organizationRepository } from '../../data/repositories'
import { PageHeader } from '../../shared/components/PageHeader'
import { PrimaryButton } from '../../shared/components/PrimaryButton'
import { SecondaryButton } from '../../shared/components/SecondaryButton'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear()
  const hours = d.getHours().toString().padStart(2, '0')
  const minutes = d.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes} ngày ${day}/${month}/${year}`
}

export const MoreScreen: React.FC = () => {
  const navigate = useNavigate()
  const [mode, setMode] = useState<string>('pilot')
  const [orgName, setOrgName] = useState<string>('')
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Restore state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [backupJsonString, setBackupJsonString] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<BackupPreviewData | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)

  const loadInfo = async () => {
    const currentMode = await settingsRepository.get('app_mode')
    const currentOrg = await organizationRepository.getCurrent()
    setMode(currentMode || 'pilot')
    setOrgName(currentOrg?.name || 'Chưa thiết lập')
  }

  useEffect(() => {
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
    setIsProcessing(true)
    try {
      const { jsonString } = await exportWorkspaceBackup()
      const filename = generateBackupFilename()
      downloadBackupFile(jsonString, filename)
      setStatusMsg(`Đã tải tệp sao lưu về máy (${filename}).`)
    } catch (err) {
      console.error(err)
      setStatusMsg(err instanceof Error ? err.message : 'Không thể xuất dữ liệu.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExportSafetyBackup = async () => {
    try {
      const { jsonString } = await exportWorkspaceBackup()
      const filename = `vuon-uom-phong-ngua-${generateBackupFilename()}`
      downloadBackupFile(jsonString, filename)
      setStatusMsg(`Đã tải bản sao lưu phòng ngừa (${filename}).`)
    } catch (err) {
      console.error(err)
      setStatusMsg('Không thể xuất bản sao phòng ngừa.')
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRestoreError(null)
    setSelectedFileName(file.name)
    try {
      const text = await file.text()
      const result = parseAndPreviewBackup(text)
      if (!result.success || !result.preview) {
        setRestoreError(result.error || 'Tệp sao lưu không hợp lệ.')
        setPreviewData(null)
        setBackupJsonString(null)
      } else {
        setPreviewData(result.preview)
        setBackupJsonString(text)
      }
    } catch (err) {
      console.error(err)
      setRestoreError('Không thể đọc tệp sao lưu.')
      setPreviewData(null)
      setBackupJsonString(null)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleCancelRestore = () => {
    setSelectedFileName(null)
    setBackupJsonString(null)
    setPreviewData(null)
    setRestoreError(null)
  }

  const handleConfirmRestore = async () => {
    if (!backupJsonString) return
    setIsRestoring(true)
    setRestoreError(null)
    try {
      await restoreWorkspaceBackup(backupJsonString)
      setStatusMsg('Đã khôi phục dữ liệu thành công!')
      setSelectedFileName(null)
      setBackupJsonString(null)
      setPreviewData(null)
      await loadInfo()
      setTimeout(() => {
        navigate('/today')
      }, 1000)
    } catch (err) {
      console.error(err)
      setRestoreError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi khôi phục dữ liệu.')
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <PageHeader title="Thêm" subtitle="Cài đặt & Quản lý dữ liệu" />

      <div className="p-4 space-y-4 max-w-xl mx-auto w-full pb-16">
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

        {/* Navigation to Shipments */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-700" />
            Sổ Chuyến giao xe
          </h2>
          <p className="text-xs text-slate-500">
            Xem danh sách các chuyến xe giao cây, bốc xuất vườn và quản lý trạng thái giao hàng.
          </p>
          <SecondaryButton fullWidth onClick={() => navigate('/shipments')}>
            Mở sổ chuyến giao
          </SecondaryButton>
        </div>

        {/* Demo / Pilot Controls */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-emerald-700" />
            Dữ liệu thử nghiệm
          </h2>
          <p className="text-xs text-slate-500">
            Khôi phục bộ dữ liệu vườn mẫu (Keo lai BV16, AH1, Keo lá tràm BV523 và các đơn hàng) để trải nghiệm app.
          </p>
          <PrimaryButton onClick={handleResetDemo} disabled={isProcessing || isRestoring}>
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
            Xuất toàn bộ sổ cây, đơn hàng, chuyến giao và hồ sơ ra tệp JSON trên điện thoại của bạn.
          </p>

          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              <strong>Lưu ý bảo mật:</strong> File sao lưu có thể chứa tên và số điện thoại khách hàng/nhà cung cấp. Hãy lưu file ở nơi an toàn.
            </span>
          </div>

          <SecondaryButton
            fullWidth
            onClick={handleExportBackup}
            disabled={isProcessing || isRestoring}
          >
            Tải tệp sao lưu JSON
          </SecondaryButton>
        </div>

        {/* Local Restore */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-700" />
            Khôi phục dữ liệu
          </h2>
          <p className="text-xs text-slate-500">
            Nạp tệp sao lưu JSON đã lưu trước đó để phục hồi lại toàn bộ sổ dữ liệu trên thiết bị.
          </p>

          <input
            type="file"
            ref={fileInputRef}
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />

          {restoreError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Không thể đọc tệp sao lưu:</div>
                <div>{restoreError}</div>
              </div>
            </div>
          )}

          {!previewData ? (
            <SecondaryButton
              fullWidth
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing || isRestoring}
            >
              Chọn tệp sao lưu JSON
            </SecondaryButton>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Xem trước bản sao lưu
                </span>
                <span className="text-[11px] font-mono text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                  v{previewData.formatVersion}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cơ sở vườn:</span>
                  <span className="font-semibold text-slate-800">{previewData.organizationName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Thời điểm sao lưu:</span>
                  <span className="font-semibold text-slate-800">
                    {formatDateTime(previewData.exportedAt)}
                  </span>
                </div>
                {selectedFileName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tên tệp:</span>
                    <span className="font-mono text-[11px] text-slate-700 truncate max-w-[200px]">
                      {selectedFileName}
                    </span>
                  </div>
                )}
              </div>

              {/* Record breakdown */}
              <div className="border-t border-slate-200 pt-2">
                <div className="text-[11px] font-semibold text-slate-500 mb-1.5">Số lượng bản ghi:</div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="font-bold text-slate-800">{previewData.recordCounts.batches}</div>
                    <div className="text-[10px] text-slate-500">Lô cây</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="font-bold text-slate-800">{previewData.recordCounts.orders}</div>
                    <div className="text-[10px] text-slate-500">Đơn hàng</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="font-bold text-slate-800">{previewData.recordCounts.reservations}</div>
                    <div className="text-[10px] text-slate-500">Giữ cây</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="font-bold text-slate-800">{previewData.recordCounts.shipments}</div>
                    <div className="text-[10px] text-slate-500">Chuyến giao</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="font-bold text-slate-800">{previewData.recordCounts.dossiers}</div>
                    <div className="text-[10px] text-slate-500">Hồ sơ lô</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="font-bold text-slate-800">{previewData.recordCounts.contacts}</div>
                    <div className="text-[10px] text-slate-500">Liên hệ</div>
                  </div>
                </div>
              </div>

              {/* Destructive Warning */}
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Cảnh báo:</strong> Dữ liệu hiện có trên thiết bị sẽ được thay thế hoàn toàn. Việc này không thể hoàn tác bằng nút Hoàn tác.
                </span>
              </div>

              {/* Safety backup button */}
              <button
                type="button"
                onClick={handleExportSafetyBackup}
                disabled={isRestoring}
                className="w-full text-center text-xs text-emerald-700 font-semibold py-2 px-3 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Tải bản sao hiện tại phòng ngừa
              </button>

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCancelRestore}
                  disabled={isRestoring}
                  className="flex-1 min-h-[44px] py-2 px-3 border border-slate-300 text-slate-700 font-medium text-xs rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={isRestoring}
                  className="flex-1 min-h-[44px] py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isRestoring ? 'Đang khôi phục...' : 'Khôi phục dữ liệu'}
                </button>
              </div>
            </div>
          )}
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
            disabled={isProcessing || isRestoring}
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
