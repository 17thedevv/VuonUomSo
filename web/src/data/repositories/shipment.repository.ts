import type { Shipment, ShipmentStatus } from '../../domain/shipment'
import { db, type VuonUomDatabase } from '../db'

export interface ShipmentRepository {
  getAll(): Promise<Shipment[]>
  getById(id: string): Promise<Shipment | null>
  getByOrderId(orderId: string): Promise<Shipment[]>
  getByStatus(status: ShipmentStatus): Promise<Shipment[]>
  save(shipment: Shipment): Promise<void>
  saveMany(shipments: Shipment[]): Promise<void>
  delete(id: string): Promise<void>
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

  async getByStatus(status: ShipmentStatus): Promise<Shipment[]> {
    return this.database.shipments.where('status').equals(status).toArray()
  }

  async save(shipment: Shipment): Promise<void> {
    await this.database.shipments.put(shipment)
  }

  async saveMany(shipments: Shipment[]): Promise<void> {
    await this.database.shipments.bulkPut(shipments)
  }

  async delete(id: string): Promise<void> {
    await this.database.shipments.delete(id)
  }

  async clear(): Promise<void> {
    await this.database.shipments.clear()
  }
}

export const shipmentRepository = new DexieShipmentRepository()
