import { db } from '../db'
import type { VuonUomBackupV1, BackupPreviewData } from './backup.types'
import { normalizeBackup } from './backup.normalize'
import { validateBackup } from './backup.validate'

/**
 * Parses, normalizes, and validates a backup string to produce preview data safely.
 * Never executes mutation.
 */
export function parseAndPreviewBackup(jsonString: string): {
  success: boolean
  preview?: BackupPreviewData
  normalizedBackup?: VuonUomBackupV1
  error?: string
} {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch {
    return {
      success: false,
      error: 'File sao lưu không đúng định dạng JSON.'
    }
  }

  let normalized: VuonUomBackupV1
  try {
    normalized = normalizeBackup(parsed)
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Không thể chuẩn hóa bản sao lưu.'
    }
  }

  const valResult = validateBackup(normalized)
  if (!valResult.valid) {
    return {
      success: false,
      error: valResult.errors[0] || 'Dữ liệu trong bản sao lưu vi phạm quy tắc toàn vẹn.'
    }
  }

  const orgName = normalized.data.organizations[0]?.name || 'Vườn Ươm'

  const preview: BackupPreviewData = {
    exportedAt: normalized.exportedAt,
    organizationName: orgName,
    recordCounts: normalized.recordCounts,
    formatVersion: normalized.formatVersion
  }

  return {
    success: true,
    preview,
    normalizedBackup: normalized
  }
}

/**
 * Restores a backup string completely into local IndexedDB in a single atomic transaction.
 * Full replace semantics: clears current workspace and inserts backup data.
 * If anything fails, Dexie rolls back the entire transaction and preserves existing data.
 */
export async function restoreWorkspaceBackup(jsonString: string): Promise<{
  success: boolean
  preview: BackupPreviewData
}> {
  // 1. Full parse & validation before any DB mutation
  const parseResult = parseAndPreviewBackup(jsonString)
  if (!parseResult.success || !parseResult.normalizedBackup || !parseResult.preview) {
    throw new Error(parseResult.error || 'Dữ liệu bản sao lưu không hợp lệ.')
  }

  const backup = parseResult.normalizedBackup
  const { data } = backup

  // 2. Atomic full replace transaction across all 9 persistent stores
  await db.transaction(
    'rw',
    [
      db.organizations,
      db.settings,
      db.contacts,
      db.batches,
      db.orders,
      db.reservations,
      db.shipments,
      db.dossiers,
      db.events
    ],
    async () => {
      // Step A: Clear all tables
      await Promise.all([
        db.organizations.clear(),
        db.settings.clear(),
        db.contacts.clear(),
        db.batches.clear(),
        db.orders.clear(),
        db.reservations.clear(),
        db.shipments.clear(),
        db.dossiers.clear(),
        db.events.clear()
      ])

      // Step B: Bulk put restored historical records
      if (data.organizations.length > 0) await db.organizations.bulkPut(data.organizations)
      if (data.settings.length > 0) await db.settings.bulkPut(data.settings)
      if (data.contacts.length > 0) await db.contacts.bulkPut(data.contacts)
      if (data.batches.length > 0) await db.batches.bulkPut(data.batches)
      if (data.orders.length > 0) await db.orders.bulkPut(data.orders)
      if (data.reservations.length > 0) await db.reservations.bulkPut(data.reservations)
      if (data.shipments.length > 0) await db.shipments.bulkPut(data.shipments)
      if (data.dossiers.length > 0) await db.dossiers.bulkPut(data.dossiers)
      if (data.events.length > 0) await db.events.bulkPut(data.events)

      // Step C: Count verification inside transaction
      const [cOrg, cSet, cCon, cBat, cOrd, cRes, cShp, cDos, cEvt] = await Promise.all([
        db.organizations.count(),
        db.settings.count(),
        db.contacts.count(),
        db.batches.count(),
        db.orders.count(),
        db.reservations.count(),
        db.shipments.count(),
        db.dossiers.count(),
        db.events.count()
      ])

      if (
        cOrg !== data.organizations.length ||
        cSet !== data.settings.length ||
        cCon !== data.contacts.length ||
        cBat !== data.batches.length ||
        cOrd !== data.orders.length ||
        cRes !== data.reservations.length ||
        cShp !== data.shipments.length ||
        cDos !== data.dossiers.length ||
        cEvt !== data.events.length
      ) {
        throw new Error('Số lượng bản ghi khôi phục không khớp với bản sao lưu.')
      }
    }
  )

  return {
    success: true,
    preview: parseResult.preview
  }
}
