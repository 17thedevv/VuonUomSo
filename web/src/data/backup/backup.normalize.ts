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

  // Check if it's already a modern versioned backup
  if (obj.format === BACKUP_FORMAT && obj.formatVersion === 1 && typeof obj.data === 'object' && obj.data !== null) {
    const dataObj = obj.data as Record<string, unknown>
    const orgs = (Array.isArray(dataObj.organizations) ? dataObj.organizations : []) as Organization[]
    const settings = (Array.isArray(dataObj.settings) ? dataObj.settings : []) as AppSetting[]
    const contacts = (Array.isArray(dataObj.contacts) ? dataObj.contacts : []) as Contact[]
    const batches = (Array.isArray(dataObj.batches) ? dataObj.batches : []) as Batch[]
    const orders = (Array.isArray(dataObj.orders) ? dataObj.orders : []) as Order[]
    const reservations = (Array.isArray(dataObj.reservations) ? dataObj.reservations : []) as Reservation[]
    const shipments = (Array.isArray(dataObj.shipments) ? dataObj.shipments : []) as Shipment[]
    const dossiers = (Array.isArray(dataObj.dossiers) ? dataObj.dossiers : []) as BatchDossier[]
    const events = (Array.isArray(dataObj.events) ? dataObj.events : []) as DomainEvent[]

    return {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
      appVersion: typeof obj.appVersion === 'string' ? obj.appVersion : undefined,
      dbSchemaVersion: typeof obj.dbSchemaVersion === 'number' ? obj.dbSchemaVersion : 4,
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

  // Check if future version
  if (obj.format === BACKUP_FORMAT && typeof obj.formatVersion === 'number' && obj.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error('Bản sao này được tạo bởi phiên bản Vườn Ươm mới hơn. Hãy cập nhật ứng dụng trước khi khôi phục.')
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
    const org = obj.organization as Organization
    organizations.push(org)
    settings.push({ key: 'currentOrganizationId', value: org.id })
  } else if (Array.isArray(obj.organizations)) {
    for (const org of obj.organizations) {
      if (org && typeof org === 'object' && 'id' in org) {
        organizations.push(org as Organization)
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
