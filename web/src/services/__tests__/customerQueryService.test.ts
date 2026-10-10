import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, VuonUomDatabase } from '../../data/db'
import { clearAllData } from '../../data/seed'
import { contactRepository, shipmentRepository } from '../../data/repositories'
import { getCustomerDetail, getCustomers } from '../customerQueryService'
import { businessSnapshot, customerFixture, orderA, orderB } from '../../features/customers/__tests__/customerFixtures'
import type { Contact } from '../../domain/contact'
import type { Reservation } from '../../domain/reservation'

beforeEach(async () => { await clearAllData(); await customerFixture() })
afterEach(() => vi.restoreAllMocks())

describe('B2 coherent customer projection (real Dexie)', () => {
  it('B203/B204/B208 filters explicit roles, preserves duplicate names/phones as separate IDs, without finance', async () => {
    await db.contacts.put({ id: 'legacy', name: 'Legacy', roles: [] })
    const view = await getCustomers()
    expect(view.customers.map(customer => customer.id)).toEqual(['customer-a', 'customer-b', 'customer-c'])
    expect(view.customers[0]).toEqual({ id: 'customer-a', name: 'Anh Hùng', phone: '0912345678', orderCount: 2, outstanding: 120, shipped: 80 })
    expect(view.customers[2].orderCount).toBe(0)
    expect(JSON.stringify(view)).not.toMatch(/999|PRIVATE NOTE|debt|paid|unitPrice/)
  })
  it('B209/B212/B214/B215/B216/B217/B218/B219 derives O60 per order, completed S40 and canonical C100', async () => {
    const detail = (await getCustomerDetail('customer-a'))!
    expect(detail.orders).toHaveLength(2)
    for (const row of detail.orders) expect(row).toMatchObject({ requestedQuantity: 100, outstanding: 60, shipped: 40, shortage: 0, displayStatus: { kind: 'partially_shipped' } })
    expect(detail.completedShipments.map(shipment => shipment.shipmentId)).toEqual(['shipped-a', 'shipped-b'])
    expect(detail.completedShipments[1].shippedAt).toBeUndefined()
    expect(detail.customer.outstanding).toBe(detail.orders.reduce((sum, row) => sum + row.outstanding, 0))
    expect(detail.customer.shipped).toBe(detail.orders.reduce((sum, row) => sum + row.shipped, 0))
  })
  it('released historical F contributes C40 but O0, rather than shortage R−O', async () => {
    await db.reservations.delete('external')
    const row = (await getCustomerDetail('customer-a'))!.orders.find(order => order.orderId === orderB)!
    expect(row).toMatchObject({ outstanding: 0, shipped: 40, shortage: 60 })
  })
  it('B213 fulfilled has O0, while shipped/cancelled orders stay in history', async () => {
    await db.reservations.update('own-active', { status: 'fulfilled', fulfilledQuantity: 100 })
    await db.shipments.update('shipped-a', { plannedQuantity: 100, shippedQuantity: 100, lines: [{ reservationId: 'own-active', sourceType: 'own_batch', batchId: 'batch', quantity: 100 }] })
    await db.shipments.update('planned', { status: 'cancelled' })
    await db.batches.update('batch', { currentQuantity: 60, readyQuantity: 60 })
    await db.orders.update(orderA, { status: 'shipped' })
    await db.orders.put({ id: 'cancelled-order', customerId: 'customer-a', variety: 'Monthong', requestedQuantity: 10, status: 'cancelled' })
    const detail = (await getCustomerDetail('customer-a'))!
    expect(detail.orders.find(order => order.orderId === orderA)).toMatchObject({ outstanding: 0, shipped: 100, shortage: 0, displayStatus: { kind: 'shipped' } })
    expect(detail.orders.find(order => order.orderId === 'cancelled-order')?.displayStatus.kind).toBe('cancelled')
    expect(detail.customer).toMatchObject({ orderCount: 3, outstanding: 60, shipped: 140 })
  })
  it('B205 missing/deleted/supplier-only direct details are null, never guessed by phone', async () => {
    expect(await getCustomerDetail('missing')).toBeNull()
    expect(await getCustomerDetail('supplier')).toBeNull()
    await db.contacts.delete('customer-c')
    expect(await getCustomerDetail('customer-c')).toBeNull()
    await clearAllData()
    expect((await getCustomers()).customers).toEqual([])
  })
  it.each(['missing', 'supplier', 'legacy'])('order linked to %s rejects the whole read instead of inventing customer role', async customerId => {
    await db.contacts.put({ id: 'legacy', name: 'Legacy', roles: [] })
    await db.orders.update(orderA, { customerId })
    await expect(getCustomers()).rejects.toThrow()
    await expect(getCustomerDetail('customer-b')).rejects.toThrow()
  })
  it.each([-1, 0, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid requested quantity %s with no repairs', async requestedQuantity => {
    await db.orders.update(orderA, { requestedQuantity })
    const before = await businessSnapshot()
    await expect(getCustomers()).rejects.toThrow()
    expect(await businessSnapshot()).toEqual(before)
  })
  it.each([
    { quantity: NaN }, { quantity: Infinity }, { quantity: Number.MAX_SAFE_INTEGER + 1 }, { quantity: 0.5 },
    { fulfilledQuantity: 101 }, { fulfilledQuantity: -1 }, { fulfilledQuantity: NaN }, { status: 'invalid' },
    { supplierId: 'wrong-source' }, { orderId: 'missing' }, { id: '' }, { batchId: '   ' }
  ])('rejects corrupt reservation facts %j without partial totals', async changes => {
    await db.reservations.update('own-active', changes as Partial<Reservation>)
    await expect(getCustomers()).rejects.toThrow()
  })
  it('invalid external shape is an error, rather than own-stock filtering or accepting source collision', async () => {
    await db.reservations.update('external', { batchId: 'batch' })
    await expect(getCustomers()).rejects.toThrow()
  })
  it.each([NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid shippedQuantity %s', async shippedQuantity => {
    await db.shipments.update('shipped-a', { shippedQuantity })
    await expect(getCustomers()).rejects.toThrow()
  })
  it.each(['coverage', 'order shipments', 'customer outstanding', 'customer shipped'])('fails closed at %s overflow', async scope => {
    const max = Number.MAX_SAFE_INTEGER
    if (scope === 'coverage') {
      await db.reservations.update('own-active', { quantity: max, fulfilledQuantity: 0 })
      await db.reservations.put({ id: 'overflow', orderId: orderA, sourceType: 'external_supplier', supplierId: 'supplier', quantity: 1, status: 'active', createdAt: '2026-10-01' })
    } else if (scope === 'order shipments') {
      await db.shipments.update('shipped-a', { shippedQuantity: max, plannedQuantity: max })
      await db.shipments.put({ id: 'overflow', orderId: orderA, shippedQuantity: 1, plannedQuantity: 1, status: 'completed' })
    } else if (scope === 'customer outstanding') {
      await db.reservations.update('own-active', { quantity: max, fulfilledQuantity: 0 })
    } else await db.shipments.update('shipped-a', { shippedQuantity: max, plannedQuantity: max })
    await expect(getCustomers()).rejects.toThrow()
  })
  it('B226 read failure rejects, rather than reporting no customers', async () => {
    vi.spyOn(shipmentRepository, 'getAll').mockRejectedValueOnce(new Error('read failure'))
    await expect(getCustomers()).rejects.toThrow('read failure')
  })
  it('B229 successful reads do not write any business facts', async () => {
    const before = await businessSnapshot()
    await getCustomers(); await getCustomerDetail('customer-a')
    expect(await businessSnapshot()).toEqual(before)
  })
  it('read-first four-table view stays BEFORE while atomic writer is queued between reads', async () => {
    const writer = new VuonUomDatabase(db.name); await writer.open()
    const original = contactRepository.getAll.bind(contactRepository)
    let write: Promise<unknown> | undefined
    vi.spyOn(contactRepository, 'getAll').mockImplementationOnce(async () => {
      const result = await original()
      Dexie.ignoreTransaction(() => { write = writer.transaction('rw', [writer.contacts, writer.orders, writer.reservations, writer.shipments, writer.batches], async () => {
        await writer.contacts.update('customer-a', { name: 'AFTER' })
        await writer.orders.update(orderA, { requestedQuantity: 200 })
        await writer.reservations.update('own-active', { quantity: 200, fulfilledQuantity: 80 })
        await writer.shipments.update('shipped-a', { plannedQuantity: 80, shippedQuantity: 80,
          lines: [{ reservationId: 'own-active', sourceType: 'own_batch', batchId: 'batch', quantity: 80 }] })
        await writer.batches.update('batch', { initialQuantity: 240 })
      }) })
      return result
    })
    try {
      const before = (await getCustomerDetail('customer-a'))!
      expect(before.customer.name).toBe('Anh Hùng')
      expect(before.orders.find(order => order.orderId === orderA)).toMatchObject({ requestedQuantity: 100, outstanding: 60, shipped: 40 })
      await write
      const after = (await getCustomerDetail('customer-a'))!
      expect(after.customer.name).toBe('AFTER')
      expect(after.orders.find(order => order.orderId === orderA)).toMatchObject({ requestedQuantity: 200, outstanding: 120, shipped: 80 })
    } finally { writer.close() }
  })
  it.each([{ roles: undefined }, { roles: ['unknown'] }])('legacy roles %j do not become customers', async changes => {
    await db.contacts.put({ id: 'legacy', name: 'Legacy', ...changes } as unknown as Contact)
    expect((await getCustomers()).customers.some(customer => customer.id === 'legacy')).toBe(false)
  })
  it('write-first read enqueued between four-table changes sees whole AFTER', async () => {
    const writer = new VuonUomDatabase(db.name); await writer.open()
    let read: ReturnType<typeof getCustomerDetail> | undefined
    try {
      await writer.transaction('rw', [writer.contacts, writer.orders, writer.reservations, writer.shipments, writer.batches], async () => {
        await writer.contacts.update('customer-a', { name: 'AFTER' })
        Dexie.ignoreTransaction(() => { read = getCustomerDetail('customer-a') })
        await writer.orders.update(orderA, { requestedQuantity: 200 })
        await writer.reservations.update('own-active', { quantity: 200, fulfilledQuantity: 80 })
        await writer.shipments.update('shipped-a', { plannedQuantity: 80, shippedQuantity: 80,
          lines: [{ reservationId: 'own-active', sourceType: 'own_batch', batchId: 'batch', quantity: 80 }] })
        await writer.batches.update('batch', { initialQuantity: 240 })
      })
      expect(read).toBeDefined()
      const after = (await read)!
      expect(after.customer).toMatchObject({ name: 'AFTER', outstanding: 180, shipped: 120 })
      expect(after.orders.find(order => order.orderId === orderA)).toMatchObject({ requestedQuantity: 200, outstanding: 120, shipped: 80 })
    } finally { writer.close() }
  })
  it.each(['.', '..', 'bad\u202eID'])('unroutable identity %s rejects without repairs', async id => {
    await db.contacts.put({ id, name: 'Imported', roles: ['customer'] })
    const before = await businessSnapshot()
    await expect(getCustomers()).rejects.toThrow()
    expect(await businessSnapshot()).toEqual(before)
  })
})
