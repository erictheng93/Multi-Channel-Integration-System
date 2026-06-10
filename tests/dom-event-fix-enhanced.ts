import { vi } from 'vitest'

type EventConstructor = typeof Event

function createFallbackEventConstructor(BaseEvent?: EventConstructor): EventConstructor {
  if (BaseEvent && typeof BaseEvent === 'function') {
    return BaseEvent
  }

  return class TestEvent implements Event {
    readonly NONE = 0
    readonly CAPTURING_PHASE = 1
    readonly AT_TARGET = 2
    readonly BUBBLING_PHASE = 3
    readonly type: string
    readonly bubbles: boolean
    readonly cancelable: boolean
    readonly composed: boolean
    readonly timeStamp = Date.now()
    readonly isTrusted = false
    target: EventTarget | null = null
    currentTarget: EventTarget | null = null
    eventPhase = 0
    defaultPrevented = false
    cancelBubble = false
    returnValue = true
    srcElement: EventTarget | null = null

    constructor(type: string, eventInitDict: EventInit = {}) {
      this.type = type
      this.bubbles = eventInitDict.bubbles ?? false
      this.cancelable = eventInitDict.cancelable ?? false
      this.composed = eventInitDict.composed ?? false
    }

    composedPath(): EventTarget[] {
      return []
    }

    initEvent(type: string, bubbles = false, cancelable = false): void {
      Object.defineProperty(this, 'type', { value: type, configurable: true })
      Object.defineProperty(this, 'bubbles', { value: bubbles, configurable: true })
      Object.defineProperty(this, 'cancelable', { value: cancelable, configurable: true })
    }

    preventDefault(): void {
      if (this.cancelable) {
        this.defaultPrevented = true
        this.returnValue = false
      }
    }

    stopImmediatePropagation(): void {
      this.cancelBubble = true
    }

    stopPropagation(): void {
      this.cancelBubble = true
    }
  } as unknown as EventConstructor
}

function ensureConstructor(name: string, fallback: EventConstructor): void {
  const globalObj = globalThis as unknown as Record<string, unknown>
  const windowObj = typeof window === 'undefined'
    ? undefined
    : window as unknown as Record<string, unknown>
  const existing = windowObj?.[name] ?? globalObj[name] ?? fallback

  if (windowObj && typeof windowObj[name] !== 'function') {
    windowObj[name] = existing
  }
  if (typeof globalObj[name] !== 'function') {
    globalObj[name] = existing
  }
}

function patchDispatchEvent(): void {
  if (typeof EventTarget === 'undefined') {
    return
  }

  const proto = EventTarget.prototype as EventTarget & {
    __mcisDispatchEventPatched?: boolean
  }
  if (proto.__mcisDispatchEventPatched) {
    return
  }

  const originalDispatchEvent = EventTarget.prototype.dispatchEvent
  EventTarget.prototype.dispatchEvent = function dispatchEvent(event: Event): boolean {
    if (event instanceof Event) {
      return originalDispatchEvent.call(this, event)
    }

    const eventLike = event as Event & Record<string, unknown>
    const type = typeof eventLike.type === 'string' ? eventLike.type : 'click'
    const fixedEvent = new Event(type, {
      bubbles: Boolean(eventLike.bubbles),
      cancelable: Boolean(eventLike.cancelable),
      composed: Boolean(eventLike.composed)
    })

    return originalDispatchEvent.call(this, fixedEvent)
  }
  proto.__mcisDispatchEventPatched = true
}

function installObserverMocks(): void {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    }
  }

  if (typeof globalThis.IntersectionObserver === 'undefined') {
    globalThis.IntersectionObserver = class IntersectionObserver {
      readonly root = null
      readonly rootMargin = ''
      readonly thresholds = []
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
      takeRecords = vi.fn(() => [])
    }
  }
}

function installMatchMediaMock(): void {
  if (typeof window === 'undefined' || typeof window.matchMedia === 'function') {
    return
  }

  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    })),
    configurable: true,
    writable: true
  })
}

const EventFallback = createFallbackEventConstructor(globalThis.Event)

ensureConstructor('Event', EventFallback)
ensureConstructor('UIEvent', EventFallback)
ensureConstructor('MouseEvent', EventFallback)
ensureConstructor('KeyboardEvent', EventFallback)
ensureConstructor('InputEvent', EventFallback)
ensureConstructor('FocusEvent', EventFallback)
ensureConstructor('CustomEvent', EventFallback)
ensureConstructor('WheelEvent', EventFallback)
ensureConstructor('TouchEvent', EventFallback)
ensureConstructor('CompositionEvent', EventFallback)
ensureConstructor('DragEvent', EventFallback)

patchDispatchEvent()
installObserverMocks()
installMatchMediaMock()
