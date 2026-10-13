import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { apiFetch, setAuthRequiredHandler, resolveApiUrl } from '../client'
import { ApiError, ClientErrorCodes } from '../errors'
import * as supabaseModule from '../../lib/supabase/client'

describe('apiFetch client wrapper', () => {
  const originalFetch = globalThis.fetch
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    globalThis.fetch = mockFetch as any
    setAuthRequiredHandler(null)
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('enforces immutable API origin signature contract', () => {
    expect(resolveApiUrl.length).toBe(1)
    expect(apiFetch.length).toBeLessThanOrEqual(2)
  })

  it('resolves API URLs correctly and blocks foreign origins', () => {
    const validUrl = resolveApiUrl('/v3/me')
    expect(validUrl.toString()).toBe('http://localhost:3000/v3/me')

    // Matching full URL passes
    const fullMatching = resolveApiUrl('http://localhost:3000/v3/me')
    expect(fullMatching.toString()).toBe('http://localhost:3000/v3/me')

    // Foreign origin throws boundary error
    expect(() => {
      resolveApiUrl('https://malicious-site.com/v3/me')
    }).toThrow(/Security boundary violation/)
  })

  it('rejects foreign origin requests BEFORE reading session or firing network request', async () => {
    const getSessionSpy = vi.fn()
    vi.spyOn(supabaseModule, 'getSupabaseClient').mockReturnValue({
      auth: {
        getSession: getSessionSpy
      }
    } as any)

    await expect(apiFetch('https://evil.example/collect')).rejects.toThrow(
      /Security boundary violation/
    )

    // Token must not be leaked / read
    expect(getSessionSpy).not.toHaveBeenCalled()
    // Network request must not be dispatched
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('attaches Bearer access token when session is present', async () => {
    vi.spyOn(supabaseModule, 'getSupabaseClient').mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: { access_token: 'test-supabase-jwt-token' }
          }
        })
      }
    } as any)

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: 'success' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    const result = await apiFetch<{ data: string }>('/v3/me')

    expect(result).toEqual({ data: 'success' })
    expect(mockFetch).toHaveBeenCalledTimes(1)

    const [, options] = mockFetch.mock.calls[0]
    const headers = options.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer test-supabase-jwt-token')
    expect(headers.get('Accept')).toBe('application/json')
  })

  it('does not attach Bearer token when skipAuth is true', async () => {
    const getSessionSpy = vi.fn()
    vi.spyOn(supabaseModule, 'getSupabaseClient').mockReturnValue({
      auth: {
        getSession: getSessionSpy
      }
    } as any)

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: 'public' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    const result = await apiFetch<{ data: string }>('/v3/public', { skipAuth: true })

    expect(result).toEqual({ data: 'public' })
    expect(getSessionSpy).not.toHaveBeenCalled()
    const [, options] = mockFetch.mock.calls[0]
    const headers = options.headers as Headers
    expect(headers.get('Authorization')).toBeNull()
  })

  it('triggers 401 re-auth handler exactly once when server rejects credentials', async () => {
    vi.spyOn(supabaseModule, 'getSupabaseClient').mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'expired-token' } }
        })
      }
    } as any)

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Mã xác thực không hợp lệ.',
            requestId: 'req_401'
          }
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    )

    const reAuthSpy = vi.fn()
    setAuthRequiredHandler(reAuthSpy)

    await expect(apiFetch('/v3/me')).rejects.toThrow(ApiError)

    expect(reAuthSpy).toHaveBeenCalledTimes(1)
    const passedError = reAuthSpy.mock.calls[0][0] as ApiError
    expect(passedError.status).toBe(401)
    expect(passedError.code).toBe('AUTHENTICATION_REQUIRED')
  })

  it('does NOT trigger 401 re-auth handler for 403 PERMISSION_DENIED responses', async () => {
    vi.spyOn(supabaseModule, 'getSupabaseClient').mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'valid-token' } }
        })
      }
    } as any)

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Không đủ quyền thực hiện.'
          }
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    )

    const reAuthSpy = vi.fn()
    setAuthRequiredHandler(reAuthSpy)

    await expect(apiFetch('/v3/garden/protected')).rejects.toThrow(ApiError)

    expect(reAuthSpy).not.toHaveBeenCalled()
  })

  it('handles 204 No Content gracefully', async () => {
    vi.spyOn(supabaseModule, 'getSupabaseClient').mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } })
      }
    } as any)

    mockFetch.mockResolvedValueOnce(
      new Response(null, {
        status: 204
      })
    )

    const res = await apiFetch('/v3/action')
    expect(res).toBeUndefined()
  })

  it('maps network failures to ClientErrorCodes.NETWORK_ERROR', async () => {
    vi.spyOn(supabaseModule, 'getSupabaseClient').mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } })
      }
    } as any)

    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    try {
      await apiFetch('/v3/test')
      expect.unreachable('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.code).toBe(ClientErrorCodes.NETWORK_ERROR)
      expect(apiErr.message).toContain('Không thể kết nối')
    }
  })
})
