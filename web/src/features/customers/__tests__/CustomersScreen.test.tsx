import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../data/db'
import { clearAllData } from '../../../data/seed'
import { shipmentRepository } from '../../../data/repositories'
import { CustomersScreen } from '../CustomersScreen'
import { CustomerDetailScreen } from '../CustomerDetailScreen'
import { MoreScreen } from '../../more/MoreScreen'
import { OrderDetailScreen } from '../../orders/OrderDetailScreen'
import { OrdersScreen } from '../../orders/OrdersScreen'
import { AppShell } from '../../../shared/components/AppShell'
import * as query from '../../../services/customerQueryService'
import { createOrder } from '../../../services/orderService'
import { undoService } from '../../../services/undoService'
import { businessSnapshot, customerFixture, orderA, orderB } from './customerFixtures'

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function mount(path = '/customers', state?: unknown) {
  const router = createMemoryRouter([{ element: <AppShell><Outlet /></AppShell>, children: [
    { path: '/customers', element: <CustomersScreen /> }, { path: '/customers/:id', element: <CustomerDetailScreen /> },
    { path: '/more', element: <MoreScreen /> }, { path: '/orders', element: <OrdersScreen /> },
    { path: '/orders/:id', element: <OrderDetailScreen /> }, { path: '/shipments/:id', element: <h1>Chuyến đúng ID</h1> }
  ] }], { initialEntries: [{ pathname: path, state }] })
  return { router, ...render(<RouterProvider router={router} />) }
}
beforeEach(async () => {
  await clearAllData(); undoService.clearLastMutation(); await customerFixture()
  await db.organizations.put({ id: 'org', name: 'Vườn test', capabilities: ['sell'] })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); undoService.clearLastMutation() })

