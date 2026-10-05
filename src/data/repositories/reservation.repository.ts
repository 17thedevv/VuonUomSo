import type { Reservation } from '../../domain/reservation'
import { db, type VuonUomDatabase } from '../db'

export interface ReservationRepository {
  getAll(): Promise<Reservation[]>
  getByBatchId(batchId: string): Promise<Reservation[]>
  getByOrderId(orderId: string): Promise<Reservation[]>
  save(reservation: Reservation): Promise<void>
  saveMany(reservations: Reservation[]): Promise<void>
  clear(): Promise<void>
}

export class DexieReservationRepository implements ReservationRepository {
  constructor(private readonly database: VuonUomDatabase = db) {}

  async getAll(): Promise<Reservation[]> {
    return this.database.reservations.toArray()
  }

  async getById(id: string): Promise<Reservation | null> {
    const item = await this.database.reservations.get(id)
    return item ?? null
  }

  async getByBatchId(batchId: string): Promise<Reservation[]> {
    return this.database.reservations.where('batchId').equals(batchId).toArray()
  }

  async getByOrderId(orderId: string): Promise<Reservation[]> {
    return this.database.reservations.where('orderId').equals(orderId).toArray()
  }

  async save(reservation: Reservation): Promise<void> {
    await this.database.reservations.put(reservation)
  }

  async saveMany(reservations: Reservation[]): Promise<void> {
    await this.database.reservations.bulkPut(reservations)
  }

  async clear(): Promise<void> {
    await this.database.reservations.clear()
  }
}

export const reservationRepository = new DexieReservationRepository()
