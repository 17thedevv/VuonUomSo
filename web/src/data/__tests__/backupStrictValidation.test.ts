import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db'
import { exportWorkspaceBackup, normalizeBackup, parseAndPreviewBackup, restoreWorkspaceBackup, validateBackup } from '../backup'
import type { VuonUomBackupV1 } from '../backup/backup.types'
import { getGardenAvailability } from '../../services/gardenQueryService'
import nativeFixture from './fixtures/rem03-native.json'

type Backup = VuonUomBackupV1
const fresh = (): Backup => structuredClone(nativeFixture) as Backup
const recount = (b: Backup) => {
  for (const table of Object.keys(b.data) as (keyof Backup['data'])[]) b.recordCounts[table] = b.data[table].length
  return b
}
const own = (b: Backup) => b.data.reservations.find(r => r.id === 'own_0')!
const external = (b: Backup) => b.data.reservations.find(r => r.id === 'external')!
const max = Number.MAX_SAFE_INTEGER
const snapshot = () => db.transaction('r', db.tables, async () =>
  Object.fromEntries(await Promise.all(db.tables.map(async t => [t.name, await t.toArray()]))))

async function seed() {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
    for (const [table, records] of Object.entries(fresh().data)) await db.table(table).bulkPut(records)
    // Sentinel records in both non-backup telemetry stores must also survive.
    await db.table('pilotSessions').put({ id: 'synthetic_session', participantCode: 'TEST ONLY',
      startedAt: '2026-10-01', consent: 'accepted', marker: { preserve: true } })
    await db.table('validationEvents').put({ id: 'synthetic_validation', sessionId: 'synthetic_session',
      createdAt: '2026-10-01', type: 'test', marker: [1, 2, 3] })
  })
}

// Every malformed JSON case checks the public preview/restore boundary, zero
// transaction entry (not just rollback), and exact records in all eleven stores.
async function rejectWithoutWrites(raw: unknown) {
  const json = typeof raw === 'string' ? raw : JSON.stringify(raw)
  const before = await snapshot()
  const tx = vi.spyOn(db, 'transaction')
  let preview: ReturnType<typeof parseAndPreviewBackup>
  try {
    preview = parseAndPreviewBackup(json)
    expect(preview.success).toBe(false)
    expect(preview.preview).toBeUndefined()
    expect(preview.error).toEqual(expect.any(String))
    await expect(restoreWorkspaceBackup(json)).rejects.toThrow(preview.error)
    expect(tx).not.toHaveBeenCalled()
  } finally { tx.mockRestore() }
  expect(await snapshot()).toEqual(before)
  return preview!
}

type Mutation = (b: Backup) => void
const originalAudit: [string, Mutation | string][] = [
  ['01 corrupt JSON', '{'],
  ['02 wrong format', b => { Object.assign(b, { format: 'wrong' }) }],
  ['03 future version', b => { Object.assign(b, { formatVersion: 2 }) }],
  ['04 duplicate batch', b => { b.data.batches.push({ ...b.data.batches[0] }) }],
  ['05 missing contact', b => { b.data.orders[0].customerId = 'missing' }],
  ['06 missing order', b => { b.data.reservations[0].orderId = 'missing' }],
  ['07 missing batch', b => { own(b).batchId = 'missing' }],
  ['08 own with supplier', b => { own(b).supplierId = 'audit_supplier' }],
  ['09 external colliding batch', b => { external(b).batchId = 'M07' }],
  ['10 zero Q', b => { b.data.reservations[0].quantity = 0 }],
  ['11 F exceeds Q', b => { b.data.reservations[0].fulfilledQuantity = b.data.reservations[0].quantity + 1 }],
  ['12 ready exceeds living', b => { b.data.batches[0].readyQuantity = b.data.batches[0].currentQuantity + 1 }],
  ['13 inconsistent completed', b => { b.data.shipments[0].shippedQuantity = 5 }],
  ['14 unsafe individual', b => { Object.assign(b.data.batches[0], { initialQuantity: max + 1, currentQuantity: max + 1, readyQuantity: max + 1 }) }],
  ['15 safe individuals / garden overflow', b => { b.data.batches.forEach(batch => Object.assign(batch,
    { initialQuantity: max, currentQuantity: max, readyQuantity: max })) }]
]

