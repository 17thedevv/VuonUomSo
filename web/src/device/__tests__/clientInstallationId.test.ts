import { describe, it, expect, beforeEach } from 'vitest'
import {
  getOrCreateClientInstallationId,
  getInstallationStorageKey,
  isValidInstallationId
} from '../clientInstallationId'

describe('clientInstallationId', () => {
  let mockStorage: Record<string, string>
  let testStorage: Storage

  beforeEach(() => {
    mockStorage = {}
    testStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value
      },
      removeItem: (key: string) => {
        delete mockStorage[key]
      },
      clear: () => {
        mockStorage = {}
      },
      key: (i: number) => Object.keys(mockStorage)[i] || null,
      length: 0
    }
  })

  it('generates a valid, cryptographically random UUID v4 on first call', () => {
    const id = getOrCreateClientInstallationId(testStorage, 'test')
    expect(isValidInstallationId(id)).toBe(true)
    expect(testStorage.getItem(getInstallationStorageKey('test'))).toBe(id)
  })

  it('returns the same stable ID on subsequent calls in the same environment', () => {
    const id1 = getOrCreateClientInstallationId(testStorage, 'test')
    const id2 = getOrCreateClientInstallationId(testStorage, 'test')
    expect(id1).toBe(id2)
  })

  it('namespaces storage keys per environment to keep IDs distinct', () => {
    const devId = getOrCreateClientInstallationId(testStorage, 'development')
    const stagingId = getOrCreateClientInstallationId(testStorage, 'staging')

    expect(isValidInstallationId(devId)).toBe(true)
    expect(isValidInstallationId(stagingId)).toBe(true)
    expect(devId).not.toBe(stagingId)

    expect(testStorage.getItem(getInstallationStorageKey('development'))).toBe(devId)
    expect(testStorage.getItem(getInstallationStorageKey('staging'))).toBe(stagingId)
  })

  it('safely regenerates a new UUID if stored value is malformed or invalid', () => {
    testStorage.setItem(getInstallationStorageKey('test'), 'malformed-not-a-uuid')

    const newId = getOrCreateClientInstallationId(testStorage, 'test')
    expect(isValidInstallationId(newId)).toBe(true)
    expect(newId).not.toBe('malformed-not-a-uuid')
    expect(testStorage.getItem(getInstallationStorageKey('test'))).toBe(newId)
  })

  it('falls back to ephemeral UUID without throwing if storage is unavailable or disabled', () => {
    const throwingStorage: Storage = {
      getItem: () => {
        throw new Error('QuotaExceeded')
      },
      setItem: () => {
        throw new Error('QuotaExceeded')
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0
    }

    const id = getOrCreateClientInstallationId(throwingStorage, 'test')
    expect(isValidInstallationId(id)).toBe(true)
  })
})
