/**
 * Security Configuration Module
 * Centralized security settings and utilities
 */

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
      allowedOrigins: isDevelopment
        ? [
            'http://localhost:3000',
            'https://localhost:3000',
            'http://localhost:8787',
            'http://127.0.0.1:3000',
          ]
        : [
            'https://multi-channel.imfinethankyouandyou.com',
            'http://localhost:3000',
            'https://localhost:3000',
            // Allow development access to production API
          ],
      allowCredentials: true,
      maxAge: 86400, // 24 hours
    },
    headers: {
      csp: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.line-scdn.net https://static.cloudflareinsights.com", // Allow LIFF SDK and Cloudflare Insights
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "connect-src 'self' https://api.line.me https://graph.facebook.com https://access.line.me", // Add LINE Access API for LIFF
        "font-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
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
      windowMs: 60 * 1000, // 1 minute
      maxRequests: isProduction ? 100 : 1000, // Stricter in production
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
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': config.headers.csp,
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
export function sanitizeLogData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeLogData);
  }

  const sanitized: any = {};
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
    const nodeEnv = (globalThis as any).process?.env?.NODE_ENV;
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

  static log(message: string, data?: any): void {
    if (this.isDevelopment()) {
      console.log(message, data ? sanitizeLogData(data) : '');
    }
  }

  static warn(message: string, data?: any): void {
    console.warn(message, data ? sanitizeLogData(data) : '');
  }

  static error(message: string, error?: any): void {
    if (error instanceof Error) {
      console.error(message, {
        message: error.message,
        stack: this.isDevelopment() ? error.stack : '[REDACTED]',
      });
    } else {
      console.error(message, sanitizeLogData(error));
    }
  }

  static debug(message: string, data?: any): void {
    if (this.isDevelopment()) {
      console.debug(message, sanitizeLogData(data));
    }
  }
}