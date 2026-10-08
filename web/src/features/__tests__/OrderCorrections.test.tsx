import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { OrderDetailScreen } from '../orders/OrderDetailScreen'
import { clearAllData, resetDemoData } from '../../data/seed'
import { db } from '../../data/db'
import { undoService } from '../../services/undoService'
import { createShipment, confirmShipment } from '../../services/shipmentService'
import { updateOrder } from '../../services/orderService'
import { availableQuantityForBatch } from '../../domain/quantity'

function renderOrder(id = 'order_hung_01') {
  return render(<MemoryRouter initialEntries={[`/orders/${id}`]}><Routes>
    <Route path="/orders/:id" element={<OrderDetailScreen />} />
  </Routes></MemoryRouter>)
}
async function openEdit() {
  fireEvent.click(await screen.findByRole('button', { name: 'SỬA ĐƠN' }))
  return screen.getByRole('dialog', { name: 'Sửa đơn' })
}
async function baseline() {
  return { batches: await db.batches.toArray(), reservations: await db.reservations.toArray(),
    shipments: await db.shipments.toArray(), orders: await db.orders.toArray(), events: await db.events.toArray() }
}

describe('FC2 Order Edit/Cancel UI', () => {
  beforeEach(async () => {
    undoService.clearLastMutation()
    await clearAllData(); await resetDemoData()
    await db.orders.update('order_hung_01', { requestedQuantity: 50000, status: 'partially_reserved', requestedDate: '2026-10-20T03:00:00.000Z' })
  })
  afterEach(() => { vi.restoreAllMocks(); undoService.clearLastMutation() })

  it('edits quantity through UI with truthful units/shortage and persists without changing source or stock', async () => {
    const before = await baseline()
    renderOrder(); const dialog = await openEdit()
    expect(within(dialog).getByLabelText(/Số lượng đặt/)).toHaveValue('50000')
    expect(within(dialog).getByRole('combobox', { name: 'Đơn vị tính số lượng' })).toHaveValue('cay')
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Đơn vị tính số lượng' }), { target: { value: 'van' } })
    fireEvent.change(within(dialog).getByLabelText(/Số lượng đặt/), { target: { value: '6' } })
    expect(within(dialog).getByText('= 60.000 cây')).toBeInTheDocument()
    expect(within(dialog).getByText(/Thiếu nguồn sau sửa/)).toHaveTextContent('30.000 cây')
    fireEvent.click(within(dialog).getByRole('button', { name: 'CẬP NHẬT ĐƠN' }))
    await screen.findByRole('status')
    expect(await db.orders.get('order_hung_01')).toMatchObject({ requestedQuantity: 60000, requestedDate: '2026-10-20T03:00:00.000Z' })
    expect(await db.reservations.toArray()).toEqual(before.reservations)
    expect(await db.batches.toArray()).toEqual(before.batches)
    expect(screen.getByText('Số đặt: 50.000 → 60.000 cây')).toBeInTheDocument()
  })

  it('permits reduction to coverage and blocks lower demand without pretending to reconcile', async () => {
    const before = await baseline()
    renderOrder(); const dialog = await openEdit()
    const input = within(dialog).getByLabelText(/Số lượng đặt/)
    fireEvent.change(input, { target: { value: '25000' } })
    expect(within(dialog).getByText(/Đang giữ dư 5.000 cây/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'CẬP NHẬT ĐƠN' })).toBeDisabled()
    expect(await baseline()).toEqual(before)
    fireEvent.change(input, { target: { value: '30000' } })
    expect(within(dialog).getByText(/Thiếu nguồn sau sửa/)).toHaveTextContent('0 cây')
    fireEvent.click(within(dialog).getByRole('button', { name: 'CẬP NHẬT ĐƠN' }))
    await screen.findByRole('status')
    expect(await db.orders.get('order_hung_01')).toMatchObject({ requestedQuantity: 30000, status: 'reserved' })
    expect(await db.reservations.toArray()).toEqual(before.reservations)
  })

  it('hides projected after numbers for unreadable input and protects saving', async () => {
    renderOrder(); const dialog = await openEdit()
    fireEvent.change(within(dialog).getByLabelText(/Số lượng đặt/), { target: { value: 'abc' } })
    expect(within(dialog).queryByText(/Số đặt sau sửa/)).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'CẬP NHẬT ĐƠN' })).toBeDisabled()
  })

  it('persists date/zero price/note and renders history by changed fields without a fake quantity change', async () => {
    renderOrder(); const dialog = await openEdit()
    fireEvent.change(within(dialog).getByLabelText('Ngày hẹn lấy'), { target: { value: '2026-11-01' } })
    fireEvent.change(within(dialog).getByLabelText('Giá mỗi cây (đồng)'), { target: { value: '0' } })
    fireEvent.change(within(dialog).getByLabelText('Ghi chú'), { target: { value: 'Đổi ngày lấy' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'CẬP NHẬT ĐƠN' }))
    await screen.findByRole('status')
    expect(await db.orders.get('order_hung_01')).toMatchObject({ requestedDate: '2026-11-01', unitPrice: 0, note: 'Đổi ngày lấy' })
    expect(screen.getByText('Đã sửa ngày hẹn lấy · Đã sửa giá mỗi cây · Đã sửa ghi chú')).toBeInTheDocument()
    expect(screen.queryByText(/50\.000 → 50\.000/)).not.toBeInTheDocument()
    expect(screen.getByText(/Giá mỗi cây:/)).toHaveTextContent('0 đồng')
  })

  it('preserves intervening order edits when the stale form submits only a new note', async () => {
    renderOrder(); const dialog = await openEdit()
    await act(async () => {
      expect(await updateOrder({ orderId: 'order_hung_01', requestedQuantity: 60000,
        requestedDate: '2026-11-02', unitPrice: 1500 })).toMatchObject({ success: true })
    })
    const before = await baseline()
    expect(within(dialog).getByLabelText(/Số lượng đặt/)).toHaveValue('50000')
    fireEvent.change(within(dialog).getByLabelText('Ghi chú'), { target: { value: 'Giao buổi sáng' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'CẬP NHẬT ĐƠN' }))
    await screen.findByRole('status')
    expect(await db.orders.get('order_hung_01')).toMatchObject({ requestedQuantity: 60000,
      requestedDate: '2026-11-02', unitPrice: 1500, note: 'Giao buổi sáng' })
    expect(await db.reservations.toArray()).toEqual(before.reservations)
    expect(await db.batches.toArray()).toEqual(before.batches)
    const correction = (await db.events.toArray()).find((event) => !before.events.some((old) => old.id === event.id))
    expect(correction).toMatchObject({ type: 'order_updated', payload: { changedFields: ['note'],
      before: { requestedQuantity: 60000 }, after: { requestedQuantity: 60000 } } })
    expect(screen.queryByText('Số đặt: 60.000 → 50.000 cây')).not.toBeInTheDocument()
  })

  it('lets the last intentional quantity edit win, validated against current supply at commit time', async () => {
    renderOrder(); const dialog = await openEdit()
    await act(async () => {
      expect(await updateOrder({ orderId: 'order_hung_01', requestedQuantity: 60000 })).toMatchObject({ success: true })
    })
    const before = await baseline()
    fireEvent.change(within(dialog).getByLabelText(/Số lượng đặt/), { target: { value: '55000' } })
    expect(within(dialog).getByText(/Số đặt sau sửa/)).toHaveTextContent('55.000 cây')
    expect(within(dialog).getByText(/Thiếu nguồn sau sửa/)).toHaveTextContent('25.000 cây')
    fireEvent.click(within(dialog).getByRole('button', { name: 'CẬP NHẬT ĐƠN' }))
    await screen.findByRole('status')
    expect(await db.orders.get('order_hung_01')).toMatchObject({ requestedQuantity: 55000 })
    expect(await db.reservations.toArray()).toEqual(before.reservations)
    expect(await db.batches.toArray()).toEqual(before.batches)
    expect(screen.getByText('Số đặt: 60.000 → 55.000 cây')).toBeInTheDocument()
  })

  it('exposes variety only with no reservation history and permits changing it', async () => {
    await db.reservations.where('orderId').equals('order_hung_01').delete()
    await db.orders.update('order_hung_01', { status: 'open' })
    renderOrder(); const dialog = await openEdit()
    fireEvent.change(within(dialog).getByLabelText('Giống cây'), { target: { value: 'Keo lai AH1' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'CẬP NHẬT ĐƠN' }))
    await screen.findByRole('status')
    expect((await db.orders.get('order_hung_01'))?.variety).toBe('Keo lai AH1')
  })

  it('keeps variety read-only even when all reservations have been released', async () => {
    await db.reservations.where('orderId').equals('order_hung_01').modify({ status: 'released' })
    await db.orders.update('order_hung_01', { status: 'open' })
    renderOrder(); const dialog = await openEdit()
    expect(within(dialog).queryByLabelText('Giống cây')).not.toBeInTheDocument()
    expect(within(dialog).getByText(/Giống cây đã khóa/)).toBeInTheDocument()
  })

  it('cancels via a preview of own/external sources and planned shipments, preserving physical stock/history', async () => {
    const plan = await createShipment({ orderId: 'order_hung_01', lines: [{ reservationId: 'res_bv16_hung_own', quantity: 10000 }] })
    const before = await baseline()
    renderOrder()
    fireEvent.click(await screen.findByRole('button', { name: 'HỦY ĐƠN' }))
    const dialog = screen.getByRole('dialog', { name: 'Xác nhận hủy đơn' })
    expect(within(dialog).getByText('Sẽ nhả 2 nguồn giữ, tổng 30.000 cây.')).toBeInTheDocument()
    expect(within(dialog).getByText('Sẽ hủy 1 chuyến chờ xuất.')).toBeInTheDocument()
    expect(within(dialog).getByText(/Vườn Thảo:/)).toHaveTextContent('20.000 cây')
    expect(within(dialog).getByText(/BV16 #12/)).toHaveTextContent('10.000 cây')
    expect(await baseline()).toEqual(before)
    fireEvent.click(within(dialog).getByRole('button', { name: 'XÁC NHẬN HỦY ĐƠN' }))
    fireEvent.click(within(dialog).getByRole('button', { name: /HỦY ĐƠN|Đang hủy/ }))
    await screen.findByRole('status')
    expect((await db.orders.get('order_hung_01'))?.status).toBe('cancelled')
    expect((await db.shipments.get(plan.shipment.id))?.status).toBe('cancelled')
    expect(await db.batches.toArray()).toEqual(before.batches)
    expect(await db.reservations.count()).toBe(before.reservations.length)
    for (const event of before.events) expect(await db.events.get(event.id)).toEqual(event)
    expect(screen.queryByRole('button', { name: 'HỦY ĐƠN' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'SỬA ĐƠN' })).not.toBeInTheDocument()
    expect(screen.getByText('Đã hủy')).toBeInTheDocument()
    expect(await db.events.where('type').equals('order_cancelled').count()).toBe(1)
    const batch = (await db.batches.get('batch_bv16_12'))!
    expect(availableQuantityForBatch(batch, await db.reservations.toArray())).toBe(32000)
  })

  it('closing or Escape leaves the order intact and returns focus to its action', async () => {
    const before = await baseline()
    renderOrder(); const dialog = await openEdit()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'HỦY ĐƠN' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Đóng' }))
    expect(await baseline()).toEqual(before)
  })

  it('handles a stale quantity preview with the real service conflict and leaves metadata untouched', async () => {
    renderOrder(); const dialog = await openEdit()
    fireEvent.change(within(dialog).getByLabelText(/Số lượng đặt/), { target: { value: '35000' } })
    fireEvent.change(within(dialog).getByLabelText('Ghi chú'), { target: { value: 'should not save' } })
    await db.reservations.add({ id: 'new-hold', orderId: 'order_hung_01', sourceType: 'own_batch', batchId: 'batch_bv16_12', quantity: 10000, fulfilledQuantity: 0, status: 'active', createdAt: '2026-10-08' })
    const before = await baseline()
    fireEvent.click(within(dialog).getByRole('button', { name: 'CẬP NHẬT ĐƠN' }))
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'CẬP NHẬT ĐƠN' })).toBeDisabled())
    expect(within(dialog).getAllByText(/Đang giữ dư 5.000 cây/).length).toBeGreaterThan(0)
    expect(await baseline()).toEqual(before)
  })

  it('requires confirmation of refreshed cancellation consequences if a new source appeared', async () => {
    renderOrder()
    fireEvent.click(await screen.findByRole('button', { name: 'HỦY ĐƠN' }))
    const dialog = screen.getByRole('dialog')
    await db.reservations.add({ id: 'new-hold', orderId: 'order_hung_01', sourceType: 'own_batch', batchId: 'batch_bv16_12', quantity: 10000, fulfilledQuantity: 0, status: 'active', createdAt: '2026-10-08' })
    const before = await baseline()
    fireEvent.click(within(dialog).getByRole('button', { name: 'XÁC NHẬN HỦY ĐƠN' }))
    await within(dialog).findByText(/Nguồn giữ hoặc chuyến chờ xuất đã thay đổi/)
    await within(dialog).findByText('Sẽ nhả 3 nguồn giữ, tổng 40.000 cây.')
    expect(await baseline()).toEqual(before)
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'XÁC NHẬN HỦY ĐƠN' })).toBeEnabled())
    fireEvent.click(within(dialog).getByRole('button', { name: 'XÁC NHẬN HỦY ĐƠN' }))
    await screen.findByRole('status')
    expect((await db.orders.get('order_hung_01'))?.status).toBe('cancelled')
  })

  it('keeps form values after a storage failure and does not partially update the order', async () => {
    renderOrder(); const dialog = await openEdit()
    fireEvent.change(within(dialog).getByLabelText('Ghi chú'), { target: { value: 'retry note' } })
    const before = await baseline()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const write = vi.spyOn(db.events, 'put').mockImplementation(() => { throw new Error('disk failure') })
    fireEvent.click(within(dialog).getByRole('button', { name: 'CẬP NHẬT ĐƠN' }))
    await within(dialog).findByText(/Chưa lưu được thay đổi đơn hàng/)
    expect(within(dialog).getByLabelText('Ghi chú')).toHaveValue('retry note')
    expect(await baseline()).toEqual(before)
    write.mockRestore()
  })

  it('permits cancelling an unreserved order after a zero-effect preview', async () => {
    await db.reservations.where('orderId').equals('order_hung_01').delete()
    await db.orders.update('order_hung_01', { status: 'open' })
    renderOrder()
    fireEvent.click(await screen.findByRole('button', { name: 'HỦY ĐƠN' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Sẽ nhả 0 nguồn giữ, tổng 0 cây.')).toBeInTheDocument()
    expect(within(dialog).getByText('Sẽ hủy 0 chuyến chờ xuất.')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'XÁC NHẬN HỦY ĐƠN' }))
    await screen.findByRole('status')
    expect((await db.orders.get('order_hung_01'))?.status).toBe('cancelled')
  })

  it('recovers a variety edit if reservation history appeared while the form was open', async () => {
    await db.reservations.where('orderId').equals('order_hung_01').delete()
    await db.orders.update('order_hung_01', { status: 'open' })
    renderOrder(); const dialog = await openEdit()
    fireEvent.change(within(dialog).getByLabelText('Giống cây'), { target: { value: 'Keo lai AH1' } })
    await db.reservations.add({ id: 'new-hold', orderId: 'order_hung_01', sourceType: 'own_batch', batchId: 'batch_bv16_12', quantity: 10000, status: 'active', createdAt: '2026-10-08' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'CẬP NHẬT ĐƠN' }))
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Giữ giống cây hiện tại' }))
    fireEvent.change(within(dialog).getByLabelText('Ghi chú'), { target: { value: 'Giữ BV16' } })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'CẬP NHẬT ĐƠN' })).toBeEnabled())
    fireEvent.click(within(dialog).getByRole('button', { name: 'CẬP NHẬT ĐƠN' }))
    await screen.findByRole('status')
    expect(await db.orders.get('order_hung_01')).toMatchObject({ variety: 'Keo lai BV16', note: 'Giữ BV16' })
  })

  it('refreshes a cancel preview when a new planned shipment appears, then requires another confirmation', async () => {
    renderOrder()
    fireEvent.click(await screen.findByRole('button', { name: 'HỦY ĐƠN' }))
    const dialog = screen.getByRole('dialog')
    const plan = await createShipment({ orderId: 'order_hung_01', lines: [{ reservationId: 'res_bv16_hung_own', quantity: 10000 }] })
    fireEvent.click(within(dialog).getByRole('button', { name: 'XÁC NHẬN HỦY ĐƠN' }))
    await within(dialog).findByText('Sẽ hủy 1 chuyến chờ xuất.')
    expect((await db.shipments.get(plan.shipment.id))?.status).toBe('planned')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'XÁC NHẬN HỦY ĐƠN' })).toBeEnabled())
    fireEvent.click(within(dialog).getByRole('button', { name: 'XÁC NHẬN HỦY ĐƠN' }))
    await screen.findByRole('status')
    expect((await db.shipments.get(plan.shipment.id))?.status).toBe('cancelled')
  })

  it('keeps cancellation open and shows failure when history cannot be saved', async () => {
    renderOrder()
    fireEvent.click(await screen.findByRole('button', { name: 'HỦY ĐƠN' }))
    const dialog = screen.getByRole('dialog')
    const before = await baseline()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(db.events, 'put').mockImplementation(() => { throw new Error('disk failure') })
    fireEvent.click(within(dialog).getByRole('button', { name: 'XÁC NHẬN HỦY ĐƠN' }))
    await within(dialog).findByText(/Chưa hủy được đơn hàng/)
    expect(await baseline()).toEqual(before)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('hides edit/cancel actions after actual shipment even if the stored order status is stale', async () => {
    const plan = await createShipment({ orderId: 'order_hung_01', lines: [{ reservationId: 'res_bv16_hung_own', quantity: 10000 }] })
    await confirmShipment({ shipmentId: plan.shipment.id })
    await db.orders.update('order_hung_01', { status: 'open' })
    renderOrder()
    await screen.findByText('Đơn đã xuất cây; không thể sửa hoặc hủy toàn bộ.')
    expect(screen.queryByRole('button', { name: 'SỬA ĐƠN' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'HỦY ĐƠN' })).not.toBeInTheDocument()
  })

  it('removes whole-cancel confirmation if a shipment completed while the preview was open', async () => {
    const plan = await createShipment({ orderId: 'order_hung_01', lines: [{ reservationId: 'res_bv16_hung_own', quantity: 10000 }] })
    renderOrder()
    fireEvent.click(await screen.findByRole('button', { name: 'HỦY ĐƠN' }))
    const dialog = screen.getByRole('dialog')
    await confirmShipment({ shipmentId: plan.shipment.id })
    const before = await baseline()
    fireEvent.click(within(dialog).getByRole('button', { name: 'XÁC NHẬN HỦY ĐƠN' }))
    await within(dialog).findByRole('button', { name: 'QUAY LẠI ĐƠN' })
    expect(within(dialog).queryByRole('button', { name: 'XÁC NHẬN HỦY ĐƠN' })).not.toBeInTheDocument()
    expect(within(dialog).queryByText(/FC5/)).not.toBeInTheDocument()
    expect(await baseline()).toEqual(before)
  })
})
