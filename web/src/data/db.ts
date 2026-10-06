import Dexie, { type EntityTable } from 'dexie'
import type { Organization } from '../domain/organization'
import type { Batch } from '../domain/batch'
import type { Contact } from '../domain/contact'
import type { Order } from '../domain/order'
import type { Reservation } from '../domain/reservation'
import type { Shipment } from '../domain/shipment'
import type { BatchDossier } from '../domain/dossier'
import type { DomainEvent } from '../analytics/events'

export interface AppSetting {
  key: string
  value: string
}

export class VuonUomDatabase extends Dexie {
  organizations!: EntityTable<Organization, 'id'>
  settings!: EntityTable<AppSetting, 'key'>
  contacts!: EntityTable<Contact, 'id'>
  batches!: EntityTable<Batch, 'id'>
  orders!: EntityTable<Order, 'id'>
  reservations!: EntityTable<Reservation, 'id'>
  shipments!: EntityTable<Shipment, 'id'>
  dossiers!: EntityTable<BatchDossier, 'id'>
  events!: EntityTable<DomainEvent, 'id'>

  constructor(dbName = 'VuonUomDB') {
    super(dbName)
    this.version(1).stores({
      organizations: 'id, name',
      settings: 'key',
      contacts: 'id, name',
      batches: 'id, code, variety, status, createdAt',
      orders: 'id, customerId, status',
      reservations: 'id, orderId, batchId, status',
      shipments: 'id, orderId, status',
      events: 'id, type, entityType, entityId, createdAt'
    })

    this.version(2).stores({
      reservations: 'id, orderId, batchId, supplierId, status'
    })

    this.version(3)
      .stores({
        reservations: 'id, orderId, batchId, supplierId, status',
        shipments: 'id, orderId, status, plannedDate, shippedAt, createdAt'
      })
      .upgrade(async (tx) => {
        // Backfill fulfilledQuantity on reservations
        await tx.table('reservations').toCollection().modify((reservation: Record<string, unknown>) => {
          if (reservation.fulfilledQuantity === undefined) {
            reservation.fulfilledQuantity =
              reservation.status === 'fulfilled' ? (reservation.quantity ?? 0) : 0
          }
        })

        // Backfill lines, plannedQuantity, createdAt on shipments
        await tx.table('shipments').toCollection().modify((shipment: Record<string, unknown>) => {
          if (shipment.lines === undefined) {
            shipment.lines = []
          }
          if (shipment.plannedQuantity === undefined) {
            shipment.plannedQuantity = shipment.shippedQuantity ?? 0
          }
          if (shipment.createdAt === undefined) {
            shipment.createdAt = shipment.shippedAt ?? new Date().toISOString()
          }
        })
      })

    this.version(4).stores({
      dossiers: 'id, batchId, updatedAt'
    })
  }
}

export const db = new VuonUomDatabase()
