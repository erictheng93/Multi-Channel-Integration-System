/**
 * Durable Objects 路由常量
 *
 * 本文件定義所有 Durable Objects 內部通信使用的路由路徑
 *
 * ⚠️ 重要說明：
 * Durable Objects 使用相對路徑進行內部 fetch 調用。
 * 這些路徑不是完整的 URL，而是 Durable Object 內部的路由。
 *
 * @module constants/durable-objects
 */

/**
 * MessageBroadcaster Durable Object 路由
 */
export const MESSAGE_BROADCASTER_ROUTES = {
  /** 廣播消息到連接的客戶端 */
  BROADCAST: '/broadcast',

  /** 獲取當前連接統計信息 */
  STATS: '/stats',

  /** 健康檢查 */
  HEALTH: '/health',
} as const;

/**
 * LatestMessageCacheCoordinator Durable Object 路由
 */
export const CACHE_COORDINATOR_ROUTES = {
  /** 排程快取更新 */
  SCHEDULE: '/schedule',

  /** 使快取失效 */
  INVALIDATE: '/invalidate',

  /** 預熱快取 */
  WARMUP: '/warmup',

  /** 批次更新 */
  BATCH_UPDATE: '/batch-update',
} as const;

/**
 * ConversationRoom Durable Object 路由
 */
export const CONVERSATION_ROOM_ROUTES = {
  /** WebSocket 連接升級 */
  WEBSOCKET: '/websocket',

  /** 發送消息 */
  MESSAGE: '/message',

  /** 獲取房間狀態 */
  STATUS: '/status',

  /** 離開房間 */
  LEAVE: '/leave',
} as const;

/**
 * UserConnection Durable Object 路由
 */
export const USER_CONNECTION_ROUTES = {
  /** WebSocket 連接 */
  CONNECT: '/connect',

  /** 斷開連接 */
  DISCONNECT: '/disconnect',

  /** 心跳檢查 */
  HEARTBEAT: '/heartbeat',

  /** 獲取用戶狀態 */
  STATUS: '/status',
} as const;

/**
 * DelayedMessageScheduler Durable Object 路由
 */
export const DELAYED_MESSAGE_ROUTES = {
  /** 排程延遲消息 */
  SCHEDULE: '/schedule',

  /** 取消延遲消息 */
  CANCEL: '/cancel',

  /** 獲取排程列表 */
  LIST: '/list',

  /** 立即發送 */
  SEND_NOW: '/send-now',
} as const;

/**
 * 所有 Durable Objects 路由的聯合類型
 */
export type DurableObjectRoute =
  | typeof MESSAGE_BROADCASTER_ROUTES[keyof typeof MESSAGE_BROADCASTER_ROUTES]
  | typeof CACHE_COORDINATOR_ROUTES[keyof typeof CACHE_COORDINATOR_ROUTES]
  | typeof CONVERSATION_ROOM_ROUTES[keyof typeof CONVERSATION_ROOM_ROUTES]
  | typeof USER_CONNECTION_ROUTES[keyof typeof USER_CONNECTION_ROUTES]
  | typeof DELAYED_MESSAGE_ROUTES[keyof typeof DELAYED_MESSAGE_ROUTES];

/**
 * 構建 Durable Object 內部 fetch URL
 *
 * ⚠️ Durable Objects 內部通信說明：
 * - Durable Objects 之間的 fetch 調用使用相對路徑
 * - 不需要完整的 HTTP URL
 * - 路由在 Durable Object 類中定義和處理
 *
 * @param route - 路由路徑（來自上述常量）
 * @returns 完整的內部 fetch URL（僅用於向後兼容）
 *
 * @example
 * ```typescript
 * // 推薦方式：直接使用路由常量
 * await broadcaster.fetch(MESSAGE_BROADCASTER_ROUTES.BROADCAST, { ... });
 *
 * // 如果需要完整 URL（不推薦，但向後兼容）
 * await broadcaster.fetch(buildDOFetchUrl(MESSAGE_BROADCASTER_ROUTES.BROADCAST), { ... });
 * ```
 */
export function buildDOFetchUrl(route: string): string {
  // Durable Objects 內部通信使用 'http://localhost' 作為基礎 URL
  // 這是 Cloudflare Workers 的特殊模式，localhost 代表同一個 Worker 內部
  return `http://localhost${route}`;
}

/**
 * 檢查路由是否有效
 * @param route - 要檢查的路由
 * @returns 如果路由有效則返回 true
 */
export function isValidDORoute(route: string): boolean {
  const allRoutes = [
    ...Object.values(MESSAGE_BROADCASTER_ROUTES),
    ...Object.values(CACHE_COORDINATOR_ROUTES),
    ...Object.values(CONVERSATION_ROOM_ROUTES),
    ...Object.values(USER_CONNECTION_ROUTES),
    ...Object.values(DELAYED_MESSAGE_ROUTES),
  ];

  return allRoutes.includes(route as any);
}
