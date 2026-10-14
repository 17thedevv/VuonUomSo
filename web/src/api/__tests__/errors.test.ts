import { describe, it, expect } from 'vitest'
import { parseApiError, ClientErrorCodes } from '../errors'

describe('parseApiError', () => {
  it('parses standard canonical V3 JSON error envelope', () => {
    const rawBody = {
      error: {
        code: 'VERSION_CONFLICT',
        message: 'Dữ liệu đã thay đổi trên máy chủ.',
        requestId: 'req_12345',
        details: { currentVersion: 2, expectedVersion: 1 }
      }
    }

    const err = parseApiError(409, rawBody, 'req_fallback')
    expect(err.status).toBe(409)
    expect(err.code).toBe('VERSION_CONFLICT')
    expect(err.message).toBe('Dữ liệu đã thay đổi trên máy chủ.')
    expect(err.requestId).toBe('req_12345')
    expect(err.details).toEqual({ currentVersion: 2, expectedVersion: 1 })
  })

  it('falls back to header requestId when response body has none', () => {
    const rawBody = {
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Phiên làm việc đã hết hạn.'
      }
    }

    const err = parseApiError(401, rawBody, 'req_header_999')
    expect(err.status).toBe(401)
    expect(err.code).toBe(ClientErrorCodes.AUTHENTICATION_REQUIRED)
    expect(err.requestId).toBe('req_header_999')
  })

  it('safely degrades non-JSON or HTML 500 responses into generic error without crashing or leaking stack traces', () => {
    const err500 = parseApiError(500, null, 'req_500')
    expect(err500.status).toBe(500)
    expect(err500.code).toBe(ClientErrorCodes.INTERNAL_ERROR)
    expect(err500.message).toContain('máy chủ')
    expect(err500.requestId).toBe('req_500')

    const err404 = parseApiError(404, '<html>Not Found</html>')
    expect(err404.status).toBe(404)
    expect(err404.code).toBe(ClientErrorCodes.RESOURCE_NOT_FOUND)

    const err429 = parseApiError(429, null)
    expect(err429.status).toBe(429)
    expect(err429.code).toBe(ClientErrorCodes.RATE_LIMITED)
  })
})
