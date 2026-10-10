import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom'
import { TodayScreen } from '../today/TodayScreen'
import { resetDemoData, clearAllData } from '../../data/seed'
import { db } from '../../data/db'
import * as garden from '../../services/gardenQueryService'
import { undoService } from '../../services/undoService'
import { updateBatchReadyQuantity } from '../../services/batchService'
import { OrdersScreen } from '../orders/OrdersScreen'
import { orderShortage } from '../../domain/order'

describe('TodayScreen', () => {
  beforeEach(async () => {
    await clearAllData()
    await resetDemoData()
  })

  it('renders brand, demo organization name, and primary actions', async () => {
    render(
      <MemoryRouter>
        <TodayScreen />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Vườn Hồng Anh')).toBeInTheDocument()
    })

    expect(screen.getByText('Sổ cây giống trên điện thoại')).toBeInTheDocument()
    expect(screen.getByText('GHI ĐƠN')).toBeInTheDocument()
    expect(screen.getByText('CÂY HÔM NAY')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('region', { name: 'Cây trong vườn' })).toHaveTextContent('40.400'))
    expect(screen.getByRole('link', { name: 'Xem cây còn bán' })).toHaveAttribute('href', '/garden')
    expect(screen.getByText('Đã giữ chưa xuất:')).toBeInTheDocument()
    expect(screen.getByText('Sắp quá lứa')).toBeInTheDocument()
    expect(screen.getByText('VIỆC CẦN LÀM')).toBeInTheDocument()
  })

  it('renders correct computed quantities from seed data', async () => {
    render(
      <MemoryRouter>
        <TodayScreen />
      </MemoryRouter>
    )

    await waitFor(() => {
      // BV16 ready: 32000, reserved: 10000 => available = 22000
      // BV523 ready: 18400, reserved: 0 => available = 18400
      // Total available: 22000 + 18400 = 40.400
      expect(screen.getByText('40.400')).toBeInTheDocument()
      // Total reserved: 10.000 (appears in summary card and batch details)
      expect(screen.getByText('10.000 cây')).toBeInTheDocument()
    })
  })
})

const hero = () => within(screen.getByRole('region', { name: 'Cây trong vườn' }))
async function fixture() {
  await db.batches.bulkPut([
    { id: 'a', code: 'M06', variety: ' Monthong ', createdAt: '2026-10-01', initialQuantity: 30, currentQuantity: 30, readyQuantity: 15, status: 'ready' },
    { id: 'b', code: 'M07', variety: 'MONTHONG', createdAt: '2026-10-01', initialQuantity: 40, currentQuantity: 40, readyQuantity: 20, status: 'propagating', preferredSellBefore: '2026-01-01' }
  ])
  await db.reservations.bulkPut([
    { id: 'ra', orderId: 'o', sourceType: 'own_batch', batchId: 'a', quantity: 18, status: 'active', createdAt: '2026-10-01' },
    { id: 'rb', orderId: 'o', sourceType: 'own_batch', batchId: 'b', quantity: 5, status: 'active', createdAt: '2026-10-01' },
    { id: 'external', orderId: 'o', sourceType: 'external_supplier', supplierId: 's', batchId: 'b', quantity: 999, status: 'active', createdAt: '2026-10-01' }
  ])
}
const snapshot = () => Promise.all([db.batches.toArray(), db.reservations.toArray(), db.orders.toArray(), db.events.toArray(), db.shipments.toArray(), db.contacts.toArray()])
function mountToday() { return render(<MemoryRouter><TodayScreen /></MemoryRouter>) }

