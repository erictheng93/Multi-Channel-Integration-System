/**
 * Environment Configuration
 *
 * Centralized environment configuration for URLs, ports, and environment-specific settings.
 * This file provides a single source of truth for all environment-related configuration.
 *
 * @module config/environment
 */

/**
 * Environment types
 */
export type Environment = 'development' | 'staging' | 'production';

/**
 * Get current environment
 */
export function getCurrentEnvironment(): Environment {
  // In Cloudflare Workers, we can check the binding or use a custom env variable
  // For now, we'll use a simple heuristic
  if (typeof globalThis !== 'undefined' && 'process' in globalThis) {
    const nodeEnv = (globalThis as any).process?.env?.NODE_ENV;
    if (nodeEnv === 'production') return 'production';
    if (nodeEnv === 'staging') return 'staging';
  }
  return 'development';
}

/**
 * Environment configuration interface
 */
export interface EnvironmentConfig {
  /** Environment name */
  name: Environment;

  /** Frontend configuration */
  frontend: {
    /** Frontend base URL */
    url: string;
    /** Development port (for local development) */
    port?: number;
    /** WebSocket URL (if different from base URL) */
    wsUrl?: string;
  };

  /** Backend configuration */
  backend: {
    /** Backend API base URL */
    url: string;
    /** Development port (for local development) */
    port?: number;
    /** WebSocket URL (if different from base URL) */
    wsUrl?: string;
  };

  /** Storage configuration */
  storage: {
    /** R2 public URL for file access */
    publicUrl: string;
  };

  /** Feature flags */
  features: {
    /** Enable debug logging */
    debug: boolean;
    /** Enable performance monitoring */
    monitoring: boolean;
    /** Enable experimental features */
    experimental: boolean;
  };
}

/**
 * Development environment configuration
 */
export const DEVELOPMENT_CONFIG: EnvironmentConfig = {
  name: 'development',
  frontend: {
    url: 'http://localhost:3000',
    port: 3000,
    wsUrl: 'ws://localhost:8787'
  },
  backend: {
    url: 'http://localhost:8787',
    port: 8787,
    wsUrl: 'ws://localhost:8787'
  },
  storage: {
    publicUrl: 'http://localhost:8787/files'
  },
  features: {
    debug: true,
    monitoring: true,
    experimental: true
  }
};

/**
 * Staging environment configuration
 */
export const STAGING_CONFIG: EnvironmentConfig = {
  name: 'staging',
  frontend: {
    url: 'https://staging-multi-channel.imfinethankyouandyou.com',
    wsUrl: 'wss://staging-multi-channel.imfinethankyouandyou.com'
  },
  backend: {
    url: 'https://staging-multi-channel.imfinethankyouandyou.com',
    wsUrl: 'wss://staging-multi-channel.imfinethankyouandyou.com'
  },
  storage: {
    publicUrl: 'https://s3-staging.imfinethankyouandyou.com'
  },
  features: {
    debug: true,
    monitoring: true,
    experimental: true
  }
};

/**
 * Production environment configuration
 */
export const PRODUCTION_CONFIG: EnvironmentConfig = {
  name: 'production',
  frontend: {
    url: 'https://multi-channel.imfinethankyouandyou.com',
    wsUrl: 'wss://multi-channel.imfinethankyouandyou.com'
  },
  backend: {
    url: 'https://multi-channel.imfinethankyouandyou.com',
    wsUrl: 'wss://multi-channel.imfinethankyouandyou.com'
  },
  storage: {
    publicUrl: 'https://s3.imfinethankyouandyou.com'
  },
  features: {
    debug: false,
    monitoring: true,
    experimental: false
  }
};

/**
 * Alternative production URLs (for backward compatibility)
 */
export const ALTERNATIVE_PRODUCTION_URLS = [
  'https://multi-channel-platform-frontend.pages.dev',
  'https://mcp.imfinethankyouandyou.com'
] as const;

