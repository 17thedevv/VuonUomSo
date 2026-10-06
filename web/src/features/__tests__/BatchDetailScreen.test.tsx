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
    const inventoryBtn = screen.getByRole('button', { name: 'KIỂM KÊ' })
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
})

