import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { db } from '../../data/db'
import { clearAllData } from '../../data/seed'
import { OrderDetailScreen } from '../orders/OrderDetailScreen'
import { BatchDetailScreen } from '../batches/BatchDetailScreen'
import * as orderReconciliation from '../../services/reconciliationService'
import * as batchReconciliation from '../../services/batchReconciliationService'
import { reserveOwnBatch, reserveExternalSupplier } from '../../services/reservationService'
import { createShipment, confirmShipment } from '../../services/shipmentService'
import { updateOrder } from '../../services/orderService'
import { undoService } from '../../services/undoService'

let own: string
let other: string
let external: string
async function stock() { return db.batches.toArray() }
function show(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/orders/:id" element={<OrderDetailScreen />} /><Route path="/batches/:id" element={<BatchDetailScreen />} />
    <Route path="/shipments/:id" element={<p>Chi tiết chuyến đúng</p>} />
  </Routes></MemoryRouter>)
}
async function openOrder() {
  show('/orders/Lan'); fireEvent.click(await screen.findByRole('button', { name: 'SỬA ĐƠN' }))
  fireEvent.change(screen.getByLabelText(/Số lượng đặt/), { target: { value: '25000' } })
  fireEvent.click(screen.getByRole('button', { name: 'ĐIỀU CHỈNH NGUỒN GIỮ' }))
  await screen.findByRole('checkbox', { name: 'A' })
}
async function orderInputs(n = '15000', m = '10000') {
  fireEvent.click(screen.getByRole('checkbox', { name: 'A' }))
  fireEvent.change(screen.getByLabelText('Còn giữ sau điều chỉnh · A'), { target: { value: n } })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Vườn ngoài' }))
  fireEvent.change(screen.getByLabelText('Còn giữ sau điều chỉnh · Vườn ngoài'), { target: { value: m } })
}
async function openBatch(n = '9000') {
  await db.reservations.update(own, { quantity: 10000 }); await db.batches.update('A', { readyQuantity: 15000 })
  show('/batches/A'); fireEvent.click(await screen.findByRole('button', { name: 'ĐIỀU CHỈNH NGUỒN GIỮ' }))
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Lan · A' }))
  fireEvent.change(screen.getByLabelText('Còn giữ sau điều chỉnh · Lan'), { target: { value: n } })
}
async function preview() { fireEvent.click(screen.getByRole('button', { name: 'XEM TRƯỚC ĐIỀU CHỈNH' })); await screen.findByRole('button', { name: 'XÁC NHẬN ĐIỀU CHỈNH' }) }
function confirm() { fireEvent.click(screen.getByRole('button', { name: 'XÁC NHẬN ĐIỀU CHỈNH' })) }

