/**
 * ============================================================================
 * Pixel VRT — the gate
 * ============================================================================
 *
 * One screenshot assertion per component state, against the standalone harness
 * page. No backend, no login, no production data: the harness mounts real
 * components with fixed props, and this spec additionally aborts every request
 * that is not served by the local harness dev server.
 *
 * Purpose: catch layout/appearance regressions that `vue-tsc`, ESLint, Vitest
 * and `vite build` all pass straight through — Tailwind major upgrades,
 * PostCSS/autoprefixer changes, Vite CSS-pipeline changes, Vue render changes.
 *
 * File is named `.vrt.ts` rather than `.spec.ts` so `frontend/vitest.config.ts`
 * (which collects `tests/**` + `*.spec.ts`) does not try to run it under jsdom.
 * ============================================================================
 */

import { expect, test, type Locator, type Page } from '@playwright/test'
import { HARNESS_ORIGIN, HARNESS_URL } from './harness-server'
import { VRT_STATES, VRT_STATE_IDS } from './state-ids'

/** URLs the harness tried to fetch from somewhere other than itself. */
const offOriginRequests: string[] = []

/**
 * Hard network fence.
 *
 * The harness is supposed to be hermetic; this proves it rather than trusting
 * it. Anything not served by the local dev server (and not an inline `data:` /
 * `blob:` URL) is aborted and recorded, and `network-is-hermetic` below fails
 * the suite if the list is non-empty. That is the guard that stops someone
 * later adding a fixture which quietly calls the production Worker.
 */
async function fenceNetwork(page: Page): Promise<void> {
  await page.route('**/*', route => {
    const url = route.request().url()
    if (url.startsWith(HARNESS_ORIGIN) || url.startsWith('data:') || url.startsWith('blob:')) {
      return route.continue()
    }
    offOriginRequests.push(url)
    return route.abort()
  })
}

/** Navigate and wait for a fully settled, deterministic first paint. */
async function openHarness(page: Page): Promise<void> {
  const consoleErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', error => {
    consoleErrors.push(error.message)
  })

  await fenceNetwork(page)
  await page.goto(HARNESS_URL, { waitUntil: 'load' })

  // Set by harness/main.ts immediately after `app.mount()`.
  await page.waitForSelector('html[data-vrt-ready="true"]', { state: 'attached' })

  // No webfonts are loaded, but this also covers a future one being added.
  await page.evaluate(() => document.fonts.ready.then(() => undefined))

  // Two animation frames: guarantees style resolution + one composited paint
  // has happened. Cheaper and far more reliable than a fixed sleep.
  await page.evaluate(
    () =>
      new Promise<void>(resolve => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
      })
  )

  // A component that throws during setup renders an empty box, and an empty box
  // screenshots perfectly consistently — which would make the gate pass while
  // testing nothing. Fail loudly instead.
  expect(consoleErrors, 'harness must mount without console errors').toEqual([])
}

/** Scroll a state into view and wait for any image inside it to be decoded. */
async function settleState(page: Page, locator: Locator, id: string): Promise<void> {
  await locator.scrollIntoViewIfNeeded()
  await page.waitForFunction(stateId => {
    const el = document.querySelector(`[data-vrt-state="${stateId}"]`)
    if (!el) {
      return false
    }
    return Array.from(el.querySelectorAll('img')).every(
      img => img.complete && img.naturalWidth > 0
    )
  }, id)
}

test.describe('pixel visual regression', () => {
  test('manifest matches the rendered harness', async ({ page }) => {
    await openHarness(page)

    const renderedIds = await page
      .locator('[data-vrt-state]')
      .evaluateAll(nodes => nodes.map(node => node.getAttribute('data-vrt-state') ?? ''))

    // Catches a state added to the manifest but never wired up, a duplicate id,
    // and a renderer that silently failed to mount.
    expect(renderedIds).toEqual([...VRT_STATE_IDS])
    expect(new Set(renderedIds).size, 'state ids must be unique').toBe(renderedIds.length)
  })

  /**
   * FALSE-GREEN GUARD.
   *
   * A pixel suite's worst failure mode is not a false alarm, it is a baseline
   * recorded against CSS that never loaded. An unstyled element screenshots just
   * as consistently as a styled one, so the suite would stay green forever while
   * measuring nothing.
   *
   * This asserts a handful of load-bearing design-system tokens actually made it
   * to the browser, sampled from the computed styles of real rendered nodes:
   *   - iOS accent colours on the global button system
   *   - a `@layer components` rule that is defined in style.css but used nowhere
   *     in `src/` (`.btn-warning`), which Tailwind's content-scanning would
   *     otherwise purge — this is exactly the trap the harness Tailwind config
   *     exists to close
   *   - `@apply`-derived geometry on a component's scoped style (`.team-card`)
   */
  test('design system CSS is actually applied', async ({ page }) => {
    await openHarness(page)

    const sample = await page.evaluate(() => {
      const read = (selector: string, property: string): string => {
        const el = document.querySelector(selector)
        if (!el) {
          return `MISSING:${selector}`
        }
        return window.getComputedStyle(el).getPropertyValue(property).trim()
      }
      const stage = (id: string) => `[data-vrt-state="${id}"]`
      return {
        primaryBg: read(`${stage('buttons-variants')} .btn-primary`, 'background-color'),
        dangerBg: read(`${stage('buttons-variants')} .btn-danger`, 'background-color'),
        successBg: read(`${stage('buttons-variants')} .btn-success`, 'background-color'),
        // Purge canary: defined in style.css, referenced nowhere in src/.
        warningBg: read(`${stage('buttons-variants')} .btn-warning`, 'background-color'),
        btnRadius: read(`${stage('buttons-variants')} .btn-primary`, 'border-radius'),
        // `@apply ... rounded-2xl ...` inside TeamCard's scoped style.
        teamCardRadius: read(`${stage('team-card-active')} .team-card`, 'border-radius'),
      }
    })

    expect(sample.primaryBg, 'btn-primary must be iOS system blue').toBe('rgb(0, 122, 255)')
    expect(sample.dangerBg, 'btn-danger must be iOS system red').toBe('rgb(255, 59, 48)')
    expect(sample.successBg, 'btn-success must be iOS system green').toBe('rgb(52, 199, 89)')
    expect(sample.warningBg, 'btn-warning must be iOS system orange').toBe('rgb(255, 149, 0)')
    expect(sample.btnRadius, '.btn radius must be 12px').toBe('12px')
    expect(sample.teamCardRadius, '.team-card @apply rounded-2xl must be 16px').toBe('16px')
  })

  test('network is hermetic', async ({ page }) => {
    await openHarness(page)
    expect(
      offOriginRequests,
      'the harness must not request anything off its own origin'
    ).toEqual([])
  })

  for (const state of VRT_STATES) {
    test(`${state.group} / ${state.id}`, async ({ page }) => {
      await openHarness(page)

      const locator = page.locator(`[data-vrt-state="${state.id}"]`)
      await expect(locator).toBeVisible()
      await settleState(page, locator, state.id)

      // Tolerance comes from `expect.toHaveScreenshot` in the config.
      await expect(locator).toHaveScreenshot(`${state.id}.png`)
    })
  }
})
