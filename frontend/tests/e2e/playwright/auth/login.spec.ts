import { test, expect } from '@playwright/test'
import {
  ADMIN_CREDENTIALS,
  login,
  clearLocalStorage,
  assertOnDashboard,
} from '../helpers/auth'

test.describe('Login Flow (P0)', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page)
  })

  test('should display the login page correctly', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { name: '全通路客服整合平台' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: '電子郵件' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: '密碼' })).toBeVisible()
    await expect(page.getByRole('button', { name: '登入', exact: true })).toBeEnabled()
  })

  test('should enable submit button when form is filled', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('textbox', { name: '電子郵件' }).fill(ADMIN_CREDENTIALS.email)
    await page.getByRole('textbox', { name: '密碼' }).fill(ADMIN_CREDENTIALS.password)

    await expect(page.getByRole('button', { name: '登入', exact: true })).toBeEnabled()
  })

  test('should login successfully with valid admin credentials', async ({ page }) => {
    await login(page, ADMIN_CREDENTIALS)
    await assertOnDashboard(page)

    // Auth items live in sessionStorage (utils/authStorage.ts), never in localStorage
    const token = await page.evaluate(() => sessionStorage.getItem('token'))
    expect(token).toBeTruthy()
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull()

    const currentAgent = await page.evaluate(() => sessionStorage.getItem('currentAgent'))
    expect(currentAgent).toBeTruthy()

    const agent = JSON.parse(currentAgent!)
    expect(agent.email).toBe(ADMIN_CREDENTIALS.email)
    expect(agent.role).toBe(ADMIN_CREDENTIALS.role)
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('textbox', { name: '電子郵件' }).fill('wrong@example.com')
    await page.getByRole('textbox', { name: '密碼' }).fill('wrongpassword')

    const loginResponse = page.waitForResponse((r) => r.url().includes('/auth/login'))
    await page.getByRole('button', { name: '登入', exact: true }).click()

    // The server rejected the credentials and the user stays on the login page
    expect((await loginResponse).ok()).toBe(false)
    await expect(page).toHaveURL(/\/login/)
    expect(await page.evaluate(() => sessionStorage.getItem('token'))).toBeNull()
  })

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard')

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/)
  })

  test('should redirect authenticated users away from login', async ({ page }) => {
    await login(page, ADMIN_CREDENTIALS)
    await assertOnDashboard(page)

    // Trying to go to login should redirect back to dashboard
    await page.goto('/login')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('should show user info in sidebar after login', async ({ page }) => {
    await login(page, ADMIN_CREDENTIALS)

    // The sidebar shows the user name and role
    const sidebar = page.getByRole('complementary')
    await expect(sidebar.getByText(ADMIN_CREDENTIALS.displayName)).toBeVisible()
    await expect(sidebar.getByText('管理員')).toBeVisible()
  })
})
