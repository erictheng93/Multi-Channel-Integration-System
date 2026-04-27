// ======================== TIMEZONE STANDARDIZATION ========================
// Force UTC timezone for all tests to ensure consistent date/time handling
// across different environments and CI/CD systems
process.env.TZ = 'UTC';
if (process.env.DEBUG_TEST_SETUP === 'true') {
  console.log('[Frontend Tests] Timezone standardized to UTC');
}

import { config } from '@vue/test-utils'
import { vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { messages, defaultLocale } from './src/locales'

// CRITICAL: Setup window and DOM mocks FIRST before any other imports
// Enhanced window.location mock - must be first before any imports
const mockLocation = {
  href: 'http://localhost:3000',
  origin: 'http://localhost:3000',
  protocol: 'http:',
  host: 'localhost:3000',
  hostname: 'localhost',
  port: '3000',
  pathname: '/',
  search: '',
  hash: '',
  replace: vi.fn(),
  assign: vi.fn(),
  reload: vi.fn()
}

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

// Ensure JSDOM window is properly setup
if (typeof window !== 'undefined') {
  // Enhance existing JSDOM window
  Object.defineProperty(window, 'location', {
    value: mockLocation,
    writable: true,
    configurable: true
  })
  
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true
  })
  
  // Ensure all event constructors are available on window
  window.Event = window.Event || Event
  window.MouseEvent = window.MouseEvent || MouseEvent
  window.KeyboardEvent = window.KeyboardEvent || KeyboardEvent
  window.InputEvent = window.InputEvent || InputEvent
  window.FocusEvent = window.FocusEvent || FocusEvent
  window.WheelEvent = window.WheelEvent || WheelEvent
  window.TouchEvent = window.TouchEvent || function TouchEvent() {} as any
  window.CustomEvent = window.CustomEvent || CustomEvent
  window.UIEvent = window.UIEvent || UIEvent
  window.CompositionEvent = window.CompositionEvent || function CompositionEvent() {} as any
  window.DragEvent = window.DragEvent || function DragEvent() {} as any
  
  // Fix common JSDOM event issues
  window.HTMLFormElement = window.HTMLFormElement || HTMLElement
  window.HTMLSelectElement = window.HTMLSelectElement || HTMLElement
  window.HTMLTextAreaElement = window.HTMLTextAreaElement || HTMLElement
  window.HTMLInputElement = window.HTMLInputElement || HTMLElement
} else {
  // Create window if it doesn't exist
  Object.defineProperty(global, 'window', {
    value: {
      location: mockLocation,
      localStorage: mockLocalStorage,
      document: global.document,
      navigator: {
        userAgent: 'jsdom'
      }
    },
    writable: true,
    configurable: true
  })
}

// Also setup direct global access
Object.defineProperty(global, 'location', {
  value: mockLocation,
  writable: true,
  configurable: true
})

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true
})

// 修復 JSDOM 事件構造器問題的最直接解決方案
// 這個問題是由於 Vue Test Utils 創建的事件對象不被 JSDOM 識別為有效的 Event 實例

// 使用 happy-dom 的事件處理方式或者直接 mock dispatchEvent
const originalDispatchEvent = EventTarget.prototype.dispatchEvent

EventTarget.prototype.dispatchEvent = function(event: Event) {
  // 如果事件對象不是真正的 Event 實例，創建一個新的
  if (!(event instanceof Event)) {
    const eventType = (event as any).type || 'click'
    const eventOptions = {
      bubbles: (event as any).bubbles || false,
      cancelable: (event as any).cancelable || false
    }
    
    // 根據事件類型創建適當的事件
    let newEvent: Event
    if (eventType.startsWith('key')) {
      newEvent = new KeyboardEvent(eventType, {
        ...eventOptions,
        key: (event as any).key || '',
        code: (event as any).code || '',
        ctrlKey: (event as any).ctrlKey || false,
        shiftKey: (event as any).shiftKey || false,
        altKey: (event as any).altKey || false,
        metaKey: (event as any).metaKey || false
      })
    } else if (eventType.startsWith('mouse') || eventType === 'click') {
      newEvent = new MouseEvent(eventType, {
        ...eventOptions,
        button: (event as any).button || 0,
        buttons: (event as any).buttons || 0,
        clientX: (event as any).clientX || 0,
        clientY: (event as any).clientY || 0
      })
    } else if (eventType === 'input' || eventType === 'change') {
      newEvent = new InputEvent(eventType, {
        ...eventOptions,
        data: (event as any).data || null,
        inputType: (event as any).inputType || ''
      })
    } else {
      newEvent = new Event(eventType, eventOptions)
    }
    
    return originalDispatchEvent.call(this, newEvent)
  }
  
  return originalDispatchEvent.call(this, event)
}

