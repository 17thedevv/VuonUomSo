import { describe, it, expect } from 'vitest'
import { validateWebEnv } from '../env'

describe('validateWebEnv', () => {
  const validRawEnv = {
    VITE_API_BASE_URL: 'https://api.vuonuom.local/v3',
    VITE_SUPABASE_URL: 'https://test-project.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sbp_test_publishable_key_123',
    VITE_APP_ENV: 'staging'
  }

  it('parses valid environment configuration correctly', () => {
    const config = validateWebEnv(validRawEnv, false)
    expect(config.apiBaseUrl).toBe('https://api.vuonuom.local/v3')
    expect(config.supabaseUrl).toBe('https://test-project.supabase.co')
    expect(config.supabasePublishableKey).toBe('sbp_test_publishable_key_123')
    expect(config.appEnv).toBe('staging')
  })

  it('fails fast on missing VITE_API_BASE_URL outside test mode', () => {
    expect(() =>
      validateWebEnv({ ...validRawEnv, VITE_API_BASE_URL: '' }, false)
    ).toThrow(/Thiếu cấu hình VITE_API_BASE_URL/)
  })

  it('fails fast on missing VITE_SUPABASE_URL outside test mode', () => {
    expect(() =>
      validateWebEnv({ ...validRawEnv, VITE_SUPABASE_URL: '' }, false)
    ).toThrow(/Thiếu cấu hình VITE_SUPABASE_URL/)
  })

  it('fails fast on missing VITE_SUPABASE_PUBLISHABLE_KEY outside test mode', () => {
    expect(() =>
      validateWebEnv({ ...validRawEnv, VITE_SUPABASE_PUBLISHABLE_KEY: '' }, false)
    ).toThrow(/Thiếu cấu hình VITE_SUPABASE_PUBLISHABLE_KEY/)
  })

  it('fails fast on missing VITE_APP_ENV outside test mode', () => {
    expect(() =>
      validateWebEnv({ ...validRawEnv, VITE_APP_ENV: '' }, false)
    ).toThrow(/Thiếu cấu hình VITE_APP_ENV/)
  })

  it('rejects malformed API URL', () => {
    expect(() =>
      validateWebEnv({ ...validRawEnv, VITE_API_BASE_URL: 'not-a-valid-url' }, false)
    ).toThrow(/Biến môi trường VITE_API_BASE_URL không hợp lệ/)
  })

  it('rejects unsupported protocols', () => {
    expect(() =>
      validateWebEnv({ ...validRawEnv, VITE_API_BASE_URL: 'ftp://api.vuonuom.local' }, false)
    ).toThrow(/Giao thức VITE_API_BASE_URL không hợp lệ/)

    expect(() =>
      validateWebEnv({ ...validRawEnv, VITE_SUPABASE_URL: 'ftp://test.supabase.co' }, false)
    ).toThrow(/Giao thức VITE_SUPABASE_URL không hợp lệ/)
  })

  it('rejects embedded credentials in API URL', () => {
    expect(() =>
      validateWebEnv(
        { ...validRawEnv, VITE_API_BASE_URL: 'https://user:password@api.vuonuom.local' },
        false
      )
    ).toThrow(/không được chứa thông tin đăng nhập/)
  })

  it('rejects invalid VITE_APP_ENV values', () => {
    expect(() =>
      validateWebEnv({ ...validRawEnv, VITE_APP_ENV: 'qa_cluster' }, false)
    ).toThrow(/Biến môi trường VITE_APP_ENV không hợp lệ/)
  })

  it('normalizes trailing slashes on API and Supabase URLs', () => {
    const config = validateWebEnv(
      {
        ...validRawEnv,
        VITE_API_BASE_URL: 'https://api.vuonuom.local///',
        VITE_SUPABASE_URL: 'https://test-project.supabase.co///'
      },
      false
    )
    expect(config.apiBaseUrl).toBe('https://api.vuonuom.local')
    expect(config.supabaseUrl).toBe('https://test-project.supabase.co')
  })

  it('provides safe test defaults when isTest is true and env vars are omitted', () => {
    const testConfig = validateWebEnv({}, true)
    expect(testConfig.apiBaseUrl).toBe('http://localhost:3000')
    expect(testConfig.supabaseUrl).toBe('https://test-project.supabase.co')
    expect(testConfig.supabasePublishableKey).toBe('test-anon-key')
    expect(testConfig.appEnv).toBe('test')
  })
})
