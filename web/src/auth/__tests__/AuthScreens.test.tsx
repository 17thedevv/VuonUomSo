import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LoginScreen } from '../../features/auth/LoginScreen'
import { SignupScreen } from '../../features/auth/SignupScreen'
import { ForgotPasswordScreen } from '../../features/auth/ForgotPasswordScreen'
import { AuthCallbackScreen } from '../../features/auth/AuthCallbackScreen'
import { AuthContext } from '../auth-context'
import type { AuthContextValue } from '../auth.types'
import * as supabaseModule from '../../lib/supabase/client'

const createMockAuthContext = (overrides?: Partial<AuthContextValue>): AuthContextValue => ({
  status: 'unauthenticated',
  user: null,
  session: null,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  requestPasswordReset: vi.fn(),
  ...overrides
})

describe('Auth Screens UX & Flow', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('LoginScreen', () => {
    it('renders branding, semantic labels, and accessible inputs', () => {
      const mockAuth = createMockAuthContext()

      render(
        <AuthContext.Provider value={mockAuth}>
          <MemoryRouter>
            <LoginScreen />
          </MemoryRouter>
        </AuthContext.Provider>
      )

      expect(screen.getByRole('heading', { name: 'Vườn Ươm' })).toBeInTheDocument()
      expect(screen.getByText('Sổ cây giống trên điện thoại')).toBeInTheDocument()
      expect(screen.getByLabelText(/Địa chỉ Email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Mật khẩu/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Đăng nhập/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /Quên mật khẩu\?/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /Đăng ký ngay/i })).toBeInTheDocument()
    })

    it('shows validation error when fields are empty', async () => {
      const mockAuth = createMockAuthContext()

      render(
        <AuthContext.Provider value={mockAuth}>
          <MemoryRouter>
            <LoginScreen />
          </MemoryRouter>
        </AuthContext.Provider>
      )

      fireEvent.click(screen.getByRole('button', { name: /Đăng nhập/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Vui lòng nhập đầy đủ email và mật khẩu.')
      })
      expect(mockAuth.signIn).not.toHaveBeenCalled()
    })

    it('displays user-friendly Vietnamese error on invalid credentials', async () => {
      const mockAuth = createMockAuthContext({
        signIn: vi.fn().mockRejectedValue(new Error('Invalid login credentials'))
      })

      render(
        <AuthContext.Provider value={mockAuth}>
          <MemoryRouter>
            <LoginScreen />
          </MemoryRouter>
        </AuthContext.Provider>
      )

      fireEvent.change(screen.getByLabelText(/Địa chỉ Email/i), { target: { value: 'wrong@example.com' } })
      fireEvent.change(screen.getByLabelText(/Mật khẩu/i), { target: { value: 'wrongpassword' } })
      fireEvent.click(screen.getByRole('button', { name: /Đăng nhập/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không chính xác.')
      })
    })
  })

  describe('SignupScreen', () => {
    it('validates password length and password match before submission', async () => {
      const mockAuth = createMockAuthContext()

      render(
        <AuthContext.Provider value={mockAuth}>
          <MemoryRouter>
            <SignupScreen />
          </MemoryRouter>
        </AuthContext.Provider>
      )

      // Short password (< 6 chars)
      fireEvent.change(screen.getByLabelText(/Địa chỉ Email/i), { target: { value: 'user@example.com' } })
      fireEvent.change(screen.getByLabelText(/Mật khẩu \(tối thiểu 6 ký tự\)/i), { target: { value: '123' } })
      fireEvent.change(screen.getByLabelText(/Xác nhận lại mật khẩu/i), { target: { value: '123' } })
      fireEvent.click(screen.getByRole('button', { name: /Đăng ký tài khoản/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('tối thiểu từ 6 ký tự')
      })

      // Mismatched passwords
      fireEvent.change(screen.getByLabelText(/Mật khẩu \(tối thiểu 6 ký tự\)/i), { target: { value: '123456' } })
      fireEvent.change(screen.getByLabelText(/Xác nhận lại mật khẩu/i), { target: { value: '654321' } })
      fireEvent.click(screen.getByRole('button', { name: /Đăng ký tài khoản/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Mật khẩu xác nhận không khớp.')
      })
    })

    it('shows email confirmation UX when signup succeeds without immediate session', async () => {
      const mockAuth = createMockAuthContext({
        signUp: vi.fn().mockResolvedValue({
          user: { id: 'u1', email: 'owner@vuon.vn' },
          session: null,
          requiresEmailConfirmation: true
        })
      })

      render(
        <AuthContext.Provider value={mockAuth}>
          <MemoryRouter>
            <SignupScreen />
          </MemoryRouter>
        </AuthContext.Provider>
      )

      fireEvent.change(screen.getByLabelText(/Địa chỉ Email/i), { target: { value: 'owner@vuon.vn' } })
      fireEvent.change(screen.getByLabelText(/Mật khẩu \(tối thiểu 6 ký tự\)/i), { target: { value: 'secret123' } })
      fireEvent.change(screen.getByLabelText(/Xác nhận lại mật khẩu/i), { target: { value: 'secret123' } })
      fireEvent.click(screen.getByRole('button', { name: /Đăng ký tài khoản/i }))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Đăng ký thành công!' })).toBeInTheDocument()
        expect(screen.getByText('owner@vuon.vn')).toBeInTheDocument()
        expect(screen.getByText(/Thư rác \/ Spam/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Về màn hình đăng nhập/i })).toBeInTheDocument()
      })
    })
  })

  describe('ForgotPasswordScreen', () => {
    it('allows requesting password reset and displays confirmation notice', async () => {
      const mockAuth = createMockAuthContext({
        requestPasswordReset: vi.fn().mockResolvedValue(undefined)
      })

      render(
        <AuthContext.Provider value={mockAuth}>
          <MemoryRouter>
            <ForgotPasswordScreen />
          </MemoryRouter>
        </AuthContext.Provider>
      )

      fireEvent.change(screen.getByLabelText(/Địa chỉ Email/i), { target: { value: 'reset@vuonuom.vn' } })
      fireEvent.click(screen.getByRole('button', { name: /Gửi liên kết khôi phục/i }))

      await waitFor(() => {
        expect(screen.getByText('Đã gửi email khôi phục')).toBeInTheDocument()
        expect(screen.getByText('reset@vuonuom.vn')).toBeInTheDocument()
      })

      expect(mockAuth.requestPasswordReset).toHaveBeenCalledWith('reset@vuonuom.vn')
    })
  })

  describe('AuthCallbackScreen', () => {
    it('handles callback with established session and navigates', async () => {
      vi.spyOn(supabaseModule, 'getSupabaseClient').mockReturnValue({
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: { access_token: 'valid-session' } },
            error: null
          })
        }
      } as any)

      render(
        <MemoryRouter>
          <AuthCallbackScreen />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Xác nhận thành công')).toBeInTheDocument()
      })
    })

    it('displays error state when callback fails or has invalid link', async () => {
      vi.spyOn(supabaseModule, 'getSupabaseClient').mockReturnValue({
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: null },
            error: new Error('Token has expired or is invalid')
          })
        }
      } as any)

      render(
        <MemoryRouter>
          <AuthCallbackScreen />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Không thể xác nhận' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Quay về trang Đăng nhập/i })).toBeInTheDocument()
      })
    })
  })
})
