import { test, expect, type Page } from '@playwright/test'

const adminAgent = {
  id: 'admin-1',
  email: 'admin@example.test',
  name: 'Admin',
  displayName: 'Admin',
  role: 'admin',
  isActive: true,
  primaryTeamId: 1,
  createdAt: Date.now(),
}

const existingConversation = {
  id: 'conv-existing',
  customerId: 101,
  assignedTeamId: 1,
  assignedUserId: null,
  status: 'active',
  platform: 'line',
  platformUserId: 'line-existing',
  customerName: 'Existing Customer',
  customer: {
    id: 101,
    name: 'Existing Customer',
    platform: 'line',
    platformUserId: 'line-existing',
    createdAt: '2026-06-10T09:00:00.000Z',
  },
  assignedTeam: {
    id: 1,
    name: 'Support',
  },
  lastMessageContent: 'Before reconnect',
  lastMessageAt: '2026-06-10T10:00:00.000Z',
  lastMessageAtActual: '2026-06-10T10:00:00.000Z',
  unreadCount: 0,
  createdAt: '2026-06-10T09:00:00.000Z',
  updatedAt: '2026-06-10T10:00:00.000Z',
}

const missedConversation = {
  id: 'conv-missed',
  customerId: 202,
  assignedTeamId: 1,
  assignedUserId: null,
  status: 'active',
  platform: 'line',
  platformUserId: 'line-missed',
  customerName: 'Missed During Reconnect',
  customer: {
    id: 202,
    name: 'Missed During Reconnect',
    platform: 'line',
    platformUserId: 'line-missed',
    createdAt: '2026-06-10T10:59:00.000Z',
  },
  assignedTeam: {
    id: 1,
    name: 'Support',
  },
  lastMessageContent: 'Created while socket was down',
  lastMessageAt: '2026-06-10T11:00:00.000Z',
  lastMessageAtActual: '2026-06-10T11:00:00.000Z',
  unreadCount: 1,
  createdAt: '2026-06-10T10:59:00.000Z',
  updatedAt: '2026-06-10T11:00:00.000Z',
}

declare global {
  interface Window {
    __mockSockets: Array<{
      __serverOpen: () => void
      __serverDrop: () => void
    }>
    __wsSent: unknown[]
  }
}

async function installMockWebSocket(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear()

    window.__mockSockets = []
    window.__wsSent = []

    class MockWebSocket extends EventTarget {
      static readonly CONNECTING = 0
      static readonly OPEN = 1
      static readonly CLOSING = 2
      static readonly CLOSED = 3

      readonly url: string
      readonly protocol = ''
      readonly extensions = ''
      readonly bufferedAmount = 0
      binaryType: globalThis.BinaryType = 'blob'
      readyState = MockWebSocket.CONNECTING
      onopen: ((_event: globalThis.Event) => void) | null = null
      onmessage: ((_event: globalThis.MessageEvent) => void) | null = null
      onerror: ((_event: globalThis.Event) => void) | null = null
      onclose: ((_event: globalThis.CloseEvent) => void) | null = null

      constructor(url: string | URL) {
        super()
        this.url = String(url)
        window.__mockSockets.push(this)
        setTimeout(() => this.__serverOpen(), 0)
      }

      send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        try {
          window.__wsSent.push(typeof data === 'string' ? JSON.parse(data) : data)
        } catch {
          window.__wsSent.push(data)
        }
      }

      close(code = 1000, reason = 'Client disconnect') {
        if (this.readyState === MockWebSocket.CLOSED) {
          return
        }
        this.readyState = MockWebSocket.CLOSED
        const event = new globalThis.CloseEvent('close', { code, reason, wasClean: code === 1000 })
        this.onclose?.(event)
        this.dispatchEvent(event)
      }

      __serverOpen() {
        if (this.readyState !== MockWebSocket.CONNECTING) {
          return
        }
        this.readyState = MockWebSocket.OPEN
        const event = new Event('open')
        this.onopen?.(event)
        this.dispatchEvent(event)
      }

      __serverDrop() {
        if (this.readyState === MockWebSocket.CLOSED) {
          return
        }
        this.readyState = MockWebSocket.CLOSED
        const errorEvent = new Event('error')
        this.onerror?.(errorEvent)
        this.dispatchEvent(errorEvent)

        const closeEvent = new globalThis.CloseEvent('close', {
          code: 1006,
          reason: 'network drop',
          wasClean: false,
        })
        this.onclose?.(closeEvent)
        this.dispatchEvent(closeEvent)
      }
    }

    Object.defineProperty(MockWebSocket, 'CONNECTING', { value: 0 })
    Object.defineProperty(MockWebSocket, 'OPEN', { value: 1 })
    Object.defineProperty(MockWebSocket, 'CLOSING', { value: 2 })
    Object.defineProperty(MockWebSocket, 'CLOSED', { value: 3 })

    window.WebSocket = MockWebSocket as unknown as typeof globalThis.WebSocket
  })
}

