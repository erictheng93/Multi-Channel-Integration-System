import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useError } from '@/composables/useError'

describe('useError', () => {
  let errorComposable: ReturnType<typeof useError>

  beforeEach(() => {
    // Create a fresh instance for each test
    errorComposable = useError()
    
    // Clear console.error mock
    vi.clearAllMocks()
    
    // Mock console.error to avoid noise in test output
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('initial state', () => {
    it('should initialize with null error', () => {
      expect(errorComposable.error.value).toBeNull()
    })

    it('should initialize with loading false', () => {
      expect(errorComposable.loading.value).toBe(false)
    })
  })

  describe('handleError', () => {
    it('should set error from response data', () => {
      const mockError = {
        response: {
          data: {
            error: 'API 錯誤訊息'
          }
        }
      }

      errorComposable.handleError(mockError)
      
      expect(errorComposable.error.value).toBe('API 錯誤訊息')
      expect(console.error).toHaveBeenCalledWith(mockError)
    })

    it('should set error from error message', () => {
      const mockError = {
        message: '網路連接失敗'
      }

      errorComposable.handleError(mockError)
      
      expect(errorComposable.error.value).toBe('網路連接失敗')
    })

    it('should use default message when no specific error', () => {
      const mockError = {}

      errorComposable.handleError(mockError)
      
      expect(errorComposable.error.value).toBe('操作失敗')
    })

    it('should use custom default message', () => {
      const mockError = {}
      const customMessage = '自定義錯誤訊息'

      errorComposable.handleError(mockError, customMessage)
      
      expect(errorComposable.error.value).toBe(customMessage)
    })

    it('should prioritize response.data.error over message', () => {
      const mockError = {
        response: {
          data: {
            error: 'API 錯誤'
          }
        },
        message: '一般錯誤'
      }

      errorComposable.handleError(mockError)
      
      expect(errorComposable.error.value).toBe('API 錯誤')
    })

    it('should handle null error object', () => {
      errorComposable.handleError(null)
      
      expect(errorComposable.error.value).toBe('操作失敗')
    })

    it('should handle undefined error object', () => {
      errorComposable.handleError(undefined)
      
      expect(errorComposable.error.value).toBe('操作失敗')
    })

    it('should handle string error', () => {
      errorComposable.handleError('字串錯誤')
      
      expect(errorComposable.error.value).toBe('操作失敗')
    })

    it('should handle Error instance', () => {
      const error = new Error('標準錯誤')
      
      errorComposable.handleError(error)
      
      expect(errorComposable.error.value).toBe('標準錯誤')
    })
  })

  describe('clearError', () => {
    it('should clear existing error', () => {
      // Set an error first
      errorComposable.handleError({ message: '測試錯誤' })
      expect(errorComposable.error.value).toBe('測試錯誤')
      
      // Clear the error
      errorComposable.clearError()
      expect(errorComposable.error.value).toBeNull()
    })

    it('should work when no error exists', () => {
      expect(errorComposable.error.value).toBeNull()
      
      errorComposable.clearError()
      expect(errorComposable.error.value).toBeNull()
    })
  })

  describe('withLoading', () => {
    it('should handle successful async operation', async () => {
      const mockFn = vi.fn().mockResolvedValue('成功結果')
      
      const result = await errorComposable.withLoading(mockFn)
      
      expect(result).toBe('成功結果')
      expect(errorComposable.loading.value).toBe(false)
      expect(errorComposable.error.value).toBeNull()
      expect(mockFn).toHaveBeenCalledOnce()
    })

    it('should set loading to true during execution', async () => {
      let loadingDuringExecution = false
      
      const mockFn = vi.fn().mockImplementation(async () => {
        loadingDuringExecution = errorComposable.loading.value
        return '結果'
      })
      
      await errorComposable.withLoading(mockFn)
      
      expect(loadingDuringExecution).toBe(true)
      expect(errorComposable.loading.value).toBe(false)
    })

    it('should handle async operation failure', async () => {
      const mockError = new Error('異步操作失敗')
      const mockFn = vi.fn().mockRejectedValue(mockError)
      
      const result = await errorComposable.withLoading(mockFn)
      
      expect(result).toBeNull()
      expect(errorComposable.loading.value).toBe(false)
      expect(errorComposable.error.value).toBe('異步操作失敗')
      expect(console.error).toHaveBeenCalledWith(mockError)
    })

    it('should clear previous error before execution', async () => {
      // Set an initial error
      errorComposable.handleError({ message: '舊錯誤' })
      expect(errorComposable.error.value).toBe('舊錯誤')
      
      const mockFn = vi.fn().mockResolvedValue('成功')
      
      await errorComposable.withLoading(mockFn)
      
      expect(errorComposable.error.value).toBeNull()
    })

    it('should set loading to false even if operation fails', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('失敗'))
      
      await errorComposable.withLoading(mockFn)
      
      expect(errorComposable.loading.value).toBe(false)
    })

    it('should handle operation that throws non-Error object', async () => {
      const mockFn = vi.fn().mockRejectedValue('字串錯誤')
      
      const result = await errorComposable.withLoading(mockFn)
      
      expect(result).toBeNull()
      expect(errorComposable.loading.value).toBe(false)
      expect(errorComposable.error.value).toBe('操作失敗')
    })

    it('should handle operation that returns null', async () => {
      const mockFn = vi.fn().mockResolvedValue(null)
      
      const result = await errorComposable.withLoading(mockFn)
      
      expect(result).toBeNull()
      expect(errorComposable.loading.value).toBe(false)
      expect(errorComposable.error.value).toBeNull()
    })

    it('should handle operation that returns undefined', async () => {
      const mockFn = vi.fn().mockResolvedValue(undefined)
      
      const result = await errorComposable.withLoading(mockFn)
      
      expect(result).toBeUndefined()
      expect(errorComposable.loading.value).toBe(false)
      expect(errorComposable.error.value).toBeNull()
    })

    it('should handle multiple concurrent operations', async () => {
      const mockFn1 = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('結果1'), 100))
      )
      const mockFn2 = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('結果2'), 50))
      )
      
      const [result1, result2] = await Promise.all([
        errorComposable.withLoading(mockFn1),
        errorComposable.withLoading(mockFn2)
      ])
      
      expect(result1).toBe('結果1')
      expect(result2).toBe('結果2')
      expect(errorComposable.loading.value).toBe(false)
    })
  })

  describe('reactive behavior', () => {
    it('should maintain reactivity for error', () => {
      const initialError = errorComposable.error.value
      expect(initialError).toBeNull()
      
      errorComposable.handleError({ message: '新錯誤' })
      expect(errorComposable.error.value).toBe('新錯誤')
      expect(errorComposable.error.value).not.toBe(initialError)
    })

    it('should maintain reactivity for loading', async () => {
      expect(errorComposable.loading.value).toBe(false)
      
      const mockFn = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10))
      )
      
      const promise = errorComposable.withLoading(mockFn)
      
      // Should be true during execution
      expect(errorComposable.loading.value).toBe(true)
      
      await promise
      
      // Should be false after completion
      expect(errorComposable.loading.value).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle deeply nested error response', () => {
      const mockError = {
        response: {
          data: {
            error: {
              message: '深層錯誤',
              code: 500
            }
          }
        }
      }

      errorComposable.handleError(mockError)
      
      // Should not crash and use default message since error.message is an object
      expect(errorComposable.error.value).toBe('操作失敗')
    })

    it('should handle circular reference in error object', () => {
      const mockError: any = { message: '循環引用錯誤' }
      mockError.self = mockError
      
      errorComposable.handleError(mockError)
      
      expect(errorComposable.error.value).toBe('循環引用錯誤')
      expect(console.error).toHaveBeenCalledWith(mockError)
    })

    it('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(10000)
      const mockError = { message: longMessage }
      
      errorComposable.handleError(mockError)
      
      expect(errorComposable.error.value).toBe(longMessage)
    })

    it('should handle special characters in error messages', () => {
      const specialMessage = '錯誤：<script>alert("xss")</script> & 特殊字符 "quotes" \'apostrophes\''
      const mockError = { message: specialMessage }
      
      errorComposable.handleError(mockError)
      
      expect(errorComposable.error.value).toBe(specialMessage)
    })
  })
});