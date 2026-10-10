import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../data/db'
import { clearAllData } from '../../../data/seed'
import { contactRepository } from '../../../data/repositories'
import { OrderNewScreen } from '../../orders/OrderNewScreen'
import { OrderDetailScreen } from '../../orders/OrderDetailScreen'
import { CustomerDetailScreen } from '../CustomerDetailScreen'
import { undoService } from '../../../services/undoService'
import type { DomainEvent } from '../../../analytics/events'
import { businessSnapshot, customerFixture } from './customerFixtures'

function mount(path = '/customers/customer-b', state?: unknown) {
  const router = createMemoryRouter([
    { path: '/customers/:id', element: <CustomerDetailScreen /> },
    { path: '/orders/new', element: <OrderNewScreen /> },
    { path: '/orders/:id', element: <OrderDetailScreen /> },
    { path: '/orders', element: <h1>Danh sách đơn</h1> }
  ], { initialEntries: [{ pathname: path, state }] })
  return { router, ...render(<RouterProvider router={router} />) }
}
const intent = (id: unknown) => ({ customerIntentId: id, customerReturnTo: '/customers/customer-b' })
beforeEach(async () => { await clearAllData(); undoService.clearLastMutation(); await customerFixture() })
afterEach(() => { cleanup(); vi.restoreAllMocks(); undoService.clearLastMutation() })

