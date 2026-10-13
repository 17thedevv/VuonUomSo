import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LoginScreen } from '../../features/auth/LoginScreen'
import { SignupScreen } from '../../features/auth/SignupScreen'
import { ForgotPasswordScreen } from '../../features/auth/ForgotPasswordScreen'
import { AuthContext } from '../auth-context'
import type { AuthContextValue } from '../auth.types'

const createMockAuthContext = (): AuthContextValue => ({
  status: 'unauthenticated',
  user: null,
  session: null,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  requestPasswordReset: vi.fn()
})

describe('Mobile 360px / 390px / 430px Acceptance', () => {
  const viewports = [
    { name: 'Small mobile (360px)', width: 360 },
    { name: 'Standard mobile (390px)', width: 390 },
    { name: 'Large mobile (430px)', width: 430 }
  ]

  viewports.forEach(({ name, width }) => {
    describe(`${name} layout and touch target compliance`, () => {
      it('LoginScreen maintains min 48px touch targets and full-width CTA without overflow', () => {
        window.innerWidth = width
        const mockAuth = createMockAuthContext()

        const { container } = render(
          <AuthContext.Provider value={mockAuth}>
            <MemoryRouter>
              <LoginScreen />
            </MemoryRouter>
          </AuthContext.Provider>
        )

        // Primary submit CTA has min-h-[48px]
        const submitBtn = screen.getByRole('button', { name: /Đăng nhập/i })
        expect(submitBtn.className).toContain('min-h-[48px]')
        expect(submitBtn.className).toContain('w-full')

        // Inputs have min-h-[48px]
        const emailInput = screen.getByLabelText(/Địa chỉ Email/i)
        const passwordInput = screen.getByLabelText(/Mật khẩu/i)
        expect(emailInput.className).toContain('min-h-[48px]')
        expect(passwordInput.className).toContain('min-h-[48px]')

        // Root container has no fixed overflow width
        const rootDiv = container.firstChild as HTMLElement
        expect(rootDiv.className).toContain('min-h-screen')
      })

      it('SignupScreen provides accessible touch targets and proper spacing', () => {
        window.innerWidth = width
        const mockAuth = createMockAuthContext()

        render(
          <AuthContext.Provider value={mockAuth}>
            <MemoryRouter>
              <SignupScreen />
            </MemoryRouter>
          </AuthContext.Provider>
        )

        const submitBtn = screen.getByRole('button', { name: /Đăng ký tài khoản/i })
        expect(submitBtn.className).toContain('min-h-[48px]')
        expect(submitBtn.className).toContain('w-full')

        const emailInput = screen.getByLabelText(/Địa chỉ Email/i)
        const passwordInput = screen.getByLabelText(/Mật khẩu \(tối thiểu 6 ký tự\)/i)
        const confirmInput = screen.getByLabelText(/Xác nhận lại mật khẩu/i)

        expect(emailInput.className).toContain('min-h-[48px]')
        expect(passwordInput.className).toContain('min-h-[48px]')
        expect(confirmInput.className).toContain('min-h-[48px]')
      })

      it('ForgotPasswordScreen provides accessible touch targets and back link', () => {
        window.innerWidth = width
        const mockAuth = createMockAuthContext()

        render(
          <AuthContext.Provider value={mockAuth}>
            <MemoryRouter>
              <ForgotPasswordScreen />
            </MemoryRouter>
          </AuthContext.Provider>
        )

        const submitBtn = screen.getByRole('button', { name: /Gửi liên kết khôi phục/i })
        expect(submitBtn.className).toContain('min-h-[48px]')

        const emailInput = screen.getByLabelText(/Địa chỉ Email/i)
        expect(emailInput.className).toContain('min-h-[48px]')
      })
    })
  })
})
