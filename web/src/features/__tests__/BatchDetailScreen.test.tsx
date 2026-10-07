import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { BatchDetailScreen } from '../batches/BatchDetailScreen'
import { resetDemoData, clearAllData } from '../../data/seed'
import { db } from '../../data/db'

describe('BatchDetailScreen', () => {
  beforeEach(async () => {
    await clearAllData()
    await resetDemoData()
  })

  it('renders batch detail with metrics and history timeline for BV16 #12', async () => {
    render(
      <MemoryRouter initialEntries={['/batches/batch_bv16_12']}>
        <Routes>
          <Route path="/batches/:id" element={<BatchDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('BV16 #12')).toBeInTheDocument()
      expect(screen.getByText('Keo lai BV16')).toBeInTheDocument()
    })

    // Key metrics:
    // Cây sống: 45.200 (out of 50.000 init)
    expect(screen.getByText('45.200')).toBeInTheDocument()
    // Đủ chuẩn: 32.000
    expect(screen.getByText('32.000')).toBeInTheDocument()
    // Đã giữ: 10.000
    expect(screen.getByText('10.000')).toBeInTheDocument()
    // Còn bán: 22.000
    expect(screen.getByText('22.000')).toBeInTheDocument()

    // History timeline events from seed
    expect(screen.getByText('32.000 cây đạt chuẩn đủ bán')).toBeInTheDocument()
    expect(screen.getByText(/Nhập vườn 50.000 cây/)).toBeInTheDocument()
  })

  it('renders attention notice for batch BV523 #03', async () => {
    render(
      <MemoryRouter initialEntries={['/batches/batch_bv523_03']}>
        <Routes>
          <Route path="/batches/:id" element={<BatchDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('BV523 #03')).toBeInTheDocument()
    })

    // Overage notice should be present
    expect(screen.getByText(/Nên bán trước/)).toBeInTheDocument()
    expect(screen.getByText(/rễ ăn sâu vào đất bãi/)).toBeInTheDocument()
  })

  it('opens inventory update modal and successfully updates living stock', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/batches/batch_bv16_12']}>
        <Routes>
          <Route path="/batches/:id" element={<BatchDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('BV16 #12')).toBeInTheDocument()
    })

    // Click 'KIỂM KÊ' button
    const inventoryBtn = screen.getByRole('button', { name: /KIỂM KÊ/ })
    await user.click(inventoryBtn)

    // Modal opens
    expect(screen.getByText('Kiểm kê lô BV16 #12')).toBeInTheDocument()

    // Submit with new quantity (42000 cây, which is valid: 42000 >= 32000 and <= 50000)
    const quantityInput = screen.getByLabelText(/Hiện còn bao nhiêu cây sống\?/)
    fireEvent.change(quantityInput, { target: { value: '42000' } })

    // Submit update
    const submitBtn = screen.getByRole('button', { name: 'CẬP NHẬT' })
    await user.click(submitBtn)

    // Verify modal closes and updated value is reflected
    await waitFor(() => {
      expect(screen.queryByText('Kiểm kê lô BV16 #12')).not.toBeInTheDocument()
      expect(screen.getByText('42.000')).toBeInTheDocument()
    })
  })

  it('renders empty state when batch ID is not found', async () => {
    render(
      <MemoryRouter initialEntries={['/batches/non_existent_id']}>
        <Routes>
          <Route path="/batches/:id" element={<BatchDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Không tìm thấy lô cây này')).toBeInTheDocument()
    })
  })

  it('renders dossier section and shows completeness status for batch', async () => {
    // Add dossier for demo batch
    await db.dossiers.add({
      id: 'dos_test_detail',
      batchId: 'batch_bv16_12',
      materialType: 'cutting',
      sourceName: 'Vườn cây đầu dòng Ba Vì',
      sourceLotCode: 'BV16-01',
      documents: [{ id: 'd1', title: 'Phiếu nguồn giống' }],
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01'
    })

    render(
      <MemoryRouter initialEntries={['/batches/batch_bv16_12']}>
        <Routes>
          <Route path="/batches/:id" element={<BatchDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Hồ sơ nguồn gốc')).toBeInTheDocument()
      expect(screen.getByText('Có chứng từ tham chiếu')).toBeInTheDocument()
      expect(screen.getByText('Vườn cây đầu dòng Ba Vì')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'XEM HỒ SƠ' })).toBeInTheDocument()
    })
  })

  it('opens ready quantity modal and successfully updates ready stock', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/batches/batch_bv16_12']}>
        <Routes>
          <Route path="/batches/:id" element={<BatchDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('BV16 #12')).toBeInTheDocument()
    })

    // Click 'CẬP NHẬT CÂY ĐỦ BÁN' button
    const readyBtn = screen.getByRole('button', { name: /CẬP NHẬT CÂY ĐỦ BÁN/ })
    await user.click(readyBtn)

    // Modal opens with 4-value context
    expect(screen.getByRole('dialog', { name: /Cập nhật cây đủ bán/ })).toBeInTheDocument()
    expect(screen.getByText('Đủ bán cũ')).toBeInTheDocument()

    // Enter new ready quantity (35.000, valid <= 45.200 living)
    const input = screen.getByLabelText(/Tổng số cây đủ chuẩn hiện tại/)
    fireEvent.change(input, { target: { value: '35000' } })

    // Submit
    const submitBtn = screen.getByRole('button', { name: 'CẬP NHẬT' })
    await user.click(submitBtn)

    // Modal closes and updated ready quantity 35.000 is reflected
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Cập nhật cây đủ bán/ })).not.toBeInTheDocument()
      expect(screen.getByText('35.000')).toBeInTheDocument()
    })
  })

  it('allows decreasing ready stock below reservations and displays shortage warning', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/batches/batch_bv16_12']}>
        <Routes>
          <Route path="/batches/:id" element={<BatchDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('BV16 #12')).toBeInTheDocument()
    })

    // Reserved on batch_bv16_12 is 10.000. Decrease ready to 8.000 (< 10.000)
    const readyBtn = screen.getByRole('button', { name: /CẬP NHẬT CÂY ĐỦ BÁN/ })
    await user.click(readyBtn)

    const input = screen.getByLabelText(/Tổng số cây đủ chuẩn hiện tại/)
    fireEvent.change(input, { target: { value: '8000' } })

    // Shortage warning is displayed in modal but does not block submission
    expect(screen.getByText(/Sau cập nhật sẽ thiếu 2.000 cây đã giữ cho khách/)).toBeInTheDocument()

    const submitBtn = screen.getByRole('button', { name: 'CẬP NHẬT' })
    expect(submitBtn).not.toBeDisabled()
    await user.click(submitBtn)

    // Modal closes and BatchDetailScreen displays commitment shortage warning banner
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Cập nhật cây đủ bán/ })).not.toBeInTheDocument()
      expect(screen.getByText('8.000')).toBeInTheDocument()
      expect(screen.getByText(/Thiếu 2.000 cây đã giữ cho khách/)).toBeInTheDocument()
    })
  })

  it('prompts and atomically commits adjusted ready quantity when living drops below ready', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/batches/batch_bv16_12']}>
        <Routes>
          <Route path="/batches/:id" element={<BatchDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('BV16 #12')).toBeInTheDocument()
    })

    // Current living is 45.200, ready is 32.000
    const inventoryBtn = screen.getByRole('button', { name: /KIỂM KÊ/ })
    await user.click(inventoryBtn)

    // User inputs new living stock = 28.000 (< 32.000 ready)
    const livingInput = screen.getByLabelText(/Hiện còn bao nhiêu cây sống\?/)
    fireEvent.change(livingInput, { target: { value: '28000' } })

    // Dynamic prompt appears asking for adjusted ready quantity
    expect(screen.getByText(/Bạn vừa kiểm kê còn 28.000 cây sống/)).toBeInTheDocument()
    expect(screen.getByText(/Hiện lô đang ghi/)).toBeInTheDocument()

    // Submit button is disabled until valid ready quantity is entered
    const submitBtn = screen.getByRole('button', { name: 'CẬP NHẬT' })
    expect(submitBtn).toBeDisabled()

    // Enter adjusted ready quantity = 27.000 (<= 28.000)
    const readyInput = screen.getByLabelText(/Cây đủ bán hiện tại:/)
    fireEvent.change(readyInput, { target: { value: '27000' } })

    // Submit button becomes enabled
    expect(submitBtn).not.toBeDisabled()
    await user.click(submitBtn)

    // Atomically commits both: living = 28.000, ready = 27.000
    await waitFor(() => {
      expect(screen.queryByText('Kiểm kê lô BV16 #12')).not.toBeInTheDocument()
      expect(screen.getByText('28.000')).toBeInTheDocument()
      expect(screen.getByText('27.000')).toBeInTheDocument()
    })
  })

  it('displays "Đã hết" badge when batch currentQuantity is 0', async () => {
    // Save depleted batch
    await db.batches.put({
      id: 'batch_depleted_test',
      code: 'DEPLETED #01',
      variety: 'Keo tai tuong',
      createdAt: new Date().toISOString(),
      initialQuantity: 10000,
      currentQuantity: 0,
      readyQuantity: 0,
      status: 'depleted'
    })

    render(
      <MemoryRouter initialEntries={['/batches/batch_depleted_test']}>
        <Routes>
          <Route path="/batches/:id" element={<BatchDetailScreen />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('DEPLETED #01')).toBeInTheDocument()
    })

    expect(screen.getAllByText('Đã hết').length).toBeGreaterThanOrEqual(1)
  })
})

