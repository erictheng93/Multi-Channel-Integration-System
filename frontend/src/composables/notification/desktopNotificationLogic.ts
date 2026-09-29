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
  scope: DesktopNotificationScope
  assignedTeamId?: number
  allowedTeamIds: number[]
  isTabVisible: boolean
  currentConversationId: string | null
  lastNotifiedAt?: number
  now: number
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
  const body = mediaBody ?? ((input.content ?? '').slice(0, BODY_MAX_LENGTH) || '傳送了新訊息')

  return { title, body }
}
