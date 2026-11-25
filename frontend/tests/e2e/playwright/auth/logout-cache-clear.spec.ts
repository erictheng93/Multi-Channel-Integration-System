import { test, expect } from '@playwright/test'
import {
  login,
  logout,
  getLocalStorageKeys,
  getSessionStorageKeys,
  clearLocalStorage,
} from '../helpers/auth'

test.describe('Logout & Cache Cleanup (P1)', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page)
  })

  test('should clear all auth tokens on logout', async ({ page }) => {
    await login(page)

    // Auth items live in sessionStorage (src/utils/authStorage.ts)
    const keysBefore = await getSessionStorageKeys(page)
    expect(keysBefore).toContain('token')
    expect(keysBefore).toContain('currentAgent')

    await logout(page)

    const read = (key: string) => page.evaluate((k) => sessionStorage.getItem(k), key)
    expect(await read('token')).toBeNull()
    expect(await read('refreshToken')).toBeNull()
    expect(await read('currentAgent')).toBeNull()
    expect(await read('sessionExpiry')).toBeNull()
    // and nothing leaked into the legacy localStorage location
    expect(await getLocalStorageKeys(page)).not.toContain('token')
  })

  test('should clear all cache keys on logout (including analytics + metadata)', async ({ page }) => {
    await login(page)

    // Navigate around to generate cache entries
    await page.goto('/conversations')
    await page.waitForLoadState('networkidle')

    await logout(page)

    const keysAfter = await getLocalStorageKeys(page)

    // Specifically verify the previously-leaking cache keys are gone
    expect(keysAfter).not.toContain('analytics_comparison_cache')
    expect(keysAfter).not.toContain('conversation_metadata_cache')

    // No conversation caches should remain
    const conversationCaches = keysAfter.filter(
      (k) => k.startsWith('conversation-list') || k.startsWith('cache_')
    )
    expect(conversationCaches).toHaveLength(0)
  })

  test('should redirect to login page after logout', async ({ page }) => {
    await login(page)
    await logout(page)

    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: '全通路客服整合平台' })).toBeVisible()
  })

  test('should not allow access to protected routes after logout', async ({ page }) => {
    await login(page)
    await logout(page)

    // Try navigating to a protected route
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)

    await page.goto('/conversations')
    await expect(page).toHaveURL(/\/login/)
  })
})
