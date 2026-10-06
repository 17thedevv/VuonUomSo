import { validationRepository } from './validation.repository'
import { buildValidationSummary } from './validationMetrics'
import type { VuonUomValidationExportV1 } from './validation.types'

export const VALIDATION_EXPORT_FORMAT = 'vuonuom-validation'
export const VALIDATION_EXPORT_FORMAT_VERSION = 1

/**
 * Validates the schema and privacy constraints of a validation export envelope.
 */
export function validateValidationExport(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Dữ liệu xuất không phải là đối tượng hợp lệ.'] }
  }

  const obj = data as Record<string, unknown>

  if (obj.format !== VALIDATION_EXPORT_FORMAT) {
    errors.push(`Định dạng không hợp lệ: kỳ vọng '${VALIDATION_EXPORT_FORMAT}', nhận '${String(obj.format)}'`)
  }

  if (obj.formatVersion !== VALIDATION_EXPORT_FORMAT_VERSION) {
    errors.push(`Phiên bản định dạng không hỗ trợ: ${String(obj.formatVersion)}`)
  }

  if (typeof obj.exportedAt !== 'string' || Number.isNaN(Date.parse(obj.exportedAt))) {
    errors.push('Thời điểm xuất (exportedAt) không phải là chuỗi ngày giờ ISO hợp lệ.')
  }

  // Ensure zero business tables are leaked into validation export
  const FORBIDDEN_BUSINESS_KEYS = [
    'batches',
    'orders',
    'contacts',
    'reservations',
    'shipments',
    'dossiers',
    'organizations'
  ]
  for (const key of FORBIDDEN_BUSINESS_KEYS) {
    if (key in obj) {
      errors.push(`Vi phạm ranh giới dữ liệu: export chứa khóa dữ liệu nghiệp vụ '${key}'.`)
    }
  }

  if (!Array.isArray(obj.sessions)) {
    errors.push('Danh sách phiên (sessions) phải là mảng.')
  } else {
    for (const session of obj.sessions) {
      if (!session || typeof session !== 'object') {
        errors.push('Phiên thử nghiệm không hợp lệ.')
        continue
      }
      const s = session as Record<string, unknown>
      if (typeof s.participantCode !== 'string' || !s.participantCode.trim()) {
        errors.push('Mã người tham gia (participantCode) không được rỗng.')
      } else if (s.participantCode.includes('@')) {
        errors.push('Vi phạm ranh giới ẩn danh: mã người tham gia chứa ký tự email.')
      }
    }
  }

  if (!Array.isArray(obj.events)) {
    errors.push('Danh sách sự kiện (events) phải là mảng.')
  }

  if (!obj.summary || typeof obj.summary !== 'object') {
    errors.push('Báo cáo tổng hợp (summary) không hợp lệ.')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Builds a validated, read-only validation export envelope.
 * Strictly guarantees ZERO business records (batches, orders, contacts, etc.) are included.
 */
export async function buildValidationExportData(options?: {
  includeDemo?: boolean
}): Promise<{
  exportData: VuonUomValidationExportV1
  jsonString: string
}> {
  const [sessions, events] = await Promise.all([
    validationRepository.getAllPilotSessions(),
    validationRepository.getAllValidationEvents()
  ])

  const summary = buildValidationSummary(sessions, events, options)

  const exportData: VuonUomValidationExportV1 = {
    format: VALIDATION_EXPORT_FORMAT,
    formatVersion: VALIDATION_EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    summary,
    sessions,
    events
  }

  const validation = validateValidationExport(exportData)
  if (!validation.valid) {
    throw new Error(`Dữ liệu xuất thử nghiệm không hợp lệ: ${validation.errors.join('; ')}`)
  }

  const jsonString = JSON.stringify(exportData, null, 2)

  // Verify round-trip parseability
  try {
    JSON.parse(jsonString)
  } catch {
    throw new Error('Lỗi mã hóa dữ liệu JSON khi tạo tệp xuất thử nghiệm.')
  }

  return {
    exportData,
    jsonString
  }
}

/**
 * Generates standardized predictable filename for validation export.
 * Format: vuon-uom-validation-YYYY-MM-DD-HHmm.json
 */
export function generateValidationExportFilename(d = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')

  return `vuon-uom-validation-${year}-${month}-${day}-${hours}${minutes}.json`
}

/**
 * Triggers browser file download without any network upload.
 */
export function downloadValidationExportFile(jsonString: string, filename?: string): void {
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || generateValidationExportFilename()
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Exports validation telemetry and triggers download in browser.
 */
export async function exportValidationData(options?: {
  includeDemo?: boolean
}): Promise<{
  filename: string
  exportData: VuonUomValidationExportV1
}> {
  const { exportData, jsonString } = await buildValidationExportData(options)
  const filename = generateValidationExportFilename()
  downloadValidationExportFile(jsonString, filename)
  return { filename, exportData }
}
