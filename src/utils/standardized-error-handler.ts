// Standardized Error Handler
// Centralized error handling with consistent response format and logging

import type { Context } from 'hono'
import { errorResponse } from './api-response'

// Error classification for better handling
export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NOT_FOUND = 'not_found',
  CONFLICT = 'conflict',
  RATE_LIMIT = 'rate_limit',
  DATABASE = 'database',
  EXTERNAL_API = 'external_api',
  INTERNAL = 'internal'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Standard error structure
export interface StandardError {
  category: ErrorCategory
  message: string
  code?: string
  severity?: ErrorSeverity
  details?: Record<string, unknown>
}

// Error mapping for common cases
export const COMMON_ERRORS = {
  // Authentication errors
  MISSING_TOKEN: {
    category: ErrorCategory.AUTHENTICATION,
    message: 'Missing authentication token',
    code: 'AUTH_001',
    severity: ErrorSeverity.MEDIUM
  },
  INVALID_TOKEN: {
    category: ErrorCategory.AUTHENTICATION,
    message: 'Invalid authentication token',
    code: 'AUTH_002',
    severity: ErrorSeverity.MEDIUM
  },
  TOKEN_EXPIRED: {
    category: ErrorCategory.AUTHENTICATION,
    message: 'Authentication token expired',
    code: 'AUTH_003',
    severity: ErrorSeverity.MEDIUM
  },

  // Authorization errors
  PERMISSION_DENIED: {
    category: ErrorCategory.AUTHORIZATION,
    message: 'Permission denied',
    code: 'AUTHZ_001',
    severity: ErrorSeverity.MEDIUM
  },
  INSUFFICIENT_ROLE: {
    category: ErrorCategory.AUTHORIZATION,
    message: 'Insufficient role permissions',
    code: 'AUTHZ_002',
    severity: ErrorSeverity.MEDIUM
  },

  // Validation errors
  MISSING_REQUIRED_FIELD: {
    category: ErrorCategory.VALIDATION,
    message: 'Required field is missing',
    code: 'VAL_001',
    severity: ErrorSeverity.LOW
  },
  INVALID_FORMAT: {
    category: ErrorCategory.VALIDATION,
    message: 'Invalid format',
    code: 'VAL_002',
    severity: ErrorSeverity.LOW
  },

  // Resource errors
  RESOURCE_NOT_FOUND: {
    category: ErrorCategory.NOT_FOUND,
    message: 'Resource not found',
    code: 'RES_001',
    severity: ErrorSeverity.LOW
  },
  RESOURCE_CONFLICT: {
    category: ErrorCategory.CONFLICT,
    message: 'Resource conflict',
    code: 'RES_002',
    severity: ErrorSeverity.MEDIUM
  },

  // Database errors
  DATABASE_ERROR: {
    category: ErrorCategory.DATABASE,
    message: 'Database operation failed',
    code: 'DB_001',
    severity: ErrorSeverity.HIGH
  },

  // Internal errors
  INTERNAL_ERROR: {
    category: ErrorCategory.INTERNAL,
    message: 'Internal server error',
    code: 'INT_001',
    severity: ErrorSeverity.CRITICAL
  }
} as const

// Status code mapping
const ERROR_STATUS_MAP = {
  [ErrorCategory.VALIDATION]: 400,
  [ErrorCategory.AUTHENTICATION]: 401,
  [ErrorCategory.AUTHORIZATION]: 403,
  [ErrorCategory.NOT_FOUND]: 404,
  [ErrorCategory.CONFLICT]: 409,
  [ErrorCategory.RATE_LIMIT]: 429,
  [ErrorCategory.DATABASE]: 500,
  [ErrorCategory.EXTERNAL_API]: 502,
  [ErrorCategory.INTERNAL]: 500
}

/**
 * Standardized error handler
 * Logs error based on severity and returns consistent response
 */
