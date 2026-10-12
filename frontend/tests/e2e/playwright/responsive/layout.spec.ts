import { test, expect } from '@playwright/test'
import { ADMIN_CREDENTIALS, login } from '../helpers/auth'
import { ROUTES, VIEWPORTS, auditLayout, spaNavigate } from '../helpers/rwd'

/**
 * Responsive regression sweep: every route at phone / tablet / laptop width must
 * have no sideways page scroll, no control outside the viewport and no clipped
 * content. Needs a real session like the other e2e specs (ADMIN_PASSWORD) and is
 * read-only: it only navigates.
 */
test.describe('responsive layout sweep', () => {
  test.skip(!process.env.ADMIN_PASSWORD, 'ADMIN_PASSWORD is not set')
  test.setTimeout(240_000)

  for (const vp of VIEWPORTS) {
    test(`${vp.name} ${vp.width}px: routes have no overflow or unreachable controls`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await login(page, ADMIN_CREDENTIALS)

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

    test(`${vp.name} ${vp.width}px: conversation header actions are reachable`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await login(page, ADMIN_CREDENTIALS)
      await spaNavigate(page, '/conversations')
      await page.waitForTimeout(1500)
      await page.locator('.conversation-row, tbody tr, .conversation-card').first().click()
      await page.waitForURL(/\/conversations\/.+/)
      await page.locator('.header-actions').first().waitFor({ timeout: 10_000 })

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
})
