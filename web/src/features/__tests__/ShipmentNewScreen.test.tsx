import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ShipmentNewScreen } from '../shipments/ShipmentNewScreen'
import { resetDemoData, clearAllData } from '../../data/seed'
import { shipmentRepository, batchRepository } from '../../data/repositories'
import type { Shipment } from '../../domain/shipment'

describe('ShipmentNewScreen', () => {
  beforeEach(async () => {
    await clearAllData()
    await resetDemoData()
  })

  it('renders order summary and candidate sources for an order', async () => {
    render(
      <MemoryRouter initialEntries={['/shipments/new?orderId=order_hung_01']}>
        <Routes>
          <Route path="/shipments/new" element={<ShipmentNewScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Anh Hùng')).toBeInTheDocument()
      expect(screen.getByText('Keo lai BV16')).toBeInTheDocument()
    })

    // Shows candidate supply sources
    expect(screen.getByText(/BV16 #12/)).toBeInTheDocument()
    expect(screen.getByText(/Vườn Thảo/)).toBeInTheDocument()
  })

  it('creates a planned shipment and leaves physical stock untouched', async () => {
    render(
      <MemoryRouter initialEntries={['/shipments/new?orderId=order_hung_01']}>
        <Routes>
          <Route path="/shipments/new" element={<ShipmentNewScreen />} />
          <Route path="/shipments/:id" element={<div>Màn hình chi tiết chuyến</div>} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Anh Hùng')).toBeInTheDocument()
    })

    // Click "Lấy hết" for the own batch source (10.000)
    const fill10kBtn = screen.getByRole('button', { name: /Lấy hết \(10\.000\)/ })
    fireEvent.click(fill10kBtn)

    // Verify live total updated
    expect(screen.getAllByText(/10\.000 cây/).length).toBeGreaterThanOrEqual(1)

    // Submit form
    const submitButton = screen.getByRole('button', { name: /Tạo chuyến giao dự kiến/ })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Màn hình chi tiết chuyến')).toBeInTheDocument()
    })

    // Verify shipment was created in db
    const shipments = await shipmentRepository.getByOrderId('order_hung_01')
    expect(shipments.length).toBe(1)
    expect(shipments[0].status).toBe('planned')
    expect(shipments[0].plannedQuantity).toBe(10000)
    expect(shipments[0].shippedQuantity).toBe(0)

    // INVARIANT: Physical stock must NOT be altered upon planning
    const batch = await batchRepository.getById('batch_bv16_12')
    expect(batch?.currentQuantity).toBe(45200)
    expect(batch?.readyQuantity).toBe(32000)
  })

  it('shows one-open-planned-shipment guard when an open planned shipment exists', async () => {
    const existingPlanned: Shipment = {
      id: 'ship_existing',
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
      plannedDate: '2026-10-10',
      status: 'planned',
      createdAt: '2026-10-06'
    }
    await shipmentRepository.save(existingPlanned)

    render(
      <MemoryRouter initialEntries={['/shipments/new?orderId=order_hung_01']}>
        <Routes>
          <Route path="/shipments/new" element={<ShipmentNewScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Đơn hàng đã có chuyến giao dự kiến')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Xem chuyến giao dự kiến hiện tại' })
      ).toBeInTheDocument()
    })
  })
})
