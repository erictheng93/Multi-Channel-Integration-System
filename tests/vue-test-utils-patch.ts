/**
 * Vue Test Utils Patch for JSDOM Event Interface Issues
 * 
 * This module directly patches Vue Test Utils to avoid the 
 * "SupportedEventInterface is not a constructor" error.
 */

import { vi } from 'vitest'

// Mock Vue Test Utils trigger method to use a safer event creation approach
const originalVueTestUtils = await vi.importActual('@vue/test-utils') as any

// Create a safe event constructor
function createSafeEvent(type: string, options: any = {}) {
  const event = {
    type,
    bubbles: options.bubbles ?? false,
    cancelable: options.cancelable ?? false,
    composed: options.composed ?? false,
    target: null,
    currentTarget: null,
    eventPhase: 0,
    defaultPrevented: false,
    isTrusted: false,
    timeStamp: Date.now(),
    
    preventDefault() { this.defaultPrevented = true },
    stopPropagation() {},
    stopImmediatePropagation() {},
    composedPath() { return [] },
    initEvent() {}
  }
  
  return event
}

// Monkey patch the trigger method
if (originalVueTestUtils.DOMWrapper) {
  const originalTrigger = originalVueTestUtils.DOMWrapper.prototype.trigger
  
  originalVueTestUtils.DOMWrapper.prototype.trigger = async function(eventType: string, options: any = {}) {
    // Create a safe event instead of relying on JSDOM constructors
    const event = createSafeEvent(eventType, options)
    
    // Set target properties
    event.target = this.element
    event.currentTarget = this.element
    
    // Dispatch the event
    if (this.element.dispatchEvent) {
      this.element.dispatchEvent(event)
    }
    
    // Return the wrapper for chaining
    return this
  }
  
  console.log('✅ Vue Test Utils trigger method patched')
} else {
  console.warn('⚠️ Could not find DOMWrapper to patch')
}

export default originalVueTestUtils