export function handleStandardError(
  c: Context,
  error: StandardError | string | Error | unknown,
  contextInfo?: Record<string, unknown>
): Response {
  let standardError: StandardError

  // Normalize error to StandardError format
  if (typeof error === 'string') {
    standardError = {
      category: ErrorCategory.INTERNAL,
      message: error,
      severity: ErrorSeverity.MEDIUM
    }
  } else if (error instanceof Error) {
    standardError = {
      category: ErrorCategory.INTERNAL,
      message: error.message,
      severity: ErrorSeverity.HIGH,
      details: { stack: error.stack }
    }
  } else if (isStandardError(error)) {
    standardError = error
  } else {
    standardError = COMMON_ERRORS.INTERNAL_ERROR
  }

  // Log error based on severity
  logError(standardError, contextInfo)

  // Get appropriate status code
  const status = ERROR_STATUS_MAP[standardError.category] || 500

  // Return standardized error response
  return errorResponse(
    c,
    {
      code: standardError.code || 'UNKNOWN_ERROR',
      message: standardError.message,
      ...(standardError.details && { details: standardError.details })
    },
    status
  )
}

/**
 * Quick error helpers for common cases
 */
export const quickError = {
  unauthorized: (c: Context, message?: string) =>
    handleStandardError(c, { ...COMMON_ERRORS.MISSING_TOKEN, message: message || COMMON_ERRORS.MISSING_TOKEN.message }),

  forbidden: (c: Context, message?: string) =>
    handleStandardError(c, { ...COMMON_ERRORS.PERMISSION_DENIED, message: message || COMMON_ERRORS.PERMISSION_DENIED.message }),

  badRequest: (c: Context, message: string, details?: Record<string, unknown>) =>
    handleStandardError(c, {
      category: ErrorCategory.VALIDATION,
      message,
      severity: ErrorSeverity.LOW,
      details
    }),

  notFound: (c: Context, resource: string) =>
    handleStandardError(c, {
      ...COMMON_ERRORS.RESOURCE_NOT_FOUND,
      message: `${resource} not found`
    }),

  conflict: (c: Context, message: string) =>
    handleStandardError(c, {
      ...COMMON_ERRORS.RESOURCE_CONFLICT,
      message
    }),

  internal: (c: Context, error: Error | string) =>
    handleStandardError(c, error),

  database: (c: Context, operation: string, error?: Error) =>
    handleStandardError(c, {
      ...COMMON_ERRORS.DATABASE_ERROR,
      message: `Database ${operation} failed`,
      details: error ? { originalError: error.message } : undefined
    })
}

/**
 * Wrapper for async handler functions with automatic error handling
 */
export function withErrorHandling<T extends Context>(
  handler: (c: T) => Promise<Response>
): (c: T) => Promise<Response> {
  return async (c: T) => {
    try {
      return await handler(c)
    } catch (error) {
      return handleStandardError(c, error, {
        path: c.req.path,
        method: c.req.method,
        userAgent: c.req.header('user-agent')
      })
    }
  }
}

// Helper functions
function isStandardError(error: unknown): error is StandardError {
  return !!(error && typeof error === 'object' && 'category' in error && 'message' in error)
}

function logError(error: StandardError, contextInfo?: Record<string, unknown>) {
  const logLevel = getLogLevel(error.severity)
  const logData = {
    ...error,
    context: contextInfo,
    timestamp: new Date().toISOString()
  }

  if (logLevel === 'error') {
    console.error(`[${error.category.toUpperCase()}] ${error.message}`, logData)
  } else if (logLevel === 'warn') {
    console.warn(`[${error.category.toUpperCase()}] ${error.message}`, logData)
  } else {
    console.log(`[${error.category.toUpperCase()}] ${error.message}`, logData)
  }
}

function getLogLevel(severity?: ErrorSeverity): 'log' | 'warn' | 'error' {
  switch (severity) {
    case ErrorSeverity.CRITICAL:
    case ErrorSeverity.HIGH:
      return 'error'
    case ErrorSeverity.MEDIUM:
      return 'warn'
    default:
      return 'log'
  }
}