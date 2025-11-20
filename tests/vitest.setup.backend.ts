// Backend Test Setup
// Minimal setup for Node.js backend tests (no Vue/Pinia dependencies)

import { beforeEach, vi } from 'vitest'
import { webcrypto } from 'node:crypto'

// ✅ Crypto polyfill for Node.js test environment
// This must be set BEFORE any imports that use crypto
// Use webcrypto as the global crypto object
if (!global.crypto) {
  (global as any).crypto = webcrypto
}
if (!globalThis.crypto) {
  (globalThis as any).crypto = webcrypto
}

// Setup WebSocketPair globally for Durable Objects tests
if (typeof globalThis.WebSocketPair === 'undefined') {
  (globalThis as any).WebSocketPair = class WebSocketPair {
    0: any;
    1: any;
    constructor() {
      // Create two mock WebSocket objects
      const createMockWebSocket = () => ({
        send: vi.fn(),
        close: vi.fn(),
        accept: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        readyState: 1, // OPEN
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3
      });
      this[0] = createMockWebSocket();
      this[1] = createMockWebSocket();
    }
  };
}

// Global setup for all backend tests
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks()

  // Setup localStorage mock
  const localStorageMock = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }

  Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true
  })

  // Setup btoa/atob functions
  Object.defineProperty(global, 'btoa', {
    value: (str: string) => Buffer.from(str).toString('base64'),
    writable: true,
    configurable: true
  })

  Object.defineProperty(global, 'atob', {
    value: (str: string) => Buffer.from(str, 'base64').toString(),
    writable: true,
    configurable: true
  })
})