describe('Today canonical availability (real Dexie)', () => {
  beforeEach(async () => { await clearAllData(); undoService.clearLastMutation(); await fixture() })
  afterEach(() => { cleanup(); vi.restoreAllMocks(); undoService.clearLastMutation() })

  it('matches Garden 15/3, includes overage ready stock and excludes external collisions; reads do not write', async () => {
    const before = await snapshot()
    mountToday()
    await waitFor(() => expect(hero().getByText('15')).toBeInTheDocument())
    expect(hero().getByText('23 cây')).toBeInTheDocument()
    const data = await garden.getGardenAvailability()
    expect(data.ownTotals.available).toBe(15)
    expect(data.ownTotals.commitmentShortage).toBe(3)
    expect(hero().queryByText('12')).not.toBeInTheDocument()
    expect(screen.getByText('M07 · Sắp quá lứa')).toBeInTheDocument()
    expect(await snapshot()).toEqual(before)
  })

  it('includes own outstanding for a partially reserved order and opens the unfiltered list containing it', async () => {
    await db.reservations.delete('external')
    await db.contacts.put({ id: 'customer', name: 'Khách giữ một phần', roles: ['customer'] })
    const order = { id: 'o', customerId: 'customer', variety: 'Monthong', requestedQuantity: 40, status: 'partially_reserved' as const }
    await db.orders.put(order)
    expect(orderShortage(order, await db.reservations.toArray())).toBe(17)
    const before = await snapshot()
    const router = createMemoryRouter([
      { path: '/today', element: <TodayScreen /> },
      { path: '/orders', element: <OrdersScreen /> }
    ], { initialEntries: ['/today'] })
    render(<RouterProvider router={router} />)
    await waitFor(() => expect(hero().getByText('23 cây')).toBeInTheDocument())
    expect((await garden.getGardenAvailability()).ownTotals.outstanding).toBe(23)
    const action = hero().getByRole('link', { name: 'Xem đơn hàng' })
    expect(action).toHaveAttribute('href', '/orders')
    fireEvent.click(action)
    await screen.findByRole('heading', { name: 'Đơn hàng' })
    await screen.findByText('Khách giữ một phần')
    expect(screen.getByText('Còn thiếu 17 cây')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/orders')
    expect(router.state.location.search).toBe('')
    expect(await snapshot()).toEqual(before)
  })

  it('refreshes committed mutations, Undo, focus, visibility and remount', async () => {
    const mounted = mountToday()
    await waitFor(() => expect(hero().getByText('15')).toBeInTheDocument())
    await act(async () => { expect((await updateBatchReadyQuantity({ batchId: 'a', newReadyQuantity: 25 })).success).toBe(true) })
    await waitFor(() => expect(hero().getByText('22')).toBeInTheDocument())
    await act(async () => { expect((await undoService.undoLastMutation()).success).toBe(true) })
    await waitFor(() => expect(hero().getByText('15')).toBeInTheDocument())
    await db.batches.update('b', { readyQuantity: 30 })
    fireEvent(window, new Event('focus'))
    await waitFor(() => expect(hero().getByText('25')).toBeInTheDocument())
    await db.batches.update('b', { readyQuantity: 35 })
    fireEvent(document, new Event('visibilitychange'))
    await waitFor(() => expect(hero().getByText('30')).toBeInTheDocument())
    mounted.unmount()
    await db.batches.update('b', { readyQuantity: 20 })
    mountToday()
    await waitFor(() => expect(hero().getByText('15')).toBeInTheDocument())
  })

  it.each(['batch', 'reservation', 'read'])('fails closed for %s, hides stale totals, retains tasks and retries without writes', async kind => {
    mountToday()
    await waitFor(() => expect(hero().getByText('15')).toBeInTheDocument())
    if (kind === 'batch') await db.batches.update('a', { readyQuantity: 31 })
    if (kind === 'reservation') await db.reservations.update('ra', { supplierId: 'invalid' })
    if (kind === 'read') vi.spyOn(garden, 'getGardenAvailability').mockRejectedValueOnce(new Error('read failed'))
    const before = await snapshot()
    fireEvent(window, new Event('focus'))
    await screen.findByText(/Chưa đọc được số cây trong vườn/)
    expect(hero().queryByText('15')).not.toBeInTheDocument()
    expect(hero().queryByText('0')).not.toBeInTheDocument()
    expect(hero().queryByText('23 cây')).not.toBeInTheDocument()
    expect(screen.getByText('VIỆC CẦN LÀM')).toBeInTheDocument()
    expect(await snapshot()).toEqual(before)
    await db.batches.update('a', { readyQuantity: 15 })
    await db.reservations.update('ra', { supplierId: undefined })
    fireEvent.click(hero().getByRole('button', { name: 'Thử đọc lại' }))
    await waitFor(() => expect(hero().getByText('15')).toBeInTheDocument())
  })

  it.each(['success', 'error'])('ignores obsolete %s after a newer successful read', async outcome => {
    const data = await garden.getGardenAvailability()
    let resolve!: (value: garden.GardenAvailabilityView) => void
    let reject!: (reason: Error) => void
    const old = new Promise<garden.GardenAvailabilityView>((res, rej) => { resolve = res; reject = rej })
    vi.spyOn(garden, 'getGardenAvailability').mockImplementationOnce(() => old)
    mountToday()
    await screen.findByText('Đang đọc số cây còn bán...')
    fireEvent(window, new Event('focus'))
    await waitFor(() => expect(hero().getByText('15')).toBeInTheDocument())
    await act(async () => {
      if (outcome === 'error') reject(new Error('obsolete'))
      else resolve({ ...data, ownTotals: { ...data.ownTotals, available: 777 } })
    })
    expect(hero().getByText('15')).toBeInTheDocument()
    expect(hero().queryByText('777')).not.toBeInTheDocument()
    expect(hero().queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps a newer error authoritative when an old success arrives later', async () => {
    const data = await garden.getGardenAvailability()
    let resolve!: (value: garden.GardenAvailabilityView) => void
    const old = new Promise<garden.GardenAvailabilityView>(res => { resolve = res })
    vi.spyOn(garden, 'getGardenAvailability').mockImplementationOnce(() => old).mockRejectedValueOnce(new Error('new read failed'))
    mountToday()
    await screen.findByText('Đang đọc số cây còn bán...')
    fireEvent(window, new Event('focus'))
    await screen.findByText(/Chưa đọc được số cây trong vườn/)
    await act(async () => { resolve(data) })
    expect(hero().getByRole('alert')).toBeInTheDocument()
    expect(hero().queryByText('15')).not.toBeInTheDocument()
  })

  it('shows a genuine zero only after a successful empty snapshot', async () => {
    await clearAllData()
    mountToday()
    await waitFor(() => expect(hero().getByText('0')).toBeInTheDocument())
    expect(hero().getByText('0 cây')).toBeInTheDocument()
    expect(screen.getByText('Chưa có dữ liệu trong vườn')).toBeInTheDocument()
  })
})
