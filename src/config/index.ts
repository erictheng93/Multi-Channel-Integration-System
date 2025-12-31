/**
 * Configuration Index
 *
 * Central export point for all configuration modules.
 * This allows for clean imports throughout the application.
 *
 * @module config
 */

// Re-export environment configuration
export * from './environment';

// Re-export external API configuration
export * from './external-apis';

// Re-export CORS configuration (specific exports to avoid conflicts)
export {
  ALLOWED_ORIGINS,
  CORS_HEADERS,
  addCorsHeaders,
  isOriginAllowed
} from './cors';

// Re-export security configuration
export * from './security';

// Re-export KV configuration
export * from './kv-config';
