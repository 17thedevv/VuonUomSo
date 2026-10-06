import { db } from '../db'
import type { VuonUomBackupV1 } from './backup.types'
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION } from './backup.types'
import { validateBackup } from './backup.validate'

/**
 * Builds and validates a complete export of the local workspace.
 * Read-only: does NOT mutate business data or emit analytics events.
 */
export async function exportWorkspaceBackup(): Promise<{
  backup: VuonUomBackupV1
  jsonString: string
}> {
  const [
    organizations,
    settings,
    contacts,
    batches,
    orders,
    reservations,
    shipments,
    dossiers,
    events
  ] = await Promise.all([
    db.organizations.toArray(),
    db.settings.toArray(),
    db.contacts.toArray(),
    db.batches.toArray(),
    db.orders.toArray(),
    db.reservations.toArray(),
    db.shipments.toArray(),
    db.dossiers.toArray(),
    db.events.toArray()
  ])

  const backup: VuonUomBackupV1 = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    dbSchemaVersion: 4,
    recordCounts: {
      organizations: organizations.length,
      settings: settings.length,
      contacts: contacts.length,
      batches: batches.length,
      orders: orders.length,
      reservations: reservations.length,
      shipments: shipments.length,
      dossiers: dossiers.length,
      events: events.length
    },
    data: {
      organizations,
      settings,
      contacts,
      batches,
      orders,
      reservations,
      shipments,
      dossiers,
      events
    }
  }

  // Self-validation check
  const valResult = validateBackup(backup)
  if (!valResult.valid) {
    throw new Error(
      `Không thể tạo bản sao dữ liệu. Dữ liệu trên thiết bị chưa bị thay đổi. Lỗi: ${valResult.errors[0]}`
    )
  }

  const jsonString = JSON.stringify(backup, null, 2)

  // Verify serialization round-trip
  try {
    JSON.parse(jsonString)
  } catch {
    throw new Error('Lỗi mã hóa dữ liệu JSON khi tạo bản sao.')
  }

  return {
    backup,
    jsonString
  }
}

/**
 * Generates standardized predictable filename for backup.
 * Format: vuon-uom-backup-YYYY-MM-DD-HHmm.json
 */
export function generateBackupFilename(d = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')

  return `vuon-uom-backup-${year}-${month}-${day}-${hours}${minutes}.json`
}

/**
 * Initiates local file download in browser without any network upload.
 */
export function downloadBackupFile(jsonString: string, filename?: string): void {
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || generateBackupFilename()
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
