import { vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createApp } from 'vue'
import { createWebHistory } from 'vue-router'

// 全域設置
beforeAll(() => {
  // Mock console methods to reduce noise in tests
  global.console = {
    ...console,
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn()
  }
  
  // Apply enhanced DOM event fixes for better Vue Test Utils compatibility
  setupEnhancedDOMEvents()
})

// Enhanced DOM event setup for better compatibility
function setupEnhancedDOMEvents() {
  // Don't override if JSDOM already provides good Event constructors
  // Instead, just ensure they exist and work properly
  
  // Store original constructors
  const OriginalEvent = global.Event

  // Only enhance if the constructors don't exist or are problematic
  if (!OriginalEvent || typeof OriginalEvent !== 'function') {
    global.Event = class Event {
      readonly type: string
      readonly bubbles: boolean
      readonly cancelable: boolean
      readonly composed: boolean = false
      readonly timeStamp: number
      target: EventTarget | null = null
      currentTarget: EventTarget | null = null
      eventPhase: number = 0
      defaultPrevented: boolean = false
      isTrusted: boolean = false
      cancelBubble: boolean = false
      returnValue: boolean = true
      srcElement: EventTarget | null = null

      preventDefault = vi.fn(() => { 
        this.defaultPrevented = true
        this.returnValue = false
      })
      stopPropagation = vi.fn(() => { this.cancelBubble = true })
      stopImmediatePropagation = vi.fn()
      composedPath = vi.fn(() => [])
      initEvent = vi.fn()

      static readonly NONE = 0
      static readonly CAPTURING_PHASE = 1
      static readonly AT_TARGET = 2
      static readonly BUBBLING_PHASE = 3

      readonly NONE = 0
      readonly CAPTURING_PHASE = 1
      readonly AT_TARGET = 2
      readonly BUBBLING_PHASE = 3

      constructor(type: string, eventInitDict: EventInit = {}) {
        this.type = type
        this.bubbles = eventInitDict.bubbles ?? false
        this.cancelable = eventInitDict.cancelable ?? false
        this.timeStamp = Date.now()
      }
    } as unknown as typeof Event
  }

  // Ensure window has the same constructors as global
  if (global.window) {
    global.window.Event = global.Event
    global.window.MouseEvent = global.MouseEvent || global.Event
    global.window.KeyboardEvent = global.KeyboardEvent || global.Event
    global.window.InputEvent = global.InputEvent || global.Event
  }
}