/**
 * Development localhost variants (for CORS and security)
 */
export const DEVELOPMENT_LOCALHOST_URLS = [
  'http://localhost:3000',
  'https://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8787',
  'http://127.0.0.1:8787'
] as const;

/**
 * Get environment configuration based on current environment
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const env = getCurrentEnvironment();

  switch (env) {
    case 'production':
      return PRODUCTION_CONFIG;
    case 'staging':
      return STAGING_CONFIG;
    case 'development':
    default:
      return DEVELOPMENT_CONFIG;
  }
}

/**
 * Get all allowed origins for CORS (includes all environments)
 */
export function getAllAllowedOrigins(): string[] {
  return [
    // Production
    PRODUCTION_CONFIG.frontend.url,
    ...ALTERNATIVE_PRODUCTION_URLS,

    // Staging
    STAGING_CONFIG.frontend.url,

    // Development
    ...DEVELOPMENT_LOCALHOST_URLS
  ];
}

/**
 * Check if a URL is an allowed origin
 */
export function isAllowedOrigin(origin: string): boolean {
  return getAllAllowedOrigins().includes(origin);
}

/**
 * Get frontend URL for current environment
 */
export function getFrontendUrl(): string {
  return getEnvironmentConfig().frontend.url;
}

/**
 * Get backend URL for current environment
 */
export function getBackendUrl(): string {
  return getEnvironmentConfig().backend.url;
}

/**
 * Get WebSocket URL for current environment
 */
export function getWebSocketUrl(): string {
  const config = getEnvironmentConfig();
  return config.backend.wsUrl || config.backend.url.replace(/^http/, 'ws');
}

/**
 * Get storage public URL for current environment
 */
export function getStoragePublicUrl(): string {
  return getEnvironmentConfig().storage.publicUrl;
}

/**
 * Check if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
  return getEnvironmentConfig().features.debug;
}

/**
 * Check if monitoring is enabled
 */
export function isMonitoringEnabled(): boolean {
  return getEnvironmentConfig().features.monitoring;
}

/**
 * Check if experimental features are enabled
 */
export function isExperimentalEnabled(): boolean {
  return getEnvironmentConfig().features.experimental;
}

/**
 * Check if running in development environment
 */
export function isDevelopment(): boolean {
  return getCurrentEnvironment() === 'development';
}

/**
 * Check if running in staging environment
 */
export function isStaging(): boolean {
  return getCurrentEnvironment() === 'staging';
}

/**
 * Check if running in production environment
 */
export function isProduction(): boolean {
  return getCurrentEnvironment() === 'production';
}

/**
 * Get API endpoint URL
 * Combines backend URL with API path
 */
export function getApiEndpoint(path: string): string {
  const baseUrl = getBackendUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

/**
 * Get WebSocket endpoint URL
 * Combines WebSocket URL with path
 */
export function getWebSocketEndpoint(path: string): string {
  const wsUrl = getWebSocketUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${wsUrl}${normalizedPath}`;
}

/**
 * Environment-specific timeout configurations
 */
export const ENVIRONMENT_TIMEOUTS = {
  development: {
    api: 30000,      // 30 seconds for development
    websocket: 60000 // 60 seconds for WebSocket
  },
  staging: {
    api: 15000,      // 15 seconds for staging
    websocket: 45000 // 45 seconds for WebSocket
  },
  production: {
    api: 10000,      // 10 seconds for production
    websocket: 30000 // 30 seconds for WebSocket
  }
} as const;

/**
 * Get API timeout for current environment
 */
export function getApiTimeout(): number {
  const env = getCurrentEnvironment();
  return ENVIRONMENT_TIMEOUTS[env].api;
}

/**
 * Get WebSocket timeout for current environment
 */
export function getWebSocketTimeout(): number {
  const env = getCurrentEnvironment();
  return ENVIRONMENT_TIMEOUTS[env].websocket;
}
