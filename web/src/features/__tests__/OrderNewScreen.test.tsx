import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { OrderNewScreen } from '../orders/OrderNewScreen'
import { BatchDetailScreen } from '../batches/BatchDetailScreen'
import { contactRepository, batchRepository, orderRepository, reservationRepository } from '../../data/repositories'
import { resetDemoData, clearAllData } from '../../data/seed'
import { undoService } from '../../services/undoService'
import { db } from '../../data/db'
import type { DomainEvent } from '../../analytics/events'
import type { Batch } from '../../domain/batch'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="current-location">{location.pathname}{location.search}</div>
}

function renderOrderForm(entry = '/orders/new') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <Routes>
        <Route path="/batches/:id" element={<BatchDetailScreen />} />
        <Route path="/orders/new" element={<OrderNewScreen />} />
        <Route path="/orders/:id" element={<div data-testid="order-detail-view">Chi tiết đơn</div>} />
      </Routes>
    </MemoryRouter>
  )
}

async function saveCustomBatch(variety: string, id = 'batch_monthong', readyQuantity = 40000) {
  const batch: Batch = {
    id, code: id, variety, createdAt: '2026-10-09',
    initialQuantity: 50000, currentQuantity: 50000, readyQuantity, status: 'ready'
  }
  await batchRepository.save(batch)
  return batch
}

function varietyPicker() {
  return screen.getByLabelText(/Loại cây giống/) as HTMLSelectElement
}

function expectVisibleVariety(value: string) {
  const picker = varietyPicker()
  expect(picker).toHaveValue(value)
  expect(picker.selectedOptions[0]?.textContent).toBe(value)
}

async function submitVisibleVariety(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByLabelText(/Khách đặt cây/)
  const visibleVariety = varietyPicker().selectedOptions[0].textContent
  expect(varietyPicker().value).toBe(visibleVariety)
  const ordersBefore = await orderRepository.getAll()
  const batchesBefore = await batchRepository.getAll()
  const reservationsBefore = await reservationRepository.getAll()
  await user.click(screen.getByRole('button', { name: /LƯU ĐƠN HÀNG/i }))
  await screen.findByTestId('order-detail-view')
  const ordersAfter = await orderRepository.getAll()
  expect(ordersAfter).toHaveLength(ordersBefore.length + 1)
  const created = ordersAfter.find(order => !ordersBefore.some(old => old.id === order.id))!
  expect(created.variety).toBe(visibleVariety)
  expect(created.status).toBe('open')
  expect(await batchRepository.getAll()).toEqual(batchesBefore)
  expect(await reservationRepository.getAll()).toEqual(reservationsBefore)
  return created
}

