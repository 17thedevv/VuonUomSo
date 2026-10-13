export interface WebEnv {
  apiBaseUrl: string
  supabaseUrl: string
  supabasePublishableKey: string
  appEnv: string
}

/**
 * Validates and returns the public client environment configuration.
 * Never exposes service-role keys, database URLs, or signing secrets.
 */
export function getWebEnv(): WebEnv {
  const isTest = import.meta.env.MODE === 'test'

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim()
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
  const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()
  const appEnv = (import.meta.env.VITE_APP_ENV || (isTest ? 'test' : 'development')).trim()

  if (!supabaseUrl && !isTest) {
    throw new Error(
      'Thiếu cấu hình VITE_SUPABASE_URL. Vui lòng kiểm tra file .env dựa theo .env.example.'
    )
  }

  if (!supabasePublishableKey && !isTest) {
    throw new Error(
      'Thiếu cấu hình VITE_SUPABASE_PUBLISHABLE_KEY. Vui lòng kiểm tra file .env dựa theo .env.example.'
    )
  }

  return {
    apiBaseUrl: apiBaseUrl || (typeof window !== 'undefined' ? window.location.origin : ''),
    supabaseUrl: supabaseUrl || 'https://test-project.supabase.co',
    supabasePublishableKey: supabasePublishableKey || 'test-anon-key',
    appEnv
  }
}
