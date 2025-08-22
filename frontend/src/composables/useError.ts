// 現代化錯誤處理 Composable
import { ref } from 'vue'
import type { ErrorHandling } from '../types/composables'

export interface ErrorDetails {
  message: string
  code?: string
  field?: string
  details?: Record<string, unknown>
}

export function useError(): ErrorHandling {
  const error = ref<string | null>(null)
  const loading = ref(false)
  const errorDetails = ref<ErrorDetails | null>(null)

  // 計算屬性 - removed unused isLoading

  // 設置錯誤
  const setError = (message: string, details?: Partial<ErrorDetails>) => {
    error.value = message
    errorDetails.value = {
      message,
      ...details
    }
  }

  // 清除錯誤
  const clearError = () => {
    error.value = null
    errorDetails.value = null
  }

  // 處理各種類型的錯誤
  const handleError = (err: unknown) => {
    console.error('Error occurred:', err)
    
    let errorMessage = '發生未知錯誤'
    const details: Partial<ErrorDetails> = {}
    
    if (err) {
      // 處理字符串錯誤
      if (typeof err === 'string') {
        errorMessage = err
      }
      // 處理 Error 對象
      else if (err instanceof Error) {
        errorMessage = err.message
        details.details = { stack: err.stack }
      }
      // 處理 API 錯誤響應
      else if (err && typeof err === 'object' && 'response' in err && err.response) {
        const response = err.response as { data?: { error?: string; message?: string; code?: string }; status?: number; statusText?: string }
        if (response.data?.error) {
          errorMessage = response.data.error
          details.code = response.data.code
        } else if (response.data?.message) {
          errorMessage = response.data.message
        } else {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
      }
      // 處理自定義錯誤對象
      else if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        errorMessage = err.message
        if ('code' in err && typeof err.code === 'string') {
          details.code = err.code
        }
        if ('field' in err && typeof err.field === 'string') {
          details.field = err.field
        }
        if ('details' in err) {
          details.details = err.details as Record<string, unknown>
        }
      }
      // 處理包含 error 屬性的對象
      else if (err && typeof err === 'object' && 'error' in err && typeof err.error === 'string') {
        errorMessage = err.error
        details.details = err as Record<string, unknown>
      }
      // 處理網路錯誤
      else if (err && typeof err === 'object' && (('name' in err && err.name === 'NetworkError') || ('code' in err && err.code === 'NETWORK_ERROR'))) {
        errorMessage = '網路連接錯誤，請檢查您的網路連接'
        details.code = 'NETWORK_ERROR'
      }
      // 處理超時錯誤
      else if (err && typeof err === 'object' && (('name' in err && err.name === 'TimeoutError') || ('code' in err && err.code === 'TIMEOUT'))) {
        errorMessage = '請求超時，請稍後再試'
        details.code = 'TIMEOUT'
      }
    }
    
    setError(errorMessage, details)
  }

  // 處理異步操作錯誤 - removed as not in interface

  // 重試機制 - removed as not in interface

  return {
    // 狀態
    error,
    loading,
    
    // 計算屬性 - removed errorDetails as it's not in interface
    
    // 方法
    setError,
    clearError,
    handleError
  }
}

// 全局錯誤處理 composable
export function useGlobalError() {
  const { error, setError, clearError, handleError } = useError()
  
  // 全局錯誤處理器
  const setupGlobalErrorHandler = () => {
    // 處理未捕獲的 Promise 錯誤
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason)
      handleError(event.reason)
      event.preventDefault()
    })
    
    // 處理 JavaScript 錯誤
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error)
      handleError(event.error)
    })
  }
  
  // 移除全局錯誤處理器
  const removeGlobalErrorHandler = () => {
    window.removeEventListener('unhandledrejection', handleError)
    window.removeEventListener('error', handleError)
  }
  
  return {
    error,
    setError,
    clearError,
    handleError,
    setupGlobalErrorHandler,
    removeGlobalErrorHandler
  }
}