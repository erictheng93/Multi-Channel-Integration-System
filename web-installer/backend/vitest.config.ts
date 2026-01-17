import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import path from 'path';

export default defineWorkersConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    globals: true,
    // Use Workers runtime for all tests
    poolOptions: {
      workers: {
        wrangler: {
          configPath: './wrangler.test.toml'
        },
        main: './src/index.ts',
        // Enable isolated storage for test isolation
        // Note: Some DO tests may need to be skipped on Windows due to file locking
        isolatedStorage: true,
        // Miniflare options for additional configuration
        miniflare: {
          // Enable verbose logging for debugging
          verbose: false,
          // Compatibility flags
          compatibilityFlags: ['nodejs_compat']
        }
      }
    },
    // Test configuration
    include: ['tests/**/*.test.ts'],
    // Exclude DO tests on Windows due to file locking issues with Miniflare SQLite
    // These tests run successfully on Linux/macOS CI
    // Use INCLUDE_DO_TESTS=true to include them (e.g., npm run test:ci)
    exclude: [
      'node_modules',
      'dist',
      // DO tests excluded unless INCLUDE_DO_TESTS=true (for CI)
      ...(process.env.INCLUDE_DO_TESTS !== 'true' && process.platform === 'win32'
        ? ['tests/integration/durable-objects/**/*.test.ts']
        : [])
    ],
    // Coverage configuration
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
    // Timeout for tests (DO operations may take longer)
    testTimeout: 30000,
    // Hook timeout
    hookTimeout: 30000
  }
});
