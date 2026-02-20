import { test, expect } from '@playwright/test'
import { login, clearLocalStorage } from '../helpers/auth'

test.describe('WebSocket Connection (P0)', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page)
  })

  test('should establish WebSocket connection after login', async ({ page }) => {
    const wsLogs: string[] = []

    page.on('console', (msg) => {
      const text = msg.text()
      if (text.includes('WebSocket') || text.includes('websocket')) {
        wsLogs.push(text)
      }
    })

    await login(page)
    await page.waitForTimeout(3000) // Give time for WS connection

    // Should have WebSocket connection logs
    const hasConnecting = wsLogs.some((l) => l.includes('Connecting'))
    const hasConnected = wsLogs.some((l) => l.includes('Connected successfully'))

    expect(hasConnecting || hasConnected).toBe(true)
  })

  test('should show online status indicator after WebSocket connects', async ({ page }) => {
    await login(page)
    await page.waitForTimeout(3000)

    // Navigate to a page that shows status
    await page.goto('/monitoring/api')
    await page.waitForTimeout(1000)

    // Look for the online status indicator
    const onlineIndicator = page.getByText('線上')
    await expect(onlineIndicator).toBeVisible()
  })

  test('should reconnect WebSocket after navigation', async ({ page }) => {
    const wsLogs: string[] = []

    page.on('console', (msg) => {
      const text = msg.text()
      if (text.includes('[WebSocketStore]')) {
        wsLogs.push(text)
      }
    })

    await login(page)
    await page.waitForTimeout(2000)

    // Navigate to conversations
    await page.goto('/conversations')
    await page.waitForTimeout(2000)

    // Navigate to dashboard
    await page.goto('/dashboard')
    await page.waitForTimeout(2000)

    // WebSocket should still be connected (connection persists across navigation)
    const connectedLogs = wsLogs.filter((l) => l.includes('Connected successfully'))
    expect(connectedLogs.length).toBeGreaterThanOrEqual(1)
  })
})
