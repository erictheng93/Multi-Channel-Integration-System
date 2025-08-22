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
export { default as teamMainHandler } from './team-main'
export { default as delayedMessageMainHandler } from './delayed-message-main'
export { default as conversationMainHandler } from './conversation-main'
export { default as systemMainHandler } from './system-main'
export { default as customerMainHandler } from './customer-main'
export { default as qrcodeMainHandler } from './qrcode-main'
export { default as sessionMainHandler } from './session-main'

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