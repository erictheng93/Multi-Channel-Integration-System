import { describe, it, expect, vi, afterEach } from 'vitest'
import { getRuntimeConfig, isActivityRestoreEnabled } from './runtime'

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
