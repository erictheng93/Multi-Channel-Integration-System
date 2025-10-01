// API 處理器統一導出
// 所有處理器都已標準化，使用統一的響應格式和錯誤處理

// 原有處理器
export { authHandler } from './auth'
export { conversationHandler } from './conversation'
export { messageHandler } from './message'
export { webhookHandler } from './webhook'
export { attachmentHandler } from './attachment'
export * from './system'
export * from './team'

// 新的主要處理器 (Handler-based approach)
export { default as authMainHandler } from './auth-main'
export { default as teamMainHandler } from '../modules/teams/handlers/team' // Updated to use modular team handler
export { default as delayedMessageMainHandler } from './delayed-message-modular' // Updated to use modular implementation
export { conversationsMainHandler as conversationMainHandler } from '../modules/conversations/handlers'
// TEMP FIX: Direct export fix
export { default as messagingMainHandler } from './messaging-main'
export { default as systemMainHandler } from './system-main'
export { default as customerMainHandler } from './customer-main'
export { default as qrcodeMainHandler } from './qrcode-main'
export { default as sessionMainHandler } from '../modules/session/handlers/session' // Updated to use modular session handler
export { createAgentRouter as agentMainHandler } from '../modules/agents/handlers/agent-main' // Agents module handler

// Notifications 模組處理器 (新的統一通知系統)
export { default as notificationMainHandler } from './notification-router'

// 健康檢查模組處理器 (統一的健康檢查系統)
export { default as healthMainHandler } from './health-router'

// Legacy notification handlers (已棄用，保留以防相容性問題)
export {
  createNotificationHandlerMethods as legacyNotificationHandler,
  createNotificationSSEHandlerMethods as legacyNotificationSSEHandler
} from '../modules/notifications'

// Real-time 模組處理器 (統一的即時通訊系統)
export {
  realtimeMainHandler as realtimeHandler,
  realtimeManagementHandler,
  sseHandler,
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