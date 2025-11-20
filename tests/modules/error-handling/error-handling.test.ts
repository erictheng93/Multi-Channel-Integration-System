// Error Handling Module Unit Tests
// 錯誤處理模組單元測試

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BaseModuleError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ErrorMapper,
  ErrorSeverity
} from '@backend/shared/error-handling/module-errors';
import {
  ModuleErrorHandler,
  createErrorHandlingMiddleware,
  withErrorHandling
} from '@backend/shared/error-handling/error-handlers';
import { ErrorLogimport { MockFactory } from '@helpers/mockFactory';
ger } from '@shared/error-handling/error-logger';

describe('Module Errors', () => {
  describe('BaseModuleError', () => {
    test('should create error with all required properties', () => {
      const error = new ValidationError('Test validation error', 'test-module', { field: 'email' });


  afterEach(() => {
    vi.restoreAllMocks();
  });
      expect(error).toBeInstanceOf(BaseModuleError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Test validation error');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.module).toBe('test-module');
      expect(error.details).toEqual({ field: 'email' });
      expect(error.timestamp).toBeDefined();
    });

    test('should be serializable to JSON', () => {
      const error = new AuthenticationError('Auth failed', 'auth-module');
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'AuthenticationError',
        message: 'Auth failed',
        code: 'AUTHENTICATION_ERROR',
        module: 'auth-module',
        timestamp: error.timestamp,
        details: undefined,
        stack: error.stack
      });
    });
  });

  describe('Specific Error Types', () => {
    test('should create ValidationError correctly', () => {
      const error = new ValidationError('Invalid input', 'form-module');

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.module).toBe('form-module');
    });

    test('should create AuthenticationError correctly', () => {
      const error = new AuthenticationError('Login failed', 'auth-module');

      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.module).toBe('auth-module');
    });

    test('should create NotFoundError correctly', () => {
      const error = new NotFoundError('User', 'user-module');

      expect(error.message).toBe('User not found');
      expect(error.code).toBe('NOT_FOUND_ERROR');
      expect(error.module).toBe('user-module');
    });
  });

  describe('ErrorMapper', () => {
    test('should map standard Error to ValidationError', () => {
      const standardError = new Error('Invalid email format');
      const mappedError = ErrorMapper.mapToModuleError(standardError, 'user-module');

      expect(mappedError).toBeInstanceOf(ValidationError);
      expect(mappedError.code).toBe('VALIDATION_ERROR');
      expect(mappedError.module).toBe('user-module');
    });

    test('should map not found error correctly', () => {
      const standardError = new Error('User not found in database');
      const mappedError = ErrorMapper.mapToModuleError(standardError, 'user-module');

      expect(mappedError).toBeInstanceOf(NotFoundError);
      expect(mappedError.code).toBe('NOT_FOUND_ERROR');
    });

    test('should return existing BaseModuleError unchanged', () => {
      const originalError = new ValidationError('Test error', 'test-module');
      const mappedError = ErrorMapper.mapToModuleError(originalError, 'other-module');

      expect(mappedError).toBe(originalError);
      expect(mappedError.module).toBe('test-module'); // Should preserve original module
    });

    test('should handle non-Error objects', () => {
      const unknownError = { someProperty: 'value' };
      const mappedError = ErrorMapper.mapToModuleError(unknownError, 'test-module');

      expect(mappedError.code).toBe('SYSTEM_ERROR');
      expect(mappedError.message).toContain('Unknown error');
    });

    test('should determine correct severity levels', () => {
      const validationError = new ValidationError('Invalid input', 'test');
      const authError = new AuthenticationError('Unauthorized', 'test');
      const systemError = new BaseModuleError('System failure', 'SYSTEM_ERROR', 'test');

      expect(ErrorMapper.getSeverity(validationError)).toBe(ErrorSeverity.LOW);
      expect(ErrorMapper.getSeverity(authError)).toBe(ErrorSeverity.MEDIUM);
      expect(ErrorMapper.getSeverity(systemError)).toBe(ErrorSeverity.CRITICAL);
    });
  });
});

