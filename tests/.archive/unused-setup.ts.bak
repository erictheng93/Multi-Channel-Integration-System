import { vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia } from 'pinia'
import { globalPinia } from './global-pinia-setup'

console.log('🍍 setup.ts: Using global Pinia instance')

// CRITICAL FIX: Vue Test Utils DOM Event Interface Issue
// This must happen AFTER JSDOM environment is set up
console.log('🔧 Applying Vue Test Utils DOM event fix...')

// Create proper event constructors that Vue Test Utils expects
function createVueTestCompatibleEvent() {
  return class VueTestEvent {
    type: string
    bubbles: boolean = false
    cancelable: boolean = false
    composed: boolean = false
    target: any = null
    currentTarget: any = null
    eventPhase: number = 0
    defaultPrevented: boolean = false
    isTrusted: boolean = false
    timeStamp: number = Date.now()

    constructor(type: string, options: any = {}) {
      this.type = type
      this.bubbles = options.bubbles ?? false
      this.cancelable = options.cancelable ?? false
      this.composed = options.composed ?? false
    }

    preventDefault() { this.defaultPrevented = true }
    stopPropagation() {}
    stopImmediatePropagation() {}
    composedPath() { return [] }
    initEvent() {}
  }
}

// Patch window object with proper event constructors
if (typeof window !== 'undefined') {
  const EventConstructor = createVueTestCompatibleEvent()
  
  // Override window constructors directly
  Object.defineProperty(window, 'Event', {
    value: EventConstructor,
    writable: false,
    configurable: true
  })
  
  // Also set on global for consistency
  try {
    Object.defineProperty(global, 'Event', {
      value: EventConstructor,
      writable: false,
      configurable: true
    })
  } catch (err) {
    // Ignore if already defined
    console.log('⚠️ Could not override global.Event (likely already defined)')
  }
  
  console.log('✅ Vue Test Utils DOM event interface patched')
  
  // Test the fix
  try {
    const testEvent = new window.Event('test', { bubbles: true })
    console.log('✅ Event constructor test passed:', testEvent.type)
  } catch (err) {
    console.error('❌ Event constructor test failed:', err)
  }
} else {
  console.warn('⚠️ window object not available for DOM event patch')
}

// Setup for each test  
beforeEach(() => {
  // CRITICAL: Re-patch DOM events before each test
  // This ensures JSDOM hasn't overridden our constructors
  if (typeof window !== 'undefined') {
    const EventConstructor = createVueTestCompatibleEvent()
    
    // Force re-patch the window object before each test
    try {
      Object.defineProperty(window, 'Event', {
        value: EventConstructor,
        writable: false,
        configurable: true
      })
      
      // Debug: Check what Vue Test Utils will actually see
      const eventInterface = 'Event'
      const metaEventInterface = (window as any)[eventInterface]
      const SupportedEventInterface = typeof metaEventInterface === 'function' ? metaEventInterface : (global as any).Event
      
      if (typeof SupportedEventInterface !== 'function') {
        console.error('❌ beforeEach: Vue Test Utils will fail!', {
          eventInterface,
          metaEventInterface: typeof metaEventInterface,
          SupportedEventInterface: typeof SupportedEventInterface
        })
        
        // Force override with a working constructor
        Object.defineProperty(window, 'Event', {
          value: EventConstructor,
          writable: true,
          configurable: true
        })
      }
    } catch (err) {
      console.warn('⚠️ Could not re-patch Event constructor in beforeEach:', err)
    }
  }
  
  // Clear all mocks first
  vi.clearAllMocks()
  
  // DON'T reset modules - this would clear our Pinia setup!
  // vi.resetModules()
  
  // Ensure Pinia is still active and reset store states
  setActivePinia(globalPinia)
  
  // Reset all stores to their initial state
  globalPinia._s.forEach((store: any) => {
    if (store.$reset) {
      store.$reset()
    }
  })
})

afterEach(() => {
  // Clean up after each test, but DON'T destroy the global Pinia instance
  // We need it to persist across tests to prevent timing issues
  
  // Just ensure all stores are clean
  globalPinia._s.forEach((store: any) => {
    if (store.$reset) {
      store.$reset()
    }
  })
})

// Mock localStorage globally for tests
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

// Mock window object
Object.defineProperty(global, 'window', {
  value: {
    localStorage: localStorageMock,
    location: {
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
      pathname: '/',
      search: '',
      hash: ''
    }
  },
  writable: true,
  configurable: true
})

// Mock import.meta.env
vi.mock('import.meta', () => ({
  env: {
    DEV: true,
    NODE_ENV: 'test'
  }
}), { virtual: true })

// Mock global objects that are available in Cloudflare Workers
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      importKey: vi.fn(),
      sign: vi.fn(),
      verify: vi.fn(),
      digest: vi.fn()
    },
    randomUUID: vi.fn(() => 'test-uuid-123')
  },
  writable: true,
  configurable: true
})

// Mock TextEncoder/TextDecoder
global.TextEncoder = class TextEncoder {
  encode(input: string): Uint8Array {
    return new Uint8Array(Buffer.from(input, 'utf8'))
  }
}

global.TextDecoder = class TextDecoder {
  decode(input: Uint8Array): string {
    return Buffer.from(input).toString('utf8')
  }
}

// Mock atob/btoa for base64 operations
global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary')
global.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64')

// Mock fetch for API calls
global.fetch = vi.fn()

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn()
}