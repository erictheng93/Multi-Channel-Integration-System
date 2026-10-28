import { ref, computed, watch, onScopeDispose } from 'vue'
import { getApiUrl } from '@/config/runtime'
import { authenticatedFetch } from '@/api/authenticatedFetch'

interface ReplyWindowOptions {
  conversationId: () => string
  /** Only LINE conversations have a free reply window. */
  enabled: () => boolean
}

/**
 * LINE free-reply window indicator.
 * The backend reports whether the next reply can use the free Reply API and until when.
 * Sending is never blocked; after expiry replies fall back to Push, so we simply hide.
 * Call `refresh()` when a customer message arrives or after the agent sends.
 */
export function useReplyWindow(options: ReplyWindowOptions) {
  const expiresAt = ref<number | null>(null)
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | null = null
  let requestSeq = 0

  const secondsLeft = computed(() =>
    expiresAt.value === null ? 0 : Math.max(0, Math.ceil((expiresAt.value - now.value) / 1000)),
  )
  const visible = computed(() => secondsLeft.value > 0)

  const stopTimer = () => {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  const clear = () => {
    stopTimer()
    expiresAt.value = null
  }

  const startTimer = () => {
    stopTimer()
    now.value = Date.now()
    timer = setInterval(() => {
      now.value = Date.now()
      if (secondsLeft.value <= 0) {
        clear()
      }
    }, 1000)
  }

  const refresh = async (): Promise<void> => {
    const seq = ++requestSeq
    const id = options.conversationId()
    if (!options.enabled() || !id) {
      clear()
      return
    }
    try {
      const response = await authenticatedFetch(
        getApiUrl(`/api/customer-conversations/${id}/reply-window`),
      )
      const body = response.ok
        ? (await response.json()) as { data?: { available?: boolean; expiresAt?: number | null } }
        : null
      if (seq !== requestSeq) {return} // superseded by a newer refresh / conversation change
      const data = body?.data
      if (data?.available && typeof data.expiresAt === 'number' && data.expiresAt > Date.now()) {
        expiresAt.value = data.expiresAt
        startTimer()
      } else {
        clear()
      }
    } catch {
      if (seq === requestSeq) {clear()}
    }
  }

  watch(
    () => [options.conversationId(), options.enabled()] as const,
    () => {
      clear()
      void refresh()
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    requestSeq++
    clear()
  })

  return { secondsLeft, visible, refresh }
}
