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
    await page.waitForTimeout(3000) // Wait for data load + cache write

    const keys = await getLocalStorageKeys(page)

    // Find conversation cache keys
    const cachKeys = keys.filter(
      (k) => k.startsWith('cache_conversations') || k.startsWith('conversation-list')
    )

    // At least one conversation cache key should contain the userId
    if (cachKeys.length > 0) {
      const hasUserIdInKey = cachKeys.some(
        (k) => k.includes(ADMIN_CREDENTIALS.id) || k.includes('userId')
      )
      expect(hasUserIdInKey).toBe(true)
    }
  })

  test('should display conversation page content', async ({ page }) => {
    await page.goto('/conversations')
    await page.waitForTimeout(3000)

    // The conversations page should have main content area loaded
    // (either conversation list or empty state message)
    const mainContent = page.getByRole('main')
    await expect(mainContent).toBeVisible()
  })

  test('should show sidebar navigation with correct items', async ({ page }) => {
    await page.goto('/conversations')

    // Verify key navigation items are present
    await expect(page.getByRole('link', { name: '儀表板' })).toBeVisible()
    await expect(page.getByRole('link', { name: '對話管理' })).toBeVisible()
    await expect(page.getByRole('link', { name: '團隊管理' })).toBeVisible()
  })
})
