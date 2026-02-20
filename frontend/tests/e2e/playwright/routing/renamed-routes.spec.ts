import { test, expect } from '@playwright/test'
import { login, clearLocalStorage } from '../helpers/auth'

test.describe('Renamed Routes (P1)', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page)
    await login(page)
  })

  test('should load /activities page correctly', async ({ page }) => {
    await page.goto('/activities')

    await expect(page).toHaveURL(/\/activities/)
    await expect(page).toHaveTitle(/活動/)
  })

  test('should load /monitoring/api page correctly', async ({ page }) => {
    await page.goto('/monitoring/api')

    await expect(page).toHaveURL(/\/monitoring\/api/)
    await expect(page).toHaveTitle(/API監控/)
  })

  test('should show API Monitor dashboard content', async ({ page }) => {
    await page.goto('/monitoring/api')

    // Verify main UI elements render
    await expect(page.getByRole('heading', { name: 'API 監控儀表板' })).toBeVisible()
    await expect(page.getByText('WebSocket 遷移狀態')).toBeVisible()
    await expect(page.getByText('API 端點監控')).toBeVisible()
  })

  test('should have API Monitor link in sidebar navigation', async ({ page }) => {
    await page.goto('/dashboard')

    const apiMonitorLink = page.getByRole('link', { name: 'API監控' })
    await expect(apiMonitorLink).toBeVisible()

    // Click the link and verify navigation
    await apiMonitorLink.click()
    await expect(page).toHaveURL(/\/monitoring\/api/)
  })

  test('should have Activities link in sidebar navigation', async ({ page }) => {
    await page.goto('/dashboard')

    const activitiesLink = page.getByRole('link', { name: '活動記錄' })
    await expect(activitiesLink).toBeVisible()

    // Click the link and verify navigation
    await activitiesLink.click()
    await expect(page).toHaveURL(/\/activities/)
  })
})

test.describe('API Monitor CORS Fix (P1)', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page)
    await login(page)
  })

  test('should NOT have CORS errors on API Monitor page', async ({ page }) => {
    const corsErrors: string[] = []

    // Listen for console errors containing "CORS"
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().toLowerCase().includes('cors')) {
        corsErrors.push(msg.text())
      }
    })

    await page.goto('/monitoring/api')
    await page.waitForTimeout(3000) // Wait for auto-refresh cycle

    // No CORS errors should be present
    expect(corsErrors).toHaveLength(0)
  })

  test('should fetch API status through Vite proxy (not direct backend URL)', async ({ page }) => {
    const requestUrls: string[] = []

    // Capture network requests for api-status
    page.on('request', (request) => {
      if (request.url().includes('api-status') || request.url().includes('migration-status')) {
        requestUrls.push(request.url())
      }
    })

    await page.goto('/monitoring/api')
    await page.waitForTimeout(2000)

    // All api-status requests should go through the Vite proxy (localhost)
    // NOT to the direct backend URL (multi-channel.imfinethankyouandyou.com)
    for (const url of requestUrls) {
      expect(url).toContain('localhost')
      expect(url).not.toContain('multi-channel.imfinethankyouandyou.com')
    }
  })

  test('should display WebSocket migration status data', async ({ page }) => {
    await page.goto('/monitoring/api')
    await page.waitForTimeout(2000)

    // The migration status section should show actual data (not defaults)
    await expect(page.getByText('Rollout 進度')).toBeVisible()
    await expect(page.getByText('WebSocket 狀態')).toBeVisible()
    await expect(page.getByText('Durable Objects')).toBeVisible()
  })

  test('should show 6 API endpoints in monitor', async ({ page }) => {
    await page.goto('/monitoring/api')
    await page.waitForTimeout(2000)

    await expect(page.getByText('API 端點監控 (6)')).toBeVisible()

    // Verify specific endpoints are listed
    await expect(page.getByText('/api/system/health')).toBeVisible()
    await expect(page.getByText('/api/auth/login')).toBeVisible()
    await expect(page.getByText('/api/conversations')).toBeVisible()
    await expect(page.getByText('/api/customers')).toBeVisible()
    await expect(page.getByText('/api/teams/members')).toBeVisible()
  })
})
