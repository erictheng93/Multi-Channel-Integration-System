import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Test file patterns for database tests
    include: [
      'tests/unit/utils/database*.test.ts'
    ],
    
    // Exclude non-database tests
    exclude: [
      'tests/unit/utils/line*.test.ts',
      'node_modules/**',
      'dist/**'
    ],
    
    // Global test configuration
    globals: true,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './coverage/database',
      include: [
        'src/utils/database.ts'
      ],
      exclude: [
        'tests/**',
        'node_modules/**'
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    },
    
    // Test timeout (important for performance tests)
    testTimeout: 30000,
    
    // Hook timeout
    hookTimeout: 10000,
    
    // Reporter configuration
    reporter: ['verbose', 'json'],
    
    // Retry failed tests (useful for performance tests)
    retry: 1,
    
    // Run tests in sequence for database tests to avoid conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, '../../../src'),
      '@tests': resolve(__dirname, '../../')
    }
  }
})