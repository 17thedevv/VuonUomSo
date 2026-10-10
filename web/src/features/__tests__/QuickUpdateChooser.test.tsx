import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GardenAvailabilityScreen } from '../garden/GardenAvailabilityScreen'
import { BatchDetailScreen } from '../batches/BatchDetailScreen'
import { BatchNewScreen } from '../batches/BatchNewScreen'
import { AppShell } from '../../shared/components/AppShell'
import { db } from '../../data/db'
import { clearAllData } from '../../data/seed'
import { batchRepository } from '../../data/repositories'
import * as queryService from '../../services/gardenQueryService'
import * as batchService from '../../services/batchService'
import type { GardenAvailabilityView } from '../../services/gardenQueryService'
import { undoService } from '../../services/undoService'

const garden = '/garden?q=M06&view=all&open=monthong'
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
function mount(initialEntries: NonNullable<Parameters<typeof createMemoryRouter>[1]>['initialEntries'] = [garden]) {
  const router = createMemoryRouter([{
    element: <AppShell><Outlet /></AppShell>, children: [
      { path: '/garden', element: <GardenAvailabilityScreen /> },
      { path: '/batches/:id', element: <BatchDetailScreen /> },
      { path: '/batches/new', element: <BatchNewScreen /> },
      { path: '/batches', element: <h1>Danh sách lô cũ</h1> }
    ]
  }], { initialEntries })
  return { ...render(<StrictMode><RouterProvider router={router} /></StrictMode>), router }
}
const snapshot = () => Promise.all([db.batches.toArray(), db.reservations.toArray(), db.orders.toArray(), db.shipments.toArray(), db.events.toArray(), db.contacts.toArray()])
const chooser = () => within(screen.getByRole('dialog', { name: 'Cập nhật lô cây' }))
const summary = () => within(screen.getByRole('region', { name: 'Tổng vườn' }))
async function global() {
  await screen.findByRole('region', { name: 'Tổng vườn' })
  fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))
  return chooser()
}
async function contextual(code = 'M06') {
  fireEvent.click(await screen.findByRole('button', { name: `Cập nhật lô ${code}` }))
  return chooser()
}
async function ready() {
  const choose = await contextual()
  fireEvent.click(choose.getByRole('button', { name: /Cập nhật cây đủ bán/ }))
  // Flush StrictMode mount effects before editing the existing modal's initialized draft.
  await screen.findByRole('dialog', { name: 'Cập nhật cây đủ bán' })
  await act(async () => {})
  return screen.getByRole('dialog', { name: 'Cập nhật cây đủ bán' })
}
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('V2-A3 quick update composition (real Dexie)', () => {
  beforeEach(async () => { await clearAllData(); undoService.clearLastMutation() })
  afterEach(() => { cleanup(); vi.restoreAllMocks(); undoService.clearLastMutation() })

  it('global picker ignores Garden filters; code search retains full group and zero-available batch', async () => {
    await fixture()
    await db.batches.put({ id: 'z', code: 'Z00', variety: 'Ri6', createdAt: '2026-10-01', initialQuantity: 5, currentQuantity: 5, readyQuantity: 0, status: 'propagating' })
    mount(['/garden?q=M06&view=available'])
    const choose = await global()
    await choose.findByRole('button', { name: 'Chọn lô Z00' })
    const a = choose.getByRole('button', { name: 'Chọn lô M06' })
    expect(within(a).getByText('0 cây')).toBeInTheDocument()
    fireEvent.change(choose.getByLabelText('Tìm lô theo giống hoặc mã lô'), { target: { value: 'M06' } })
    await choose.findByText('Khớp tìm kiếm')
    expect(choose.getByRole('button', { name: 'Chọn lô M07' })).toBeInTheDocument()
    expect(choose.getByText('Còn bán: 15 cây · Thiếu cây đã giữ: 3 cây')).toBeInTheDocument()
    expect(choose.queryByRole('button', { name: 'Chọn lô Z00' })).not.toBeInTheDocument()
    fireEvent.click(choose.getByRole('button', { name: 'Chọn lô M06' }))
    expect(choose.getByText('Lô M06')).toBeInTheDocument()
    expect(choose.queryByLabelText('Tìm lô theo giống hoặc mã lô')).not.toBeInTheDocument()
  })

  it.each(['M06', 'M07'])('context entry skips picker and targets exact leaf %s', async (code) => {
    await fixture()
    const spy = vi.spyOn(batchService, 'updateBatchReadyQuantity')
    const { router } = mount()
    const choose = await contextual(code)
    expect(choose.queryByLabelText('Tìm lô theo giống hoặc mã lô')).not.toBeInTheDocument()
    expect(choose.getByText(`Lô ${code}`)).toBeInTheDocument()
    const action = choose.getByRole('button', { name: /Cập nhật cây đủ bán/ })
    fireEvent.click(action)
    fireEvent.click(action)
    await screen.findByRole('dialog', { name: 'Cập nhật cây đủ bán' })
    fireEvent.change(screen.getByLabelText(/Tổng số cây đủ chuẩn hiện tại/), { target: { value: '10' } })
    const save = screen.getByRole('button', { name: 'CẬP NHẬT' })
    fireEvent.click(save)
    fireEvent.click(save)
    await screen.findByRole('region', { name: 'Tổng vườn' })
    const id = code === 'M06' ? 'a' : 'b'
    expect(spy).toHaveBeenCalledExactlyOnceWith({ batchId: id, newReadyQuantity: 10, note: undefined })
    expect((await db.batches.get(id))?.readyQuantity).toBe(10)
    expect((await db.batches.get(id === 'a' ? 'b' : 'a'))?.readyQuantity).toBe(id === 'a' ? 20 : 15)
    expect(router.state.location.pathname + router.state.location.search).toBe(garden)
  })

  it('chooser selection, change batch, actions and cancel do not write business data', async () => {
    await fixture()
    const before = await snapshot()
    mount()
    const choose = await global()
    fireEvent.click(await choose.findByRole('button', { name: 'Chọn lô M06' }))
    fireEvent.click(choose.getByRole('button', { name: 'Chọn lô khác' }))
    fireEvent.click(await choose.findByRole('button', { name: 'Chọn lô M07' }))
    expect(choose.queryByText('Lô M06')).not.toBeInTheDocument()
    fireEvent.click(choose.getByRole('button', { name: /Kiểm kê số sống/ }))
    await screen.findByLabelText(/Hiện còn bao nhiêu cây sống/)
    expect(screen.getByLabelText(/Hiện còn bao nhiêu cây sống/)).toHaveValue('40')
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    await screen.findByRole('region', { name: 'Tổng vườn' })
    expect(await snapshot()).toEqual(before)
    expect(undoService.getLastMutation()).toBeNull()
  })

  it('focus, keyboard selection, containment, Escape and focus return work in chooser', async () => {
    await fixture()
    mount()
    const user = userEvent.setup()
    await screen.findByRole('region', { name: 'Tổng vườn' })
    const trigger = screen.getByRole('button', { name: 'Cập nhật' })
    await user.click(trigger)
    const choose = chooser()
    expect(choose.getByLabelText('Tìm lô theo giống hoặc mã lô')).toHaveFocus()
    const batch = await choose.findByRole('button', { name: 'Chọn lô M06' })
    batch.focus()
    await user.keyboard('{Enter}')
    expect(choose.getByRole('button', { name: /Kiểm kê số sống/ })).toHaveFocus()
    choose.getByRole('button', { name: 'Hủy' }).focus()
    await user.tab()
    expect(choose.getByRole('button', { name: 'Đóng chọn cập nhật' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(choose.getByRole('button', { name: 'Hủy' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('empty picker still opens existing new-batch flow and preserves Garden return context', async () => {
    const { router } = mount(['/garden?view=all'])
    const choose = await global()
    await choose.findByText('Chưa có lô cây nào')
    fireEvent.click(choose.getByRole('button', { name: 'Thêm lô mới' }))
    await screen.findByRole('heading', { name: 'Tạo lô mới' })
    expect(router.state.location.pathname).toBe('/batches/new')
    expect(router.state.location.state.gardenReturnTo).toBe('/garden?view=all')
    fireEvent.click(screen.getByRole('button', { name: 'LƯU LÔ CÂY' }))
    await screen.findByRole('button', { name: 'KIỂM KÊ CÂY SỐNG' })
    expect(await db.batches.count()).toBe(1)
    expect(await db.reservations.count()).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    await screen.findByRole('region', { name: 'Tổng vườn' })
    expect(router.state.location.pathname + router.state.location.search).toBe('/garden?view=all')
  })

  it('no matches has clear-search action and never substitutes another selected batch', async () => {
    await fixture()
    mount()
    const choose = await global()
    await choose.findByRole('button', { name: 'Chọn lô M06' })
    fireEvent.change(choose.getByLabelText('Tìm lô theo giống hoặc mã lô'), { target: { value: 'unknown' } })
    await choose.findByText('Không tìm thấy lô phù hợp')
    expect(choose.queryByRole('button', { name: /Chọn lô M0/ })).not.toBeInTheDocument()
    expect(choose.queryByRole('button', { name: /Kiểm kê số sống/ })).not.toBeInTheDocument()
    fireEvent.click(choose.getByRole('button', { name: 'Xóa tìm kiếm lô' }))
    await choose.findByRole('button', { name: 'Chọn lô M06' })
  })

  it('inventory uses existing absolute preview; lowering living requires explicit ready, then saves and refreshes', async () => {
    await fixture()
    const { router } = mount()
    const choose = await contextual()
    fireEvent.click(choose.getByRole('button', { name: /Kiểm kê số sống/ }))
    const living = await screen.findByLabelText(/Hiện còn bao nhiêu cây sống/)
    expect(living).toHaveValue('30')
    fireEvent.change(living, { target: { value: '10' } })
    const adjusted = screen.getByLabelText(/Cây đủ bán hiện tại:/)
    expect(adjusted).toHaveValue('')
    expect(screen.getByRole('button', { name: 'CẬP NHẬT' })).toBeDisabled()
    fireEvent.change(adjusted, { target: { value: '11' } })
    expect(screen.getByRole('button', { name: 'CẬP NHẬT' })).toBeDisabled()
    fireEvent.change(adjusted, { target: { value: '8' } })
    const preview = within(screen.getByRole('region', { name: 'Preview kiểm kê' }))
    expect(preview.getByRole('row', { name: 'Cây còn sống 30 cây 10 cây' })).toBeInTheDocument()
    expect(preview.getByRole('row', { name: 'Cây đủ bán 15 cây 8 cây' })).toBeInTheDocument()
    expect(preview.getByRole('row', { name: 'Cây còn bán 0 cây 0 cây' })).toBeInTheDocument()
    expect(preview.getByRole('row', { name: 'Thiếu cây đã giữ 3 cây 10 cây' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'CẬP NHẬT' }))
    await screen.findByRole('region', { name: 'Tổng vườn' })
    expect(await db.batches.get('a')).toMatchObject({ currentQuantity: 10, readyQuantity: 8 })
    expect(summary().getByText('50')).toBeInTheDocument()
    expect(summary().getByText('15')).toBeInTheDocument()
    expect(summary().getByText('10')).toBeInTheDocument()
    expect(router.state.location.pathname + router.state.location.search).toBe(garden)
  })

  it('ready > living rejects; legitimate shortage saves absolute ready, Garden refreshes and Undo restores', async () => {
    await fixture()
    const { router } = mount()
    await ready()
    const input = screen.getByLabelText(/Tổng số cây đủ chuẩn hiện tại/)
    fireEvent.change(input, { target: { value: '31' } })
    expect(screen.getByText('Vượt quá số cây còn sống')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CẬP NHẬT' })).toBeDisabled()
    expect((await db.batches.get('a'))?.readyQuantity).toBe(15)
    fireEvent.change(input, { target: { value: '10' } })
    expect(screen.getByText('Sau cập nhật sẽ thiếu 8 cây đã giữ cho khách.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CẬP NHẬT' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'CẬP NHẬT' }))
    await screen.findByRole('region', { name: 'Tổng vườn' })
    expect(summary().getByText('15')).toBeInTheDocument()
    expect(summary().getByText('8')).toBeInTheDocument()
    expect((await db.batches.get('a'))?.currentQuantity).toBe(30)
    expect(undoService.getLastMutation()?.type).toBe('update_ready_quantity')
    expect(router.state.location.pathname + router.state.location.search).toBe(garden)
    expect(screen.getByRole('link', { name: 'Mở lô M07' })).toBeInTheDocument()
    await act(async () => { expect((await undoService.undoLastMutation()).success).toBe(true) })
    await waitFor(() => expect(summary().getByText('3')).toBeInTheDocument())
    expect(summary().getByText('35')).toBeInTheDocument()
    expect((await db.batches.get('a'))?.readyQuantity).toBe(15)
    await act(async () => { await router.navigate(-1) })
    await screen.findByRole('button', { name: 'KIỂM KÊ CÂY SỐNG' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(router.state.location.state?.quickUpdateIntent).toBeUndefined()
  })

  it.each(['inventory', 'ready'] as const)('%s storage failure rolls back, retains input and never returns or registers Undo', async (kind) => {
    await fixture()
    const { router } = mount()
    const choose = await contextual()
    fireEvent.click(choose.getByRole('button', { name: kind === 'inventory' ? /Kiểm kê số sống/ : /Cập nhật cây đủ bán/ }))
    await screen.findByLabelText(kind === 'inventory' ? /Hiện còn bao nhiêu cây sống/ : /Tổng số cây đủ chuẩn hiện tại/)
    await act(async () => {})
    const input = screen.getByLabelText(kind === 'inventory' ? /Hiện còn bao nhiêu cây sống/ : /Tổng số cây đủ chuẩn hiện tại/)
    fireEvent.change(input, { target: { value: '25' } })
    const before = await snapshot()
    const failure = () => { throw new Error('Injected event write failure') }
    db.events.hook('creating', failure)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      fireEvent.click(screen.getByRole('button', { name: 'CẬP NHẬT' }))
      await screen.findByText('Injected event write failure')
      expect(input).toHaveValue('25')
      expect(router.state.location.pathname).toBe('/batches/a')
      expect(await snapshot()).toEqual(before)
      expect(undoService.getLastMutation()).toBeNull()
    } finally { db.events.hook('creating').unsubscribe(failure) }
    fireEvent.click(screen.getByRole('button', { name: 'CẬP NHẬT' }))
    await screen.findByRole('region', { name: 'Tổng vườn' })
    expect((await db.events.toArray()).filter((e) => e.type === (kind === 'inventory' ? 'batch_inventory_updated' : 'batch_ready_stock_updated'))).toHaveLength(1)
  })

  it('selected batch deleted before action shows not-found; no modal and no writes', async () => {
    await fixture()
    mount()
    const choose = await contextual()
    await db.reservations.delete('ra')
    await db.batches.delete('a')
    const before = await snapshot()
    fireEvent.click(choose.getByRole('button', { name: /Kiểm kê số sống/ }))
    await screen.findByText('Không tìm thấy lô cây này')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await snapshot()).toEqual(before)
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại Vườn' }))
    await screen.findByRole('region', { name: 'Tổng vườn' })
  })

  it('modal loads fresh full batch/reservation facts rather than the Garden DTO', async () => {
    await fixture()
    mount()
    const choose = await contextual()
    await db.batches.update('a', { currentQuantity: 22, readyQuantity: 12 })
    await db.reservations.update('ra', { quantity: 20 })
    fireEvent.click(choose.getByRole('button', { name: /Kiểm kê số sống/ }))
    expect(await screen.findByLabelText(/Hiện còn bao nhiêu cây sống/)).toHaveValue('22')
    const preview = within(screen.getByRole('region', { name: 'Preview kiểm kê' }))
    expect(preview.getByRole('row', { name: 'Cây đủ bán 12 cây 12 cây' })).toBeInTheDocument()
    expect(preview.getByRole('row', { name: 'Thiếu cây đã giữ 8 cây 8 cây' })).toBeInTheDocument()
  })

  it.each(['old success', 'old error'])('picker latest request wins over %s', async (outcome) => {
    await fixture()
    mount()
    const choose = await global()
    await choose.findByRole('button', { name: 'Chọn lô M06' })
    const older = deferred<GardenAvailabilityView>()
    const newer = deferred<GardenAvailabilityView>()
    const full = await queryService.getGardenAvailability({ view: 'all' })
    vi.spyOn(queryService, 'getGardenAvailability').mockImplementation(({ search } = {}) => search === 'old' ? older.promise : newer.promise)
    fireEvent.change(choose.getByLabelText('Tìm lô theo giống hoặc mã lô'), { target: { value: 'old' } })
    fireEvent.change(choose.getByLabelText('Tìm lô theo giống hoặc mã lô'), { target: { value: 'new' } })
    expect(choose.queryByRole('button', { name: 'Chọn lô M06' })).not.toBeInTheDocument()
    await act(async () => { newer.resolve({ ...full, groups: [] }); await newer.promise })
    expect(choose.getByText('Không tìm thấy lô phù hợp')).toBeInTheDocument()
    await act(async () => { if (outcome === 'old success') older.resolve(full); else older.reject(new Error('old error')); await older.promise.catch(() => {}) })
    expect(choose.getByText('Không tìm thấy lô phù hợp')).toBeInTheDocument()
    expect(choose.queryByRole('alert')).not.toBeInTheDocument()
    expect(choose.queryByRole('button', { name: 'Chọn lô M06' })).not.toBeInTheDocument()
  })

  it('picker read error hides stale batches and retry recovers', async () => {
    await fixture()
    mount()
    const choose = await global()
    await choose.findByRole('button', { name: 'Chọn lô M06' })
    const read = queryService.getGardenAvailability
    const spy = vi.spyOn(queryService, 'getGardenAvailability').mockRejectedValueOnce(new Error('read failed'))
    fireEvent.change(choose.getByLabelText('Tìm lô theo giống hoặc mã lô'), { target: { value: 'M06' } })
    await choose.findByRole('alert')
    expect(choose.queryByRole('button', { name: 'Chọn lô M06' })).not.toBeInTheDocument()
    spy.mockImplementation(read)
    fireEvent.click(choose.getByRole('button', { name: 'Thử lại' }))
    await choose.findByRole('button', { name: 'Chọn lô M06' })
  })

  it.each([{ kind: 'delete', batchId: 'a' }, { kind: 'ready', batchId: 'b' }, { kind: 'inventory', batchId: '' }, null, 'ready'])('ignores malformed/mismatched route intent %j', async (intent) => {
    await fixture()
    const before = await snapshot()
    const { router } = mount([{ pathname: '/batches/a', state: { gardenReturnTo: 'https://unsafe.test', quickUpdateIntent: intent } }])
    await screen.findByRole('button', { name: 'KIỂM KÊ CÂY SỐNG' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(router.state.location.state?.quickUpdateIntent).toBeUndefined()
    expect(await snapshot()).toEqual(before)
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    await screen.findByRole('heading', { name: 'Danh sách lô cũ' })
  })

  it('consumes intent before failed detail read; retry and remount do not reopen modal', async () => {
    await fixture()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(batchRepository, 'getById').mockRejectedValue(new Error('detail read failed'))
    const { router, unmount } = mount([{ pathname: '/batches/a', state: { gardenReturnTo: garden, quickUpdateIntent: { kind: 'ready', batchId: 'a' } } }])
    await screen.findByText('Chưa tải được chi tiết lô cây.')
    expect(router.state.location.state.quickUpdateIntent).toBeUndefined()
    vi.mocked(batchRepository.getById).mockRestore()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByRole('button', { name: 'KIỂM KÊ CÂY SỐNG' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const entry = { pathname: router.state.location.pathname, state: router.state.location.state }
    unmount()
    mount([entry])
    await screen.findByRole('button', { name: 'KIỂM KÊ CÂY SỐNG' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('consumed successful intent cannot stack/reopen; Escape returns Garden and remount stays closed', async () => {
    await fixture()
    const { router, unmount } = mount()
    await ready()
    await act(async () => { await router.navigate('/batches/a', { state: { gardenReturnTo: garden, quickUpdateIntent: { kind: 'inventory', batchId: 'a' } } }) })
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'Cập nhật cây đủ bán' })).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.state.quickUpdateIntent).toBeUndefined())
    const entry = { pathname: router.state.location.pathname, state: router.state.location.state }
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await screen.findByRole('region', { name: 'Tổng vườn' })
    expect(router.state.location.pathname + router.state.location.search).toBe(garden)
    unmount()
    mount([entry])
    await screen.findByRole('button', { name: 'KIỂM KÊ CÂY SỐNG' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('route identity changes discard old facts/intent even if old read finishes late', async () => {
    await fixture()
    const old = deferred<Awaited<ReturnType<typeof batchRepository.getById>>>()
    const original = batchRepository.getById.bind(batchRepository)
    vi.spyOn(batchRepository, 'getById').mockImplementation((id) => id === 'a' ? old.promise : original(id))
    const { router } = mount([{ pathname: '/batches/a', state: { quickUpdateIntent: { kind: 'ready', batchId: 'a' } } }])
    await act(async () => { await router.navigate('/batches/b') })
    await screen.findByRole('button', { name: 'KIỂM KÊ CÂY SỐNG' })
    await act(async () => { old.resolve((await db.batches.get('a'))!); await old.promise })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'KIỂM KÊ CÂY SỐNG' }))
    expect(screen.getByLabelText(/Hiện còn bao nhiêu cây sống/)).toHaveValue('40')
  })

  it('legacy BatchDetail controls keep existing cancel/save/back behavior', async () => {
    await fixture()
    const { router } = mount(['/batches/a'])
    fireEvent.click(await screen.findByRole('button', { name: 'KIỂM KÊ CÂY SỐNG' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(router.state.location.pathname).toBe('/batches/a')
    fireEvent.click(screen.getByRole('button', { name: 'CẬP NHẬT CÂY ĐỦ BÁN' }))
    fireEvent.change(screen.getByLabelText(/Tổng số cây đủ chuẩn hiện tại/), { target: { value: '25' } })
    fireEvent.click(screen.getByRole('button', { name: 'CẬP NHẬT' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect((await db.batches.get('a'))?.readyQuantity).toBe(25)
    expect(router.state.location.pathname).toBe('/batches/a')
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    await screen.findByRole('heading', { name: 'Danh sách lô cũ' })
  })
})
