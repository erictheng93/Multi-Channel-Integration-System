import { describe, it, expect, vi, afterEach } from 'vitest'
import { getRuntimeConfig, getWebSocketUrl, isActivityRestoreEnabled } from './runtime'

describe('activity restore runtime flag', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults activityRestore to false', () => {
    vi.stubEnv('VITE_ENABLE_ACTIVITY_RESTORE', '')

    expect(getRuntimeConfig().features.activityRestore).toBe(false)
    expect(isActivityRestoreEnabled()).toBe(false)
  })

  it('reads VITE_ENABLE_ACTIVITY_RESTORE=true', () => {
    vi.stubEnv('VITE_ENABLE_ACTIVITY_RESTORE', 'true')

    expect(getRuntimeConfig().features.activityRestore).toBe(true)
    expect(isActivityRestoreEnabled()).toBe(true)
  })
})

describe('websocket runtime url', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses the current dev server origin for websocket proxying in development', () => {
    vi.stubEnv('VITE_ENV', 'development')
    vi.stubEnv('PROD', false)
    vi.stubEnv('VITE_WEBSOCKET_URL', 'wss://mcis-backend.daiwandist.com')

    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        origin: 'http://localhost:5174',
        protocol: 'http:',
        host: 'localhost:5174'
      },
      configurable: true
    })

    expect(getWebSocketUrl()).toBe('ws://localhost:5174')
  })
})
