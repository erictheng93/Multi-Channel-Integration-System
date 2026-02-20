import { type Page, expect } from '@playwright/test'

/** Admin account credentials for E2E tests */
export const ADMIN_CREDENTIALS = {
  email: 'admin@dacit.net',
  password: '16011587DaC',
  displayName: 'System Administrator',
  role: 'admin',
  id: 'admin-001',
}

/** Test agent credentials */
export const AGENT_CREDENTIALS = {
  email: 'test@dacit.net',
  password: 'Test1234!',
  displayName: 'Test User',
  role: 'agent',
  id: 'test-agent-001',
}

/**
 * Login as a specific user via the login form
 */
export async function login(
  page: Page,
  credentials: { email: string; password: string } = ADMIN_CREDENTIALS
): Promise<void> {
  await page.goto('/login')
  await page.getByRole('textbox', { name: '電子郵件' }).fill(credentials.email)
  await page.getByRole('textbox', { name: '密碼' }).fill(credentials.password)
  await page.getByRole('button', { name: '繼續' }).click()

  // Wait for navigation away from login page
  await page.waitForURL(/^(?!.*\/login)/, { timeout: 15000 })
}

/**
 * Logout via the user menu
 */
export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: '用戶菜單' }).click()
  await page.locator('div').filter({ hasText: /^登出$/ }).click()

  // Confirm the logout dialog
  const confirmButton = page.getByRole('button', { name: '登出' }).last()
  await confirmButton.click()

  // Wait for redirect to login page
  await page.waitForURL('**/login', { timeout: 10000 })
}

/**
 * Get all localStorage keys
 */
export async function getLocalStorageKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) { keys.push(key) }
    }
    return keys.sort()
  })
}

/**
 * Get localStorage value by key
 */
export async function getLocalStorageValue(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key)
}

/**
 * Clear localStorage completely.
 * Must navigate to the app origin first to access localStorage.
 */
export async function clearLocalStorage(page: Page): Promise<void> {
  // Navigate to the app origin first so localStorage is accessible
  // (about:blank throws SecurityError)
  const currentUrl = page.url()
  if (!currentUrl.startsWith('http://localhost')) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
  }
  await page.evaluate(() => localStorage.clear())
}

/**
 * Wait for WebSocket connection (look for connection log message)
 */
export async function waitForWebSocket(page: Page, timeout = 10000): Promise<void> {
  await page.waitForEvent('console', {
    predicate: (msg) => msg.text().includes('[WebSocketStore] Connected successfully'),
    timeout,
  })
}

/**
 * Assert that the user is on the dashboard after login
 */
export async function assertOnDashboard(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page).toHaveTitle(/儀表板/)
}
