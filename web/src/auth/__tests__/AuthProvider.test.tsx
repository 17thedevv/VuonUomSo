import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import React, { StrictMode } from 'react'
import { AuthProvider } from '../AuthProvider'
import { useAuth } from '../useAuth'
import * as supabaseModule from '../../lib/supabase/client'

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

    vi.spyOn(supabaseModule, 'getSupabaseClient').mockReturnValue({
      auth: {
        getSession: mockGetSession,
        onAuthStateChange: mockOnAuthStateChange,
        signInWithPassword: mockSignInWithPassword,
        signUp: mockSignUp,
        signOut: mockSignOut,
        resetPasswordForEmail: mockResetPasswordForEmail
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
})
