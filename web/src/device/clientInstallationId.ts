import { getWebEnv } from '../lib/env'

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function generateRandomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Cryptographically secure fallback if crypto.randomUUID is unavailable
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    // Set version to 4
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    // Set variant to RFC 4122
    bytes[8] = (bytes[8] & 0x3f) | 0x80

    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
  }

  throw new Error('Môi trường trình duyệt không hỗ trợ Web Cryptography API.')
}

export function getInstallationStorageKey(appEnv?: string): string {
  const env = appEnv || getWebEnv().appEnv
  return `vuonuom:${env}:clientInstallationId`
}

export function isValidInstallationId(id: unknown): id is string {
  return typeof id === 'string' && UUID_V4_REGEX.test(id)
}

/**
 * Returns a stable, cryptographically random installation UUID for this browser/PWA profile.
 * - Namespaced per environment.
 * - Regenerates safely if missing or malformed.
 * - Never collects hardware, IMEI, or device fingerprints.
 */
export function getOrCreateClientInstallationId(storage?: Storage, appEnv?: string): string {
  const targetStorage = storage || (typeof window !== 'undefined' ? window.localStorage : null)
  const key = getInstallationStorageKey(appEnv)

  if (!targetStorage) {
    return generateRandomUuid()
  }

  try {
    const existing = targetStorage.getItem(key)
    if (existing && isValidInstallationId(existing)) {
      return existing
    }

    const newId = generateRandomUuid()
    targetStorage.setItem(key, newId)
    return newId
  } catch {
    // If localStorage is disabled or throws (e.g. private browsing storage quota), return ephemeral UUID
    return generateRandomUuid()
  }
}