describe('B2 customer order entry (real Dexie)', () => {
  it('B222 exact dual-role ID prefill/default quantity and cancel preserve all business facts', async () => {
    const before = await businessSnapshot()
    const { router } = mount()
    fireEvent.click(await screen.findByRole('link', { name: 'Ghi đơn cho khách' }))
    await waitFor(() => expect(screen.getByLabelText(/Khách đặt cây/)).toHaveValue('customer-b'))
    expect(screen.getByLabelText(/Số lượng đặt/)).toHaveValue('3')
    expect(screen.getByLabelText(/Loại cây giống/)).toHaveValue('Keo lai BV16')
    expect(await businessSnapshot()).toEqual(before)
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    await screen.findByRole('region', { name: 'Thông tin khách' })
    expect(router.state.location.pathname).toBe('/customers/customer-b')
    expect(await businessSnapshot()).toEqual(before)
  })
  it.each(['missing', 'supplier', '', null, 42])('B223 invalid intent %s never picks first customer or submits until explicit selection', async id => {
    const before = await businessSnapshot()
    const { router } = mount('/orders/new', intent(id))
    await screen.findByText(/Khách được yêu cầu không còn hợp lệ/)
    expect(screen.getByLabelText(/Khách đặt cây/)).toHaveValue('')
    expect(screen.getByRole('button', { name: 'LƯU ĐƠN HÀNG' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'LƯU ĐƠN HÀNG' }))
    expect(await businessSnapshot()).toEqual(before)
    fireEvent.change(screen.getByLabelText(/Khách đặt cây/), { target: { value: 'customer-c' } })
    expect(screen.getByRole('button', { name: 'LƯU ĐƠN HÀNG' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    await screen.findByText('Danh sách đơn')
    expect(router.state.location.pathname).toBe('/orders')
  })
  it('B224 failed create rolls back, preserves edited draft, retries once without auto-reservation and keeps actual customer context', async () => {
    const { router } = mount('/orders/new', intent('customer-b'))
    await waitFor(() => expect(screen.getByLabelText(/Khách đặt cây/)).toHaveValue('customer-b'))
    fireEvent.change(screen.getByLabelText(/Loại cây giống/), { target: { value: 'Monthong' } })
    fireEvent.change(screen.getByLabelText(/Số lượng đặt/), { target: { value: '2' } })
    const before = await businessSnapshot()
    const fail = (_key: unknown, event: DomainEvent) => { if (event.type === 'order_created') throw new Error('failed event') }
    db.events.hook('creating', fail)
    try {
      fireEvent.click(screen.getByRole('button', { name: 'LƯU ĐƠN HÀNG' }))
      await screen.findByText(/Chưa lưu được đơn hàng trên thiết bị/)
      expect(screen.getByLabelText(/Khách đặt cây/)).toHaveValue('customer-b')
      expect(screen.getByLabelText(/Loại cây giống/)).toHaveValue('Monthong')
      expect(screen.getByLabelText(/Số lượng đặt/)).toHaveValue('2')
      expect(await businessSnapshot()).toEqual(before)
      expect(undoService.getLastMutation()).toBeNull()
    } finally { db.events.hook('creating').unsubscribe(fail) }
    fireEvent.click(screen.getByRole('button', { name: 'LƯU ĐƠN HÀNG' }))
    await screen.findByText('Đơn đặt Monthong')
    const created = (await db.orders.toArray()).filter(order => order.customerId === 'customer-b')
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ requestedQuantity: 20000, status: 'open', variety: 'Monthong' })
    expect(router.state.location.pathname).toBe(`/orders/${created[0].id}`)
    expect(await db.batches.toArray()).toEqual(before[1])
    expect(await db.reservations.toArray()).toEqual(before[3])
    expect((await db.events.toArray()).filter(event => event.type === 'order_created')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    await screen.findByRole('region', { name: 'Thông tin khách' })
    expect(router.state.location.pathname).toBe('/customers/customer-b')
    await act(async () => { expect((await undoService.undoLastMutation()).success).toBe(true) })
    expect(await db.orders.count()).toBe(2)
  })
  it('B222 changed customer saves chosen ID and drops previous customer return context', async () => {
    const { router } = mount('/orders/new', intent('customer-b'))
    await waitFor(() => expect(screen.getByLabelText(/Khách đặt cây/)).toHaveValue('customer-b'))
    fireEvent.change(screen.getByLabelText(/Khách đặt cây/), { target: { value: 'customer-c' } })
    fireEvent.click(screen.getByRole('button', { name: 'LƯU ĐƠN HÀNG' }))
    await screen.findByText('Đơn đặt Keo lai BV16')
    expect((await db.orders.toArray()).filter(order => order.customerId === 'customer-c')).toHaveLength(1)
    expect(router.state.location.state?.customerReturnTo).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    await screen.findByText('Danh sách đơn')
    expect(router.state.location.pathname).toBe('/orders')
  })
  it('B225 slow baseline does not reset variety/quantity or a customer committed by existing quick create', async () => {
    const old = await contactRepository.getAll()
    let resolve!: (value: typeof old) => void
    vi.spyOn(contactRepository, 'getAll').mockImplementationOnce(() => new Promise(yes => { resolve = yes }))
    mount('/orders/new', intent('customer-b'))
    fireEvent.change(screen.getByLabelText(/Loại cây giống/), { target: { value: 'Keo lai AH1' } })
    fireEvent.change(screen.getByLabelText(/Số lượng đặt/), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: '+ Khách mới' }))
    const dialog = within(await screen.findByRole('dialog'))
    fireEvent.change(dialog.getByLabelText(/Tên khách hàng/), { target: { value: 'Khách mới trong lúc tải' } })
    fireEvent.click(dialog.getByRole('button', { name: /Lưu/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const created = (await db.contacts.toArray()).find(contact => contact.name === 'Khách mới trong lúc tải')!
    await act(async () => { resolve(old) })
    await waitFor(() => expect(screen.getByLabelText(/Khách đặt cây/)).toHaveValue(created.id))
    expect(screen.getByLabelText(/Loại cây giống/)).toHaveValue('Keo lai AH1')
    expect(screen.getByLabelText(/Số lượng đặt/)).toHaveValue('2')
    expect(screen.getByRole('button', { name: 'LƯU ĐƠN HÀNG' })).toBeEnabled()
  })
  it('baseline failure is explicit; retry preserves edited draft and resolves exact intent', async () => {
    vi.spyOn(contactRepository, 'getAll').mockRejectedValueOnce(new Error('read failed'))
    mount('/orders/new', intent('customer-b'))
    await screen.findByText(/Chưa đọc được danh bạ/)
    fireEvent.change(screen.getByLabelText(/Loại cây giống/), { target: { value: 'Keo lai AH1' } })
    fireEvent.change(screen.getByLabelText(/Số lượng đặt/), { target: { value: '2' } })
    expect(screen.getByRole('button', { name: 'LƯU ĐƠN HÀNG' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Đọc lại danh bạ' }))
    await waitFor(() => expect(screen.getByLabelText(/Khách đặt cây/)).toHaveValue('customer-b'))
    expect(screen.getByLabelText(/Loại cây giống/)).toHaveValue('Keo lai AH1')
    expect(screen.getByLabelText(/Số lượng đặt/)).toHaveValue('2')
  })
})
