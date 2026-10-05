import { db, type VuonUomDatabase } from '../db'

export interface SettingsRepository {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
  clear(): Promise<void>
}

export class DexieSettingsRepository implements SettingsRepository {
  constructor(private readonly database: VuonUomDatabase = db) {}

  async get(key: string): Promise<string | null> {
    const item = await this.database.settings.get(key)
    return item ? item.value : null
  }

  async set(key: string, value: string): Promise<void> {
    await this.database.settings.put({ key, value })
  }

  async remove(key: string): Promise<void> {
    await this.database.settings.delete(key)
  }

  async clear(): Promise<void> {
    await this.database.settings.clear()
  }
}

export const settingsRepository = new DexieSettingsRepository()
