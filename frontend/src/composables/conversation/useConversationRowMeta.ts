/**
 * Presentation helpers shared by the conversation list table and mobile cards.
 *
 * Two terms, never mixed:
 * - 未讀 (personal): conversations I have not opened -> conversation.unreadCount
 * - 待回覆 (team-wide): the customer wrote and no agent replied -> conversation.awaitingSince (the backend marker; a
 *   sticker or thanks after a reply is not a wait). Waits older than WAITING_WINDOW_DAYS are 逾期 (stale), not 待回覆.
 *   The list shows a pill only; wait minutes live on the dashboard.
 */

import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import type { Conversation } from '@/types'
import { WAITING_WINDOW_DAYS } from '@shared/api-contracts'

export type StatusTone = 'closed' | 'active' | 'pending'

export const UNREAD_HINT = '未讀＝你尚未開啟'
export const WAITING_HINT = `待回覆＝近 ${WAITING_WINDOW_DAYS} 天內，客戶來訊後尚無客服回覆`
export const STALE_HINT = `逾期＝客戶來訊後超過 ${WAITING_WINDOW_DAYS} 天仍未回覆（不計入待回覆）`
export const LEGEND_TEXT = `${UNREAD_HINT}；${WAITING_HINT}`

/** closed -> 已結案, assigned to a team -> 進行中, otherwise 待處理 */
export function statusOf(conversation: Conversation): { text: string; tone: StatusTone } {
  if (conversation.status === 'closed') { return { text: '已結案', tone: 'closed' } }
  if (conversation.assignedTeamId || conversation.assignedTeam) { return { text: '進行中', tone: 'active' } }
  return { text: '待處理', tone: 'pending' }
}

export type ReplyState = 'closed' | 'waiting' | 'stale' | 'replied' | 'open'

/**
 * The single status shown in the list: one value per row (已結案 / 待回覆 / 逾期 / 已回覆), so the row never
 * carries a reply column and a separate status column that can disagree. `open` = nothing to say yet.
 */
export function replyStateOf(conversation: Conversation, nowMs: number): { state: ReplyState; text: string } {
  if (isClosed(conversation)) { return { state: 'closed', text: '已結案' } }
  const kind = awaitingKind(conversation, nowMs)
  if (kind === 'waiting') { return { state: 'waiting', text: '待回覆' } }
  if (kind === 'stale') { return { state: 'stale', text: staleWaitText(conversation.awaitingSince, nowMs) || '逾期' } }
  if (isReplied(conversation, nowMs)) { return { state: 'replied', text: '已回覆' } }
  return { state: 'open', text: statusOf(conversation).text }
}

export function isClosed(conversation: Conversation): boolean {
  return conversation.status === 'closed'
}

const DAY_MS = 24 * 60 * 60 * 1000

export type AwaitingKind = 'waiting' | 'stale' | null

/**
 * Where an open conversation stands on a reply: 'waiting' (待回覆, wait started within the window),
 * 'stale' (逾期, older) or null. Uses the backend marker; falls back to the last sender only when the API
 * did not provide it (older cached rows).
 */
export function awaitingKind(conversation: Conversation, nowMs: number): AwaitingKind {
  if (isClosed(conversation)) { return null }
  if (conversation.awaitingSince !== undefined) {
    if (!conversation.awaitingSince) { return null }
    const since = Date.parse(conversation.awaitingSince)
    if (Number.isNaN(since)) { return 'waiting' }
    return nowMs - since > WAITING_WINDOW_DAYS * DAY_MS ? 'stale' : 'waiting'
  }
  return conversation.lastMessage?.senderType === 'customer' ? 'waiting' : null
}

/** 待回覆: open conversation with an unanswered customer message that started within the window */
export function isAwaitingReply(conversation: Conversation, nowMs: number = Date.now()): boolean {
  return awaitingKind(conversation, nowMs) === 'waiting'
}

/** 已回覆: open, not waiting, and the customer has been answered (a sign-off after the reply still counts) */
export function isReplied(conversation: Conversation, nowMs: number = Date.now()): boolean {
  if (isClosed(conversation) || awaitingKind(conversation, nowMs) !== null) { return false }
  const sender = conversation.lastMessage?.senderType
  return sender === 'agent' || (conversation.awaitingSince === null && sender === 'customer')
}

/** "已等 N 天" for a stale wait */
export function staleWaitText(since: string | null | undefined, nowMs: number): string {
  const start = since ? Date.parse(since) : Number.NaN
  if (Number.isNaN(start)) { return '' }
  return `已等 ${Math.max(0, Math.floor((nowMs - start) / DAY_MS))} 天`
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
