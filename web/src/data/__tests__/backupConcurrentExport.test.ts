import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, VuonUomDatabase } from '../db'
import { exportWorkspaceBackup, restoreWorkspaceBackup, validateBackup } from '../backup'
import type { VuonUomBackupV1 } from '../backup/backup.types'
import { resetDemoData, resetToPilotWorkspace } from '../seed'

type Data = VuonUomBackupV1['data']
const stores = ['organizations', 'settings', 'contacts', 'batches', 'orders',
  'reservations', 'shipments', 'dossiers', 'events'] as const
const time = '2026-10-10T00:00:00.000Z'
const snapshot = (connection = db): Promise<Data> => connection.transaction('r', stores, async () =>
  Object.fromEntries(await Promise.all(stores.map(async name => [name, await connection.table(name).toArray()]))) as Data)
let writer: VuonUomDatabase

async function seed() {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear()
    await db.organizations.put({ id: 'org', name: 'SYNTHETIC A', capabilities: ['produce', 'sell'] })
    await db.settings.bulkPut([{ key: 'app_mode', value: 'demo' }, { key: 'onboarding_completed', value: 'true' }])
    await db.contacts.put({ id: 'customer', name: 'Customer TEST A', roles: ['customer'] })
    await db.batches.put({ id: 'M07', code: 'M07', variety: 'Monthong', initialQuantity: 50,
      currentQuantity: 45, readyQuantity: 30, status: 'ready', createdAt: time })
    await db.orders.put({ id: 'order', customerId: 'customer', variety: 'Monthong', requestedQuantity: 20,
      status: 'partially_reserved', note: 'A' })
    await db.reservations.put({ id: 'reservation', orderId: 'order', sourceType: 'own_batch', batchId: 'M07',
      quantity: 10, fulfilledQuantity: 0, status: 'active', createdAt: time })
    await db.shipments.put({ id: 'shipment', orderId: 'order', status: 'planned', plannedQuantity: 2,
      shippedQuantity: 0, createdAt: time,
      lines: [{ reservationId: 'reservation', sourceType: 'own_batch', batchId: 'M07', quantity: 2 }] })
    await db.dossiers.put({ id: 'dossier', batchId: 'M07', materialType: 'cutting', documents: [],
      sourceName: 'A', createdAt: time, updatedAt: time })
    await db.events.put({ id: 'event', type: 'inventory_updated', entityType: 'batch', entityId: 'M07',
      payload: { state: 'A', ready: 30, outstanding: 10 }, createdAt: time })
    await db.pilotSessions.put({ id: 'session', participantCode: 'TEST', consent: 'accepted',
      mode: 'demo', startedAt: time, endedAt: time })
    await db.validationEvents.put({ id: 'research', sessionId: 'session', participantCode: 'TEST',
      mode: 'demo', type: 'screen_viewed', route: 'today', createdAt: time })
  })
}

function nextState(before: Data): Data {
  const after = structuredClone(before)
  after.organizations[0].name = 'SYNTHETIC B'
  after.settings[0].value = 'pilot'
  after.contacts[0].name = 'Customer TEST B'
  after.batches[0].readyQuantity = 25
  after.orders[0].note = 'B'
  after.reservations[0].quantity = 12
  after.shipments[0].plannedQuantity = 3
  after.shipments[0].lines![0].quantity = 3
  after.dossiers[0].sourceName = 'B'
  after.events[0].payload = { state: 'B', ready: 25, outstanding: 12 }
  return after
}

async function writeState(after: Data) {
  for (const name of stores) await writer.table(name).bulkPut(after[name])
}

function record(label: string, data: Data, before: Data, after: Data, timeline: string[], backup: VuonUomBackupV1) {
  const classification = JSON.stringify(data) === JSON.stringify(before) ? 'BEFORE'
    : JSON.stringify(data) === JSON.stringify(after) ? 'AFTER' : 'HYBRID'
  console.info('EXPORT_EVIDENCE', JSON.stringify({ label, classification, timeline,
    environment: 'real Dexie + fake-indexeddb; two connections', validation: validateBackup(backup).valid }))
  return classification
}

