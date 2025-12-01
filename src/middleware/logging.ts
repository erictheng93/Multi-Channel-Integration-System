/**
 * Logging Middleware for Cloudflare Workers
 *
 * Configures the logger with environment bindings and provides
 * request-level logging for debugging and monitoring.
 *
 * @module middleware/logging
 */

import { createMiddleware } from 'hono/factory';
import type { Bindings } from '@/types';
import { configureLogger, createContextLogger, type LogLevel } from '@/utils/logger';

/**
 * Logger configuration middleware
 *
 * This middleware should be registered early in the middleware chain
 * to ensure the logger is configured before any other middleware or
 * handler runs.
 *
 * @example
 * ```ts
 * import { loggerMiddleware } from '@/middleware/logging';
 *
 * const app = new Hono<{ Bindings: Bindings }>();
 * app.use('*', loggerMiddleware);
 * ```
 */
export const loggerMiddleware = createMiddleware<{ Bindings: Bindings }>(
  async (c, next) => {
    // Configure logger with environment bindings
    configureLogger({
      logLevel: c.env.LOG_LEVEL as LogLevel | undefined,
      environment: c.env.ENVIRONMENT
    });

    await next();
  }
);

/**
 * Request logging middleware
 *
 * Logs incoming requests and response timing for monitoring.
 * Should be registered after loggerMiddleware.
 *
 * @example
 * ```ts
 * import { loggerMiddleware, requestLoggerMiddleware } from '@/middleware/logging';
 *
 * app.use('*', loggerMiddleware);
 * app.use('*', requestLoggerMiddleware);
 * ```
 */
export const requestLoggerMiddleware = createMiddleware<{ Bindings: Bindings }>(
  async (c, next) => {
    const log = createContextLogger('HTTP');
    const startTime = Date.now();
    const requestId = crypto.randomUUID().slice(0, 8);

    // Log incoming request (debug level to avoid noise in production)
    log.debug('Incoming request', {
      requestId,
      method: c.req.method,
      path: c.req.path,
      userAgent: c.req.header('user-agent')?.slice(0, 100)
    });

    // Store requestId in context for downstream handlers
    c.set('requestId' as never, requestId as never);

    await next();

    const duration = Date.now() - startTime;
    const status = c.res.status;

    // Log response (info level for errors, debug for success)
    if (status >= 400) {
      log.warn('Request completed with error', {
        requestId,
        method: c.req.method,
        path: c.req.path,
        status,
        duration_ms: duration
      });
    } else {
      log.debug('Request completed', {
        requestId,
        method: c.req.method,
        path: c.req.path,
        status,
        duration_ms: duration
      });
    }
  }
);

/**
 * Combined logging middleware for convenience
 *
 * Combines logger configuration and request logging into a single middleware.
 *
 * @example
 * ```ts
 * import { loggingMiddleware } from '@/middleware/logging';
 *
 * app.use('*', loggingMiddleware);
 * ```
 */
export const loggingMiddleware = createMiddleware<{ Bindings: Bindings }>(
  async (c, next) => {
    // Configure logger
    configureLogger({
      logLevel: c.env.LOG_LEVEL as LogLevel | undefined,
      environment: c.env.ENVIRONMENT
    });

    const log = createContextLogger('HTTP');
    const startTime = Date.now();

    await next();

    const duration = Date.now() - startTime;
    const status = c.res.status;

    // Only log errors and slow requests in production
    if (status >= 500) {
      log.error('Server error', {
        method: c.req.method,
        path: c.req.path,
        status,
        duration_ms: duration
      });
    } else if (status >= 400) {
      log.warn('Client error', {
        method: c.req.method,
        path: c.req.path,
        status,
        duration_ms: duration
      });
    } else if (duration > 3000) {
      // Log slow requests (> 3 seconds)
      log.warn('Slow request', {
        method: c.req.method,
        path: c.req.path,
        status,
        duration_ms: duration
      });
    }
  }
);

export default loggingMiddleware;
