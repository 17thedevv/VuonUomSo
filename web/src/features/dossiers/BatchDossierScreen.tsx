import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  FileText,
  Printer,
  Edit3,
  Plus,
  Trash2,
  AlertTriangle,
  Clock,
  Phone,
  CheckCircle2,
  Building,
  Calendar,
  Layers,
  Info
} from 'lucide-react'
import {
  getBatchDossierDetail,
  saveBatchDossier,
  type BatchDossierDetail
} from '../../services/dossierService'
import { contactRepository, organizationRepository } from '../../data/repositories'
import type { Contact } from '../../domain/contact'
import type { Organization } from '../../domain/organization'
import {
  MATERIAL_TYPE_LABELS,
  DOSSIER_COMPLETENESS_LABELS,
  type PlantingMaterialType,
  type DossierDocumentRef
} from '../../domain/dossier'
import { formatQuantity } from '../../domain/quantity'
import { formatDate } from '../../domain/date'
import { PageHeader } from '../../shared/components/PageHeader'
import { PrimaryButton } from '../../shared/components/PrimaryButton'
import { SecondaryButton } from '../../shared/components/SecondaryButton'
import { EmptyState } from '../../shared/components/EmptyState'

export const BatchDossierScreen: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>()
  const navigate = useNavigate()

  const [detail, setDetail] = useState<BatchDossierDetail | null>(null)
  const [suppliers, setSuppliers] = useState<Contact[]>([])
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null)
  const [printDate] = useState(() => new Date().toLocaleDateString('vi-VN'))

  // Form state
  const [materialType, setMaterialType] = useState<PlantingMaterialType>('cutting')
  const [sourceName, setSourceName] = useState('')
  const [sourceLocation, setSourceLocation] = useState('')
  const [sourceLotCode, setSourceLotCode] = useState('')
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [receivedAt, setReceivedAt] = useState('')
  const [propagatedAt, setPropagatedAt] = useState('')
  const [documents, setDocuments] = useState<DossierDocumentRef[]>([])
  const [note, setNote] = useState('')

  const loadData = useCallback(async () => {
    if (!batchId) return
    try {
      setLoading(true)
      const [dData, allContacts, currentOrg] = await Promise.all([
        getBatchDossierDetail(batchId),
        contactRepository.getAll(),
        organizationRepository.getCurrent()
      ])

      if (!dData) {
        setDetail(null)
        setError('Không tìm thấy thông tin lô cây.')
        return
      }

      setDetail(dData)
      setSuppliers(allContacts.filter((c) => c.roles.includes('supplier')))
      setOrganization(currentOrg)
      setError(null)

      // Initialize form fields
      if (dData.dossier) {
        setMaterialType(dData.dossier.materialType)
        setSourceName(dData.dossier.sourceName || '')
        setSourceLocation(dData.dossier.sourceLocation || '')
        setSourceLotCode(dData.dossier.sourceLotCode || '')
        setSelectedSupplierId(dData.dossier.supplierContactId || '')
        setReceivedAt(dData.dossier.receivedAt || '')
        setPropagatedAt(dData.dossier.propagatedAt || '')
        setDocuments(
          dData.dossier.documents.length > 0
            ? dData.dossier.documents.map((d) => ({ ...d }))
            : []
        )
        setNote(dData.dossier.note || '')
        setIsEditing(false)
      } else {
        // First-time dossier: open directly in edit mode
        setIsEditing(true)
      }
    } catch (err) {
      console.error('Error loading dossier:', err)
      setError('Chưa tải được hồ sơ lô cây.')
    } finally {
      setLoading(false)
    }
  }, [batchId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAddDocument = () => {
    setDocuments((prev) => [
      ...prev,
      {
        id: `doc_draft_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: '',
        number: '',
        issuedBy: '',
        issuedAt: '',
        note: ''
      }
    ])
  }

  const handleUpdateDocument = (index: number, field: keyof DossierDocumentRef, value: string) => {
    setDocuments((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleRemoveDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const supId = e.target.value
    setSelectedSupplierId(supId)
    // If user selects supplier and sourceName is empty, default to supplier name
    if (supId && !sourceName.trim()) {
      const sup = suppliers.find((s) => s.id === supId)
      if (sup) setSourceName(sup.name)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!batchId) return

    setIsSaving(true)
    setSaveError(null)
    setSaveSuccessMsg(null)

    try {
      await saveBatchDossier({
        batchId,
        materialType,
        sourceName: sourceName.trim() || undefined,
        sourceLocation: sourceLocation.trim() || undefined,
        sourceLotCode: sourceLotCode.trim() || undefined,
        supplierContactId: selectedSupplierId || undefined,
        receivedAt: receivedAt || undefined,
        propagatedAt: propagatedAt || undefined,
        documents,
        note: note.trim() || undefined
      })

      setSaveSuccessMsg('Đã lưu hồ sơ lô cây thành công.')
      await loadData()
      setIsEditing(false)
    } catch (err) {
      console.error('Error saving dossier:', err)
      setSaveError(
        err instanceof Error ? err.message : 'Chưa lưu được hồ sơ. Thông tin bạn vừa nhập vẫn được giữ trên màn hình.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 space-y-2">
        <Clock className="w-6 h-6 animate-pulse text-emerald-600" />
        <span className="text-sm font-medium">Đang tải hồ sơ lô cây...</span>
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50">
        <PageHeader title="Hồ sơ lô cây" showBack backTo="/batches" />
        <div className="p-6 my-auto">
          <EmptyState
            title="Không tìm thấy lô cây"
            description={error || 'Lô cây không tồn tại trong hệ thống.'}
            actionText="Quay lại danh sách lô"
            onAction={() => navigate('/batches')}
            icon={AlertTriangle}
          />
        </div>
      </div>
    )
  }

  const { batch, dossier, supplierContact, completeness } = detail

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      {/* Header - Hidden on Print */}
      <div className="print:hidden">
        <PageHeader
          title="Hồ sơ lô cây"
          subtitle={`${batch.code} — ${batch.variety}`}
          showBack
          backTo={`/batches/${batch.id}`}
          rightAction={
            <div className="flex items-center gap-1.5">
              {!isEditing && (
                <button
                  type="button"
                  onClick={handlePrint}
                  aria-label="In hoặc lưu PDF"
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 active:bg-slate-100 flex items-center gap-1 min-h-[36px]"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden sm:inline">In / Lưu PDF</span>
                </button>
              )}
              {isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 active:bg-slate-100 min-h-[36px]"
                >
                  Hủy sửa
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  aria-label="Sửa hồ sơ"
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 active:bg-emerald-900 flex items-center gap-1 min-h-[36px]"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Sửa</span>
                </button>
              )}
            </div>
          }
        />
      </div>

      {/* Main Container */}
      <div className="p-4 max-w-2xl mx-auto w-full space-y-4 pb-16 print:p-0 print:max-w-none print:space-y-3">
        {/* Print Only Header */}
        <div className="hidden print:block border-b-2 border-slate-800 pb-3 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">
                HỒ SƠ LÔ CÂY
              </h1>
              <p className="text-xs font-bold uppercase text-slate-600 tracking-wider mt-0.5">
                BẢN LƯU NỘI BỘ
              </p>
              {organization && (
                <div className="text-xs font-semibold text-slate-800 mt-1">
                  Đơn vị: {organization.name}
                </div>
              )}
            </div>
            <div className="text-right text-[11px] text-slate-500">
              <div>Ngày in: {printDate}</div>
              <div>Mã hồ sơ: {dossier?.id || 'Chưa lưu'}</div>
            </div>
          </div>
        </div>

        {/* Success toast */}
        {saveSuccessMsg && !isEditing && (
          <div className="print:hidden bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Batch Summary Card (Authoritative Truth from Batch) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 print:border-slate-300 print:shadow-none print:p-3">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                LÔ CÂY TRONG VƯỜN
              </span>
              <h2 className="text-base font-black text-slate-900 leading-tight">
                {batch.code} — {batch.variety}
              </h2>
              <span className="text-xs text-slate-500 font-medium block mt-0.5">
                Ngày tạo lô: {formatDate(batch.createdAt)}
              </span>
            </div>

            <div className="print:hidden">
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  completeness === 'referenced'
                    ? 'bg-emerald-100 text-emerald-800'
                    : completeness === 'basic'
                    ? 'bg-sky-100 text-sky-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {DOSSIER_COMPLETENESS_LABELS[completeness]}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 print:border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Ban đầu</span>
              <span className="text-xs font-bold text-slate-800 block mt-0.5">
                {formatQuantity(batch.initialQuantity)}
              </span>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 print:border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Còn sống</span>
              <span className="text-xs font-bold text-slate-800 block mt-0.5">
                {formatQuantity(batch.currentQuantity)}
              </span>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 print:border-slate-200">
              <span className="text-[10px] text-emerald-700 uppercase font-bold block">Đủ bán</span>
              <span className="text-xs font-black text-emerald-800 block mt-0.5">
                {formatQuantity(batch.readyQuantity)}
              </span>
            </div>
          </div>
        </div>

        {/* Read Mode View */}
        {!isEditing && (
          <div className="space-y-4">
            {/* Vật liệu & Nguồn gốc */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 print:border-slate-300 print:shadow-none print:p-3">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-700" />
                <span>Vật liệu ban đầu & Nguồn giống</span>
              </h3>

              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2 flex justify-between items-center">
                  <span className="text-slate-500">Loại vật liệu nhân giống:</span>
                  <span className="font-bold text-slate-900">
                    {dossier ? MATERIAL_TYPE_LABELS[dossier.materialType] : 'Chưa ghi nhận'}
                  </span>
                </div>

                <div className="py-2 flex justify-between items-center">
                  <span className="text-slate-500">Nguồn / Nơi lấy vật liệu:</span>
                  <span className="font-semibold text-slate-800">
                    {dossier?.sourceName || <span className="text-slate-400 italic">Chưa ghi nhận</span>}
                  </span>
                </div>

                {dossier?.sourceLocation && (
                  <div className="py-2 flex justify-between items-center">
                    <span className="text-slate-500">Địa điểm nguồn:</span>
                    <span className="font-semibold text-slate-800">{dossier.sourceLocation}</span>
                  </div>
                )}

                <div className="py-2 flex justify-between items-center">
                  <span className="text-slate-500">Mã lô nguồn (nếu có):</span>
                  <span className="font-mono font-bold text-slate-900">
                    {dossier?.sourceLotCode || <span className="text-slate-400 italic font-sans">Chưa có</span>}
                  </span>
                </div>

                {supplierContact && (
                  <div className="py-2 flex justify-between items-center">
                    <span className="text-slate-500">Vườn liên kết cung cấp:</span>
                    <span className="font-bold text-emerald-800 flex items-center gap-1">
                      <span>{supplierContact.name}</span>
                      {supplierContact.phone && (
                        <a
                          href={`tel:${supplierContact.phone}`}
                          className="text-[11px] text-slate-400 hover:text-emerald-700 ml-1 print:hidden"
                        >
                          <Phone className="w-3 h-3 inline" />
                        </a>
                      )}
                    </span>
                  </div>
                )}

                {dossier?.receivedAt && (
                  <div className="py-2 flex justify-between items-center">
                    <span className="text-slate-500">Ngày nhận vật liệu:</span>
                    <span className="font-semibold text-slate-800">{formatDate(dossier.receivedAt)}</span>
                  </div>
                )}

                {dossier?.propagatedAt && (
                  <div className="py-2 flex justify-between items-center">
                    <span className="text-slate-500">Ngày bắt đầu nhân giống:</span>
                    <span className="font-semibold text-slate-800">{formatDate(dossier.propagatedAt)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Chứng từ tham chiếu */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 print:border-slate-300 print:shadow-none print:p-3">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-700" />
                <span>Chứng từ tham chiếu ({dossier?.documents.length || 0})</span>
              </h3>

              {!dossier || dossier.documents.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Chưa ghi nhận chứng từ tham chiếu nào.</p>
              ) : (
                <div className="space-y-2.5">
                  {dossier.documents.map((doc, idx) => (
                    <div
                      key={doc.id || idx}
                      className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5 print:bg-white print:border-slate-300"
                    >
                      <div className="flex justify-between items-start">
                        <div className="font-bold text-slate-900 text-sm">
                          {doc.title || `Chứng từ #${idx + 1}`}
                        </div>
                        {doc.number && (
                          <span className="px-2 py-0.5 bg-slate-200/80 text-slate-800 rounded font-mono text-[11px] font-bold">
                            Số: {doc.number}
                          </span>
                        )}
                      </div>

                      {doc.issuedBy && (
                        <div className="text-slate-600 flex items-center gap-1">
                          <Building className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Nơi cấp: {doc.issuedBy}</span>
                        </div>
                      )}

                      {doc.issuedAt && (
                        <div className="text-slate-600 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Ngày cấp: {formatDate(doc.issuedAt)}</span>
                        </div>
                      )}

                      {doc.note && (
                        <p className="text-slate-500 bg-white/70 p-2 rounded border border-slate-100 text-[11px] mt-1">
                          {doc.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ghi chú */}
            {dossier?.note && (
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1.5 print:border-slate-300 print:shadow-none print:p-3 text-xs">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Ghi chú:</span>
                <p className="text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-xl whitespace-pre-wrap">
                  {dossier.note}
                </p>
              </div>
            )}

            {/* Action buttons on mobile/desktop */}
            <div className="pt-2 flex gap-2 print:hidden">
              <SecondaryButton
                fullWidth
                onClick={() => setIsEditing(true)}
              >
                SỬA HỒ SƠ
              </SecondaryButton>
              <PrimaryButton
                fullWidth
                onClick={handlePrint}
              >
                IN / LƯU PDF
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* Edit Mode View */}
        {isEditing && (
          <form onSubmit={handleSave} className="space-y-4 print:hidden">
            {saveError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-900 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            {/* Section 1: Vật liệu ban đầu */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-700" />
                <span>Vật liệu ban đầu</span>
              </h3>

              <div className="space-y-3">
                <div>
                  <label htmlFor="materialType" className="block text-xs font-semibold text-slate-700 mb-1">
                    Loại vật liệu nhân giống <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="materialType"
                    value={materialType}
                    onChange={(e) => setMaterialType(e.target.value as PlantingMaterialType)}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                  >
                    <option value="cutting">Hom</option>
                    <option value="seed">Hạt giống</option>
                    <option value="tissue_culture">Cây mô</option>
                    <option value="seedling">Cây giống mua/nhận từ nguồn khác</option>
                    <option value="other">Khác</option>
                    <option value="unknown">Chưa rõ</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="sourceName" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nguồn / Nơi lấy vật liệu
                  </label>
                  <input
                    id="sourceName"
                    type="text"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="VD: Rừng giống Ba Vì, Vườn cây đầu dòng..."
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label htmlFor="sourceLotCode" className="block text-xs font-semibold text-slate-700 mb-1">
                    Mã lô nguồn (nếu có)
                  </label>
                  <input
                    id="sourceLotCode"
                    type="text"
                    value={sourceLotCode}
                    onChange={(e) => setSourceLotCode(e.target.value)}
                    placeholder="VD: BV16-2026-04, HG-12..."
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Thông tin thêm */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-emerald-700" />
                <span>Thông tin bổ sung</span>
              </h3>

              <div className="space-y-3">
                <div>
                  <label htmlFor="sourceLocation" className="block text-xs font-semibold text-slate-700 mb-1">
                    Địa điểm nguồn giống
                  </label>
                  <input
                    id="sourceLocation"
                    type="text"
                    value={sourceLocation}
                    onChange={(e) => setSourceLocation(e.target.value)}
                    placeholder="VD: Xã Ba Vì, Huyện Ba Vì, Hà Nội"
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>

                {suppliers.length > 0 && (
                  <div>
                    <label htmlFor="supplierContactId" className="block text-xs font-semibold text-slate-700 mb-1">
                      Nhà vườn liên kết cung cấp (tùy chọn)
                    </label>
                    <select
                      id="supplierContactId"
                      value={selectedSupplierId}
                      onChange={handleSupplierChange}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                    >
                      <option value="">-- Không chọn / Tự lấy nguồn --</option>
                      {suppliers.map((sup) => (
                        <option key={sup.id} value={sup.id}>
                          {sup.name} {sup.phone && `(${sup.phone})`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="receivedAt" className="block text-xs font-semibold text-slate-700 mb-1">
                      Ngày nhận giống
                    </label>
                    <input
                      id="receivedAt"
                      type="date"
                      value={receivedAt}
                      onChange={(e) => setReceivedAt(e.target.value)}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label htmlFor="propagatedAt" className="block text-xs font-semibold text-slate-700 mb-1">
                      Ngày cấy / ươm
                    </label>
                    <input
                      id="propagatedAt"
                      type="date"
                      value={propagatedAt}
                      onChange={(e) => setPropagatedAt(e.target.value)}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Chứng từ tham chiếu */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Chứng từ tham chiếu</span>
                </h3>
                <button
                  type="button"
                  onClick={handleAddDocument}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 active:text-emerald-900"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm chứng từ</span>
                </button>
              </div>

              {documents.length === 0 ? (
                <div className="p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                  Chưa có chứng từ nào. Bấm <strong>Thêm chứng từ</strong> để lưu số hiệu/phiếu nguồn giống.
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc, idx) => (
                    <div
                      key={doc.id || idx}
                      className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 space-y-2.5 relative"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Chứng từ #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDocument(idx)}
                          aria-label={`Xóa chứng từ ${idx + 1}`}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                            Tên chứng từ
                          </label>
                          <input
                            type="text"
                            value={doc.title || ''}
                            onChange={(e) => handleUpdateDocument(idx, 'title', e.target.value)}
                            placeholder="VD: Phiếu nguồn giống, Hóa đơn..."
                            className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:border-emerald-600 focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                            Số hiệu
                          </label>
                          <input
                            type="text"
                            value={doc.number || ''}
                            onChange={(e) => handleUpdateDocument(idx, 'number', e.target.value)}
                            placeholder="VD: 12/2026/GCN"
                            className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:border-emerald-600 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                            Nơi cấp / Phát hành
                          </label>
                          <input
                            type="text"
                            value={doc.issuedBy || ''}
                            onChange={(e) => handleUpdateDocument(idx, 'issuedBy', e.target.value)}
                            placeholder="VD: Chi cục Lâm nghiệp..."
                            className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:border-emerald-600 focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                            Ngày cấp
                          </label>
                          <input
                            type="date"
                            value={doc.issuedAt || ''}
                            onChange={(e) => handleUpdateDocument(idx, 'issuedAt', e.target.value)}
                            className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:border-emerald-600 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                          Ghi chú chứng từ
                        </label>
                        <input
                          type="text"
                          value={doc.note || ''}
                          onChange={(e) => handleUpdateDocument(idx, 'note', e.target.value)}
                          placeholder="VD: Bản sao lưu tại sổ số 2..."
                          className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:border-emerald-600 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 4: Ghi chú */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <label htmlFor="dossierNote" className="block text-xs font-semibold text-slate-700">
                Ghi chú nội bộ
              </label>
              <textarea
                id="dossierNote"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú thêm về điều kiện ươm giống, tỷ lệ nảy mầm..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-emerald-600 focus:outline-hidden resize-none"
              />
            </div>

            {/* Form Action Buttons */}
            <div className="pt-2 flex gap-2">
              <SecondaryButton
                fullWidth
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
              >
                HỦY
              </SecondaryButton>
              <PrimaryButton
                fullWidth
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? 'ĐANG LƯU...' : 'LƯU HỒ SƠ'}
              </PrimaryButton>
            </div>
          </form>
        )}

        {/* Legal Disclaimer Footer */}
        <div className="p-3 bg-slate-100/80 rounded-xl text-center text-[11px] text-slate-500 leading-relaxed border border-slate-200/60 print:bg-transparent print:border-t print:border-b-0 print:border-x-0 print:border-slate-300 print:mt-6 print:pt-3">
          Hồ sơ này là bản lưu nội bộ trong Vườn Ươm. Không thay thế giấy tờ hoặc chứng nhận do cơ quan có thẩm quyền cấp.
        </div>
      </div>
    </div>
  )
}