describe('B2 customer views (real Dexie)', () => {
  it('B203/B204/B206 More entry, role list/name/phone/no-results/clear preserve facts and four tabs', async () => {
    const before = await businessSnapshot()
    mount('/more')
    fireEvent.click(await screen.findByRole('button', { name: 'Xem khách hàng' }))
    await screen.findByRole('region', { name: 'Danh sách khách' })
    expect(within(screen.getByRole('navigation', { name: 'Điều hướng chính' })).getAllByRole('link')).toHaveLength(4)
    expect(screen.getAllByRole('link', { name: 'Xem khách Anh Hùng' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Xem khách Khách hai vai trò' })).toHaveLength(1)
    expect(screen.queryByRole('link', { name: 'Xem khách Vườn ngoài' })).not.toBeInTheDocument()
    const search = screen.getByRole('searchbox')
    fireEvent.change(search, { target: { value: 'HÙNG' } })
    expect(screen.getAllByRole('link', { name: 'Xem khách Anh Hùng' })).toHaveLength(2)
    fireEvent.change(search, { target: { value: '091234' } })
    expect(screen.getAllByRole('link', { name: 'Xem khách Anh Hùng' })).toHaveLength(2)
    fireEvent.change(search, { target: { value: 'PRIVATE NOTE' } })
    expect(screen.getByText('Không tìm thấy khách phù hợp.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(await businessSnapshot()).toEqual(before)
  })
  it('B202/B209/B210/B216/B217/B220 identical orders link distinctly, back validates actual customer, history uses actual date', async () => {
    const before = await businessSnapshot()
    const { router } = mount('/customers/customer-a')
    await screen.findByRole('region', { name: 'Thông tin khách' })
    const orders = within(screen.getByRole('region', { name: 'Đơn hàng của khách' }))
    const links = orders.getAllByRole('link')
    expect(links.map(link => link.getAttribute('href'))).toEqual([`/orders/${orderA}`, `/orders/${orderB}`])
    expect(new Set(links.map(link => link.getAttribute('aria-label'))).size).toBe(2)
    for (const id of [orderA, orderB]) {
      const link = within(screen.getByRole('region', { name: 'Đơn hàng của khách' })).getAllByRole('link').find(link => link.getAttribute('href') === `/orders/${id}`)!
      fireEvent.click(link)
      await screen.findByText('Đơn đặt Monthong')
      expect(router.state.location.pathname).toBe(`/orders/${id}`)
      fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
      await screen.findByRole('region', { name: 'Thông tin khách' })
      expect(router.state.location.pathname).toBe('/customers/customer-a')
    }
    const history = within(screen.getByRole('region', { name: 'Lịch sử xuất cây' }))
    expect(history.getAllByRole('article')).toHaveLength(2)
    expect(history.getByText('Chưa có thời điểm xuất')).toBeInTheDocument()
    expect(history.queryByText(/15\/10/)).not.toBeInTheDocument()
    fireEvent.click(history.getAllByRole('link')[0])
    await screen.findByText('Chuyến đúng ID')
    expect(router.state.location.pathname).toBe('/shipments/shipped-a')
    expect(await businessSnapshot()).toEqual(before)
  })
  it.each([undefined, '/customers/customer-b', 'https://evil.test/customers/customer-a', '/customers/customer-a?fake=1'])('B221 legacy/direct/forged back %s stays /orders', async customerReturnTo => {
    const { router } = mount(`/orders/${orderA}`, { customerReturnTo })
    await screen.findByText('Đơn đặt Monthong')
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    await screen.findByRole('heading', { name: 'Đơn hàng' })
    expect(router.state.location.pathname).toBe('/orders')
  })
  it('B207 missing phone/no orders/history remain readable without pretending a number', async () => {
    mount('/customers/customer-b')
    await screen.findByText('Khách chưa có đơn hàng.')
    expect(screen.getByText('Chưa có lịch sử xuất cây.')).toBeInTheDocument()
    expect(screen.getByText('Chưa có số điện thoại')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Gọi' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ghi đơn cho khách' })).toBeInTheDocument()
  })
  it('B229 safe phone link is explicit and no business write occurs while viewing it', async () => {
    const before = await businessSnapshot()
    mount('/customers/customer-a'); await screen.findByRole('link', { name: 'Gọi' })
    expect(screen.getByRole('link', { name: 'Gọi' })).toHaveAttribute('href', 'tel:0912345678')
    expect(await businessSnapshot()).toEqual(before)
  })
  it('B207 imported unsafe phone never becomes a URI', async () => {
    await db.contacts.update('customer-a', { phone: 'javascript:alert(1)' })
    mount('/customers/customer-a'); await screen.findByRole('region', { name: 'Thông tin khách' })
    expect(screen.queryByRole('link', { name: 'Gọi' })).not.toBeInTheDocument()
  })
  it.each(['missing', 'supplier', 'deleted'])('direct %s customer is clearly not found, with no wrong order links', async id => {
    const { router } = mount(`/customers/${id}`)
    await screen.findByText(/Không tìm thấy khách hàng này/)
    expect(screen.queryByRole('region', { name: 'Đơn hàng của khách' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Về danh sách khách' }))
    await screen.findByRole('region', { name: 'Danh sách khách' })
    expect(router.state.location.pathname).toBe('/customers')
  })
  it('B205 true empty is distinct from read failure', async () => {
    await clearAllData(); mount()
    await screen.findByText('Chưa có khách hàng trong danh bạ.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it.each(['list', 'detail'] as const)('B226 %s hides previous facts on error then retries current facts', async kind => {
    mount(kind === 'list' ? '/customers' : '/customers/customer-a')
    await screen.findAllByRole('heading', { name: 'Anh Hùng' })
    vi.spyOn(shipmentRepository, 'getAll').mockRejectedValueOnce(new Error('read failed'))
    fireEvent.click(screen.getByRole('button', { name: 'Đọc lại' }))
    await screen.findByRole('alert')
    expect(screen.queryAllByRole('heading', { name: 'Anh Hùng' })).toHaveLength(0)
    expect(screen.queryByText('Chưa có khách hàng trong danh bạ.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findAllByRole('heading', { name: 'Anh Hùng' })
  })
  it.each(['success', 'error'] as const)('B227 older list %s cannot replace new snapshot', async outcome => {
    const old = await query.getCustomers()
    const pending = deferred<typeof old>()
    const original = query.getCustomers
    vi.spyOn(query, 'getCustomers').mockImplementationOnce(() => pending.promise).mockImplementation(original)
    mount(); await screen.findByText('Đang đọc dữ liệu khách...')
    await db.contacts.update('customer-a', { name: 'Khách mới nhất' })
    fireEvent.click(screen.getByRole('button', { name: 'Đọc lại' }))
    await screen.findByRole('heading', { name: 'Khách mới nhất' })
    await act(async () => { if (outcome === 'success') pending.resolve(old); else pending.reject(new Error('old failure')) })
    expect(screen.getByRole('heading', { name: 'Khách mới nhất' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it.each(['success', 'error'] as const)('B227 older detail %s cannot replace new snapshot', async outcome => {
    const old = await query.getCustomerDetail('customer-a')
    const pending = deferred<typeof old>()
    const original = query.getCustomerDetail
    vi.spyOn(query, 'getCustomerDetail').mockImplementationOnce(() => pending.promise).mockImplementation(original)
    mount('/customers/customer-a'); await screen.findByText('Đang đọc dữ liệu khách...')
    await db.contacts.update('customer-a', { name: 'Khách mới nhất' })
    fireEvent.click(screen.getByRole('button', { name: 'Đọc lại' }))
    await screen.findByRole('heading', { name: 'Khách mới nhất' })
    await act(async () => { if (outcome === 'success') pending.resolve(old); else pending.reject(new Error('old failure')) })
    expect(screen.getByRole('heading', { name: 'Khách mới nhất' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('B228 committed create/Undo notifications and focus/visibility refresh actual facts', async () => {
    mount('/customers/customer-a'); await screen.findByRole('region', { name: 'Thông tin khách' })
    await act(async () => { expect((await createOrder({ customerId: 'customer-a', variety: 'Monthong', requestedQuantity: 10 })).success).toBe(true) })
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Thông tin khách' })).getByText('3')).toBeInTheDocument())
    await act(async () => { expect((await undoService.undoLastMutation()).success).toBe(true) })
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Thông tin khách' })).getByText('2')).toBeInTheDocument())
    await db.contacts.update('customer-a', { name: 'Sau focus' })
    fireEvent.focus(window); await screen.findByRole('heading', { name: 'Sau focus' })
    await db.contacts.update('customer-a', { name: 'Sau visibility' })
    fireEvent(document, new Event('visibilitychange')); await screen.findByRole('heading', { name: 'Sau visibility' })
  })
})
