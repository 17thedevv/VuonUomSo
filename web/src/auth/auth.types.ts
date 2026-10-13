import type { Session, User } from '@supabase/supabase-js'

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated'

export interface SignUpResult {
  user: User | null
  session: Session | null
  requiresEmailConfirmation: boolean
}

export interface AuthContextValue {
  status: AuthStatus
  user: User | null
  session: Session | null
  signIn: (email: string, password: string) => Promise<{ user: User; session: Session }>
  signUp: (email: string, password: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
}
