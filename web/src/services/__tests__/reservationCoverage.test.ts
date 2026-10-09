import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/db'
import { clearAllData } from '../../data/seed'
import { orderShortage, reservedQuantityForOrder } from '../../domain/order'
import { reserveOwnBatch, reserveExternalSupplier } from '../reservationService'
import { undoService } from '../undoService'

async function fixture(status: 'partially_shipped' | 'partially_reserved' = 'partially_shipped') {
  await db.contacts.bulkPut([
    { id: 'customer', name: 'Khách', roles: ['customer'] },
    { id: 'supplier', name: 'Nhà vườn', roles: ['supplier'] }
  ])
  await db.batches.put({
    id: 'batch', code: 'BV16 #1', variety: 'BV16', createdAt: '2026-10-08',
    initialQuantity: 80000, currentQuantity: 80000, readyQuantity: 60000, status: 'ready'
  })
  await db.orders.put({ id: 'order', customerId: 'customer', variety: 'BV16', requestedQuantity: 50000, status })
  await db.reservations.bulkPut([
    { id: 'released', orderId: 'order', sourceType: 'external_supplier', supplierId: 'supplier',
      quantity: 20000, fulfilledQuantity: 10000, status: 'released', createdAt: '2026-10-08' },
    { id: 'active', orderId: 'order', sourceType: 'own_batch', batchId: 'batch',
      quantity: 20000, fulfilledQuantity: 0, status: 'active', createdAt: '2026-10-08' }
  ])
  await db.shipments.put({
    id: 'completed', orderId: 'order', plannedQuantity: 10000, shippedQuantity: 10000,
    status: 'completed', shippedAt: '2026-10-08',
    lines: [{ reservationId: 'released', sourceType: 'external_supplier', supplierId: 'supplier', quantity: 10000 }]
  })
}

async function snapshot() {
  return {
    orders: await db.orders.toArray(), reservations: await db.reservations.toArray(),
    batches: await db.batches.toArray(), events: await db.events.toArray(), shipments: await db.shipments.toArray()
  }
}

function reserve(source: 'own' | 'external', quantity: number) {
  const params = {
    orderId: 'order', supplierId: 'supplier', quantity,
    confirmation: { acknowledged: true, supplierId: 'supplier', variety: 'BV16', quantity }
  }
  return source === 'own'
    ? reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity })
    : reserveExternalSupplier(params)
}

describe('FC4 Gate A: canonical released-F coverage in both creation paths (real Dexie)', () => {
  beforeEach(async () => { await clearAllData(); undoService.clearLastMutation() })

  for (const source of ['own', 'external'] as const) {
    it(`${source}: rejects 30k with true shortage20k without any partial write`, async () => {
      await fixture()
      const before = await snapshot()
      expect(reservedQuantityForOrder('order', before.reservations)).toBe(30000)
      expect(orderShortage(before.orders[0], before.reservations)).toBe(20000)
      await expect(reserve(source, 30000)).rejects.toThrow(/20.000/)
      expect(await snapshot()).toEqual(before)
      expect(undoService.getLastMutation()).toBeNull()
    })

    it(`${source}: accepts 20k, preserves partially_shipped/F/history and physical batches`, async () => {
      await fixture()
      const before = await snapshot()
      await reserve(source, 20000)
      const after = await snapshot()
      expect(reservedQuantityForOrder('order', after.reservations)).toBe(50000)
      expect(orderShortage(after.orders[0], after.reservations)).toBe(0)
      expect(after.orders[0].status).toBe('partially_shipped')
      expect(after.batches).toEqual(before.batches)
      expect(after.shipments).toEqual(before.shipments)
      expect(after.reservations.find(r => r.id === 'released')).toEqual(before.reservations.find(r => r.id === 'released'))
    })

    it(`${source}: recomputes a stored non-partially-shipped status from canonical post-coverage`, async () => {
      // Stale stored status must not reintroduce the old active-only coverage calculation.
      await fixture('partially_reserved')
      await reserve(source, 20000)
      expect((await db.orders.get('order'))?.status).toBe('reserved')
    })
  }
})
