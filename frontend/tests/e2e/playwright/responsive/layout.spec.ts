import { test, expect, type Page } from '@playwright/test'
import { ADMIN_CREDENTIALS, login } from '../helpers/auth'
import { ROUTES, VIEWPORTS, auditLayout, spaNavigate } from '../helpers/rwd'

/**
 * Responsive regression sweep: every route the account can open, at narrow phone /
 * phone / tablet / laptop width, must have no sideways page scroll, no control outside
 * the viewport, no clipped content, no shrink-wrapped page root and no unformatted
 * values; and the reply workspace must stay usable. Read-only: it only navigates.
 *
 * Credentials: E2E_EMAIL + E2E_PASSWORD (a dedicated least-privilege account, what CI
 * uses), or ADMIN_PASSWORD for the admin account like the other e2e specs. A route the
 * account is not allowed to open is redirected away and is skipped, so a least-privilege
 * account sweeps the agent pages; E2E_MIN_ROUTES guards against a sweep that silently
 * audited almost nothing.
 *
 * Logs in ONCE and reuses the page: the login endpoint is rate limited
 * (5 attempts / 5 minutes per IP), so a login per test would trip it.
 */
const credentials = {
  email: process.env.E2E_EMAIL ?? ADMIN_CREDENTIALS.email,
  password: process.env.E2E_PASSWORD ?? ADMIN_CREDENTIALS.password,
}
const MIN_ROUTES = Number(process.env.E2E_MIN_ROUTES ?? 8)

test.describe.configure({ mode: 'serial' })

test.describe('responsive layout sweep', () => {
  test.skip(!credentials.password, 'set E2E_EMAIL + E2E_PASSWORD (or ADMIN_PASSWORD)')
  test.setTimeout(240_000)

  let page: Page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    await login(page, credentials)
  })

  test.afterAll(async () => {
    await page?.close()
  })

  /** Opens the first conversation this account can see; false when there is none. */
  async function openFirstConversation(): Promise<boolean> {
    await spaNavigate(page, '/conversations')
    await page.waitForTimeout(1500)
    // the desktop table and the mobile cards are both in the DOM; only one is visible
    const row = page.locator('.conversation-row:visible, .conversation-card:visible, tbody tr:visible').first()
    if (!(await row.count())) { return false }
    await row.click()
    await page.waitForURL(/\/conversations\/.+/)
    await page.locator('.header-actions').first().waitFor({ timeout: 10_000 })
    return true
  }

  for (const vp of VIEWPORTS) {
    test(`${vp.name} ${vp.width}px: routes have no overflow or unreachable controls`, async () => {
      await page.setViewportSize({ width: vp.width, height: vp.height })

      const problems: string[] = []
      const skipped: string[] = []
      let audited = 0
      for (const route of ROUTES) {
        await spaNavigate(page, route)
        await page.waitForTimeout(1200)
        const landed = new URL(page.url()).pathname
        if (!landed.startsWith(route)) {
          skipped.push(`${route} -> ${landed}`)
          continue
        }
        audited++
        const a = await auditLayout(page)
        if (a.documentOverflow > 0) {
          problems.push(`${route}: page scrolls sideways by ${a.documentOverflow}px`)
        }
        for (const u of a.unreachable) { problems.push(`${route}: unreachable ${u}`) }
        for (const c of a.clipped) { problems.push(`${route}: clipped ${c}`) }
        for (const s of a.shrinkWrapped) { problems.push(`${route}: page root shrink-wraps its content (needs width: 100%) ${s}`) }
        for (const v of a.rawValues) { problems.push(`${route}: unformatted value in the UI: ${v}`) }
      }
      test.info().annotations.push({
        type: 'audited',
        description: `${audited} routes; skipped (no access): ${skipped.join(', ') || 'none'}`,
      })
      expect(problems, problems.join('\n')).toEqual([])
      expect(audited, `only ${audited} routes were reachable (skipped: ${skipped.join(', ')})`).toBeGreaterThanOrEqual(MIN_ROUTES)
    })

    test(`${vp.name} ${vp.width}px: conversation header actions are reachable`, async () => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      const opened = await openFirstConversation()
      test.skip(!opened, 'this account sees no conversation (no team): cannot open the workspace')

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
    const opened = await openFirstConversation()
    test.skip(!opened, 'this account sees no conversation (no team): cannot open the workspace')

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
