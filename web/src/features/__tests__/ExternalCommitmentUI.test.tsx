import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { OrderReserveScreen } from '../orders/OrderReserveScreen'
import { db } from '../../data/db'
import { clearAllData } from '../../data/seed'
import { undoService } from '../../services/undoService'
import { reserveExternalSupplier } from '../../services/reservationService'
import { createShipment, confirmShipment } from '../../services/shipmentService'

vi.mock('../../validation/validationTracker', () => ({ validationTracker: {
  formStarted: vi.fn(), actionCompleted: vi.fn(), actionFailed: vi.fn()
} }))

async function openScreen() {
  render(<MemoryRouter initialEntries={['/orders/order/reserve']}><Routes>
    <Route path="/orders/:id/reserve" element={<OrderReserveScreen />} />
  </Routes></MemoryRouter>)
  await screen.findByRole('button', { name: 'Giữ nguồn từ Vườn Thảo' })
}
function openExternal(quantity?: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Giữ nguồn từ Vườn Thảo' }))
  if (quantity) fireEvent.change(screen.getByLabelText(/Số cây đã xác nhận giữ/), { target: { value: quantity } })
}
function confirm() {
  fireEvent.click(screen.getByRole('checkbox', { name: /Đã gọi/ }))
  fireEvent.click(screen.getByRole('button', { name: 'GIỮ NGUỒN' }))
}

