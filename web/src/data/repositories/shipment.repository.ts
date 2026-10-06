import type { Shipment } from '../../domain/shipment'
import { db, type VuonUomDatabase } from '../db'

export interface ShipmentRepository {
  getAll(): Promise<Shipment[]>
  getById(id: string): Promise<Shipment | null>
  getByOrderId(orderId: string): Promise<Shipment[]>
  save(shipment: Shipment): Promise<void>
  saveMany(shipments: Shipment[]): Promise<void>
  clear(): Promise<void>
}

export class DexieShipmentRepository implements ShipmentRepository {
  constructor(private readonly database: VuonUomDatabase = db) {}

  async getAll(): Promise<Shipment[]> {
    return this.database.shipments.toArray()
  }

  async getById(id: string): Promise<Shipment | null> {
    const item = await this.database.shipments.get(id)
    return item ?? null
  }

  async getByOrderId(orderId: string): Promise<Shipment[]> {
    return this.database.shipments.where('orderId').equals(orderId).toArray()
  }

  async save(shipment: Shipment): Promise<void> {
    await this.database.shipments.put(shipment)
  }

  async saveMany(shipments: Shipment[]): Promise<void> {
    await this.database.shipments.bulkPut(shipments)
  }

  async clear(): Promise<void> {
    await this.database.shipments.clear()
  }
}

export const shipmentRepository = new DexieShipmentRepository()
