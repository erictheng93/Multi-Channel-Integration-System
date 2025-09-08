// 現代化異步數據處理 Composable
import { ref, computed } from 'vue'
import { useError } from './useError'

export interface UseAsyncDataOptions<T> {
  immediate?: boolean
  resetOnExecute?: boolean
  shallow?: boolean
  onSuccess?: (_data: T) => void
  onError?: (_error: Error | unknown) => void
  transform?: (_data: unknown) => T
}

export function useAsyncData<T = unknown>(
  _key: string,
  handler: () => Promise<T>,
  options: UseAsyncDataOptions<T> = {}
) {
  const {
    immediate = true,
    resetOnExecute = true,
    shallow = false,
    onSuccess,
    onError,
    transform
  } = options

  // 狀態管理
  const data = ref<T | null>(null)
  const pending = ref(false)
  const { error, handleError, clearError } = useError()
  
  // 執行狀態
  const executed = ref(false)
  const refreshCount = ref(0)
  
  // 計算屬性
  const isReady = computed(() => executed.value && !pending.value)
  const hasData = computed(() => data.value !== null)
  const isEmpty = computed(() => {
    if (!hasData.value) {return true}
    if (Array.isArray(data.value)) {return data.value.length === 0}
    if (typeof data.value === 'object') {return Object.keys(data.value).length === 0}
    return false
  })

  // 執行異步操作
  const execute = async (throwOnError = false): Promise<T | null> => {
    if (resetOnExecute) {
      data.value = null
    }
    
    pending.value = true
    clearError()
    
    try {
      const result = await handler()
      const transformedData = transform ? transform(result) : result
      
      data.value = transformedData
      executed.value = true
      refreshCount.value++
      
      onSuccess?.(transformedData)
      return transformedData
    } catch (err) {
      handleError(err)
      onError?.(err)
      
      if (throwOnError) {
        throw err
      }
      
      return null
    } finally {
      pending.value = false
    }
  }

  // 刷新數據
  const refresh = () => execute()
  
  // 重置狀態
  const reset = () => {
    data.value = null
    pending.value = false
    executed.value = false
    refreshCount.value = 0
    clearError()
  }

  // 自動執行 - 修復刷新時不執行的問題
  if (immediate) {
    // 使用 nextTick 而不是 onMounted，確保在任何情況下都能執行
    // 包括頁面刷新和路由導航
    Promise.resolve().then(() => {
      // 確保只在客戶端執行
      if (typeof window !== 'undefined') {
        execute()
      }
    })
  }

  return {
    // 數據狀態
    data: shallow ? data : computed(() => data.value),
    pending: computed(() => pending.value),
    error,
    
    // 狀態標識
    isReady,
    hasData,
    isEmpty,
    executed: computed(() => executed.value),
    refreshCount: computed(() => refreshCount.value),
    
    // 方法
    execute,
    refresh,
    reset
  }
}

// 專門用於 API 調用的 composable
export function useApi<T = unknown>(
  endpoint: string,
  fetcher: (_endpoint: string) => Promise<T>,
  options: UseAsyncDataOptions<T> = {}
) {
  return useAsyncData(
    `api:${endpoint}`,
    () => fetcher(endpoint),
    options
  )
}

// 用於列表數據的 composable
export function useAsyncList<T = unknown>(
  key: string,
  handler: () => Promise<T[]>,
  options: UseAsyncDataOptions<T[]> = {}
) {
  const result = useAsyncData(key, handler, {
    ...options,
    transform: options.transform || ((data: unknown) => Array.isArray(data) ? data : [])
  })

  // 列表特有的計算屬性
  const count = computed(() => result.data.value?.length || 0)
  const hasItems = computed(() => count.value > 0)

  return {
    ...result,
    count,
    hasItems,
    items: result.data
  }
}