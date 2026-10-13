import React from 'react'
import { AuthContext } from '../auth/auth-context'
import type { AuthContextValue } from '../auth/auth.types'
import { createMockAuthContext } from './authTestContext'

export const TestAuthProvider: React.FC<{
  value?: AuthContextValue
  children: React.ReactNode
}> = ({ value, children }) => {
  const contextValue = value || createMockAuthContext()
  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}