// Delay issuing real reservation/event requests until the first actual batch read finishes.
// The writer is requested at that boundary, before the held reads. No facts are mocked,
// no timer sleeps, and no await of writer completion inside the reader transaction.
function readerBoundary(onRead: () => void, timeline: string[]) {
  let release!: () => void
  const gate = new Dexie.Promise<void>(resolve => { release = resolve })
  const batchRead = db.batches.toArray.bind(db.batches)
  vi.spyOn(db.batches, 'toArray').mockImplementationOnce(() => batchRead().then(rows => {
    timeline.push('reader native batches success')
    const transaction = Dexie.currentTransaction
    transaction?.idbtrans.addEventListener('complete', () => timeline.push('reader transaction complete'))
    Dexie.ignoreTransaction(onRead)
    release()
    return rows
  }))
  const reservationRead = db.reservations.toArray.bind(db.reservations)
  vi.spyOn(db.reservations, 'toArray').mockImplementationOnce(() => gate.then(() => {
    timeline.push('reader native reservations requested')
    return reservationRead()
  }))
  const eventRead = db.events.toArray.bind(db.events)
  vi.spyOn(db.events, 'toArray').mockImplementationOnce(() => gate.then(() => {
    timeline.push('reader native events requested')
    return eventRead()
  }))
}

