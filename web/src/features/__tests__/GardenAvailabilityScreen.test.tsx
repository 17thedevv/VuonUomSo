import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GardenAvailabilityScreen } from '../garden/GardenAvailabilityScreen'
import { gardenReturnPath } from '../garden/gardenNavigation'
import { BatchDetailScreen } from '../batches/BatchDetailScreen'
import { AppShell } from '../../shared/components/AppShell'
import { db } from '../../data/db'
import { clearAllData } from '../../data/seed'
import * as queryService from '../../services/gardenQueryService'
import type { GardenAvailabilityView } from '../../services/gardenQueryService'
import { undoService } from '../../services/undoService'

async function fixture() {
  await db.batches.bulkPut([
    { id: 'a', code: 'M06', variety: ' Monthong ', createdAt: '2026-10-01', initialQuantity: 30, currentQuantity: 30, readyQuantity: 15, status: 'ready' },
    { id: 'b', code: 'M07', variety: 'MONTHONG', createdAt: '2026-10-01', initialQuantity: 40, currentQuantity: 40, readyQuantity: 20, status: 'ready' }
  ])
  await db.reservations.bulkPut([
    { id: 'ra', orderId: 'o', sourceType: 'own_batch', batchId: 'a', quantity: 18, status: 'active', createdAt: '2026-10-01' },
    { id: 'rb', orderId: 'o', sourceType: 'own_batch', batchId: 'b', quantity: 5, status: 'active', createdAt: '2026-10-01' }
  ])
}
function mount(initialEntries: NonNullable<Parameters<typeof createMemoryRouter>[1]>['initialEntries'] = ['/garden']) {
  const router = createMemoryRouter([{
    element: <AppShell><Outlet /></AppShell>,
    children: [
      { path: '/garden', element: <GardenAvailabilityScreen /> },
      { path: '/batches/:id', element: <BatchDetailScreen /> },
      { path: '/batches', element: <h1>Danh sách lô cũ</h1> },
      { path: '/batches/new', element: <h1>Thêm lô cây cũ</h1> }
    ]
  }], { initialEntries })
  const result = render(<RouterProvider router={router} />)
  return { ...result, router }
}
const summary = () => within(screen.getByRole('region', { name: 'Tổng vườn' }))
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('Garden availability UI (real Dexie)', () => {
  beforeEach(async () => { await clearAllData(); undoService.clearLastMutation() })
  afterEach(() => { cleanup(); vi.restoreAllMocks(); undoService.clearLastMutation() })

  it('has a valid empty-garden state and opens the existing new-batch flow', async () => {
    const { router } = mount()
    expect(screen.getByText('Đang đọc dữ liệu vườn...')).toBeInTheDocument()
    await screen.findByText('Chưa có lô cây nào')
    expect(summary().getAllByText('0')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: 'Thêm lô cây' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/batches/new'))
  })

  it('distinguishes zero-stock existing batches from an empty garden; all shows the batch', async () => {
    await db.batches.put({ id: 'zero', code: 'Z00', variety: 'Ri6', createdAt: '2026-10-01', initialQuantity: 100, currentQuantity: 0, readyQuantity: 0, status: 'depleted' })
    mount()
    await screen.findByText('Chưa có cây còn bán')
    expect(screen.queryByText('Chưa có lô cây nào')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xem tất cả' }))
    await screen.findByRole('article', { name: 'Ri6' })
    fireEvent.click(screen.getByRole('button', { name: 'Xem các lô' }))
    expect(screen.getByRole('link', { name: 'Mở lô Z00' })).toBeInTheDocument()
  })

  it('renders per-batch fixture 15 available / 3 shortage, retaining both batches for code search', async () => {
    await fixture()
    const { router } = mount()
    await screen.findByRole('article', { name: 'Monthong' })
    expect(summary().getByText('15')).toBeInTheDocument()
    expect(summary().getByText('3')).toBeInTheDocument()
    expect(summary().getByText('70')).toBeInTheDocument()
    expect(summary().getByText('35')).toBeInTheDocument()
    expect(summary().getByText('23')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tìm giống cây hoặc mã lô'), { target: { value: 'M06' } })
    await screen.findByRole('article', { name: 'Monthong' })
    fireEvent.click(screen.getByRole('button', { name: 'Xem các lô' }))
    const a = within(screen.getByRole('link', { name: 'Mở lô M06' }))
    const b = within(screen.getByRole('link', { name: 'Mở lô M07' }))
    expect(a.getByText('Khớp tìm kiếm')).toBeInTheDocument()
    expect(b.queryByText('Khớp tìm kiếm')).not.toBeInTheDocument()
    expect(a.getByText('0 cây')).toBeInTheDocument()
    expect(a.getByText('3 cây')).toBeInTheDocument()
    expect(b.getByText('15 cây')).toBeInTheDocument()
    expect(summary().getByText('15')).toBeInTheDocument()
    expect(new URLSearchParams(router.state.location.search).get('q')).toBe('M06')
  })

  it('keeps garden totals for no-results and clearing search, without business writes', async () => {
    await fixture()
    const snapshot = () => Promise.all([db.batches.toArray(), db.reservations.toArray(), db.orders.toArray(), db.shipments.toArray(), db.events.toArray(), db.contacts.toArray()])
    const before = await snapshot()
    mount(['/garden?q=missing&view=all'])
    await screen.findByText('Không tìm thấy giống hoặc mã lô phù hợp')
    expect(summary().getByText('15')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Xóa tìm kiếm' })[0]!)
    await screen.findByRole('article', { name: 'Monthong' })
    expect(await snapshot()).toEqual(before)
  })

  it('restores URL filters on reload and browser back; invalid view normalizes to available', async () => {
    await fixture()
    const { router, unmount } = mount(['/garden?q=monthong&view=invalid'])
    await screen.findByRole('article', { name: 'Monthong' })
    await waitFor(() => expect(new URLSearchParams(router.state.location.search).get('view')).toBe('available'))
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả' }))
    await waitFor(() => expect(router.state.location.search).toContain('view=all'))
    const url = '/garden' + router.state.location.search
    await act(async () => { await router.navigate(-1) })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cây còn bán' })).toHaveAttribute('aria-pressed', 'true'))
    unmount()
    mount([url])
    await screen.findByRole('article', { name: 'Monthong' })
    expect(screen.getByLabelText('Tìm giống cây hoặc mã lô')).toHaveValue('monthong')
    expect(screen.getByRole('button', { name: 'Tất cả' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('Garden → existing batch modal → back reloads committed facts; Undo refreshes again', async () => {
    await fixture()
    const { router } = mount(['/garden?q=Monthong&view=all&open=monthong'])
    fireEvent.click(await screen.findByRole('link', { name: 'Mở lô M06' }))
    await screen.findByRole('button', { name: 'CẬP NHẬT CÂY ĐỦ BÁN' })
    fireEvent.click(screen.getByRole('button', { name: 'CẬP NHẬT CÂY ĐỦ BÁN' }))
    fireEvent.change(screen.getByLabelText(/Tổng số cây đủ chuẩn hiện tại/), { target: { value: '25' } })
    fireEvent.click(screen.getByRole('button', { name: 'CẬP NHẬT' }))
    await waitFor(async () => expect((await db.batches.get('a'))?.readyQuantity).toBe(25))
    await waitFor(() => expect(screen.queryByLabelText(/Tổng số cây đủ chuẩn hiện tại/)).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    await screen.findByRole('region', { name: 'Tổng vườn' })
    expect(summary().getByText('22')).toBeInTheDocument()
    expect(router.state.location.search).toContain('q=Monthong')
    expect(router.state.location.search).toContain('view=all')
    expect(screen.getByRole('link', { name: 'Mở lô M07' })).toBeInTheDocument()
    await act(async () => { expect((await undoService.undoLastMutation()).success).toBe(true) })
    await waitFor(() => expect(summary().getByText('15')).toBeInTheDocument())
    expect(summary().getByText('3')).toBeInTheDocument()
  })

  it('reloads committed snapshots on explicit refresh and returning browser focus', async () => {
    await fixture()
    mount()
    await screen.findByRole('article', { name: 'Monthong' })
    // Direct committed facts emulate changes from another owner-local surface/connection.
    await db.batches.update('b', { readyQuantity: 10 })
    fireEvent.click(screen.getByRole('button', { name: 'Đọc lại' }))
    await waitFor(() => expect(summary().getByText('5')).toBeInTheDocument())
    await db.batches.update('b', { readyQuantity: 12 })
    fireEvent(window, new Event('focus'))
    await waitFor(() => expect(summary().getByText('7')).toBeInTheDocument())
  })

  it('real invalid facts reject the whole screen, hide old totals and allow retry after correction', async () => {
    await fixture()
    mount()
    await screen.findByRole('region', { name: 'Tổng vườn' })
    await db.reservations.update('ra', { supplierId: 'malformed-own-source' })
    fireEvent.click(screen.getByRole('button', { name: 'Đọc lại' }))
    await screen.findByRole('alert')
    expect(screen.queryByRole('region', { name: 'Tổng vườn' })).not.toBeInTheDocument()
    expect(screen.queryByText('Chưa có lô cây nào')).not.toBeInTheDocument()
    await db.reservations.update('ra', { supplierId: '' })
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByRole('region', { name: 'Tổng vườn' })
    expect(summary().getByText('15')).toBeInTheDocument()
  })

  it('propagates a real Dexie read failure as error, never as empty/zero-success', async () => {
    await fixture()
    const fail = () => { throw new Error('read failed') }
    db.reservations.hook('reading', fail)
    try {
      mount()
      await screen.findByRole('alert')
      expect(screen.queryByRole('region', { name: 'Tổng vườn' })).not.toBeInTheDocument()
    } finally { db.reservations.hook('reading').unsubscribe(fail) }
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByRole('article', { name: 'Monthong' })
  })

  it.each(['success', 'error'] as const)('ignores a late old %s after a newer search succeeds', async (outcome) => {
    await fixture()
    const latest = await queryService.getGardenAvailability({ search: 'M06', view: 'all' })
    const old = deferred<GardenAvailabilityView>()
    vi.spyOn(queryService, 'getGardenAvailability').mockImplementationOnce(() => old.promise).mockResolvedValue(latest)
    mount()
    fireEvent.change(screen.getByLabelText('Tìm giống cây hoặc mã lô'), { target: { value: 'M06' } })
    await screen.findByRole('region', { name: 'Tổng vườn' })
    await act(async () => {
      if (outcome === 'success') old.resolve({ ...latest, ownTotals: { ...latest.ownTotals, available: 999 } })
      else old.reject(new Error('old request failed'))
    })
    expect(summary().getByText('15')).toBeInTheDocument()
    expect(screen.queryByText('999 cây')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not let a late old success erase a newer failure; retry gets a fresh snapshot', async () => {
    await fixture()
    const data = await queryService.getGardenAvailability()
    const old = deferred<GardenAvailabilityView>()
    const spy = vi.spyOn(queryService, 'getGardenAvailability').mockImplementationOnce(() => old.promise).mockRejectedValueOnce(new Error('latest fails')).mockResolvedValue(data)
    mount()
    fireEvent.change(screen.getByLabelText('Tìm giống cây hoặc mã lô'), { target: { value: 'M06' } })
    await screen.findByRole('alert')
    await act(async () => { old.resolve(data) })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Tổng vườn' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByRole('region', { name: 'Tổng vườn' })
    expect(spy).toHaveBeenLastCalledWith({ search: 'M06', view: 'available' })
  })

  it.each([undefined, '/batches', '//evil.example/garden', 'https://evil.example/garden', '/garden/../orders'])('keeps legacy batch back destination for untrusted return path %s', async (gardenReturnTo) => {
    await fixture()
    const { router } = mount([{ pathname: '/batches/a', state: { gardenReturnTo } }])
    await screen.findByRole('heading', { name: 'M06' })
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/batches'))
  })

  it('allows only Garden presentation parameters in a return path', () => {
    expect(gardenReturnPath('/garden?q=M06&view=invalid&open=monthong&next=https://evil.example'))
      .toBe('/garden?q=M06&view=available&open=monthong')
  })

  it('uses one complete latest all-view snapshot when classifying no available batches', async () => {
    await fixture()
    const all = await queryService.getGardenAvailability({ view: 'all' })
    const spy = vi.spyOn(queryService, 'getGardenAvailability')
      .mockResolvedValueOnce({ ...all, groups: [], ownTotals: { ...all.ownTotals, available: 0 } })
      .mockResolvedValueOnce(all)
    mount()
    await screen.findByRole('article', { name: 'Monthong' })
    expect(summary().getByText('15')).toBeInTheDocument()
    expect(spy).toHaveBeenLastCalledWith({ view: 'all' })
  })

  it('fails closed if the all-view classification read fails', async () => {
    const empty = await queryService.getGardenAvailability()
    vi.spyOn(queryService, 'getGardenAvailability').mockResolvedValueOnce(empty).mockRejectedValueOnce(new Error('classification read failed'))
    mount()
    await screen.findByRole('alert')
    expect(screen.queryByRole('region', { name: 'Tổng vườn' })).not.toBeInTheDocument()
    expect(screen.queryByText('Chưa có lô cây nào')).not.toBeInTheDocument()
  })

  it('hides old totals during same-filter refresh and ignores an earlier refresh response', async () => {
    await fixture()
    const data = await queryService.getGardenAvailability()
    const first = deferred<GardenAvailabilityView>()
    const second = deferred<GardenAvailabilityView>()
    vi.spyOn(queryService, 'getGardenAvailability').mockResolvedValueOnce(data)
      .mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise)
    mount()
    await screen.findByRole('region', { name: 'Tổng vườn' })
    fireEvent.click(screen.getByRole('button', { name: 'Đọc lại' }))
    expect(screen.queryByRole('region', { name: 'Tổng vườn' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Đọc lại' }))
    await act(async () => { second.resolve(data) })
    await act(async () => { first.resolve({ ...data, ownTotals: { ...data.ownTotals, available: 999 } }) })
    expect(summary().getByText('15')).toBeInTheDocument()
    expect(summary().queryByText('999')).not.toBeInTheDocument()
  })

  it('reloads when the document becomes visible', async () => {
    await fixture()
    mount()
    await screen.findByRole('region', { name: 'Tổng vườn' })
    await db.batches.update('b', { readyQuantity: 12 })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    fireEvent(document, new Event('visibilitychange'))
    await waitFor(() => expect(summary().getByText('7')).toBeInTheDocument())
  })
})
