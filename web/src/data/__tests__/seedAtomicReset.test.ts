import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, VuonUomDatabase } from '../db'
import Dexie from 'dexie'
import { contactRepository } from '../repositories'
import {
  clearAllData, clearBusinessData, resetDemoData, resetToPilotWorkspace,
  DEMO_ORGANIZATION, DEMO_CONTACTS, DEMO_BATCHES, DEMO_ORDERS,
  DEMO_RESERVATIONS, DEMO_SHIPMENTS, DEMO_EVENTS
} from '../seed'

const timestamp = '2026-10-01T00:00:00.000Z'
const injectedRecords = new Set<object>()
function injectCloneFailure(obj: object) {
  injectedRecords.add(obj)
  Object.assign(obj, { nonCloneable: () => 'actual IDB clone failure' })
}
function removeInjectedFields() {
  // Dexie creating hooks receive the seed objects; do not contaminate shared demo constants.
  for (const obj of injectedRecords) delete (obj as Record<string, unknown>).nonCloneable
  injectedRecords.clear()
}
const snapshot = (database = db) => database.transaction('r', database.tables, async () =>
  Object.fromEntries(await Promise.all(database.tables.map(async table => [table.name, await table.toArray()]))))
const ordered = <T extends { id: string }>(records: T[]) => [...records].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

async function expectCompleteDemo() {
  expect(await db.organizations.toArray()).toEqual([DEMO_ORGANIZATION])
  expect(await db.contacts.toArray()).toEqual(ordered(DEMO_CONTACTS))
  expect(await db.batches.toArray()).toEqual(ordered(DEMO_BATCHES))
  expect(await db.orders.toArray()).toEqual(ordered(DEMO_ORDERS))
  expect(await db.reservations.toArray()).toEqual(ordered(DEMO_RESERVATIONS))
  expect(await db.shipments.toArray()).toEqual(ordered(DEMO_SHIPMENTS))
  expect(await db.dossiers.toArray()).toEqual([])
  expect(await db.settings.toArray()).toEqual([
    { key: 'app_mode', value: 'demo' }, { key: 'onboarding_completed', value: 'true' }
  ])
  const events = await db.events.toArray()
  expect(events).toHaveLength(DEMO_EVENTS.length + 1)
  expect(new Set(events.map(event => event.id)).size).toBe(events.length)
  for (const event of DEMO_EVENTS) expect(events).toContainEqual(expect.objectContaining({
    type: event.type, entityType: event.entityType, entityId: event.entityId, payload: event.payload
  }))
  expect(events.filter(event => event.type === 'demo_data_reset')).toHaveLength(1)
}

async function originalWorkspace() {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear()
    await db.organizations.put({ id: 'original_org', name: 'Original TEST ONLY', capabilities: ['produce'] })
    await db.settings.bulkPut([{ key: 'onboarding_completed', value: 'true' },
      { key: 'app_mode', value: 'pilot' }, { key: 'original_setting', value: 'keep me' }])
    await db.contacts.put({ id: 'original_customer', name: 'Customer TEST ONLY', roles: ['customer'] })
    await db.batches.put({ id: 'original_batch', code: 'ORIGINAL', variety: 'Monthong',
      initialQuantity: 100, currentQuantity: 80, readyQuantity: 50, status: 'ready', createdAt: timestamp })
    await db.orders.put({ id: 'original_order', customerId: 'original_customer', variety: 'Monthong',
      requestedQuantity: 30, status: 'partially_shipped' })
    await db.reservations.put({ id: 'original_reservation', orderId: 'original_order', sourceType: 'own_batch',
      batchId: 'original_batch', quantity: 30, fulfilledQuantity: 10, status: 'active', createdAt: timestamp })
    await db.shipments.put({ id: 'original_shipment', orderId: 'original_order', status: 'completed',
      lines: [{ reservationId: 'original_reservation', sourceType: 'own_batch', batchId: 'original_batch', quantity: 10 }],
      plannedQuantity: 10, shippedQuantity: 10, createdAt: timestamp, shippedAt: timestamp })
    await db.dossiers.put({ id: 'original_dossier', batchId: 'original_batch', materialType: 'cutting',
      documents: [{ id: 'original_document', title: 'Original TEST ONLY' }], createdAt: timestamp, updatedAt: timestamp })
    await db.events.put({ id: 'original_event', type: 'shipment_completed', entityType: 'shipment',
      entityId: 'original_shipment', payload: { historical: true, shippedQuantity: 10 }, createdAt: timestamp })
    await db.pilotSessions.put({ id: 'original_session', participantCode: 'P9001', consent: 'accepted',
      mode: 'demo', startedAt: timestamp, endedAt: timestamp })
    await db.validationEvents.put({ id: 'original_telemetry', sessionId: 'original_session', participantCode: 'P9001',
      mode: 'demo', type: 'screen_viewed', route: 'today', createdAt: timestamp })
  })
}

