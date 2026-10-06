import { type DomainEvent, createDomainEvent } from '../../analytics/events'
import { db, type VuonUomDatabase } from '../db'

export interface EventRepository {
  record(event: Omit<DomainEvent, 'id' | 'createdAt'>): Promise<DomainEvent>
  getAll(): Promise<DomainEvent[]>
  getByEntityId(entityId: string): Promise<DomainEvent[]>
  clear(): Promise<void>
}

export class DexieEventRepository implements EventRepository {
  constructor(private readonly database: VuonUomDatabase = db) {}

  async record(params: Omit<DomainEvent, 'id' | 'createdAt'>): Promise<DomainEvent> {
    const event = createDomainEvent(params.type, params.entityType, params.entityId, params.payload)
    await this.database.events.put(event)
    return event
  }

  async getAll(): Promise<DomainEvent[]> {
    return this.database.events.orderBy('createdAt').reverse().toArray()
  }

  async getByEntityId(entityId: string): Promise<DomainEvent[]> {
    const all = await this.database.events.where('entityId').equals(entityId).toArray()
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async clear(): Promise<void> {
    await this.database.events.clear()
  }
}

export const eventRepository = new DexieEventRepository()