describe('OrderNewScreen', () => {
  beforeEach(async () => {
    await clearAllData()
    await resetDemoData()
    undoService.clearLastMutation()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('submits the visible default common variety', async () => {
    renderOrderForm()
    expectVisibleVariety('Keo lai BV16')
    expect((await submitVisibleVariety(userEvent.setup())).variety).toBe('Keo lai BV16')
  })

  it.each([
    ['Ri6', 'Monthong', 'Keo lai BV16', 'Dona'],
    ['Dona', 'Keo lai BV16', 'Monthong', 'Ri6']
  ])('extends common choices in the same order regardless of batch arrival order: %j', async (...labels) => {
    for (const [index, label] of labels.entries()) await saveCustomBatch(label, `custom_${index}`)
    renderOrderForm()
    await screen.findByRole('option', { name: 'Monthong' })
    expect(Array.from(varietyPicker().options, option => option.value)).toEqual([
      'Keo lai BV16', 'Keo lai AH1', 'Keo lai BV523', 'Keo tai tượng', 'Bạch đàn U6',
      'Dona', 'Monthong', 'Ri6'
    ])
    expectVisibleVariety('Keo lai BV16')
  })

  it('keeps Monthong query prefill visible before and after loading and submits that visible label', async () => {
    await saveCustomBatch('Monthong')
    renderOrderForm('/orders/new?variety=Monthong')
    expectVisibleVariety('Monthong')
    await screen.findByLabelText(/Khách đặt cây/)
    expectVisibleVariety('Monthong')
    await screen.findByText(/Vườn hiện có/)
    expect(screen.getByText(/Monthong sẵn sàng bán/)).toBeInTheDocument()
    expect((await submitVisibleVariety(userEvent.setup())).variety).toBe('Monthong')
  })

  it('follows the actual BatchDetail Ghi đơn deep link without reserving its contextual batch', async () => {
    await saveCustomBatch('Monthong')
    const user = userEvent.setup()
    renderOrderForm('/batches/batch_monthong')
    await user.click(await screen.findByRole('button', { name: /Ghi đơn/i }))
    expect(screen.getByTestId('current-location')).toHaveTextContent(
      '/orders/new?batchId=batch_monthong&variety=Monthong'
    )
    expectVisibleVariety('Monthong')
    expect((await submitVisibleVariety(user)).variety).toBe('Monthong')
  })

  it('represents a trimmed unknown intentional prefill without inventing a batch', async () => {
    renderOrderForm('/orders/new?variety=%20Sau%20rieng%20Dona%20')
    expectVisibleVariety('Sau rieng Dona')
    expect((await submitVisibleVariety(userEvent.setup())).variety).toBe('Sau rieng Dona')
    expect((await batchRepository.getAll()).some(batch => batch.variety === 'Sau rieng Dona')).toBe(false)
  })

  it.each(['', '%20%20'])('falls back to the common default for blank query "%s"', async query => {
    renderOrderForm(`/orders/new?variety=${query}`)
    expectVisibleVariety('Keo lai BV16')
    expect((await submitVisibleVariety(userEvent.setup())).variety).toBe('Keo lai BV16')
  })

  it('dedupes trim/case while preserving draft spelling, internal spaces and accents without DB writes', async () => {
    const labels = ['Monthong', ' monthong ', 'MONTHONG', 'Ri 6', 'Ri6', 'Bạch đàn U6', 'Bach dan U6']
    for (const [index, label] of labels.entries()) await saveCustomBatch(label, `custom_${index}`)
    const before = await batchRepository.getAll()
    renderOrderForm('/orders/new?variety=%20mOnThOnG%20')
    await screen.findByRole('option', { name: 'Ri6' })
    const values = Array.from(varietyPicker().options, option => option.value)
    expect(values.filter(value => value.trim().toLowerCase() === 'monthong')).toEqual(['mOnThOnG'])
    expect(values.filter(value => value.trim().toLowerCase() === 'bạch đàn u6')).toHaveLength(1)
    expect(values).toContain('Ri 6')
    expect(values).toContain('Ri6')
    expect(values).toContain('Bach dan U6')
    expectVisibleVariety('mOnThOnG')
    expect(await batchRepository.getAll()).toEqual(before)
    expect((await submitVisibleVariety(userEvent.setup())).variety).toBe('mOnThOnG')
  })

  it.each(['Monthong', 'Keo lai AH1'])('does not reset intentional "%s" when delayed batches arrive', async selected => {
    await saveCustomBatch('Monthong')
    const batches = await batchRepository.getAll()
    let finishLoad!: (value: Batch[]) => void
    const delayed = new Promise<Batch[]>(resolve => { finishLoad = resolve })
    vi.spyOn(batchRepository, 'getAll').mockImplementationOnce(() => delayed)
    renderOrderForm('/orders/new?variety=Monthong')
    expectVisibleVariety('Monthong')
    if (selected !== 'Monthong') await userEvent.setup().selectOptions(varietyPicker(), selected)
    expectVisibleVariety(selected)
    await act(async () => { finishLoad(batches); await delayed })
    await screen.findByLabelText(/Khách đặt cây/)
    expectVisibleVariety(selected)
    expect((await submitVisibleVariety(userEvent.setup())).variety).toBe(selected)
  })

  it('updates visible selection, real availability feedback and persistence after a manual change', async () => {
    await saveCustomBatch('Monthong')
    await saveCustomBatch('Ri6', 'batch_ri6', 10000)
    const user = userEvent.setup()
    renderOrderForm('/orders/new?variety=Monthong')
    await screen.findByRole('option', { name: 'Ri6' })
    await screen.findByText(/Monthong sẵn sàng bán/)
    await user.selectOptions(varietyPicker(), 'Ri6')
    expectVisibleVariety('Ri6')
    await screen.findByText(/Đơn cần 30.000 cây • Hiện vườn còn 10.000 cây có thể bán/)
    expect(screen.queryByText(/Monthong sẵn sàng bán/)).not.toBeInTheDocument()
    expect((await submitVisibleVariety(user)).variety).toBe('Ri6')
  })

  it('keeps common and current choices when the baseline batch read fails', async () => {
    vi.spyOn(batchRepository, 'getAll').mockRejectedValueOnce(new Error('batch read failed'))
    renderOrderForm('/orders/new?variety=Sau%20rieng%20Dona')
    expectVisibleVariety('Sau rieng Dona')
    await screen.findByText('Chưa có khách trong danh bạ.')
    expectVisibleVariety('Sau rieng Dona')
    expect(screen.getByRole('option', { name: 'Keo lai BV16' })).toBeInTheDocument()
    expect(varietyPicker().options).toHaveLength(6)
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