describe('REM-01 destructive reset transactions (real Dexie / native fake-indexeddb writes)', () => {
  beforeEach(originalWorkspace)
  afterEach(() => { removeInjectedFields(); vi.restoreAllMocks() })

  it('RST-01/14: complete demo replaces business records while preserving exact research telemetry', async () => {
    const before = await snapshot()
    await resetDemoData()
    await expectCompleteDemo()
    expect(await db.pilotSessions.toArray()).toEqual(before.pilotSessions)
    expect(await db.validationEvents.toArray()).toEqual(before.validationEvents)
  })

  it('RST-02/06/07: native DataCloneError after clears preserves every original store', async () => {
    const before = await snapshot()
    let attempted = 0
    const invalidClone = (_key: unknown, obj: object) => {
      attempted++
      injectCloneFailure(obj)
    }
    db.batches.hook('creating', invalidClone)
    try {
      await expect(resetDemoData()).rejects.toMatchObject({ name: 'DataCloneError' })
    } finally {
      db.batches.hook('creating').unsubscribe(invalidClone)
      removeInjectedFields()
    }
    expect(attempted).toBeGreaterThan(0)
    expect(await snapshot()).toEqual(before)
  })

  it.each(['contacts', 'events', 'settings'] as const)('RST-03/04/05/06/07/15: native %s write failure rolls back all stores without retry', async store => {
    const before = await snapshot()
    const call = vi.spyOn(contactRepository, 'saveMany')
    const invalidClone = (_key: unknown, obj: object) => { injectCloneFailure(obj) }
    const table = db.table(store)
    table.hook('creating', invalidClone)
    try {
      await expect(resetDemoData()).rejects.toMatchObject({ name: 'DataCloneError' })
    } finally {
      table.hook('creating').unsubscribe(invalidClone)
      removeInjectedFields()
    }
    expect(call).toHaveBeenCalledTimes(1)
    expect(await snapshot()).toEqual(before)
  })

  it('RST-09: explicit retry after native failure produces one complete demo workspace', async () => {
    const before = await snapshot()
    const invalidClone = (_key: unknown, obj: object) => { injectCloneFailure(obj) }
    db.events.hook('creating', invalidClone)
    try {
      await expect(resetDemoData()).rejects.toMatchObject({ name: 'DataCloneError' })
    } finally {
      db.events.hook('creating').unsubscribe(invalidClone)
      removeInjectedFields()
    }
    expect(await snapshot()).toEqual(before)
    await resetDemoData()
    await expectCompleteDemo()
    expect(await db.validationEvents.toArray()).toEqual(before.validationEvents)
  })

  it('RST-08/16: a second connection sees complete committed demo, never intermediate replacement', async () => {
    const reader = new VuonUomDatabase(db.name)
    await reader.open()
    let during: ReturnType<typeof snapshot> | undefined
    let committed = false
    const observe = () => {
      if (!during) {
        Dexie.currentTransaction!.idbtrans.addEventListener('complete', () => { committed = true })
        // Do not await this read inside the writer; the independent connection queues behind its lock.
        during = snapshot(reader)
      }
    }
    db.contacts.hook('creating', observe)
    try {
      await resetDemoData()
      expect(committed).toBe(true)
      expect(during).toBeDefined()
      expect(await during).toEqual(await snapshot())
      await expectCompleteDemo()
    } finally {
      db.contacts.hook('creating').unsubscribe(observe)
      reader.close()
    }
  })

  it('RST-10/14: pilot workspace organization/settings/event commit together and preserve research', async () => {
    const before = await snapshot()
    await resetToPilotWorkspace('New TEST ONLY')
    const after = await snapshot()
    expect(await db.organizations.toArray()).toEqual([expect.objectContaining({ name: 'New TEST ONLY', capabilities: ['produce', 'sell'] })])
    expect(after.settings).toEqual([{ key: 'app_mode', value: 'pilot' }, { key: 'onboarding_completed', value: 'true' }])
    expect(after.events).toEqual([expect.objectContaining({ type: 'pilot_workspace_initialized', payload: { name: 'New TEST ONLY' } })])
    for (const store of ['contacts', 'batches', 'orders', 'reservations', 'shipments', 'dossiers']) expect(after[store]).toEqual([])
    expect(after.pilotSessions).toEqual(before.pilotSessions)
    expect(after.validationEvents).toEqual(before.validationEvents)
  })

  it.each(['organizations', 'settings', 'events'] as const)('RST-11: pilot reset native %s failure preserves full original snapshot', async store => {
    const before = await snapshot()
    const invalidClone = (_key: unknown, obj: object) => { injectCloneFailure(obj) }
    const table = db.table(store)
    table.hook('creating', invalidClone)
    try {
      await expect(resetToPilotWorkspace('New TEST ONLY')).rejects.toMatchObject({ name: 'DataCloneError' })
    } finally {
      table.hook('creating').unsubscribe(invalidClone)
      removeInjectedFields()
    }
    expect(await snapshot()).toEqual(before)
  })

  it('RST-12: factory reset clears all eleven stores, including telemetry', async () => {
    await clearAllData()
    for (const records of Object.values(await snapshot())) expect(records).toEqual([])
  })

  it('RST-13: factory reset failure after business and pilot-session clears rolls back all eleven stores', async () => {
    const before = await snapshot()
    let reached = false
    vi.spyOn(db.validationEvents, 'clear').mockImplementationOnce(() => Dexie.Promise.resolve().then(async () => {
      reached = true
      expect(await db.batches.count()).toBe(0)
      expect(await db.pilotSessions.count()).toBe(0)
      throw new Error('late telemetry clear failure')
    }))
    await expect(clearAllData()).rejects.toThrow('late telemetry clear failure')
    expect(reached).toBe(true)
    expect(await snapshot()).toEqual(before)
  })

  it('clearBusinessData succeeds without clearing research', async () => {
    const before = await snapshot()
    await clearBusinessData()
    const after = await snapshot()
    expect(after.pilotSessions).toEqual(before.pilotSessions)
    expect(after.validationEvents).toEqual(before.validationEvents)
    for (const [store, records] of Object.entries(after)) {
      if (!['pilotSessions', 'validationEvents'].includes(store)) expect(records).toEqual([])
    }
  })

  it('clearBusinessData rolls back earlier clears if a later clear fails', async () => {
    const before = await snapshot()
    vi.spyOn(db.dossiers, 'clear').mockRejectedValueOnce(new Error('late business clear failure'))
    await expect(clearBusinessData()).rejects.toThrow('late business clear failure')
    expect(await snapshot()).toEqual(before)
  })

  it('verification failure rejects and preserves original data rather than committing incomplete settings', async () => {
    const before = await snapshot()
    const skipOnboarding = (_key: unknown, obj: { key: string; value: string }) => {
      if (obj.key === 'onboarding_completed') obj.value = 'false'
    }
    db.settings.hook('creating', skipOnboarding)
    try {
      await expect(resetDemoData()).rejects.toThrow('Dữ liệu sau khi đặt lại không đầy đủ.')
    } finally {
      db.settings.hook('creating').unsubscribe(skipOnboarding)
    }
    expect(await snapshot()).toEqual(before)
  })
})
