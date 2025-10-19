import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Root Vitest Configuration
 * For running backend tests from root directory
 *
 * Frontend tests use frontend/vitest.config.ts
 * Full test suite uses tests/vitest.config.ts
 */
export default defineConfig({
  resolve: {
    alias: {
      // Backend source aliases
      '@': path.resolve(__dirname, './src'),
      '@backend': path.resolve(__dirname, './src'), // ✅ Added for test imports
      '@modules': path.resolve(__dirname, './src/modules'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@infrastructure': path.resolve(__dirname, './src/infrastructure'),
      '@auth': path.resolve(__dirname, './src/modules/auth'),
      '@conversations': path.resolve(__dirname, './src/modules/conversations'),
      '@teams': path.resolve(__dirname, './src/modules/teams'),
      '@customer': path.resolve(__dirname, './src/modules/customer'),
      '@integrations': path.resolve(__dirname, './src/modules/integrations'),
      '@real-time': path.resolve(__dirname, './src/modules/real-time'),
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
    // No setupFiles - backend tests don't need Vue/Pinia setup
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts'
    ],
    exclude: [
      'node_modules/**',
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
    hookTimeout: 10000
  },
  esbuild: {
    target: 'node18'
  }
})
