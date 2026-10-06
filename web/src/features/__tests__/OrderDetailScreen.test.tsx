import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { OrderDetailScreen } from '../orders/OrderDetailScreen'
import { resetDemoData, clearAllData } from '../../data/seed'

describe('OrderDetailScreen', () => {
  beforeEach(async () => {
    await clearAllData()
    await resetDemoData()
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

    // 2 sources: BV16 #12 (Bạch đàn BV16) and Vườn Thảo
    expect(screen.getByText('BV16 #12 (Bạch đàn BV16)')).toBeInTheDocument()
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

  it('renders empty state when order ID is not found', async () => {
    render(
      <MemoryRouter initialEntries={['/orders/non_existent_id']}>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Không tìm thấy đơn hàng này')).toBeInTheDocument()
    })
  })
})
