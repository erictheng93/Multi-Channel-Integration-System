// API 處理器統一導出
// 所有處理器都已標準化，使用統一的響應格式和錯誤處理

// Legacy handlers (remaining active ones)
export { webhookHandler } from '../modules/integrations/handlers/webhook'
export * from '../modules/system/handlers/system-legacy'

// 新的主要處理器 (Handler-based approach)
export { default as authMainHandler } from '../modules/auth/handlers/auth-main'
export { default as teamMainHandler } from '../modules/teams/handlers/index' // Updated to use fully modular team handler (includes members, password)
export { default as delayedMessageMainHandler } from '../modules/delayed-message/handlers/delayed-message-modular' // Updated to use modular implementation
export { conversationsMainHandler as conversationMainHandler } from '../modules/conversations/handlers'
export { default as messagingMainHandler } from '../modules/messaging/handlers/messaging/index'
export { default as systemMainHandler } from '../modules/system/handlers/system-main'
export { default as customerMainHandler } from '../modules/customer/handlers/customer-main'
export { default as tagMainHandler } from '../modules/tags/handlers' // Updated to use modular tags handler
export { default as qrcodeMainHandler } from '../modules/system/handlers/qrcode-main'
export { default as sessionMainHandler } from '../modules/session/handlers/session-main' // Fixed: point to enterprise handler with comprehensive middleware
export { createAgentRouter as agentMainHandler } from '../modules/agents/handlers/agent-main' // Agents module handler

// Notifications 模組處理器 (新的統一通知系統)
export { default as notificationMainHandler } from '../modules/notifications/handlers/notification-router'

// 健康檢查模組處理器 (統一的健康檢查系統)
export { default as healthMainHandler } from '../modules/system/handlers/health-router'

// Notification module handler (modern)
export {
  createNotificationHandlerMethods as legacyNotificationHandler
} from '../modules/notifications'

// Real-time 模組處理器 (統一的即時通訊系統 - WebSocket only)
export {
  realtimeMainHandler as realtimeHandler,
  realtimeManagementHandler,
  eventHandler,
  realtime
} from '../modules/realtime'

// 處理器類型定義
export interface HandlerContext {
  env: {
    DB: D1Database
    JWT_SECRET: string
    LINE_CHANNEL_ACCESS_TOKEN?: string
    LINE_CHANNEL_SECRET?: string
    FB_VERIFY_TOKEN?: string
    FB_PAGE_ACCESS_TOKEN?: string
    R2_BUCKET?: R2Bucket
    R2_PUBLIC_URL?: string
    FRONTEND_URL?: string
    ENVIRONMENT?: string
  }
}

// 標準化的處理器響應類型
export type HandlerResponse = Response

// 處理器函數類型
export type HandlerFunction = (c: any) => Promise<HandlerResponse>

// 處理器對象類型
export interface Handler {
  [key: string]: HandlerFunction
}
