import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    reporters: process.env.CI ? ['verbose'] : ['default'],
    silent: process.env.CI ? 'passed-only' : false,
    setupFiles: ['./vitest.setup.ts'],
    // Increase timeouts for async dialog and toast tests
    // Multiple dialogs with 300ms cleanup animations require extended timeout
    testTimeout: 20000, // 20 seconds (for tests creating 20+ dialogs with cleanup)
    hookTimeout: 20000, // 20 seconds for setup/teardown hooks
    // 確保 DOM 事件正確處理
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        url: 'http://localhost:3000',
        pretendToBeVisual: true,
        runScripts: 'dangerously'
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'src/test/',
        '**/*.d.ts',
        '**/*.test.{ts,js}',
        '**/*.spec.{ts,js}',
        '**/index.ts',
      ],
      // Ratchet floor = measured coverage on 2026-11-05 (62/53.6/58.6/62.5) minus ~1pt,
      // because merged shard coverage jitters by a few hundredths.
      // Raise it as coverage grows; long-term goal is 80. CI checks it once on the
      // merged shard reports (see test-frontend in ci-cd.yml), never per shard.
      thresholds: {
        statements: 61,
        branches: 52,
        functions: 57,
        lines: 61,
      }
    },
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', 'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'tests/e2e/playwright/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@shared': resolve(__dirname, '../shared')
    }
  }
})
