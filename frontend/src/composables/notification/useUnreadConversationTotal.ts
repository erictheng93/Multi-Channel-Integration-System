/**
 * Unread Conversation Total
 *
 * 「有未讀的對話數」(單位:對話,非訊息)。以後端 GET /conversations/stats 的
 * unreadConversations 為權威基準,不受分頁/篩選影響;兩次校正之間以本地
 * 未讀狀態轉換(已讀 <-> 未讀)做樂觀增減,讓數字即時變動。
 *
 * 校正時機:登入後、分頁回到前景、網路恢復、定時(僅前景)、出現未知的新未讀對話。
 * 多分頁:以 BroadcastChannel 分享最新權威值,避免各分頁各算各的、重複打 /stats。
 */

import { computed, ref, watch, getCurrentScope, onScopeDispose } from 'vue'
import { useConversationsStore } from '@/stores/conversations'
import { useAuthStore } from '@/stores/auth'
import { conversationApi } from '@/api/conversations'

const CHANNEL_NAME = 'mcis-unread-conversation-total'
const FOCUS_MAX_AGE_MS = 30_000
const POLL_INTERVAL_MS = 120_000
const POLL_MAX_AGE_MS = 100_000
const NEW_UNREAD_MIN_GAP_MS = 30_000

export interface UnreadTransitions {
  /** 已存在於兩份清單、且未讀狀態改變的對話之淨增減 */
  delta: number
  /** 本次才出現於清單的未讀對話(無法得知先前狀態,需向後端校正) */
  appearedUnread: boolean
}

/** 比較前後兩份「對話 id -> 是否未讀」,只計算兩邊都存在的對話,避免分頁載入/切換篩選造成誤差 */
export function diffUnreadTransitions(
  prev: ReadonlyMap<string, boolean>,
  next: ReadonlyMap<string, boolean>
): UnreadTransitions {
  let delta = 0
  let appearedUnread = false
  for (const [id, unread] of next) {
    const before = prev.get(id)
    if (before === undefined) {
      if (unread) { appearedUnread = true }
    } else if (unread && !before) {
      delta++
    } else if (!unread && before) {
      delta--
    }
  }
  return { delta, appearedUnread }
}

/** 應只在 App 根層呼叫一次 */
export function useUnreadConversationTotal() {
  const conversationsStore = useConversationsStore()
  const authStore = useAuthStore()

  const serverTotal = ref<number | null>(null)
  const delta = ref(0)
  let fetchedAt = 0
  let inFlight = false
  let pendingTimer: ReturnType<typeof setTimeout> | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  const channel = typeof window.BroadcastChannel === 'undefined' ? null : new window.BroadcastChannel(CHANNEL_NAME)

  const unreadMap = computed(() => {
    const map = new Map<string, boolean>()
    for (const c of conversationsStore.conversations) {
      map.set(c.id, (c.unreadCount || 0) > 0)
    }
    return map
  })

  // 尚未取得權威值前,退回以已載入清單計算
  const total = computed(() => {
    if (serverTotal.value === null) {
      let local = 0
      for (const unread of unreadMap.value.values()) { if (unread) { local++ } }
      return local
    }
    return Math.max(0, serverTotal.value + delta.value)
  })

  const adopt = (value: number, at: number): void => {
    serverTotal.value = value
    delta.value = 0
    fetchedAt = at
  }

  const reconcile = async (maxAgeMs = 0): Promise<void> => {
    if (!authStore.isAuthenticated || inFlight) { return }
    if (maxAgeMs > 0 && Date.now() - fetchedAt < maxAgeMs) { return }
    inFlight = true
    try {
      const response = await conversationApi.getStats()
      const value = response.success ? response.data?.unreadConversations : undefined
      if (typeof value === 'number') {
        const at = Date.now()
        adopt(value, at)
        channel?.postMessage({ total: value, at })
      }
    } catch {
      // 失敗時保留現值,下次觸發再校正
    } finally {
      inFlight = false
    }
  }

  // 出現未知的新未讀對話:節流後校正(分頁載入更多亦會觸發,故至少間隔 NEW_UNREAD_MIN_GAP_MS)
  const scheduleReconcile = (): void => {
    if (pendingTimer) { return }
    const wait = Math.max(0, NEW_UNREAD_MIN_GAP_MS - (Date.now() - fetchedAt))
    pendingTimer = setTimeout(() => {
      pendingTimer = null
      void reconcile()
    }, wait)
  }

  watch(unreadMap, (next, prev) => {
    if (serverTotal.value === null) { return }
    const result = diffUnreadTransitions(prev, next)
    delta.value += result.delta
    if (result.appearedUnread) { scheduleReconcile() }
  })

  if (channel) {
    channel.onmessage = (event: MessageEvent<{ total?: unknown; at?: unknown }>) => {
      const { total: value, at } = event.data ?? {}
      if (typeof value === 'number' && typeof at === 'number' && at > fetchedAt) {
        adopt(value, at)
      }
    }
  }

  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') { void reconcile(FOCUS_MAX_AGE_MS) }
  }
  const onOnline = (): void => { void reconcile() }

  const start = (): void => {
    void reconcile()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('online', onOnline)
    pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') { void reconcile(POLL_MAX_AGE_MS) }
    }, POLL_INTERVAL_MS)
  }

  const stop = (): void => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('online', onOnline)
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null }
    serverTotal.value = null
    delta.value = 0
    fetchedAt = 0
  }

  const stopAuthWatch = watch(
    () => authStore.isAuthenticated,
    (authenticated) => { authenticated ? start() : stop() },
    { immediate: true }
  )

  if (getCurrentScope()) {
    onScopeDispose(() => {
      stopAuthWatch()
      stop()
      channel?.close()
    })
  }

  return { total, reconcile }
}
