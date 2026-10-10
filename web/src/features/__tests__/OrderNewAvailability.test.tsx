import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { OrderNewScreen } from '../orders/OrderNewScreen'
import * as orderService from '../../services/orderService'
import { getGardenAvailability } from '../../services/gardenQueryService'
import { db } from '../../data/db'
import { clearAllData } from '../../data/seed'
import { undoService } from '../../services/undoService'
import type { Batch } from '../../domain/batch'
import type { Reservation } from '../../domain/reservation'
import type { DomainEvent } from '../../analytics/events'

async function seed() {
  await db.contacts.put({ id: 'customer', name: 'Anh Hùng', roles: ['customer'] })
  await db.orders.put({ id: 'existing', customerId: 'customer', variety: 'Monthong', requestedQuantity: 2000, status: 'open' })
  const batches: Batch[] = [15, 20].map((readyQuantity, index) => ({
    id: `M0${index + 6}`, code: `M0${index + 6}`, variety: 'Monthong',
    createdAt: '2026-10-01', initialQuantity: 100, currentQuantity: 100, readyQuantity, status: 'ready'
  }))
  await db.batches.bulkPut(batches)
  const reservations: Reservation[] = [18, 5].map((quantity, index) => ({
    id: `own_${index}`, orderId: 'existing', sourceType: 'own_batch', batchId: batches[index].id,
    quantity, fulfilledQuantity: 0, status: 'active', createdAt: '2026-10-01'
  }))
  await db.reservations.bulkPut([...reservations, {
    id: 'external', orderId: 'existing', sourceType: 'external_supplier', supplierId: 'supplier_s',
    batchId: 'M07', quantity: 999, status: 'active', createdAt: '2026-10-01'
  }])
}

function renderForm(variety = 'Monthong') {
  return render(<MemoryRouter initialEntries={[`/orders/new?variety=${encodeURIComponent(variety)}`]}>
    <Routes>
      <Route path="/orders/new" element={<OrderNewScreen />} />
      <Route path="/orders/:id" element={<div data-testid="detail">Đã lưu</div>} />
    </Routes>
  </MemoryRouter>)
}

