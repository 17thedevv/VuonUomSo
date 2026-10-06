import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { OrdersScreen } from '../orders/OrdersScreen'
import { resetDemoData, clearAllData } from '../../data/seed'

describe('OrdersScreen', () => {
  beforeEach(async () => {
    await clearAllData()
    await resetDemoData()
  })

  it('renders orders list from seed data with correct customer names and statuses', async () => {
    render(
      <MemoryRouter initialEntries={['/orders']}>
        <OrdersScreen />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Anh Hùng')).toBeInTheDocument()
      expect(screen.getByText('Chị Lan')).toBeInTheDocument()
      expect(screen.getByText('Anh Nam')).toBeInTheDocument()
    })

    // Anh Hùng: Đã giữ đủ
    expect(screen.getByText('Đã giữ đủ')).toBeInTheDocument()

    // Chị Lan: Còn thiếu 18.000 cây
    expect(screen.getByText('Còn thiếu 18.000 cây')).toBeInTheDocument()

    // Anh Nam: Đã giao (appears in filter tab and badge)
    expect(screen.getAllByText('Đã giao').length).toBeGreaterThanOrEqual(2)
  })

  it('filters orders when clicking filter tabs', async () => {
    render(
      <MemoryRouter initialEntries={['/orders']}>
        <OrdersScreen />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Anh Hùng')).toBeInTheDocument()
    })

    // Click "Cần xử lý"
    const actionTab = screen.getByText('Cần xử lý')
    fireEvent.click(actionTab)

    expect(screen.getByText('Chị Lan')).toBeInTheDocument()
    expect(screen.queryByText('Anh Hùng')).not.toBeInTheDocument()
    expect(screen.queryByText('Anh Nam')).not.toBeInTheDocument()

    // Click "Đã giao" tab
    const shippedTabs = screen.getAllByText('Đã giao')
    // Filter tab is the button
    const shippedButton = shippedTabs.find((el) => el.tagName.toLowerCase() === 'button')
    expect(shippedButton).toBeDefined()
    fireEvent.click(shippedButton!)

    expect(screen.getByText('Anh Nam')).toBeInTheDocument()
    expect(screen.queryByText('Anh Hùng')).not.toBeInTheDocument()
  })
})
