import { test, expect } from '@playwright/test'
import { login, clearLocalStorage } from '../helpers/auth'

test.describe('Team Management (P1)', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page)
    await login(page)
  })

  test('should load team management page', async ({ page }) => {
    await page.goto('/team')

    await expect(page).toHaveURL(/\/team/)
    await expect(page).toHaveTitle(/團隊/)
  })

  test('should display team members list', async ({ page }) => {
    await page.goto('/team')
    await page.waitForTimeout(2000)

    // Should show the team management heading or member count
    const heading = page.getByRole('heading').filter({ hasText: /團隊|成員/ })
    await expect(heading.first()).toBeVisible()
  })

  test('should show correct admin user in team list', async ({ page }) => {
    await page.goto('/team')
    await page.waitForTimeout(2000)

    // The admin user should be visible in the team member list (not the sidebar)
    await expect(page.getByRole('heading', { name: 'System Administrator' })).toBeVisible()
  })

  test('should handle file-split re-exports correctly', async ({ page }) => {
    // This test verifies that the TypeScript strict + file split refactoring
    // didn't break barrel re-exports for team management composables
    test.setTimeout(30000) // Extra timeout for sequential login

    const consoleErrors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto('/team')
    await page.waitForTimeout(2000)

    // No import/module resolution errors should appear
    const importErrors = consoleErrors.filter(
      (e) =>
        e.includes('import') ||
        e.includes('module') ||
        e.includes('Cannot find') ||
        e.includes('is not defined')
    )
    expect(importErrors).toHaveLength(0)
  })

  test('should navigate to team page from sidebar', async ({ page }) => {
    await page.goto('/dashboard')

    const teamLink = page.getByRole('link', { name: '團隊管理' })
    await expect(teamLink).toBeVisible()

    await teamLink.click()
    await expect(page).toHaveURL(/\/team/)
  })
})
