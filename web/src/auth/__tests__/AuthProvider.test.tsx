import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import React, { StrictMode } from 'react'
import { AuthProvider } from '../AuthProvider'
import { useAuth } from '../useAuth'
import * as supabaseModule from '../../lib/supabase/client'
import { apiFetch } from '../../api/client'
import { ApiError } from '../../api/errors'

const TestConsumer: React.FC = () => {
  const { status, user, session, signIn, signUp, signOut, requestPasswordReset } = useAuth()

  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="user-email">{user?.email || 'no-user'}</div>
      <div data-testid="has-session">{session ? 'yes' : 'no'}</div>
      <button onClick={() => signIn('user@example.com', 'password123')}>Đăng nhập</button>
      <button onClick={() => signUp('new@example.com', 'password123')}>Đăng ký</button>
      <button onClick={() => signOut()}>Đăng xuất</button>
      <button onClick={() => requestPasswordReset('user@example.com')}>Khôi phục</button>
    </div>
  )
}

describe('AuthProvider & Auth Lifecycle', () => {
  let mockGetSession: ReturnType<typeof vi.fn>
  let mockOnAuthStateChange: ReturnType<typeof vi.fn>
  let mockSignInWithPassword: ReturnType<typeof vi.fn>
  let mockSignUp: ReturnType<typeof vi.fn>
  let mockSignOut: ReturnType<typeof vi.fn>
  let mockResetPasswordForEmail: ReturnType<typeof vi.fn>
  let mockUpdateUser: ReturnType<typeof vi.fn>
  let mockUnsubscribe: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockUnsubscribe = vi.fn()
    mockGetSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null })
    mockOnAuthStateChange = vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } }
    })
    mockSignInWithPassword = vi.fn()
    mockSignUp = vi.fn()
    mockSignOut = vi.fn().mockResolvedValue({ error: null })
    mockResetPasswordForEmail = vi.fn().mockResolvedValue({ error: null })
    mockUpdateUser = vi.fn().mockResolvedValue({ data: { user: {} }, error: null })

    vi.spyOn(supabaseModule, 'getSupabaseClient').mockReturnValue({
      auth: {
        getSession: mockGetSession,
        onAuthStateChange: mockOnAuthStateChange,
        signInWithPassword: mockSignInWithPassword,
        signUp: mockSignUp,
        signOut: mockSignOut,
        resetPasswordForEmail: mockResetPasswordForEmail,
        updateUser: mockUpdateUser
      }
    } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('restores unauthenticated state when no session exists', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('unauthenticated')
      expect(screen.getByTestId('user-email').textContent).toBe('no-user')
      expect(screen.getByTestId('has-session').textContent).toBe('no')
    })
  })

  it('restores authenticated state when existing session is present', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'valid-jwt',
          user: { id: 'user-1', email: 'owner@vuonuom.local' }
        }
      },
      error: null
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('authenticated')
      expect(screen.getByTestId('user-email').textContent).toBe('owner@vuonuom.local')
      expect(screen.getByTestId('has-session').textContent).toBe('yes')
    })
  })

  it('cleans up subscriptions properly and does not leak listeners in React StrictMode', async () => {
    const { unmount } = render(
      <StrictMode>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </StrictMode>
    )

    await waitFor(() => {
      expect(mockOnAuthStateChange).toHaveBeenCalled()
    })

    unmount()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  it('updates state upon onAuthStateChange event', async () => {
    let authCallback: ((event: string, session: any) => void) | null = null
    mockOnAuthStateChange.mockImplementation((cb) => {
      authCallback = cb
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('unauthenticated')
    })

    // Simulate login event from Supabase
    act(() => {
      authCallback?.('SIGNED_IN', {
        access_token: 'token-abc',
        user: { id: 'u2', email: 'event-user@example.com' }
      })
    })

    expect(screen.getByTestId('status').textContent).toBe('authenticated')
    expect(screen.getByTestId('user-email').textContent).toBe('event-user@example.com')

    // Simulate signout event
    act(() => {
      authCallback?.('SIGNED_OUT', null)
    })

    expect(screen.getByTestId('status').textContent).toBe('unauthenticated')
    expect(screen.getByTestId('user-email').textContent).toBe('no-user')
  })

  it('handles signIn failure by throwing formatted error', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new Error('Invalid login credentials')
    })

    let caughtError: any = null
    const SignInTest: React.FC = () => {
      const { signIn } = useAuth()
      return (
        <button
          onClick={async () => {
            try {
              await signIn('user@example.com', 'wrong')
            } catch (err) {
              caughtError = err
            }
          }}
        >
          Try Login
        </button>
      )
    }

    render(
      <AuthProvider>
        <SignInTest />
      </AuthProvider>
    )

    const btn = screen.getByText('Try Login')
    await act(async () => {
      btn.click()
    })

    expect(caughtError).toBeInstanceOf(Error)
    expect(caughtError.message).toContain('Invalid login credentials')
  })

  it('signUp flags requiresEmailConfirmation = true when confirm email is enabled', async () => {
    // In Supabase with confirm email on, signUp returns user but session is null
    mockSignUp.mockResolvedValueOnce({
      data: {
        user: { id: 'new-user-1', email: 'new@example.com' },
        session: null
      },
      error: null
    })

    let capturedResult: any = null
    const SignUpCapture: React.FC = () => {
      const { signUp } = useAuth()
      return (
        <button
          onClick={async () => {
            capturedResult = await signUp('new@example.com', 'password123')
          }}
        >
          Do SignUp
        </button>
      )
    }

    render(
      <AuthProvider>
        <SignUpCapture />
      </AuthProvider>
    )

    const btn = screen.getByText('Do SignUp')
    await act(async () => {
      btn.click()
    })

    expect(capturedResult).toEqual({
      user: { id: 'new-user-1', email: 'new@example.com' },
      session: null,
      requiresEmailConfirmation: true
    })
  })

  it('purges persisted session via local signOut and resets status upon 401 re-auth event', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'stale-token',
          user: { id: 'u-1', email: 'owner@vuonuom.local' }
        }
      },
      error: null
    })

    const originalFetch = globalThis.fetch
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Mã xác thực không hợp lệ.'
          }
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    )
    globalThis.fetch = mockFetch as any

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('authenticated')
    })

    // Dispatch an authenticated API request that returns 401
    await act(async () => {
      await expect(apiFetch('/v3/me')).rejects.toThrow(ApiError)
    })

    // Verify local signOut was invoked to purge localStorage persistence
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' })

    // Verify state transitioned to unauthenticated
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('unauthenticated')
      expect(screen.getByTestId('user-email').textContent).toBe('no-user')
      expect(screen.getByTestId('has-session').textContent).toBe('no')
    })

    globalThis.fetch = originalFetch
  })

  it('does NOT call signOut when receiving 403 PERMISSION_DENIED', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'valid-token',
          user: { id: 'u-1', email: 'owner@vuonuom.local' }
        }
      },
      error: null
    })

    const originalFetch = globalThis.fetch
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Không đủ quyền thực hiện.'
          }
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    )
    globalThis.fetch = mockFetch as any

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('authenticated')
    })

    await expect(apiFetch('/v3/garden/restricted')).rejects.toThrow(ApiError)

    expect(mockSignOut).not.toHaveBeenCalled()
    expect(screen.getByTestId('status').textContent).toBe('authenticated')

    globalThis.fetch = originalFetch
  })

  it('calls supabase.auth.updateUser with new password on updatePassword', async () => {
    let capturedError: any = null
    const PasswordTest: React.FC = () => {
      const { updatePassword } = useAuth()
      return (
        <button
          onClick={async () => {
            try {
              await updatePassword('NewSecurePassword123')
            } catch (err) {
              capturedError = err
            }
          }}
        >
          Đổi mật khẩu
        </button>
      )
    }

    render(
      <AuthProvider>
        <PasswordTest />
      </AuthProvider>
    )

    const btn = screen.getByText('Đổi mật khẩu')
    await act(async () => {
      btn.click()
    })

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'NewSecurePassword123' })
    expect(capturedError).toBeNull()
  })

  it('handles canonical PASSWORD_RECOVERY event and sets isPasswordRecovery flag', async () => {
    let authCallback: ((event: string, session: any) => void) | null = null
    mockOnAuthStateChange.mockImplementation((cb) => {
      authCallback = cb
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
    })

    const RecoveryConsumer: React.FC = () => {
      const { status, isPasswordRecovery } = useAuth()
      return (
        <div>
          <div data-testid="status">{status}</div>
          <div data-testid="is-recovery">{isPasswordRecovery ? 'yes' : 'no'}</div>
        </div>
      )
    }

    render(
      <AuthProvider>
        <RecoveryConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('unauthenticated')
      expect(screen.getByTestId('is-recovery').textContent).toBe('no')
    })

    // Supabase client emits canonical PASSWORD_RECOVERY event
    act(() => {
      authCallback?.('PASSWORD_RECOVERY', {
        access_token: 'recovery-token',
        user: { id: 'u-rec', email: 'reset@vuonuom.local' }
      })
    })

    expect(screen.getByTestId('status').textContent).toBe('authenticated')
    expect(screen.getByTestId('is-recovery').textContent).toBe('yes')
  })
})
