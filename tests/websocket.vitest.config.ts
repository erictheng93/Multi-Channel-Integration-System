// WebSocket Testing Configuration for Vitest
// Specialized configuration for WebSocket + Durable Objects testing
// Includes performance testing, load testing, and stress testing setup

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment configuration
    name: 'websocket-tests',
    environment: 'node',

    // Test file patterns
    include: [
      'tests/unit/durable-objects/**/*.test.ts',
      'tests/integration/websocket/**/*.test.ts',
      'tests/performance/websocket/**/*.test.ts',
      'tests/e2e/websocket/**/*.test.ts',
      'tests/stress/websocket/**/*.test.ts'
    ],

    // Global test configuration
    globals: true,
    clearMocks: true,
    restoreMocks: true,

    // Test timeouts - extended for performance and stress tests
    testTimeout: 120000, // 2 minutes for individual tests
    hookTimeout: 30000,  // 30 seconds for setup/teardown

    // Test execution configuration
    threads: false, // Disable threading for more predictable performance testing
    maxConcurrency: 1, // Run performance tests sequentially

    // Test reporters
    reporters: [
      'default',
      'verbose',
      ['junit', { outputFile: 'test-results/websocket-tests.xml' }],
      ['json', { outputFile: 'test-results/websocket-results.json' }],
      ['html', { outputFile: 'test-results/websocket-report.html' }]
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: 'coverage/websocket',
      include: [
        'src/durable-objects/**/*.ts',
        'src/services/websocket-broadcast-service.ts',
        'src/services/distributed-lock-service.ts',
        'src/types/websocket-types.ts'
      ],
      exclude: [
        'tests/**',
        'node_modules/**',
        '**/*.d.ts',
        '**/*.config.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85
        },
        // Stricter thresholds for critical components
        'src/durable-objects/': {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95
        }
      }
    },

    // Setup files
    setupFiles: [
      './tests/helpers/websocket/websocket-test-setup.ts'
    ],

    // Global test configuration
    globalSetup: './tests/helpers/websocket/global-test-setup.ts',

    // Test sequence configuration for performance tests
    sequence: {
      hooks: 'stack',
      shuffle: false // Keep deterministic order for performance comparison
    },

    // Memory and resource limits
    pool: 'forks',
    poolOptions: {
      forks: {
        isolate: true,
        singleFork: true, // Important for stress testing
      }
    },

    // Retry configuration for flaky network tests
    retry: {
      // Regular tests get 1 retry
      count: 1,
      // Performance tests don't retry (for accurate measurements)
      skipIf: (ctx) => ctx.meta.name?.includes('performance') ||
                      ctx.meta.name?.includes('stress')
    },

    // Test filtering by tags
    grep: process.env.TEST_GREP,

    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
      TEST_MODE: 'websocket',
      WEBSOCKET_TEST_TIMEOUT: '120000',
      PERFORMANCE_TEST_MODE: process.env.PERFORMANCE_TEST_MODE || 'normal',
      STRESS_TEST_ENABLED: process.env.STRESS_TEST_ENABLED || 'false',
      MEMORY_MONITORING: 'true',
      TEST_PARALLEL: 'false'
    }
  },

  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests'),
      '@helpers': resolve(__dirname, './tests/helpers')
    }
  },

  // Build configuration for test dependencies
  esbuild: {
    target: 'node18',
    format: 'esm'
  },

  // Define global constants for tests
  define: {
    __TEST_ENV__: '"websocket"',
    __PERFORMANCE_MODE__: 'process.env.PERFORMANCE_TEST_MODE === "benchmark"',
    __STRESS_MODE__: 'process.env.STRESS_TEST_ENABLED === "true"'
  }
});