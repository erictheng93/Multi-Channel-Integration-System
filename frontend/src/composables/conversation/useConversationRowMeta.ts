/**
 * Presentation helpers shared by the conversation list table and mobile cards.
 *
 * Two terms, never mixed:
 * - 未讀 (personal): conversations I have not opened -> conversation.unreadCount
 * - 待回覆 (team-wide): the customer wrote last and no agent replied -> lastMessage.senderType === 'customer'
 *   on an open conversation. The list shows a pill only; wait minutes live on the dashboard.
 */

import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import type { Conversation } from '@/types'

export type StatusTone = 'closed' | 'active' | 'pending'

export const UNREAD_HINT = '未讀＝你尚未開啟'
export const WAITING_HINT = '待回覆＝尚無客服回覆'
export const LEGEND_TEXT = `${UNREAD_HINT}；${WAITING_HINT}`

/** closed -> 已結案, assigned to a team -> 進行中, otherwise 待處理 */
export function statusOf(conversation: Conversation): { text: string; tone: StatusTone } {
  if (conversation.status === 'closed') { return { text: '已結案', tone: 'closed' } }
  if (conversation.assignedTeamId || conversation.assignedTeam) { return { text: '進行中', tone: 'active' } }
  return { text: '待處理', tone: 'pending' }
}

export function isClosed(conversation: Conversation): boolean {
  return conversation.status === 'closed'
}

/** 待回覆: open conversation whose last message came from the customer */
export function isAwaitingReply(conversation: Conversation): boolean {
  return !isClosed(conversation) && conversation.lastMessage?.senderType === 'customer'
}

/** 已回覆: open conversation whose last message came from an agent */
export function isReplied(conversation: Conversation): boolean {
  return !isClosed(conversation) && conversation.lastMessage?.senderType === 'agent'
}

export function unreadOf(conversation: Conversation): number {
  return isClosed(conversation) ? 0 : conversation.unreadCount || 0
}

/** Seconds of free reply left (Reply API window); null when absent or already past */
export function freeReplySeconds(conversation: Conversation, nowMs: number): number | null {
  const expires = conversation.replyWindowExpiresAt
  if (typeof expires !== 'number' || isClosed(conversation)) { return null }
  const left = Math.ceil((expires - nowMs) / 1000)
  return left > 0 ? left : null
}

export function platformName(platform?: string): string {
  const map: Record<string, string> = { line: 'LINE', facebook: 'Messenger', instagram: 'Instagram', whatsapp: 'WhatsApp' }
  return platform ? (map[platform] ?? platform) : ''
}

export function initialOf(name: string): string {
  return (name.trim().charAt(0) || '?').toUpperCase()
}

export function relativeTime(value: Date | number | string | undefined, nowMs: number): string {
  if (!value) { return '' }
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) { return '' }
  const diff = Math.max(0, nowMs - t) / 1000
  if (diff < 60) { return '剛剛' }
  const m = Math.floor(diff / 60)
  if (m < 60) { return `${m} 分鐘前` }
  const h = Math.floor(m / 60)
  if (h < 24) { return `${h} 小時前` }
  const d = Math.floor(h / 24)
  if (d < 30) { return `${d} 天前` }
  return new Date(t).toLocaleDateString('zh-TW')
}

/**
 * Live clock for relative times and free-reply countdowns.
 * Ticks every second only while a free-reply window is open, otherwise every 30 s.
 */
export function useRowClock(conversations: Ref<Conversation[]>) {
  const now = ref(Date.now())
  const anyWindowOpen = computed(() => conversations.value.some((c) => freeReplySeconds(c, now.value) !== null))
  let timer: ReturnType<typeof setInterval> | null = null

  const restart = (intervalMs: number): void => {
    if (timer) { clearInterval(timer) }
    timer = setInterval(() => { now.value = Date.now() }, intervalMs)
  }

  watch(anyWindowOpen, (open) => restart(open ? 1000 : 30_000), { immediate: true })
  onUnmounted(() => { if (timer) { clearInterval(timer) } })

  return { now }
}
