import type { Contact } from '../../domain/contact'
import { arePhonesEqual } from '../../domain/phone'
import { db, type VuonUomDatabase } from '../db'

export interface ContactRepository {
  getAll(): Promise<Contact[]>
  getById(id: string): Promise<Contact | null>
  findByPhone(phone: string): Promise<Contact | null>
  save(contact: Contact): Promise<void>
  saveMany(contacts: Contact[]): Promise<void>
  delete(id: string): Promise<void>
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

  async findByPhone(phone: string): Promise<Contact | null> {
    if (!phone?.trim()) return null
    const all = await this.database.contacts.toArray()
    const match = all.find((c) => c.phone && arePhonesEqual(c.phone, phone))
    return match ?? null
  }

  async save(contact: Contact): Promise<void> {
    await this.database.contacts.put(contact)
  }

  async saveMany(contacts: Contact[]): Promise<void> {
    await this.database.contacts.bulkPut(contacts)
  }

  async delete(id: string): Promise<void> {
    await this.database.contacts.delete(id)
  }

  async clear(): Promise<void> {
    await this.database.contacts.clear()
  }
}

export const contactRepository = new DexieContactRepository()
