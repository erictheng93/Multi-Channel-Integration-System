// Vue 3 現代化功能整合
import type { WatchSource, WatchOptions, WatchCallback, UnwrapRef } from 'vue';
import { ref, computed, watch, onMounted, onUnmounted, reactive, toRefs } from 'vue'
import { useRouter, useRoute } from 'vue-router'

// 現代化 Composition API 工具
export function useModernVue<T = unknown>() {
  const router = useRouter()
  const route = useRoute()
  
  // 響應式狀態管理
  const state = reactive({
    loading: false,
    error: null as string | null,
    data: null as T | null
  })
  
  // 計算屬性
  const isReady = computed(() => !state.loading && !state.error)
  const hasData = computed(() => state.data !== null)
  const hasError = computed(() => state.error !== null)
  
  // 監聽器管理
  const stopWatchers: (() => void)[] = []
  
  // 添加監聽器的輔助函數
  function addWatcher<U>(source: WatchSource<U>, callback: WatchCallback<U>, options?: WatchOptions) {
    const stop = watch(source, callback, options)
    stopWatchers.push(stop)
    return stop
  }
  
  // 狀態管理方法
  function setLoading(loading: boolean) {
    state.loading = loading
  }
  
  function setError(error: string | null) {
    state.error = error
  }
  
  function setData(data: T | null) {
    state.data = data as UnwrapRef<T> | null
  }
  
  function resetState() {
    state.loading = false
    state.error = null
    state.data = null
  }
  
  // 清理函數
  function cleanup() {
    stopWatchers.forEach(stop => stop())
    stopWatchers.length = 0
  }
  
  // 生命週期
  onMounted(() => {
    if (import.meta.env.DEV) {
      console.log('🚀 Modern Vue composable mounted')
    }
  })
  
  onUnmounted(() => {
    cleanup()
  })
  
  return {
    // 響應式狀態
    ...toRefs(state),
    
    // 計算屬性
    isReady,
    hasData,
    hasError,
    
    // 路由
    router,
    route,
    
    // 方法
    addWatcher,
    setLoading,
    setError,
    setData,
    resetState,
    cleanup
  }
}

// 現代化表單處理
export function useModernForm<T extends Record<string, unknown>>(initialData: T) {
  const formData = ref<T>({ ...initialData })
  const errors = ref<Partial<Record<keyof T, string>>>({})
  const touched = ref<Partial<Record<keyof T, boolean>>>({})
  
  // 驗證規則
  const validators = ref<Partial<Record<keyof T, (value: T[keyof T]) => string | null>>>({})
  
  // 設置驗證規則
  function setValidator<K extends keyof T>(field: K, validator: (value: T[K]) => string | null) {
    validators.value[field] = validator
  }
  
  // 驗證單個字段
  function validateField<K extends keyof T>(field: K): boolean {
    const validator = validators.value[field]
    if (!validator) {return true}
    
    const error = validator(formData.value[field])
    if (error) {
      errors.value[field] = error
      return false
    } else {
      delete errors.value[field]
      return true
    }
  }
  
  // 驗證整個表單
  function validateForm(): boolean {
    let isValid = true
    Object.keys(formData.value).forEach(key => {
      const fieldValid = validateField(key as keyof T)
      if (!fieldValid) {isValid = false}
    })
    return isValid
  }
  
  // 重置表單
  function resetForm() {
    formData.value = { ...initialData }
    errors.value = {}
    touched.value = {}
  }
  
  // 計算屬性
  const isValid = computed(() => Object.keys(errors.value).length === 0)
  const isDirty = computed(() => Object.keys(touched.value).length > 0)
  
  return {
    formData,
    errors,
    touched,
    isValid,
    isDirty,
    setValidator,
    validateField,
    validateForm,
    resetForm
  }
}