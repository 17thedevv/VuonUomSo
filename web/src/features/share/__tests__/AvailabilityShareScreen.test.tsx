import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AvailabilityShareScreen } from '../AvailabilityShareScreen'
import { GardenAvailabilityScreen } from '../../garden/GardenAvailabilityScreen'
import { AppShell } from '../../../shared/components/AppShell'
import { db } from '../../../data/db'
import { clearAllData } from '../../../data/seed'
import { organizationRepository } from '../../../data/repositories/organization.repository'
import * as query from '../../../services/gardenQueryService'
import { eligibleBatchIds, selectedShareGroups, toggleGroup } from '../shareSelection'

const gardenUrl = '/garden?q=M06&view=all&open=monthong'
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
async function fixture(extra = false) {
  await db.organizations.put({ id: 'org-private', name: 'Vườn Hồng Anh', capabilities: ['produce', 'sell'] })
  await db.batches.bulkPut([
    { id: 'a-private', code: 'M06', variety: ' Monthong ', createdAt: '2026-10-01', initialQuantity: 30, currentQuantity: 30, readyQuantity: 15, status: 'ready' },
    { id: 'b-private', code: 'M07', variety: 'MONTHONG', createdAt: '2026-10-01', initialQuantity: 40, currentQuantity: 40, readyQuantity: 20, status: 'ready' }
  ])
  await db.reservations.bulkPut([
    { id: 'ra-private', orderId: 'order-private', sourceType: 'own_batch', batchId: 'a-private', quantity: 18, status: 'active', createdAt: '2026-10-01' },
    { id: 'rb-private', orderId: 'order-private', sourceType: 'own_batch', batchId: 'b-private', quantity: 5, status: 'active', createdAt: '2026-10-01' },
    { id: 'external-private', orderId: 'order-private', sourceType: 'external_supplier', supplierId: 'supplier-private', batchId: 'b-private', quantity: 999, status: 'active', createdAt: '2026-10-01' }
  ])
  await db.contacts.bulkPut([{ id: 'customer-private', name: 'CUSTOMER SECRET', phone: '0912345678', roles: ['customer'] }, { id: 'supplier-private', name: 'SUPPLIER SECRET', phone: '0987654321', roles: ['supplier'] }])
  await db.orders.put({ id: 'order-private', customerId: 'customer-private', variety: 'Monthong', requestedQuantity: 40, unitPrice: 87654321, note: 'ORDER NOTE SECRET', status: 'partially_reserved' })
  await db.shipments.put({ id: 'shipment-private', orderId: 'order-private', plannedQuantity: 1, shippedQuantity: 0, status: 'planned', note: 'SHIPMENT SECRET' })
  await db.dossiers.put({ id: 'dossier-private', batchId: 'b-private', materialType: 'seed', documents: [], note: 'DOSSIER SECRET', createdAt: '2026-10-01', updatedAt: '2026-10-01' })
  await db.events.put({ id: 'event-private', type: 'order_created', entityType: 'order', entityId: 'order-private', payload: { privateNote: 'HISTORY SECRET' }, createdAt: '2026-10-01' })
  if (extra) await db.batches.bulkPut([
    { id: 'c-private', code: 'M08', variety: 'Monthong', createdAt: '2026-10-01', initialQuantity: 10, currentQuantity: 10, readyQuantity: 9, status: 'ready' },
    { id: 'd-private', code: 'R01', variety: 'Ri6', createdAt: '2026-10-01', initialQuantity: 25, currentQuantity: 25, readyQuantity: 25, status: 'ready' }
  ])
}
async function domainSnapshot() { return Promise.all(db.tables.map(table => table.toArray())) }
function mount(entry: NonNullable<Parameters<typeof createMemoryRouter>[1]>['initialEntries'] = ['/garden/share']) {
  const router = createMemoryRouter([{ element: <AppShell><Outlet /></AppShell>, children: [
    { path: '/garden/share', element: <AvailabilityShareScreen /> },
    { path: '/garden', element: <GardenAvailabilityScreen /> }
  ] }], { initialEntries: entry })
  render(<RouterProvider router={router} />)
  return router
}
async function loaded() { await screen.findByRole('checkbox', { name: 'Chọn lô M07' }) }
async function generate() {
  fireEvent.click(screen.getByRole('button', { name: 'Tạo bảng hàng' }))
  return (await screen.findByRole('textbox', { name: 'Nội dung bảng hàng' })) as HTMLTextAreaElement
}

