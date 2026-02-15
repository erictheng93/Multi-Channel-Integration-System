// Real-time module middleware exports (WebSocket only)

// Authentication middleware
export {
  realtimeAuth,
  eventSendAuth,
  managementAuth,
  getRealtimeAuth,
  hasRealtimePermission
} from './realtime-auth';

// Connection validation middleware
export {
  connectionValidation,
  eventSendValidation,
  managementValidation,
  getConnectionValidation,
  cleanupRateLimitStore,
  getRateLimitStats
} from './connection-validation';

// Middleware combinations
export async function getRealtimeMiddleware() {
  const {
    realtimeAuth,
    eventSendAuth,
    managementAuth
  } = await import('./realtime-auth');

  const {
    connectionValidation,
    eventSendValidation,
    managementValidation
  } = await import('./connection-validation');

  return {
    // Event send middleware chain
    eventSend: [eventSendAuth, eventSendValidation],

    // Management endpoint middleware chain
    management: [managementAuth, managementValidation],

    // Basic auth middleware
    basicAuth: [realtimeAuth()],

    // Full validation middleware chain
    full: [realtimeAuth(), connectionValidation()]
  };
}
