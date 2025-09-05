// Composables 相關類型定義
import type { Ref, ComputedRef } from 'vue'
import type { Agent } from '@/types'

// 異步狀態類型
export interface AsyncState<T> {
  data: Ref<T | null>
  pending: Ref<boolean>
  error: Ref<string | null>
  isReady: ComputedRef<boolean>
  hasData: ComputedRef<boolean>
  hasError: ComputedRef<boolean>
}

// 異步操作返回類型
export interface AsyncOperation<T> extends AsyncState<T> {
  execute: (throwOnError?: boolean) => Promise<T | null>
  refresh: () => Promise<T | null>
  reset: () => void
}

// 列表異步操作類型
export interface AsyncListOperation<T> extends AsyncOperation<T[]> {
  items: Ref<T[] | null>
  count: ComputedRef<number>
  hasItems: ComputedRef<boolean>
  isEmpty: ComputedRef<boolean>
}

// 表單狀態類型
export interface FormState<T extends Record<string, unknown>> {
  formData: Ref<T>
  errors: Ref<Partial<Record<keyof T, string>>>
  touched: Ref<Partial<Record<keyof T, boolean>>>
  isValid: ComputedRef<boolean>
  isDirty: ComputedRef<boolean>
}

// 表單操作類型
export interface FormOperations<T extends Record<string, unknown>> extends FormState<T> {
  setValidator: <K extends keyof T>(field: K, validator: (value: T[K]) => string | null) => void
  validateField: <K extends keyof T>(field: K) => boolean
  validateForm: () => boolean
  resetForm: () => void
  setFieldValue: <K extends keyof T>(field: K, value: T[K]) => void
  setFieldError: <K extends keyof T>(field: K, error: string) => void
  clearFieldError: <K extends keyof T>(field: K) => void
}


// LocalStorage 操作類型
export interface LocalStorageOperations<T> {
  data: Ref<T>
  setData: (value: T) => void
  removeData: () => void
}

// 對象 LocalStorage 操作類型
export interface LocalStorageObjectOperations<T extends Record<string, unknown>> 
  extends LocalStorageOperations<T> {
  updateProperty: <K extends keyof T>(property: K, value: T[K]) => void
  updateProperties: (updates: Partial<T>) => void
  reset: () => void
}

// 數組 LocalStorage 操作類型
export interface LocalStorageArrayOperations<T> extends LocalStorageOperations<T[]> {
  addItem: (item: T) => void
  removeItem: (index: number) => void
  removeItemBy: (predicate: (item: T) => boolean) => void
  updateItem: (index: number, item: T) => void
  clear: () => void
}

// 錯誤處理類型
export interface ErrorHandling {
  error: Ref<string | null>
  loading: Ref<boolean>
  setError: (message: string) => void
  clearError: () => void
  handleError: (err: Error | unknown) => void
}

// 主題類型
export interface ThemeState {
  theme: Ref<'light' | 'dark' | 'auto'>
  isDark: ComputedRef<boolean>
  isLight: ComputedRef<boolean>
  isAuto: ComputedRef<boolean>
}

export interface ThemeOperations extends ThemeState {
  setTheme: (theme: 'light' | 'dark' | 'auto') => void
  toggleTheme: () => void
}

// 認證狀態類型
export interface AuthState {
  isAuthenticated: ComputedRef<boolean>
  isAdmin: ComputedRef<boolean>
  currentAgent: ComputedRef<Agent | null>
  loading: ComputedRef<boolean>
  error: ComputedRef<string | null>
}

export interface AuthOperations extends AuthState {
  login: (credentials: { email: string; password: string }) => Promise<boolean>
  logout: () => Promise<void>
  hasPermission: (permission: string) => boolean
  hasRole: (role: string) => boolean
  validateSession: () => boolean
  extendSession: () => void
}

// 通用 Composable 返回類型
export interface ComposableReturn {
  [key: string]: Ref<unknown> | ComputedRef<unknown> | ((...args: unknown[]) => unknown)
}