import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ShipmentDetailScreen } from '../shipments/ShipmentDetailScreen'
import { resetDemoData, clearAllData } from '../../data/seed'
import { shipmentRepository, batchRepository, orderRepository } from '../../data/repositories'
import type { Shipment } from '../../domain/shipment'

describe('ShipmentDetailScreen', () => {
  const TEST_SHIPMENT_ID = 'ship_test_detail'

  beforeEach(async () => {
    await clearAllData()
    await resetDemoData()

    const plannedShipment: Shipment = {
      id: TEST_SHIPMENT_ID,
      orderId: 'order_hung_01',
      lines: [
        {
          reservationId: 'res_bv16_hung_own',
          sourceType: 'own_batch',
          batchId: 'batch_bv16_12',
          quantity: 10000
        }
      ],
      plannedQuantity: 10000,
      shippedQuantity: 0,
      plannedDate: '2026-10-12',
      status: 'planned',
      note: 'Xe 5 tấn bốc tại luống 3',
      createdAt: '2026-10-06'
    }
    await shipmentRepository.save(plannedShipment)
  })

  it('renders planned shipment details with physical stock explanation and confirm button', async () => {
    render(
      <MemoryRouter initialEntries={[`/shipments/${TEST_SHIPMENT_ID}`]}>
        <Routes>
          <Route path="/shipments/:id" element={<ShipmentDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Anh Hùng')).toBeInTheDocument()
      expect(screen.getByText(/BV16 #12/)).toBeInTheDocument()
    })

    // Shows quantity and note
    expect(screen.getAllByText('10.000 cây').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Xe 5 tấn bốc tại luống 3/)).toBeInTheDocument()

    // Shows stock invariant warning
    expect(screen.getByText('Tác động tồn kho vật lý')).toBeInTheDocument()

    // Action buttons visible
    expect(screen.getByRole('button', { name: /XÁC NHẬN ĐÃ GIAO/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Hủy chuyến giao này/ })).toBeInTheDocument()
  })

  it('confirms shipment via safety modal and atomically reduces physical stock', async () => {
    render(
      <MemoryRouter initialEntries={[`/shipments/${TEST_SHIPMENT_ID}`]}>
        <Routes>
          <Route path="/shipments/:id" element={<ShipmentDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Anh Hùng')).toBeInTheDocument()
    })

    // Click confirm button
    const confirmBtn = screen.getByRole('button', { name: /XÁC NHẬN ĐÃ GIAO/ })
    fireEvent.click(confirmBtn)

    // Safety modal opens
    expect(screen.getByText('Xác nhận xuất cây lên xe?')).toBeInTheDocument()

    // Click "Xác nhận xuất" inside modal
    const modalConfirmBtn = screen.getByRole('button', { name: 'Xác nhận xuất' })
    fireEvent.click(modalConfirmBtn)

    // Wait for shipment to transition to completed
    await waitFor(() => {
      expect(screen.getByText('Tồn kho vật lý đã được trừ')).toBeInTheDocument()
      expect(screen.getByText('Đã giao xong')).toBeInTheDocument()
    })

    // Verify database mutations
    const shipment = await shipmentRepository.getById(TEST_SHIPMENT_ID)
    expect(shipment?.status).toBe('completed')
    expect(shipment?.shippedQuantity).toBe(10000)

    // PHYSICAL STOCK INVARIANT CHECK:
    const batch = await batchRepository.getById('batch_bv16_12')
    expect(batch?.currentQuantity).toBe(35200) // 45200 - 10000
    expect(batch?.readyQuantity).toBe(22000)   // 32000 - 10000

    // Order status updated to partially_shipped (10k of 30k delivered)
    const order = await orderRepository.getById('order_hung_01')
    expect(order?.status).toBe('partially_shipped')
  })

  it('cancels planned shipment via cancel modal', async () => {
    render(
      <MemoryRouter initialEntries={[`/shipments/${TEST_SHIPMENT_ID}`]}>
        <Routes>
          <Route path="/shipments/:id" element={<ShipmentDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Anh Hùng')).toBeInTheDocument()
    })

    // Click cancel button
    const cancelBtn = screen.getByRole('button', { name: /Hủy chuyến giao này/ })
    fireEvent.click(cancelBtn)

    // Cancel modal opens
    expect(screen.getByText('Hủy chuyến giao dự kiến?')).toBeInTheDocument()

    // Confirm cancel in modal
    const modalCancelBtn = screen.getByRole('button', { name: 'Hủy chuyến' })
    fireEvent.click(modalCancelBtn)

    await waitFor(() => {
      expect(screen.getByText('Đã hủy')).toBeInTheDocument()
    })

    const shipment = await shipmentRepository.getById(TEST_SHIPMENT_ID)
    expect(shipment?.status).toBe('cancelled')

    // Stock untouched
    const batch = await batchRepository.getById('batch_bv16_12')
    expect(batch?.currentQuantity).toBe(45200)
    expect(batch?.readyQuantity).toBe(32000)
  })
})