describe('REM-02 coherent backup export', () => {
  beforeEach(async () => { await seed(); writer = new VuonUomDatabase(db.name); await writer.open() })
  afterEach(() => { vi.restoreAllMocks(); writer.close() })

  it.each([1, 2, 3, 4, 5])('EXP-03/05/06: reader first returns all BEFORE (iteration %i)', async iteration => {
    const before = await snapshot(), after = nextState(before), timeline: string[] = []
    let writing: Promise<void> | undefined
    readerBoundary(() => {
      timeline.push('writer requested on second connection')
      writing = writer.transaction('rw', stores, async () => {
        timeline.push('writer native transaction scope entered')
        await writeState(after)
      }).then(() => { timeline.push('writer commit resolved') })
    }, timeline)
    const result = await exportWorkspaceBackup()
    expect(writing).toBeDefined()
    await writing
    expect(await snapshot()).toEqual(after)
    expect(record('reader-first-' + iteration, result.backup.data, before, after, timeline, result.backup)).toBe('BEFORE')
    expect(result.backup.data).toEqual(before)
    expect(timeline.indexOf('writer requested on second connection')).toBeLessThan(timeline.indexOf('reader native reservations requested'))
    expect(timeline.indexOf('reader native events requested')).toBeLessThan(timeline.indexOf('reader transaction complete'))
    expect(timeline.indexOf('reader transaction complete')).toBeLessThan(timeline.indexOf('writer commit resolved'))
  })

  it.each([1, 2, 3, 4, 5])('EXP-04/05/06: writer first returns all AFTER (iteration %i)', async iteration => {
    const before = await snapshot(), after = nextState(before), timeline: string[] = []
    let exporting: ReturnType<typeof exportWorkspaceBackup> | undefined
    await writer.transaction('rw', stores, async () => {
      await writer.batches.put(after.batches[0])
      timeline.push('writer native batches success; rest not yet written')
      exporting = Dexie.ignoreTransaction(() => exportWorkspaceBackup())
      timeline.push('export requested on reader connection during writer')
      await writeState(after)
    })
    timeline.push('writer commit resolved')
    const result = await exporting!
    timeline.push('export resolved')
    expect(record('writer-first-' + iteration, result.backup.data, before, after, timeline, result.backup)).toBe('AFTER')
    expect(result.backup.data).toEqual(after)
    expect(await snapshot()).toEqual(after)
  })

  it('EXP-02/08/13: exact nine-store export, envelope/JSON compatibility and no writes to any of eleven stores', async () => {
    const before = await snapshot()
    const allBefore = await db.transaction('r', db.tables, () => Promise.all(db.tables.map(t => t.toArray())))
    const { backup, jsonString } = await exportWorkspaceBackup()
    expect(backup.data).toEqual(before)
    expect(JSON.parse(jsonString)).toEqual(backup)
    expect(backup).toMatchObject({ format: 'vuonuom-backup', formatVersion: 1, dbSchemaVersion: 4 })
    expect(Number.isFinite(Date.parse(backup.exportedAt))).toBe(true)
    expect(Object.keys(backup.data)).toEqual(stores)
    expect(backup.recordCounts).toEqual(Object.fromEntries(stores.map(name => [name, before[name].length])))
    expect(await db.transaction('r', db.tables, () => Promise.all(db.tables.map(t => t.toArray())))).toEqual(allBefore)
  })

  it('EXP-07: schema-valid hybrid is not a concurrency oracle', async () => {
    const { backup } = await exportWorkspaceBackup()
    const before = backup.data, after = nextState(before)
    const hybrid = { ...backup, data: { ...after, batches: before.batches } }
    expect(validateBackup(hybrid).valid).toBe(true)
    expect(hybrid.data).not.toEqual(before)
    expect(hybrid.data).not.toEqual(after)
  })

  it('EXP-09: actual native read transaction abort rejects whole export, with no download or writes', async () => {
    const before = await snapshot(), telemetry = await db.validationEvents.toArray()
    const original = IDBObjectStore.prototype.getAll
    let reached = false
    vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (this.name === 'reservations') {
        reached = true
        this.transaction.abort()
      }
      return original.apply(this, args)
    })
    const download = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    await expect(exportWorkspaceBackup()).rejects.toThrow()
    expect(reached).toBe(true)
    expect(download).not.toHaveBeenCalled()
    vi.restoreAllMocks()
    expect(await snapshot()).toEqual(before)
    expect(await db.validationEvents.toArray()).toEqual(telemetry)
  })

  it('EXP-10: writer abort does not leak staged AFTER records', async () => {
    const before = await snapshot(), after = nextState(before), timeline: string[] = []
    let exporting: ReturnType<typeof exportWorkspaceBackup> | undefined
    await expect(writer.transaction('rw', stores, async () => {
      await writeState(after)
      timeline.push('writer native writes done, uncommitted')
      exporting = Dexie.ignoreTransaction(() => exportWorkspaceBackup())
      Dexie.currentTransaction!.abort()
      timeline.push('writer abort requested')
    })).rejects.toThrow()
    const result = await exporting!
    expect(record('writer-abort', result.backup.data, before, after, timeline, result.backup)).toBe('BEFORE')
    expect(result.backup.data).toEqual(before)
    expect(await snapshot()).toEqual(before)
  })

  it('keeps validation fail-closed after a successful snapshot without repairing stored facts', async () => {
    await db.batches.update('M07', { readyQuantity: 46 })
    const before = await snapshot()
    await expect(exportWorkspaceBackup()).rejects.toThrow('Không thể tạo bản sao dữ liệu')
    expect(await snapshot()).toEqual(before)
  })

  it('serialization failure rejects without download or database writes', async () => {
    await db.events.update('event', { payload: { unsupported: BigInt(1) } })
    const before = await snapshot(), download = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    await expect(exportWorkspaceBackup()).rejects.toThrow()
    expect(download).not.toHaveBeenCalled()
    expect(await snapshot()).toEqual(before)
  })

  it.each(['demo', 'pilot'] as const)('EXP-11: reader-first %s atomic reset cannot mix replacement with originals', async mode => {
    const before = await snapshot(), timeline: string[] = []
    let resetting: Promise<void> | undefined
    readerBoundary(() => {
      timeline.push('atomic reset requested independently')
      resetting = mode === 'demo' ? resetDemoData() : resetToPilotWorkspace('SYNTHETIC replacement')
    }, timeline)
    const result = await exportWorkspaceBackup()
    await resetting
    const after = await snapshot()
    expect(record('reset-reader-first-' + mode, result.backup.data, before, after, timeline, result.backup)).toBe('BEFORE')
    expect(result.backup.data).toEqual(before)
    expect(after.organizations).not.toEqual(before.organizations)
  })

  it.each(['demo', 'pilot'] as const)('EXP-11: export requested during %s reset sees complete replacement', async mode => {
    const before = await snapshot(), timeline: string[] = []
    let exporting: ReturnType<typeof exportWorkspaceBackup> | undefined
    const clear = db.contacts.clear.bind(db.contacts)
    vi.spyOn(db.contacts, 'clear').mockImplementationOnce(() => clear().then(() => {
      timeline.push('reset native clear success; replacement not yet seeded')
      exporting = Dexie.ignoreTransaction(() => exportWorkspaceBackup())
    }))
    await (mode === 'demo' ? resetDemoData() : resetToPilotWorkspace('SYNTHETIC replacement'))
    const after = await snapshot(), result = await exporting!
    expect(record('reset-writer-first-' + mode, result.backup.data, before, after, timeline, result.backup)).toBe('AFTER')
    expect(result.backup.data).toEqual(after)
  })

  it('EXP-12: exported JSON restores exact business records and persists after reopen', async () => {
    const result = await exportWorkspaceBackup()
    await writer.transaction('rw', stores, () => writeState(nextState(result.backup.data)))
    await restoreWorkspaceBackup(result.jsonString)
    db.close(); await db.open()
    expect(await snapshot()).toEqual(result.backup.data)
  })
})
