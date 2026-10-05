import type { Contact } from '../../domain/contact'
import { db, type VuonUomDatabase } from '../db'

export interface ContactRepository {
  getAll(): Promise<Contact[]>
  getById(id: string): Promise<Contact | null>
  save(contact: Contact): Promise<void>
  saveMany(contacts: Contact[]): Promise<void>
  clear(): Promise<void>
}

export class DexieContactRepository implements ContactRepository {
  constructor(private readonly database: VuonUomDatabase = db) {}

  async getAll(): Promise<Contact[]> {
    return this.database.contacts.toArray()
  }

  async getById(id: string): Promise<Contact | null> {
    const item = await this.database.contacts.get(id)
    return item ?? null
  }

  async save(contact: Contact): Promise<void> {
    await this.database.contacts.put(contact)
  }

  async saveMany(contacts: Contact[]): Promise<void> {
    await this.database.contacts.bulkPut(contacts)
  }

  async clear(): Promise<void> {
    await this.database.contacts.clear()
  }
}

export const contactRepository = new DexieContactRepository()
