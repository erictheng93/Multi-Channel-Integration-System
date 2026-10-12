/**
 * Desktop Notification Decision Logic
 *
 * 桌面通知的彈/不彈判斷鏈與內容組裝(純函式,無 Vue/Pinia 依賴)
 * Spec: docs/superpowers/specs/2026-09-29-desktop-notifications-design.md
 */

import type { Conversation } from '@/types'

export type DesktopNotificationScope = 'all' | 'my-teams'
export type DesktopPermission = NotificationPermission | 'unsupported'

/** 同一對話兩次通知的最小間隔(搭配 Notification tag 取代機制) */
export const NOTIFY_MIN_INTERVAL_MS = 3000

const BODY_MAX_LENGTH = 60

export interface NotificationDecisionInput {
  eventType: string
  senderType?: 'customer' | 'agent'
  conversationId?: string
  prefsEnabled: boolean
  permission: DesktopPermission
  /** 通知範圍:'all' 一律不限團隊;'my-teams' 需搭配 assignedTeamId/allowedTeamIds 判斷 */
  scope: DesktopNotificationScope
  /** 該對話目前指派的團隊 ID;undefined 表示未指派。僅在 scope 為 'my-teams' 時參與判斷 */
  assignedTeamId?: number
  /** 目前使用者所屬(有權限)的團隊 ID 清單。scope 為 'all' 時完全不檢查此欄位 */
  allowedTeamIds: number[]
  /** 分頁是否在前景(可視)。與 currentConversationId 搭配決定「使用者是否正在看這個對話」 */
  isTabVisible: boolean
  /** 使用者目前開啟中的對話 ID;僅當 isTabVisible 為 true 且等於本次事件的 conversationId 時才抑制通知 */
  currentConversationId: string | null
  lastNotifiedAt?: number
  /** 暫停通知到此時間戳(含音效);null/undefined 或已過期代表未暫停 */
  pausedUntil?: number | null
  now: number
}

export function isPaused(pausedUntil: number | null | undefined, now: number): boolean {
  return typeof pausedUntil === 'number' && now < pausedUntil
}

/** 「至 09:00」:下一個本地時間 09:00(凌晨 2 點按下 → 當天 09:00,不是隔天) */
export function nextNineAm(now: number): number {
  const target = new Date(now)
  target.setHours(9, 0, 0, 0)
  if (target.getTime() <= now) {
    target.setDate(target.getDate() + 1)
  }
  return target.getTime()
}

/** 暫停到期時間的顯示文字:今天只顯示 HH:mm,其他日子加「明天」/日期 */
export function formatPausedUntil(pausedUntil: number, now: number): string {
  const until = new Date(pausedUntil)
  const time = `${String(until.getHours()).padStart(2, '0')}:${String(until.getMinutes()).padStart(2, '0')}`
  const today = new Date(now)
  if (until.toDateString() === today.toDateString()) {
    return time
  }
  today.setDate(today.getDate() + 1)
  if (until.toDateString() === today.toDateString()) {
    return `明天 ${time}`
  }
  return `${until.getMonth() + 1}/${until.getDate()} ${time}`
}

export function shouldNotify(input: NotificationDecisionInput): boolean {
  if (input.eventType !== 'new_message') {
    return false
  }
  if (input.senderType !== 'customer') {
    return false
  }
  if (!input.conversationId) {
    return false
  }
  if (!input.prefsEnabled) {
    return false
  }
  if (input.permission !== 'granted') {
    return false
  }
  // 每則訊息到達時才比較時間,到期即自動恢復,不需計時器
  if (isPaused(input.pausedUntil, input.now)) {
    return false
  }

  if (input.scope === 'my-teams') {
    // 未指派團隊(或對話不在列表中查不到指派)一律視為範圍外
    if (input.assignedTeamId === undefined || !input.allowedTeamIds.includes(input.assignedTeamId)) {
      return false
    }
  }

  // 打擾抑制:分頁前景且正在看該對話才抑制;背景分頁一律彈
  if (input.isTabVisible && input.currentConversationId === input.conversationId) {
    return false
  }

  if (input.lastNotifiedAt !== undefined && input.now - input.lastNotifiedAt < NOTIFY_MIN_INTERVAL_MS) {
    return false
  }

  return true
}

export interface NotificationContentInput {
  senderName?: string
  conversation?: Conversation
  content?: string
  messageType?: string
}

export interface NotificationContent {
  title: string
  body: string
}

const MEDIA_BODY: Record<string, string> = {
  image: '傳送了圖片',
  sticker: '傳送了貼圖',
  file: '傳送了檔案',
  video: '傳送了影片',
  audio: '傳送了語音'
}

export function buildNotificationContent(input: NotificationContentInput): NotificationContent {
  const title = input.senderName || input.conversation?.customer?.name || '新訊息'

  const mediaBody = input.messageType ? MEDIA_BODY[input.messageType] : undefined
  const truncated = Array.from(input.content ?? '').slice(0, BODY_MAX_LENGTH).join('')
  const body = mediaBody ?? (truncated || '傳送了新訊息')

  return { title, body }
}
