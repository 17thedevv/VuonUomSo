import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, VuonUomDatabase } from '../../data/db'
import { clearAllData, resetDemoData } from '../../data/seed'
import type { Batch } from '../../domain/batch'
import type { Reservation } from '../../domain/reservation'
import { validReservation } from '../../domain/reconciliation'
import { updateBatchInventory, updateBatchReadyQuantity } from '../batchService'
import { undoService } from '../undoService'
import { getGardenAvailability, type GardenAvailabilityQuery } from '../gardenQueryService'

const zero = { living: 0, ready: 0, outstanding: 0, available: 0, commitmentShortage: 0 }
const batch = (id = 'a', changes: Partial<Batch> = {}): Batch => ({
  id, code: `M0${id}`, variety: 'Monthong', createdAt: '2026-10-01',
  initialQuantity: 200, currentQuantity: 100, readyQuantity: 80, status: 'ready', ...changes
})
const reservation = (id = 'r', changes: Partial<Reservation> = {}): Reservation => ({
  id, orderId: 'o', sourceType: 'own_batch', batchId: 'a', quantity: 30,
  status: 'active', createdAt: '2026-10-01', ...changes
})
async function seed(batches: Batch[], reservations: Reservation[] = []) {
  await db.transaction('rw', [db.batches, db.reservations], async () => {
    await db.batches.bulkPut(batches)
    await db.reservations.bulkPut(reservations)
  })
}
async function fixture(scale = 1) {
  await seed([
    batch('a', { code: 'M06', variety: ' Monthong ', initialQuantity: 30 * scale, readyQuantity: 15 * scale, currentQuantity: 30 * scale }),
    batch('b', { code: 'M07', variety: 'MONTHONG', initialQuantity: 40 * scale, readyQuantity: 20 * scale, currentQuantity: 40 * scale })
  ], [
    reservation('ra', { quantity: 18 * scale }),
    reservation('rb', { batchId: 'b', quantity: 5 * scale })
  ])
}

