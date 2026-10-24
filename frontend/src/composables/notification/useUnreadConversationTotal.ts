/**
 * Unread Conversation Total
 *
 * 「有未讀的對話數」(單位:對話,非訊息)。以後端 GET /conversations/stats 的
 * unreadConversations 為權威基準,不受分頁/篩選影響;兩次校正之間以本地
 * 未讀狀態轉換(已讀 <-> 未讀)做樂觀增減,讓數字即時變動。
 *
 * 校正時機:登入後、分頁回到前景、網路恢復、定時(僅前景)、出現未知的新未讀對話。
 * 多分頁:以 BroadcastChannel 分享最新權威值,避免各分頁各算各的、重複打 /stats。
 *
 * 快照邊界:每份快照以其請求的「發出時間」為邊界,視為含此前、不含此後的轉換。
 * 本地轉換帶時間戳記錄;採用快照時只捨棄邊界前的轉換,跨分頁快照亦同。
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
// 邊界晚於現在超過此值,表示系統時鐘曾被往回調,該邊界不再可信
const CLOCK_SKEW_TOLERANCE_MS = 60_000

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
  // 晚於目前快照邊界的本地轉換
  const transitions = ref<{ at: number; delta: number }[]>([])
  const delta = computed(() => transitions.value.reduce((sum, t) => sum + t.delta, 0))
  // 目前快照的邊界(其請求發出時間)
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

  // 跨分頁比較時間一律用 Date.now():各分頁共用系統時鐘且睡眠時照走。
  // performance.timeOrigin + now() 在部分平台睡眠時停走,久開的分頁會落後而丟棄自己的校正。
  // ponytail: 毫秒解析度,轉換與請求同毫秒時可能多計 1,下次校正即修正

  // 邊界早於目前快照者較舊,忽略;同毫秒的邊界照收(後到者不舊於現值);同時刻的轉換保留(與請求同時發生者視為不在快照內)
  // 回傳是否採用,未採用的快照不可再廣播
  const adopt = (value: number, at: number): boolean => {
    const now = Date.now()
    if (at < fetchedAt && fetchedAt <= now + CLOCK_SKEW_TOLERANCE_MS) { return false }
    serverTotal.value = value
    fetchedAt = at
    // 時間戳晚於現在者記於時鐘往回調之前,早於這份快照,已含在內
    transitions.value = transitions.value.filter((t) => t.at >= at && t.at <= now)
    // 伺服器何時讀取狀態不得而知,請求期間的轉換可能已被計入;保留之並稍後再校正一次以收斂
    // ponytail: 請求期間有轉換時,最多 ±該數,至遲 NEW_UNREAD_MIN_GAP_MS 後修正;要精確需伺服器回傳版本號
    if (transitions.value.length > 0) { scheduleReconcile() }
    return true
  }

  const reconcile = async (maxAgeMs = 0): Promise<void> => {
    if (!authStore.isAuthenticated || inFlight) { return }
    const age = Date.now() - fetchedAt
    // 負值表示時鐘往回調過,視為過期而照常校正
    if (maxAgeMs > 0 && age >= 0 && age < maxAgeMs) { return }
    inFlight = true
    // 請求期間發生的轉換不在伺服器快照內,adopt 以發出時間為邊界而保留之
    const at = Date.now()
    try {
      const response = await conversationApi.getStats()
      const value = response.success ? response.data?.unreadConversations : undefined
      if (typeof value === 'number' && adopt(value, at)) {
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
    const wait = Math.min(NEW_UNREAD_MIN_GAP_MS, Math.max(0, NEW_UNREAD_MIN_GAP_MS - (Date.now() - fetchedAt)))
    pendingTimer = setTimeout(() => {
      pendingTimer = null
      void reconcile()
    }, wait)
  }

  watch(unreadMap, (next, prev) => {
    if (serverTotal.value === null) { return }
    const result = diffUnreadTransitions(prev, next)
    if (result.delta !== 0) { transitions.value.push({ at: Date.now(), delta: result.delta }) }
    if (result.appearedUnread) { scheduleReconcile() }
  })

  if (channel) {
    channel.onmessage = (event: MessageEvent<{ total?: unknown; at?: unknown }>) => {
      const { total: value, at } = event.data ?? {}
      if (typeof value === 'number' && typeof at === 'number') { adopt(value, at) }
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
    transitions.value = []
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
