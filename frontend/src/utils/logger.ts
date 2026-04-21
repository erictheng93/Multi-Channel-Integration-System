/**
 * Environment-gated logger for the frontend.
 *
 * In development: all levels log to console with structured prefixes.
 * In production: only warn and error are emitted; debug/info are silenced.
 *
 * Usage:
 * import { createLogger } from '@/utils/logger'
 * const log = createLogger('WebSocketIntegration')
 * log.debug('connecting', { url }) // silenced in prod
 * log.info('connected') // silenced in prod
 * log.warn('reconnecting', { attempt })
 * log.error('failed', error)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/** Minimum level that gets emitted */
const MIN_LEVEL: LogLevel = import.meta.env.DEV ? 'debug' : 'warn'
const browserConsole = globalThis.console

/* eslint-disable no-unused-vars */
export interface Logger {
  debug(message: unknown, ...args: unknown[]): void
  info(message: unknown, ...args: unknown[]): void
  warn(message: unknown, ...args: unknown[]): void
  error(message: unknown, ...args: unknown[]): void
}
/* eslint-enable no-unused-vars */

/**
 * Create a scoped logger instance.
 *
 * @param scope - Module or component name used as prefix, e.g. 'WebSocketIntegration'
 * @param overrideLevel - Optional override for the minimum log level
 */
export function createLogger(scope: string, overrideLevel?: LogLevel): Logger {
  const minPriority = LEVEL_PRIORITY[overrideLevel ?? MIN_LEVEL]

  function shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= minPriority
  }

  function formatArgs(message: unknown, args: unknown[]): unknown[] {
    if (typeof message === 'string') {
      return [`[${scope}] ${message}`, ...args]
    }

    return [`[${scope}]`, message, ...args]
  }

  return {
    debug(message: unknown, ...args: unknown[]) {
      if (shouldLog('debug')) {
        browserConsole.debug(...formatArgs(message, args))
      }
    },
    info(message: unknown, ...args: unknown[]) {
      if (shouldLog('info')) {
        browserConsole.info(...formatArgs(message, args))
      }
    },
    warn(message: unknown, ...args: unknown[]) {
      if (shouldLog('warn')) {
        browserConsole.warn(...formatArgs(message, args))
      }
    },
    error(message: unknown, ...args: unknown[]) {
      if (shouldLog('error')) {
        browserConsole.error(...formatArgs(message, args))
      }
    },
  }
}
