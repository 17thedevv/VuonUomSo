import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { OrderNewScreen } from '../orders/OrderNewScreen'
import { contactRepository, orderRepository, reservationRepository } from '../../data/repositories'
import { resetDemoData, clearAllData } from '../../data/seed'
import { undoService } from '../../services/undoService'
import { db } from '../../data/db'
import type { DomainEvent } from '../../analytics/events'

describe('OrderNewScreen', () => {
  beforeEach(async () => {
    await clearAllData()
    await resetDemoData()
    undoService.clearLastMutation()
  })

  it('renders form with customer select, variety, quantity and live availability banner', async () => {
    render(
      <MemoryRouter initialEntries={['/orders/new']}>
        <Routes>
          <Route path="/orders/new" element={<OrderNewScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Ghi đơn mới')).toBeInTheDocument()
      expect(screen.getByLabelText(/Khách đặt cây/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Loại cây giống/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Số lượng đặt/)).toBeInTheDocument()
    })

    // Availability feedback banner for default BV16 (30.000 requested vs 22.000 available => shortage 8.000)
    await waitFor(() => {
      expect(screen.getByText(/Đơn cần 30.000 cây • Hiện vườn còn 22.000 cây có thể bán/)).toBeInTheDocument()
    })
  })

  it('creates order with status="open", without creating reservations, and navigates to order detail', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/orders/new']}>
        <Routes>
          <Route path="/orders/new" element={<OrderNewScreen />} />
          <Route path="/orders/:id" element={<div data-testid="order-detail-view">Chi tiết đơn</div>} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/Khách đặt cây/)).toBeInTheDocument()
    })

    const reservationsBefore = await reservationRepository.getAll()
    const ordersBefore = await orderRepository.getAll()

    const submitBtn = screen.getByRole('button', { name: /LƯU ĐƠN HÀNG/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByTestId('order-detail-view')).toBeInTheDocument()
    })

    // Verify order was created with status = 'open'
    const ordersAfter = await orderRepository.getAll()
    expect(ordersAfter.length).toBe(ordersBefore.length + 1)
    const newOrder = ordersAfter.find((o) => !ordersBefore.some((b) => b.id === o.id))!
    expect(newOrder.status).toBe('open')
    expect(newOrder.variety).toBe('Keo lai BV16')
    expect(newOrder.requestedQuantity).toBe(30000)

    // Invariant: NO reservation created
    const reservationsAfter = await reservationRepository.getAll()
    expect(reservationsAfter.length).toBe(reservationsBefore.length)

    // Verify undo registered
    expect(undoService.getLastMutation()?.type).toBe('create_order')
  })

  it('retains the draft on history-write failure and retries without a duplicate order or Undo', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/orders/new']}>
        <Routes>
          <Route path="/orders/new" element={<OrderNewScreen />} />
          <Route path="/orders/:id" element={<div data-testid="order-detail-view">Chi tiết đơn</div>} />
        </Routes>
      </MemoryRouter>
    )
    await screen.findByLabelText(/Khách đặt cây/)
    const customerId = (screen.getByLabelText(/Khách đặt cây/) as HTMLSelectElement).value
    const ordersBefore = await orderRepository.getAll()
    const eventsBefore = await db.events.toArray()
    const failCreateEvent = (_key: unknown, event: DomainEvent) => {
      if (event.type === 'order_created') throw new Error('history write failed')
    }
    db.events.hook('creating', failCreateEvent)
    try {
      await user.click(screen.getByRole('button', { name: /LƯU ĐƠN HÀNG/i }))
      await screen.findByText(/Chưa lưu được đơn hàng trên thiết bị/)
      expect(screen.queryByTestId('order-detail-view')).not.toBeInTheDocument()
      expect(screen.getByLabelText(/Số lượng đặt/)).toHaveValue('3')
      expect(screen.getByLabelText(/Khách đặt cây/)).toHaveValue(customerId)
      expect(await orderRepository.getAll()).toEqual(ordersBefore)
      expect(await db.events.toArray()).toEqual(eventsBefore)
      expect(undoService.getLastMutation()).toBeNull()
    } finally {
      db.events.hook('creating').unsubscribe(failCreateEvent)
    }
    await user.click(screen.getByRole('button', { name: /LƯU ĐƠN HÀNG/i }))
    await screen.findByTestId('order-detail-view')
    const ordersAfter = await orderRepository.getAll()
    expect(ordersAfter).toHaveLength(ordersBefore.length + 1)
    const created = ordersAfter.find(o => !ordersBefore.some(old => old.id === o.id))!
    expect(created).toMatchObject({ customerId, requestedQuantity: 30000, status: 'open' })
    expect(await db.events.where('entityId').equals(created.id).filter(e => e.type === 'order_created').count()).toBe(1)
    expect(undoService.getLastMutation()).toMatchObject({ type: 'create_order', orderId: created.id })
  })

  it('allows quick creating a customer directly from the order screen', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/orders/new']}>
        <Routes>
          <Route path="/orders/new" element={<OrderNewScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('+ Khách mới')).toBeInTheDocument()
    })

    // Open quick create modal
    await user.click(screen.getByText('+ Khách mới'))

    expect(screen.getByText('Thêm khách mới')).toBeInTheDocument()

    // Fill customer form
    const nameInput = screen.getByLabelText(/Tên khách hàng/)
    await user.type(nameInput, 'Bác Hoàng Hữu Lũng')

    const phoneInput = screen.getByLabelText(/Số điện thoại/)
    await user.type(phoneInput, '0999888777')

    // Submit quick create
    await user.click(screen.getByRole('button', { name: 'Lưu khách' }))

    // Modal closes and new customer is selected in dropdown
    await waitFor(async () => {
      const contacts = await contactRepository.getAll()
      expect(contacts.some((c) => c.name === 'Bác Hoàng Hữu Lũng')).toBe(true)
    })
  })
})