describe('B1 selection and share (real Dexie)', () => {
  beforeEach(async () => { await clearAllData(); vi.stubGlobal('navigator', { onLine: true }) })
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

  it('B101/B102/B103 opens from Garden under AppShell and preserves only allowed context', async () => {
    await fixture()
    const router = mount([gardenUrl + '&redirect=https://evil.test'])
    await screen.findByRole('article', { name: 'Monthong' })
    fireEvent.click(screen.getByRole('link', { name: 'Tạo bảng chia sẻ' }))
    await loaded()
    expect(router.state.location.pathname).toBe('/garden/share')
    expect(within(screen.getByRole('navigation', { name: 'Điều hướng chính' })).getAllByRole('link')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    await waitFor(() => expect(router.state.location.pathname + router.state.location.search).toBe(gardenUrl))
  })

  it.each([undefined, '/orders', 'https://evil.test/garden', '//evil.test/garden', '/garden/../orders'])('B103 rejects arbitrary return %s and falls back to Garden', async gardenReturnTo => {
    await fixture()
    const router = mount([{ pathname: '/garden/share', state: { gardenReturnTo } }])
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    await waitFor(() => expect(router.state.location.pathname + router.state.location.search).toBe('/garden'))
  })

  it('B104/B105/B109/B125 shares available15, excludes external collision and all private facts, without writes', async () => {
    await fixture()
    const before = await domainSnapshot()
    const storage = { ...localStorage }
    mount(); await loaded()
    expect(screen.getByRole('checkbox', { name: 'Chọn lô M06' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Chọn lô M07' })).toBeChecked()
    const text = (await generate()).value
    expect(text).toContain('Monthong\nCòn bán: 15 cây')
    expect(text).not.toMatch(/12 cây|35 cây|999|M06|M07|private|SECRET|0912345678|0987654321|87654321|Đang giữ|Thiếu cây/)
    expect(await domainSnapshot()).toEqual(before)
    expect({ ...localStorage }).toEqual(storage)
  })

  it('B106/B107/B108 uses group/leaf IDs without duplicates and exports only selected positive batches', async () => {
    await fixture(true)
    const dto = await query.getGardenAvailability({ view: 'all' })
    const monthong = dto.groups.find(group => group.key === 'monthong')!
    let ids = toggleGroup(monthong, new Set())
    expect(selectedShareGroups(dto, ids)[0].available).toBe(24)
    ids.delete('b-private')
    expect(selectedShareGroups(dto, ids)[0].available).toBe(9)
    ids = toggleGroup(monthong, ids)
    expect(selectedShareGroups(dto, ids)[0].available).toBe(24)
    mount(); await loaded()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn lô M07' }))
    expect((screen.getByRole('checkbox', { name: 'Chọn giống Monthong' }) as HTMLInputElement).indeterminate).toBe(true)
    expect(screen.getByText(/Chọn một phần/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn giống Monthong' }))
    expect(screen.getByText('Đã chọn: 24 cây')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn lô M08' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn giống Ri6' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Kèm mã lô' }))
    expect((await generate()).value).toContain('Monthong\nCòn bán: 15 cây\n- M07: 15 cây')
    expect(screen.getByRole('textbox').getAttribute('readonly')).not.toBeNull()
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).not.toMatch(/M08|Ri6|R01/)
    fireEvent.click(screen.getByRole('button', { name: 'Chọn lại / Tạo bảng mới' }))
    await loaded()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Kèm mã lô' }))
    expect((await generate()).value).not.toContain('M07')
  })

  it('B110/B113/B114 rereads at generation, freezes text through later writes and explicitly regenerates', async () => {
    await fixture(); mount(); await loaded()
    await db.batches.update('b-private', { readyQuantity: 18 })
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-10T03:30:00Z'))
    const first = (await generate()).value
    expect(first).toContain('Còn bán: 13 cây')
    expect(first).toContain('Tạo lúc: 10:30, 10/10/2026')
    await db.batches.update('b-private', { readyQuantity: 17 })
    const copy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } })
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép bảng hàng' }))
    await screen.findByText('Đã sao chép bảng hàng.')
    expect(copy).toHaveBeenCalledWith(first)
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(first)
    vi.setSystemTime(new Date('2026-10-10T04:00:00Z'))
    fireEvent.click(screen.getByRole('button', { name: 'Chọn lại / Tạo bảng mới' })); await loaded()
    const second = (await generate()).value
    expect(second).toContain('Còn bán: 12 cây')
    expect(second).toContain('Tạo lúc: 11:00, 10/10/2026')
    expect(second).not.toBe(first)
  })

  it.each(['deleted', 'zero'] as const)('B115 rejects a selected batch that becomes %s, then reconciles without selecting a replacement', async change => {
    await fixture(); mount(); await loaded()
    if (change === 'deleted') { await db.reservations.delete('rb-private'); await db.batches.delete('b-private') }
    else await db.batches.update('b-private', { readyQuantity: 5 })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bảng hàng' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Dữ liệu đã thay đổi')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await db.batches.put({ id: 'replacement', code: 'M09', variety: 'Monthong', createdAt: '2026-10-10', initialQuantity: 100, currentQuantity: 100, readyQuantity: 100, status: 'ready' })
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByRole('checkbox', { name: 'Chọn lô M09' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Tạo bảng hàng' })).toBeDisabled()
    expect(screen.getByText(/Các lô không còn cây bán/)).toBeInTheDocument()
  })

  it.each(['empty', 'zero'] as const)('B116/B117 has a genuine %s state, no false sales table', async kind => {
    if (kind === 'zero') { await fixture(); await db.batches.update('b-private', { readyQuantity: 5 }) }
    mount()
    await screen.findByText(kind === 'empty' ? 'Chưa có lô cây nào để chia sẻ.' : 'Chưa có cây còn bán để tạo bảng hàng.')
    expect(screen.getByRole('button', { name: 'Tạo bảng hàng' })).toBeDisabled()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('B118 retries an A1 read failure without partial or zero facts', async () => {
    await fixture()
    const read = vi.spyOn(query, 'getGardenAvailability').mockRejectedValueOnce(new Error('read fail'))
    mount(); await screen.findByRole('alert')
    expect(screen.queryByRole('checkbox', { name: 'Chọn lô M07' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); await loaded()
    expect((await generate()).value).toContain('Còn bán: 15 cây')
    expect(read).toHaveBeenCalledWith({ view: 'all' })
  })

  it.each(['missing', 'blank', 'read-error'] as const)('B118 rejects %s organization authority and retains retry', async kind => {
    await fixture(); mount(); await loaded()
    if (kind === 'missing') await db.organizations.clear()
    if (kind === 'blank') await db.organizations.update('org-private', { name: ' \u0000 ' })
    if (kind === 'read-error') vi.spyOn(organizationRepository, 'getCurrent').mockRejectedValueOnce(new Error('org fail'))
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bảng hàng' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('kiểm tra tên vườn')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await db.organizations.put({ id: 'org-private', name: 'Vườn mới', capabilities: ['sell'] })
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); await loaded()
    expect((await generate()).value).toContain('Vườn: Vườn mới')
  })

  it('B119 fails the entire table on corrupt unselected facts, with no repairs/writes', async () => {
    await fixture(); mount(); await loaded()
    await db.batches.put({ id: 'bad', code: 'BAD', variety: 'Other', createdAt: '2026-10-01', initialQuantity: 10, currentQuantity: 2, readyQuantity: 3, status: 'ready' })
    const before = await domainSnapshot()
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bảng hàng' }))
    await screen.findByRole('alert')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(await domainSnapshot()).toEqual(before)
  })

  it.each(['success', 'error'] as const)('B120 old load %s cannot replace a newer all-view load', async outcome => {
    await fixture()
    const oldDto = await query.getGardenAvailability({ view: 'all' })
    await db.batches.update('b-private', { readyQuantity: 25 })
    const fresh = await query.getGardenAvailability({ view: 'all' })
    const old = deferred<typeof oldDto>()
    vi.spyOn(query, 'getGardenAvailability').mockReturnValueOnce(old.promise).mockResolvedValueOnce(fresh)
    mount(); fireEvent.click(screen.getByRole('button', { name: 'Đọc lại' })); await loaded()
    expect(screen.getByText('Đã chọn: 20 cây')).toBeInTheDocument()
    await act(async () => { if (outcome === 'success') old.resolve(oldDto); else old.reject(new Error('old fail')) })
    expect(screen.getByText('Đã chọn: 20 cây')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each(['success', 'error'] as const)('B120 invalidates an obsolete generation %s when a new load wins', async outcome => {
    await fixture(); mount(); await loaded()
    const dto = await query.getGardenAvailability({ view: 'all' })
    const old = deferred<typeof dto>()
    const read = vi.spyOn(query, 'getGardenAvailability').mockReturnValueOnce(old.promise).mockResolvedValueOnce(dto)
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bảng hàng' }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Đọc lại' })); await loaded()
    await act(async () => { if (outcome === 'success') old.resolve(dto); else old.reject(new Error('old generation fail')) })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    read.mockRestore()
    expect((await generate()).value).toContain('Còn bán: 15 cây')
  })

  it('B110/B120 timestamps only after organization read completes, and discards an older organization generation', async () => {
    await fixture(); mount(); await loaded()
    const org = (await organizationRepository.getCurrent())!
    const old = deferred<typeof org>()
    vi.spyOn(organizationRepository, 'getCurrent').mockReturnValueOnce(old.promise)
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-10T03:30:00Z'))
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bảng hàng' }))
    await waitFor(() => expect(organizationRepository.getCurrent).toHaveBeenCalled())
    vi.setSystemTime(new Date('2026-10-10T04:00:00Z'))
    await act(async () => old.resolve(org))
    expect((await screen.findByRole('textbox') as HTMLTextAreaElement).value).toContain('Tạo lúc: 11:00, 10/10/2026')
    fireEvent.click(screen.getByRole('button', { name: 'Chọn lại / Tạo bảng mới' })); await loaded()
    const stale = deferred<typeof org>()
    vi.mocked(organizationRepository.getCurrent).mockReturnValueOnce(stale.promise)
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bảng hàng' }))
    await waitFor(() => expect(organizationRepository.getCurrent).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Đọc lại' })); await loaded()
    await act(async () => stale.resolve(org))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('B111/B121 reports copied only after resolve, exactly once with the displayed text', async () => {
    await fixture(); mount(); await loaded(); const text = (await generate()).value
    const pending = deferred<void>()
    const copy = vi.fn().mockReturnValue(pending.promise)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } })
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép bảng hàng' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép bảng hàng' }))
    expect(screen.queryByText('Đã sao chép bảng hàng.')).not.toBeInTheDocument()
    expect(copy).toHaveBeenCalledExactlyOnceWith(text)
    await act(async () => pending.resolve())
    expect(screen.getByText('Đã sao chép bảng hàng.')).toBeInTheDocument()
  })

  it.each(['unavailable', 'rejected'] as const)('B122 keeps manual selection and frozen text for Clipboard %s', async kind => {
    await fixture(); mount(); await loaded(); const before = await domainSnapshot(); const text = (await generate()).value
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: kind === 'unavailable' ? undefined : { writeText: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')) } })
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép bảng hàng' }))
    await screen.findByText('Chưa sao chép được. Chọn văn bản bên dưới rồi sao chép thủ công.')
    expect(screen.queryByText('Đã sao chép bảng hàng.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Chọn văn bản' }))
    const area = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(area).toHaveFocus(); expect(area.selectionStart).toBe(0); expect(area.selectionEnd).toBe(text.length)
    expect(area.value).toBe(text)
    expect(await domainSnapshot()).toEqual(before)
  })

  it.each(['resolved', 'canceled', 'rejected'] as const)('B112/B123/B124/B125 Web Share %s uses frozen text without DB writes or false delivery claims', async outcome => {
    await fixture(); mount(); await loaded()
    const before = await domainSnapshot()
    const share = vi.fn().mockImplementation(() => outcome === 'resolved' ? Promise.resolve() : Promise.reject(new DOMException('share', outcome === 'canceled' ? 'AbortError' : 'NotAllowedError')))
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    const text = (await generate()).value
    await db.batches.update('b-private', { readyQuantity: 18 })
    const afterMutation = await domainSnapshot()
    fireEvent.click(screen.getByRole('button', { name: 'Chia sẻ qua thiết bị' }))
    await screen.findByText(outcome === 'resolved' ? 'Đã chuyển nội dung tới chức năng chia sẻ của thiết bị.' : outcome === 'canceled' ? 'Đã hủy chia sẻ. Bạn vẫn có thể sao chép bảng hàng.' : 'Chưa mở được chức năng chia sẻ. Hãy sao chép bảng hàng hoặc chọn văn bản để sao chép thủ công.')
    expect(share).toHaveBeenCalledExactlyOnceWith({ text })
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(text)
    expect(screen.queryByText(/Đã gửi Zalo/)).not.toBeInTheDocument()
    expect(await domainSnapshot()).toEqual(afterMutation)
    expect(before[0]).toEqual(afterMutation[0])
    const copy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } })
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép bảng hàng' }))
    await screen.findByText('Đã sao chép bảng hàng.'); expect(copy).toHaveBeenCalledWith(text)
    expect(await domainSnapshot()).toEqual(afterMutation)
  })

  it('B124 hides unsupported share and still offers Copy/manual; canShare rejection is safe', async () => {
    await fixture(); mount(); await loaded(); await generate()
    expect(screen.queryByRole('button', { name: 'Chia sẻ qua thiết bị' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Chọn lại / Tạo bảng mới' })); await loaded()
    Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn() })
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn(() => { throw new Error('unsupported text') }) })
    await generate()
    expect(screen.queryByRole('button', { name: 'Chia sẻ qua thiết bị' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chọn văn bản' })).toBeEnabled()
  })

  it('B120 ignores an old clipboard completion after choosing again', async () => {
    await fixture(); mount(); await loaded(); await generate()
    const pending = deferred<void>()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockReturnValue(pending.promise) } })
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép bảng hàng' }))
    fireEvent.click(screen.getByRole('button', { name: 'Chọn lại / Tạo bảng mới' })); await loaded()
    await act(async () => pending.resolve())
    expect(screen.queryByText('Đã sao chép bảng hàng.')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('B126 preserves long Unicode facts and sanitizes them only in the export', async () => {
    await fixture()
    const name = 'Vườn Đắk Lắk '.repeat(30).trim()
    await db.organizations.update('org-private', { name: name + '\n\u202e' })
    await db.batches.update('b-private', { code: 'LÔ-'.repeat(70) + '\nCuối', variety: 'Giống\u2028Đặc biệt' })
    const before = await domainSnapshot()
    mount(); await screen.findByRole('checkbox', { name: /Chọn lô LÔ/ })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Kèm mã lô' }))
    const text = (await generate()).value
    expect(text).toContain(name); expect(text).toContain('Giống Đặc biệt'); expect(text).not.toMatch(/[\u202e\u2028]/)
    expect(await domainSnapshot()).toEqual(before)
  })

  it('B106 pure selection rejects duplicate IDs and missing IDs instead of partial totals', async () => {
    await fixture()
    const dto = await query.getGardenAvailability({ view: 'all' })
    const ids = eligibleBatchIds(dto)
    expect(() => selectedShareGroups({ ...dto, groups: [...dto.groups, ...dto.groups] }, ids)).toThrow()
    expect(() => selectedShareGroups(dto, new Set(['missing']))).toThrow('Dữ liệu đã thay đổi')
    expect(() => selectedShareGroups(dto, new Set())).toThrow()
  })
})
