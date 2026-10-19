import { expect, test } from '@playwright/test'

test('the visible pause status updates when midnight passes', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 9, 13, 23, 59, 59) })
  await page.goto('/tests/e2e/playwright/fixtures/notification-topbar.html')
  const pill = page.getByTestId('desktop-paused-pill')
  await expect(pill).toHaveAttribute('aria-label', '已暫停 · 至 明天 09:00')
  await page.clock.runFor(1000)
  await expect(pill).toHaveAttribute('aria-label', '已暫停 · 至 09:00')
})

for (const width of [320, 375, 768, 1280]) {
  test(`paused notification controls stay reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 })
    await page.goto('/tests/e2e/playwright/fixtures/notification-topbar.html')
    const pill = page.getByTestId('desktop-paused-pill')
    await expect(pill).toBeVisible()
    await expect(pill).toHaveAttribute('aria-label', /已暫停 · 至/)
    await expect(page.locator('.notification-paused-compact')).toBeVisible({
      visible: width <= 768,
    })
    const measurements = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      controls: Array.from(
        document.querySelectorAll(
          '.notification-paused-pill, .notification-trigger, .status-indicator'
        )
      ).map(el => {
        const box = el.getBoundingClientRect()
        return { left: box.left, right: box.right, width: box.width }
      }),
    }))
    expect(measurements.overflow).toBeLessThanOrEqual(0)
    for (const control of measurements.controls) {
      expect(control.left).toBeGreaterThanOrEqual(0)
      expect(control.right).toBeLessThanOrEqual(width)
      expect(control.width).toBeGreaterThan(0)
    }
    const bell = await page.locator('.notification-trigger').boundingBox()
    expect(bell!.width).toBe(40)
  })
}
