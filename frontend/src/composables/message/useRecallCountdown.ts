/**
 * useRecallCountdown
 *
 * 撤回窗口倒數：以「全域單一 1s ticker」驅動所有氣泡的倒數顯示，
 * 避免每個 MessageBubble 各自 setInterval（虛擬清單中可能同時渲染數十個）。
 * ticker 依訂閱數啟停：沒有任何 buffered 氣泡時完全靜止。
 */

import { ref, computed, onUnmounted, type ComputedRef } from 'vue'
import type { Message } from '@/types'
import { MESSAGE_STATUS } from '@/constants/message-status'

// ---------------------------------------------------------------------------
// Module-level shared ticker
// ---------------------------------------------------------------------------

const nowMs = ref(Date.now())
let tickerId: ReturnType<typeof setInterval> | null = null
let subscribers = 0

function subscribe(): void {
  subscribers++
  if (!tickerId) {
    nowMs.value = Date.now()
    tickerId = setInterval(() => {
      nowMs.value = Date.now()
    }, 1000)
  }
}

function unsubscribe(): void {
  subscribers = Math.max(0, subscribers - 1)
  if (subscribers === 0 && tickerId) {
    clearInterval(tickerId)
    tickerId = null
  }
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export interface RecallCountdown {
  /** 訊息目前處於撤回窗口內（buffered 且未過期） */
  isRecallable: ComputedRef<boolean>
  /** buffered 但倒數已歸零、尚未收到已送達事件（顯示「傳送中…」樂觀狀態） */
  isAwaitingDelivery: ComputedRef<boolean>
  /** 剩餘秒數（非 buffered 或已歸零為 0） */
  remainingSeconds: ComputedRef<number>
  /** m:ss 格式標籤，例如 "0:28" */
  countdownLabel: ComputedRef<string>
}

export function useRecallCountdown(message: ComputedRef<Message>): RecallCountdown {
  subscribe()
  onUnmounted(unsubscribe)

  const isBuffered = computed(() => {
    // 已撤回的訊息不再倒數、不再可撤回（後端撤回後 deliveryStatus 仍為
    // buffered）。isRecalled 有兩個來源：歷史載入回傳 DB 頂層欄位、
    // WS 撤回事件寫 metadata.isRecalled — 兩者都要認。
    if (message.value.isRecalled === true || message.value.metadata?.isRecalled === true) {
      return false
    }
    const status = message.value.deliveryStatus ?? message.value.status
    return status === MESSAGE_STATUS.BUFFERED && !!message.value.recallDeadline
  })

  const remainingSeconds = computed(() => {
    if (!isBuffered.value || !message.value.recallDeadline) {
      return 0
    }
    const deadline = new Date(message.value.recallDeadline).getTime()
    if (Number.isNaN(deadline)) {
      return 0
    }
    return Math.max(0, Math.ceil((deadline - nowMs.value) / 1000))
  })

  const isRecallable = computed(() => isBuffered.value && remainingSeconds.value > 0)

  // 倒數歸零但 WS 的已送達事件尚未到：樂觀顯示「傳送中…」，
  // 不可假顯示「已送達」（deliver() 的 message_updated 事件才是事實）。
  const isAwaitingDelivery = computed(() => isBuffered.value && remainingSeconds.value <= 0)

  const countdownLabel = computed(() => {
    const total = remainingSeconds.value
    const minutes = Math.floor(total / 60)
    const seconds = total % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  })

  return { isRecallable, isAwaitingDelivery, remainingSeconds, countdownLabel }
}
