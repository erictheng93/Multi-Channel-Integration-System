import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  plugins: [
    // Workers runtime for all tests. Options that used to live under
    // test.poolOptions.workers move here (vitest-pool-workers 0.13+).
    cloudflareTest({
      wrangler: {
        configPath: './wrangler.test.toml'
      },
      main: './src/index.ts',
      // isolatedStorage removed in 0.13+: storage is now isolated per test
      // file by Vitest's own model, which is what these tests relied on.
      miniflare: {
        verbose: false,
        compatibilityFlags: ['nodejs_compat']
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    // Exclude DO tests on Windows due to file locking issues with Miniflare SQLite
    // These tests run successfully on Linux/macOS CI
    // Use INCLUDE_DO_TESTS=true to include them (e.g., bun run test:ci)
    exclude: [
      'node_modules',
      'dist',
      ...(process.env.INCLUDE_DO_TESTS !== 'true' && process.platform === 'win32'
        ? ['tests/integration/durable-objects/**/*.test.ts']
        : [])
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**'
      ]
    },
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
