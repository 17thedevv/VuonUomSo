import type { Organization } from '../../domain/organization'
import { db, type VuonUomDatabase } from '../db'

export interface OrganizationRepository {
  getCurrent(): Promise<Organization | null>
  save(org: Organization): Promise<void>
  clear(): Promise<void>
}

export class DexieOrganizationRepository implements OrganizationRepository {
  constructor(private readonly database: VuonUomDatabase = db) {}

  async getCurrent(): Promise<Organization | null> {
    const list = await this.database.organizations.toArray()
    return list[0] ?? null
  }

  async save(org: Organization): Promise<void> {
    await this.database.organizations.put(org)
  }

  async clear(): Promise<void> {
    await this.database.organizations.clear()
  }
}

export const organizationRepository = new DexieOrganizationRepository()
