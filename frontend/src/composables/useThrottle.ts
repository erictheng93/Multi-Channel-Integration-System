// 節流 Composable
import { ref, watch, type Ref } from 'vue'

export function useThrottle<T>(value: Ref<T>, delay: number = 300) {
  const throttledValue = ref<T>(value.value) as Ref<T>
  let lastUpdate = 0

  watch(value, (newValue) => {
    const now = Date.now()
    if (now - lastUpdate >= delay) {
      throttledValue.value = newValue
      lastUpdate = now
    }
  }, { immediate: true })

  return throttledValue
}

export function useThrottledFunction<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number = 300
): T {
  let lastCall = 0

  return ((...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      return fn(...args)
    }
    return undefined
  }) as T
}