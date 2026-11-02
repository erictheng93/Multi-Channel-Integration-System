/**
 * Team presence for the member list.
 *
 * Reads GET /api/team/presence (server caches 15 s, so poll no faster).
 * `available` false means the broadcaster was unreachable: an empty list
 * then means "unknown", and the UI must not draw offline dots.
 */
import { computed, onUnmounted, ref } from 'vue'
import { presenceApi } from '@/api/presence'

const POLL_MS = 30_000

export function useTeamPresence() {
  const onlineIds = ref<Set<string>>(new Set())
  const available = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  async function load(): Promise<void> {
    try {
      const response = await presenceApi.getTeamPresence()
      if (response.success && response.data) {
        onlineIds.value = new Set(response.data.onlineAgentIds)
        available.value = response.data.available
      } else {
        available.value = false
      }
    } catch {
      available.value = false
    }
  }

  function onVisibility(): void {
    if (document.visibilityState === 'visible') {
      void load()
    }
  }

  /** Load once, then refresh while the tab is visible. Stopped on unmount. */
  function start(): void {
    void load()
    if (timer) {return}
    // Stops on component unmount (onUnmounted below) and while the tab is hidden.
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load()
      }
    }, POLL_MS)
    document.addEventListener('visibilitychange', onVisibility)
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    document.removeEventListener('visibilitychange', onVisibility)
  }

  onUnmounted(stop)

  const onlineCount = computed(() => onlineIds.value.size)

  return { onlineIds, available, onlineCount, start, stop, load }
}
