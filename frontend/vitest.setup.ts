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