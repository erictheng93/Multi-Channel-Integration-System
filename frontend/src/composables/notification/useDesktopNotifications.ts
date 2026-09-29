/**
 * Desktop Notifications for new customer messages
 *
 * 訂閱全域 WebSocket 'conversations' channel,對客戶新訊息彈瀏覽器桌面通知。
 * 核心 handler 以依賴注入工廠實作(createNewMessageHandler),單測無需 mock 模組;
 * useDesktopNotifications() 接上真實 stores / Notification API / router 與訂閱生命週期。
 * Spec: docs/superpowers/specs/2026-09-29-desktop-notifications-design.md
 */

import { onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useWebSocketStore } from '@/stores/websocket'
import { useConversationsStore } from '@/stores/conversations'
import { useAuthStore } from '@/stores/auth'
import type { WebSocketMessage } from '@/services/websocketClient'
import type { Conversation } from '@/types'
import { createLogger } from '@/utils/logger'
import {
  shouldNotify,
  buildNotificationContent,
  type DesktopPermission
} from './desktopNotificationLogic'
import { useDesktopNotificationPrefs, type DesktopNotificationPrefs } from './useDesktopNotificationPrefs'

const logger = createLogger('useDesktopNotifications')

const NOTIFICATION_SOUND_URL = '/sounds/notification.wav'

export interface DesktopNotificationDeps {
  prefs: DesktopNotificationPrefs
  getPermission: () => DesktopPermission
  getConversation: (_id: string) => Conversation | undefined
  getCurrentConversationId: () => string | null
  getAllowedTeamIds: () => number[]
  isTabVisible: () => boolean
  showNotification: (_args: { conversationId: string; title: string; body: string }) => void
  playSound: () => void
  now: () => number
}

export function createNewMessageHandler(deps: DesktopNotificationDeps): (_message: WebSocketMessage) => void {
  const lastNotifiedAt = new Map<string, number>()

  return (message: WebSocketMessage): void => {
    try {
      const data = message.data as Record<string, unknown> | undefined
      const conversationId = message.conversationId || (data?.conversationId as string | undefined)
      const senderType = data?.senderType as 'customer' | 'agent' | undefined
      if (!conversationId) {
        return
      }

      const conversation = deps.getConversation(conversationId)

      const notify = shouldNotify({
        eventType: message.type,
        senderType,
        conversationId,
        prefsEnabled: deps.prefs.enabled,
        permission: deps.getPermission(),
        scope: deps.prefs.scope,
        assignedTeamId: conversation?.assignedTeamId,
        allowedTeamIds: deps.getAllowedTeamIds(),
        isTabVisible: deps.isTabVisible(),
        currentConversationId: deps.getCurrentConversationId(),
        lastNotifiedAt: lastNotifiedAt.get(conversationId),
        now: deps.now()
      })
      if (!notify) {
        return
      }

      lastNotifiedAt.set(conversationId, deps.now())

      const sender = data?.sender as { name?: string } | undefined
      const { title, body } = buildNotificationContent({
        senderName: sender?.name,
        conversation,
        content: data?.content as string | undefined,
        messageType: data?.messageType as string | undefined
      })

      deps.showNotification({ conversationId, title, body })
      if (deps.prefs.soundEnabled) {
        deps.playSound()
      }
    } catch (error) {
      // 通知失敗絕不影響訊息流
      logger.debug('Desktop notification failed', error)
    }
  }
}

export function useDesktopNotifications() {
  const wsStore = useWebSocketStore()
  const conversationsStore = useConversationsStore()
  const authStore = useAuthStore()
  const router = useRouter()
  const { prefs, permission } = useDesktopNotificationPrefs()

  const playSound = (): void => {
    try {
      const audio = new Audio(NOTIFICATION_SOUND_URL)
      audio.volume = 0.5
      void audio.play().catch(() => { /* autoplay 政策等,靜默忽略 */ })
    } catch (error) {
      logger.debug('Failed to play notification sound', error)
    }
  }

  const showNotification = (args: { conversationId: string; title: string; body: string }): void => {
    // 不帶 icon:frontend/public 目前沒有 icon 資產
    const notification = new window.Notification(args.title, {
      body: args.body,
      tag: `conversation-${args.conversationId}` // 同對話新通知自動取代舊通知
    })
    notification.onclick = () => {
      try {
        window.focus()
        router.push({ name: 'ConversationDetail', params: { id: args.conversationId } }).catch((error: unknown) => {
          logger.debug('Notification click navigation failed', error)
        })
        notification.close()
      } catch (error) {
        logger.debug('Notification click navigation failed', error)
      }
    }
  }

  const handler = createNewMessageHandler({
    prefs,
    getPermission: () => permission.value,
    getConversation: (id) => conversationsStore.conversations.find((c: Conversation) => c.id === id),
    getCurrentConversationId: () => conversationsStore.currentConversation?.id ?? null,
    getAllowedTeamIds: () => authStore.allowedTeamIds,
    isTabVisible: () => document.visibilityState === 'visible',
    showNotification,
    playSound,
    now: () => Date.now()
  })

  let subscriptionId: string | null = null

  const start = (): void => {
    if (subscriptionId) {
      return
    }
    subscriptionId = wsStore.subscribe('conversations', handler)
    logger.debug('Desktop notifications started')
  }

  const stop = (): void => {
    if (!subscriptionId) {
      return
    }
    wsStore.unsubscribe(subscriptionId)
    subscriptionId = null
    logger.debug('Desktop notifications stopped')
  }

  onBeforeUnmount(stop)

  return { start, stop }
}
