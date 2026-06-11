const AUTH_STORAGE_KEYS = ['token', 'refreshToken', 'sessionExpiry', 'currentAgent'] as const

type AuthStorageKey = (typeof AUTH_STORAGE_KEYS)[number]

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null
  }
  return window.sessionStorage
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }
  return window.localStorage
}

export function getStoredAuthItem(key: AuthStorageKey): string | null {
  const sessionStorage = getSessionStorage()
  const sessionValue = sessionStorage?.getItem(key)
  if (sessionValue) {
    return sessionValue
  }

  const localStorage = getLocalStorage()
  const legacyValue =
    localStorage?.getItem(key) ?? (key === 'token' ? localStorage?.getItem('authToken') : null) ?? null
  if (legacyValue) {
    sessionStorage?.setItem(key, legacyValue)
    localStorage?.removeItem(key)
    if (key === 'token') {
      localStorage?.removeItem('authToken')
    }
  }

  return legacyValue
}

export function setStoredAuthItem(key: AuthStorageKey, value: string): void {
  getSessionStorage()?.setItem(key, value)
  getLocalStorage()?.removeItem(key)
}

export function removeStoredAuthItem(key: AuthStorageKey): void {
  getSessionStorage()?.removeItem(key)
  getLocalStorage()?.removeItem(key)
}

export function clearAuthStorageItems(): void {
  AUTH_STORAGE_KEYS.forEach(removeStoredAuthItem)
}

export function clearLegacyAuthLocalStorage(): void {
  const localStorage = getLocalStorage()
  AUTH_STORAGE_KEYS.forEach(key => localStorage?.removeItem(key))
  localStorage?.removeItem('authToken')
}
