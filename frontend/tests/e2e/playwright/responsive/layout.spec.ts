import { test, expect, type Page } from '@playwright/test'
import { ADMIN_CREDENTIALS, login } from '../helpers/auth'
import { ROUTES, VIEWPORTS, auditLayout, spaNavigate } from '../helpers/rwd'

/**
 * Responsive regression sweep: every route at phone / tablet / laptop width must
 * have no sideways page scroll, no control outside the viewport and no clipped
 * content, and the reply workspace must stay usable. Needs a real session like
 * the other e2e specs (ADMIN_PASSWORD) and is read-only: it only navigates.
 *
 * Logs in ONCE and reuses the page: the login endpoint is rate limited
 * (5 attempts / 5 minutes per IP), so a login per test would trip it.
 */
test.describe.configure({ mode: 'serial' })

test.describe('responsive layout sweep', () => {
  test.skip(!process.env.ADMIN_PASSWORD, 'ADMIN_PASSWORD is not set')
  test.setTimeout(240_000)

  let page: Page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    await login(page, ADMIN_CREDENTIALS)
  })

  test.afterAll(async () => {
    await page?.close()
  })

  async function openFirstConversation(): Promise<void> {
    await spaNavigate(page, '/conversations')
    await page.waitForTimeout(1500)
    // the desktop table and the mobile cards are both in the DOM; only one is visible
    await page.locator('.conversation-row:visible, .conversation-card:visible, tbody tr:visible').first().click()
    await page.waitForURL(/\/conversations\/.+/)
    await page.locator('.header-actions').first().waitFor({ timeout: 10_000 })
  }

  for (const vp of VIEWPORTS) {
    test(`${vp.name} ${vp.width}px: routes have no overflow or unreachable controls`, async () => {
      await page.setViewportSize({ width: vp.width, height: vp.height })

      const problems: string[] = []
      for (const route of ROUTES) {
        await spaNavigate(page, route)
        await page.waitForTimeout(1200)
        const a = await auditLayout(page)
        if (a.documentOverflow > 0) {
          problems.push(`${route}: page scrolls sideways by ${a.documentOverflow}px`)
        }
        for (const u of a.unreachable) { problems.push(`${route}: unreachable ${u}`) }
        for (const c of a.clipped) { problems.push(`${route}: clipped ${c}`) }
      }
      expect(problems, problems.join('\n')).toEqual([])
    })

    test(`${vp.name} ${vp.width}px: conversation header actions are reachable`, async () => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await openFirstConversation()

      const a = await auditLayout(page)
      expect(a.unreachable, a.unreachable.join('\n')).toEqual([])
      const actions = await page
        .locator('.header-actions > *')
        .evaluateAll(
          (els, w) =>
            els.filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.getBoundingClientRect().right <= w),
          vp.width
        )
      expect(actions.length).toBeGreaterThan(0)
      expect(actions.every(Boolean)).toBe(true)
    })
  }

  test('phone with the on-screen keyboard open keeps the reply box and a usable message area', async () => {
    // An on-screen keyboard takes ~300px of an 812px phone; the visual viewport shrinks to ~512px.
    await page.setViewportSize({ width: 375, height: 512 })
    await openFirstConversation()

    const m = await page.evaluate(() => {
      const input = document.querySelector('textarea')!.getBoundingClientRect()
      const list = document.querySelector('.messages-container-wrapper')!.getBoundingClientRect()
      return { inputBottom: input.bottom, inputTop: input.top, listHeight: list.height, vh: window.innerHeight }
    })
    expect(m.inputTop).toBeGreaterThanOrEqual(0)
    expect(m.inputBottom).toBeLessThanOrEqual(m.vh)
    expect(m.listHeight, `message area is only ${m.listHeight}px`).toBeGreaterThanOrEqual(150)
  })
})
