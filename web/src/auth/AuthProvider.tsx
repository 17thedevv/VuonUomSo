import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
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
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  const currentSessionRef = useRef<Session | null>(null)
  const supabase = useMemo(() => getSupabaseClient(), [])

  useEffect(() => {
    let isMounted = true

    // 1. Initial session restoration
    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return
      if (error || !data.session) {
        currentSessionRef.current = null
        setSession(null)
        setUser(null)
        setStatus('unauthenticated')
      } else {
        currentSessionRef.current = data.session
        setSession(data.session)
        setUser(data.session.user)
        setStatus('authenticated')
      }
    }).catch(() => {
      if (isMounted) {
        currentSessionRef.current = null
        setSession(null)
        setUser(null)
        setStatus('unauthenticated')
      }
    })

    // 2. Auth state subscription (handles canonical PASSWORD_RECOVERY event)
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!isMounted) return

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
      }

      currentSessionRef.current = currentSession
      if (currentSession) {
        setSession(currentSession)
        setUser(currentSession.user)
        setStatus('authenticated')
      } else {
        setSession(null)
        setUser(null)
        setStatus('unauthenticated')
        setIsPasswordRecovery(false)
      }
    })

    // 3. Register controlled 401 re-auth handler correlated with sent token
    setAuthRequiredHandler(async (_error, rejectedToken) => {
      const activeToken = currentSessionRef.current?.access_token

      // Stale 401 check: if request was sent with a token but the active session
      // has already switched to a different token, ignore to avoid logging out a newer session
      if (rejectedToken && activeToken && rejectedToken !== activeToken) {
        return
      }

      // If request had no token but active session exists, do not kill valid session
      if (!rejectedToken && activeToken) {
        return
      }

      // Verify against Supabase client in case of concurrent token refresh
      const { data: latest } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
      const latestToken = latest.session?.access_token
      if (rejectedToken && latestToken && rejectedToken !== latestToken) {
        return
      }

      // End current session locally and clean local session persistence
      void supabase.auth.signOut({ scope: 'local' }).catch(() => {})

      currentSessionRef.current = null
      if (!isMounted) return
      setSession(null)
      setUser(null)
      setStatus('unauthenticated')
      setIsPasswordRecovery(false)
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

      currentSessionRef.current = data.session
      setSession(data.session)
      setUser(data.user)
      setStatus('authenticated')
      setIsPasswordRecovery(false)

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
        currentSessionRef.current = data.session
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
      currentSessionRef.current = null
      setSession(null)
      setUser(null)
      setStatus('unauthenticated')
      setIsPasswordRecovery(false)
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
      setIsPasswordRecovery(false)
    },
    [supabase]
  )

  const contextValue: AuthContextValue = useMemo(
    () => ({
      status,
      user,
      session,
      isPasswordRecovery,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword
    }),
    [status, user, session, isPasswordRecovery, signIn, signUp, signOut, requestPasswordReset, updatePassword]
  )

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}
