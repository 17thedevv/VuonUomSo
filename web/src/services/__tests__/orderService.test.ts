import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Dexie from 'dexie'
import { db, VuonUomDatabase } from '../../data/db'
import type { Batch } from '../../domain/batch'
import type { Reservation } from '../../domain/reservation'
import type { DomainEvent } from '../../analytics/events'
import { validReservation } from '../../domain/reconciliation'
import { getGardenAvailability } from '../gardenQueryService'
import { createOrder, getVarietyAvailability } from '../orderService'
import {
  contactRepository,
  batchRepository,
  reservationRepository,
  orderRepository,
  eventRepository
} from '../../data/repositories'
import { clearAllData, resetDemoData } from '../../data/seed'
import { undoService } from '../undoService'
import { availableQuantityForBatch } from '../../domain/quantity'

async function seedAvailabilityFixture() {
  await db.contacts.put({ id: 'customer', name: 'Anh Hùng', roles: ['customer'] })
  await db.orders.put({ id: 'existing', customerId: 'customer', variety: 'Monthong', requestedQuantity: 2000, status: 'open' })
  const batches: Batch[] = [15, 20].map((readyQuantity, index) => ({
    id: `M0${index + 6}`, code: `M0${index + 6}`, variety: 'Monthong',
    createdAt: '2026-10-01', initialQuantity: 100, currentQuantity: 100, readyQuantity, status: 'ready'
  }))
  const reservations: Reservation[] = [18, 5].map((quantity, index) => ({
    id: `own_${index}`, orderId: 'existing', sourceType: 'own_batch', batchId: batches[index].id,
    quantity, fulfilledQuantity: 0, status: 'active', createdAt: '2026-10-01'
  }))
  await db.batches.bulkPut(batches)
  await db.reservations.bulkPut(reservations)
}

const collision: Reservation = {
  id: 'external', orderId: 'existing', sourceType: 'external_supplier', supplierId: 'supplier_s',
  batchId: 'M07', quantity: 999, status: 'active', createdAt: '2026-10-01'
}

const fixtureInput = { customerId: 'customer', variety: 'Monthong', requestedQuantity: 20 }
async function snapshotFacts() {
  return {
    orders: await db.orders.toArray(), events: await db.events.toArray(),
    batches: await db.batches.toArray(), reservations: await db.reservations.toArray(),
    shipments: await db.shipments.toArray(), contacts: await db.contacts.toArray()
  }
}

