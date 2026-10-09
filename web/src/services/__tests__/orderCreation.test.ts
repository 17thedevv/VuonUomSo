import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CreatingHookContext } from 'dexie'
import { db } from '../../data/db'
import { clearAllData, resetDemoData } from '../../data/seed'
import { createOrder, updateOrder, type CreateOrderInput } from '../orderService'
import { undoService } from '../undoService'
import type { DomainEvent } from '../../analytics/events'

const input: CreateOrderInput = {
  customerId: 'contact_hung', variety: 'Keo lai BV16', requestedQuantity: 30000
}

async function snapshot() {
  return {
    orders: await db.orders.toArray(), events: await db.events.toArray(),
    batches: await db.batches.toArray(), reservations: await db.reservations.toArray(),
    shipments: await db.shipments.toArray(), contacts: await db.contacts.toArray()
  }
}

describe('G01/G02 create-order correctness (real Dexie)', () => {
  beforeEach(async () => {
    await clearAllData()
    await resetDemoData()
    undoService.clearLastMutation()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    undoService.clearLastMutation()
  })

  it('rolls back the real order write on required event failure; retry commits exactly once', async () => {
    const before = await snapshot()
    let eventAttempted = false
    const failEvent = (_key: unknown, event: DomainEvent) => {
      if (event.type === 'order_created') {
        eventAttempted = true
        expect(undoService.getLastMutation()).toBeNull()
        throw new Error('required history persistence failed')
      }
    }
    db.events.hook('creating', failEvent)
    try {
      expect(await createOrder(input)).toMatchObject({ success: false, error: expect.any(String) })
    } finally {
      db.events.hook('creating').unsubscribe(failEvent)
    }
    expect(eventAttempted).toBe(true)
    expect(await snapshot()).toEqual(before)
    expect(undoService.getLastMutation()).toBeNull()

    const retry = await createOrder(input)
    expect(retry.success).toBe(true)
    const after = await snapshot()
    expect(after.orders).toHaveLength(before.orders.length + 1)
    expect(after.events).toHaveLength(before.events.length + 1)
    expect(after.events.filter(e => e.type === 'order_created' && e.entityId === retry.order?.id))
      .toHaveLength(1)
    expect(after.events.find(e => e.entityId === retry.order?.id)?.payload).toMatchObject({
      customerId: input.customerId, variety: input.variety, requestedQuantity: 30000, availableAtGarden: 22000
    })
    expect(after.batches).toEqual(before.batches)
    expect(after.reservations).toEqual(before.reservations)
    expect(after.shipments).toEqual(before.shipments)
    expect(undoService.getLastMutation()).toMatchObject({ type: 'create_order', orderId: retry.order?.id })
  })

  it('does not leave orphan history or Undo when order insertion fails', async () => {
    const before = await snapshot()
    const failOrder = () => { throw new Error('order insert failed') }
    db.orders.hook('creating', failOrder)
    try {
      expect(await createOrder(input)).toMatchObject({ success: false })
    } finally {
      db.orders.hook('creating').unsubscribe(failOrder)
    }
    expect(await snapshot()).toEqual(before)
    expect(undoService.getLastMutation()).toBeNull()
  })

  it('waits for transaction commit before capturing Undo, even after event write succeeds', async () => {
    const before = await snapshot()
    const recordUndo = vi.spyOn(undoService, 'recordMutation')
    let eventWritten = false
    const abortAfterEvent: Parameters<typeof db.events.hook.creating.subscribe>[0] = function (this: CreatingHookContext<DomainEvent, string>, _key, event, tx) {
      if (event.type === 'order_created') {
        this.onsuccess = () => {
          eventWritten = true
          tx.abort()
        }
      }
    }
    db.events.hook('creating', abortAfterEvent)
    try {
      expect(await createOrder(input)).toMatchObject({ success: false })
    } finally {
      db.events.hook('creating').unsubscribe(abortAfterEvent)
    }
    expect(eventWritten).toBe(true)
    expect(await snapshot()).toEqual(before)
    expect(recordUndo).not.toHaveBeenCalled()
    expect(undoService.getLastMutation()).toBeNull()
  })

  it('rolls back order creation when required availability feedback cannot be read', async () => {
    const before = await snapshot()
    const failRead = () => { throw new Error('availability read failed') }
    db.batches.hook('reading', failRead)
    try {
      expect(await createOrder(input)).toMatchObject({ success: false })
    } finally {
      db.batches.hook('reading').unsubscribe(failRead)
    }
    expect(await snapshot()).toEqual(before)
    expect(undoService.getLastMutation()).toBeNull()
  })

  it('propagates customer-read failure as the existing service failure result', async () => {
    const before = await snapshot()
    const failRead = () => { throw new Error('customer read failed') }
    db.contacts.hook('reading', failRead)
    try {
      expect(await createOrder(input)).toMatchObject({ success: false, error: expect.any(String) })
    } finally {
      db.contacts.hook('reading').unsubscribe(failRead)
    }
    expect(await snapshot()).toEqual(before)
    expect(undoService.getLastMutation()).toBeNull()
  })

  it('does not replace an earlier valid Undo intent with a failed create', async () => {
    const previous = { type: 'create_batch' as const, batchId: 'batch_bv16_12', batchCode: 'BV16 #12', description: 'previous' }
    undoService.recordMutation(previous, 0)
    const failEvent = () => { throw new Error('history failure') }
    db.events.hook('creating', failEvent)
    try {
      expect(await createOrder(input)).toMatchObject({ success: false })
    } finally {
      db.events.hook('creating').unsubscribe(failEvent)
    }
    expect(undoService.getLastMutation()).toEqual(previous)
  })

  it('does not report a committed order as failed if optional Undo notification throws', async () => {
    const before = await snapshot()
    vi.spyOn(undoService, 'recordMutation').mockImplementationOnce(() => { throw new Error('UI listener failed') })
    const result = await createOrder(input)
    expect(result.success).toBe(true)
    expect(await db.orders.count()).toBe(before.orders.length + 1)
    expect(await db.events.where('entityId').equals(result.order!.id).count()).toBe(1)
  })

  it.each([1, 2, 100, Number.MAX_SAFE_INTEGER])('preserves valid quantity %s without rounding', async quantity => {
    const result = await createOrder({ ...input, requestedQuantity: quantity })
    expect(result.success).toBe(true)
    expect((await db.orders.get(result.order!.id))?.requestedQuantity).toBe(quantity)
    expect((await updateOrder({ orderId: result.order!.id, requestedQuantity: quantity })).success).toBe(true)
  })

  it.each([0, -1, -100, 1.1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects quantity %s before writes or Undo', async quantity => {
      const before = await snapshot()
      expect(await createOrder({ ...input, requestedQuantity: quantity })).toMatchObject({ success: false })
      expect(await snapshot()).toEqual(before)
      expect(undoService.getLastMutation()).toBeNull()
    }
  )

  it.each([undefined, 0, 1, 35000, Number.MAX_SAFE_INTEGER])('preserves valid optional price %s', async unitPrice => {
    const result = await createOrder({ ...input, unitPrice })
    expect(result.success).toBe(true)
    expect((await db.orders.get(result.order!.id))?.unitPrice).toBe(unitPrice)
    expect((await updateOrder({ orderId: result.order!.id, unitPrice })).success).toBe(true)
  })

  it.each([-1, 1.1, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects price %s before writes or Undo', async unitPrice => {
      const before = await snapshot()
      expect(await createOrder({ ...input, unitPrice })).toMatchObject({ success: false })
      expect(await snapshot()).toEqual(before)
      expect(undoService.getLastMutation()).toBeNull()
    }
  )

  it('preserves customer/variety error priority and optional metadata normalization', async () => {
    expect(await createOrder({ ...input, customerId: '', requestedQuantity: Infinity }))
      .toMatchObject({ success: false, error: 'Vui lòng chọn hoặc thêm khách hàng.' })
    expect(await createOrder({ ...input, variety: ' ', requestedQuantity: Infinity }))
      .toMatchObject({ success: false, error: 'Vui lòng chọn loại cây giống.' })
    const result = await createOrder({ ...input, customerId: ' contact_hung ', variety: ' Keo lai BV16 ',
      note: ' hẹn gọi ', requestedDate: '2026-10-20', unitPrice: 0 })
    expect(result.order).toMatchObject({ ...input, note: 'hẹn gọi', requestedDate: '2026-10-20', unitPrice: 0, status: 'open' })
    expect(await db.orders.get(result.order!.id)).toEqual(result.order)
  })
})
