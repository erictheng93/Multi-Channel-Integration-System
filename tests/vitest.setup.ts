// 專案名稱：Multi-Channel Platform MVP
// 檔案路徑：/tests/vitest.setup.ts
// Created by: Test Setup Developer

import { beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, type Pinia } from 'pinia'
import { globalPinia } from './global-pinia-setup'
import { config } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

// Setup WebSocketPair globally BEFORE any tests run
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

// 創建測試用的 i18n 實例
const i18n = createI18n({
  legacy: false,
  locale: 'zh-TW',
  fallbackLocale: 'zh-TW',
  messages: {
    'zh-TW': {
      dashboard: {
        welcome: '歡迎回來'
      },
      auth: {
        login: '登入',
        email: '電子郵件',
        password: '密碼'
      }
    }
  },
  globalInjection: true,
  silentTranslationWarn: true,
  silentFallbackWarn: true,
  datetimeFormats: {
    'zh-TW': {
      short: {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      },
      long: {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        hour: 'numeric',
        minute: 'numeric'
      }
    }
  }
})

// Helper function to safely reset all Pinia stores
function resetAllStores(pinia: Pinia) {
  try {
    // Access the internal stores map safely
    const stores = (pinia as any)._s
    if (stores && typeof stores.forEach === 'function') {
      stores.forEach((store: any) => {
        if (store && typeof store.$reset === 'function') {
          store.$reset()
        }
      })
    }
  } catch (error) {
    console.warn('Failed to reset stores:', error)
  }
}

console.log('🔧 Loading vitest.setup.ts - Using global Pinia instance')

// CRITICAL FIX: Vue Test Utils DOM Event Interface Issue
// This must run before any Vue Test Utils imports
console.log('🔧 Applying critical DOM event interface fix...')

// Import and apply the enhanced DOM event fix
import './dom-event-fix-enhanced'

// Additional fix for Vue Test Utils event creation
// Override Vue Test Utils internal event creation
if (typeof window !== 'undefined') {
  // Patch the specific function that Vue Test Utils uses
  const originalCreateEvent = window.Event

  // Create a wrapper that always works
  function PatchedEvent(type: string, options: EventInit = {}) {
    const event = Object.create(originalCreateEvent.prototype)
    event.type = type
    event.bubbles = options.bubbles ?? false
    event.cancelable = options.cancelable ?? false
    event.composed = options.composed ?? false
    event.target = null
    event.currentTarget = null
    event.eventPhase = 0
    event.defaultPrevented = false
    event.isTrusted = false
    event.timeStamp = Date.now()

    // Add required methods
    event.preventDefault = function () { this.defaultPrevented = true }
    event.stopPropagation = function () { }
    event.stopImmediatePropagation = function () { }
    event.composedPath = function () { return [] }
    event.initEvent = function () { }

    return event
  }

  // Apply the patch
  window.Event = PatchedEvent as any

  // Also patch other event types
  const eventTypes = ['UIEvent', 'MouseEvent', 'KeyboardEvent', 'InputEvent', 'FocusEvent']
  eventTypes.forEach(eventType => {
    const windowObj = window as any
    if (windowObj[eventType]) {

      // Create a constructor function that can be called with 'new'
      function PatchedEventType(type: string, options: any = {}) {
        const event = Object.create(PatchedEvent.prototype)
        PatchedEvent.call(event, type, options)

        // Add type-specific properties
        if (eventType === 'MouseEvent') {
          event.button = options.button ?? 0
          event.buttons = options.buttons ?? 0
          event.clientX = options.clientX ?? 0
          event.clientY = options.clientY ?? 0
          event.screenX = options.screenX ?? 0
          event.screenY = options.screenY ?? 0
        }
        return event
      }

      // Set up the prototype chain
      PatchedEventType.prototype = Object.create(PatchedEvent.prototype)
      PatchedEventType.prototype.constructor = PatchedEventType

      windowObj[eventType] = PatchedEventType
    }
  })
}

console.log('✅ DOM event interface fix applied successfully')



// Vue Test Utils 全局配置
config.global.plugins = [i18n]
config.global.mocks = {
  $router: {
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn()
  },
  $route: {
    path: '/',
    params: {},
    query: {},
    hash: '',
    name: null,
    meta: {}
  }
}

