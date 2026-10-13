import React, { useEffect, useState, useMemo, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabaseClient } from '../lib/supabase/client'
import { AuthContext } from './auth-context'
import type { AuthStatus, SignUpResult, AuthContextValue } from './auth.types'
import { setAuthRequiredHandler } from '../api/client'

export interface AuthProviderProps {
  children: React.ReactNode
  onAuthRequired?: () => void
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, onAuthRequired }) => {
  const [status, setStatus] = useState<AuthStatus>('initializing')
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)

  const supabase = useMemo(() => getSupabaseClient(), [])

  useEffect(() => {
    let isMounted = true

    // 1. Initial session restoration
    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return
      if (error || !data.session) {
        setSession(null)
        setUser(null)
        setStatus('unauthenticated')
      } else {
        setSession(data.session)
        setUser(data.session.user)
        setStatus('authenticated')
      }
    }).catch(() => {
      if (isMounted) {
        setSession(null)
        setUser(null)
        setStatus('unauthenticated')
      }
    })

    // 2. Auth state subscription
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!isMounted) return
      if (currentSession) {
        setSession(currentSession)
        setUser(currentSession.user)
        setStatus('authenticated')
      } else {
        setSession(null)
        setUser(null)
        setStatus('unauthenticated')
      }
    })

    // 3. Register controlled 401 re-auth handler
    setAuthRequiredHandler(() => {
      // Clear rejected session from local browser storage without remote signout call
      void supabase.auth.signOut({ scope: 'local' }).catch(() => {})

      if (!isMounted) return
      setSession(null)
      setUser(null)
      setStatus('unauthenticated')
      if (onAuthRequired) {
        onAuthRequired()
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
      setAuthRequiredHandler(null)
    }
  }, [supabase, onAuthRequired])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      })

      if (error) {
        throw error
      }

      if (!data.session || !data.user) {
        throw new Error('Đăng nhập không thành công. Vui lòng thử lại.')
      }

      setSession(data.session)
      setUser(data.user)
      setStatus('authenticated')

      return { user: data.user, session: data.session }
    },
    [supabase]
  )

  const signUp = useCallback(
    async (email: string, password: string): Promise<SignUpResult> => {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: redirectTo
        }
      })

      if (error) {
        throw error
      }

      const hasSession = !!data.session
      if (hasSession) {
        setSession(data.session)
        setUser(data.user)
        setStatus('authenticated')
      }

      return {
        user: data.user,
        session: data.session,
        requiresEmailConfirmation: !hasSession
      }
    },
    [supabase]
  )

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } finally {
      setSession(null)
      setUser(null)
      setStatus('unauthenticated')
    }
  }, [supabase])

  const requestPasswordReset = useCallback(
    async (email: string) => {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo
      })

      if (error) {
        throw error
      }
    },
    [supabase]
  )

  const updatePassword = useCallback(
    async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        throw error
      }
    },
    [supabase]
  )

  const contextValue: AuthContextValue = useMemo(
    () => ({
      status,
      user,
      session,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword
    }),
    [status, user, session, signIn, signUp, signOut, requestPasswordReset, updatePassword]
  )

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}
