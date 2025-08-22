// Enhanced DOM Event Fix for Vue Test Utils
// 專案名稱：Multi-Channel Platform MVP
// 檔案路徑：/tests/dom-event-fix-enhanced.ts

console.log('🔧 Applying enhanced DOM event fix...')

// Create a comprehensive Event class that satisfies Vue Test Utils requirements
class UniversalEvent implements Event {
  readonly type: string
  readonly bubbles: boolean
  readonly cancelable: boolean
  readonly composed: boolean
  readonly currentTarget: EventTarget | null = null
  readonly defaultPrevented: boolean = false
  readonly eventPhase: number = 0
  readonly isTrusted: boolean = false
  readonly target: EventTarget | null = null
  readonly timeStamp: number = Date.now()

  constructor(type: string, eventInitDict: EventInit = {}) {
    this.type = type
    this.bubbles = eventInitDict.bubbles ?? false
    this.cancelable = eventInitDict.cancelable ?? false
    this.composed = eventInitDict.composed ?? false
  }

  composedPath(): EventTarget[] { return [] }
  initEvent(): void {}
  preventDefault(): void {}
  stopImmediatePropagation(): void {}
  stopPropagation(): void {}

  // Additional properties that might be expected
  AT_TARGET = 2
  BUBBLING_PHASE = 3
  CAPTURING_PHASE = 1
  NONE = 0
}

class UniversalUIEvent extends UniversalEvent implements UIEvent {
  readonly detail: number
  readonly view: Window | null

  constructor(type: string, eventInitDict: UIEventInit = {}) {
    super(type, eventInitDict)
    this.detail = eventInitDict.detail ?? 0
    this.view = eventInitDict.view ?? null
  }
}

class UniversalMouseEvent extends UniversalUIEvent implements MouseEvent {
  readonly altKey: boolean = false
  readonly button: number
  readonly buttons: number
  readonly clientX: number
  readonly clientY: number
  readonly ctrlKey: boolean = false
  readonly metaKey: boolean = false
  readonly movementX: number = 0
  readonly movementY: number = 0
  readonly offsetX: number = 0
  readonly offsetY: number = 0
  readonly pageX: number = 0
  readonly pageY: number = 0
  readonly relatedTarget: EventTarget | null = null
  readonly screenX: number
  readonly screenY: number
  readonly shiftKey: boolean = false
  readonly x: number = 0
  readonly y: number = 0

  constructor(type: string, eventInitDict: MouseEventInit = {}) {
    super(type, eventInitDict)
    this.button = eventInitDict.button ?? 0
    this.buttons = eventInitDict.buttons ?? 0
    this.clientX = eventInitDict.clientX ?? 0
    this.clientY = eventInitDict.clientY ?? 0
    this.screenX = eventInitDict.screenX ?? 0
    this.screenY = eventInitDict.screenY ?? 0
  }

  getModifierState(): boolean { return false }
  initMouseEvent(): void {}
}

class UniversalKeyboardEvent extends UniversalUIEvent implements KeyboardEvent {
  readonly altKey: boolean = false
  readonly code: string
  readonly ctrlKey: boolean = false
  readonly isComposing: boolean = false
  readonly key: string
  readonly location: number = 0
  readonly metaKey: boolean = false
  readonly repeat: boolean = false
  readonly shiftKey: boolean = false

  constructor(type: string, eventInitDict: KeyboardEventInit = {}) {
    super(type, eventInitDict)
    this.code = eventInitDict.code ?? ''
    this.key = eventInitDict.key ?? ''
  }

  getModifierState(): boolean { return false }
  initKeyboardEvent(): void {}

  // Legacy properties
  readonly charCode: number = 0
  readonly keyCode: number = 0
  readonly which: number = 0

  DOM_KEY_LOCATION_LEFT = 1
  DOM_KEY_LOCATION_NUMPAD = 3
  DOM_KEY_LOCATION_RIGHT = 2
  DOM_KEY_LOCATION_STANDARD = 0
}

class UniversalInputEvent extends UniversalUIEvent implements InputEvent {
  readonly data: string | null
  readonly dataTransfer: DataTransfer | null = null
  readonly inputType: string
  readonly isComposing: boolean = false

  constructor(type: string, eventInitDict: InputEventInit = {}) {
    super(type, eventInitDict)
    this.data = eventInitDict.data ?? null
    this.inputType = eventInitDict.inputType ?? ''
  }

  getTargetRanges(): StaticRange[] { return [] }
}

class UniversalFocusEvent extends UniversalUIEvent implements FocusEvent {
  readonly relatedTarget: EventTarget | null

  constructor(type: string, eventInitDict: FocusEventInit = {}) {
    super(type, eventInitDict)
    this.relatedTarget = eventInitDict.relatedTarget ?? null
  }
}

// Apply the fix to global scope
function applyEventFix() {
  const eventClasses = {
    Event: UniversalEvent,
    UIEvent: UniversalUIEvent,
    MouseEvent: UniversalMouseEvent,
    KeyboardEvent: UniversalKeyboardEvent,
    InputEvent: UniversalInputEvent,
    FocusEvent: UniversalFocusEvent,
    CustomEvent: UniversalEvent,
    AnimationEvent: UniversalEvent,
    TransitionEvent: UniversalEvent,
    WheelEvent: UniversalMouseEvent,
    TouchEvent: UniversalUIEvent,
    PointerEvent: UniversalMouseEvent,
  }

  // Apply to globalThis
  Object.entries(eventClasses).forEach(([name, EventClass]) => {
    Object.defineProperty(globalThis, name, {
      value: EventClass,
      writable: true,
      configurable: true
    })
  })

  // Apply to window if it exists
  if (typeof window !== 'undefined') {
    Object.entries(eventClasses).forEach(([name, EventClass]) => {
      Object.defineProperty(window, name, {
        value: EventClass,
        writable: true,
        configurable: true
      })
    })
  }

  // Also apply to global for Node.js compatibility
  if (typeof global !== 'undefined') {
    Object.entries(eventClasses).forEach(([name, EventClass]) => {
      Object.defineProperty(global, name, {
        value: EventClass,
        writable: true,
        configurable: true
      })
    })
  }
}

// Apply the fix immediately
applyEventFix()

console.log('✅ Enhanced DOM event fix applied successfully')

export { applyEventFix }