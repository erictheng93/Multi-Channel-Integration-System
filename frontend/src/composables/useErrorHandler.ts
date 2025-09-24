import { ref, computed, type Ref } from 'vue'

/**
 * 錯誤類型枚舉
 */
export enum ErrorType {
  _NETWORK = 'network',
  _VALIDATION = 'validation',
  _AUTHENTICATION = 'authentication',
  _PERMISSION = 'permission',
  _SERVER = 'server',
  _CLIENT = 'client',
  _TIMEOUT = 'timeout',
  _UNKNOWN = 'unknown'
}

/**
 * 錯誤嚴重程度
 */
export enum ErrorSeverity {
  _LOW = 'low',       // 資訊性錯誤，不影響功能
  _MEDIUM = 'medium', // 部分功能受影響
  _HIGH = 'high',     // 主要功能無法使用
  _CRITICAL = 'critical' // 應用程式無法正常運行
}

/**
 * 錯誤上下文類型
 */
export interface ErrorContext {
  userId?: string
  sessionId?: string
  url?: string
  component?: string
  action?: string
  critical?: boolean
  metadata?: Record<string, string | number | boolean>
  [key: string]: unknown
}

/**
 * 錯誤信息接口
 */
export interface ErrorInfo {
  id: string
  type: ErrorType
  severity: ErrorSeverity
  message: string
  details?: string
  timestamp: number
  context?: ErrorContext
  retryable: boolean
  retryCount: number
  maxRetries: number
}

/**
 * 錯誤處理選項
 */
interface ErrorHandlerOptions {
  maxErrors?: number        // 最大錯誤記錄數
  autoRetry?: boolean      // 自動重試
  showToast?: boolean      // 顯示 Toast 通知
  logToConsole?: boolean   // 記錄到控制台
  reportToServer?: boolean // 上報到服務器
}

export interface ErrorHandler {
  // 錯誤狀態
  errors: Ref<ErrorInfo[]>
  hasErrors: Ref<boolean>
  criticalErrors: Ref<ErrorInfo[]>
  recentError: Ref<ErrorInfo | null>

  // 錯誤處理方法
  handleError: (_error: Error | string, _context?: ErrorContext, _type?: ErrorType) => void
  clearError: (_id: string) => void
  clearAllErrors: () => void
  retryError: (_id: string, _retryFn: () => Promise<void>) => Promise<void>

  // 用戶友好的錯誤消息
  getDisplayMessage: (_error: ErrorInfo) => string
  getRecoveryActions: (_error: ErrorInfo) => Array<{ label: string; action: () => void }>

  // 統計和報告
  getErrorStats: () => {
    total: number
    byType: Record<ErrorType, number>
    bySeverity: Record<ErrorSeverity, number>
  }
}

/**
 * 統一的錯誤處理 composable
 * 提供錯誤記錄、重試機制和用戶友好的錯誤體驗
 */
