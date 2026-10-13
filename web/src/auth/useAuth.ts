import { useContext } from 'react'
import { AuthContext } from './auth-context'
import type { AuthContextValue } from './auth.types'

/**
 * Hook to access client authentication context.
 * Fails closed with an explicit error when invoked outside AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
