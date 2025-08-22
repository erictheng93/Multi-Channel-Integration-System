import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
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
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../frontend/src'),
      '~': path.resolve(__dirname, '../'),
      '@backend': path.resolve(__dirname, '../src'),
      '@shared': path.resolve(__dirname, '../shared'),
      '@tests': path.resolve(__dirname, './'),
      '@helpers': path.resolve(__dirname, './helpers')
    }
  },
  // 增加 esbuild 選項以支援舊版語法
  esbuild: {
    target: 'node14'
  }
})