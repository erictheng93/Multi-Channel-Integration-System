import { test, expect } from '@playwright/test'
import { waitForFirstConversation } from '../helpers/rwd'

test('waits for a conversation arriving after the former 1.5 second delay', async ({ page }) => {
  await page.setContent(
    '<div class="conversations-content"><div class="loading-overlay">Loading</div></div>'
  )
  await page.evaluate(() => {
    setTimeout(() => {
      document.querySelector('.conversations-content')!.innerHTML =
        '<div class="conversation-row" style="display:none">Desktop</div>' +
        '<div class="conversation-card">Mobile</div>'
    }, 1800)
  })
  const row = await waitForFirstConversation(page)
  expect(row).not.toBeNull()
  await expect(row!).toHaveText('Mobile')
  await row!.click()
})

test('returns no conversation only after an explicit empty state appears', async ({ page }) => {
  await page.setContent(
    '<div class="conversations-content"><div class="loading-overlay">Loading</div></div>'
  )
  await page.evaluate(() => {
    setTimeout(() => {
      document.querySelector('.conversations-content')!.innerHTML =
        '<div class="no-data">No conversations</div>'
    }, 200)
  })
  expect(await waitForFirstConversation(page)).toBeNull()
  await expect(page.locator('.no-data')).toBeVisible()
})

test('fails stalled loading instead of treating it as an empty list', async ({ page }) => {
  await page.setContent(
    '<div class="no-data">Unrelated empty state</div>' +
      '<div class="conversations-content"><div class="loading-overlay">Loading</div>' +
      '<div class="no-data" style="display:none">Hidden empty state</div></div>'
  )
  await expect(waitForFirstConversation(page, 300)).rejects.toThrow(/Timeout/)
})

test('throws when the list failed to load instead of reporting an empty list', async ({ page }) => {
  await page.setContent(
    '<div class="conversations-content">' +
      '<div class="conversations-error" role="alert">' +
      '<div>Unable to load</div><div>Server unavailable</div></div></div>'
  )
  await expect(waitForFirstConversation(page)).rejects.toThrow(
    /failed to load.*Server unavailable/
  )
})
