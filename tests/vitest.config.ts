import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../frontend/src'),
      '~': path.resolve(__dirname, '../'),
      '@backend': path.resolve(__dirname, '../src'),
      '@modules': path.resolve(__dirname, '../src/modules'),
      '@real-time': path.resolve(__dirname, '../src/modules/realtime'),
      '@tests': path.resolve(__dirname, './'),
      '@helpers': path.resolve(__dirname, './helpers'),
      // Bun SQLite adapter - use bun:sqlite when running with Bun
      'better-sqlite3': typeof Bun !== 'undefined'
        ? path.resolve(__dirname, './helpers/bun-sqlite-adapter.ts')
        : 'better-sqlite3'
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./global-pinia-setup.ts', './vitest.setup.ts'],
    // 明確指定測試文件模式
    include: [
      '**/*.test.ts',
      '**/*.spec.ts',
      'unit/**/*.test.ts',
      'integration/**/*.test.ts'
    ],
    exclude: [
      'node_modules/**',
      '**/node_modules/**',
      'dist/**',
      'coverage/**',
      '**/*.d.ts',
      '**/*.config.*'
    ],
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        url: 'http://localhost:3000'
      }
    },
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
        '**/vitest.setup.ts'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    // 增加超時時間
    testTimeout: 10000,
    hookTimeout: 10000
  },
  // 增加 esbuild 選項以支援舊版語法
  esbuild: {
    target: 'node14'
  }
})