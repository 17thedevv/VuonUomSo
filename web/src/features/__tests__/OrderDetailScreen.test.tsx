import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { OrderDetailScreen } from '../orders/OrderDetailScreen'
import { resetDemoData, clearAllData } from '../../data/seed'
import { undoService } from '../../services/undoService'
import { db } from '../../data/db'
import { createShipment, confirmShipment } from '../../services/shipmentService'
import { previewCloseOrderRemaining, closeOrderRemaining } from '../../services/orderCompletionService'

describe('OrderDetailScreen', () => {
  beforeEach(async () => {
    undoService.clearLastMutation()
    await clearAllData()
    await resetDemoData()
  })

  it('a real closed order keeps detail/history accessible and removes reserve/edit/cancel/shipment eligibility', async () => {
    const r = (await db.reservations.where('orderId').equals('order_lan_01').first())!
    const s = (await createShipment({ orderId: 'order_lan_01', lines: [{ reservationId: r.id, quantity: 5000 }] })).shipment
    await confirmShipment({ shipmentId: s.id })
    const preview = await previewCloseOrderRemaining({ orderId: 'order_lan_01' })
    expect(preview.success).toBe(true)
    if (!preview.success) return
    await closeOrderRemaining({ orderId: 'order_lan_01', operationId: 'closed-detail', expectedFingerprint: preview.fingerprint })
    render(<MemoryRouter initialEntries={['/orders/order_lan_01']}><Routes>
      <Route path="/orders/:id" element={<OrderDetailScreen />} />
    </Routes></MemoryRouter>)
    expect(await screen.findByText(/Đã xuất 5.000 \/ 50.000 · Đã dừng 45.000/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /SỬA ĐƠN|HỦY ĐƠN|GIỮ THÊM|GIỮ CÂY|LÊN CHUYẾN/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Nguồn chưa xuất đã được nhả/)).toBeInTheDocument()
    expect(screen.queryByText(/Đã chuẩn bị đủ toàn bộ/)).not.toBeInTheDocument()
  })

  it('renders order detail for fully reserved multi-source order (Anh Hùng)', async () => {
    render(
      <MemoryRouter initialEntries={['/orders/order_hung_01']}>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Anh Hùng').length).toBeGreaterThan(0)
      expect(screen.getByText('0912 345 678')).toBeInTheDocument()
    })

    // Requested: 30.000 cây
    expect(screen.getByText('30.000 cây')).toBeInTheDocument()

    // Status: Đã giữ đủ
    expect(screen.getByText('Đã giữ đủ')).toBeInTheDocument()

    // 2 sources: BV16 #12 (Keo lai BV16) and Vườn Thảo
    expect(screen.getByText('BV16 #12 (Keo lai BV16)')).toBeInTheDocument()
    expect(screen.getByText('Vườn Thảo')).toBeInTheDocument()

    // Quantities per source: 10.000 and 20.000
    expect(screen.getByText('10.000')).toBeInTheDocument()
    expect(screen.getByText('20.000')).toBeInTheDocument()
  })

  it('renders order detail for partially reserved order (Chị Lan) with shortage alert', async () => {
    render(
      <MemoryRouter initialEntries={['/orders/order_lan_01']}>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Chị Lan').length).toBeGreaterThan(0)
    })

    // Shortage notice: 18.000 cây
    expect(screen.getByText('18.000 cây')).toBeInTheDocument()
    expect(screen.getAllByText(/Còn thiếu/).length).toBeGreaterThan(0)
  })

  it('allows releasing a reservation directly from order detail', async () => {
    render(
      <MemoryRouter initialEntries={['/orders/order_hung_01']}>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Đã giữ đủ')).toBeInTheDocument()
    })

    // Click BỎ GIỮ on the first reservation
    const releaseButtons = screen.getAllByRole('button', { name: /BỎ GIỮ/i })
    expect(releaseButtons.length).toBeGreaterThan(0)
    fireEvent.click(releaseButtons[0]!)

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText('Xác nhận bỏ giữ cây?')).toBeInTheDocument()
    })

    // Confirm
    const confirmButton = screen.getByRole('button', { name: /Xác nhận bỏ giữ/i })
    fireEvent.click(confirmButton)

    // After release, shortage alert should appear
    await waitFor(() => {
      expect(screen.getAllByText(/Còn thiếu/).length).toBeGreaterThan(0)
    })
  })

  it('displays "Trong chuyến chờ giao" instead of BỎ GIỮ button when reservation is in planned shipment', async () => {
    // Add a planned shipment for order_hung_01 referencing the own batch reservation
    await db.shipments.add({
      id: 'ship_test_planned',
      orderId: 'order_hung_01',
      status: 'planned',
      plannedQuantity: 10000,
      shippedQuantity: 0,
      plannedDate: '2026-10-15',
      lines: [
        {
          reservationId: 'res_bv16_hung_own',
          sourceType: 'own_batch',
          batchId: 'batch_bv16_12',
          quantity: 10000
        }
      ],
      createdAt: '2026-10-06'
    })

    render(
      <MemoryRouter initialEntries={['/orders/order_hung_01']}>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Trong chuyến chờ giao')).toBeInTheDocument()
    })

    // The other reservation (external supplier) is not in planned shipment, so it still has BỎ GIỮ
    const releaseButtons = screen.getAllByRole('button', { name: /BỎ GIỮ/i })
    expect(releaseButtons.length).toBe(1)
  })
})

