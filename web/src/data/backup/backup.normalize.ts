import type { VuonUomBackupV1 } from './backup.types'
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION } from './backup.types'
import type { Organization, OrganizationCapability } from '../../domain/organization'
import type { AppSetting } from '../db'
import type { Contact } from '../../domain/contact'
import type { Batch } from '../../domain/batch'
import type { Order } from '../../domain/order'
import type { Reservation } from '../../domain/reservation'
import type { Shipment } from '../../domain/shipment'
import type { BatchDossier } from '../../domain/dossier'
import type { DomainEvent } from '../../analytics/events'

function normalizeCapabilities(raw: unknown): OrganizationCapability[] {
  // Only missing legacy facts are backfilled. Explicit invalid values must
  // reach validation, rather than being filtered/defaulted into valid records.
  return raw === undefined ? ['produce', 'sell'] : raw as OrganizationCapability[]
}

/**
 * Normalizes an untrusted parsed JSON object into the standard VuonUomBackupV1 format.
 * Supports:
 * 1. Native VuonUomBackupV1 format.
 * 2. Pre-P5 Legacy DatabaseBackup format (exported by P0-P4).
 */
export function normalizeBackup(raw: unknown): VuonUomBackupV1 {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Dữ liệu sao lưu không đúng định dạng JSON.')
  }

  const obj = raw as Record<string, unknown>

  // Check if future version
  if (obj.format === BACKUP_FORMAT && typeof obj.formatVersion === 'number' && obj.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error('Bản sao này được tạo bởi phiên bản Vườn Ươm mới hơn. Hãy cập nhật ứng dụng trước khi khôi phục.')
  }

  // Check if modern V1 versioned backup
  if (obj.format === BACKUP_FORMAT && obj.formatVersion === 1) {
    if (typeof obj.data !== 'object' || obj.data === null || Array.isArray(obj.data)) {
      throw new Error('Bản sao lưu V1 không hợp lệ: thiếu mục dữ liệu "data" hoặc sai định dạng.')
    }

    if (typeof obj.exportedAt !== 'string' || !obj.exportedAt.trim()) {
      throw new Error('Bản sao lưu V1 không hợp lệ: thiếu thời điểm xuất "exportedAt".')
    }

    if (typeof obj.dbSchemaVersion !== 'number') {
      throw new Error('Bản sao lưu V1 không hợp lệ: thiếu phiên bản cơ sở dữ liệu "dbSchemaVersion".')
    }

    const dataObj = obj.data as Record<string, unknown>
    const REQUIRED_TABLES = [
      'organizations',
      'settings',
      'contacts',
      'batches',
      'orders',
      'reservations',
      'shipments',
      'dossiers',
      'events'
    ] as const

    for (const table of REQUIRED_TABLES) {
      if (!Array.isArray(dataObj[table])) {
        throw new Error(`Bản sao lưu V1 không hợp lệ: bảng "${table}" phải là một danh sách (mảng).`)
      }
    }

    const orgs = dataObj.organizations as Organization[]
    const settings = dataObj.settings as AppSetting[]
    const contacts = dataObj.contacts as Contact[]
    const batches = dataObj.batches as Batch[]
    const orders = dataObj.orders as Order[]
    const reservations = dataObj.reservations as Reservation[]
    const shipments = dataObj.shipments as Shipment[]
    const dossiers = dataObj.dossiers as BatchDossier[]
    const events = dataObj.events as DomainEvent[]

    return {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: obj.exportedAt,
      appVersion: typeof obj.appVersion === 'string' ? obj.appVersion : undefined,
      dbSchemaVersion: obj.dbSchemaVersion,
      recordCounts: obj.recordCounts === undefined ? {
        organizations: orgs.length,
        settings: settings.length,
        contacts: contacts.length,
        batches: batches.length,
        orders: orders.length,
        reservations: reservations.length,
        shipments: shipments.length,
        dossiers: dossiers.length,
        events: events.length
      } : obj.recordCounts as VuonUomBackupV1['recordCounts'],
      data: {
        organizations: orgs,
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
  }

  if (obj.format === BACKUP_FORMAT) {
    throw new Error(`Phiên bản bản sao lưu không hợp lệ (formatVersion: ${String(obj.formatVersion)}).`)
  }

  // Detect Legacy DatabaseBackup (P0-P4 format)
  // Legacy format had: { version: number, exportedAt: string, organization: object, batches: [], ... }
  const isLegacyShape =
    (typeof obj.version === 'number' || !obj.format) &&
    (Array.isArray(obj.batches) || Array.isArray(obj.orders) || 'organization' in obj)

  if (!isLegacyShape) {
    throw new Error('File không phải bản sao lưu hợp lệ của Vườn Ươm.')
  }
  if (obj.format !== undefined) throw new Error('Định dạng bản sao lưu không hợp lệ.')

  const legacyTable = (name: string): unknown[] => {
    const value = obj[name]
    if (value === undefined) return []
    if (!Array.isArray(value)) throw new Error(`Bản sao lưu cũ: bảng "${name}" phải là mảng.`)
    return value
  }
  const legacyRecord = (value: unknown, context: string): Record<string, unknown> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`Bản sao lưu cũ: ${context} phải là một đối tượng.`)
    }
    return value as Record<string, unknown>
  }

  // Normalize legacy organization
  const organizations: Organization[] = []
  const settings: AppSetting[] = []

  const rawOrganizations = obj.organization === undefined ? legacyTable('organizations') : [obj.organization]
  for (const value of rawOrganizations) {
    const o = legacyRecord(value, 'cơ sở')
    organizations.push({
      ...(o as unknown as Organization),
      id: o.id as string,
      name: (o.name === undefined ? 'Vườn Ươm' : o.name) as string,
      capabilities: normalizeCapabilities(o.capabilities)
    })
  }

  for (const value of legacyTable('settings')) {
    settings.push(legacyRecord(value, 'cài đặt') as unknown as AppSetting)
  }

  // Ensure single legacy organization gets currentOrganizationId setting if missing
  if (organizations.length === 1 && !settings.some((s) => s.key === 'currentOrganizationId')) {
    settings.push({ key: 'currentOrganizationId', value: organizations[0].id })
  }

  const contacts = legacyTable('contacts') as Contact[]
  const batches = legacyTable('batches') as Batch[]
  const orders = legacyTable('orders') as Order[]

  // Normalize legacy reservations: backfill fulfilledQuantity
  const reservations: Reservation[] = legacyTable('reservations').map(value => {
    const r = legacyRecord(value, 'khoản giữ cây')
    const fulfilledQuantity =
      r.fulfilledQuantity !== undefined
        ? r.fulfilledQuantity
        : r.status === 'fulfilled'
        ? r.quantity
        : 0

    return {
      ...(r as unknown as Reservation),
      fulfilledQuantity: fulfilledQuantity as number
    }
  })

  // Normalize legacy shipments: backfill lines, plannedQuantity, createdAt
  const shipments: Shipment[] = legacyTable('shipments').map(value => {
    const s = legacyRecord(value, 'chuyến giao')
    return {
      ...(s as unknown as Shipment),
      lines: (s.lines === undefined ? [] : s.lines) as Shipment['lines'],
      plannedQuantity: (s.plannedQuantity === undefined ? s.shippedQuantity : s.plannedQuantity) as number,
      createdAt: (s.createdAt === undefined ? (s.shippedAt ?? new Date().toISOString()) : s.createdAt) as string
    }
  })

  // Normalize dossiers: legacy had none
  const dossiers = legacyTable('dossiers') as BatchDossier[]
  const events = legacyTable('events') as DomainEvent[]

  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: (obj.exportedAt === undefined ? new Date().toISOString() : obj.exportedAt) as string,
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
}
