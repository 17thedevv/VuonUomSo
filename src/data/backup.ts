import {
  organizationRepository,
  batchRepository,
  contactRepository,
  orderRepository,
  reservationRepository,
  shipmentRepository,
  eventRepository
} from './repositories'

export interface DatabaseBackup {
  version: number
  exportedAt: string
  organization: unknown
  batches: unknown[]
  contacts: unknown[]
  orders: unknown[]
  reservations: unknown[]
  shipments: unknown[]
  events: unknown[]
}

/**
 * Exports all local data to a serializable JSON-compatible structure.
 */
export async function exportDatabaseToJson(): Promise<string> {
  const [organization, batches, contacts, orders, reservations, shipments, events] =
    await Promise.all([
      organizationRepository.getCurrent(),
      batchRepository.getAll(),
      contactRepository.getAll(),
      orderRepository.getAll(),
      reservationRepository.getAll(),
      shipmentRepository.getAll(),
      eventRepository.getAll()
    ])

  const backup: DatabaseBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    organization,
    batches,
    contacts,
    orders,
    reservations,
    shipments,
    events
  }

  return JSON.stringify(backup, null, 2)
}
