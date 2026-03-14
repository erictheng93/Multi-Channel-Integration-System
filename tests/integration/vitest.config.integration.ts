/**
 * Vitest Configuration for REAL Integration Tests
 *
 * This configuration is for TRUE integration testing with:
 * - Real Remote D1 Database
 * - Real KV Namespaces
 * - Real R2 Buckets
 * - Real Durable Objects
 *
 * Tests using this config connect to PRODUCTION REMOTE resources
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'integration-real',
    globals: true,
    environment: 'node',

    // Integration tests are slower due to real network calls
    testTimeout: 30000, // 30 seconds per test
    hookTimeout: 60000, // 60 seconds for setup/teardown

    // Run tests sequentially to avoid race conditions with real DB
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true // One test at a time for database consistency
      }
    },

    // Setup files
    setupFiles: ['./vitest.setup.integration.ts'],

    // Only run integration tests
    include: ['**/*.integration.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.archive/**'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/handlers/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/node_modules/**',
        '**/dist/**'
      ]
    },

    // Reporters
    reporters: ['verbose'],

    // Retry failed tests once (network issues with remote resources)
    retry: 1
  },

  resolve: {
    alias: {
      '@backend': path.resolve(__dirname, '../../src'),
      '@shared': path.resolve(__dirname, '../../src'),
      '@modules': path.resolve(__dirname, '../../src/modules'),
      '@helpers': path.resolve(__dirname, '../helpers'),
      '@integration': path.resolve(__dirname, '../integration')
    }
  }
});
