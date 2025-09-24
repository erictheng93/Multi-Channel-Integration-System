// Simplified WebSocket Broadcasting Service
// 專案名稱：Multi-Channel Support MVP - Reduced Complexity Implementation

import type { Bindings } from '../types'
import type { DurableObjectEvent, BroadcastTarget } from '../types/websocket-types'
import { safeAsync } from '../utils/simple-error-handler'

export class SimplifiedWebSocketBroadcastService {
  private env: Bindings

  constructor(env: Bindings) {
    this.env = env
  }

  // =================== Core Broadcasting (Simplified) ===================

  /**
   * Unified broadcasting method - eliminates repetitive event creation patterns
   */
  async broadcast(eventData: {
    type: string
    conversationId?: string
    userId?: string
    data: any
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    targets?: BroadcastTarget[]
  }): Promise<boolean> {
    const result = await safeAsync(async () => {
      const event: DurableObjectEvent = {
        id: crypto.randomUUID(),
        type: eventData.type as any,
        source: 'api',
        timestamp: Date.now(),
        userId: eventData.userId,
        conversationId: eventData.conversationId,
        data: eventData.data,
        priority: eventData.priority || 'normal',
        deliveryOptions: {
          broadcast: true,
          targets: eventData.targets || this.getDefaultTargets(eventData),
          persistent: false,
          ttl: 300000 // 5 minutes
        }
      }

      return this.broadcastEvent(event)
    }, 'SimplifiedBroadcast.broadcast')

    return result.success ? result.data! : false
  }

  /**
   * Quick broadcast methods for common scenarios
   */
  async broadcastMessage(conversationId: string, messageData: any): Promise<boolean> {
    return this.broadcast({
      type: 'message_sent',
      conversationId,
      data: messageData,
      priority: 'high'
    })
  }

  async broadcastTyping(conversationId: string, userId: string, isTyping: boolean): Promise<boolean> {
    return this.broadcast({
      type: isTyping ? 'typing_start' : 'typing_stop',
      conversationId,
      userId,
      data: { isTyping },
      priority: 'low'
    })
  }

  async broadcastPresence(userId: string, status: string, teamId?: number): Promise<boolean> {
    return this.broadcast({
      type: `user_${status}`,
      userId,
      data: { status, teamId },
      priority: 'low'
    })
  }

  // =================== Core Broadcasting Logic (Simplified) ===================

  private async broadcastEvent(event: DurableObjectEvent): Promise<boolean> {
    if (!this.isWebSocketEnabled()) {
      return false
    }

    const result = await safeAsync(async () => {
      const promises: Promise<boolean>[] = []

      if (event.deliveryOptions?.targets) {
        for (const target of event.deliveryOptions.targets) {
          switch (target.type) {
            case 'conversation':
              promises.push(this.broadcastToConversations(event, target.targets as string[]))
              break
            case 'user':
              promises.push(this.broadcastToUsers(event, target.targets as string[]))
              break
            case 'global':
              promises.push(this.broadcastGlobally(event))
              break
          }
        }
      }

      const results = await Promise.allSettled(promises)
      return results.some(r => r.status === 'fulfilled' && r.value)
    }, 'SimplifiedBroadcast.broadcastEvent')

    return result.success ? result.data! : false
  }

  // =================== Target-Specific Broadcasting (Simplified) ===================

  private async broadcastToConversations(event: DurableObjectEvent, conversationIds: string[]): Promise<boolean> {
    const result = await safeAsync(async () => {
      const promises = conversationIds.map(async (conversationId) => {
        const roomId = this.env.CONVERSATION_ROOM?.idFromName(conversationId)
        if (!roomId) return false

        const roomStub = this.env.CONVERSATION_ROOM?.get(roomId)
        if (!roomStub) return false

        const response = await roomStub.fetch('https://conversation-room/broadcast', {
          method: 'POST',
          body: JSON.stringify(event),
          headers: { 'Content-Type': 'application/json' }
        })

        return response.ok
      })

      const results = await Promise.allSettled(promises)
      return results.some(r => r.status === 'fulfilled' && r.value)
    }, 'SimplifiedBroadcast.broadcastToConversations')

    return result.success ? result.data! : false
  }

  private async broadcastToUsers(event: DurableObjectEvent, userIds: string[]): Promise<boolean> {
    const result = await safeAsync(async () => {
      const promises = userIds.map(async (userId) => {
        const userConnectionId = this.env.USER_CONNECTION?.idFromName(userId)
        if (!userConnectionId) return false

        const userConnectionStub = this.env.USER_CONNECTION?.get(userConnectionId)
        if (!userConnectionStub) return false

        const response = await userConnectionStub.fetch('https://user-connection/broadcast', {
          method: 'POST',
          body: JSON.stringify(event),
          headers: { 'Content-Type': 'application/json' }
        })

        return response.ok
      })

      const results = await Promise.allSettled(promises)
      return results.some(r => r.status === 'fulfilled' && r.value)
    }, 'SimplifiedBroadcast.broadcastToUsers')

    return result.success ? result.data! : false
  }

  private async broadcastGlobally(event: DurableObjectEvent): Promise<boolean> {
    const result = await safeAsync(async () => {
      const broadcasterId = this.env.MESSAGE_BROADCASTER?.idFromName('global')
      if (!broadcasterId) return false

      const broadcasterStub = this.env.MESSAGE_BROADCASTER?.get(broadcasterId)
      if (!broadcasterStub) return false

      const response = await broadcasterStub.fetch('https://message-broadcaster/broadcast-global', {
        method: 'POST',
        body: JSON.stringify({ event }),
        headers: { 'Content-Type': 'application/json' }
      })

      return response.ok
    }, 'SimplifiedBroadcast.broadcastGlobally')

    return result.success ? result.data! : false
  }

  // =================== Helper Methods (Simplified) ===================

  private getDefaultTargets(eventData: any): BroadcastTarget[] {
    if (eventData.conversationId) {
      return [{
        type: 'conversation',
        targets: [eventData.conversationId],
        priority: 'normal'
      }]
    }

    return [{
      type: 'global',
      targets: ['all'],
      priority: 'normal'
    }]
  }

  private isWebSocketEnabled(): boolean {
    // Simplified check - could be expanded with feature flags
    return Boolean(this.env.CONVERSATION_ROOM && this.env.MESSAGE_BROADCASTER)
  }

  // =================== Health Check (Simplified) ===================

  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    websocketEnabled: boolean
    timestamp: number
  }> {
    const websocketEnabled = this.isWebSocketEnabled()

    return {
      status: websocketEnabled ? 'healthy' : 'degraded',
      websocketEnabled,
      timestamp: Date.now()
    }
  }
}