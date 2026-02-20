import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E Test Configuration
 *
 * Tests run against the local Vite dev server (http://localhost:5173)
 * which proxies /api requests to the remote production backend.
 *
 * Usage:
 *   npx playwright test                    # Run all tests
 *   npx playwright test --ui               # Interactive UI mode
 *   npx playwright test tests/e2e/auth     # Run auth tests only
 *   npx playwright test --headed           # Run with browser visible
 */
export default defineConfig({
  testDir: './tests/e2e/playwright',
  fullyParallel: false, // Run sequentially — tests share remote DB state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker — remote backend, no test isolation
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }]
  ],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Expect the dev server to already be running
  // Start with: cd frontend && npm run dev
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30000,
  },
})