async function installApiMocks(
  page: Page,
  getConversations: () => Array<typeof existingConversation>
) {
  let loggedIn = false

  await page.route(/\/api\//, async (route) => {
    const url = new URL(route.request().url())

    if (!url.pathname.startsWith('/api/')) {
      await route.fallback()
      return
    }

    if (url.pathname === '/api/auth/login') {
      loggedIn = true
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            agent: adminAgent,
            sessionId: 'session-cookie-backed',
            expiresIn: 60 * 60 * 24 * 7,
          },
        }),
      })
      return
    }

    if (url.pathname === '/api/auth/me') {
      await route.fulfill({
        status: loggedIn ? 200 : 401,
        contentType: 'application/json',
        body: JSON.stringify(
          loggedIn
            ? { success: true, data: adminAgent }
            : { success: false, status: 401, error: 'Unauthorized' }
        ),
      })
      return
    }

    if (url.pathname === '/api/auth/refresh') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { expiresIn: 60 * 60 * 24 * 7 } }),
      })
      return
    }

    if (url.pathname === '/api/websocket/health') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          configuration: { websocketEnabled: true },
        }),
      })
      return
    }

    if (url.pathname === '/api/conversations') {
      const items = getConversations()
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items,
            page: 1,
            pageSize: 20,
            total: items.length,
            totalPages: 1,
          },
        }),
      })
      return
    }

    if (url.pathname === '/api/conversations/stats') {
      const items = getConversations()
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            total: items.length,
            active: items.length,
            assigned: 0,
            pending: 0,
            unreadCount: items.reduce((sum, item) => sum + (item.unreadCount ?? 0), 0),
          },
        }),
      })
      return
    }

    if (url.pathname === '/api/tags') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
          pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
        }),
      })
      return
    }

    if (url.pathname === '/api/teams' || url.pathname === '/api/teams/members') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
      return
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    })
  })
}

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByRole('textbox', { name: '電子郵件' }).fill('admin@example.test')
  await page.getByRole('textbox', { name: '密碼' }).fill('Password1')
  const loginResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/auth/login')
  )
  await page.getByRole('button', { name: '繼續' }).click()
  await expect((await loginResponsePromise).status()).toBe(200)
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('sessionExpiry')), { timeout: 5000 })
    .not.toBeNull()
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('currentAgent')), { timeout: 5000 })
    .toContain('admin@example.test')
}

test.describe('ADR 0002 reconnect reconciliation', () => {
  test('recovers conversation state through HTTP after WebSocket reconnect', async ({ page }) => {
    test.setTimeout(45000)

    let includeMissedConversation = false
    let conversationListCalls = 0

    await installMockWebSocket(page)
    await installApiMocks(page, () => {
      conversationListCalls++
      return includeMissedConversation
        ? [missedConversation, existingConversation]
        : [existingConversation]
    })

    await login(page)
    await page.goto('/conversations')

    await expect(page.getByText('Existing Customer').first()).toBeVisible()
    await expect(page.getByText('Missed During Reconnect').first()).toBeHidden()
    await page.waitForFunction(() => window.__mockSockets.length > 0)

    const socketsBeforeReconnect = await page.evaluate(() => window.__mockSockets.length)
    const callsBeforeReconnect = conversationListCalls
    includeMissedConversation = true

    await page.evaluate(() => {
      window.__mockSockets.at(-1)?.__serverDrop()
    })

    await expect
      .poll(() => page.evaluate(() => window.__mockSockets.length), { timeout: 12000 })
      .toBeGreaterThan(socketsBeforeReconnect)
    await expect
      .poll(() => conversationListCalls, { timeout: 12000 })
      .toBeGreaterThan(callsBeforeReconnect)
    await expect(page.getByText('Missed During Reconnect').first()).toBeVisible()
  })
})
