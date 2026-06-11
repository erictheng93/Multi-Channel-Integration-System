import { defineConfig } from 'vitest/config'
import path from 'path'
import { loadEnv } from 'vite'

/**
 * Root Vitest Configuration
 * For running backend tests from root directory
 *
 * Frontend tests use frontend/vitest.config.ts
 * Full test suite uses tests/vitest.config.ts
 */
export default defineConfig(({ mode }) => {
  // Load test environment variables from tests/.env.test
  const env = loadEnv(mode, path.resolve(__dirname, 'tests'), '')

  // Make test env vars available to process.env
  Object.assign(process.env, env)

  return {
  resolve: {
    alias: {
      // Backend source aliases
      '@': path.resolve(__dirname, './src'),
      '@backend': path.resolve(__dirname, './src'), //  Added for test imports
      '@modules': path.resolve(__dirname, './src/modules'),
      '@shared': path.resolve(__dirname, './shared'),
      '@infrastructure': path.resolve(__dirname, './src/infrastructure'),
      '@auth': path.resolve(__dirname, './src/modules/auth'),
      '@conversations': path.resolve(__dirname, './src/modules/conversations'),
      '@teams': path.resolve(__dirname, './src/modules/teams'),
      '@customer': path.resolve(__dirname, './src/modules/customer'),
      '@integrations': path.resolve(__dirname, './src/modules/integrations'),
      '@real-time': path.resolve(__dirname, './src/modules/realtime'),
      '@messaging': path.resolve(__dirname, './src/modules/messaging'),
      '@analytics': path.resolve(__dirname, './src/modules/analytics'),
      '@file-management': path.resolve(__dirname, './src/modules/file-management'),
      '@activities': path.resolve(__dirname, './src/modules/activities'),
      '@notifications': path.resolve(__dirname, './src/modules/notifications'),
      '@qrcode': path.resolve(__dirname, './src/modules/qrcode'),
      '@reports': path.resolve(__dirname, './src/modules/reports'),
      '@session': path.resolve(__dirname, './src/modules/session'),

      // Test helpers
      '@tests': path.resolve(__dirname, './tests'),
      '@helpers': path.resolve(__dirname, './tests/helpers'),

      // Frontend (for tests that need frontend imports)
      '@frontend': path.resolve(__dirname, './frontend/src')
    }
  },
  test: {
    globals: true,
    environment: 'node', // Backend tests use node environment
    setupFiles: ['./tests/vitest.setup.backend.ts'], // Backend-only setup (no Vue/Pinia)
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts'
    ],
    exclude: [
      'node_modules/**',
      'tests/node_modules/**',
      'dist/**',
      'coverage/**',
      '**/*.d.ts',
      '**/*.config.*',
      'frontend/**' // Frontend has its own test config
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/helpers/**',
        '**/setup.ts',
        '**/vitest.setup.ts',
        'frontend/**'
      ]
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    // Run E2E tests sequentially to avoid Wrangler port conflicts
    // Each E2E test file starts its own dev server
    fileParallelism: false,
    // Isolate tests to prevent state leakage
    isolate: true,
    // Run tests in sequence within each file
    sequence: {
      shuffle: false,
      concurrent: false
    }
  },
  esbuild: {
    target: 'node18'
  },
  envDir: path.resolve(__dirname, 'tests'), // Load env from tests/ directory
  envPrefix: 'TEST_' // Only load vars starting with TEST_
  }
})
