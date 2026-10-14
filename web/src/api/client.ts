import { getWebEnv } from '../lib/env'
import { getSupabaseClient } from '../lib/supabase/client'
import { ApiError, ClientErrorCodes, parseApiError } from './errors'

export interface ApiClientOptions extends RequestInit {
  skipAuth?: boolean
}

export type AuthRequiredHandler = (error: ApiError, rejectedToken?: string) => void

let authRequiredHandler: AuthRequiredHandler | null = null

/**
 * Registers a global callback when an authenticated API call encounters a 401 AUTHENTICATION_REQUIRED response.
 */
export function setAuthRequiredHandler(handler: AuthRequiredHandler | null): void {
  authRequiredHandler = handler
}

/**
 * Resolves a full request URL against the configured API base origin.
 * Guarantees that requests target only the trusted configured host and prefix.
 * Caller cannot override the trusted origin.
 */
export function resolveApiUrl(path: string): URL {
  const env = getWebEnv()
  const base = env.apiBaseUrl

  // If path is already an absolute URL, check that its origin matches the API base origin
  if (path.startsWith('http://') || path.startsWith('https://')) {
    const targetUrl = new URL(path)
    const expectedOrigin = new URL(base).origin
    if (targetUrl.origin !== expectedOrigin) {
      throw new Error(`Security boundary violation: không được gửi yêu cầu API đến origin lạ (${targetUrl.origin}).`)
    }
    return targetUrl
  }

  // Ensure base has no trailing slash and path has leading slash
  const cleanBase = base.replace(/\/+$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return new URL(`${cleanBase}${cleanPath}`)
}

/**
 * Canonical V3 API fetch wrapper.
 * - Attaches Bearer token from the active Supabase session when available.
 * - Strictly enforces origin boundaries against canonical VITE_API_BASE_URL.
 * - Parses and normalizes V3 ApiError.
 * - Handles 401 responses with a controlled re-auth callback (correlated to sent token).
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiClientOptions = {}
): Promise<T> {
  // Reject foreign origins BEFORE touching tokens or network
  const targetUrl = resolveApiUrl(path)
  const headers = new Headers(options.headers || {})

  headers.set('Accept', 'application/json')
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let sentToken: string | undefined

  // Attach token if not explicitly skipped
  if (!options.skipAuth) {
    try {
      const supabase = getSupabaseClient()
      const { data } = await supabase.auth.getSession()
      sentToken = data.session?.access_token

      if (sentToken) {
        headers.set('Authorization', `Bearer ${sentToken}`)
      }
    } catch {
      // If fetching session fails (e.g. offline/storage error), proceed without token
    }
  }

  let response: Response
  try {
    response = await fetch(targetUrl.toString(), {
      ...options,
      headers
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Lỗi kết nối mạng.'
    throw new ApiError(0, ClientErrorCodes.NETWORK_ERROR, `Không thể kết nối đến máy chủ: ${errorMsg}`)
  }

  const requestIdHeader = response.headers.get('x-request-id')

  if (!response.ok) {
    let responseBody: unknown = null
    try {
      const text = await response.text()
      responseBody = JSON.parse(text)
    } catch {
      // Non-JSON error body handled by parser fallback
    }

    const apiError = parseApiError(response.status, responseBody, requestIdHeader)

    // Controlled 401 handler correlated with the rejected token
    if (response.status === 401 && authRequiredHandler) {
      try {
        authRequiredHandler(apiError, sentToken)
      } catch {
        // Prevent listener crashes from masking the API error
      }
    }

    throw apiError
  }

  if (response.status === 204) {
    return undefined as unknown as T
  }

  try {
    return (await response.json()) as T
  } catch {
    return undefined as unknown as T
  }
}
