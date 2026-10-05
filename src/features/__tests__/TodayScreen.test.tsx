import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TodayScreen } from '../today/TodayScreen'
import { resetDemoData, clearAllData } from '../../data/seed'

describe('TodayScreen', () => {
  beforeEach(async () => {
    await clearAllData()
    await resetDemoData()
  })

  it('renders brand, demo organization name, and primary actions', async () => {
    render(
      <MemoryRouter>
        <TodayScreen />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Vườn Hồng Anh')).toBeInTheDocument()
    })

    expect(screen.getByText('Sổ cây giống trên điện thoại')).toBeInTheDocument()
    expect(screen.getByText('+ GHI ĐƠN')).toBeInTheDocument()
    expect(screen.getByText('CÂY HÔM NAY')).toBeInTheDocument()
    expect(screen.getAllByText('Đủ bán').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Đã giữ').length).toBeGreaterThan(0)
    expect(screen.getByText('Sắp quá lứa')).toBeInTheDocument()
    expect(screen.getByText('VIỆC CẦN LÀM')).toBeInTheDocument()
  })

  it('renders correct computed quantities from seed data', async () => {
    render(
      <MemoryRouter>
        <TodayScreen />
      </MemoryRouter>
    )

    await waitFor(() => {
      // BV16 ready: 32000, reserved: 10000 => available = 22000
      // BV523 ready: 18400, reserved: 0 => available = 18400
      // Total available: 22000 + 18400 = 40.400
      expect(screen.getByText('40.400')).toBeInTheDocument()
      // Total reserved: 10.000 (appears in summary card and batch details)
      expect(screen.getAllByText('10.000').length).toBeGreaterThan(0)
    })
  })
})
