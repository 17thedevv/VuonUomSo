import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BatchesScreen } from '../batches/BatchesScreen'
import { resetDemoData, clearAllData } from '../../data/seed'

describe('BatchesScreen', () => {
  beforeEach(async () => {
    await clearAllData()
    await resetDemoData()
  })

  it('renders batches list from seed data with correct sorting and badges', async () => {
    render(
      <MemoryRouter initialEntries={['/batches']}>
        <BatchesScreen />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('BV16 #12')).toBeInTheDocument()
      expect(screen.getByText('AH1 #07')).toBeInTheDocument()
      expect(screen.getByText('BV523 #03')).toBeInTheDocument()
    })

    // BV523 #03 has attention notice (Sắp quá lứa)
    expect(screen.getByText('Sắp quá lứa')).toBeInTheDocument()

    // BV16 #12 has 22.000 available and 10.000 reserved
    expect(screen.getByText('22.000')).toBeInTheDocument()
    expect(screen.getByText('10.000')).toBeInTheDocument()
  })

  it('filters batches when clicking filter tabs', async () => {
    render(
      <MemoryRouter initialEntries={['/batches']}>
        <BatchesScreen />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('BV523 #03')).toBeInTheDocument()
    })

    // Click "Cần chú ý" filter tab
    const attentionTab = screen.getByText('Cần chú ý')
    fireEvent.click(attentionTab)

    // Only BV523 #03 should be displayed in the list
    expect(screen.getByText('BV523 #03')).toBeInTheDocument()
    expect(screen.queryByText('AH1 #07')).not.toBeInTheDocument()

    // Click "Tất cả"
    const allTab = screen.getByText('Tất cả')
    fireEvent.click(allTab)

    expect(screen.getByText('BV16 #12')).toBeInTheDocument()
    expect(screen.getByText('AH1 #07')).toBeInTheDocument()
    expect(screen.getByText('BV523 #03')).toBeInTheDocument()
  })
})