describe('FC4 external screen + mutation (real Dexie)', () => {
  beforeEach(async () => {
    await clearAllData(); undoService.clearLastMutation()
    await db.contacts.bulkPut([
      { id: 'customer', name: 'Khách cũ', phone: '0912345678', roles: ['customer'] },
      { id: 'supplier', name: 'Vườn Thảo', phone: '0987654321', roles: ['supplier'] },
      { id: 'no-phone', name: 'Vườn không điện thoại', roles: ['supplier'] }
    ])
    await db.orders.put({ id: 'order', customerId: 'customer', variety: 'Keo lai BV16', requestedQuantity: 20000, status: 'open' })
    await db.batches.put({ id: 'batch', code: 'BV16 #1', variety: 'Keo lai BV16', initialQuantity: 80000,
      currentQuantity: 80000, readyQuantity: 60000, status: 'ready', createdAt: '2026-10-08' })
  })
  afterEach(() => { cleanup(); undoService.clearLastMutation(); vi.restoreAllMocks() })

  it('shows only contact/order context; phone call cannot confirm, autofill or reserve', async () => {
    await openScreen()
    expect(screen.queryByText(/Có khoảng|Số lượng tham khảo|Tham khảo nguồn/)).not.toBeInTheDocument()
    expect(screen.getAllByText('Giống của đơn: Keo lai BV16')).toHaveLength(2)
    const call = screen.getByRole('link', { name: 'GỌI XÁC NHẬN Vườn Thảo' })
    expect(call).toHaveAttribute('href', 'tel:0987654321')
    call.addEventListener('click', e => e.preventDefault())
    fireEvent.click(call)
    expect(await db.reservations.count()).toBe(0)
    openExternal()
    expect(screen.getByLabelText(/Số cây đã xác nhận giữ/)).toHaveValue('')
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'GIỮ NGUỒN' })).toBeDisabled()
  })

  it('user-confirmed partial12k and rapid double-submit create one commitment and reload shortage8k', async () => {
    const before = await db.batches.toArray()
    await openScreen(); openExternal('12000')
    expect(screen.getByRole('button', { name: 'GIỮ NGUỒN' })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    const form = screen.getByRole('button', { name: 'GIỮ NGUỒN' }).closest('form')!
    fireEvent.submit(form); fireEvent.submit(form)
    await screen.findByText('Còn thiếu 8.000 cây.')
    expect(await db.reservations.count()).toBe(1)
    expect((await db.reservations.toArray())[0]).toMatchObject({ quantity: 12000, fulfilledQuantity: 0, status: 'active' })
    expect((await db.events.toArray()).filter(e => e.type === 'reservation_created')).toHaveLength(1)
    expect(await db.batches.toArray()).toEqual(before)
    expect(screen.getByText('Đang giữ 12.000 cây cho đơn này')).toBeInTheDocument()
    expect(screen.getByText('Đã ghi nhận giữ 12.000 cây từ Vườn Thảo.')).toBeInTheDocument()
  })

  it('supplier without phone works and confirmed40k is not capped by the old35k catalog', async () => {
    await db.orders.update('order', { requestedQuantity: 40000 })
    await openScreen()
    expect(screen.queryByRole('link', { name: 'GỌI XÁC NHẬN Vườn không điện thoại' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Giữ nguồn từ Vườn không điện thoại' }))
    fireEvent.change(screen.getByLabelText(/Số cây đã xác nhận giữ/), { target: { value: '40000' } })
    confirm()
    await screen.findByText('Đã giữ đủ')
    expect((await db.reservations.toArray())[0].quantity).toBe(40000)
  })

  it('stale order quantity rejection refreshes facts without losing input or auto-confirming', async () => {
    await openScreen(); openExternal('12000')
    // Represents an intervening writer on another surface, without a local Undo notification.
    await db.orders.update('order', { requestedQuantity: 10000 })
    confirm()
    await screen.findAllByText(/Đơn này chỉ còn thiếu 10.000 cây/)
    expect(await db.reservations.count()).toBe(0)
    expect(screen.getByLabelText(/Số cây đã xác nhận giữ/)).toHaveValue('12000')
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'GIỮ NGUỒN' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Số cây đã xác nhận giữ/), { target: { value: '10000' } })
    confirm()
    await screen.findByText('Đã giữ đủ')
    expect((await db.reservations.toArray())[0].quantity).toBe(10000)
  })

  it('stale variety fails at service, refreshes context and requires a new user acknowledgement', async () => {
    await openScreen(); openExternal('12000')
    await db.orders.update('order', { variety: 'AH1' })
    confirm()
    await screen.findByText(/Nhà vườn, giống hoặc số cây đã thay đổi/)
    await waitFor(() => expect(screen.getAllByText('Giống của đơn: AH1').length).toBeGreaterThan(0))
    expect(await db.reservations.count()).toBe(0)
    expect(screen.getByLabelText(/Số cây đã xác nhận giữ/)).toHaveValue('12000')
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'GIỮ NGUỒN' })).toBeDisabled()
  })

  it('adding supplier without phone makes it immediately usable with blank quantity and no commitment', async () => {
    await openScreen()
    fireEvent.click(screen.getByRole('button', { name: '+ THÊM NHÀ VƯỜN' }))
    fireEvent.change(screen.getByLabelText(/Tên nhà vườn/), { target: { value: 'Vườn mới' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nhà vườn' }))
    await screen.findByRole('button', { name: 'Giữ nguồn từ Vườn mới' })
    expect((await db.contacts.toArray()).find(c => c.name === 'Vườn mới')?.roles).toEqual(['supplier'])
    expect(await db.reservations.count()).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Giữ nguồn từ Vườn mới' }))
    expect(screen.getByLabelText(/Số cây đã xác nhận giữ/)).toHaveValue('')
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('event failure rolls back and preserves the editable form for explicit retry', async () => {
    await openScreen(); openExternal('12000')
    vi.spyOn(db.events, 'put').mockRejectedValueOnce(new Error('Không lưu được lịch sử.'))
    confirm()
    await screen.findByText('Không lưu được lịch sử.')
    expect(await db.reservations.count()).toBe(0)
    expect(screen.getByLabelText(/Số cây đã xác nhận giữ/)).toHaveValue('12000')
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    confirm()
    await screen.findByText('Còn thiếu 8.000 cây.')
    expect(await db.reservations.count()).toBe(1)
  })

  it('recorded supplier amount is outstanding O after partial shipment, never historical Q as stock', async () => {
    const { reservation } = await reserveExternalSupplier({ orderId: 'order', supplierId: 'supplier', quantity: 12000,
      confirmation: { acknowledged: true, supplierId: 'supplier', variety: 'Keo lai BV16', quantity: 12000 } })
    const { shipment } = await createShipment({ orderId: 'order', lines: [{ reservationId: reservation.id, quantity: 5000 }] })
    await confirmShipment({ shipmentId: shipment.id })
    await openScreen()
    expect(screen.getByText('Đang giữ 7.000 cây cho đơn này')).toBeInTheDocument()
    expect(screen.queryByText('Đang giữ 12.000 cây cho đơn này')).not.toBeInTheDocument()
  })
})
