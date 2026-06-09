/**
 * Security Configuration Module
 * Centralized security settings and utilities
 */

import { CACHE_TTL, RATE_LIMITS } from '../constants/limits';
import { DEVELOPMENT_ORIGINS } from './development-origins';

export interface SecurityConfig {
  cors: {
    allowedOrigins: string[];
    allowCredentials: boolean;
    maxAge: number;
  };
  headers: {
    csp: string;
    hsts: string;
    frameOptions: string;
  };
  debug: {
    enabled: boolean;
    requireAuth: boolean;
    allowedRoles: string[];
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

/**
 * Environment-specific security configuration
 */
export function getSecurityConfig(environment: string = 'production'): SecurityConfig {
  const isDevelopment = environment === 'development' || environment === 'dev';
  const isProduction = environment === 'production' || environment === 'prod';

  return {
    cors: {
      // 使用動態配置 - 在運行時從環境變量讀取
      // 開發環境: 只允許 localhost
      // 生產環境: 從 FRONTEND_URL, BACKEND_URL 環境變量讀取 (使用 getAllowedOrigins)
      allowedOrigins: isDevelopment
        ? [...DEVELOPMENT_ORIGINS]
        : [], // Production origins are dynamically configured via getAllowedOrigins(env)
      allowCredentials: true,
      maxAge: CACHE_TTL.CORS_MAX_AGE,
    },
    headers: {
      csp: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://static.line-scdn.net https://static.cloudflareinsights.com", // Allow LIFF SDK and Cloudflare Insights
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "connect-src 'self' https://api.line.me https://graph.facebook.com https://access.line.me", // Add LINE Access API for LIFF
        "font-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join('; '),
      hsts: 'max-age=31536000; includeSubDomains; preload',
      frameOptions: 'DENY',
    },
    debug: {
      enabled: isDevelopment,
      requireAuth: true,
      allowedRoles: ['admin'], // Only admins can use debug endpoints
    },
    rateLimit: {
      windowMs: RATE_LIMITS.WINDOW_MS,
      maxRequests: isProduction
        ? RATE_LIMITS.MAX_REQUESTS_PRODUCTION
        : RATE_LIMITS.MAX_REQUESTS_DEVELOPMENT,
    },
  };
}

/**
 * Validate origin against allowed origins
 */
export function isOriginAllowed(origin: string | undefined, config: SecurityConfig): boolean {
  if (!origin) {
    return true; // Allow same-origin requests
  }

  return config.cors.allowedOrigins.some(allowedOrigin => {
    // Exact match
    if (origin === allowedOrigin) {
      return true;
    }

    // Wildcard subdomain matching (e.g., *.example.com)
    if (allowedOrigin.startsWith('*.')) {
      const domain = allowedOrigin.slice(2);
      return origin.endsWith(`.${domain}`) || origin === domain;
    }

    return false;
  });
}

/**
 * Security headers utility
 */
export function getSecurityHeaders(config: SecurityConfig, isHttps: boolean = false): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': config.headers.frameOptions,
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      config.headers.csp,
      "require-trusted-types-for 'script'",
      "trusted-types default dompurify",
    ].join('; '),
  };

  // Only set HSTS for HTTPS connections
  if (isHttps) {
    headers['Strict-Transport-Security'] = config.headers.hsts;
  }

  return headers;
}

/**
 * Sanitize log data to prevent sensitive information exposure
 */
export function sanitizeLogData(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeLogData);
  }

  const sanitized: Record<string, unknown> = {};
  const sensitiveFields = [
    'password',
    'passwordHash',
    'token',
    'secret',
    'key',
    'apiKey',
    'authorization',
    'cookie',
    'session',
  ];

  for (const [key, value] of Object.entries(data)) {
    const lowercaseKey = key.toLowerCase();

    if (sensitiveFields.some(field => lowercaseKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Get current environment safely
 * Compatible with both Node.js and Cloudflare Workers
 */
function getEnvironment(): string {
  // Check if we're in a Node.js-like environment
  if (typeof globalThis !== 'undefined' && 'process' in globalThis) {
    const nodeEnv = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV;
    if (nodeEnv) {
      return nodeEnv;
    }
  }
  // Default to production for safety in Workers environment
  return 'production';
}

/**
 * Environment-aware console logging
 */
export class SecureLogger {
  private static getEnvironment(): string {
    return getEnvironment();
  }

  private static isDevelopment(): boolean {
    return this.getEnvironment() === 'development';
  }

  static log(message: string, data?: unknown): void {
    if (this.isDevelopment()) {
      console.log(message, data ? sanitizeLogData(data) : '');
    }
  }

  static warn(message: string, data?: unknown): void {
    console.warn(message, data ? sanitizeLogData(data) : '');
  }

  static error(message: string, error?: unknown): void {
    if (error instanceof Error) {
      console.error(message, {
        message: error.message,
        stack: this.isDevelopment() ? error.stack : '[REDACTED]',
      });
    } else {
      console.error(message, sanitizeLogData(error));
    }
  }

  static debug(message: string, data?: unknown): void {
    if (this.isDevelopment()) {
      console.debug(message, sanitizeLogData(data));
    }
  }
}