describe('REM-03 strict restore integrity', () => {
  beforeEach(seed)
  afterEach(() => vi.restoreAllMocks())

  it.each(originalAudit)('R03-T15/T20/T21 audit %s', async (_id, mutation) => {
    const b = fresh()
    if (typeof mutation === 'string') await rejectWithoutWrites(mutation)
    else { mutation(b); await rejectWithoutWrites(recount(b)) }
  })

  it('R03-T01/T02/T16/T19 native round-trip retains shortage and external exclusion', async () => {
    const before = await snapshot()
    const { backup, jsonString } = await exportWorkspaceBackup()
    expect(validateBackup(backup).valid).toBe(true)
    expect((await restoreWorkspaceBackup(jsonString)).success).toBe(true)
    expect(await snapshot()).toEqual(before)
    const garden = await getGardenAvailability({ view: 'all' })
    const group = garden.groups.find(g => g.key === 'monthong')!
    expect(group.totals.available).toBe(15)
    expect(group.totals.commitmentShortage).toBe(3)
    expect(group.totals.outstanding).toBe(23)
  })

  it.each(['own_batch', 'external_supplier'] as const)('R03-T03/T04 source %s forbids every defined opposite identity', async source => {
    for (const bad of ['', ' ', null, false, 0, {}, [], 'M07']) {
      const b = fresh()
      const r = source === 'own_batch' ? own(b) : external(b)
      Object.assign(r, source === 'own_batch' ? { supplierId: bad } : { batchId: bad })
      await rejectWithoutWrites(b)
    }
    const b = fresh()
    Object.assign(own(b), { supplierId: undefined })
    Object.assign(external(b), { batchId: undefined })
    expect(validateBackup(b).valid).toBe(true)
  })

  it.each(['own_batch', 'external_supplier'] as const)('R03-T05 strict shipment %s identities', async source => {
    for (const bad of ['', ' ', null, false, 0, {}, [], 'audit_supplier']) {
      const b = fresh()
      const line = b.data.shipments[1].lines![0]
      if (source === 'external_supplier') Object.assign(line, { reservationId: 'external', sourceType: source,
        supplierId: 'audit_supplier', batchId: undefined })
      Object.assign(line, source === 'own_batch' ? { supplierId: bad } : { batchId: bad })
      await rejectWithoutWrites(b)
    }
  })

  it.each([
    { reservationId: 'missing' }, { reservationId: 'released' }, { sourceType: 'external_supplier' },
    { batchId: 'M06' }, { batchId: undefined }, { batchId: 7 }, { reservationId: null }
  ])('R03-T06 wrong line reference/source %j', async change => {
    const b = fresh(); Object.assign(b.data.shipments[1].lines![0], change)
    await rejectWithoutWrites(b)
  })

  it('R03-T06 mandatory reservation ID/source identity and supplier role', async () => {
    for (const change of [{ id: '' }, { orderId: ' ' }, { batchId: {} }, { batchId: ' ' }, { sourceType: 'unknown' }]) {
      const b = fresh(); Object.assign(own(b), change); await rejectWithoutWrites(b)
    }
    for (const change of [{ supplierId: 'audit_customer' }, { supplierId: null }, { supplierId: 1 }, { supplierId: '' }]) {
      const b = fresh(); Object.assign(external(b), change); await rejectWithoutWrites(b)
    }
  })

  const quantityPaths = [
    ['R03-T07', 'batches', 'initialQuantity'], ['R03-T07', 'batches', 'currentQuantity'], ['R03-T07', 'batches', 'readyQuantity'],
    ['R03-T08', 'orders', 'requestedQuantity'], ['R03-T09', 'reservations', 'quantity'],
    ['R03-T09', 'reservations', 'fulfilledQuantity'], ['R03-T10', 'shipments', 'plannedQuantity'],
    ['R03-T10', 'shipments', 'shippedQuantity'], ['R03-T10', 'lines', 'quantity']
  ] as const
  it.each(quantityPaths)('%s rejects unsafe/invalid %s.%s', async (_id, table, field) => {
    for (const value of [max + 1, NaN, Infinity, -Infinity, 0.5, -1, '4', null, {}, []]) {
      const b = fresh()
      const record = table === 'lines' ? b.data.shipments[0].lines![0] : b.data[table][0]
      Object.assign(record, { [field]: value })
      expect(validateBackup(b).valid).toBe(false) // NaN/Infinity before JSON serialization.
      await rejectWithoutWrites(b)
    }
  })

  it('R03-T11 checked coverage overflow with individually safe operands', async () => {
    const b = fresh()
    b.data.orders[0].requestedQuantity = max
    own(b).quantity = max
    external(b).quantity = 1
    const result = await rejectWithoutWrites(b)
    expect(result.error).toMatch(/an toàn|overflow/i)
  })

  it('R03-T12 checked shipment line overflow independent of coverage', async () => {
    const b = fresh()
    b.data.shipments = [{ ...b.data.shipments[0], status: 'cancelled', shippedQuantity: 0,
      plannedQuantity: max, lines: [
        { reservationId: 'own_0', sourceType: 'own_batch', batchId: 'M06', quantity: max },
        { reservationId: 'own_1', sourceType: 'own_batch', batchId: 'M07', quantity: 1 }
      ] }]
    b.data.shipments[0].orderId = 'existing'
    const result = await rejectWithoutWrites(recount(b))
    expect(result.error).toMatch(/an toàn|overflow/i)
  })

  it('R03-T13 checked completed totals and fulfillment overflow', async () => {
    const b = fresh()
    b.data.orders[1].requestedQuantity = max
    const r = b.data.reservations.find(r => r.id === 'released')!
    r.quantity = max; r.fulfilledQuantity = max
    b.data.shipments = [max, 1].map((quantity, i) => ({ ...b.data.shipments[0], id: `overflow_${i}`,
      plannedQuantity: quantity, shippedQuantity: quantity,
      lines: [{ reservationId: 'released', sourceType: 'own_batch', batchId: 'Ri6', quantity }] }))
    const result = await rejectWithoutWrites(recount(b))
    expect(result.error).toMatch(/an toàn|overflow/i)
  })

  it('R03-T13 completed order totals overflow without legacy lines', async () => {
    const b = fresh(); b.data.orders[1].requestedQuantity = max
    b.data.shipments = [max, 1].map((q, i) => ({ ...b.data.shipments[0], id: `legacy_${i}`,
      lines: undefined, plannedQuantity: q, shippedQuantity: q }))
    const result = await rejectWithoutWrites(recount(b))
    expect(result.error).toMatch(/an toàn|overflow/i)
  })

  it.each([false, true])('R03-T11 own outstanding overflow across orders (same batch=%s)', async sameBatch => {
    const b = fresh()
    b.data.orders.forEach(o => { o.requestedQuantity = max })
    b.data.reservations = [
      { ...own(b), quantity: max },
      { ...own(b), id: 'second', orderId: 'historical', batchId: sameBatch ? 'M06' : 'M07', quantity: 1 }
    ]
    b.data.shipments = []
    const result = await rejectWithoutWrites(recount(b))
    expect(result.error).toMatch(/an toàn|overflow/i)
  })

  it('R03-T14 public validator safely rejects malformed envelopes', () => {
    for (const raw of [undefined, null, 3, 'x', [], {}, { format: 'vuonuom-backup', data: null }]) {
      expect(() => validateBackup(raw)).not.toThrow()
      expect(validateBackup(raw).valid).toBe(false)
    }
  })

  it('R03-T14 direct runtime facts outside JSON produce controlled failures', () => {
    for (const value of [Symbol('invalid'), Object.create(null)]) {
      for (const field of ['code', 'status', 'currentQuantity']) {
        const b = fresh(); Object.assign(b.data.batches[0], { [field]: value })
        expect(() => validateBackup(b)).not.toThrow()
        expect(validateBackup(b).valid).toBe(false)
      }
      const b = fresh(); Object.assign(own(b), { fulfilledQuantity: value })
      expect(() => validateBackup(b)).not.toThrow()
      expect(validateBackup(b).valid).toBe(false)
    }
  })

  it('R03-T14 all tables required arrays / non-null records', async () => {
    for (const name of Object.keys(fresh().data)) {
      for (const value of [undefined, null, {}, 'x', [null]]) {
        const b = fresh(); Object.assign(b.data, { [name]: value })
        expect(() => validateBackup(b)).not.toThrow()
        expect(validateBackup(b).valid).toBe(false)
        await rejectWithoutWrites(b)
      }
    }
  })

  it('R03-T14 nested structures, settings, counts and event fields', async () => {
    const changes: Mutation[] = [
      b => { Object.assign(b.data.shipments[0], { lines: null }) },
      b => { Object.assign(b.data.shipments[0], { lines: {} }) },
      b => { Object.assign(b.data.shipments[0], { lines: [null] }) },
      b => { Object.assign(b.data.dossiers[0], { documents: {} }) },
      b => { Object.assign(b.data.dossiers[0], { documents: [null] }) },
      b => { Object.assign(b.data.settings[0], { value: {} }) },
      b => { Object.assign(b.data.events[0], { entityId: null }) },
      b => { Object.assign(b, { recordCounts: null }) },
      b => { Object.assign(b, { recordCounts: [] }) },
      b => { Object.assign(b.recordCounts, { batches: '3' }) },
      b => { Object.assign(b.recordCounts, { batches: max + 1 }) },
      b => { Object.assign(b.recordCounts, { batches: 2 }) },
      b => { Object.assign(b, { dbSchemaVersion: '4' }) }
    ]
    for (const change of changes) {
      const b = fresh(); change(b)
      expect(() => validateBackup(b)).not.toThrow()
      expect(validateBackup(b).valid).toBe(false)
      await rejectWithoutWrites(b)
    }
  })

  it('R03-T17 legacy missing fields backfill, IDs and supplied timestamps retained', async () => {
    const legacy = legacyFixture()
    const normalized = normalizeBackup(legacy)
    expect(normalized.data.organizations[0]).toMatchObject(legacy.organization)
    expect(normalized.data.reservations[0].fulfilledQuantity).toBe(5)
    expect(normalized.data.shipments[0].plannedQuantity).toBe(5)
    expect(normalized.data.shipments[0].lines).toEqual([])
    expect(normalized.data.shipments[0].createdAt).toBe('2026-09-01')
    const telemetry = await snapshot()
    expect((await restoreWorkspaceBackup(JSON.stringify(legacy))).success).toBe(true)
    const after = await snapshot()
    for (const name of Object.keys(normalized.data)) expect(after[name]).toEqual(
      [...normalized.data[name as keyof Backup['data']]].sort((a, b) => ('id' in a ? a.id : a.key).localeCompare('id' in b ? b.id : b.key)))
    expect(after.pilotSessions).toEqual(telemetry.pilotSessions)
    expect(after.validationEvents).toEqual(telemetry.validationEvents)
  })

  it('R03-T17 legacy must not erase present malformed fields', async () => {
    for (const change of [
      { reservations: [null] }, { contacts: {} }, { dossiers: null }, { settings: [null] }, { organizations: [null], organization: undefined },
      { reservations: [{ ...legacyFixture().reservations[0], fulfilledQuantity: '5' }] },
      { reservations: [{ ...legacyFixture().reservations[0], fulfilledQuantity: null }] },
      { shipments: [{ ...legacyFixture().shipments[0], lines: {} }] },
      { shipments: [{ ...legacyFixture().shipments[0], plannedQuantity: '5' }] },
      { shipments: [{ ...legacyFixture().shipments[0], shippedQuantity: '5' }] },
      { organization: { id: null, name: 'TEST' } },
      { organization: { id: 'legacy_org', name: null } },
      { organization: { id: 'legacy_org', capabilities: ['unknown'] } },
      { exportedAt: 7 }, { format: 'wrong' },
      { shipments: [{ ...legacyFixture().shipments[0], createdAt: 7 }] },
      { shipments: [{ ...legacyFixture().shipments[0], shippedAt: null }] },
      { settings: [{ key: 'k', value: 'first' }, { key: 'k', value: 'second' }] }
    ]) await rejectWithoutWrites({ ...legacyFixture(), ...change })
  })

  it('R03-T16 historical counts omitted / safe maximum / optional fields retained', async () => {
    const b = fresh()
    b.data.batches = [{ ...b.data.batches[0], initialQuantity: max, currentQuantity: max, readyQuantity: max }]
    b.data.orders = []; b.data.reservations = []; b.data.shipments = []; b.data.dossiers = []
    recount(b)
    Reflect.deleteProperty(b, 'recordCounts') // Existing V1 normalization computes missing metadata.
    Object.assign(b.data.events[0], { extraHistoricalField: { preserve: true } })
    expect((await restoreWorkspaceBackup(JSON.stringify(b))).success).toBe(true)
    expect((await db.batches.get('M06'))?.readyQuantity).toBe(max)
    expect(await db.events.get('initial')).toEqual(b.data.events[0])
  })

  it('R03-T02/T18 completed external allocation, undefined identities and cancelled history remain valid', async () => {
    const b = fresh()
    external(b).fulfilledQuantity = 2
    Object.assign(external(b), { batchId: undefined })
    b.data.shipments.push({ ...b.data.shipments[0], id: 'external_completed', orderId: 'existing',
      plannedQuantity: 2, shippedQuantity: 2, lines: [{ reservationId: 'external', sourceType: 'external_supplier',
        supplierId: 'audit_supplier', batchId: undefined, quantity: 2 }] })
    Object.assign(b.data.shipments[0].lines![0], { supplierId: undefined })
    expect(validateBackup(recount(b)).valid).toBe(true)
    expect((await restoreWorkspaceBackup(JSON.stringify(b))).success).toBe(true)
    const garden = await getGardenAvailability({ view: 'all' })
    expect(garden.groups.find(g => g.key === 'monthong')!.totals.outstanding).toBe(23)
  })

  it('R03-T18 partial/released/fulfilled history and historical optional omissions remain valid', async () => {
    const b = fresh()
    const r = b.data.reservations.find(r => r.id === 'released')!
    r.status = 'fulfilled'; r.quantity = 4
    own(b).quantity = 20; own(b).fulfilledQuantity = 2
    b.data.shipments.push({ ...b.data.shipments[0], id: 'partial', orderId: 'existing', plannedQuantity: 2,
      shippedQuantity: 2, lines: [{ reservationId: 'own_0', sourceType: 'own_batch', batchId: 'M06', quantity: 2 }] })
    b.data.shipments.push({ ...b.data.shipments[1], id: 'cancelled', status: 'cancelled' })
    Reflect.deleteProperty(b.data.dossiers[0], 'documents')
    Object.assign(b.data.events[0], { type: 'historical_unknown', payload: { extra: true } })
    expect(validateBackup(recount(b)).valid).toBe(true)
    expect((await restoreWorkspaceBackup(JSON.stringify(b))).success).toBe(true)
    expect((await getGardenAvailability({ view: 'all' })).groups.find(g => g.key === 'monthong')!.totals.available).toBe(15)
    const omitted = fresh(); own(omitted).fulfilledQuantity = undefined
    expect(validateBackup(omitted).valid).toBe(true)
  })

  it('R03-T22 native write failure after clears rolls back all eleven stores', async () => {
    const before = await snapshot()
    const b = fresh(); b.data.organizations[0].name = 'REPLACEMENT TEST'
    // Actual IndexedDB DataCloneError at the final store, not a repository mock.
    Object.assign(b.data.events[0], { payload: { invalid: () => undefined } })
    const tx = vi.spyOn(db, 'transaction')
    // JSON cannot carry functions; inject at the native put boundary after validation.
    const put = vi.spyOn(IDBObjectStore.prototype, 'put')
    const original = put.getMockImplementation()!
    put.mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === 'events') value = b.data.events[0]
      return original.call(this, value, key)
    })
    await expect(restoreWorkspaceBackup(JSON.stringify(fresh()))).rejects.toThrow()
    expect(tx.mock.calls[0][0]).toBe('rw')
    put.mockRestore(); tx.mockRestore()
    expect(await snapshot()).toEqual(before)
  })
})

function legacyFixture() {
  return {
    version: 1, exportedAt: '2026-09-01', organization: { id: 'legacy_org', name: 'LEGACY TEST ONLY',
      createdAt: '2026-09-01', phone: '0000000000', address: 'SYNTHETIC ONLY' },
    contacts: [{ id: 'legacy_customer', name: 'LEGACY CUSTOMER', roles: ['customer'] }],
    batches: [{ ...fresh().data.batches[0], id: 'legacy_batch' }],
    orders: [{ id: 'legacy_order', customerId: 'legacy_customer', variety: 'Monthong', requestedQuantity: 5, status: 'shipped' }],
    reservations: [{ id: 'legacy_reservation', orderId: 'legacy_order', sourceType: 'own_batch', batchId: 'legacy_batch',
      quantity: 5, status: 'fulfilled', createdAt: '2026-09-01' }],
    shipments: [{ id: 'legacy_shipment', orderId: 'legacy_order', shippedQuantity: 5, status: 'completed', shippedAt: '2026-09-01' }],
    events: []
  }
}
