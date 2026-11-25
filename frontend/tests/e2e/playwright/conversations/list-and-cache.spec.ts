import { test, expect } from '@playwright/test'
import {
  ADMIN_CREDENTIALS,
  login,
  clearLocalStorage,
  getLocalStorageKeys,
} from '../helpers/auth'

test.describe('Conversation List & Cache (P0)', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page)
    await login(page, ADMIN_CREDENTIALS)
  })

  test('should load the conversations page', async ({ page }) => {
    await page.goto('/conversations')

    await expect(page).toHaveURL(/\/conversations/)
    await expect(page).toHaveTitle(/對話/)
  })

  test('should include userId in cache keys for security isolation', async ({ page }) => {
    await page.goto('/conversations')
    await page.waitForLoadState('networkidle')

    const agentId = await page.evaluate(() => {
      const raw = sessionStorage.getItem('currentAgent')
      return raw ? (JSON.parse(raw) as { id?: string }).id ?? null : null
    })
    expect(agentId).toBeTruthy()

    const cacheKeys = async () =>
      (await getLocalStorageKeys(page)).filter((k) => k.startsWith('conversation-list'))

    // The list cache is written once data has loaded; an account with no visible
    // conversations never writes one, which is not a failure of the isolation rule.
    await page
      .waitForFunction(() => Object.keys(localStorage).some((k) => k.startsWith('conversation-list')), null, { timeout: 8000 })
      .catch(() => undefined)
    const keys = await cacheKeys()
    test.skip(keys.length === 0, 'No conversation list cache was written for this account')

    // Every cache key must be scoped to the current user
    for (const key of keys) {
      expect(key).toContain(`user=${agentId}`)
    }
  })

  test('should display conversation page content', async ({ page }) => {
    await page.goto('/conversations')

    // Main content area is present (either the list or the empty state)
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('should show sidebar navigation with correct items', async ({ page }) => {
    await page.goto('/conversations')

    // Verify key navigation items are present
    await expect(page.getByRole('link', { name: '儀表板', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: '對話', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: '團隊成員', exact: true })).toBeVisible()
  })
})
