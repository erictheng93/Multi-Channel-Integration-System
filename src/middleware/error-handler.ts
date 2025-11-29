// Centralized Error Handler Middleware
// 集中式錯誤處理中間件

import type { Context } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  handleApiError,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  badRequestResponse,
  internalErrorResponse
} from '../utils/api-response';

// ==================== Custom Error Classes ====================

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, code: string, statusCode: number, isOperational = true) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error with field-level details
 */
export class ValidationError extends AppError {
  public readonly errors: Array<{ field: string; message: string; value?: unknown }>;

  constructor(errors: Array<{ field: string; message: string; value?: unknown }>) {
    super('Validation failed', 'VALIDATION_ERROR', 422);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Authentication error
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Authorization error
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Permission denied') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * Resource not found error
 */
export class NotFoundError extends AppError {
  public readonly resource: string;

  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
    this.resource = resource;
  }
}

/**
 * Bad request error
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request') {
    super(message, 'BAD_REQUEST', 400);
    this.name = 'BadRequestError';
  }
}

/**
 * Conflict error (e.g., duplicate resource)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

/**
 * Rate limit error
 */
export class TooManyRequestsError extends AppError {
  public readonly retryAfter?: number;

  constructor(message: string = 'Too many requests', retryAfter?: number) {
    super(message, 'TOO_MANY_REQUESTS', 429);
    this.name = 'TooManyRequestsError';
    this.retryAfter = retryAfter;
  }
}

// ==================== Error Handler Middleware ====================

/**
 * Global error handler middleware for Hono
 * Use with app.onError() to catch all unhandled errors
 */
export function globalErrorHandler(error: Error, c: Context): Response {
  console.error('🔴 [Global Error Handler]', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    path: c.req.path,
    method: c.req.method
  });

  // Handle custom AppError instances
  if (error instanceof AppError) {
    if (error instanceof ValidationError) {
      return validationErrorResponse(c, error.errors);
    }

    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse(c, error.message);
    }

    if (error instanceof ForbiddenError) {
      return forbiddenResponse(c, error.message);
    }

    if (error instanceof NotFoundError) {
      return notFoundResponse(c, error.resource);
    }

    if (error instanceof BadRequestError) {
      return badRequestResponse(c, error.message);
    }

    if (error instanceof ConflictError) {
      return c.json({
        success: false,
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
      }, 409);
    }

    if (error instanceof TooManyRequestsError) {
      const response = c.json({
        success: false,
        error: error.message,
        code: error.code,
        retryAfter: error.retryAfter,
        timestamp: new Date().toISOString()
      }, 429);

      if (error.retryAfter) {
        c.header('Retry-After', error.retryAfter.toString());
      }

      return response;
    }

    // Generic AppError
    // P2-6: Cast statusCode to ContentfulStatusCode for TypeScript compatibility
    return c.json({
      success: false,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    }, error.statusCode as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503);
  }

  // Handle standard errors using existing handleApiError
  return handleApiError(error, c);
}

/**
 * Error wrapper middleware - catches route errors
 * Use as: app.use('*', errorWrapper())
 */
export function errorWrapper(): MiddlewareHandler {
  return async (c, next) => {
    try {
      await next();
    } catch (error) {
      // Re-throw to let onError handler deal with it
      throw error;
    }
  };
}

/**
 * Async handler wrapper - wraps async route handlers
 * Automatically catches and forwards errors to error handler
 *
 * Usage:
 *   app.get('/path', asyncHandler(async (c) => { ... }))
 */
export function asyncHandler(
  handler: (c: Context) => Promise<Response>
): (c: Context) => Promise<Response> {
  return async (c: Context) => {
    try {
      return await handler(c);
    } catch (error) {
      throw error; // Will be caught by app.onError
    }
  };
}

// ==================== Utility Functions ====================

/**
 * Assert that a condition is true, throw if false
 */
export function assertExists<T>(
  value: T | null | undefined,
  resource: string = 'Resource'
): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundError(resource);
  }
}

/**
 * Assert that user has permission
 */
export function assertPermission(hasPermission: boolean, message?: string): void {
  if (!hasPermission) {
    throw new ForbiddenError(message || 'Permission denied');
  }
}

/**
 * Assert that user is authenticated
 */
export function assertAuthenticated(userId: string | number | undefined | null): void {
  if (!userId) {
    throw new UnauthorizedError('Authentication required');
  }
}

/**
 * Assert validation passes
 */
export function assertValidation(
  isValid: boolean,
  errors: Array<{ field: string; message: string; value?: unknown }>
): void {
  if (!isValid) {
    throw new ValidationError(errors);
  }
}
