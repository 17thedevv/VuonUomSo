import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthBoundary } from '../AuthBoundary'
import { AuthContext } from '../auth-context'
import type { AuthContextValue } from '../auth.types'

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

describe('AuthBoundary Route Guard', () => {
  it('renders loading indicator and does not leak protected content while initializing', () => {
    const mockAuth = createMockAuthContext({ status: 'initializing' })

    render(
      <AuthContext.Provider value={mockAuth}>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route element={<AuthBoundary />}>
              <Route path="/protected" element={<div>Protected Secret UI</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(screen.getByText('Đang kiểm tra phiên đăng nhập...')).toBeInTheDocument()
    expect(screen.queryByText('Protected Secret UI')).not.toBeInTheDocument()
  })

  it('redirects unauthenticated users to /login preserving redirect intent', () => {
    const mockAuth = createMockAuthContext({ status: 'unauthenticated' })

    render(
      <AuthContext.Provider value={mockAuth}>
        <MemoryRouter initialEntries={['/protected?param=123']}>
          <Routes>
            <Route element={<AuthBoundary />}>
              <Route path="/protected" element={<div>Protected Secret UI</div>} />
            </Route>
            <Route path="/login" element={<div>Login Screen Dummy</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(screen.getByText('Login Screen Dummy')).toBeInTheDocument()
    expect(screen.queryByText('Protected Secret UI')).not.toBeInTheDocument()
  })

  it('permits authenticated users to access protected content', () => {
    const mockAuth = createMockAuthContext({
      status: 'authenticated',
      user: { id: 'u1', email: 'owner@garden.vn' } as any,
      session: { access_token: 'token' } as any
    })

    render(
      <AuthContext.Provider value={mockAuth}>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route element={<AuthBoundary />}>
              <Route path="/protected" element={<div>Protected Secret UI</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(screen.getByText('Protected Secret UI')).toBeInTheDocument()
  })
})
