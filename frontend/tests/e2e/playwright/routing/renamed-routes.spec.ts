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
    await expect(page).toHaveTitle(/API 監控/)
  })

  test('should show API Monitor dashboard content', async ({ page }) => {
    await page.goto('/monitoring/api')

    await expect(page.getByRole('heading', { name: 'API 監控', exact: true })).toBeVisible()
  })

  test('should have API Monitor link in sidebar navigation', async ({ page }) => {
    await page.goto('/dashboard')

    const apiMonitorLink = page.getByRole('link', { name: 'API 監控' })
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

    const statusResponse = page.waitForResponse((r) => r.url().includes('/api/system/api-status'))
    await page.goto('/monitoring/api')
    await statusResponse // the page has actually fetched its data before we judge the console

    expect(corsErrors).toHaveLength(0)
  })

  test('should fetch API status through the Vite proxy (same origin as the page)', async ({ page }) => {
    const statusRequest = page.waitForRequest((r) => r.url().includes('/api/system/api-status'))
    await page.goto('/monitoring/api')
    const request = await statusRequest

    // Same origin as the app (the dev server proxies /api), never the backend host directly
    expect(new URL(request.url()).origin).toBe(new URL(page.url()).origin)
  })

  test('should list monitored endpoints returned by the status API', async ({ page }) => {
    await page.goto('/monitoring/api')

    await expect(page.getByText('/api/system/health').first()).toBeVisible()
  })
})
