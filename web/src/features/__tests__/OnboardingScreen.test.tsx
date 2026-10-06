import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { OnboardingScreen } from '../onboarding/OnboardingScreen'
import { clearAllData } from '../../data/seed'
import { organizationRepository } from '../../data/repositories'

describe('OnboardingScreen', () => {
  beforeEach(async () => {
    await clearAllData()
  })

  it('renders branding and input fields correctly', () => {
    render(
      <MemoryRouter>
        <OnboardingScreen />
      </MemoryRouter>
    )

    expect(screen.getByText('Vườn Ươm')).toBeInTheDocument()
    expect(screen.getByText('Sổ cây giống trên điện thoại')).toBeInTheDocument()
    expect(screen.getByLabelText(/Tên vườn \/ cơ sở/i)).toBeInTheDocument()
    expect(screen.getByText('Ươm cây')).toBeInTheDocument()
    expect(screen.getByText('Bán cây')).toBeInTheDocument()
    expect(screen.getByText('BẮT ĐẦU')).toBeInTheDocument()
  })

  it('displays validation error if name is empty', async () => {
    render(
      <MemoryRouter>
        <OnboardingScreen />
      </MemoryRouter>
    )

    const submitBtn = screen.getByText('BẮT ĐẦU')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Vui lòng nhập tên vườn hoặc cơ sở của bạn/i)).toBeInTheDocument()
    })
  })

  it('saves organization when submitted with valid name', async () => {
    render(
      <MemoryRouter>
        <OnboardingScreen />
      </MemoryRouter>
    )

    const nameInput = screen.getByLabelText(/Tên vườn \/ cơ sở/i)
    fireEvent.change(nameInput, { target: { value: 'Vườn Ươm Bắc Giang' } })

    const submitBtn = screen.getByText('BẮT ĐẦU')
    fireEvent.click(submitBtn)

    await waitFor(async () => {
      const org = await organizationRepository.getCurrent()
      expect(org).not.toBeNull()
      expect(org?.name).toBe('Vườn Ươm Bắc Giang')
    })
  })
})