// Additional global event constructor fallbacks
if (typeof global.Event === 'undefined') {
  global.Event = Event
}
if (typeof global.MouseEvent === 'undefined') {
  global.MouseEvent = MouseEvent
}
if (typeof global.KeyboardEvent === 'undefined') {
  global.KeyboardEvent = KeyboardEvent
}
if (typeof global.InputEvent === 'undefined') {
  global.InputEvent = InputEvent
}
if (typeof global.FocusEvent === 'undefined') {
  global.FocusEvent = FocusEvent
}
if (typeof global.CustomEvent === 'undefined') {
  global.CustomEvent = CustomEvent
}

// 創建測試用的 i18n 實例
const i18n = createI18n({
  legacy: false,
  locale: defaultLocale,
  fallbackLocale: defaultLocale,
  messages,
  globalInjection: true,
  silentTranslationWarn: true,
  silentFallbackWarn: true
})

// Mock Vite environment variables for testing
vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8787')
vi.stubEnv('VITE_ENV', 'development')
vi.stubEnv('VITE_ENVIRONMENT', 'test')
vi.stubEnv('VITE_BACKEND_URL', 'http://localhost:8787')
vi.stubEnv('VITE_FRONTEND_URL', 'http://localhost:3000')
vi.stubEnv('VITE_STORAGE_PUBLIC_URL', 'http://localhost:8787/files')
vi.stubEnv('VITE_WEBSOCKET_URL', 'ws://localhost:8787/ws')
vi.stubEnv('VITE_DEBUG', 'false')
vi.stubEnv('VITE_WEBSOCKET_DEBUG', 'false')

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
config.global.stubs = {
  ...(config.global.stubs ?? {}),
  RouterLink: {
    props: ['to'],
    template: '<a><slot /></a>'
  },
  'router-link': {
    props: ['to'],
    template: '<a><slot /></a>'
  }
}

// ======================== ASYNC CLEANUP ========================
// Global handlers to prevent unhandled rejection warnings in tests
// This is especially important for component tests that have async onMounted hooks

// Store original console methods
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

const EXPECTED_TEST_NOISE = [
  '[Vue warn]: Failed to resolve component: router-link',
  'onUnmounted is called when there is no active component instance',
  '[Runtime Config] VITE_WEBSOCKET_URL not set',
  '[AdvancedAssignActions] Server rejected',
  '[AdvancedAssignActions] Confirm assignment/transfer failed:',
  '[AdvancedAssignActions] Unassign failed with exception:',
  '[AdvancedAssignActions] Manual refresh failed:',
  '[MessageHandlers] Message failed:',
  '[MessageHandlers] Failed message not found:',
  '[ConversationsStore] API sync failed',
  '[ConversationsStore] Smart cache loading failed:',
  '[ConversationsStore] Preload failed for page',
  '[ConversationsStore] Current conversation not found in list',
  'not found for optimistic update',
  '[useConversationState] Failed to load conversation:',
  '[useConversationState] Failed to refresh messages:',
  '[useConversationState] Failed to refresh messages after reconnection:',
  '[CustomerTagsController] Initialization failed:',
  '[ConversationsStore] Assignment failed with exception:',
  '[ConversationsStore] Assignment API call failed:',
  '[Auth] Session has expired',
  '[Sticker Debug] Failed to parse sticker metadata',
  '[Sticker Debug] All CDN sources failed',
  '[conversationApi.assign] Individual assignment is deprecated',
  'Failed to copy message:',
  'Failed to fetch dashboard stats:',
  'Error fetching dashboard stats:',
  '未找到emoji映射:',
]

function stringifyConsoleArg(arg: unknown): string {
  if (arg instanceof Error) {
    return arg.message
  }

  if (typeof arg === 'string') {
    return arg
  }

  try {
    return JSON.stringify(arg)
  } catch {
    return String(arg)
  }
}

function isExpectedTestNoise(args: unknown[]): boolean {
  const message = args.map(stringifyConsoleArg).join(' ')
  return EXPECTED_TEST_NOISE.some(pattern => message.includes(pattern))
}

// Suppress specific known test-related errors during cleanup
console.error = (...args) => {
  if (isExpectedTestNoise(args)) {
    return
  }

  const message = stringifyConsoleArg(args[0])
  if (message.includes('Unhandled error during cleanup') || message.includes('runtime-core.cjs')) {
    return
  }

  originalConsoleError(...args)
}

console.warn = (...args) => {
  if (isExpectedTestNoise(args)) {
    return
  }

  originalConsoleWarn(...args)
}

// Handle unhandled promise rejections in tests gracefully
if (typeof process !== 'undefined') {
  process.on('unhandledRejection', (reason: any, _promise: Promise<any>) => {
    // Only log in debug mode, otherwise suppress known test-related rejections
    const reasonStr = reason?.toString() || ''
    if (
      reasonStr.includes('fetchConversations') ||
      reasonStr.includes('refreshConversations') ||
      reasonStr.includes('Failed to load') ||
      reasonStr.includes('AbortError') ||
      reasonStr.includes('Component is unmounted')
    ) {
      // Expected test cleanup - silently ignore
      return
    }
    // Log unexpected rejections for debugging
    console.warn('[Test] Unhandled rejection:', reason)
  })
}
