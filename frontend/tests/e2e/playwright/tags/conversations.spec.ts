/**
 * E2E: Tag Conversations Drilldown
 *
 * Tests the full browser flow for the tag conversation count feature:
 * 1. Navigate to /customers/tags
 * 2. Page renders tag cards with conversation counts
 * 3. Clicking any tag card or conversation button opens TagConversationsModal
 * 4. Modal shows tag name and conversations list (or empty state)
 * 5. Pagination controls appear when there are multiple pages
 * 6. Modal closes via X button, overlay click, and Escape key
 *
 * Read-only: nothing here creates, edits or deletes data.
 *
 * Data resilience: the "with tags" block skips as a whole (one guard in its
 * beforeEach) when the environment has no tags, rather than failing.
 */

import { test, expect, type Page } from '@playwright/test'
import { login, clearLocalStorage } from '../helpers/auth'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to the tags page and wait until its loading state is gone */
async function goToTagsPage(page: Page) {
  await page.goto('/customers/tags')
  await page.waitForLoadState('networkidle')
  await page.locator('.loading-state').waitFor({ state: 'hidden', timeout: 10000 })
}

/** Open the conversations modal from the first tag card and wait for it to settle */
async function openFirstTagModal(page: Page) {
  await page.locator('button.stat-item-clickable').first().click()
  await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 })
  // Settled = loading spinner gone (either the list or the empty state is shown)
  await expect(page.locator('.modal-body .state-container p', { hasText: '載入對話中' })).toBeHidden({
    timeout: 10000,
  })
}

// ===========================================================================
// Tests
// ===========================================================================

test.describe('Tags - Conversation Drilldown (P1)', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page)
    await login(page)
  })

  test('navigates to /customers/tags successfully', async ({ page }) => {
    await page.goto('/customers/tags')
    await expect(page).toHaveURL(/\/customers\/tags/)
  })

  test('page title or heading is visible', async ({ page }) => {
    await goToTagsPage(page)
    const heading = page.getByRole('heading').filter({ hasText: /標籤|Tags/i })
    await expect(heading.first()).toBeVisible({ timeout: 10000 })
  })

  test.describe('with tags', () => {
    // One guard for the whole block: every test below needs at least one tag card.
    test.beforeEach(async ({ page }) => {
      await goToTagsPage(page)
      test.skip((await page.locator('.tag-card').count()) === 0, 'No tags found in this environment')
    })

    test('tag cards show their name', async ({ page }) => {
      const first = page.locator('.tag-card').first()
      await expect(first).toBeVisible()
      await expect(first.locator('.tag-name')).toBeVisible()
    })

    test('every tag card has an enabled conversation count button, even at zero', async ({ page }) => {
      const cards = page.locator('.tag-card')
      const count = await cards.count()
      for (let i = 0; i < count; i++) {
        await expect(cards.nth(i).locator('button.stat-item-clickable')).toBeEnabled()
      }
    })

    test('clicking a tag name opens the conversations modal', async ({ page }) => {
      await page.locator('.tag-card').first().locator('.tag-name').click()

      await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 })
      await expect(page.locator('.modal-title')).toBeVisible()
    })

    test('clicking a conversation count button opens the modal', async ({ page }) => {
      await page.locator('button.stat-item-clickable').first().click()

      await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 })
      await expect(page.locator('.modal-title')).toBeVisible()
    })

    test('modal title matches the tag name that was clicked', async ({ page }) => {
      const card = page.locator('.tag-card').first()
      const tagName = ((await card.locator('.tag-name').textContent()) ?? '').trim()
      expect(tagName).not.toBe('')

      await card.locator('button.stat-item-clickable').click()

      await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 })
      await expect(page.locator('.modal-title')).toHaveText(tagName)
    })

    test('modal shows conversation list or empty state', async ({ page }) => {
      await openFirstTagModal(page)

      const items = page.locator('.conversation-item')
      const empty = page.getByText('此標籤尚未被應用到任何對話')
      await expect(items.first().or(empty)).toBeVisible()
    })

    test('conversation items show customer name and status badge', async ({ page }) => {
      await openFirstTagModal(page)

      const items = page.locator('.conversation-item')
      test.skip((await items.count()) === 0, 'The first tag has no conversations')

      await expect(items.first().locator('.customer-name')).toBeVisible()
      await expect(items.first().locator('.status-badge')).toBeVisible()
    })

    test('conversation-count badge in modal header shows a number', async ({ page }) => {
      await openFirstTagModal(page)

      const badge = page.locator('.conversation-count-badge')
      await expect(badge).toBeVisible()
      await expect(badge).toHaveText(/\d+/)
    })

    test('modal closes when the X button is clicked', async ({ page }) => {
      await openFirstTagModal(page)

      await page.locator('.close-btn').click()
      await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 3000 })
    })

    test('modal closes when Escape is pressed', async ({ page }) => {
      await openFirstTagModal(page)

      await page.keyboard.press('Escape')
      await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 3000 })
    })

    test('modal closes when the backdrop overlay is clicked', async ({ page }) => {
      await openFirstTagModal(page)

      // Click the overlay itself (not its children) by clicking a corner
      await page.locator('.modal-overlay').click({ position: { x: 5, y: 5 } })
      await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 3000 })
    })

    test('pagination, when shown, has previous and next buttons', async ({ page }) => {
      await openFirstTagModal(page)

      const pagination = page.locator('.pagination')
      test.skip(!(await pagination.isVisible()), 'The first tag fits on a single page')

      await expect(pagination.locator('.pagination-btn')).toHaveCount(2)
    })
  })
})
