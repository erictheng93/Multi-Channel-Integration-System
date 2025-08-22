// 防抖 Composable
import { ref, watch, type Ref } from 'vue'

export function useDebounce<T>(value: Ref<T>, delay: number = 300) {
  const debouncedValue = ref<T>(value.value) as Ref<T>
  let timeout: NodeJS.Timeout | null = null

  watch(value, (newValue) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    
    timeout = setTimeout(() => {
      debouncedValue.value = newValue
    }, delay)
  }, { immediate: true })

  return debouncedValue
}

export function useDebouncedFunction<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number = 300
): T {
  let timeout: NodeJS.Timeout | null = null

  return ((...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    
    timeout = setTimeout(() => {
      fn(...args)
    }, delay)
  }) as T
}