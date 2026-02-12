/**
 * Login Attempts Tracking Composable
 * 登录尝试追踪组合式函数
 */
import { ref, computed } from 'vue'

export interface UseLoginAttemptsOptions {
  maxAttempts?: number
  lockDurationMs?: number
}

export function useLoginAttempts(options: UseLoginAttemptsOptions = {}) {
  const {
    maxAttempts = 5,
    lockDurationMs = 5 * 60 * 1000 // 5 minutes
  } = options

  const attempts = ref(0)
  const lockUntil = ref<number | null>(null)

  const isLocked = computed(() =>
    lockUntil.value !== null && Date.now() < lockUntil.value
  )

  const remainingSeconds = computed(() => {
    if (!lockUntil.value) {return 0}
    return Math.ceil((lockUntil.value - Date.now()) / 1000)
  })

  const lockMessage = computed(() => {
    if (!isLocked.value) {return null}
    return `帳號已鎖定，請在 ${remainingSeconds.value} 秒後重試`
  })

  // Increment attempts and lock if needed
  const recordFailedAttempt = (): boolean => {
    attempts.value++

    if (attempts.value >= maxAttempts) {
      lockUntil.value = Date.now() + lockDurationMs
      return true // Account is now locked
    }

    return false
  }

  // Reset attempts on successful login
  const reset = () => {
    attempts.value = 0
    lockUntil.value = null
  }

  // Check and clear lock if expired
  const checkAndClearLock = () => {
    if (lockUntil.value && Date.now() >= lockUntil.value) {
      reset()
    }
  }

  return {
    attempts,
    isLocked,
    remainingSeconds,
    lockMessage,
    recordFailedAttempt,
    reset,
    checkAndClearLock
  }
}