function requested20() {
  fireEvent.change(screen.getByLabelText('Đơn vị tính số lượng'), { target: { value: 'cay' } })
  fireEvent.change(screen.getByLabelText(/Số lượng đặt/), { target: { value: '20' } })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

const info = (variety: string, requested: number, available: number): orderService.VarietyAvailabilityInfo => ({
  variety, readyQuantity: available, reservedQuantity: 0, availableQuantity: available,
  isShortage: requested > available, shortageAmount: Math.max(requested - available, 0)
})

describe('Issue #42 OrderNew availability (real Dexie)', () => {
  beforeEach(async () => {
    await clearAllData()
    await seed()
    undoService.clearLastMutation()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    undoService.clearLastMutation()
  })

  it('C4210/C4211/C4212: banner20/15/5 and persisted result/event agree with A1 without reserving or blocking shortage', async () => {
    const before = { batches: await db.batches.toArray(), reservations: await db.reservations.toArray() }
    expect((await getGardenAvailability({ view: 'all' })).groups[0].totals).toMatchObject({ available: 15, commitmentShortage: 3 })
    const create = vi.spyOn(orderService, 'createOrder')
    renderForm()
    await screen.findByLabelText(/Khách đặt cây/)
    requested20()
    await screen.findByText(/Đơn cần 20 cây • Hiện vườn còn 15 cây/)
    expect(screen.getByText(/Còn thiếu 5 cây/)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'LƯU ĐƠN HÀNG' }))
    await screen.findByTestId('detail')
    const result = await create.mock.results[0].value as orderService.CreateOrderResult
    expect(result.availabilityInfo?.availableQuantity).toBe(15)
    expect(await db.orders.get(result.order!.id)).toMatchObject({ customerId: 'customer', variety: 'Monthong', requestedQuantity: 20, status: 'open' })
    expect(await db.orders.count()).toBe(2)
    const events = (await db.events.toArray()).filter(e => e.type === 'order_created')
    expect(events).toEqual([expect.objectContaining({
      entityId: result.order!.id, payload: expect.objectContaining({ availableAtGarden: 15, requestedQuantity: 20 })
    })])
    expect(await db.batches.toArray()).toEqual(before.batches)
    expect(await db.reservations.toArray()).toEqual(before.reservations)
  })

  it('C4213: malformed own facts hide false zero/stale totals; retry recovers using real A1', async () => {
    renderForm()
    await screen.findByText(/Hiện vườn còn 15 cây/)
    await db.batches.update('M07', { readyQuantity: 101 })
    requested20()
    await screen.findByText(/Chưa đọc được số cây còn bán. Hãy đọc lại/)
    expect(screen.queryByText(/Hiện vườn còn 15 cây/)).not.toBeInTheDocument()
    expect(screen.queryByText(/chưa có sẵn cây/)).not.toBeInTheDocument()
    expect(screen.queryByText('Cây còn bán:')).not.toBeInTheDocument()
    await db.batches.update('M07', { readyQuantity: 20 })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Đọc lại số cây còn bán' }))
    await screen.findByText(/Đơn cần 20 cây • Hiện vườn còn 15 cây/)
    expect(screen.queryByText(/Chưa đọc được số cây còn bán. Hãy đọc lại/)).not.toBeInTheDocument()
  })

  it('C4213/C4216: real reservation read failure gives error; failed create retains draft and no success; input change recovers', async () => {
    renderForm()
    await screen.findByLabelText(/Khách đặt cây/)
    await screen.findByText(/Hiện vườn còn 15 cây/)
    const before = { orders: await db.orders.toArray(), events: await db.events.toArray() }
    const failRead = () => { throw new Error('storage read failed') }
    db.reservations.hook('reading', failRead)
    try {
      requested20()
      await screen.findByText(/Chưa đọc được số cây còn bán. Hãy đọc lại/)
      await userEvent.setup().click(screen.getByRole('button', { name: 'LƯU ĐƠN HÀNG' }))
      await screen.findByText(/Chưa lưu được đơn hàng trên thiết bị/)
      expect(screen.queryByTestId('detail')).not.toBeInTheDocument()
      expect(screen.getByLabelText(/Số lượng đặt/)).toHaveValue('20')
      expect(await db.orders.toArray()).toEqual(before.orders)
      expect((await db.events.toArray()).filter(e => e.type === 'order_created')).toHaveLength(0)
      expect(undoService.getLastMutation()).toBeNull()
    } finally {
      db.reservations.hook('reading').unsubscribe(failRead)
    }
    fireEvent.change(screen.getByLabelText(/Số lượng đặt/), { target: { value: '21' } })
    await screen.findByText(/Đơn cần 21 cây • Hiện vườn còn 15 cây/)
    expect(screen.getByText(/Còn thiếu 6 cây/)).toBeInTheDocument()
  })

  it('C4217/C4218: event persistence failure reports no success and explicit retry creates only one order/event', async () => {
    renderForm()
    await screen.findByLabelText(/Khách đặt cây/)
    requested20()
    await screen.findByText(/Hiện vườn còn 15 cây/)
    const failEvent = (_key: unknown, event: DomainEvent) => {
      if (event.type === 'order_created') throw new Error('event write failed')
    }
    db.events.hook('creating', failEvent)
    try {
      await userEvent.setup().click(screen.getByRole('button', { name: 'LƯU ĐƠN HÀNG' }))
      await screen.findByText(/Chưa lưu được đơn hàng trên thiết bị/)
      expect(await db.orders.count()).toBe(1)
      expect((await db.events.toArray()).filter(e => e.type === 'order_created')).toHaveLength(0)
      expect(undoService.getLastMutation()).toBeNull()
      expect(screen.queryByTestId('detail')).not.toBeInTheDocument()
    } finally {
      db.events.hook('creating').unsubscribe(failEvent)
    }
    await userEvent.setup().click(screen.getByRole('button', { name: 'LƯU ĐƠN HÀNG' }))
    await screen.findByTestId('detail')
    expect(await db.orders.count()).toBe(2)
    expect((await db.events.toArray()).filter(e => e.type === 'order_created')).toHaveLength(1)
  })

  it('C4209: a genuinely absent variety shows empty only after successful read', async () => {
    renderForm('Unknown')
    await screen.findByText(/Hiện trong vườn chưa có sẵn cây Unknown/)
    expect(screen.queryByText(/Chưa đọc được số cây còn bán/)).not.toBeInTheDocument()
  })

  it.each(['success', 'error'] as const)('C4214: older variety %s cannot overwrite latest result; loading never shows false zero', async oldState => {
    const pending: ReturnType<typeof deferred<orderService.VarietyAvailabilityInfo>>[] = []
    vi.spyOn(orderService, 'getVarietyAvailability').mockImplementation(() => {
      const request = deferred<orderService.VarietyAvailabilityInfo>()
      pending.push(request)
      return request.promise
    })
    const { unmount } = renderForm()
    await waitFor(() => expect(pending).toHaveLength(1))
    expect(screen.queryByText('Cây còn bán:')).not.toBeInTheDocument()
    expect(screen.queryByText(/chưa có sẵn cây/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Loại cây giống/), { target: { value: 'Keo lai BV16' } })
    await waitFor(() => expect(pending).toHaveLength(2))
    await act(async () => { pending[1].resolve(info('Keo lai BV16', 30000, 42)) })
    await screen.findByText(/Hiện vườn còn 42 cây/)
    await act(async () => {
      if (oldState === 'success') pending[0].resolve(info('Monthong', 30000, 15))
      else pending[0].reject(new Error('old read failure'))
    })
    expect(screen.getByText(/Hiện vườn còn 42 cây/)).toBeInTheDocument()
    expect(screen.queryByText(/Hiện vườn còn 15 cây/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Chưa đọc được số cây còn bán/)).not.toBeInTheDocument()
    unmount()
  })

  it('C4214: older success cannot clear latest error; retry keeps current variety/quantity', async () => {
    const pending: ReturnType<typeof deferred<orderService.VarietyAvailabilityInfo>>[] = []
    const read = vi.spyOn(orderService, 'getVarietyAvailability').mockImplementation(() => {
      const request = deferred<orderService.VarietyAvailabilityInfo>()
      pending.push(request)
      return request.promise
    })
    renderForm()
    await waitFor(() => expect(pending).toHaveLength(1))
    requested20()
    await waitFor(() => expect(pending.length).toBeGreaterThan(1))
    const latest = pending.at(-1)!
    await act(async () => { latest.reject(new Error('latest error')) })
    await screen.findByText(/Chưa đọc được số cây còn bán. Hãy đọc lại/)
    await act(async () => {
      for (const request of pending.slice(0, -1)) request.resolve(info('Monthong', 30000, 15))
    })
    expect(screen.queryByText(/Hiện vườn còn 15 cây/)).not.toBeInTheDocument()
    expect(screen.getByText(/Chưa đọc được số cây còn bán. Hãy đọc lại/)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Đọc lại số cây còn bán' }))
    expect(read).toHaveBeenLastCalledWith('Monthong', 20)
    await act(async () => { pending.at(-1)!.resolve(info('Monthong', 20, 15)) })
    await screen.findByText(/Đơn cần 20 cây • Hiện vườn còn 15 cây/)
  })
})
