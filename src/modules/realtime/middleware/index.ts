// Real-time 模組中間件統一導出

// 認證中間件
export {
  realtimeAuth,
  sseAuth,
  eventSendAuth,
  managementAuth,
  getRealtimeAuth,
  hasRealtimePermission
} from './realtime-auth';

// 連接驗證中間件
export {
  connectionValidation,
  sseConnectionValidation,
  eventSendValidation,
  managementValidation,
  getConnectionValidation,
  cleanupRateLimitStore,
  getRateLimitStats
} from './connection-validation';

// 中間件組合
export async function getRealtimeMiddleware() {
  const {
    realtimeAuth,
    sseAuth,
    eventSendAuth,
    managementAuth
  } = await import('./realtime-auth');

  const {
    connectionValidation,
    sseConnectionValidation,
    eventSendValidation,
    managementValidation
  } = await import('./connection-validation');

  return {
    // SSE 連接專用中間件鏈
    sse: [sseAuth, sseConnectionValidation],

    // 事件發送專用中間件鏈
    eventSend: [eventSendAuth, eventSendValidation],

    // 管理端點專用中間件鏈
    management: [managementAuth, managementValidation],

    // 基礎認證中間件
    basicAuth: [realtimeAuth()],

    // 完整驗證中間件鏈
    full: [realtimeAuth(), connectionValidation()]
  };
}