export function useErrorHandler(options: ErrorHandlerOptions = {}): ErrorHandler {
  const {
    maxErrors = 50,
    showToast = true,
    logToConsole = true,
    reportToServer = false
  } = options

  const errors = ref<ErrorInfo[]>([])

  // 計算屬性
  const hasErrors = computed(() => errors.value.length > 0)
  const criticalErrors = computed(() =>
    errors.value.filter(error => error.severity === ErrorSeverity._CRITICAL)
  )
  const recentError = computed((): ErrorInfo | null =>
    errors.value.length > 0 ? errors.value[0] || null : null
  )

  // 生成唯一錯誤 ID
  const generateErrorId = (): string => {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 確定錯誤類型
  const determineErrorType = (error: Error | string): ErrorType => {
    if (typeof error === 'string') {return ErrorType._CLIENT}

    const errorMessage = error.message.toLowerCase()

    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return ErrorType._NETWORK
    }
    if (errorMessage.includes('timeout')) {
      return ErrorType._TIMEOUT
    }
    if (errorMessage.includes('auth') || errorMessage.includes('unauthorized')) {
      return ErrorType._AUTHENTICATION
    }
    if (errorMessage.includes('permission') || errorMessage.includes('forbidden')) {
      return ErrorType._PERMISSION
    }
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return ErrorType._VALIDATION
    }
    if (errorMessage.includes('server') || errorMessage.includes('internal')) {
      return ErrorType._SERVER
    }

    return ErrorType._UNKNOWN
  }

  // 確定錯誤嚴重程度
  const determineSeverity = (type: ErrorType, context?: ErrorContext): ErrorSeverity => {
    switch (type) {
      case ErrorType._NETWORK:
      case ErrorType._TIMEOUT:
        return ErrorSeverity._MEDIUM
      case ErrorType._AUTHENTICATION:
      case ErrorType._PERMISSION:
        return ErrorSeverity._HIGH
      case ErrorType._SERVER:
        return ErrorSeverity._HIGH
      case ErrorType._VALIDATION:
        return ErrorSeverity._LOW
      case ErrorType._CLIENT:
        return context?.critical ? ErrorSeverity._CRITICAL : ErrorSeverity._LOW
      default:
        return ErrorSeverity._MEDIUM
    }
  }

  // 檢查錯誤是否可重試
  const isRetryable = (type: ErrorType): boolean => {
    return [
      ErrorType._NETWORK,
      ErrorType._TIMEOUT,
      ErrorType._SERVER
    ].includes(type)
  }

  // 處理錯誤
  const handleError = (
    error: Error | string,
    context?: ErrorContext,
    type?: ErrorType
  ) => {
    const errorType = type || determineErrorType(error)
    const severity = determineSeverity(errorType, context)
    const message = typeof error === 'string' ? error : error.message

    const errorInfo: ErrorInfo = {
      id: generateErrorId(),
      type: errorType,
      severity,
      message,
      details: typeof error === 'object' ? error.stack : undefined,
      timestamp: Date.now(),
      context,
      retryable: isRetryable(errorType),
      retryCount: 0,
      maxRetries: 3
    }

    // 添加到錯誤列表（最新的在前面）
    errors.value.unshift(errorInfo)

    // 限制錯誤數量
    if (errors.value.length > maxErrors) {
      errors.value = errors.value.slice(0, maxErrors)
    }

    // 記錄到控制台
    if (logToConsole) {
      const logLevel = severity === ErrorSeverity._CRITICAL ? 'error' :
                      severity === ErrorSeverity._HIGH ? 'warn' : 'info'
      console[logLevel](`[ErrorHandler] ${errorType.toUpperCase()}:`, {
        message,
        severity,
        context,
        timestamp: new Date(errorInfo.timestamp).toISOString()
      })
    }

    // TODO: 顯示用戶通知
    if (showToast && severity !== ErrorSeverity._LOW) {
      // 這裡可以整合 Toast 組件
      console.info('Toast notification would be shown:', getDisplayMessage(errorInfo))
    }

    // TODO: 上報到服務器
    if (reportToServer && severity === ErrorSeverity._CRITICAL) {
      // 這裡可以實施錯誤上報邏輯
      console.info('Error would be reported to server:', errorInfo)
    }
  }

  // 清除特定錯誤
  const clearError = (id: string) => {
    const index = errors.value.findIndex(error => error.id === id)
    if (index > -1) {
      errors.value.splice(index, 1)
    }
  }

  // 清除所有錯誤
  const clearAllErrors = () => {
    errors.value = []
  }

  // 重試錯誤
  const retryError = async (id: string, retryFn: () => Promise<void>) => {
    const error = errors.value.find(e => e.id === id)
    if (!error || !error.retryable) {
      throw new Error('Error not found or not retryable')
    }

    if (error.retryCount >= error.maxRetries) {
      throw new Error('Maximum retry attempts exceeded')
    }

    try {
      error.retryCount++
      await retryFn()
      clearError(id) // 成功後清除錯誤
    } catch (retryError) {
      handleError(retryError as Error, {
        ...error.context,
        retryAttempt: error.retryCount
      })
      throw retryError
    }
  }

  // 獲取用戶友好的錯誤消息
  const getDisplayMessage = (error: ErrorInfo): string => {
    switch (error.type) {
      case ErrorType._NETWORK:
        return '網路連接問題，請檢查您的網路狀態'
      case ErrorType._TIMEOUT:
        return '請求超時，請稍後重試'
      case ErrorType._AUTHENTICATION:
        return '請重新登入以繼續使用'
      case ErrorType._PERMISSION:
        return '您沒有執行此操作的權限'
      case ErrorType._VALIDATION:
        return '輸入資料格式有誤，請檢查後重試'
      case ErrorType._SERVER:
        return '服務器暫時無法回應，請稍後重試'
      default:
        return error.message || '發生未知錯誤'
    }
  }

  // 獲取恢復操作
  const getRecoveryActions = (error: ErrorInfo) => {
    const actions: Array<{ label: string; action: () => void }> = []

    if (error.retryable && error.retryCount < error.maxRetries) {
      actions.push({
        label: '重試',
        action: () => {
          // 這需要外部提供重試函數
          console.log('Retry action for error:', error.id)
        }
      })
    }

    actions.push({
      label: '關閉',
      action: () => clearError(error.id)
    })

    if (error.type === ErrorType._AUTHENTICATION) {
      actions.push({
        label: '重新登入',
        action: () => {
          // 這需要外部提供登入函數
          window.location.href = '/login'
        }
      })
    }

    return actions
  }

  // 獲取錯誤統計
  const getErrorStats = () => {
    const stats = {
      total: errors.value.length,
      byType: {} as Record<ErrorType, number>,
      bySeverity: {} as Record<ErrorSeverity, number>
    }

    // 初始化計數器
    Object.values(ErrorType).forEach(type => {
      stats.byType[type] = 0
    })
    Object.values(ErrorSeverity).forEach(severity => {
      stats.bySeverity[severity] = 0
    })

    // 統計
    errors.value.forEach(error => {
      stats.byType[error.type]++
      stats.bySeverity[error.severity]++
    })

    return stats
  }

  return {
    errors,
    hasErrors,
    criticalErrors,
    recentError,
    handleError,
    clearError,
    clearAllErrors,
    retryError,
    getDisplayMessage,
    getRecoveryActions,
    getErrorStats
  }
}