beforeEach(() => {
  // 為每個測試創建新的 Pinia 實例
  const app = createApp({})
  const pinia = createPinia()
  app.use(pinia)
  setActivePinia(pinia)
  
  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
  }
  
  // Mock sessionStorage
  const sessionStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
  }

  // 設置全域物件
  Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true
  })
  
  Object.defineProperty(global, 'sessionStorage', {
    value: sessionStorageMock,
    writable: true
  })

  // Mock location
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
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn()
  }

  // JSDOM should provide Event constructors, just ensure they work properly
  // Don't override them unless absolutely necessary

  // Mock window with all necessary properties
  Object.defineProperty(global, 'window', {
    value: {
      ...global.window,
      localStorage: localStorageMock,
      sessionStorage: sessionStorageMock,
      location: mockLocation,
      document: global.document,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    },
    writable: true
  })

  // Mock document - jsdom should handle this, but ensure it's available
  if (!global.document) {
    Object.defineProperty(global, 'document', {
      value: {
        hidden: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        createElement: vi.fn().mockImplementation((tagName: string) => {
          const element = {
            tagName: tagName.toUpperCase(),
            innerHTML: '',
            textContent: '',
            style: {},
            setAttribute: vi.fn(),
            getAttribute: vi.fn(),
            appendChild: vi.fn(),
            removeChild: vi.fn(),
            insertBefore: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
            closest: vi.fn().mockImplementation((selector: string) => {
              // Simple mock implementation - return the element itself if it matches
              if (selector === 'button' && element.tagName === 'BUTTON') {
                return element
              }
              // For other cases, return null (not found)
              return null
            }),
            querySelector: vi.fn(),
            querySelectorAll: vi.fn().mockReturnValue([]),
            classList: {
              add: vi.fn(),
              remove: vi.fn(),
              contains: vi.fn(),
              toggle: vi.fn()
            },
            parentNode: null,
            childNodes: [],
            children: []
          }
          // Mock parent node with insertBefore
          interface MockElement extends Partial<HTMLElement> {
            parentNode?: {
              insertBefore: ReturnType<typeof vi.fn>
              appendChild: ReturnType<typeof vi.fn>
              removeChild: ReturnType<typeof vi.fn>
            }
          }
          (element as MockElement).parentNode = {
            insertBefore: vi.fn(),
            appendChild: vi.fn(),
            removeChild: vi.fn(),
            closest: vi.fn(),
            childElementCount: 0,
            children: [],
            firstElementChild: null,
            lastElementChild: null
          }
          return element
        })
      },
      writable: true
    })
  }

  // Enhance JSDOM elements with missing methods
  if (global.document && global.document.createElement) {
    const originalCreateElement = global.document.createElement
    global.document.createElement = function(tagName: string) {
      const element = originalCreateElement.call(this, tagName)
      
      // Add closest method if it doesn't exist
      if (!element.closest) {
        element.closest = vi.fn().mockImplementation((selector: string) => {
          // Simple mock - return the element if it's a button and selector is 'button'
          if (selector === 'button' && element.tagName.toLowerCase() === 'button') {
            return element
          }
          return null
        })
      }
      
      return element
    }
  }

  // Mock fetch
  global.fetch = vi.fn()

  // Mock router
  const mockRouter = {
    push: vi.fn().mockResolvedValue(undefined),
    replace: vi.fn().mockResolvedValue(undefined),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    resolve: vi.fn().mockReturnValue({ href: '/' }),
    currentRoute: { value: { path: '/', params: {}, query: {} } },
    options: { history: createWebHistory() }
  }

  // 將 router mock 設置為全域可用
  vi.stubGlobal('useRouter', () => mockRouter)
  vi.stubGlobal('useRoute', () => mockRouter.currentRoute.value)
})

afterEach(() => {
  // 清理所有 mocks
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

// Mock Vue Router composables globally
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn().mockResolvedValue(undefined),
    replace: vi.fn().mockResolvedValue(undefined),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    resolve: vi.fn().mockReturnValue({ href: '/' }),
    currentRoute: { value: { path: '/', params: {}, query: {} } }
  }),
  useRoute: () => ({
    path: '/',
    params: {},
    query: {},
    meta: {}
  }),
  createRouter: vi.fn(),
  createWebHistory: vi.fn()
}))

// Mock API base client only - let individual API modules handle their own logic
vi.mock('@/api/base', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ success: true, data: null }),
    post: vi.fn().mockResolvedValue({ success: true, data: null }),
    put: vi.fn().mockResolvedValue({ success: true, data: null }),
    delete: vi.fn().mockResolvedValue({ success: true, data: null }),
    request: vi.fn().mockResolvedValue({ success: true, data: null }),
    setAuthHeader: vi.fn(),
    removeAuthHeader: vi.fn()
  }
}))

// Only mock auth API for store tests
vi.mock('@/api/auth', () => ({
  authApi: {
    login: vi.fn().mockResolvedValue({ success: true, data: { token: 'mock-token', agent: { id: 'test-id', name: 'Test Agent' } } }),
    logout: vi.fn().mockResolvedValue({ success: true }),
    me: vi.fn().mockResolvedValue({ success: true, data: { id: 'test-id', name: 'Test Agent', email: 'test@example.com' } }),
    refreshToken: vi.fn().mockResolvedValue({ success: true, data: { token: 'new-token' } }),
    validateSession: vi.fn().mockResolvedValue({ success: true, data: true }),
    setAuthHeader: vi.fn(),
    removeAuthHeader: vi.fn()
  }
}))