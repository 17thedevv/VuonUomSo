import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { db } from '../../data/db'
import { clearAllData } from '../../data/seed'
import { availableQuantityForBatch } from '../../domain/quantity'
import { getReservationOptions, releaseReservation, reserveExternalSupplier, reserveOwnBatch } from '../../services/reservationService'
import { confirmShipment, createShipment } from '../../services/shipmentService'
import { undoService } from '../../services/undoService'
import { ReleaseConfirmModal } from '../orders/ReleaseConfirmModal'
import { ShipmentDetailScreen } from '../shipments/ShipmentDetailScreen'

async function reserve(source: 'own' | 'external') {
  return (source === 'own'
    ? await reserveOwnBatch({ orderId: 'order', batchId: 'batch', quantity: 12000 })
    : await reserveExternalSupplier({ orderId: 'order', supplierId: 'supplier', quantity: 12000,
      confirmation: { acknowledged: true, supplierId: 'supplier', variety: 'BV16', quantity: 12000 } })).reservation
}
async function plan(reservationId: string, quantity = 5000) {
  return (await createShipment({ orderId: 'order', lines: [{ reservationId, quantity }] })).shipment
}
async function openRelease(reservationId: string, onSuccess: (message: string) => void) {
  const options = await getReservationOptions('order')
  render(<ReleaseConfirmModal isOpen reservation={options!.currentReservations.find(r => r.id === reservationId)!}
    onClose={() => {}} onSuccess={onSuccess} />)
}
function openShipment(id: string) {
  render(<MemoryRouter initialEntries={[`/shipments/${id}`]}><Routes>
    <Route path="/shipments/:id" element={<ShipmentDetailScreen />} />
  </Routes></MemoryRouter>)
}