describe('ModuleErrorHandler', () => {
  let handler: ModuleErrorHandler;
  let mockContext: any;
  let mockLogger: ErrorLogger;

  beforeEach(() => {
    mockLogger = {
      logError: vi.fn(),
      logRecovery: vi.fn()
    } as any;

    mockContext = {
      get: vi.fn(),
      json: vi.fn().mockReturnValue(new Response()),
      req: {
        path: '/test/path',
        method: 'POST',
        header: vi.fn().mockReturnValue('test-user-agent')
      }
    };

    handler = new ModuleErrorHandler({
      includeStack: true,
      includeDetails: true,
      enableLogging: true,
      enableRecovery: false
    }, mockLogger);
  });

  describe('handleError', () => {
    test('should handle ValidationError correctly', async () => {
      const error = new ValidationError('Invalid email', 'auth-module');

      mockContext.json.mockImplementation((data: any, status: number) => {
        expect(status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('VALIDATION_ERROR');
        expect(data.error.message).toBe('Invalid email');
        return new Response();
      });

      await handler.handleError(error, mockContext, 'auth-module', 'login');

      expect(mockLogger.logError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          module: 'auth-module',
          operation: 'login',
          severity: ErrorSeverity.LOW
        })
      );
    });

    test('should handle AuthenticationError with correct status code', async () => {
      const error = new AuthenticationError('Invalid credentials', 'auth-module');

      mockContext.json.mockImplementation((data: any, status: number) => {
        expect(status).toBe(401);
        expect(data.error.code).toBe('AUTHENTICATION_ERROR');
        return new Response();
      });

      await handler.handleError(error, mockContext, 'auth-module', 'login');
    });

    test('should include request context in error response', async () => {
      const error = new ValidationError('Test error', 'test-module');
      const requestId = 'req-12345';
      const userId = 'user-67890';

      mockContext.get.mockImplementation((key: string) => {
        if (key === 'requestId') return requestId;
        if (key === 'userId') return userId;
        return undefined;
      });

      mockContext.json.mockImplementation((data: any) => {
        expect(data.error.requestId).toBe(requestId);
        return new Response();
      });

      await handler.handleError(error, mockContext, 'test-module', 'test-operation');

      expect(mockLogger.logError).toHaveBeenCalledWith(
        expect.any(BaseModuleError),
        expect.objectContaining({
          requestId,
          metadata: expect.objectContaining({
            path: '/test/path',
            method: 'POST',
            userAgent: 'test-user-agent'
          })
        })
      );
    });

    test('should handle standard JavaScript errors', async () => {
      const error = new Error('Standard JavaScript error');

      mockContext.json.mockImplementation((data: any, status: number) => {
        expect(status).toBe(500);
        expect(data.error.code).toBe('SYSTEM_ERROR');
        expect(data.error.message).toBe('Standard JavaScript error');
        return new Response();
      });

      await handler.handleError(error, mockContext, 'test-module', 'test-operation');
    });

    test('should handle unknown error types', async () => {
      const error = 'String error';

      mockContext.json.mockImplementation((data: any, status: number) => {
        expect(status).toBe(500);
        expect(data.error.code).toBe('SYSTEM_ERROR');
        expect(data.error.message).toContain('Unknown error');
        return new Response();
      });

      await handler.handleError(error, mockContext, 'test-module', 'test-operation');
    });
  });

  describe('Configuration Options', () => {
    test('should exclude stack trace when includeStack is false', async () => {
      const handlerNoStack = new ModuleErrorHandler({
        includeStack: false,
        includeDetails: true
      });

      const error = new ValidationError('Test error', 'test-module');

      mockContext.json.mockImplementation((data: any) => {
        expect(data.error.stack).toBeUndefined();
        return new Response();
      });

      await handlerNoStack.handleError(error, mockContext, 'test-module', 'test-operation');
    });

    test('should exclude details when includeDetails is false', async () => {
      const handlerNoDetails = new ModuleErrorHandler({
        includeStack: false,
        includeDetails: false
      });

      const error = new ValidationError('Test error', 'test-module', { field: 'email' });

      mockContext.json.mockImplementation((data: any) => {
        expect(data.error.details).toBeUndefined();
        return new Response();
      });

      await handlerNoDetails.handleError(error, mockContext, 'test-module', 'test-operation');
    });

    test('should skip logging when enableLogging is false', async () => {
      const handlerNoLogging = new ModuleErrorHandler({
        enableLogging: false
      });

      const error = new ValidationError('Test error', 'test-module');

      await handlerNoLogging.handleError(error, mockContext, 'test-module', 'test-operation');

      expect(mockLogger.logError).not.toHaveBeenCalled();
    });
  });
});

