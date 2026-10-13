import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getWebEnv, type WebEnv } from '../env'

let supabaseInstance: SupabaseClient | null = null

export interface SupabaseClientConfig {
  supabaseUrl?: string
  supabasePublishableKey?: string
}

/**
 * Creates or retrieves the singleton Supabase browser client.
 * Uses only public publishable key and standard browser session persistence.
 */
export function getSupabaseClient(config?: SupabaseClientConfig): SupabaseClient {
  if (supabaseInstance && !config) {
    return supabaseInstance
  }

  const env: WebEnv = getWebEnv()
  const url = config?.supabaseUrl || env.supabaseUrl
  const key = config?.supabasePublishableKey || env.supabasePublishableKey

  const client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: `vuonuom:${env.appEnv}:supabase.auth.token`
    }
  })

  if (!config) {
    supabaseInstance = client
  }

  return client
}

/**
 * Helper to reset singleton instance (useful in test teardowns).
 */
export function resetSupabaseClient(): void {
  supabaseInstance = null
}
