import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { useAuth } from '../useAuth'
import { AuthBoundary } from '../AuthBoundary'
import { TestAuthProvider } from '../../test/authTestHelper'
import { createMockAuthContext } from '../../test/authTestContext'

const DummyConsumer: React.FC = () => {
  const auth = useAuth()
  return <div>Authenticated email: {auth.user?.email}</div>
}

describe('useAuth hook fail-closed behavior', () => {
  it('throws explicit error when invoked outside AuthProvider without fallback mock', () => {
    expect(() => {
      render(<DummyConsumer />)
    }).toThrow('useAuth must be used within an AuthProvider')
  })

  it('fails closed and prevents AuthBoundary from rendering protected UI without provider', () => {
    expect(() => {
      render(
        <AuthBoundary>
          <div>Protected Content</div>
        </AuthBoundary>
      )
    }).toThrow('useAuth must be used within an AuthProvider')
  })

  it('succeeds when explicitly wrapped with TestAuthProvider', () => {
    const mockContext = createMockAuthContext({
      status: 'authenticated',
      user: { id: 'u-123', email: 'verified@vuonuom.local' } as any
    })

    const { getByText } = render(
      <TestAuthProvider value={mockContext}>
        <DummyConsumer />
      </TestAuthProvider>
    )

    expect(getByText('Authenticated email: verified@vuonuom.local')).toBeInTheDocument()
  })
})