describe('Error Handling Middleware', () => {
  test('should create middleware that catches errors', async () => {
    const middleware = createErrorHandlingMiddleware('test-module');

    const mockNext = vi.fn().mockRejectedValueOnce(new Error('Test error'));
    const mockContext = {
      req: { method: 'GET', path: '/test' },
      get: vi.fn(),
      json: vi.fn().mockReturnValue(new Response())
    };

    await middleware(mockContext as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockContext.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'SYSTEM_ERROR',
          message: 'Test error'
        })
      }),
      500
    );
  });

  test('should pass through when no errors occur', async () => {
    const middleware = createErrorHandlingMiddleware('test-module');

    const mockNext = vi.fn().mockResolvedValueOnce(undefined);
    const mockContext = {
      req: { method: 'GET', path: '/test' },
      get: vi.fn()
    };

    await middleware(mockContext as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});

describe('withErrorHandling Wrapper', () => {
  test('should wrap function with error handling', async () => {
    const testFunction = vi.fn().mockRejectedValueOnce(new Error('Function error'));
    const wrappedFunction = withErrorHandling(
      'test-module',
      'test-operation',
      testFunction
    );

    await expect(wrappedFunction()).rejects.toThrow();
    expect(testFunction).toHaveBeenCalled();
  });

  test('should pass through successful function calls', async () => {
    const testFunction = vi.fn().mockResolvedValueOnce('success');
    const wrappedFunction = withErrorHandling(
      'test-module',
      'test-operation',
      testFunction
    );

    const result = await wrappedFunction();

    expect(result).toBe('success');
    expect(testFunction).toHaveBeenCalled();
  });

  test('should preserve function arguments', async () => {
    const testFunction = vi.fn().mockImplementation(
      (arg1: string, arg2: number) => `${arg1}-${arg2}`
    );
    const wrappedFunction = withErrorHandling(
      'test-module',
      'test-operation',
      testFunction
    );

    const result = await wrappedFunction('test', 123);

    expect(result).toBe('test-123');
    expect(testFunction).toHaveBeenCalledWith('test', 123);
  });
});

describe('Error Logger', () => {
  let logger: ErrorLogger;

  beforeEach(() => {
    logger = new ErrorLogger();
    vi.clearAllMocks();
    // Mock console methods
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  describe('logError', () => {
    test('should log error with correct format', async () => {
      const error = new ValidationError('Test error', 'test-module');
      const context = {
        module: 'test-module',
        operation: 'test-operation',
        severity: ErrorSeverity.LOW,
        requestId: 'req-123',
        userId: 'user-456'
      };

      await logger.logError(error, context);

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);

      const logEntry = logs[0];
      expect(logEntry.level).toBe('info');
      expect(logEntry.module).toBe('test-module');
      expect(logEntry.operation).toBe('test-operation');
      expect(logEntry.error.code).toBe('VALIDATION_ERROR');
      expect(logEntry.context.requestId).toBe('req-123');
      expect(logEntry.context.userId).toBe('user-456');
    });

    test('should use correct log level based on severity', async () => {
      const criticalError = new BaseModuleError('Critical error', 'SYSTEM_ERROR', 'test');
      const context = {
        module: 'test',
        operation: 'test',
        severity: ErrorSeverity.CRITICAL
      };

      await logger.logError(criticalError, context);

      const logs = logger.getLogs();
      expect(logs[0].level).toBe('error');
    });
  });

  describe('getLogs', () => {
    test('should filter logs by module', async () => {
      const error1 = new ValidationError('Error 1', 'module-a');
      const error2 = new ValidationError('Error 2', 'module-b');

      await logger.logError(error1, { module: 'module-a', operation: 'op1', severity: ErrorSeverity.LOW });
      await logger.logError(error2, { module: 'module-b', operation: 'op2', severity: ErrorSeverity.LOW });

      const filteredLogs = logger.getLogs({ module: 'module-a' });

      expect(filteredLogs).toHaveLength(1);
      expect(filteredLogs[0].module).toBe('module-a');
    });

    test('should filter logs by severity', async () => {
      const lowError = new ValidationError('Low error', 'test');
      const criticalError = new BaseModuleError('Critical error', 'SYSTEM_ERROR', 'test');

      await logger.logError(lowError, { module: 'test', operation: 'op1', severity: ErrorSeverity.LOW });
      await logger.logError(criticalError, { module: 'test', operation: 'op2', severity: ErrorSeverity.CRITICAL });

      const criticalLogs = logger.getLogs({ severity: ErrorSeverity.CRITICAL });

      expect(criticalLogs).toHaveLength(1);
      expect(criticalLogs[0].context.severity).toBe(ErrorSeverity.CRITICAL);
    });

    test('should limit number of returned logs', async () => {
      // Add 5 errors
      for (let i = 0; i < 5; i++) {
        const error = new ValidationError(`Error ${i}`, 'test');
        await logger.logError(error, { module: 'test', operation: `op${i}`, severity: ErrorSeverity.LOW });
      }

      const limitedLogs = logger.getLogs({ limit: 3 });

      expect(limitedLogs).toHaveLength(3);
    });
  });

  describe('getStats', () => {
    test('should return correct statistics', async () => {
      const error1 = new ValidationError('Error 1', 'module-a');
      const error2 = new BaseModuleError('Error 2', 'SYSTEM_ERROR', 'module-b');
      const error3 = new ValidationError('Error 3', 'module-a');

      await logger.logError(error1, { module: 'module-a', operation: 'op1', severity: ErrorSeverity.LOW });
      await logger.logError(error2, { module: 'module-b', operation: 'op2', severity: ErrorSeverity.CRITICAL });
      await logger.logError(error3, { module: 'module-a', operation: 'op3', severity: ErrorSeverity.LOW });

      const stats = logger.getStats();

      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByModule['module-a']).toBe(2);
      expect(stats.errorsByModule['module-b']).toBe(1);
      expect(stats.errorsBySeverity[ErrorSeverity.LOW]).toBe(2);
      expect(stats.errorsBySeverity[ErrorSeverity.CRITICAL]).toBe(1);
    });
  });

  describe('clearLogs', () => {
    test('should clear all logs', async () => {
      const error = new ValidationError('Test error', 'test');
      await logger.logError(error, { module: 'test', operation: 'op', severity: ErrorSeverity.LOW });

      expect(logger.getLogs()).toHaveLength(1);

      logger.clearLogs();

      expect(logger.getLogs()).toHaveLength(0);
    });
  });
});