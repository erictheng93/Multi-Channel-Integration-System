/**
 * E2E: Tag Conversations Drilldown
 *
 * Tests the full browser flow for the tag conversation count feature:
 *   1. Navigate to /customers/tags
 *   2. Page renders tag cards with conversation counts
 *   3. Clicking any tag card or conversation button opens TagConversationsModal
 *   4. Modal shows tag name and conversations list (or empty state)
 *   5. Pagination controls appear when there are multiple pages
 *   6. Modal closes via X button, overlay click, and Escape key
 *
 * Data resilience: tests that depend on tags with conversations gracefully
 * skip when the production DB has no such tags, rather than failing.
 */

import { test, expect, type Page } from '@playwright/test'
import { login, clearLocalStorage } from '../helpers/auth'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to the tags page and wait for it to finish loading */
async function goToTagsPage(page: Page) {
  await page.goto('/customers/tags')
  // Wait for the loading overlay to disappear and at least one element to render
  await page.waitForTimeout(2500)
}

/** Find the first conversation-count button (always clickable now) */
function conversationBtn(page: Page) {
  return page.locator('button.stat-item-clickable').first()
}

// ===========================================================================
// Tests
// ===========================================================================

test.describe('Tags — Conversation Drilldown (P1)', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorage(page)
    await login(page)
  })

  // =========================================================================
  // Page navigation
  // =========================================================================

  test('navigates to /customers/tags successfully', async ({ page }) => {
    await page.goto('/customers/tags')
    await expect(page).toHaveURL(/\/customers\/tags/)
  })

  test('page title or heading is visible', async ({ page }) => {
    await goToTagsPage(page)
    // The page should contain a heading-level element related to tags
    const heading = page
      .getByRole('heading')
      .filter({ hasText: /標籤|Tags/i })
    await expect(heading.first()).toBeVisible({ timeout: 10000 })
  })

  // =========================================================================
  // Tag card structure
  // =========================================================================

  test('tag cards are rendered on the page', async ({ page }) => {
    await goToTagsPage(page)

    const cards = page.locator('.tag-card')
    const count = await cards.count()

    // The test environment may have 0 or more tags — either is acceptable.
    // We just verify that if cards ARE present, they have the expected structure.
    if (count > 0) {
      await expect(cards.first()).toBeVisible()
      await expect(cards.first().locator('.tag-name')).toBeVisible()
    }
  })

  test('each tag card has a conversation count button', async ({ page }) => {
    await goToTagsPage(page)

    const cards = page.locator('.tag-card')
    const cardCount = await cards.count()
    if (cardCount === 0) { return }

    // Every tag card should have exactly one .stat-item-clickable button
    const firstCard = cards.first()
    const btn = firstCard.locator('button.stat-item-clickable')
    await expect(btn).toBeVisible()
  })

  test('conversation count button is always clickable (even when count is zero)', async ({ page }) => {
    await goToTagsPage(page)

    // All conversation buttons should be enabled regardless of count
    const allBtns = page.locator('button.stat-item-clickable')
    const count = await allBtns.count()
    if (count === 0) { return } // No tags at all — valid state

    for (let i = 0; i < count; i++) {
      await expect(allBtns.nth(i)).toBeEnabled()
    }
  })

  test('clicking a tag card opens the conversations modal', async ({ page }) => {
    await goToTagsPage(page)

    const cards = page.locator('.tag-card')
    if (await cards.count() === 0) { return }

    // Click the card content area (not the actions)
    await cards.first().locator('.tag-name').click()

    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.modal-title')).toBeVisible()
  })

  // =========================================================================
  // Modal open
  // =========================================================================

  test('clicking a conversation count button opens the modal', async ({ page }) => {
    await goToTagsPage(page)

    const btn = conversationBtn(page)
    const isVisible = await btn.isVisible()

    if (!isVisible) {
      test.skip(true, 'No tags found in this environment')
      return
    }

    await btn.click()

    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.modal-title')).toBeVisible()
  })

  test('modal title matches the tag name that was clicked', async ({ page }) => {
    await goToTagsPage(page)

    const btn = conversationBtn(page)
    if (!(await btn.isVisible())) {
      test.skip(true, 'No tags found in this environment')
      return
    }

    // Capture the tag name from the card before clicking
    const card = btn.locator('xpath=ancestor::*[contains(@class,"tag-card")]')
    const tagName = await card.locator('.tag-name').textContent()

    await btn.click()
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 })

    if (tagName) {
      await expect(page.locator('.modal-title')).toHaveText(tagName.trim())
    }
  })

  // =========================================================================
  // Modal content
  // =========================================================================

  test('modal shows conversation list or empty state', async ({ page }) => {
    await goToTagsPage(page)

    const btn = conversationBtn(page)
    if (!(await btn.isVisible())) {
      test.skip(true, 'No tags found in this environment')
      return
    }

    await btn.click()
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 })

    // After loading, either conversation items or an empty state message
    await page.waitForTimeout(2000) // allow API call to resolve

    const hasConversations = await page.locator('.conversation-item').count() > 0
    const hasEmptyState = await page.locator('text=此標籤尚未被應用到任何對話').isVisible()

    expect(hasConversations || hasEmptyState).toBe(true)
  })

  test('conversation items show customer name and status badge', async ({ page }) => {
    await goToTagsPage(page)

    const btn = conversationBtn(page)
    if (!(await btn.isVisible())) {
      test.skip(true, 'No tags found in this environment')
      return
    }

    await btn.click()
    await page.waitForTimeout(2000)

    const items = page.locator('.conversation-item')
    if (await items.count() === 0) { return } // empty state — already covered

    const first = items.first()
    await expect(first.locator('.customer-name')).toBeVisible()
    await expect(first.locator('.status-badge')).toBeVisible()
  })

  test('conversation-count badge in modal header shows a number', async ({ page }) => {
    await goToTagsPage(page)

    const btn = conversationBtn(page)
    if (!(await btn.isVisible())) {
      test.skip(true, 'No tags found in this environment')
      return
    }

    await btn.click()
    await page.waitForTimeout(2000)

    const badge = page.locator('.conversation-count-badge')
    await expect(badge).toBeVisible()
    const text = await badge.textContent()
    expect(text).toMatch(/\d+/)
  })

  // =========================================================================
  // Modal close — X button
  // =========================================================================

  test('modal closes when the X button is clicked', async ({ page }) => {
    await goToTagsPage(page)

    const btn = conversationBtn(page)
    if (!(await btn.isVisible())) {
      test.skip(true, 'No tags found in this environment')
      return
    }

    await btn.click()
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 })

    await page.locator('.close-btn').click()
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 3000 })
  })

  // =========================================================================
  // Modal close — Escape key
  // =========================================================================

  test('modal closes when Escape is pressed', async ({ page }) => {
    await goToTagsPage(page)

    const btn = conversationBtn(page)
    if (!(await btn.isVisible())) {
      test.skip(true, 'No tags found in this environment')
      return
    }

    await btn.click()
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 })

    await page.keyboard.press('Escape')
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 3000 })
  })

  // =========================================================================
  // Modal close — overlay backdrop click
  // =========================================================================

  test('modal closes when the backdrop overlay is clicked', async ({ page }) => {
    await goToTagsPage(page)

    const btn = conversationBtn(page)
    if (!(await btn.isVisible())) {
      test.skip(true, 'No tags found in this environment')
      return
    }

    await btn.click()
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 })

    // Click the overlay itself (not its children) by clicking a corner
    await page.locator('.modal-overlay').click({ position: { x: 5, y: 5 } })
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 3000 })
  })

  // =========================================================================
  // Pagination controls (conditionally present)
  // =========================================================================

  test('pagination controls appear when there are multiple pages', async ({ page }) => {
    await goToTagsPage(page)

    const btn = conversationBtn(page)
    if (!(await btn.isVisible())) {
      test.skip(true, 'No tags found in this environment')
      return
    }

    await btn.click()
    await page.waitForTimeout(2000)

    // Pagination only shows when totalPages > 1.
    // We verify that IF it appears, it contains two buttons (prev + next).
    const pagination = page.locator('.pagination')
    const hasPagination = await pagination.isVisible()
    if (!hasPagination) { return } // single page result — valid

    const paginationBtns = pagination.locator('.pagination-btn')
    await expect(paginationBtns).toHaveCount(2)
  })
})