describe('FC4 final acceptance: external release/shipment truthfulness (real Dexie)', () => {
  beforeEach(async () => {
    await clearAllData(); undoService.clearLastMutation()
    await db.contacts.bulkPut([{ id: 'customer', name: 'Khách', roles: ['customer'] },
      { id: 'supplier', name: 'Nhà vườn ngoài', roles: ['supplier'] }])
    await db.orders.put({ id: 'order', customerId: 'customer', variety: 'BV16', requestedQuantity: 50000, status: 'open' })
    await db.batches.put({ id: 'batch', code: 'BV16 #1', variety: 'BV16', initialQuantity: 80000,
      currentQuantity: 80000, readyQuantity: 60000, status: 'ready', createdAt: '2026-10-09' })
  })
  afterEach(() => { cleanup(); undoService.clearLastMutation() })

  for (const source of ['own', 'external'] as const) {
    it(`${source}: preview/event count only unshipped7k; release preserves Q/F/stock/history`, async () => {
      const r = await reserve(source)
      const shipment = await plan(r.id)
      await confirmShipment({ shipmentId: shipment.id })
      const batches = await db.batches.toArray()
      const beforeAvailable = availableQuantityForBatch(batches[0], await db.reservations.toArray())
      let success = ''
      await openRelease(r.id, message => { success = message })
      expect(screen.getByText('7.000 cây', { exact: true })).toBeInTheDocument()
      if (source === 'external') {
        expect(screen.getByText(/Cây trong vườn mình không đổi/)).toBeInTheDocument()
        expect(screen.queryByText(/Cây còn bán/)).not.toBeInTheDocument()
      }
      fireEvent.click(screen.getByRole('button', { name: 'Xác nhận bỏ giữ' }))
      await waitFor(() => expect(success).toBe('Đã bỏ giữ nguồn. Dữ liệu đơn được tải lại.'))
      expect(await db.reservations.get(r.id)).toMatchObject({ quantity: 12000, fulfilledQuantity: 5000, status: 'released' })
      expect(await db.batches.toArray()).toEqual(batches)
      expect((await db.shipments.get(shipment.id))?.status).toBe('completed')
      const events = await db.events.where('type').equals('reservation_released').toArray()
      expect(events).toHaveLength(source === 'own' ? 2 : 1)
      for (const event of events) {
        expect(event.payload).toMatchObject({ quantity: 12000, releasedQuantity: 7000, fulfilledQuantity: 5000 })
        expect(event).toMatchObject({ payload: { message: expect.stringMatching(/Đã bỏ giữ 7.000 cây/) } })
      }
      expect(availableQuantityForBatch(batches[0], await db.reservations.toArray())).toBe(beforeAvailable + (source === 'own' ? 7000 : 0))
      await releaseReservation({ reservationId: r.id })
      expect(await db.events.where('type').equals('reservation_released').count()).toBe(events.length)
    })
  }

  it('intervening shipment while release modal is open cannot produce stale success quantity or release history', async () => {
    const r = await reserve('external')
    let success = ''
    await openRelease(r.id, message => { success = message })
    const shipment = await plan(r.id)
    await confirmShipment({ shipmentId: shipment.id })
    const batches = await db.batches.toArray()
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận bỏ giữ' }))
    await waitFor(() => expect(success).toBe('Đã bỏ giữ nguồn. Dữ liệu đơn được tải lại.'))
    const event = (await db.events.where('type').equals('reservation_released').toArray())[0]
    expect(event.payload).toMatchObject({ releasedQuantity: 7000, fulfilledQuantity: 5000 })
    expect(event).toMatchObject({ payload: { message: expect.stringMatching(/7.000/) } })
    expect(await db.batches.toArray()).toEqual(batches)
  })

  it('external-only confirmation/completion explicitly leaves own stock unchanged', async () => {
    const r = await reserve('external'); const shipment = await plan(r.id)
    const batches = await db.batches.toArray()
    openShipment(shipment.id)
    await screen.findByText('Nguồn ngoài không trừ cây trong vườn mình.')
    fireEvent.click(screen.getByRole('button', { name: /XÁC NHẬN ĐÃ GIAO/ }))
    expect(screen.getAllByText('Nguồn ngoài không trừ cây trong vườn mình.')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xuất' }))
    await screen.findByText('Đã ghi nhận giao nguồn ngoài')
    expect(screen.queryByText('Tồn kho vật lý đã được trừ')).not.toBeInTheDocument()
    expect(await db.batches.toArray()).toEqual(batches)
    expect((await db.reservations.get(r.id))?.fulfilledQuantity).toBe(5000)
  })

  it('mixed confirmation describes own3k stock effect separately from total8k delivery', async () => {
    const external = await reserve('external'); const own = await reserve('own')
    const shipment = (await createShipment({ orderId: 'order', lines: [
      { reservationId: own.id, quantity: 3000 }, { reservationId: external.id, quantity: 5000 }
    ] })).shipment
    const before = (await db.batches.get('batch'))!
    openShipment(shipment.id)
    await screen.findByText('Các lô trong vườn sẽ giảm 3.000 cây khi xác nhận đã giao.')
    fireEvent.click(screen.getByRole('button', { name: /XÁC NHẬN ĐÃ GIAO/ }))
    expect(screen.getAllByText('Các lô trong vườn sẽ giảm 3.000 cây khi xác nhận đã giao.')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xuất' }))
    await screen.findByText('Các lô trong vườn đã giảm 3.000 cây.')
    expect(await db.batches.get('batch')).toEqual({ ...before, currentQuantity: before.currentQuantity - 3000, readyQuantity: before.readyQuantity - 3000 })
    expect((await db.reservations.get(external.id))?.fulfilledQuantity).toBe(5000)
    expect((await db.reservations.get(own.id))?.fulfilledQuantity).toBe(3000)
  })

  it('legacy completed shipment without source lines does not infer external supply or a stock reduction', async () => {
    await db.shipments.put({ id: 'legacy', orderId: 'order', plannedQuantity: 5000, shippedQuantity: 5000,
      status: 'completed', shippedAt: '2026-09-01' })
    const batches = await db.batches.toArray()
    openShipment('legacy')
    await screen.findByText('Chưa có chi tiết nguồn để xác định tác động tồn kho.')
    expect(screen.getByText('Đã ghi nhận chuyến giao')).toBeInTheDocument()
    expect(screen.queryByText('Đã ghi nhận giao nguồn ngoài')).not.toBeInTheDocument()
    expect(screen.queryByText('Tồn kho vật lý đã được trừ')).not.toBeInTheDocument()
    expect(await db.batches.toArray()).toEqual(batches)
  })
})