describe('FC3-3 UI intent → real Dexie services → reloaded screens', () => {
  beforeEach(async () => {
    undoService.clearLastMutation(); await clearAllData()
    await db.contacts.bulkPut([{ id: 'c1', name: 'Lan', roles: ['customer'] }, { id: 'c2', name: 'Hùng', roles: ['customer'] },
      { id: 'supplier', name: 'Vườn ngoài', roles: ['supplier'] }])
    await db.batches.bulkPut(['A', 'B'].map(id => ({ id, code: id, variety: 'BV16', initialQuantity: 100000,
      currentQuantity: 80000, readyQuantity: 60000, status: 'ready', createdAt: '2026-10-08' })))
    await db.orders.bulkPut([{ id: 'Lan', customerId: 'c1', variety: 'BV16', requestedQuantity: 50000, status: 'open', note: 'old' },
      { id: 'Hung', customerId: 'c2', variety: 'BV16', requestedQuantity: 30000, status: 'open' }])
    own = (await reserveOwnBatch({ orderId: 'Lan', batchId: 'A', quantity: 20000 })).reservation.id
    external = (await reserveExternalSupplier({ orderId: 'Lan', supplierId: 'supplier', quantity: 12000 })).reservation.id
    other = (await reserveOwnBatch({ orderId: 'Hung', batchId: 'A', quantity: 8000 })).reservation.id
    undoService.clearLastMutation()
  })
  afterEach(() => { vi.restoreAllMocks(); undoService.clearLastMutation() })
  it.each(['15000', '12000'])('order absolute inputs commit coverage %s+10k, history and unchanged stock', async n => {
    const before = await stock(); await openOrder(); await orderInputs(n)
    await preview()
    expect(screen.getByText(/Thiếu nguồn sau điều chỉnh/)).toHaveTextContent(n === '15000' ? '0 cây' : '3.000 cây')
    confirm(); await screen.findByRole('dialog', { name: 'Sửa đơn' })
    expect(await db.orders.get('Lan')).toMatchObject({ requestedQuantity: 25000, note: 'old' })
    expect(await db.reservations.get(own)).toMatchObject({ quantity: Number(n) })
    expect(await db.reservations.get(external)).toMatchObject({ quantity: 10000 })
    expect(await stock()).toEqual(before)
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(await screen.findByText(/Đã giảm đơn: 50.000 → 25.000 cây/)).toBeInTheDocument()
  })
  it('metadata draft is retained on back and after success, saved only with a separate confirmation', async () => {
    show('/orders/Lan'); fireEvent.click(await screen.findByRole('button', { name: 'SỬA ĐƠN' }))
    fireEvent.change(screen.getByLabelText('Ghi chú'), { target: { value: 'Giao buổi sáng' } })
    fireEvent.change(screen.getByLabelText(/Ngày hẹn lấy/), { target: { value: '2026-11-01' } })
    fireEvent.change(screen.getByLabelText(/Giá mỗi cây/), { target: { value: '1500' } })
    fireEvent.change(screen.getByLabelText(/Số lượng đặt/), { target: { value: '25000' } })
    fireEvent.click(screen.getByRole('button', { name: 'ĐIỀU CHỈNH NGUỒN GIỮ' }))
    expect(screen.getByText(/chưa được lưu/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'QUAY LẠI SỬA ĐƠN' }))
    expect(screen.getByLabelText('Ghi chú')).toHaveValue('Giao buổi sáng')
    fireEvent.click(screen.getByRole('button', { name: 'ĐIỀU CHỈNH NGUỒN GIỮ' })); await screen.findByRole('checkbox', { name: 'A' })
    await orderInputs(); await preview(); confirm(); await screen.findByRole('dialog', { name: 'Sửa đơn' })
    expect(await db.orders.get('Lan')).toMatchObject({ note: 'old', requestedQuantity: 25000 })
    expect(screen.getByLabelText('Ghi chú')).toHaveValue('Giao buổi sáng')
    expect(screen.getByLabelText(/Ngày hẹn lấy/)).toHaveValue('2026-11-01')
    expect(screen.getByLabelText(/Giá mỗi cây/)).toHaveValue(1500)
    fireEvent.click(screen.getByRole('button', { name: 'CẬP NHẬT ĐƠN' }))
    await waitFor(async () => expect(await db.orders.get('Lan')).toMatchObject({ note: 'Giao buổi sáng', requestedDate: '2026-11-01', unitPrice: 1500 }))
  })
  it('zero absolute outstanding fully releases the chosen source without erasing history or physical stock', async () => {
    const before = await stock(); await openOrder(); await orderInputs('0'); await preview()
    expect(screen.getByText(/Thiếu nguồn sau điều chỉnh/)).toHaveTextContent('15.000 cây')
    confirm(); await screen.findByRole('dialog', { name: 'Sửa đơn' })
    expect(await db.reservations.get(own)).toMatchObject({ quantity: 20000, fulfilledQuantity: 0, status: 'released' })
    expect(await db.orders.get('Lan')).toMatchObject({ requestedQuantity: 25000 })
    expect(await stock()).toEqual(before)
    expect(await db.events.where('type').equals('order_reconciled').count()).toBe(1)
  })
  it('invalid absolute input removes preview and cannot submit; cây-vạn uses same parser', async () => {
    await openOrder(); await orderInputs(); await preview()
    fireEvent.change(screen.getByLabelText('Còn giữ sau điều chỉnh · A'), { target: { value: 'abc' } })
    expect(screen.queryByText('Xem trước điều chỉnh')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'XEM TRƯỚC ĐIỀU CHỈNH' })).toBeDisabled()
    const card = screen.getByLabelText('Còn giữ sau điều chỉnh · A').closest('div.space-y-2')!
    fireEvent.change(within(card as HTMLElement).getByRole('combobox'), { target: { value: 'van' } })
    fireEvent.change(screen.getByLabelText('Còn giữ sau điều chỉnh · A'), { target: { value: '1,5' } })
    expect(screen.getByText('= 15.000 cây')).toBeInTheDocument(); await preview()
  })
  it.each(['order', 'batch'])('%s stale confirmation keeps input, refreshes preview, requires another click', async mode => {
    if (mode === 'order') { await openOrder(); await orderInputs() } else await openBatch()
    await preview()
    await act(async () => { await updateOrder({ orderId: 'Lan', note: 'intervening' }) })
    confirm(); await screen.findByText(/Hãy xem lại số mới trước khi xác nhận/)
    expect(await db.events.where('type').anyOf(['order_reconciled', 'batch_reconciled']).count()).toBe(0)
    await waitFor(() => expect(screen.getByRole('button', { name: 'XÁC NHẬN ĐIỀU CHỈNH' })).toBeEnabled())
    confirm()
    if (mode === 'order') await screen.findByRole('dialog', { name: 'Sửa đơn' }); else await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect((await db.orders.get('Lan'))!.note).toBe('intervening')
  })
  it.each(['order', 'batch'])('%s STORAGE_ERROR preserves exact retry identity and draft', async mode => {
    const spy = mode === 'order' ? vi.spyOn(orderReconciliation, 'reconcileOrderReduction') : vi.spyOn(batchReconciliation, 'reconcileBatchShortage')
    spy.mockResolvedValueOnce({ success: false, code: 'STORAGE_ERROR', error: 'Chưa lưu được' })
    if (mode === 'order') { await openOrder(); await orderInputs() } else await openBatch()
    await preview(); confirm(); fireEvent.click(await screen.findByRole('button', { name: 'THỬ LẠI ĐIỀU CHỈNH' }))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    expect(spy.mock.calls[1][0]).toEqual(spy.mock.calls[0][0])
  })
  it.each(['order', 'batch'])('%s double submit uses only one UI operation', async mode => {
    let finish!: () => void; const waiting = new Promise<void>(resolve => { finish = resolve })
    const originalOrder = orderReconciliation.reconcileOrderReduction
    const originalBatch = batchReconciliation.reconcileBatchShortage
    const spy = mode === 'order' ? vi.spyOn(orderReconciliation, 'reconcileOrderReduction').mockImplementationOnce(async input => { await waiting; return originalOrder(input) }) :
      vi.spyOn(batchReconciliation, 'reconcileBatchShortage').mockImplementationOnce(async input => { await waiting; return originalBatch(input) })
    if (mode === 'order') { await openOrder(); await orderInputs() } else await openBatch()
    await preview(); const button = screen.getByRole('button', { name: 'XÁC NHẬN ĐIỀU CHỈNH' })
    fireEvent.click(button); fireEvent.click(button); expect(spy).toHaveBeenCalledTimes(1)
    await act(async () => { finish(); await waiting })
  })
  it.each(['order', 'batch'])('%s changed plan after storage failure discards old confirmation identity', async mode => {
    const spy = mode === 'order' ? vi.spyOn(orderReconciliation, 'reconcileOrderReduction') : vi.spyOn(batchReconciliation, 'reconcileBatchShortage')
    spy.mockResolvedValueOnce({ success: false, code: 'STORAGE_ERROR', error: 'Chưa lưu được' })
    if (mode === 'order') { await openOrder(); await orderInputs() } else await openBatch()
    await preview(); confirm(); await screen.findByRole('button', { name: 'THỬ LẠI ĐIỀU CHỈNH' })
    fireEvent.change(screen.getByLabelText(mode === 'order' ? 'Còn giữ sau điều chỉnh · A' : 'Còn giữ sau điều chỉnh · Lan'), { target: { value: mode === 'order' ? '12000' : '7000' } })
    expect(screen.queryByRole('button', { name: 'THỬ LẠI ĐIỀU CHỈNH' })).not.toBeInTheDocument()
    await preview(); confirm(); await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    expect(spy.mock.calls[1][0].operationId).not.toBe(spy.mock.calls[0][0].operationId)
    expect(spy.mock.calls[1][0].expectedFingerprint).not.toBe(spy.mock.calls[0][0].expectedFingerprint)
  })
  it.each(['order', 'batch'])('%s new planned allocation after preview exposes fresh conflict instead of stale confirm', async mode => {
    if (mode === 'order') { await openOrder(); await orderInputs('5000') } else await openBatch('5000')
    await preview()
    const { shipment } = await createShipment({ orderId: 'Lan', lines: [{ reservationId: own, quantity: 10000 }] })
    confirm(); const link = await screen.findByRole('link', { name: 'XEM CHUYẾN CHỜ XUẤT' })
    expect(link).toHaveAttribute('href', `/shipments/${shipment.id}`)
    expect(screen.getByRole('alert')).toHaveTextContent('10.000 cây')
    expect(screen.queryByRole('button', { name: 'XÁC NHẬN ĐIỀU CHỈNH' })).not.toBeInTheDocument()
    expect(await db.events.where('type').anyOf(['order_reconciled', 'batch_reconciled']).count()).toBe(0)
  })
  it('target picker excludes source, wrong variety and batches without current availability', async () => {
    const base = (await db.batches.get('B'))!
    await db.batches.bulkPut([{ ...base, id: 'C', code: 'C', variety: 'BV32' }, { ...base, id: 'D', code: 'D', readyQuantity: 0 }])
    await openBatch('7000'); fireEvent.click(screen.getByRole('checkbox', { name: 'CHUYỂN SANG LÔ KHÁC' }))
    const options = within(screen.getByLabelText('Lô đích · Lan')).getAllByRole('option')
    expect(options.map(option => (option as HTMLOptionElement).value)).toEqual(['', 'B'])
  })
  it('each batch commitment identifies its own order when one customer has multiple orders', async () => {
    await db.orders.put({ id: 'Lan-second', customerId: 'c1', variety: 'BV16', requestedQuantity: 12000, requestedDate: '2026-11-01', status: 'open' })
    await reserveOwnBatch({ orderId: 'Lan-second', batchId: 'A', quantity: 2000 })
    await db.batches.update('A', { readyQuantity: 15000 }); show('/batches/A')
    fireEvent.click(await screen.findByRole('button', { name: 'ĐIỀU CHỈNH NGUỒN GIỮ' }))
    await screen.findByRole('link', { name: /XEM ĐƠN · 12.000 cây/ })
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByRole('link', { name: 'XEM ĐƠN · 50.000 cây' })).toHaveAttribute('href', '/orders/Lan')
    expect(dialog.getByRole('link', { name: /XEM ĐƠN · 12.000 cây/ })).toHaveAttribute('href', '/orders/Lan-second')
  })
  it.each(['order', 'batch'])('%s operation conflict requires fresh preview and new identity', async mode => {
    const spy = mode === 'order' ? vi.spyOn(orderReconciliation, 'reconcileOrderReduction') : vi.spyOn(batchReconciliation, 'reconcileBatchShortage')
    spy.mockResolvedValueOnce({ success: false, code: 'OPERATION_ID_CONFLICT', error: 'Conflict' })
    if (mode === 'order') { await openOrder(); await orderInputs() } else await openBatch()
    await preview(); confirm(); await screen.findByText(/Thao tác này đã thay đổi/)
    expect(screen.queryByRole('button', { name: 'XÁC NHẬN ĐIỀU CHỈNH' })).not.toBeInTheDocument()
    await preview(); confirm(); await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    expect(spy.mock.calls[1][0].operationId).not.toBe(spy.mock.calls[0][0].operationId)
  })
  it.each(['9000', '7000'])('batch partial/exact UI persists selected only and correct remaining-shortage notice (%s)', async n => {
    await openBatch(n); const before = await stock(); await preview()
    expect(screen.getByText(n === '9000' ? /Sau điều chỉnh lô vẫn còn thiếu 2.000/ : /Sau điều chỉnh lô không còn thiếu/)).toBeInTheDocument()
    confirm(); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent(n === '9000' ? 'Lô còn thiếu 2.000 cây đã giữ' : 'Lô không còn thiếu cây đã giữ')
    expect(await db.reservations.get(other)).toMatchObject({ quantity: 8000 }); expect(await stock()).toEqual(before)
    expect(await screen.findByText(/Đã điều chỉnh nguồn giữ trên lô/)).toBeInTheDocument()
  })
  it('batch transfer picker/current capacity → new target, source/order/target history visible', async () => {
    await openBatch('5000'); const before = await stock()
    fireEvent.click(screen.getByRole('checkbox', { name: 'CHUYỂN SANG LÔ KHÁC' }))
    fireEvent.change(screen.getByLabelText('Lô đích · Lan'), { target: { value: 'B' } })
    fireEvent.change(screen.getByLabelText('Số cây chuyển · Lan'), { target: { value: '3000' } })
    await preview(); expect(screen.getByText(/Nhả khỏi cam kết/)).toHaveTextContent('2.000 cây')
    confirm(); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await db.reservations.where('batchId').equals('B').count()).toBe(1); expect(await stock()).toEqual(before)
    expect(screen.getByRole('status')).toHaveTextContent('Đã chuyển 3.000 cây: A → B.')
  })
  it.each(['order', 'batch'])('%s planned conflict shows exact quantity and route link without mutation', async mode => {
    const { shipment } = await createShipment({ orderId: 'Lan', lines: [{ reservationId: own, quantity: 10000 }] })
    if (mode === 'order') { await openOrder(); await orderInputs('5000', '10000') } else await openBatch('5000')
    const before = await db.shipments.toArray()
    fireEvent.click(screen.getByRole('button', { name: 'XEM TRƯỚC ĐIỀU CHỈNH' }))
    const link = await screen.findByRole('link', { name: 'XEM CHUYẾN CHỜ XUẤT' })
    expect(link).toHaveAttribute('href', `/shipments/${shipment.id}`)
    expect(screen.getByRole('alert')).toHaveTextContent('10.000 cây')
    expect(screen.queryByRole('button', { name: 'XÁC NHẬN ĐIỀU CHỈNH' })).not.toBeInTheDocument()
    expect(await db.shipments.toArray()).toEqual(before); fireEvent.click(link); await screen.findByText('Chi tiết chuyến đúng')
  })
  it('target capacity error names action; facts refresh and input remains selected', async () => {
    await db.batches.update('B', { readyQuantity: 2000 }); await openBatch('7000')
    fireEvent.click(screen.getByRole('checkbox', { name: 'CHUYỂN SANG LÔ KHÁC' })); fireEvent.change(screen.getByLabelText('Lô đích · Lan'), { target: { value: 'B' } })
    fireEvent.change(screen.getByLabelText('Số cây chuyển · Lan'), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: 'XEM TRƯỚC ĐIỀU CHỈNH' }))
    await screen.findByText(/Lô đích không còn đủ cây/); expect(screen.getByLabelText('Số cây chuyển · Lan')).toHaveValue('3000')
  })
  it('batch CTA absent when no shortage; partially shipped active row remains usable with F preserved', async () => {
    const view = show('/batches/A'); await screen.findByText('Cây còn bán')
    expect(screen.queryByRole('button', { name: 'ĐIỀU CHỈNH NGUỒN GIỮ' })).not.toBeInTheDocument(); view.unmount()
    const { shipment } = await createShipment({ orderId: 'Lan', lines: [{ reservationId: own, quantity: 10000 }] })
    await confirmShipment({ shipmentId: shipment.id }); await db.batches.update('A', { readyQuantity: 15000 })
    show('/batches/A'); fireEvent.click(await screen.findByRole('button', { name: 'ĐIỀU CHỈNH NGUỒN GIỮ' }))
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Lan · A' })); expect(within(screen.getByRole('dialog')).getByText(/Đã xuất 10.000 cây/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Còn giữ sau điều chỉnh · Lan'), { target: { value: '7000' } }); await preview(); confirm()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await db.orders.get('Lan')).toMatchObject({ requestedQuantity: 50000, status: 'partially_shipped' })
    expect(await db.reservations.get(own)).toMatchObject({ quantity: 17000, fulfilledQuantity: 10000 })
    expect(await db.shipments.get(shipment.id)).toMatchObject({ status: 'completed', shippedQuantity: 10000 })
  })
})
