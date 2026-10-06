import type { Batch } from '../../domain/batch'
import { db, type VuonUomDatabase } from '../db'

export interface BatchRepository {
  getAll(): Promise<Batch[]>
  getById(id: string): Promise<Batch | null>
  save(batch: Batch): Promise<void>
  saveMany(batches: Batch[]): Promise<void>
  delete(id: string): Promise<void>
  clear(): Promise<void>
}

export class DexieBatchRepository implements BatchRepository {
  constructor(private readonly database: VuonUomDatabase = db) {}

  async getAll(): Promise<Batch[]> {
    return this.database.batches.toArray()
  }

  async getById(id: string): Promise<Batch | null> {
    const item = await this.database.batches.get(id)
    return item ?? null
  }

  async save(batch: Batch): Promise<void> {
    await this.database.batches.put(batch)
  }

  async saveMany(batches: Batch[]): Promise<void> {
    await this.database.batches.bulkPut(batches)
  }

  async delete(id: string): Promise<void> {
    await this.database.batches.delete(id)
  }

  async clear(): Promise<void> {
    await this.database.batches.clear()
  }
}

export const batchRepository = new DexieBatchRepository()
