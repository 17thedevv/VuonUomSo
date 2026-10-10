import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GardenAvailabilityScreen } from '../garden/GardenAvailabilityScreen'
import { OrderNewScreen } from '../orders/OrderNewScreen'
import { db } from '../../data/db'
import { clearAllData } from '../../data/seed'
import { undoService } from '../../services/undoService'
import type { DomainEvent } from '../../analytics/events'

const gardenUrl = '/garden?q=Monthong&view=all&open=monthong'
function mount(entries: NonNullable<Parameters<typeof createMemoryRouter>[1]>['initialEntries'] = [gardenUrl]) {
  const router = createMemoryRouter([
    { path: '/garden', element: <GardenAvailabilityScreen /> },
    { path: '/orders/new', element: <OrderNewScreen /> },
    { path: '/orders', element: <h1>Danh sách đơn</h1> },
    { path: '/orders/:id', element: <h1>Chi tiết đơn</h1> },
    { path: '/batches', element: <h1>Danh sách lô</h1> }
  ], { initialEntries: entries })
  return { ...render(<RouterProvider router={router} />), router }
}
const snapshot = () => Promise.all([db.batches.toArray(), db.reservations.toArray(), db.orders.toArray(), db.events.toArray(), db.shipments.toArray(), db.contacts.toArray()])
function selectedVariety() {
  const select = screen.getByLabelText(/Loại cây giống/) as HTMLSelectElement
  expect(select.selectedOptions[0]?.textContent).toBe(select.value)
  return select.value
}
describe('Garden → Ghi đơn (real Dexie)', () => {
  beforeEach(async () => {
    await clearAllData(); undoService.clearLastMutation()
    await db.contacts.put({ id: 'customer', name: 'Khách Monthong', roles: ['customer'] })
    await db.batches.bulkPut([
      { id: 'a', code: 'M06', variety: ' Monthong ', createdAt: '2026-10-01', initialQuantity: 30, currentQuantity: 30, readyQuantity: 15, status: 'ready' },
      { id: 'b', code: 'M07', variety: 'MONTHONG', createdAt: '2026-10-01', initialQuantity: 40, currentQuantity: 40, readyQuantity: 20, status: 'ready' }
    ])
    await db.reservations.bulkPut([
      { id: 'ra', orderId: 'o', sourceType: 'own_batch', batchId: 'a', quantity: 18, status: 'active', createdAt: '2026-10-01' },
      { id: 'rb', orderId: 'o', sourceType: 'own_batch', batchId: 'b', quantity: 5, status: 'active', createdAt: '2026-10-01' }
    ])
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks(); undoService.clearLastMutation() })

  it.each([
    ['Ghi đơn giống Monthong', 'Monthong'],
    ['Ghi đơn từ lô M06', 'Monthong'],
    ['Ghi đơn từ lô M07', 'MONTHONG']
  ])('%s preserves the visible draft, unchanged quantity default and Garden context without writes', async (entry, variety) => {
    const before = await snapshot()
    const { router } = mount()
    const link = await screen.findByRole('link', { name: entry })
    expect(link.closest('a')?.parentElement?.closest('a')).toBeNull()
    fireEvent.click(link)
    expect(new URLSearchParams(router.state.location.search).get('variety')).toBe(variety)
    expect(new URLSearchParams(router.state.location.search).has('batchId')).toBe(false)
    expect(selectedVariety()).toBe(variety)
    await screen.findByLabelText(/Khách đặt cây/)
    expect(selectedVariety()).toBe(variety)
    expect(screen.getByLabelText(/Số lượng đặt/)).toHaveValue('3')
    expect(await snapshot()).toEqual(before)
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    await screen.findByRole('link', { name: 'Ghi đơn từ lô M07' })
    expect(router.state.location.pathname + router.state.location.search).toBe(gardenUrl)
    expect(await snapshot()).toEqual(before)
  })

  it.each(['Ghi đơn giống Monthong', 'Ghi đơn từ lô M06', 'Ghi đơn từ lô M07'])('%s saves only the visible demand and keeps legacy success destination', async entry => {
    const { router } = mount()
    fireEvent.click(await screen.findByRole('link', { name: entry }))
    await screen.findByLabelText(/Khách đặt cây/)
    const variety = selectedVariety()
    const batches = await db.batches.toArray()
    const reservations = await db.reservations.toArray()
    fireEvent.click(screen.getByRole('button', { name: 'LƯU ĐƠN HÀNG' }))
    await screen.findByText('Chi tiết đơn')
    const orders = await db.orders.toArray()
    expect(orders).toHaveLength(1)
    expect(orders[0]).toMatchObject({ variety, requestedQuantity: 30000, status: 'open' })
    expect(router.state.location.pathname).toBe(`/orders/${orders[0].id}`)
    expect(await db.batches.toArray()).toEqual(batches)
    expect(await db.reservations.toArray()).toEqual(reservations)
    await act(async () => { await router.navigate(-1) })
    await screen.findByRole('article', { name: 'Monthong' })
    expect(await db.orders.count()).toBe(1)
    expect(screen.queryByText('Ghi đơn mới')).not.toBeInTheDocument()
  })

  it('permits zero available demand and rolls back a failed create, retaining draft for exactly one retry', async () => {
    await db.batches.update('b', { readyQuantity: 5 })
    const { router } = mount()
    fireEvent.click(await screen.findByRole('link', { name: 'Ghi đơn từ lô M06' }))
    await screen.findByLabelText(/Khách đặt cây/)
    fireEvent.change(screen.getByLabelText(/Số lượng đặt/), { target: { value: '2' } })
    await screen.findByText(/Hiện trong vườn chưa có sẵn cây Monthong/)
    const before = await snapshot()
    const fail = (_key: unknown, event: DomainEvent) => { if (event.type === 'order_created') throw new Error('failed history') }
    db.events.hook('creating', fail)
    try {
      fireEvent.click(screen.getByRole('button', { name: 'LƯU ĐƠN HÀNG' }))
      await screen.findByText(/Chưa lưu được đơn hàng trên thiết bị/)
      expect(router.state.location.pathname).toBe('/orders/new')
      expect(selectedVariety()).toBe('Monthong')
      expect(screen.getByLabelText(/Số lượng đặt/)).toHaveValue('2')
      expect(await snapshot()).toEqual(before)
      expect(undoService.getLastMutation()).toBeNull()
    } finally { db.events.hook('creating').unsubscribe(fail) }
    fireEvent.click(screen.getByRole('button', { name: 'LƯU ĐƠN HÀNG' }))
    await screen.findByText('Chi tiết đơn')
    expect(await db.orders.count()).toBe(1)
    expect((await db.orders.toArray())[0]).toMatchObject({ variety: 'Monthong', requestedQuantity: 20000, status: 'open' })
    expect(await db.batches.toArray()).toEqual(before[0])
    expect(await db.reservations.toArray()).toEqual(before[1])
    expect((await db.events.toArray()).filter(e => e.type === 'order_created')).toHaveLength(1)
  })

  it.each([undefined, 'https://evil.test/garden', '//evil.test/garden', '/orders', '/garden/../orders'])('uses legacy back for invalid context %s and supports direct prefill', async gardenReturnTo => {
    const { router } = mount([{ pathname: '/orders/new', search: '?variety=Monthong', state: { gardenReturnTo } }])
    await screen.findByLabelText(/Khách đặt cây/)
    expect(selectedVariety()).toBe('Monthong')
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    await screen.findByText('Danh sách đơn')
    expect(router.state.location.pathname).toBe('/orders')
  })

  it('sanitizes return context, preserves q/view/open and strips unrelated parameters', async () => {
    const { router } = mount([{ pathname: '/orders/new', state: { gardenReturnTo: gardenUrl + '&redirect=https://evil.test' } }])
    await screen.findByLabelText(/Khách đặt cây/)
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    await screen.findByRole('article', { name: 'Monthong' })
    expect(router.state.location.pathname + router.state.location.search).toBe(gardenUrl)
  })

  it('retains a discoverable legacy batch list entry', async () => {
    const { router } = mount()
    fireEvent.click(screen.getByRole('link', { name: 'Xem danh sách lô' }))
    await screen.findByText('Danh sách lô')
    expect(router.state.location.pathname).toBe('/batches')
  })
})