describe('getGardenAvailability (real Dexie + fake-indexeddb)', () => {
  beforeEach(async () => {
    await clearAllData()
    undoService.clearLastMutation()
  })
  afterEach(() => {
    undoService.clearLastMutation()
    vi.useRealTimers()
  })

  it('distinguishes a valid empty garden from failure', async () => {
    const view = await getGardenAvailability()
    expect(view).toEqual({ basis: 'legacy_variety', capturedAt: expect.any(String), ownTotals: zero, groups: [] })
    expect(new Date(view.capturedAt).toISOString()).toBe(view.capturedAt)
  })

  it('derives one batch without using persisted status as sellability', async () => {
    await seed([batch('a', { status: 'depleted' })], [reservation()])
    const view = await getGardenAvailability()
    expect(view.ownTotals).toEqual({ living: 100, ready: 80, outstanding: 30, available: 50, commitmentShortage: 0 })
    expect(view.groups).toEqual([{
      key: 'monthong', label: 'Monthong', batchIds: ['a'], matchedBatchIds: ['a'], totals: view.ownTotals,
      batches: [{ id: 'a', code: 'M0a', variety: 'Monthong', ...view.ownTotals }]
    }])
  })

  it('assigns capturedAt after successful table reads, rather than at request start', async () => {
    await seed([batch()], [reservation()])
    const start = new Date('2026-10-09T12:00:00.000Z')
    const finish = new Date('2026-10-09T12:01:00.000Z')
    // Fake Date only; IndexedDB scheduling and timers remain real.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(start)
    const finishRead = (record: Reservation) => { vi.setSystemTime(finish); return record }
    db.reservations.hook('reading', finishRead)
    try {
      const view = await getGardenAvailability()
      expect(view.capturedAt).toBe(finish.toISOString())
      expect(view.ownTotals.available).toBe(50)
    } finally {
      db.reservations.hook('reading').unsubscribe(finishRead)
    }
  })

  it.each([1, 1000])('sums per-batch available/shortage without netting (scale %i)', async (scale) => {
    await fixture(scale)
    const view = await getGardenAvailability()
    const totals = { living: 70 * scale, ready: 35 * scale, outstanding: 23 * scale, available: 15 * scale, commitmentShortage: 3 * scale }
    expect(view.ownTotals).toEqual(totals)
    expect(view.groups[0]?.totals).toEqual(totals)
    expect(view.groups[0]?.batches.map(({ available, commitmentShortage }) => ({ available, commitmentShortage })))
      .toEqual([{ available: 0, commitmentShortage: 3 * scale }, { available: 15 * scale, commitmentShortage: 0 }])
  })

  it('counts active Q-F, not original Q or historical coverage', async () => {
    await seed([batch('a', { readyQuantity: 100 })], [
      reservation('active', { quantity: 100, fulfilledQuantity: 40 }),
      reservation('released', { quantity: 50, fulfilledQuantity: 20, status: 'released' }),
      reservation('fulfilled', { quantity: 50, fulfilledQuantity: 50, status: 'fulfilled' })
    ])
    expect((await getGardenAvailability()).ownTotals)
      .toEqual({ living: 100, ready: 100, outstanding: 60, available: 40, commitmentShortage: 0 })
  })

  it('keeps legacy optional F semantics without repairing stored records', async () => {
    await seed([batch()], [
      reservation('active'), reservation('released', { status: 'released' }),
      reservation('fulfilled', { status: 'fulfilled' })
    ])
    const before = await db.reservations.toArray()
    expect((await getGardenAvailability()).ownTotals.outstanding).toBe(30)
    expect(await db.reservations.toArray()).toEqual(before)
  })

  it('excludes external commitments even with batch/supplier ID collisions', async () => {
    await seed([batch('a', { readyQuantity: 100 })], [
      reservation(), reservation('external', { sourceType: 'external_supplier', supplierId: 'a', batchId: 'a', quantity: 500 })
    ])
    expect((await getGardenAvailability()).ownTotals)
      .toEqual({ living: 100, ready: 100, outstanding: 30, available: 70, commitmentShortage: 0 })
  })

  it('only normalizes trim/case, retaining accents, whitespace and Unicode distinctions', async () => {
    const labels = [' Monthong ', 'monthong', 'MONTHONG', 'Ri 6', 'Ri6', 'Ri  6', 'Cây', 'Cay', 'Ca\u0302y']
    await seed(labels.map((variety, i) => batch(String(i), { variety })))
    const view = await getGardenAvailability()
    expect(view.groups).toHaveLength(7)
    expect(view.groups.find((g) => g.key === 'monthong')?.batchIds).toEqual(['0', '1', '2'])
    expect(view.groups.map((g) => g.key)).toEqual([...new Set(labels.map((v) => v.trim().toLowerCase()))].sort())
    expect((await getGardenAvailability({ search: 'cay' })).groups.map((g) => g.label)).toEqual(['Cay'])
  })

  it('has deterministic labels, memberships and output regardless of insertion order/search', async () => {
    const records = [batch('z', { variety: 'MONTHONG' }), batch('a', { variety: ' Monthong ' }), batch('m', { variety: 'monthong' })]
    await seed(records)
    const first = await getGardenAvailability()
    await db.batches.clear()
    await seed([...records].reverse())
    expect((await getGardenAvailability()).groups).toEqual(first.groups)
    const searched = await getGardenAvailability({ search: 'M0z' })
    expect(searched.groups[0]).toEqual({ ...first.groups[0], matchedBatchIds: ['z'] })
    expect(searched.groups[0]?.label).toBe('Monthong')
    expect((await db.batches.get('a'))?.variety).toBe(' Monthong ')
  })

  it('code-only search retains every batch and whole group/garden totals', async () => {
    await fixture()
    await seed([batch('c', { code: 'M08', variety: 'monthong' }), batch('d', { variety: 'Ri6' })])
    const full = await getGardenAvailability()
    const searched = await getGardenAvailability({ search: ' m06 ' })
    expect(searched.ownTotals).toEqual(full.ownTotals)
    expect(searched.groups).toEqual([{ ...full.groups.find((g) => g.key === 'monthong'), matchedBatchIds: ['a'] }])
    expect(searched.groups[0]?.batchIds).toEqual(['a', 'b', 'c'])
    expect(searched.groups[0]?.totals.available).toBe(95)
    expect((await getGardenAvailability({ search: ' monthONG ' })).groups[0]?.matchedBatchIds).toEqual(['a', 'b', 'c'])
    const noMatch = await getGardenAvailability({ search: 'missing' })
    expect(noMatch.groups).toEqual([])
    expect(noMatch.ownTotals).toEqual(full.ownTotals)
  })

  it('defaults to available > 0 while all retains zero-available groups and mixed shortages', async () => {
    await fixture()
    await seed([batch('c', { variety: 'Ri6', readyQuantity: 20 }), batch('d', { variety: 'Ươm', readyQuantity: 0 })],
      [reservation('rc', { batchId: 'c', quantity: 20 })])
    const available = await getGardenAvailability()
    const all = await getGardenAvailability({ view: 'all' })
    expect(available.groups.map((g) => g.key)).toEqual(['monthong'])
    expect(available.groups[0]?.totals.commitmentShortage).toBe(3)
    expect(all.groups).toHaveLength(3)
    expect(all.ownTotals).toEqual(available.ownTotals)
    expect((await getGardenAvailability({ search: 'Ri6' })).groups).toEqual([])
    expect((await getGardenAvailability({ search: 'Ri6', view: 'all' })).groups[0]?.totals.available).toBe(0)
  })

  it('explicitly rejects unknown view/non-string search', async () => {
    await expect(getGardenAvailability({ view: 'ready' } as unknown as GardenAvailabilityQuery)).rejects.toThrow('query.view')
    await expect(getGardenAvailability({ search: 123 } as unknown as GardenAvailabilityQuery)).rejects.toThrow('query.search')
  })

  describe('fail-closed data validation', () => {
    it.each<Partial<Reservation>>([
      { supplierId: 'supplier_x' },
      { supplierId: '   ' },
      { supplierId: 'supplier_x', status: 'released' },
      { supplierId: 'supplier_x', status: 'fulfilled', fulfilledQuantity: 30 }
    ])('rejects malformed own-batch source %j for the entire view without writes', async (changes) => {
      const malformed = reservation('bad', changes)
      expect(validReservation(malformed)).toBe(false)
      await seed([batch()], [reservation('good', { quantity: 5 }), malformed])
      const snapshot = () => Promise.all(db.tables.map((table) => table.toArray()))
      const before = await snapshot()
      await expect(getGardenAvailability()).rejects.toThrow('supplierId')
      await expect(getGardenAvailability({ search: 'no-matching-variety-or-code', view: 'all' })).rejects.toThrow('supplierId')
      expect(await snapshot()).toEqual(before)
    })
    it('accepts an empty optional supplierId consistently with the canonical own source shape', async () => {
      const own = reservation('r', { supplierId: '' })
      expect(validReservation(own)).toBe(true)
      await seed([batch()], [own])
      expect((await getGardenAvailability()).ownTotals.outstanding).toBe(30)
    })
    // These invalid identities are persistable IndexedDB keys; missing keys cannot be stored.
    it.each(['', '   ', 123])('rejects invalid persisted own reservation id %s', async (id) => {
      await seed([batch()], [reservation('bad', { id } as unknown as Partial<Reservation>)])
      await expect(getGardenAvailability({ search: 'missing' })).rejects.toThrow('reservation.id')
    })
    it.each(['', '   ', undefined, null, 123])('rejects blank/missing/non-string own orderId %s without joining orders', async (orderId) => {
      await seed([batch()], [reservation('bad', { orderId } as unknown as Partial<Reservation>)])
      await expect(getGardenAvailability({ search: 'missing' })).rejects.toThrow('orderId')
    })
    const badNumbers = [-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]
    for (const field of ['currentQuantity', 'readyQuantity'] as const) {
      it.each(badNumbers)(`rejects invalid ${field}=%s even outside the search/view`, async (value) => {
        await seed([batch('good'), batch('bad', { variety: 'Ri6', [field]: value })])
        await expect(getGardenAvailability({ search: 'monthong' })).rejects.toThrow('Garden availability')
      })
    }
    it('rejects ready > living', async () => {
      await seed([batch('a', { currentQuantity: 10, readyQuantity: 11 })])
      await expect(getGardenAvailability()).rejects.toThrow('ready > living')
    })
    it.each([
      { currentQuantity: undefined }, { readyQuantity: null }, { currentQuantity: '100' }
    ])('rejects missing/non-numeric batch quantities %j', async (changes) => {
      await seed([batch('a', changes as unknown as Partial<Batch>)])
      await expect(getGardenAvailability()).rejects.toThrow('Garden availability')
    })
    it.each(['', '   ', undefined, null, 12])('rejects blank/missing/non-string variety %s', async (variety) => {
      await seed([batch('good'), batch('bad', { variety } as unknown as Partial<Batch>)])
      await expect(getGardenAvailability({ search: 'missing' })).rejects.toThrow('variety')
    })
    it.each(['', undefined, 123])('rejects invalid code %s', async (code) => {
      await seed([batch('a', { code } as unknown as Partial<Batch>)])
      await expect(getGardenAvailability()).rejects.toThrow('code')
    })
    for (const field of ['quantity', 'fulfilledQuantity'] as const) {
      it.each(badNumbers)(`rejects invalid own ${field}=%s`, async (value) => {
        await seed([batch()], [reservation('bad', { [field]: value })])
        await expect(getGardenAvailability()).rejects.toThrow('Garden availability')
      })
    }
    it.each([
      { quantity: 0 }, { quantity: undefined }, { quantity: '30' }, { fulfilledQuantity: 31 }, { fulfilledQuantity: null },
      { status: 'unknown' }, { sourceType: 'unknown' }, { sourceType: undefined },
      { batchId: undefined }, { batchId: '' }, { batchId: 'deleted' },
      { status: 'active', fulfilledQuantity: 30 }, { status: 'fulfilled', fulfilledQuantity: 20 },
      { status: 'released', batchId: 'deleted' }, { status: 'released', fulfilledQuantity: 31 }
    ])('rejects inconsistent relevant reservation %j', async (changes) => {
      await seed([batch()], [reservation('bad', changes as unknown as Partial<Reservation>)])
      await expect(getGardenAvailability()).rejects.toThrow('Garden availability')
    })
    it('does not repair or partially write when corrupt data rejects the whole view', async () => {
      await seed([batch('good'), batch('bad', { readyQuantity: -1 })], [reservation('r', { batchId: 'good' })])
      const before = await Promise.all([db.batches.toArray(), db.reservations.toArray(), db.events.toArray()])
      await expect(getGardenAvailability()).rejects.toThrow('Garden availability')
      expect(await Promise.all([db.batches.toArray(), db.reservations.toArray(), db.events.toArray()])).toEqual(before)
    })
    it('accepts valid zero-stock shortage without clamping facts or skipping batches', async () => {
      await seed([batch('a', { currentQuantity: 0, readyQuantity: 0 })], [reservation()])
      const view = await getGardenAvailability({ view: 'all' })
      expect(view.ownTotals).toEqual({ ...zero, outstanding: 30, commitmentShortage: 30 })
      expect(view.groups).toHaveLength(1)
    })
    it('rejects per-batch outstanding overflow before availability clamps it', async () => {
      await seed([batch()], [reservation('max', { quantity: Number.MAX_SAFE_INTEGER }), reservation('one', { quantity: 1 })])
      await expect(getGardenAvailability()).rejects.toThrow('outstanding overflow')
    })
    it.each(['same group', 'whole garden'])('rejects living/ready overflow in %s', async (scope) => {
      await seed([
        batch('a', { initialQuantity: Number.MAX_SAFE_INTEGER, currentQuantity: Number.MAX_SAFE_INTEGER, readyQuantity: Number.MAX_SAFE_INTEGER }),
        batch('b', { currentQuantity: 1, readyQuantity: 1, variety: scope === 'same group' ? 'Monthong' : 'Ri6' })
      ])
      await expect(getGardenAvailability({ search: 'missing' })).rejects.toThrow('overflow')
    })
    it.each(['same group', 'whole garden'])('rejects outstanding/shortage overflow with zero stock in %s', async (scope) => {
      await seed([
        batch('a', { currentQuantity: 0, readyQuantity: 0 }),
        batch('b', { currentQuantity: 0, readyQuantity: 0, variety: scope === 'same group' ? 'Monthong' : 'Ri6' })
      ], [reservation('max', { quantity: Number.MAX_SAFE_INTEGER }), reservation('one', { batchId: 'b', quantity: 1 })])
      await expect(getGardenAvailability({ view: 'all' })).rejects.toThrow('overflow')
    })
    it('retains exact values at the safe-integer boundary', async () => {
      const max = Number.MAX_SAFE_INTEGER
      await seed([batch('a', { initialQuantity: max, currentQuantity: max, readyQuantity: max })], [reservation('r', { quantity: max, fulfilledQuantity: max - 1 })])
      expect((await getGardenAvailability()).ownTotals).toEqual({ living: max, ready: max, outstanding: 1, available: max - 1, commitmentShortage: 0 })
    })
  })

  describe('coherent read snapshot with a second real Dexie connection', () => {
    it('read-first sees all BEFORE while a writer is enqueued between table reads', async () => {
      await seed([batch()], [reservation()])
      const writerDb = new VuonUomDatabase(db.name)
      await writerDb.open()
      let write: Promise<unknown> | undefined
      const enqueueWriter = (record: Batch) => {
        if (!write) Dexie.ignoreTransaction(() => {
          write = writerDb.transaction('rw', [writerDb.batches, writerDb.reservations], async () => {
            await writerDb.batches.update('a', { currentQuantity: 200, readyQuantity: 160 })
            await writerDb.reservations.update('r', { quantity: 70 })
          })
        })
        return record
      }
      db.batches.hook('reading', enqueueWriter)
      try {
        const view = await getGardenAvailability()
        expect(write).toBeDefined()
        expect(view.ownTotals).toEqual({ living: 100, ready: 80, outstanding: 30, available: 50, commitmentShortage: 0 })
        await write
        db.batches.hook('reading').unsubscribe(enqueueWriter)
        expect((await getGardenAvailability()).ownTotals).toEqual({ living: 200, ready: 160, outstanding: 70, available: 90, commitmentShortage: 0 })
      } finally {
        db.batches.hook('reading').unsubscribe(enqueueWriter)
        await write
        writerDb.close()
      }
    })

    it('write-first query enqueued between writes sees all AFTER, never the intermediate batch', async () => {
      await seed([batch()], [reservation()])
      const writerDb = new VuonUomDatabase(db.name)
      await writerDb.open()
      let read: ReturnType<typeof getGardenAvailability> | undefined
      try {
        await writerDb.transaction('rw', [writerDb.batches, writerDb.reservations], async () => {
          await writerDb.batches.update('a', { currentQuantity: 200, readyQuantity: 160 })
          Dexie.ignoreTransaction(() => { read = getGardenAvailability() })
          await writerDb.reservations.update('r', { quantity: 70 })
        })
        expect(read).toBeDefined()
        expect((await read)?.ownTotals).toEqual({ living: 200, ready: 160, outstanding: 70, available: 90, commitmentShortage: 0 })
      } finally {
        writerDb.close()
      }
    })
  })

  it.each(['batches', 'reservations'] as const)('propagates actual %s read failure instead of zero-success', async (table) => {
    await seed([batch()], [reservation()])
    const failure = new Error('injected IndexedDB reading hook failure')
    const failRead = () => { throw failure }
    db[table].hook('reading', failRead)
    try {
      await expect(getGardenAvailability()).rejects.toThrow(failure.message)
    } finally {
      db[table].hook('reading').unsubscribe(failRead)
    }
    expect((await getGardenAvailability()).ownTotals.available).toBe(50)
  })

  it('never writes any table for normal/search/all/no-match queries', async () => {
    await resetDemoData()
    const snapshot = () => Promise.all(db.tables.map((table) => table.toArray()))
    const before = await snapshot()
    await getGardenAvailability()
    await getGardenAvailability({ search: 'bv16', view: 'all' })
    await getGardenAvailability({ search: 'missing' })
    await getGardenAvailability({ view: 'all' })
    expect(await snapshot()).toEqual(before)
  })

  it('re-query reflects committed existing inventory/ready mutations with no stale cache', async () => {
    await fixture()
    expect((await getGardenAvailability()).ownTotals.available).toBe(15)
    expect((await updateBatchReadyQuantity({ batchId: 'b', newReadyQuantity: 10 })).success).toBe(true)
    expect((await getGardenAvailability({ search: 'M06' })).groups[0]?.totals)
      .toEqual({ living: 70, ready: 25, outstanding: 23, available: 5, commitmentShortage: 3 })
    expect((await updateBatchInventory({ batchId: 'a', newQuantity: 10, newReadyQuantity: 10 })).success).toBe(true)
    expect((await getGardenAvailability()).ownTotals)
      .toEqual({ living: 50, ready: 20, outstanding: 23, available: 5, commitmentShortage: 8 })
  })
})
