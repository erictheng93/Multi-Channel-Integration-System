import { test, expect, type Page } from '@playwright/test'

const adminAgent = {
  id: 'admin-1',
  email: 'admin@example.test',
  name: 'Admin',
  displayName: 'Admin',
  role: 'admin',
  isActive: true,
  createdAt: Date.now(),
}

function base64(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64')
}

function makeJwt(): string {
  return [
    base64({ alg: 'HS256', typ: 'JWT' }),
    base64({
      userId: adminAgent.id,
      role: adminAgent.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    }),
    base64('test-signature'),
  ].join('.')
}

function activity(overrides: Record<string, unknown>) {
  return {
    id: 5,
    userId: 'admin-1',
    userName: 'Admin',
    userRole: 'admin',
    action: 'tag_delete',
    resourceType: 'tag',
    resourceId: '42',
    createdAt: '2026-05-26T10:00:00.000Z',
    details: {
      reversible: true,
      restoreHandler: 'tag.delete',
      previousState: { id: 42, name: 'Original' },
      newState: { id: 42, deleted_at: '2026-05-26T10:00:00.000Z' },
      restorePolicy: {
        expiresAt: '2099-01-01T00:00:00.000Z',
        requiresAdmin: false,
      },
      restoredByActivityId: null,
    },
    ...overrides,
  }
}

async function seedAuthenticatedAdmin(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear()
  })

  await page.route(/\/api\//, async (route) => {
    const url = new URL(route.request().url())
    if (!url.pathname.startsWith('/api/')) {
      await route.fallback()
      return
    }


    if (url.pathname === '/api/auth/login') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            token: makeJwt(),
            refreshToken: 'refresh-token',
            agent: adminAgent,
          },
        }),
      })
      return
    }

    if (url.pathname === '/api/auth/refresh') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            token: makeJwt(),
            refreshToken: 'refresh-token',
          },
        }),
      })
      return
    }

    if (url.pathname === '/api/auth/me') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: adminAgent }),
      })
      return
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    })
  })

  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#email').fill('admin@example.test')
  await page.locator('#password').fill('Password1')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/dashboard/)
}

async function mockActivityChrome(page: Page) {
  await page.route('**/api/teams/members', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [adminAgent] }),
    })
  })

  await page.route('**/api/activities/overview**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          totalActivities: 3,
          actionStats: { tag_delete: 1 },
          topUsers: [{ user_name: 'Admin', user_role: 'admin', count: 3 }],
          dailyStats: [{ date: '2026-05-26', count: 3 }],
          period: {
            days: 7,
            startDate: '2026-05-19T00:00:00.000Z',
            endDate: '2026-05-26T00:00:00.000Z',
          },
        },
      }),
    })
  })
}

async function mockActivities(page: Page, getItems: () => Array<Record<string, unknown>>) {
  await page.route(/\/api\/activities(?:\?.*)?$/, async (route) => {
    const items = getItems()
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          items,
          page: 1,
          pageSize: 50,
          total: items.length,
          totalPages: 1,
        },
      }),
    })
  })
}

async function navigateToActivities(page: Page) {
  const link = page.locator('a[href="/activities"]')
  await expect(link.first()).toBeVisible()
  await link.first().click()
  await expect(page).toHaveURL(/\/activities/)
}

test.describe('Activity restore phase 3 smoke', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedAdmin(page)
    await mockActivityChrome(page)
  })

  test('shows restore states and marks a row restored after confirmation', async ({ page }) => {
    let restored = false
    await mockActivities(page, () => [
      activity({
        id: 5,
        details: {
          reversible: true,
          restoreHandler: 'tag.delete',
          previousState: { id: 42, name: 'Original' },
          newState: { id: 42, deleted_at: '2026-05-26T10:00:00.000Z' },
          restorePolicy: {
            expiresAt: '2099-01-01T00:00:00.000Z',
            requiresAdmin: false,
          },
          restoredByActivityId: restored ? 105 : null,
        },
      }),
      activity({
        id: 6,
        details: {
          reversible: true,
          restoreHandler: 'tag.delete',
          previousState: {},
          newState: {},
          restorePolicy: {
            expiresAt: '2020-01-01T00:00:00.000Z',
            requiresAdmin: false,
          },
          restoredByActivityId: null,
        },
      }),
      activity({
        id: 7,
        action: 'message_send',
        resourceType: 'message',
        details: { reversible: false, irreversibleReason: 'message_sent' },
      }),
    ])

    await page.route('**/api/activities/5/restore', async (route) => {
      restored = true
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { restoredByActivityId: 105, restoredActivityId: 105 },
        }),
      })
    })

    await navigateToActivities(page)

    await expect(page.locator('[data-test="restore-button"]')).toHaveCount(1)
    await expect(page.locator('[data-test="restore-expired"]')).toBeVisible()
    await expect(page.locator('[data-test="restore-irreversible"]')).toBeVisible()

    await page.locator('[data-test="restore-button"]').click()
    await expect(page.locator('.restore-modal__panel')).toBeVisible()
    await page.locator('[data-test="restore-confirm"]').click()

    await expect(page.locator('[data-test="restore-done"]')).toBeVisible()
  })

  test('shows conflict diff and supports force restore', async ({ page }) => {
    let restored = false
    let restoreAttempts = 0

    await mockActivities(page, () => [
      activity({
        id: 8,
        details: {
          reversible: true,
          restoreHandler: 'tag.update',
          previousState: { id: 42, name: 'Original' },
          newState: { id: 42, name: 'Deleted' },
          restorePolicy: {
            expiresAt: '2099-01-01T00:00:00.000Z',
            requiresAdmin: false,
          },
          restoredByActivityId: restored ? 108 : null,
        },
      }),
    ])

    await page.route('**/api/activities/8/restore', async (route) => {
      restoreAttempts += 1
      if (restoreAttempts === 1) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            code: 'RESTORE_CONFLICT',
            error: 'Conflict',
            data: {
              midChanges: [
                {
                  field: 'name',
                  valueAtOriginalAction: 'Original',
                  valueNow: 'Current',
                  valueAfterRestore: 'Original',
                },
              ],
            },
          }),
        })
        return
      }

      restored = true
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { restoredByActivityId: 108, restoredActivityId: 108 },
        }),
      })
    })

    await navigateToActivities(page)

    await page.locator('[data-test="restore-button"]').click()
    await page.locator('[data-test="restore-confirm"]').click()

    await expect(page.locator('[data-test="restore-force"]')).toBeVisible()
    await expect(page.locator('.conflict-table')).toContainText('name')

    await page.locator('[data-test="restore-force"]').click()
    await expect(page.locator('[data-test="restore-done"]')).toBeVisible()
  })
})