describe('Issue #42 availability authority (real Dexie)', () => {
  beforeEach(async () => {
    await clearAllData()
    await seedAvailabilityFixture()
    undoService.clearLastMutation()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    undoService.clearLastMutation()
  })

  it('C4201/C4202/C4204: external batchId collision preserves A1 own available15/shortage3 and order feedback', async () => {
    await db.reservations.put(collision) // Adversarial imported fact, not an authorized command shape.
    expect(validReservation(collision)).toBe(false)
    const view = await getGardenAvailability({ view: 'all' })
    expect(view.groups[0].totals).toMatchObject({ ready: 35, outstanding: 23, available: 15, commitmentShortage: 3 })
    expect(await getVarietyAvailability('Monthong', 20)).toEqual({
      variety: 'Monthong', readyQuantity: 35, reservedQuantity: 23,
      availableQuantity: 15, isShortage: true, shortageAmount: 5
    })
  })
  it('C4203/C4206: valid external supply is excluded and available is sum of per-batch clamps, not35−23', async () => {
    const external = { ...collision, batchId: undefined }
    expect(validReservation(external)).toBe(true)
    await db.reservations.put(external)
    expect(await getVarietyAvailability('Monthong', 20)).toMatchObject({
      readyQuantity: 35, reservedQuantity: 23, availableQuantity: 15, shortageAmount: 5
    })
  })

  it.each([
    ['active', 3, 20, 15, 0],
    ['released', 4, 5, 30, 0],
    ['fulfilled', 18, 5, 30, 0]
  ] as const)('C4205: %s with F%s uses current O, not Q or historical coverage', async (status, fulfilledQuantity, outstanding, available, shortage) => {
    await db.reservations.update('own_0', { status, fulfilledQuantity })
    expect((await getGardenAvailability({ view: 'all' })).groups[0].totals).toMatchObject({
      outstanding, available, commitmentShortage: shortage
    })
    expect(await getVarietyAvailability('Monthong')).toMatchObject({
      reservedQuantity: outstanding, availableQuantity: available
    })
  })

  it('C4207/C4208: exact trim/lowercase key excludes Monthong Đỏ and preserves submitted spelling', async () => {
    const batch = (await db.batches.get('M07'))!
    await db.batches.put({ ...batch, id: 'red', code: 'RED', variety: 'Monthong Đỏ', readyQuantity: 90 })
    await db.batches.update('M06', { variety: ' monthong ' })
    expect((await getGardenAvailability({ search: 'Monthong', view: 'all' })).groups).toHaveLength(2)
    expect(await getVarietyAvailability(' MONTHONG ', 20)).toEqual({
      variety: ' MONTHONG ', readyQuantity: 35, reservedQuantity: 23,
      availableQuantity: 15, isShortage: true, shortageAmount: 5
    })
  })

  it('C4209: true missing variety returns zero only after successful authority read', async () => {
    expect(await getVarietyAvailability('Unknown', 20)).toEqual({
      variety: 'Unknown', readyQuantity: 0, reservedQuantity: 0, availableQuantity: 0, isShortage: true, shortageAmount: 20
    })
  })

  it('keeps zero-available group ready/O facts through all-view', async () => {
    await db.batches.update('M07', { readyQuantity: 0 })
    expect(await getVarietyAvailability('Monthong', 20)).toMatchObject({
      readyQuantity: 15, reservedQuantity: 23, availableQuantity: 0, shortageAmount: 20
    })
  })

  it.each([-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'C4220: rejects unsafe informational requested quantity %s without writes', async requested => {
      const before = await snapshotFacts()
      await expect(getVarietyAvailability('Monthong', requested)).rejects.toThrow(/số nguyên an toàn/)
      expect(await snapshotFacts()).toEqual(before)
    }
  )

  it.each([0, 20, Number.MAX_SAFE_INTEGER])('C4220: requested%s yields safe non-negative shortage without rounding', async requested => {
    const info = await getVarietyAvailability('Monthong', requested)
    expect(info.shortageAmount).toBe(Math.max(requested - 15, 0))
    expect(Number.isSafeInteger(info.shortageAmount)).toBe(true)
  })

  it.each(['batches', 'reservations'] as const)('C4213/C4216/C4218: real %s read failure rejects query and rolls back create; explicit retry commits once', async table => {
    const before = await snapshotFacts()
    const failRead = () => { throw new Error('IndexedDB read failure') }
    db[table].hook('reading', failRead)
    try {
      await expect(getVarietyAvailability('Unknown')).rejects.toThrow('IndexedDB read failure')
      expect(await createOrder(fixtureInput)).toMatchObject({ success: false })
    } finally {
      db[table].hook('reading').unsubscribe(failRead)
    }
    expect(await snapshotFacts()).toEqual(before)
    expect(undoService.getLastMutation()).toBeNull()
    const retry = await createOrder(fixtureInput)
    expect(retry.success).toBe(true)
    expect(await db.orders.count()).toBe(before.orders.length + 1)
    expect(await db.events.where('entityId').equals(retry.order!.id).toArray()).toEqual([
      expect.objectContaining({ type: 'order_created', payload: expect.objectContaining({ availableAtGarden: 15 }) })
    ])
    expect(await db.batches.toArray()).toEqual(before.batches)
    expect(await db.reservations.toArray()).toEqual(before.reservations)
  })

  it('C4216: malformed own fact outside selected variety fails A1 projection and rolls back order/event/Undo', async () => {
    const batch = (await db.batches.get('M07'))!
    await db.batches.put({ ...batch, id: 'bad', code: 'BAD', variety: 'Other', readyQuantity: NaN })
    const before = await snapshotFacts()
    await expect(getVarietyAvailability('Monthong')).rejects.toThrow(/Garden availability/)
    expect(await createOrder(fixtureInput)).toMatchObject({ success: false })
    expect(await snapshotFacts()).toEqual(before)
    expect(undoService.getLastMutation()).toBeNull()
  })

  it('C4220: A1 aggregate overflow fails closed, including missing selected variety', async () => {
    await db.batches.toCollection().modify({
      initialQuantity: Number.MAX_SAFE_INTEGER, currentQuantity: Number.MAX_SAFE_INTEGER, readyQuantity: Number.MAX_SAFE_INTEGER
    })
    await expect(getVarietyAvailability('Unknown')).rejects.toThrow(/overflow/)
    expect(await createOrder(fixtureInput)).toMatchObject({ success: false })
    expect(await db.orders.count()).toBe(1)
    expect(await db.events.count()).toBe(0)
    expect(undoService.getLastMutation()).toBeNull()
  })

  it('C4211/C4212/C4215/C4219: nested A1 read, persisted event parity, no auto-reserve/stock write and durable Undo', async () => {
    await db.reservations.put(collision)
    const before = await snapshotFacts()
    const a1 = (await getGardenAvailability({ view: 'all' })).groups[0]
    const recordUndo = vi.spyOn(undoService, 'recordMutation')
    const result = await createOrder(fixtureInput)
    expect(result.success).toBe(true)
    expect(result.availabilityInfo?.availableQuantity).toBe(a1.totals.available)
    expect(await db.orders.get(result.order!.id)).toEqual(result.order)
    expect(await db.orders.count()).toBe(before.orders.length + 1)
    const events = await db.events.where('entityId').equals(result.order!.id).toArray()
    expect(events).toEqual([expect.objectContaining({
      type: 'order_created', payload: expect.objectContaining({
        customerId: 'customer', variety: 'Monthong', requestedQuantity: 20, availableAtGarden: 15
      })
    })])
    expect(await db.batches.toArray()).toEqual(before.batches)
    expect(await db.reservations.toArray()).toEqual(before.reservations)
    expect(recordUndo).toHaveBeenCalledTimes(1)
    expect(await undoService.undoLastMutation()).toMatchObject({ success: true, revertedType: 'create_order' })
    expect(await db.orders.toArray()).toEqual(before.orders)
    // Existing Undo preserves audit history; it removes the order and appends mutation_undone.
    expect(await db.events.where('entityId').equals(result.order!.id).toArray()).toEqual([
      expect.objectContaining({ type: 'order_created' }), expect.objectContaining({ type: 'mutation_undone' })
    ])
    expect(await db.batches.toArray()).toEqual(before.batches)
    expect(await db.reservations.toArray()).toEqual(before.reservations)
  })

  it('C4217/C4218: required event persistence failure aborts parent transaction; no silent retries', async () => {
    await db.reservations.put(collision)
    const before = await snapshotFacts()
    let attempted = 0
    const failEvent = (_key: unknown, event: DomainEvent) => {
      if (event.type === 'order_created') {
        ++attempted
        expect(undoService.getLastMutation()).toBeNull()
        throw new Error('event persistence failure')
      }
    }
    db.events.hook('creating', failEvent)
    try {
      expect(await createOrder(fixtureInput)).toMatchObject({ success: false })
    } finally {
      db.events.hook('creating').unsubscribe(failEvent)
    }
    expect(attempted).toBe(1)
    expect(await snapshotFacts()).toEqual(before)
    expect(undoService.getLastMutation()).toBeNull()
    expect((await createOrder(fixtureInput)).success).toBe(true)
    expect(await db.orders.count()).toBe(before.orders.length + 1)
    expect(await db.events.count()).toBe(before.events.length + 1)
  })

  it('C4215: create-first event sees all BEFORE while another connection queues supply changes', async () => {
    const writer = new VuonUomDatabase(db.name)
    await writer.open()
    let write: Promise<unknown> | undefined
    const enqueueWriter = (batch: Batch) => {
      if (!write) Dexie.ignoreTransaction(() => {
        write = writer.transaction('rw', [writer.batches, writer.reservations], async () => {
          await writer.batches.update('M07', { readyQuantity: 40 })
          await writer.reservations.update('own_1', { quantity: 25 })
        })
      })
      return batch
    }
    db.batches.hook('reading', enqueueWriter)
    try {
      const result = await createOrder(fixtureInput)
      expect(result.success).toBe(true)
      expect(write).toBeDefined()
      expect(result.availabilityInfo).toMatchObject({ readyQuantity: 35, reservedQuantity: 23, availableQuantity: 15 })
      expect((await db.events.where('entityId').equals(result.order!.id).first())?.payload)
        .toMatchObject({ availableAtGarden: 15 })
      await write
      db.batches.hook('reading').unsubscribe(enqueueWriter)
      expect(await getVarietyAvailability('Monthong')).toMatchObject({ readyQuantity: 55, reservedQuantity: 43, availableQuantity: 15 })
    } finally {
      db.batches.hook('reading').unsubscribe(enqueueWriter)
      await write
      writer.close()
    }
  })

  it('C4215: write-first create between supply writes waits for all AFTER, not a hybrid', async () => {
    const writer = new VuonUomDatabase(db.name)
    await writer.open()
    let create: ReturnType<typeof createOrder> | undefined
    try {
      await writer.transaction('rw', [writer.batches, writer.reservations], async () => {
        await writer.batches.update('M07', { readyQuantity: 40 })
        Dexie.ignoreTransaction(() => { create = createOrder(fixtureInput) })
        await writer.reservations.update('own_1', { quantity: 25 })
      })
      const result = await create
      expect(result?.success).toBe(true)
      expect(result?.availabilityInfo).toMatchObject({ readyQuantity: 55, reservedQuantity: 43, availableQuantity: 15 })
      expect((await db.events.where('entityId').equals(result!.order!.id).first())?.payload).toMatchObject({ availableAtGarden: 15 })
    } finally {
      writer.close()
    }
  })

})

describe('orderService', () => {
  beforeEach(async () => {
    await clearAllData()
    undoService.clearLastMutation()
  })

  describe('getVarietyAvailability', () => {
    it('accurately calculates available stock and shortage for a given variety', async () => {
      await resetDemoData()

      // Demo data has BV16: ready = 32000, reserved = 10000 => available = 22000
      const availability1 = await getVarietyAvailability('Keo lai BV16', 20000)
      expect(availability1.readyQuantity).toBe(32000)
      expect(availability1.reservedQuantity).toBe(10000)
      expect(availability1.availableQuantity).toBe(22000)
      expect(availability1.isShortage).toBe(false)
      expect(availability1.shortageAmount).toBe(0)

      // Requesting 30.000 while 22.000 available => shortage of 8.000
      const availability2 = await getVarietyAvailability('Keo lai BV16', 30000)
      expect(availability2.isShortage).toBe(true)
      expect(availability2.shortageAmount).toBe(8000)
    })
  })

  describe('createOrder', () => {
    it('creates order with status="open" WITHOUT creating any reservation or changing stock', async () => {
      await resetDemoData()

      // Snapshot batches and reservations before order creation
      const reservationsBefore = await reservationRepository.getAll()
      const batchesBefore = await batchRepository.getAll()
      const bv16Before = batchesBefore.find((b) => b.code === 'BV16 #12')!
      const availBefore = availableQuantityForBatch(bv16Before, reservationsBefore)

      // Create new order for 30.000 trees
      const result = await createOrder({
        customerId: 'contact_hung',
        variety: 'Keo lai BV16',
        requestedQuantity: 30000,
        unitPrice: 1200,
        requestedDate: '2026-10-20',
        note: 'Giao tại bãi Tuấn Sơn'
      })

      expect(result.success).toBe(true)
      expect(result.order).toBeDefined()
      const order = result.order!

      // Strict domain invariants for Phase P2
      expect(order.status).toBe('open')
      expect(order.requestedQuantity).toBe(30000)
      expect(order.unitPrice).toBe(1200)

      // CRITICAL: NO reservations created
      const reservationsAfter = await reservationRepository.getAll()
      expect(reservationsAfter.length).toBe(reservationsBefore.length)

      // CRITICAL: Batch inventory unmodified
      const batchesAfter = await batchRepository.getAll()
      const bv16After = batchesAfter.find((b) => b.code === 'BV16 #12')!
      expect(bv16After.currentQuantity).toBe(bv16Before.currentQuantity)
      expect(bv16After.readyQuantity).toBe(bv16Before.readyQuantity)
      const availAfter = availableQuantityForBatch(bv16After, reservationsAfter)
      expect(availAfter).toBe(availBefore)

      // Informational shortage feedback provided
      expect(result.availabilityInfo?.isShortage).toBe(true)
      expect(result.availabilityInfo?.shortageAmount).toBe(8000)

      // Order saved in repository
      const saved = await orderRepository.getById(order.id)
      expect(saved).not.toBeNull()
      expect(saved?.variety).toBe('Keo lai BV16')

      // Event logged
      const events = await eventRepository.getAll()
      expect(events.some((e) => e.type === 'order_created' && e.entityId === order.id)).toBe(true)

      // Undo registered
      const lastMutation = undoService.getLastMutation()
      expect(lastMutation).toEqual({
        type: 'create_order',
        orderId: order.id,
        customerName: 'Anh Hùng',
        description: 'Đã ghi đơn cho Anh Hùng'
      })
    })

    it('rejects order with invalid requested quantity <= 0', async () => {
      await contactRepository.save({
        id: 'c1',
        name: 'Bác Ba',
        roles: ['customer']
      })

      const result = await createOrder({
        customerId: 'c1',
        variety: 'Keo lai AH1',
        requestedQuantity: 0
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('phải lớn hơn 0')
    })

    it('rejects order with non-existent customer', async () => {
      const result = await createOrder({
        customerId: 'unknown_customer',
        variety: 'Keo lai AH1',
        requestedQuantity: 5000
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('không tồn tại trong danh bạ')
    })
  })
})
