import type { VuonUomBackupV1 } from './backup.types'
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION } from './backup.types'
import type { Organization } from '../../domain/organization'
import type { AppSetting } from '../db'
import type { Contact } from '../../domain/contact'
import type { Batch } from '../../domain/batch'
import type { Order } from '../../domain/order'
import type { Reservation } from '../../domain/reservation'
import type { Shipment } from '../../domain/shipment'
import type { BatchDossier } from '../../domain/dossier'
import type { DomainEvent } from '../../analytics/events'

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
      recordCounts: {
        organizations: orgs.length,
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

  // Normalize legacy organization
  const organizations: Organization[] = []
  const settings: AppSetting[] = []

  if (obj.organization && typeof obj.organization === 'object' && 'id' in (obj.organization as object)) {
    const rawOrg = obj.organization as Record<string, unknown>
    const org: Organization = {
      id: String(rawOrg.id),
      name: String(rawOrg.name || 'Vườn Ươm'),
      capabilities: Array.isArray(rawOrg.capabilities)
        ? (rawOrg.capabilities as any)
        : ['produce', 'sell']
    }
    organizations.push(org)
    settings.push({ key: 'currentOrganizationId', value: org.id })
  } else if (Array.isArray(obj.organizations)) {
    for (const rawOrg of obj.organizations) {
      if (rawOrg && typeof rawOrg === 'object' && 'id' in rawOrg) {
        const o = rawOrg as Record<string, unknown>
        organizations.push({
          id: String(o.id),
          name: String(o.name || 'Vườn Ươm'),
          capabilities: Array.isArray(o.capabilities)
            ? (o.capabilities as any)
            : ['produce', 'sell']
        })
      }
    }
  }

  if (Array.isArray(obj.settings)) {
    for (const s of obj.settings) {
      if (s && typeof s === 'object' && 'key' in s && 'value' in s) {
        if (!settings.some((existing) => existing.key === s.key)) {
          settings.push(s as AppSetting)
        }
      }
    }
  }

  // Ensure single legacy organization gets currentOrganizationId setting if missing
  if (organizations.length === 1 && !settings.some((s) => s.key === 'currentOrganizationId')) {
    settings.push({ key: 'currentOrganizationId', value: organizations[0].id })
  }

  const contacts = (Array.isArray(obj.contacts) ? obj.contacts : []) as Contact[]
  const batches = (Array.isArray(obj.batches) ? obj.batches : []) as Batch[]
  const orders = (Array.isArray(obj.orders) ? obj.orders : []) as Order[]

  // Normalize legacy reservations: backfill fulfilledQuantity
  const rawReservations = Array.isArray(obj.reservations) ? obj.reservations : []
  const reservations: Reservation[] = rawReservations.map((r: Record<string, unknown>) => {
    const fulfilledQuantity =
      typeof r.fulfilledQuantity === 'number'
        ? r.fulfilledQuantity
        : r.status === 'fulfilled'
        ? (Number(r.quantity) || 0)
        : 0

    return {
      ...(r as unknown as Reservation),
      fulfilledQuantity
    }
  })

  // Normalize legacy shipments: backfill lines, plannedQuantity, createdAt
  const rawShipments = Array.isArray(obj.shipments) ? obj.shipments : []
  const shipments: Shipment[] = rawShipments.map((s: Record<string, unknown>) => {
    const shippedQty = Number(s.shippedQuantity) || 0
    return {
      ...(s as unknown as Shipment),
      lines: Array.isArray(s.lines) ? s.lines : [],
      plannedQuantity: typeof s.plannedQuantity === 'number' ? s.plannedQuantity : shippedQty,
      createdAt: typeof s.createdAt === 'string' ? s.createdAt : (typeof s.shippedAt === 'string' ? s.shippedAt : new Date().toISOString())
    }
  })

  // Normalize dossiers: legacy had none
  const dossiers: BatchDossier[] = Array.isArray(obj.dossiers) ? (obj.dossiers as BatchDossier[]) : []
  const events: DomainEvent[] = Array.isArray(obj.events) ? (obj.events as DomainEvent[]) : []

  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
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
