import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { BatchDetailScreen } from '../batches/BatchDetailScreen'
import { resetDemoData, clearAllData } from '../../data/seed'

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
      expect(screen.getByText('Bạch đàn BV16')).toBeInTheDocument()
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
})
