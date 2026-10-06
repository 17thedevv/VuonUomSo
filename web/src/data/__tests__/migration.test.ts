import { describe, it, expect, afterEach } from 'vitest'
import Dexie from 'dexie'
import { VuonUomDatabase } from '../db'
import type { Batch } from '../../domain/batch'
import type { Order } from '../../domain/order'
import type { Reservation } from '../../domain/reservation'
import type { Shipment } from '../../domain/shipment'

describe('Database Schema Migration (v1 -> v2 -> v3)', () => {
  const testDbName = 'MigrationTestDB_' + Date.now()

  afterEach(async () => {
    await Dexie.delete(testDbName)
  })

  it('migrates from v1 to v3 without data loss and backfills fields', async () => {
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
      fulfilledQuantity: 0,
      status: 'active',
      createdAt: '2026-09-02T00:00:00.000Z'
    }

    await v1Db.table('batches').add(testBatch)
    await v1Db.table('orders').add(testOrder)
    await v1Db.table('reservations').add(testRes)

    // 3. Close v1 database
    v1Db.close()

    // 4. Open with VuonUomDatabase (which defines v1, v2, and v3)
    const appDb = new VuonUomDatabase(testDbName)
    await appDb.open()

    // Verify database version is now 4
    expect(appDb.verno).toBe(4)

    // 5. Verify existing data preserved
    const loadedBatch = await appDb.batches.get('batch_old')
    expect(loadedBatch?.code).toBe('KL-01')
    expect(loadedBatch?.currentQuantity).toBe(18000)

    const loadedOrder = await appDb.orders.get('order_old')
    expect(loadedOrder?.requestedQuantity).toBe(10000)

    const loadedRes = await appDb.reservations.get('res_old')
    expect(loadedRes?.quantity).toBe(5000)
    expect(loadedRes?.fulfilledQuantity).toBe(0)

    // 6. Test querying by supplierId using the v2-indexed field
    const supplierRes: Reservation = {
      id: 'res_supplier_01',
      orderId: 'order_old',
      sourceType: 'external_supplier',
      supplierId: 'supplier_thao',
      quantity: 3000,
      fulfilledQuantity: 0,
      status: 'active',
      createdAt: '2026-09-03T00:00:00.000Z'
    }
    await appDb.reservations.put(supplierRes)

    const queriedBySupplier = await appDb.reservations.where('supplierId').equals('supplier_thao').toArray()
    expect(queriedBySupplier.length).toBe(1)
    expect(queriedBySupplier[0].id).toBe('res_supplier_01')

    appDb.close()
  })

  it('migrates from v2 to v3 backfilling fulfilledQuantity and shipment lines', async () => {
    // 1. Create a pure v2 database instance simulating a user after Phase P3
    const v2Db = new Dexie(testDbName)
    v2Db.version(1).stores({
      organizations: 'id, name',
      settings: 'key',
      contacts: 'id, name',
      batches: 'id, code, variety, status, createdAt',
      orders: 'id, customerId, status',
      reservations: 'id, orderId, batchId, status',
      shipments: 'id, orderId, status',
      events: 'id, type, entityType, entityId, createdAt'
    })
    v2Db.version(2).stores({
      reservations: 'id, orderId, batchId, supplierId, status'
    })

    await v2Db.open()

    // Insert v2 records without fulfilledQuantity or shipment lines
    await v2Db.table('reservations').add({
      id: 'res_active_v2',
      orderId: 'order_1',
      sourceType: 'own_batch',
      batchId: 'batch_1',
      quantity: 10000,
      status: 'active',
      createdAt: '2026-09-01'
    })

    await v2Db.table('reservations').add({
      id: 'res_fulfilled_v2',
      orderId: 'order_2',
      sourceType: 'external_supplier',
      supplierId: 'sup_1',
      quantity: 15000,
      status: 'fulfilled',
      createdAt: '2026-09-01'
    })

    await v2Db.table('shipments').add({
      id: 'ship_legacy',
      orderId: 'order_2',
      shippedQuantity: 15000,
      status: 'completed',
      shippedAt: '2026-09-05'
    })

    v2Db.close()

    // 2. Open with VuonUomDatabase v3
    const appDb = new VuonUomDatabase(testDbName)
    await appDb.open()

    expect(appDb.verno).toBe(4)

    // Check backfilled fulfilledQuantity on reservations
    const resActive = await appDb.reservations.get('res_active_v2')
    expect(resActive?.fulfilledQuantity).toBe(0)

    const resFulfilled = await appDb.reservations.get('res_fulfilled_v2')
    expect(resFulfilled?.fulfilledQuantity).toBe(15000)

    // Check backfilled shipment fields
    const legacyShipment = await appDb.shipments.get('ship_legacy')
    expect(legacyShipment?.lines).toEqual([])
    expect(legacyShipment?.plannedQuantity).toBe(15000)
    expect(legacyShipment?.createdAt).toBe('2026-09-05')

    // Check querying shipments by status index
    const completedShipments = await appDb.shipments.where('status').equals('completed').toArray()
    expect(completedShipments.length).toBe(1)
    expect(completedShipments[0].id).toBe('ship_legacy')

    // Add a planned shipment and query by status
    const plannedShipment: Shipment = {
      id: 'ship_planned_1',
      orderId: 'order_1',
      lines: [
        {
          reservationId: 'res_active_v2',
          sourceType: 'own_batch',
          batchId: 'batch_1',
          quantity: 5000
        }
      ],
      plannedQuantity: 5000,
      shippedQuantity: 0,
      plannedDate: '2026-10-10',
      status: 'planned',
      createdAt: '2026-10-06'
    }
    await appDb.shipments.put(plannedShipment)

    const plannedList = await appDb.shipments.where('status').equals('planned').toArray()
    expect(plannedList.length).toBe(1)
    expect(plannedList[0].id).toBe('ship_planned_1')

    appDb.close()
  })

  it('migrates from v3 to v4 adding dossiers table while preserving all data', async () => {
    // 1. Create a pure v3 database instance simulating a user after Phase P4
    const v3Db = new Dexie(testDbName)
    v3Db.version(1).stores({
      organizations: 'id, name',
      settings: 'key',
      contacts: 'id, name',
      batches: 'id, code, variety, status, createdAt',
      orders: 'id, customerId, status',
      reservations: 'id, orderId, batchId, status',
      shipments: 'id, orderId, status',
      events: 'id, type, entityType, entityId, createdAt'
    })
    v3Db.version(2).stores({
      reservations: 'id, orderId, batchId, supplierId, status'
    })
    v3Db.version(3).stores({
      reservations: 'id, orderId, batchId, supplierId, status',
      shipments: 'id, orderId, status, plannedDate, shippedAt, createdAt'
    })

    await v3Db.open()

    // Insert v3 records
    await v3Db.table('batches').add({
      id: 'batch_p4',
      code: 'BV16 #10',
      variety: 'Keo lai BV16',
      initialQuantity: 10000,
      currentQuantity: 8000,
      readyQuantity: 7000,
      status: 'ready',
      createdAt: '2026-10-01'
    })

    await v3Db.table('orders').add({
      id: 'order_p4',
      customerId: 'cust_01',
      variety: 'Keo lai BV16',
      requestedQuantity: 5000,
      status: 'partially_shipped'
    })

    v3Db.close()

    // 2. Open with VuonUomDatabase v4
    const appDb = new VuonUomDatabase(testDbName)
    await appDb.open()

    expect(appDb.verno).toBe(4)

    // Check existing records preserved
    const batch = await appDb.batches.get('batch_p4')
    expect(batch?.code).toBe('BV16 #10')
    expect(batch?.currentQuantity).toBe(8000)

    const order = await appDb.orders.get('order_p4')
    expect(order?.status).toBe('partially_shipped')

    // 3. Test saving dossier and querying by batchId index
    await appDb.dossiers.put({
      id: 'dos_p4_01',
      batchId: 'batch_p4',
      materialType: 'cutting',
      sourceName: 'Vườn cây đầu dòng Ba Vì',
      sourceLocation: 'Hà Nội',
      documents: [
        {
          id: 'doc_1',
          title: 'Hồ sơ cây đầu dòng',
          number: 'BV16-01'
        }
      ],
      createdAt: '2026-10-06T10:00:00.000Z',
      updatedAt: '2026-10-06T10:00:00.000Z'
    })

    const foundDossier = await appDb.dossiers.where('batchId').equals('batch_p4').first()
    expect(foundDossier).not.toBeNull()
    expect(foundDossier?.id).toBe('dos_p4_01')
    expect(foundDossier?.materialType).toBe('cutting')
    expect(foundDossier?.sourceName).toBe('Vườn cây đầu dòng Ba Vì')
    expect(foundDossier?.documents.length).toBe(1)

    appDb.close()
  })
})
