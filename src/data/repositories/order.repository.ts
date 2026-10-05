import type { Order } from '../../domain/order'
import { db, type VuonUomDatabase } from '../db'

export interface OrderRepository {
  getAll(): Promise<Order[]>
  getById(id: string): Promise<Order | null>
  save(order: Order): Promise<void>
  saveMany(orders: Order[]): Promise<void>
  clear(): Promise<void>
}

export class DexieOrderRepository implements OrderRepository {
  constructor(private readonly database: VuonUomDatabase = db) {}

  async getAll(): Promise<Order[]> {
    return this.database.orders.toArray()
  }

  async getById(id: string): Promise<Order | null> {
    const item = await this.database.orders.get(id)
    return item ?? null
  }

  async save(order: Order): Promise<void> {
    await this.database.orders.put(order)
  }

  async saveMany(orders: Order[]): Promise<void> {
    await this.database.orders.bulkPut(orders)
  }

  async clear(): Promise<void> {
    await this.database.orders.clear()
  }
}

export const orderRepository = new DexieOrderRepository()
