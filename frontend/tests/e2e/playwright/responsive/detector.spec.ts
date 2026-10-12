import { test, expect } from '@playwright/test'
import { auditLayoutInPage } from '../helpers/rwd'

/**
 * Hermetic: proves the layout detector actually catches the failure classes it
 * exists for, using planted regressions. No login, no backend.
 * A detector that cannot fail makes the route sweep meaningless.
 */
const RESET = '<style>body{margin:0}</style>'

test.describe('layout detector', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('flags a button pushed off-screen inside an overflow:hidden parent', async ({ page }) => {
    await page.setContent(`${RESET}
      <div style="width:375px;overflow:hidden">
        <div style="display:flex;width:766px">
          <button id="far" style="margin-left:482px">Assign</button>
        </div>
      </div>`)
    const audit = await page.evaluate(auditLayoutInPage)
    expect(audit.unreachable.join()).toContain('button')
    expect(audit.clipped.length).toBeGreaterThan(0)
    expect(audit.documentOverflow).toBe(0) // the page itself looks fine: that is the trap
  })

  test('flags page-level horizontal overflow', async ({ page }) => {
    await page.setContent('<div style="width:600px;height:10px"></div>')
    const audit = await page.evaluate(auditLayoutInPage)
    expect(audit.documentOverflow).toBeGreaterThan(0)
  })

  test('flags a page root that shrink-wraps inside the flex-column page container', async ({ page }) => {
    // max-width + auto margins and no width: sized to its (short) content, not to the column
    await page.setContent(`${RESET}
      <div class="page-content" style="display:flex;flex-direction:column;padding:16px">
        <div class="settings-root" style="max-width:900px;margin:0 auto"><p>short</p></div>
      </div>`)
    const audit = await page.evaluate(auditLayoutInPage)
    expect(audit.shrinkWrapped.join()).toContain('settings-root')
  })

  test('passes a page root that sets width: 100%', async ({ page }) => {
    await page.setContent(`${RESET}
      <div class="page-content" style="display:flex;flex-direction:column;padding:16px">
        <div class="settings-root" style="width:100%;max-width:900px;margin:0 auto"><p>short</p></div>
      </div>`)
    const audit = await page.evaluate(auditLayoutInPage)
    expect(audit.shrinkWrapped).toEqual([])
  })

  test('flags values that leaked to the UI unformatted', async ({ page }) => {
    await page.setContent('<div class="page-content"><span>0.0001414069537075366</span> <span>NaN</span></div>')
    const audit = await page.evaluate(auditLayoutInPage)
    expect(audit.rawValues).toEqual(['0.0001414069537075366', 'NaN'])
  })

  test('does not flag a decorative pseudo-element clipped inside an overflow:hidden button', async ({ page }) => {
    // the loading shimmer on RefreshButton: ::before slides across, the label itself fits
    await page.setContent(`${RESET}
      <style>
        .shimmer { position: relative; overflow: hidden; }
        .shimmer::before { content: ''; position: absolute; left: 0; top: 0; width: 400px; height: 100%; transform: translateX(100%); }
      </style>
      <button class="shimmer" style="width:128px">refreshing</button>`)
    const audit = await page.evaluate(auditLayoutInPage)
    expect(audit.clipped).toEqual([])
  })

  test('still flags real content cut by overflow:hidden without an ellipsis', async ({ page }) => {
    await page.setContent(`${RESET}
      <div class="cut" style="width:60px;overflow:hidden;white-space:nowrap">a label that does not fit and is silently cut</div>`)
    const audit = await page.evaluate(auditLayoutInPage)
    expect(audit.clipped.join()).toContain('cut')
  })

  test('passes a layout that wraps, scrolls or truncates on purpose', async ({ page }) => {
    await page.setContent(`${RESET}
      <div style="display:flex;flex-wrap:wrap;gap:8px"><button>A</button><button>B</button><button>C</button></div>
      <div style="width:375px;overflow-x:auto"><div style="width:900px"><button>in scroller</button></div></div>
      <div style="width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">a very long label that is truncated deliberately</div>
      <p class="page-content">452ms 0.00% 23 connections</p>`)
    const audit = await page.evaluate(auditLayoutInPage)
    expect(audit.documentOverflow).toBe(0)
    expect(audit.unreachable).toEqual([])
    expect(audit.clipped).toEqual([])
    expect(audit.shrinkWrapped).toEqual([])
    expect(audit.rawValues).toEqual([])
  })
})
