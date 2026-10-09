import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { OrderReserveScreen } from '../orders/OrderReserveScreen'
import { resetDemoData, clearAllData } from '../../data/seed'
import { db } from '../../data/db'
import { undoService } from '../../services/undoService'
import { createShipment, confirmShipment } from '../../services/shipmentService'
import { previewCloseOrderRemaining, closeOrderRemaining } from '../../services/orderCompletionService'

describe('OrderReserveScreen (Phase P3)', () => {
  beforeEach(async () => {
    undoService.clearLastMutation()
    await clearAllData()
    await resetDemoData()
  })

  afterEach(() => {
    cleanup()
    undoService.clearLastMutation()
  })

  it('a real closed order blocks the direct reserve route and exposes no supply CTA', async () => {
    const r = (await db.reservations.where('orderId').equals('order_lan_01').first())!
    const s = (await createShipment({ orderId: 'order_lan_01', lines: [{ reservationId: r.id, quantity: 5000 }] })).shipment
    await confirmShipment({ shipmentId: s.id })
    const preview = await previewCloseOrderRemaining({ orderId: 'order_lan_01' })
    expect(preview.success).toBe(true)
    if (!preview.success) return
    await closeOrderRemaining({ orderId: 'order_lan_01', operationId: 'closed-route', expectedFingerprint: preview.fingerprint })
    render(<MemoryRouter initialEntries={['/orders/order_lan_01/reserve']}><Routes>
      <Route path="/orders/:id/reserve" element={<OrderReserveScreen />} />
    </Routes></MemoryRouter>)
    expect(await screen.findByText('Đơn đã dừng phần còn lại')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /GIỮ TỪ LÔ NÀY/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Giữ nguồn từ/i })).not.toBeInTheDocument()
    expect((await db.orders.get('order_lan_01'))?.status).toBe('closed_remaining')
  })

  it('renders order summary, shortage, own batches, and external suppliers for Chị Lan', async () => {
    render(
      <MemoryRouter initialEntries={['/orders/order_lan_01/reserve']}>
        <Routes>
          <Route path="/orders/:id/reserve" element={<OrderReserveScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Chị Lan').length).toBeGreaterThan(0)
    })

    // Variety & requested count
    expect(screen.getAllByText('Keo lai BV16').length).toBeGreaterThan(0)
    expect(screen.getByText('50.000 cây')).toBeInTheDocument()

    // Shortage
    expect(screen.getByText('Thiếu 18.000')).toBeInTheDocument()
    expect(screen.getByText('Còn thiếu 18.000 cây.')).toBeInTheDocument()

    // Own batch candidates: BV16 #12 should be visible with available = 22.000
    expect(screen.getByText('BV16 #12')).toBeInTheDocument()
    expect(screen.getByText('22.000')).toBeInTheDocument()

    // External suppliers: Vườn Thảo, Vườn Hồng, Vườn An should be visible
    expect(screen.getAllByText('Vườn Thảo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Vườn Hồng').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Vườn An').length).toBeGreaterThan(0)
  })

  it('allows reserving from own batch and updates reservation progress', async () => {
    render(
      <MemoryRouter initialEntries={['/orders/order_lan_01/reserve']}>
        <Routes>
          <Route path="/orders/:id/reserve" element={<OrderReserveScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('BV16 #12')).toBeInTheDocument()
    })

    // Find and click "GIỮ TỪ LÔ NÀY"
    const reserveButton = screen.getByRole('button', { name: /GIỮ TỪ LÔ NÀY/i })
    fireEvent.click(reserveButton)

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText('Giữ cây từ BV16 #12')).toBeInTheDocument()
    })

    // Default quantity is min(available: 22k, shortage: 18k) = 18.000
    expect(screen.getByText('= 18.000 cây')).toBeInTheDocument()
    // Click submit button
    const submitButton = screen.getByRole('button', { name: /GIỮ 18.000 CÂY/i })
    fireEvent.click(submitButton)

    // After success, shortage becomes 0, status is "Đã giữ đủ"
    await waitFor(() => {
      expect(screen.getByText('Đã giữ đủ')).toBeInTheDocument()
      expect(screen.getByText(/Đã giữ đủ 50.000 cây/i)).toBeInTheDocument()
    })

    // Verify Dexie DB
    const reservations = await db.reservations.where('orderId').equals('order_lan_01').toArray()
    const activeRes = reservations.filter((r) => r.status === 'active')
    const total = activeRes.reduce((sum, r) => sum + r.quantity, 0)
    expect(total).toBe(50000)
    const batch = await db.batches.get('batch_bv16_12')
    expect(batch?.currentQuantity).toBe(45200)
    expect(batch?.readyQuantity).toBe(32000)
  })

  it('allows reserving from external supplier', async () => {
    render(
      <MemoryRouter initialEntries={['/orders/order_lan_01/reserve']}>
        <Routes>
          <Route path="/orders/:id/reserve" element={<OrderReserveScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Vườn Thảo').length).toBeGreaterThan(0)
    })

    // Click "Giữ nguồn từ Vườn Thảo"
    const thaoButton = screen.getByRole('button', { name: /Giữ nguồn từ Vườn Thảo/i })
    fireEvent.click(thaoButton)

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText('Giữ cây từ Vườn Thảo')).toBeInTheDocument()
    })

    // External quantity is explicit user input and requires acknowledgement.
    expect(screen.getByLabelText(/Số cây đã xác nhận giữ/)).toHaveValue('')
    fireEvent.change(screen.getByLabelText(/Số cây đã xác nhận giữ/), { target: { value: '18000' } })
    expect(screen.getByText('= 18.000 cây')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: /Đã gọi/ }))
    const submitButton = screen.getByRole('button', { name: 'GIỮ NGUỒN' })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Đã giữ đủ')).toBeInTheDocument()
    })
  })

  it('allows releasing an existing reservation with confirmation', async () => {
    // Start with fully reserved order Anh Hùng (30k/30k)
    render(
      <MemoryRouter initialEntries={['/orders/order_hung_01/reserve']}>
        <Routes>
          <Route path="/orders/:id/reserve" element={<OrderReserveScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Đã giữ đủ')).toBeInTheDocument()
    })

    // Find and click "BỎ GIỮ" button on the first reservation
    const releaseButtons = screen.getAllByRole('button', { name: /BỎ GIỮ/i })
    expect(releaseButtons.length).toBeGreaterThan(0)
    fireEvent.click(releaseButtons[0]!)

    // Release confirmation modal opens
    await waitFor(() => {
      expect(screen.getByText('Xác nhận bỏ giữ cây?')).toBeInTheDocument()
    })

    // Click confirmation "Xác nhận bỏ giữ" button
    const confirmButton = screen.getByRole('button', { name: /Xác nhận bỏ giữ/i })
    fireEvent.click(confirmButton)

    // After release, order shortage should reappear
    await waitFor(() => {
      expect(screen.getAllByText(/Thiếu/).length).toBeGreaterThan(0)
    })
  })
})
