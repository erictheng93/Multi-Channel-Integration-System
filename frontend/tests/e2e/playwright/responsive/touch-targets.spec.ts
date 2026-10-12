import { test, expect, type Page } from '@playwright/test'

/**
 * Hermetic: the global button/field system must reach the 44px touch target on
 * coarse pointers (Apple HIG) and keep its compact size with a mouse.
 * Probes are injected into /login, which only needs the Vite dev server, not an
 * authenticated session, and loads the same global style.css as every page.
 */
async function heights(page: Page): Promise<Record<string, number>> {
  await page.goto('/login')
  await page.evaluate(() => {
    const make = (tag: string, id: string, cls: string): void => {
      const el = document.createElement(tag)
      el.id = id
      el.className = cls
      if (tag === 'button') { el.textContent = 'x' }
      if (tag === 'select') { el.appendChild(document.createElement('option')) }
      document.body.appendChild(el)
    }
    make('button', 'p-btn', 'btn btn-sm')
    make('input', 'p-input', 'form-input')
    make('select', 'p-select', 'form-select')
  })
  return page.evaluate(() =>
    Object.fromEntries(
      ['p-btn', 'p-input', 'p-select'].map((id) => [
        id,
        Math.round(document.getElementById(id)!.getBoundingClientRect().height),
      ])
    )
  )
}

test.describe('touch targets', () => {
  test.describe('coarse pointer (phone)', () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } })

    test('buttons and fields are at least 44px tall', async ({ page }) => {
      const h = await heights(page)
      expect(h['p-btn']).toBeGreaterThanOrEqual(44)
      expect(h['p-input']).toBeGreaterThanOrEqual(44)
      expect(h['p-select']).toBeGreaterThanOrEqual(44)
    })
  })

  test.describe('fine pointer (desktop)', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('small buttons keep their compact size', async ({ page }) => {
      const h = await heights(page)
      expect(h['p-btn']).toBeLessThan(44)
    })
  })
})
