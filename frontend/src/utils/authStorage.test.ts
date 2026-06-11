import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAuthStorageItems,
  getStoredAuthItem,
  setStoredAuthItem
} from './authStorage'

function createStorageMock(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => values.set(key, value))
  }
}

describe('authStorage', () => {
  beforeEach(() => {
    const localStorage = createStorageMock()
    const sessionStorage = createStorageMock()

    Object.defineProperty(window, 'localStorage', {
      value: localStorage,
      configurable: true
    })

    Object.defineProperty(window, 'sessionStorage', {
      value: sessionStorage,
      configurable: true
    })
  })

  it('stores auth values in sessionStorage and removes auth localStorage copies', () => {
    window.localStorage.setItem('token', 'old-token')

    setStoredAuthItem('token', 'session-token')

    expect(window.sessionStorage.getItem('token')).toBe('session-token')
    expect(window.localStorage.getItem('token')).toBeNull()
  })

  it('migrates legacy token values out of localStorage on read', () => {
    window.localStorage.setItem('authToken', 'legacy-token')

    expect(getStoredAuthItem('token')).toBe('legacy-token')

    expect(window.sessionStorage.getItem('token')).toBe('legacy-token')
    expect(window.localStorage.getItem('authToken')).toBeNull()
  })

  it('clears auth values from sessionStorage and legacy localStorage keys', () => {
    window.sessionStorage.setItem('token', 'session-token')
    window.localStorage.setItem('refreshToken', 'legacy-refresh')

    clearAuthStorageItems()

    expect(window.sessionStorage.getItem('token')).toBeNull()
    expect(window.localStorage.getItem('refreshToken')).toBeNull()
  })
})
