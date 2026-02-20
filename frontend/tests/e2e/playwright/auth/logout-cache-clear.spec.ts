import { test, expect } from '@playwright/test'
import {
  login,
  logout,
  getLocalStorageKeys,
  clearLocalStorage,
} from '../helpers/auth'

test.describe('Logout & Cache Cleanup (P1)', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page)
  })

  test('should clear all auth tokens on logout', async ({ page }) => {
    await login(page)

    // Verify tokens exist before logout
    const keysBefore = await getLocalStorageKeys(page)
    expect(keysBefore).toContain('token')
    expect(keysBefore).toContain('currentAgent')

    await logout(page)

    // Verify all auth tokens are cleared
    const token = await page.evaluate(() => localStorage.getItem('token'))
    const refreshToken = await page.evaluate(() => localStorage.getItem('refreshToken'))
    const currentAgent = await page.evaluate(() => localStorage.getItem('currentAgent'))
    const sessionExpiry = await page.evaluate(() => localStorage.getItem('sessionExpiry'))

    expect(token).toBeNull()
    expect(refreshToken).toBeNull()
    expect(currentAgent).toBeNull()
    expect(sessionExpiry).toBeNull()
  })

  test('should clear all cache keys on logout (including analytics + metadata)', async ({ page }) => {
    await login(page)

    // Navigate around to generate cache entries
    await page.goto('/conversations')
    await page.waitForTimeout(2000) // Let caches populate

    // Check keys before logout
    const keysBefore = await getLocalStorageKeys(page)
    expect(keysBefore.length).toBeGreaterThan(0)

    await logout(page)

    // After logout, localStorage should be completely empty
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
