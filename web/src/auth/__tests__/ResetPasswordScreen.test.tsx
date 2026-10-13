import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ResetPasswordScreen } from '../../features/auth/ResetPasswordScreen'
import { AuthContext } from '../auth-context'
import type { AuthContextValue } from '../auth.types'

const createMockAuthContext = (overrides?: Partial<AuthContextValue>): AuthContextValue => ({
  status: 'authenticated',
  user: { id: 'u1', email: 'recovery@vuonuom.local' } as any,
  session: { access_token: 'valid-recovery-token' } as any,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  ...overrides
})

describe('ResetPasswordScreen UX & Validation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders expired/invalid notice when user accesses without an active session', () => {
    const mockAuth = createMockAuthContext({
      status: 'unauthenticated',
      session: null,
      user: null
    })

    render(
      <AuthContext.Provider value={mockAuth}>
        <MemoryRouter>
          <ResetPasswordScreen />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(screen.getByRole('heading', { name: 'Liên kết không hợp lệ hoặc đã hết hạn' })).toBeInTheDocument()
    expect(screen.getByText(/Phiên khôi phục mật khẩu không còn hiệu lực/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Yêu cầu liên kết mới/i })).toHaveAttribute('href', '/forgot-password')
  })

  it('renders reset password form when active recovery session exists', () => {
    const mockAuth = createMockAuthContext()

    render(
      <AuthContext.Provider value={mockAuth}>
        <MemoryRouter>
          <ResetPasswordScreen />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(screen.getByRole('heading', { name: /Đặt mật khẩu mới/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/^Mật khẩu mới \(/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Xác nhận lại mật khẩu mới/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cập nhật mật khẩu mới/i })).toBeInTheDocument()
  })

  it('validates minimum password length', async () => {
    const mockAuth = createMockAuthContext()

    render(
      <AuthContext.Provider value={mockAuth}>
        <MemoryRouter>
          <ResetPasswordScreen />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    fireEvent.change(screen.getByLabelText(/^Mật khẩu mới \(/i), { target: { value: '12345' } })
    fireEvent.change(screen.getByLabelText(/Xác nhận lại mật khẩu mới/i), { target: { value: '12345' } })
    fireEvent.click(screen.getByRole('button', { name: /Cập nhật mật khẩu mới/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Mật khẩu mới phải có ít nhất 6 ký tự.')
    })
    expect(mockAuth.updatePassword).not.toHaveBeenCalled()
  })

  it('validates password confirmation match', async () => {
    const mockAuth = createMockAuthContext()

    render(
      <AuthContext.Provider value={mockAuth}>
        <MemoryRouter>
          <ResetPasswordScreen />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    fireEvent.change(screen.getByLabelText(/^Mật khẩu mới \(/i), { target: { value: 'ValidPassword123' } })
    fireEvent.change(screen.getByLabelText(/Xác nhận lại mật khẩu mới/i), { target: { value: 'DifferentPassword456' } })
    fireEvent.click(screen.getByRole('button', { name: /Cập nhật mật khẩu mới/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Mật khẩu xác nhận không khớp.')
    })
    expect(mockAuth.updatePassword).not.toHaveBeenCalled()
  })

  it('calls updatePassword and renders success screen on valid submission', async () => {
    const mockUpdatePassword = vi.fn().mockResolvedValue(undefined)
    const mockAuth = createMockAuthContext({
      updatePassword: mockUpdatePassword
    })

    render(
      <AuthContext.Provider value={mockAuth}>
        <MemoryRouter>
          <ResetPasswordScreen />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    fireEvent.change(screen.getByLabelText(/^Mật khẩu mới \(/i), { target: { value: 'NewSecurePassword123' } })
    fireEvent.change(screen.getByLabelText(/Xác nhận lại mật khẩu mới/i), { target: { value: 'NewSecurePassword123' } })
    fireEvent.click(screen.getByRole('button', { name: /Cập nhật mật khẩu mới/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Đặt lại mật khẩu thành công!' })).toBeInTheDocument()
    })

    expect(mockUpdatePassword).toHaveBeenCalledWith('NewSecurePassword123')
    expect(screen.getByRole('button', { name: /Về trang Đăng nhập/i })).toBeInTheDocument()
  })

  it('displays user-friendly Vietnamese error if updatePassword rejects', async () => {
    const mockUpdatePassword = vi.fn().mockRejectedValue(new Error('AuthApiError: Password should be at least 6 characters'))
    const mockAuth = createMockAuthContext({
      updatePassword: mockUpdatePassword
    })

    render(
      <AuthContext.Provider value={mockAuth}>
        <MemoryRouter>
          <ResetPasswordScreen />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    fireEvent.change(screen.getByLabelText(/^Mật khẩu mới \(/i), { target: { value: 'NewPassword123' } })
    fireEvent.change(screen.getByLabelText(/Xác nhận lại mật khẩu mới/i), { target: { value: 'NewPassword123' } })
    fireEvent.click(screen.getByRole('button', { name: /Cập nhật mật khẩu mới/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Mật khẩu phải có ít nhất 6 ký tự.')
    })
  })
})