// Mock Drizzle D1 database to ensure all PreparedStatements have .raw() method
// This comprehensive mock ensures that all D1 database operations in tests
// have complete PreparedStatement implementations including the .raw() method
vi.mock('drizzle-orm/d1', async () => {
  const actual = await vi.importActual('drizzle-orm/d1') as any

  // Create a complete mock PreparedStatement with all required methods
  function createMockStatement(): any {
    const mockStmt: any = {
      bind: vi.fn((..._args: any[]) => mockStmt),
      run: vi.fn().mockResolvedValue({
        success: true,
        meta: { changes: 0, last_row_id: 0 },
        results: []
      }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({
        results: [],
        success: true,
        meta: {}
      }),
      raw: vi.fn().mockResolvedValue([])
    }
    return mockStmt
  }

  return {
    ...actual,
    drizzle: vi.fn((db: any) => {
      // Create a mock database wrapper with complete PreparedStatement support
      const mockDb = {
        ...db,
        prepare: vi.fn((_query: string) => createMockStatement())
      }

      // Call the actual drizzle function with our mock db
      const drizzleInstance = actual.drizzle(mockDb)

      // Override the db property to use our mock
      return new Proxy(drizzleInstance, {
        get(target: any, prop: string) {
          if (prop === 'db') {
            return mockDb
          }
          return target[prop]
        }
      })
    })
  }
})

// Global mock setup for all API modules
vi.mock('../frontend/src/api/auth', () => ({
  authApi: {
    setAuthHeader: vi.fn(),
    removeAuthHeader: vi.fn(),
    login: vi.fn(),
    me: vi.fn()
  }
}))

vi.mock('../frontend/src/api/conversations', () => ({
  conversationApi: {
    getConversations: vi.fn(),
    list: vi.fn(),
    getConversation: vi.fn(),
    get: vi.fn(),
    assignConversation: vi.fn(),
    assign: vi.fn(),
    closeConversation: vi.fn(),
    close: vi.fn(),
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
    markAsRead: vi.fn()
  }
}))

vi.mock('../frontend/src/api/message', () => ({
  messageApi: {
    list: vi.fn(),
    send: vi.fn(),
    markAsRead: vi.fn()
  }
}))

// 修復 Vue Router Mock 問題 (統一版本)
vi.mock('vue-router', async () => {
  return {
    createRouter: vi.fn(() => ({
      push: vi.fn().mockResolvedValue(undefined),
      replace: vi.fn().mockResolvedValue(undefined),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      currentRoute: {
        value: {
          path: '/',
          params: {},
          query: {},
          hash: '',
          name: null,
          meta: {}
        }
      },
      install: vi.fn(),
      beforeEach: vi.fn(),
      afterEach: vi.fn()
    })),
    createWebHistory: vi.fn(() => ({})),
    useRouter: vi.fn(() => ({
      push: vi.fn().mockResolvedValue(undefined),
      replace: vi.fn().mockResolvedValue(undefined),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      currentRoute: {
        value: {
          path: '/',
          params: {},
          query: {},
          hash: '',
          name: null,
          meta: {}
        }
      }
    })),
    useRoute: vi.fn(() => ({
      path: '/',
      params: {},
      query: {},
      hash: '',
      name: null,
      meta: {}
    })),
    RouterLink: {
      name: 'RouterLink',
      props: ['to'],
      template: '<a><slot /></a>'
    },
    RouterView: {
      name: 'RouterView',
      template: '<div><slot /></div>'
    }
  }
})

// Global setup for all tests
beforeEach(() => {
  console.log('🍍 Refreshing test environment (Pinia already active)')

  // Clear all mocks first
  vi.clearAllMocks()

  // DON'T reset modules - this would clear our Pinia setup!
  // vi.resetModules()

  // Ensure Pinia is still active and reset its state
  setActivePinia(globalPinia)

  // Reset all stores to their initial state
  resetAllStores(globalPinia)

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

  // Setup crypto mock
  Object.defineProperty(global, 'crypto', {
    value: {
      randomUUID: vi.fn(() => 'mock-uuid-12345'),
      subtle: {
        importKey: vi.fn().mockResolvedValue({}),
        sign: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
        verify: vi.fn().mockResolvedValue(true),
        digest: vi.fn().mockImplementation((algorithm: string, data: BufferSource) => {
          // Simple mock implementation for password hashing
          const encoder = new TextEncoder()
          let hashInput: Uint8Array

          if (typeof data === 'string') {
            hashInput = encoder.encode(data)
          } else if (data instanceof ArrayBuffer) {
            hashInput = new Uint8Array(data)
          } else if (ArrayBuffer.isView(data)) {
            // Handle ArrayBufferView (like Uint8Array, DataView, etc.)
            hashInput = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
          } else {
            // Fallback
            hashInput = new Uint8Array(0)
          }

          const mockHash = new Uint8Array(32) // SHA-256 produces 32 bytes

          // Generate deterministic but pseudo-random hash
          for (let i = 0; i < 32; i++) {
            mockHash[i] = (hashInput.reduce((sum, byte, index) => sum + byte * (index + i + 1), 0) % 256)
          }
          return Promise.resolve(mockHash.buffer)
        }),
        encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
        decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
        generateKey: vi.fn().mockResolvedValue({}),
        exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
        deriveBits: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
        deriveKey: vi.fn().mockResolvedValue({})
      },
      getRandomValues: vi.fn((arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256)
        }
        return arr
      })
    },
    writable: true,
    configurable: true
  })

  // Setup btoa/atob functions
  Object.defineProperty(global, 'btoa', {
    value: vi.fn((str: string) => Buffer.from(str).toString('base64')),
    writable: true,
    configurable: true
  })

  Object.defineProperty(global, 'atob', {
    value: vi.fn((str: string) => Buffer.from(str, 'base64').toString()),
    writable: true,
    configurable: true
  })

  // Setup window and history for Vue Router
  Object.defineProperty(global, 'window', {
    value: {
      localStorage: localStorageMock,
      crypto: global.crypto,
      btoa: global.btoa,
      atob: global.atob,
      location: {
        href: 'http://localhost:3000',
        origin: 'http://localhost:3000',
        pathname: '/',
        search: '',
        hash: '',
        reload: vi.fn(),
      },
      history: {
        state: {},
        pushState: vi.fn(),
        replaceState: vi.fn(),
        go: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        length: 1
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    },
    writable: true,
    configurable: true
  })
})

afterEach(() => {
  // Clean up after each test, but keep Pinia alive
  // Just reset all store states to ensure test isolation
  resetAllStores(globalPinia)
})