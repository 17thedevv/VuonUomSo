import { describe, it, expect, afterEach } from 'vitest'
import Dexie from 'dexie'
import { VuonUomDatabase } from '../db'
import type { Batch } from '../../domain/batch'
import type { Order } from '../../domain/order'
import type { Reservation } from '../../domain/reservation'

describe('Database Schema Migration (v1 -> v2)', () => {
  const testDbName = 'MigrationTestDB_' + Date.now()

  afterEach(async () => {
    await Dexie.delete(testDbName)
  })

  it('migrates from v1 to v2 without data loss and creates supplierId index', async () => {
    // 1. Create a pure v1 database instance simulating a user from Phase P0-P2
    const v1Db = new Dexie(testDbName)
    v1Db.version(1).stores({
      organizations: 'id, name',
      settings: 'key',
      contacts: 'id, name',
      batches: 'id, code, variety, status, createdAt',
      orders: 'id, customerId, status',
      reservations: 'id, orderId, batchId, status',
      shipments: 'id, orderId, status',
      events: 'id, type, entityType, entityId, createdAt'
    })

    await v1Db.open()

    // 2. Insert existing data in v1
    const testBatch: Batch = {
      id: 'batch_old',
      code: 'KL-01',
      variety: 'Keo lai BV16',
      createdAt: '2026-09-01T00:00:00.000Z',
      initialQuantity: 20000,
      currentQuantity: 18000,
      readyQuantity: 15000,
      status: 'ready'
    }
    const testOrder: Order = {
      id: 'order_old',
      customerId: 'cust_01',
      variety: 'Keo lai BV16',
      requestedQuantity: 10000,
      status: 'open'
    }
    const testRes: Reservation = {
      id: 'res_old',
      orderId: 'order_old',
      sourceType: 'own_batch',
      batchId: 'batch_old',
      quantity: 5000,
      status: 'active',
      createdAt: '2026-09-02T00:00:00.000Z'
    }

    await v1Db.table('batches').add(testBatch)
    await v1Db.table('orders').add(testOrder)
    await v1Db.table('reservations').add(testRes)

    // 3. Close v1 database
    v1Db.close()

    // 4. Open with VuonUomDatabase (which defines v1 and v2)
    const appDb = new VuonUomDatabase(testDbName)
    await appDb.open()

    // Verify database version is now 2
    expect(appDb.verno).toBe(2)

    // 5. Verify existing data preserved
    const loadedBatch = await appDb.batches.get('batch_old')
    expect(loadedBatch?.code).toBe('KL-01')
    expect(loadedBatch?.currentQuantity).toBe(18000)

    const loadedOrder = await appDb.orders.get('order_old')
    expect(loadedOrder?.requestedQuantity).toBe(10000)

    const loadedRes = await appDb.reservations.get('res_old')
    expect(loadedRes?.quantity).toBe(5000)

    // 6. Test querying by supplierId using the newly indexed field
    const supplierRes: Reservation = {
      id: 'res_supplier_01',
      orderId: 'order_old',
      sourceType: 'external_supplier',
      supplierId: 'supplier_thao',
      quantity: 3000,
      status: 'active',
      createdAt: '2026-09-03T00:00:00.000Z'
    }
    await appDb.reservations.put(supplierRes)

    const queriedBySupplier = await appDb.reservations.where('supplierId').equals('supplier_thao').toArray()
    expect(queriedBySupplier.length).toBe(1)
    expect(queriedBySupplier[0].id).toBe('res_supplier_01')
    expect(queriedBySupplier[0].quantity).toBe(3000)

    appDb.close()
  })
})
