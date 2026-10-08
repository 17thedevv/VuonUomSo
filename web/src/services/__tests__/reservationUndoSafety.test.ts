import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Dexie, { type Transaction } from 'dexie'
import { db } from '../../data/db'
import { clearAllData } from '../../data/seed'
import { createDomainEvent } from '../../analytics/events'
import { availableQuantityForBatch } from '../../domain/quantity'
import { reserveOwnBatch, reserveExternalSupplier } from '../reservationService'
import { createShipment, confirmShipment, cancelShipment } from '../shipmentService'
import { undoService } from '../undoService'
import { previewOrderReduction, reconcileOrderReduction } from '../reconciliationService'

describe('FC3-1A: reservation Undo commit safety (real Dexie)', () => {
  beforeEach(async () => {
    undoService.clearLastMutation()
    await clearAllData()
    await db.contacts.bulkPut([
      { id: 'customer', name: 'Khách', roles: ['customer'] },
      { id: 'supplier', name: 'Vườn ngoài', roles: ['supplier'] }
    ])
    await db.orders.put({ id: 'order', customerId: 'customer', variety: 'Keo', requestedQuantity: 20000, status: 'open' })
    await db.batches.put({ id: 'batch', code: 'K1', variety: 'Keo', initialQuantity: 30000,
      currentQuantity: 25000, readyQuantity: 20000, status: 'ready', createdAt: '2026-10-08' })
  })

  afterEach(() => {
    undoService.clearLastMutation()
    vi.restoreAllMocks()
  })

  async function reserve() {
    const { reservation } = await reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity: 10000 })
    const mutation = undoService.getLastMutation()!
    // Keep the captured intent alive while exercising intervening operations.
    undoService.recordMutation(mutation, 0)
    return { reservation, mutation }
  }

  async function state() {
    return { batches: await db.batches.toArray(), orders: await db.orders.toArray(),
      reservations: await db.reservations.toArray(), shipments: await db.shipments.toArray(),
      events: await db.events.toArray() }
  }

  async function expectStaleUnchanged() {
    const before = await state()
    const result = await undoService.undoLastMutation()
    expect(result.success).toBe(false)
    expect(result.message).toContain('nguồn giữ đã thay đổi')
    expect(await state()).toEqual(before)
    expect(undoService.getLastMutation()).toBeNull()
  }

  it('fresh own 10k Undo restores availability and retains physical stock and history', async () => {
    const { reservation } = await reserve()
    const before = await state()
    expect(availableQuantityForBatch(before.batches[0], before.reservations)).toBe(10000)
    expect((await undoService.undoLastMutation()).success).toBe(true)
    const after = await state()
    expect(after.reservations[0]).toEqual({ ...reservation, status: 'released' })
    expect(after.batches).toEqual(before.batches)
    expect(availableQuantityForBatch(after.batches[0], after.reservations)).toBe(20000)
    expect(after.orders[0].status).toBe('open')
    expect(after.events.filter(e => e.type === 'reservation_created')).toEqual(before.events)
    expect(after.events.filter(e => e.type === 'reservation_released')).toHaveLength(2)
  })

  it('fresh external reservation Undo uses the same guard without changing own stock', async () => {
    const before = await db.batches.toArray()
    const { reservation } = await reserveExternalSupplier({ orderId: 'order', supplierId: 'supplier', quantity: 10000 })
    expect((await undoService.undoLastMutation()).success).toBe(true)
    expect((await db.reservations.get(reservation.id))?.status).toBe('released')
    expect(await db.batches.toArray()).toEqual(before)
  })

  it('rejects the old 10k Undo after a simulated DB reduction to 7k', async () => {
    const { reservation } = await reserve()
    // No reconciliation service exists in 1A: simulate only authoritative state.
    await db.reservations.update(reservation.id, { quantity: 7000 })
    await expectStaleUnchanged()
    expect((await db.reservations.get(reservation.id))?.quantity).toBe(7000)
  })

  it.each([7000, 10000, 0])('FC3-1B required gate: old Undo fails after REAL 10k→%i reconciliation, retaining all post-state', async newOutstanding => {
    const { reservation, mutation } = await reserve()
    const stockBefore = await db.batches.toArray()
    const requestedQuantity = Math.max(newOutstanding, 7000)
    const plan = { orderId: 'order', desiredRequestedQuantity: requestedQuantity,
      adjustments: [{ reservationId: reservation.id, newOutstanding }] }
    const preview = await previewOrderReduction(plan)
    expect(preview.success).toBe(true)
    if (!preview.success) throw new Error(preview.error)
    expect(await reconcileOrderReduction({ ...plan, operationId: 'real-reduction', expectedFingerprint: preview.fingerprint }))
      .toMatchObject({ success: true, projection: { coverageAfter: newOutstanding,
        orderAfter: { requestedQuantity, status: newOutstanding === 0 ? 'open' : 'reserved' } } })
    undoService.recordMutation(mutation, 0)
    await expectStaleUnchanged()
    expect(await db.reservations.get(reservation.id)).toMatchObject({ quantity: newOutstanding || 10000,
      fulfilledQuantity: 0, status: newOutstanding === 0 ? 'released' : 'active' })
    expect(await db.batches.toArray()).toEqual(stockBefore)
    expect(await db.events.where('type').equals('order_reconciled').count()).toBe(1)
    expect(await db.events.where('type').equals('reservation_released').count()).toBe(0)
  })

  it('rejects after real partial shipment, preserving F, shipment, stock and events', async () => {
    const { reservation, mutation } = await reserve()
    const { shipment } = await createShipment({ orderId: 'order', lines: [{ reservationId: reservation.id, quantity: 3000 }] })
    await confirmShipment({ shipmentId: shipment.id })
    undoService.recordMutation(mutation, 0)
    await expectStaleUnchanged()
    expect((await db.reservations.get(reservation.id))?.fulfilledQuantity).toBe(3000)
    expect((await db.shipments.get(shipment.id))?.status).toBe('completed')
    expect((await db.batches.get('batch'))?.currentQuantity).toBe(22000)
    expect((await db.batches.get('batch'))?.readyQuantity).toBe(17000)
  })

  it.each([
    ['batch reference', { batchId: 'another-batch' }],
    ['supplier reference', { supplierId: 'another-supplier' }],
    ['source type', { sourceType: 'external_supplier' as const, supplierId: 'supplier' }],
    ['order reference', { orderId: 'another-order' }],
    ['released status', { status: 'released' as const }],
    ['fulfillment', { fulfilledQuantity: 1000 }]
  ])('rejects changed %s facts without producing a false release event', async (_, changes) => {
    const { reservation } = await reserve()
    await db.reservations.update(reservation.id, changes)
    await expectStaleUnchanged()
  })

  it('rejects missing reservation', async () => {
    const { reservation } = await reserve()
    await db.reservations.delete(reservation.id)
    await expectStaleUnchanged()
  })

  it('rejects history even when quantity has returned to the original snapshot', async () => {
    const { reservation } = await reserve()
    await db.reservations.update(reservation.id, { quantity: 7000 })
    const history = createDomainEvent('reservation_reconciled', 'order', 'order', {
      reservationId: reservation.id, before: { quantity: 10000 }, after: { quantity: 7000 }
    })
    history.createdAt = reservation.createdAt // Same timestamp cannot bypass the ID boundary.
    await db.events.put(history)
    await db.reservations.update(reservation.id, { quantity: 10000 })
    await expectStaleUnchanged()
  })

  it('rejects removal of captured creation history', async () => {
    await reserve()
    const event = await db.events.where('entityId').equals('order').first()
    await db.events.delete(event!.id)
    await expectStaleUnchanged()
  })

  it.each(['planned', 'cancelled'])('rejects real %s shipment history even with unchanged reservation facts', async status => {
    const { reservation, mutation } = await reserve()
    const { shipment } = await createShipment({ orderId: 'order', lines: [{ reservationId: reservation.id, quantity: 3000 }] })
    if (status === 'cancelled') await cancelShipment({ shipmentId: shipment.id })
    undoService.recordMutation(mutation, 0)
    await expectStaleUnchanged()
  })

  it('rolls back release and order changes when event persistence fails', async () => {
    await reserve()
    const before = await state()
    const originalPut = db.events.put.bind(db.events)
    vi.spyOn(db.events, 'put')
      .mockImplementationOnce(event => originalPut(event))
      .mockRejectedValueOnce(new Error('order event write failed'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await undoService.undoLastMutation()).success).toBe(false)
    expect(await state()).toEqual(before)
  })

  it('serializes a queued authoritative reduction before Undo; old intent cannot release 7k', async () => {
    const { reservation } = await reserve()
    const reduction = db.transaction('rw', db.reservations, async () => {
      const current = await db.reservations.get(reservation.id)
      await db.reservations.put({ ...current!, quantity: 7000 })
    })
    const undo = undoService.undoLastMutation()
    const [, result] = await Promise.all([reduction, undo])
    expect(result.success).toBe(false)
    expect((await db.reservations.get(reservation.id))?.quantity).toBe(7000)
    expect((await db.reservations.get(reservation.id))?.status).toBe('active')
    expect(await db.events.filter(e => e.type === 'reservation_released').count()).toBe(0)
    expect((await db.batches.get('batch'))?.readyQuantity).toBe(20000)
  })

  it('two concurrent Undos release at most once and the second fails stale', async () => {
    await reserve()
    const results = await Promise.all([undoService.undoLastMutation(), undoService.undoLastMutation()])
    expect(results.filter(r => r.success)).toHaveLength(1)
    expect(await db.events.filter(e => e.type === 'reservation_released' && e.entityType === 'order').count()).toBe(1)
  })

  it('keeps guard and release reads in one transaction; an intervening writer waits until release commits', async () => {
    const { reservation } = await reserve()
    const originalGet = db.reservations.get.bind(db.reservations)
    const reads: (Transaction | undefined)[] = []
    let competing: Promise<boolean> | undefined
    vi.spyOn(db.reservations, 'get').mockImplementation(key => originalGet(key).then(current => {
      reads.push(Dexie.currentTransaction)
      if (reads.length === 1) {
        // Queue a separate writer AFTER the guard read, not before Undo starts.
        // It must wait for the outer Undo transaction; never await it inside that lock.
        competing = Dexie.ignoreTransaction(() => db.transaction('rw', db.reservations, async () => {
          const latest = await originalGet(reservation.id)
          if (latest?.status !== 'active') return false
          await db.reservations.update(reservation.id, { quantity: 7000 })
          return true
        }))
      }
      return current
    }))
    expect((await undoService.undoLastMutation()).success).toBe(true)
    expect(await competing).toBe(false)
    // First read is guard, second is the unchanged release service's read.
    expect(reads).toHaveLength(2)
    expect(reads[0]).toBeDefined()
    expect(reads[1]?.parent).toBe(reads[0])
    vi.restoreAllMocks()
    expect(await db.reservations.get(reservation.id)).toMatchObject({ quantity: 10000, status: 'released' })
  })
})
