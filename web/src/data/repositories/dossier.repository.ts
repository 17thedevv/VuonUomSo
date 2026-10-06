import type { BatchDossier } from '../../domain/dossier'
import { db, type VuonUomDatabase } from '../db'

export interface DossierRepository {
  getAll(): Promise<BatchDossier[]>
  getById(id: string): Promise<BatchDossier | null>
  getByBatchId(batchId: string): Promise<BatchDossier | null>
  save(dossier: BatchDossier): Promise<void>
  delete(id: string): Promise<void>
  clear(): Promise<void>
}

export class DexieDossierRepository implements DossierRepository {
  constructor(private readonly database: VuonUomDatabase = db) {}

  async getAll(): Promise<BatchDossier[]> {
    return this.database.dossiers.toArray()
  }

  async getById(id: string): Promise<BatchDossier | null> {
    const item = await this.database.dossiers.get(id)
    return item ?? null
  }

  async getByBatchId(batchId: string): Promise<BatchDossier | null> {
    const item = await this.database.dossiers.where('batchId').equals(batchId).first()
    return item ?? null
  }

  async save(dossier: BatchDossier): Promise<void> {
    await this.database.dossiers.put(dossier)
  }

  async delete(id: string): Promise<void> {
    await this.database.dossiers.delete(id)
  }

  async clear(): Promise<void> {
    await this.database.dossiers.clear()
  }
}

export const dossierRepository = new DexieDossierRepository()
