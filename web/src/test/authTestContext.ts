import type { AuthContextValue } from '../auth/auth.types'
import { vi } from 'vitest'

export const createMockAuthContext = (overrides?: Partial<AuthContextValue>): AuthContextValue => ({
  status: 'authenticated',
  user: {
    id: 'test-user-id',
    email: 'test@vuonuom.local',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString()
  } as any,
  session: {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'test-user-id',
      email: 'test@vuonuom.local',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString()
    } as any
  },
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  ...overrides
})
