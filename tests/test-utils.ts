// 專案名稱：Multi-Channel Platform MVP
// 檔案路徑：/tests/test-utils.ts
// Test utilities for better component testing

import { vi } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'

/**
 * Helper to safely access component internal properties
 * This provides type-safe access to component internals for testing
 */
export function getComponentData<T = any>(wrapper: VueWrapper<any>, property: string): T | undefined {
  try {
    return (wrapper.vm as any)[property]
  } catch {
    return undefined
  }
}

/**
 * Helper to check if a component has a specific method
 */
export function hasComponentMethod(wrapper: VueWrapper<any>, methodName: string): boolean {
  try {
    return typeof (wrapper.vm as any)[methodName] === 'function'
  } catch {
    return false
  }
}

/**
 * Helper to call a component method safely
 */
export function callComponentMethod<T = any>(wrapper: VueWrapper<any>, methodName: string, ...args: any[]): T | undefined {
  try {
    const method = (wrapper.vm as any)[methodName]
    if (typeof method === 'function') {
      return method(...args)
    }
  } catch {
    // Method doesn't exist or failed to call
  }
  return undefined
}

/**
 * Helper to set component data safely
 */
export function setComponentData(wrapper: VueWrapper<any>, property: string, value: any): boolean {
  try {
    (wrapper.vm as any)[property] = value
    return true
  } catch {
    return false
  }
}

/**
 * Create a mock file for testing file uploads
 */
export function createMockFile(name: string, content: string = 'test content', type: string = 'text/plain'): File {
  return new File([content], name, { type })
}

/**
 * Create a large mock file for testing file size limits
 */
export function createLargeMockFile(name: string, sizeInMB: number): File {
  const content = 'x'.repeat(sizeInMB * 1024 * 1024)
  return new File([content], name, { type: 'text/plain' })
}

/**
 * Helper to trigger file input change with mock files
 */
export async function triggerFileInput(wrapper: VueWrapper<any>, selector: string, files: File[]): Promise<void> {
  const fileInput = wrapper.find(selector)
  if (!fileInput.exists()) {
    throw new Error(`File input with selector "${selector}" not found`)
  }

  Object.defineProperty(fileInput.element, 'files', {
    value: files,
    writable: false
  })

  await fileInput.trigger('change')
}

/**
 * Helper to wait for DOM updates and async operations
 */
export async function waitForUpdate(wrapper: VueWrapper<any>, timeout: number = 100): Promise<void> {
  await wrapper.vm.$nextTick()
  return new Promise(resolve => setTimeout(resolve, timeout))
}

/**
 * Mock localStorage for tests
 */
export function createMockLocalStorage() {
  return {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
  }
}

/**
 * Mock window location for tests
 */
export function createMockLocation(overrides: Partial<Location> = {}) {
  return {
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
    reload: vi.fn(),
    ...overrides
  }
}

/**
 * Helper to find elements by test ID
 */
export function findByTestId(wrapper: VueWrapper<any>, testId: string) {
  return wrapper.find(`[data-testid="${testId}"]`)
}

/**
 * Helper to find all elements by test ID
 */
export function findAllByTestId(wrapper: VueWrapper<any>, testId: string) {
  return wrapper.findAll(`[data-testid="${testId}"]`)
}

/**
 * Helper to check if an element exists by test ID
 */
export function existsByTestId(wrapper: VueWrapper<any>, testId: string): boolean {
  return findByTestId(wrapper, testId).exists()
}

/**
 * Helper to get text content by test ID
 */
export function getTextByTestId(wrapper: VueWrapper<any>, testId: string): string {
  const element = findByTestId(wrapper, testId)
  return element.exists() ? element.text() : ''
}

/**
 * Helper to simulate keyboard events with proper key codes
 */
export function createKeyboardEvent(type: string, key: string, options: Partial<KeyboardEventInit> = {}) {
  const keyCodeMap: Record<string, number> = {
    'Enter': 13,
    'Escape': 27,
    'Space': 32,
    'ArrowLeft': 37,
    'ArrowUp': 38,
    'ArrowRight': 39,
    'ArrowDown': 40,
    'Backspace': 8,
    'Tab': 9,
    'Delete': 46
  }

  return {
    key,
    code: options.code || key,
    keyCode: keyCodeMap[key] || (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0),
    which: keyCodeMap[key] || (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0),
    shiftKey: options.shiftKey || false,
    ctrlKey: options.ctrlKey || false,
    altKey: options.altKey || false,
    metaKey: options.metaKey || false,
    ...options
  }
}

/**
 * Helper to simulate mouse events
 */
export function createMouseEvent(type: string, options: Partial<MouseEventInit> = {}) {
  return {
    button: options.button || 0,
    buttons: options.buttons || 1,
    clientX: options.clientX || 0,
    clientY: options.clientY || 0,
    screenX: options.screenX || 0,
    screenY: options.screenY || 0,
    ctrlKey: options.ctrlKey || false,
    shiftKey: options.shiftKey || false,
    altKey: options.altKey || false,
    metaKey: options.metaKey || false,
    ...options
  }
}

/**
 * Helper to check if a button is disabled
 */
export function isButtonDisabled(wrapper: VueWrapper<any>, selector: string): boolean {
  const button = wrapper.find(selector)
  return button.exists() && button.attributes('disabled') !== undefined
}

/**
 * Helper to check if an input is disabled
 */
export function isInputDisabled(wrapper: VueWrapper<any>, selector: string): boolean {
  const input = wrapper.find(selector)
  return input.exists() && input.attributes('disabled') !== undefined
}

/**
 * Helper to get input value
 */
export function getInputValue(wrapper: VueWrapper<any>, selector: string): string {
  const input = wrapper.find(selector)
  return input.exists() ? (input.element as HTMLInputElement).value : ''
}

/**
 * Helper to set input value and trigger events
 */
export async function setInputValue(wrapper: VueWrapper<any>, selector: string, value: string): Promise<void> {
  const input = wrapper.find(selector)
  if (input.exists()) {
    await input.setValue(value)
    await input.trigger('input')
  }
}