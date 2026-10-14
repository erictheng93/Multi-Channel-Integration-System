import { test, expect, type Page } from '@playwright/test'
import { ADMIN_CREDENTIALS, login } from '../helpers/auth'
import { ROUTES, VIEWPORTS, auditLayout, spaNavigate, waitForFirstConversation } from '../helpers/rwd'

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
// Optional: open this customer's conversation instead of whichever is first (e.g. a LINE user).
const TARGET_CUSTOMER = process.env.E2E_CONVERSATION_CUSTOMER?.trim()

test.describe.configure({ mode: 'serial' })

test.describe('responsive layout sweep', () => {
  test.skip(!credentials.password, 'set E2E_EMAIL + E2E_PASSWORD (or ADMIN_PASSWORD)')
  test.setTimeout(240_000)

  let page: Page

  test.beforeAll(async ({ browser, baseURL, contextOptions, serviceWorkers, actionTimeout, navigationTimeout }) => {
    page = await browser.newPage({ ...contextOptions, baseURL, serviceWorkers })
    page.setDefaultTimeout(actionTimeout)
    page.setDefaultNavigationTimeout(navigationTimeout)
    await login(page, credentials)
  })

  test.afterAll(async () => {
    await page?.close()
  })

  /** Opens the first conversation this account can see (or E2E_CONVERSATION_CUSTOMER's); false when there is none. */
  async function openFirstConversation(): Promise<boolean> {
    await spaNavigate(page, '/conversations')
    if (TARGET_CUSTOMER) {
      const input = page.getByPlaceholder('輸入客戶名稱...')
      if (!(await input.isVisible())) { await page.locator('.filter-trigger').click() }
      await input.fill(TARGET_CUSTOMER)
      await page.waitForTimeout(1_500) // 300ms debounce + list refetch
    }
    const row = await waitForFirstConversation(page)
    if (!row) { return false }
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

  // The pause pill is the widest thing the top bar can gain. Measure it in the real app
  // shell (real AppTopBar, 68px hamburger gutter on phones) at every viewport. The pause
  // state is per-browser localStorage of this throwaway context; nothing server-side changes.
  const PREFS_KEY = 'desktop-notification-prefs'
  const setPause = (paused: boolean) =>
    page.evaluate(
      ([key, on]) => {
        const prefs = JSON.parse(localStorage.getItem(key as string) ?? '{}')
        localStorage.setItem(
          key as string,
          JSON.stringify({ ...prefs, enabled: true, pausedUntil: on ? Date.now() + 3_600_000 : null })
        )
        // `storage` only fires in other tabs; dispatch it so the singleton re-reads without a reload.
        window.dispatchEvent(new window.StorageEvent('storage', { key: key as string }))
      },
      [PREFS_KEY, paused] as const
    )

  for (const vp of VIEWPORTS) {
    test(`${vp.name} ${vp.width}px: paused-notification pill keeps the top bar reachable`, async () => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await spaNavigate(page, '/dashboard')
      await page.waitForTimeout(800)
      test.skip(new URL(page.url()).pathname !== '/dashboard', 'this account cannot open /dashboard')

      await setPause(true)
      try {
        const pill = page.getByTestId('desktop-paused-pill')
        await pill.waitFor({ state: 'visible', timeout: 5_000 })

        const a = await auditLayout(page)
        expect(a.documentOverflow, 'top bar pushed the page sideways').toBeLessThanOrEqual(0)
        expect(a.unreachable, a.unreachable.join('\n')).toEqual([])

        const boxes = await page.evaluate(() =>
          ['[data-testid="desktop-paused-pill"]', '.notification-trigger', '.top-bar-actions'].map((sel) => {
            const r = document.querySelector(sel)?.getBoundingClientRect()
            return { sel, left: r?.left ?? NaN, right: r?.right ?? NaN, width: r?.width ?? 0 }
          })
        )
        for (const b of boxes) {
          expect(b.width, `${b.sel} is not rendered`).toBeGreaterThan(0)
          expect(b.left, `${b.sel} starts left of the viewport`).toBeGreaterThanOrEqual(0)
          expect(b.right, `${b.sel} ends right of the viewport`).toBeLessThanOrEqual(vp.width + 1)
        }
        // The bell is the control that matters while paused: it must keep its 40px target.
        const bell = boxes.find((b) => b.sel === '.notification-trigger')!
        expect(Math.round(bell.width)).toBeGreaterThanOrEqual(40)
      } finally {
        await setPause(false)
      }
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
    const summary = `customer=${TARGET_CUSTOMER ?? '(first conversation)'} messageArea=${m.listHeight}px viewport=${m.vh}px`
    test.info().annotations.push({ type: 'keyboard-viewport', description: summary })
    console.log(`[keyboard-viewport] ${summary}`)
    expect(m.inputTop).toBeGreaterThanOrEqual(0)
    expect(m.inputBottom).toBeLessThanOrEqual(m.vh)
    expect(m.listHeight, `message area is only ${m.listHeight}px`).toBeGreaterThanOrEqual(150)
  })
})
