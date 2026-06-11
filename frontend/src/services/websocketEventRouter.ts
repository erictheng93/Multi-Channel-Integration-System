/**
 * WebSocket Event Router - Phase B3
 *
 * WebSocket 事件路由器
 *
 * 职责：
 * - 定义消息类型到 channel 的映射规则
 * - 提供可测试的路由逻辑
 * - 支持动态路由规则扩展
 *
 * @module services/websocketEventRouter
 * @since Phase B3
 */

import type { WebSocketMessage } from './websocketClient'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('websocketEventRouter')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getStringField(value: unknown, field: string): string | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const fieldValue = value[field]
  return typeof fieldValue === 'string' ? fieldValue : undefined
}

/**
 * 路由规则函数类型
 */
export type RoutingRule = (_message: WebSocketMessage) => string[]

/**
 * 路由规则映射表
 */
export const ROUTING_RULES: Record<string, RoutingRule> = {
  /**
   * 对话列表更新 → conversations channel
   */
  'conversations_update': () => ['conversations'],

  /**
   * 对话更新 → conversations + 特定对话
   */
  'conversation_updated': (message) => {
    const channels = ['conversations']
    if (message.conversationId) {
      channels.push(`conversation:${message.conversationId}`)
    }
    return channels
  },

  /**
   * 新消息 → conversations + 对话 + 消息
   */
  'new_message': (message) => {
    const channels = ['conversations']
    if (message.conversationId) {
      channels.push(`conversation:${message.conversationId}`)
      channels.push(`messages:${message.conversationId}`)
    }
    return channels
  },

  /**
   * 消息更新 → 对话 + 消息
   */
  'message_updated': (message) => {
    const channels: string[] = []
    if (message.conversationId) {
      channels.push(`conversation:${message.conversationId}`)
      channels.push(`messages:${message.conversationId}`)
    }
    return channels
  },

  /**
   * 消息已读 → 对话 + 消息
   */
  'message_read': (message) => {
    const channels: string[] = []
    if (message.conversationId) {
      channels.push(`conversation:${message.conversationId}`)
      channels.push(`messages:${message.conversationId}`)
    }
    return channels
  },

  /**
   * 对话已关闭 → conversations + 对话
   */
  'conversation_closed': (message) => {
    const channels = ['conversations']
    if (message.conversationId) {
      channels.push(`conversation:${message.conversationId}`)
    }
    return channels
  },

  /**
   * 对话已指派 → conversations + 对话
   */
  'conversation_assigned': (message) => {
    const channels = ['conversations']
    if (message.conversationId) {
      channels.push(`conversation:${message.conversationId}`)
    }
    return channels
  },

  /**
   * 对话已转移 → conversations + 对话
   * 支持三種動作：removed（從舊團隊移除）、assigned（添加到新團隊）、team_changed（團隊變更通知）
   */
  'conversation_transferred': (message) => {
    const channels = ['conversations']
    if (message.conversationId) {
      channels.push(`conversation:${message.conversationId}`)
    }
    return channels
  },

  /**
   * 对话状态变更 → conversations + 对话
   */
  'conversation_status_changed': (message) => {
    const channels = ['conversations']
    if (message.conversationId) {
      channels.push(`conversation:${message.conversationId}`)
    }
    return channels
  },

  /**
   * 对话取消指派 → conversations + 对话
   */
  'conversation_unassigned': (message) => {
    const channels = ['conversations']
    if (message.conversationId) {
      channels.push(`conversation:${message.conversationId}`)
    }
    return channels
  },

  /**
   * 通知 → notifications channel
   */
  'notification': () => ['notifications'],

  /**
   * 活动流 → activity channel
   */
  'activity': () => ['activity'],

  /**
   * 用户状态变更 → presence channel
   */
  'user_presence': (message) => {
    const channels = ['presence']
    if (message.userId) {
      channels.push(`presence:${message.userId}`)
    }
    return channels
  },

  /**
   * 正在输入 → 特定对话
   */
  'typing': (message) => {
    const channels: string[] = []
    if (message.conversationId) {
      channels.push(`conversation:${message.conversationId}`)
    }
    return channels
  },

  /**
   * 客户标签更新 → tags channel（标签管理页面自动刷新）
   */
  'customer_tags_updated': () => ['tags'],

  /**
   * Analytics widget update → analytics dashboard + widget channels
   */
  'analytics_widget_updated': (message) => {
    const channels = ['analytics']
    const dashboardId = getStringField(message.data, 'dashboardId')
    const widgetId = getStringField(message.data, 'widgetId')

    if (dashboardId) {
      channels.push(`analytics:dashboard:${dashboardId}`)
    }

    if (widgetId) {
      channels.push(`analytics:widget:${widgetId}`)
    }

    return channels
  },

  /**
   * Analytics dashboard update → analytics dashboard channel
   */
  'analytics_dashboard_updated': (message) => {
    const channels = ['analytics']
    const dashboardId = getStringField(message.data, 'dashboardId')

    if (dashboardId) {
      channels.push(`analytics:dashboard:${dashboardId}`)
    }

    return channels
  }
}

/**
 * 系统消息类型（不需要路由）
 */
export const SYSTEM_MESSAGE_TYPES = new Set([
  'heartbeat',
  'pong',
  'connection_ack',
  'ping',
  'subscribe_ack',
  'unsubscribe_ack',
  'error'
])

/**
 * WebSocket 事件路由器
 */
export class WebSocketEventRouter {
  /**
   * 根据消息确定目标 channels
   *
   * @param message - WebSocket 消息
   * @returns channels 列表
   */
  static route(message: WebSocketMessage): string[] {
    const { type } = message

    // 系统消息不路由
    if (SYSTEM_MESSAGE_TYPES.has(type)) {
      return []
    }

    // 查找路由规则
    const rule = ROUTING_RULES[type]

    if (rule) {
      try {
        return rule(message)
      } catch (error) {
        console.error(`[WebSocketEventRouter] Error executing route rule for "${type}":`, error)
        return []
      }
    }

    // 未知消息类型
    console.warn(`[WebSocketEventRouter] No routing rule for message type: "${type}"`)
    return []
  }

  /**
   * 注册自定义路由规则
   *
   * @param type - 消息类型
   * @param rule - 路由规则函数
   */
  static registerRule(type: string, rule: RoutingRule): void {
    if (ROUTING_RULES[type]) {
      console.warn(`[WebSocketEventRouter] Overwriting existing rule for type: "${type}"`)
    }

    ROUTING_RULES[type] = rule
    frontendLogger.debug(`[WebSocketEventRouter] Registered rule for type: "${type}"`)
  }

  /**
   * 批量注册路由规则
   *
   * @param rules - 规则映射表
   */
  static registerRules(rules: Record<string, RoutingRule>): void {
    Object.entries(rules).forEach(([type, rule]) => {
      this.registerRule(type, rule)
    })
  }

  /**
   * 获取所有已注册的消息类型
   */
  static getRegisteredTypes(): string[] {
    return Object.keys(ROUTING_RULES)
  }

  /**
   * 检查消息类型是否已注册
   *
   * @param type - 消息类型
   */
  static hasRule(type: string): boolean {
    return type in ROUTING_RULES
  }

  /**
   * 检查是否为系统消息
   *
   * @param type - 消息类型
   */
  static isSystemMessage(type: string): boolean {
    return SYSTEM_MESSAGE_TYPES.has(type)
  }
}

/**
 * 默认导出路由函数（便于直接使用）
 */
export const routeMessage = WebSocketEventRouter.route.bind(WebSocketEventRouter)
