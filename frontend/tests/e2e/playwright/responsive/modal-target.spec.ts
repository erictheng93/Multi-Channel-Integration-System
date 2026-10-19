import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'

const modal = readFileSync(new URL('../../../../src/components/ui/Modal.vue', import.meta.url), 'utf8')
const styles = modal.match(/<style scoped>([\s\S]*?)<\/style>/)![1]

test.use({ hasTouch: true, viewport: { width: 375, height: 812 } })

test('modal close target stays at least 44px with a long unbroken title on touch screens', async ({ page }) => {
  // Exercise the component's real CSS with the same header structure, without a login/backend.
  await page.setContent(`
    <style>${styles}</style>
    <div class="modal-container">
      <div class="modal-header">
        <div class="modal-title"><h3>${'LongDynamicTeamName'.repeat(20)} 詳細資訊</h3></div>
        <button class="modal-close-btn" aria-label="關閉">
          <svg width="24" height="24" viewBox="0 0 24 24"><path d="M6 6L18 18M6 18L18 6" /></svg>
        </button>
      </div>
    </div>
  `)
  expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(true)
  const target = await page.getByRole('button', { name: '關閉' }).boundingBox()
  expect(target?.width).toBeGreaterThanOrEqual(44)
  expect(target?.height).toBeGreaterThanOrEqual(44)
})
