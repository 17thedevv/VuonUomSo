import type { Organization } from '../../domain/organization'
import type { AppSetting } from '../db'
import type { Contact } from '../../domain/contact'
import type { Batch } from '../../domain/batch'
import type { Order } from '../../domain/order'
import type { Reservation } from '../../domain/reservation'
import type { Shipment } from '../../domain/shipment'
import type { BatchDossier } from '../../domain/dossier'
import type { DomainEvent } from '../../analytics/events'

export const BACKUP_FORMAT = 'vuonuom-backup' as const
export const BACKUP_FORMAT_VERSION = 1 as const

export interface BackupRecordCounts {
  organizations: number
  settings: number
  contacts: number
  batches: number
  orders: number
  reservations: number
  shipments: number
  dossiers: number
  events: number
}

export interface VuonUomBackupV1 {
  format: typeof BACKUP_FORMAT
  formatVersion: typeof BACKUP_FORMAT_VERSION
  exportedAt: string
  appVersion?: string
  dbSchemaVersion: number
  recordCounts: BackupRecordCounts
  data: {
    organizations: Organization[]
    settings: AppSetting[]
    contacts: Contact[]
    batches: Batch[]
    orders: Order[]
    reservations: Reservation[]
    shipments: Shipment[]
    dossiers: BatchDossier[]
    events: DomainEvent[]
  }
}

export interface BackupPreviewData {
  exportedAt: string
  organizationName: string
  recordCounts: BackupRecordCounts
  formatVersion: number
}

/**
 * Pre-P5 Legacy DatabaseBackup structure for normalization.
 */
export interface LegacyDatabaseBackup {
  version: number
  exportedAt: string
  organization?: unknown
  batches?: unknown[]
  contacts?: unknown[]
  orders?: unknown[]
  reservations?: unknown[]
  shipments?: unknown[]
  events?: unknown[]
}
