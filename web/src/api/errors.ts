export interface ApiErrorEnvelope {
  error: {
    code: string
    message: string
    requestId?: string
    details?: Record<string, unknown>
  }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId?: string
  readonly details?: Record<string, unknown>

  constructor(status: number, code: string, message: string, requestId?: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
    this.details = details
  }
}

export const ClientErrorCodes = {
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  BUSINESS_CONFLICT: 'BUSINESS_CONFLICT',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const

export type ClientErrorCode = typeof ClientErrorCodes[keyof typeof ClientErrorCodes] | string

/**
 * Parses a fetch Response and its parsed JSON or text payload into a structured ApiError.
 * Never leaks stack traces or unhandled runtime crash information to caller.
 */
export function parseApiError(status: number, body: unknown, requestIdHeader?: string | null): ApiError {
  if (
    body &&
    typeof body === 'object' &&
    'error' in body &&
    typeof (body as any).error === 'object' &&
    (body as any).error !== null
  ) {
    const errObj = (body as ApiErrorEnvelope).error
    const code = errObj.code || (status === 401 ? ClientErrorCodes.AUTHENTICATION_REQUIRED : ClientErrorCodes.UNKNOWN_ERROR)
    const message = errObj.message || 'Yêu cầu không thành công.'
    const requestId = errObj.requestId || requestIdHeader || undefined
    const details = errObj.details

    return new ApiError(status, code, message, requestId, details)
  }

  // Fallback for non-standard or HTML error responses
  let fallbackMessage = 'Đã có lỗi xảy ra từ máy chủ.'
  let fallbackCode: string = ClientErrorCodes.INTERNAL_ERROR

  if (status === 401) {
    fallbackCode = ClientErrorCodes.AUTHENTICATION_REQUIRED
    fallbackMessage = 'Yêu cầu đăng nhập hoặc phiên làm việc đã hết hạn.'
  } else if (status === 403) {
    fallbackCode = ClientErrorCodes.PERMISSION_DENIED
    fallbackMessage = 'Bạn không có quyền thực hiện thao tác này.'
  } else if (status === 404) {
    fallbackCode = ClientErrorCodes.RESOURCE_NOT_FOUND
    fallbackMessage = 'Không tìm thấy tài nguyên yêu cầu.'
  } else if (status === 409) {
    fallbackCode = ClientErrorCodes.BUSINESS_CONFLICT
    fallbackMessage = 'Dữ liệu bị xung đột hoặc đã được thay đổi.'
  } else if (status === 429) {
    fallbackCode = ClientErrorCodes.RATE_LIMITED
    fallbackMessage = 'Quá nhiều yêu cầu. Vui lòng thử lại sau.'
  }

  return new ApiError(status, fallbackCode, fallbackMessage, requestIdHeader || undefined)
}
