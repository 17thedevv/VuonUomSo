import { describe, it, expect, beforeEach } from 'vitest'
import { getSupabaseClient, resetSupabaseClient } from '../client'
import { getWebEnv } from '../../env'

describe('Supabase client bootstrap', () => {
  beforeEach(() => {
    resetSupabaseClient()
  })

  it('reads public environment variables and instantiates singleton client', () => {
    const env = getWebEnv()
    expect(env.supabaseUrl).toBeDefined()
    expect(env.supabasePublishableKey).toBeDefined()

    const client1 = getSupabaseClient()
    const client2 = getSupabaseClient()

    expect(client1).toBe(client2)
    expect(client1.auth).toBeDefined()
  })

  it('does not reference or require server-only secrets or service-role keys', () => {
    const env = getWebEnv()
    expect((env as any).DATABASE_URL).toBeUndefined()
    expect((env as any).serviceRoleKey).toBeUndefined()
    expect((env as any).JWT_SECRET).toBeUndefined()
    expect((env as any).SYNC_CURSOR_HMAC_KEY).toBeUndefined()
  })

  it('allows overriding client configuration for testing', () => {
    const customClient = getSupabaseClient({
      supabaseUrl: 'https://custom-test.supabase.co',
      supabasePublishableKey: 'custom-key'
    })
    expect(customClient).toBeDefined()
  })
})
