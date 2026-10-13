export interface WebEnv {
  apiBaseUrl: string
  supabaseUrl: string
  supabasePublishableKey: string
  appEnv: 'development' | 'staging' | 'production' | 'test'
}

const SUPPORTED_ENVS = ['development', 'staging', 'production', 'test'] as const

/**
 * Validates raw environment configuration against the strict public client contract.
 * - Fails fast when any of the 4 required variables is missing outside test mode.
 * - Validates API URL format and rejects embedded credentials.
 * - Validates supported app environments.
 */
export function validateWebEnv(
  rawEnv: {
    VITE_API_BASE_URL?: string
    VITE_SUPABASE_URL?: string
    VITE_SUPABASE_PUBLISHABLE_KEY?: string
    VITE_APP_ENV?: string
  },
  isTest = false
): WebEnv {
  const rawApiBaseUrl = (rawEnv.VITE_API_BASE_URL || '').trim()
  const rawSupabaseUrl = (rawEnv.VITE_SUPABASE_URL || '').trim()
  const rawPublishableKey = (rawEnv.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()
  const rawAppEnv = (rawEnv.VITE_APP_ENV || '').trim()

  // 1. Validate VITE_API_BASE_URL
  if (!rawApiBaseUrl) {
    if (!isTest) {
      throw new Error(
        'Thiếu cấu hình VITE_API_BASE_URL. Vui lòng kiểm tra file .env dựa theo .env.example.'
      )
    }
  }

  let normalizedApiBaseUrl = isTest ? 'http://localhost:3000' : ''
  if (rawApiBaseUrl) {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(rawApiBaseUrl)
    } catch {
      throw new Error(
        `Biến môi trường VITE_API_BASE_URL không hợp lệ (${rawApiBaseUrl}). Phải là một URL hợp lệ.`
      )
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(
        `Giao thức VITE_API_BASE_URL không hợp lệ (${parsedUrl.protocol}). Chỉ chấp nhận http: hoặc https:.`
      )
    }

    if (parsedUrl.username || parsedUrl.password) {
      throw new Error(
        'VITE_API_BASE_URL không được chứa thông tin đăng nhập (username hoặc password).'
      )
    }

    const cleanPath = parsedUrl.pathname === '/' ? '' : parsedUrl.pathname.replace(/\/+$/, '')
    normalizedApiBaseUrl = `${parsedUrl.origin}${cleanPath}`
  }

  // 2. Validate VITE_SUPABASE_URL
  if (!rawSupabaseUrl) {
    if (!isTest) {
      throw new Error(
        'Thiếu cấu hình VITE_SUPABASE_URL. Vui lòng kiểm tra file .env dựa theo .env.example.'
      )
    }
  }

  let normalizedSupabaseUrl = isTest ? 'https://test-project.supabase.co' : ''
  if (rawSupabaseUrl) {
    let parsed: URL
    try {
      parsed = new URL(rawSupabaseUrl)
    } catch {
      throw new Error(
        `Biến môi trường VITE_SUPABASE_URL không hợp lệ (${rawSupabaseUrl}). Phải là một URL hợp lệ.`
      )
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(
        `Giao thức VITE_SUPABASE_URL không hợp lệ (${parsed.protocol}). Chỉ chấp nhận http: hoặc https:.`
      )
    }
    normalizedSupabaseUrl = parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, ''))
  }

  // 3. Validate VITE_SUPABASE_PUBLISHABLE_KEY
  if (!rawPublishableKey) {
    if (!isTest) {
      throw new Error(
        'Thiếu cấu hình VITE_SUPABASE_PUBLISHABLE_KEY. Vui lòng kiểm tra file .env dựa theo .env.example.'
      )
    }
  }
  const publishableKey = rawPublishableKey || (isTest ? 'test-anon-key' : '')

  // 4. Validate VITE_APP_ENV
  if (!rawAppEnv) {
    if (!isTest) {
      throw new Error(
        'Thiếu cấu hình VITE_APP_ENV. Vui lòng kiểm tra file .env dựa theo .env.example.'
      )
    }
  }

  const appEnvCandidate = rawAppEnv || (isTest ? 'test' : '')
  if (
    !SUPPORTED_ENVS.includes(appEnvCandidate as (typeof SUPPORTED_ENVS)[number])
  ) {
    throw new Error(
      `Biến môi trường VITE_APP_ENV không hợp lệ (${appEnvCandidate}). Chỉ chấp nhận: development, staging, production.`
    )
  }

  return {
    apiBaseUrl: normalizedApiBaseUrl,
    supabaseUrl: normalizedSupabaseUrl,
    supabasePublishableKey: publishableKey,
    appEnv: appEnvCandidate as WebEnv['appEnv']
  }
}

/**
 * Returns the validated public client environment configuration.
 * Never exposes service-role keys, database URLs, or signing secrets.
 */
export function getWebEnv(): WebEnv {
  const isTest = import.meta.env.MODE === 'test'
  return validateWebEnv(import.meta.env, isTest)
}
