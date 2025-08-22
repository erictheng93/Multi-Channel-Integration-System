// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/tests/helpers/pinia-test-helper.ts
// Created by: Test Helper Developer

import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'

/**
 * Create a test Pinia instance for testing
 */
export function createTestPinia() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return pinia
}

/**
 * Setup test environment with mocks
 */
export function setupTestEnvironment() {
  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  }
  
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true
  })

  // Mock window object
  Object.defineProperty(window, 'location', {
    value: {
      href: '',
      reload: vi.fn()
    },
    writable: true
  })

  // Setup global Pinia instance
  createTestPinia()

  return {
    localStorageMock
  }
}

/**
 * Reset test environment
 */
export function resetTestEnvironment() {
  vi.clearAllMocks()
  createTestPinia()
}