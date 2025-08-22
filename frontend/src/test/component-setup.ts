import { vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { config } from '@vue/test-utils'

// Global test setup for component tests
beforeEach(() => {
  // Create fresh Pinia instance for each test
  setActivePinia(createPinia())
  
  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
  }
  
  Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true
  })
  
  // Enhanced JSDOM setup for proper event handling
  if (typeof global.window !== 'undefined') {
    // Fix Event constructor issues
    const MockEvent = class MockEvent {
      type: string
      bubbles: boolean
      cancelable: boolean
      target: EventTarget | null = null
      currentTarget: EventTarget | null = null
      preventDefault = vi.fn()
      stopPropagation = vi.fn()
      stopImmediatePropagation = vi.fn()
      
      constructor(type: string, options: EventInit = {}) {
        this.type = type
        this.bubbles = options.bubbles ?? false
        this.cancelable = options.cancelable ?? false
      }
      
      static readonly NONE = 0
      static readonly CAPTURING_PHASE = 1
      static readonly AT_TARGET = 2
      static readonly BUBBLING_PHASE = 3
    }
    
    global.window.Event = MockEvent as unknown as typeof Event
    
    // Fix MouseEvent constructor
    const MockMouseEvent = class MockMouseEvent extends MockEvent {
      button: number = 0
      buttons: number = 0
      clientX: number = 0
      clientY: number = 0
      
      constructor(type: string, options: MouseEventInit = {}) {
        super(type, options)
        this.button = options.button ?? 0
        this.buttons = options.buttons ?? 0
        this.clientX = options.clientX ?? 0
        this.clientY = options.clientY ?? 0
      }
      
      // Add missing MouseEvent properties
      altKey = false
      ctrlKey = false
      layerX = 0
      layerY = 0
      metaKey = false
      movementX = 0
      movementY = 0
      offsetX = 0
      offsetY = 0
      pageX = 0
      pageY = 0
      relatedTarget = null
      screenX = 0
      screenY = 0
      shiftKey = false
      which = 0
      detail = 0
      view = null
      getModifierState = vi.fn()
      initMouseEvent = vi.fn()
    }
    
    global.window.MouseEvent = MockMouseEvent as unknown as typeof MouseEvent
    
    // Fix KeyboardEvent constructor
    const MockKeyboardEvent = class MockKeyboardEvent extends MockEvent {
      key: string = ''
      code: string = ''
      shiftKey: boolean = false
      ctrlKey: boolean = false
      altKey: boolean = false
      metaKey: boolean = false
      
      constructor(type: string, options: KeyboardEventInit = {}) {
        super(type, options)
        this.key = options.key ?? ''
        this.code = options.code ?? ''
        this.shiftKey = options.shiftKey ?? false
        this.ctrlKey = options.ctrlKey ?? false
        this.altKey = options.altKey ?? false
        this.metaKey = options.metaKey ?? false
      }
      
      static readonly DOM_KEY_LOCATION_STANDARD = 0
      static readonly DOM_KEY_LOCATION_LEFT = 1
      static readonly DOM_KEY_LOCATION_RIGHT = 2
      static readonly DOM_KEY_LOCATION_NUMPAD = 3
    }
    
    global.window.KeyboardEvent = MockKeyboardEvent as unknown as typeof KeyboardEvent
    
    // Fix InputEvent constructor
    const MockInputEvent = class MockInputEvent extends MockEvent {
      data: string = ''
      inputType: string = ''
      
      constructor(type: string, options: InputEventInit = {}) {
        super(type, options)
        this.data = options.data ?? ''
        this.inputType = options.inputType ?? ''
      }
      
      // Add missing InputEvent properties
      dataTransfer = null
      isComposing = false
      getTargetRanges = vi.fn()
      detail = 0
      view = null
      which = 0
      initUIEvent = vi.fn()
    }
    
    global.window.InputEvent = MockInputEvent as unknown as typeof InputEvent
  }
  
  // Ensure proper DOM element behavior
  if (typeof global.document !== 'undefined' && global.document.documentElement) {
    // Fix classList.clear() if it doesn't exist
    const classList = global.document.documentElement.classList as DOMTokenList & { clear?: () => void }
    if (!classList.clear) {
      classList.clear = function() {
        while (this.length > 0) {
          const item = this.item(0)
          if (item) {
            this.remove(item)
          } else {
            break
          }
        }
      }
    }
  }
})

// Configure Vue Test Utils globally
config.global.mocks = {
  $t: (key: string) => key, // Mock i18n
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
    meta: {}
  }
}

// Global stubs for common components that might cause issues
config.global.stubs = {
  'router-link': true,
  'router-view': true
}

export {}