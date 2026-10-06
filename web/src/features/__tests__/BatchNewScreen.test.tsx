import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { BatchNewScreen } from '../batches/BatchNewScreen'
import { batchRepository } from '../../data/repositories'
import { clearAllData } from '../../data/seed'
import { undoService } from '../../services/undoService'

describe('BatchNewScreen', () => {
  beforeEach(async () => {
    await clearAllData()
    undoService.clearLastMutation()
  })

  it('renders form fields: variety, quantity input, date and submit button', () => {
    render(
      <MemoryRouter initialEntries={['/batches/new']}>
        <Routes>
          <Route path="/batches/new" element={<BatchNewScreen />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Tạo lô mới')).toBeInTheDocument()
    expect(screen.getByLabelText(/Giống cây/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Số lượng ban đầu/)).toBeInTheDocument()
    expect(screen.getByText('LƯU LÔ CÂY')).toBeInTheDocument()
  })

  it('creates a new batch and navigates to batch detail screen', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/batches/new']}>
        <Routes>
          <Route path="/batches/new" element={<BatchNewScreen />} />
          <Route path="/batches/:id" element={<div data-testid="batch-detail-view">Màn hình chi tiết lô</div>} />
        </Routes>
      </MemoryRouter>
    )

    // Form defaults to 5 vạn (50.000) and BV16
    const submitBtn = screen.getByRole('button', { name: /LƯU LÔ CÂY/i })
    await user.click(submitBtn)

    await waitFor(async () => {
      expect(screen.getByTestId('batch-detail-view')).toBeInTheDocument()
    })

    // Verify batch in repository
    const batches = await batchRepository.getAll()
    expect(batches).toHaveLength(1)
    expect(batches[0].variety).toBe('Keo lai BV16')
    expect(batches[0].initialQuantity).toBe(50000)
    expect(batches[0].currentQuantity).toBe(50000)
    expect(batches[0].readyQuantity).toBe(0)
    expect(batches[0].status).toBe('propagating')

    // Verify undo registered
    expect(undoService.getLastMutation()?.type).toBe('create_batch')
  })

  it('supports entering a custom variety name', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/batches/new']}>
        <Routes>
          <Route path="/batches/new" element={<BatchNewScreen />} />
          <Route path="/batches/:id" element={<div data-testid="batch-detail-view">Màn hình chi tiết lô</div>} />
        </Routes>
      </MemoryRouter>
    )

    // Select '+ Giống khác...'
    const select = screen.getByRole('combobox', { name: /Giống cây/ })
    await user.selectOptions(select, '__other__')

    // Custom input appears
    const customInput = screen.getByPlaceholderText('Nhập tên giống cây khác...')
    await user.type(customInput, 'Lát hoa Điện Biên')

    const submitBtn = screen.getByRole('button', { name: /LƯU LÔ CÂY/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByTestId('batch-detail-view')).toBeInTheDocument()
    })

    const batches = await batchRepository.getAll()
    expect(batches).toHaveLength(1)
    expect(batches[0].variety).toBe('Lát hoa Điện Biên')
  })
})
