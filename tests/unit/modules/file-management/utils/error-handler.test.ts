/**
 * Error Handler Unit Tests
 * 錯誤處理器單元測試
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FileManagementError,
  ErrorHandler,
  FileLogger
} from '@modules/file-management/utils/error-handler';
import { ERROR_CODES } from '@modules/file-management/constants/error-codes';

describe('FileManagementError', () => {
  describe('Constructor', () => {
    it('should create error with basic properties', () => {
      const error = new FileManagementError(
        ERROR_CODES.FILE_TOO_LARGE,
        { operation: 'upload', fileId: 'test123' }
      );

      expect(error.code).toBe(ERROR_CODES.FILE_TOO_LARGE);
      expect(error.context.operation).toBe('upload');
      expect(error.context.fileId).toBe('test123');
      expect(error.name).toBe('FileManagementError');
    });

    it('should determine severity correctly for critical errors', () => {
      const error = new FileManagementError(
        ERROR_CODES.VIRUS_DETECTED,
        { operation: 'scan' }
      );

      expect(error.severity).toBe('critical');
    });

    it('should determine severity correctly for warning errors', () => {
      const error = new FileManagementError(
        ERROR_CODES.FILE_TOO_LARGE,
        { operation: 'upload' }
      );

      expect(error.severity).toBe('warning');
    });

    it('should determine severity correctly for regular errors', () => {
      const error = new FileManagementError(
        ERROR_CODES.UPLOAD_FAILED,
        { operation: 'upload' }
      );

      expect(error.severity).toBe('error');
    });

    it('should mark unrecoverable errors correctly', () => {
      const error = new FileManagementError(
        ERROR_CODES.VIRUS_DETECTED,
        { operation: 'scan' }
      );

      expect(error.recoverable).toBe(false);
    });

    it('should mark recoverable errors correctly', () => {
      const error = new FileManagementError(
        ERROR_CODES.UPLOAD_TIMEOUT,
        { operation: 'upload' }
      );

      expect(error.recoverable).toBe(true);
    });

    it('should mark retryable errors correctly', () => {
      const error = new FileManagementError(
        ERROR_CODES.NETWORK_ERROR,
        { operation: 'upload' }
      );

      expect(error.retryable).toBe(true);
    });

    it('should mark non-retryable errors correctly', () => {
      const error = new FileManagementError(
        ERROR_CODES.FILE_TOO_LARGE,
        { operation: 'upload' }
      );

      expect(error.retryable).toBe(false);
    });

    it('should store original error', () => {
      const originalError = new Error('Original error message');
      const error = new FileManagementError(
        ERROR_CODES.UPLOAD_FAILED,
        { operation: 'upload' },
        { originalError }
      );

      expect(error.originalError).toBe(originalError);
    });

    it('should use custom message when provided', () => {
      const customMessage = 'Custom error message';
      const error = new FileManagementError(
        ERROR_CODES.UPLOAD_FAILED,
        { operation: 'upload' },
        { customMessage }
      );

      expect(error.message).toBe(customMessage);
    });
  });

  describe('toDetails', () => {
    it('should convert to error details', () => {
      const error = new FileManagementError(
        ERROR_CODES.FILE_TOO_LARGE,
        { operation: 'upload', fileId: 'test123' }
      );

      const details = error.toDetails();

      expect(details).toMatchObject({
        code: ERROR_CODES.FILE_TOO_LARGE,
        severity: 'warning',
        context: { operation: 'upload', fileId: 'test123' },
        recoverable: true,
        retryable: false
      });
      expect(details.message).toBeTruthy();
      expect(details.timestamp).toBeTruthy();
    });
  });

  describe('toJSON', () => {
    it('should convert to JSON', () => {
      const error = new FileManagementError(
        ERROR_CODES.UPLOAD_FAILED,
        { operation: 'upload' }
      );

      const json = error.toJSON();

      expect(json).toHaveProperty('name', 'FileManagementError');
      expect(json).toHaveProperty('code', ERROR_CODES.UPLOAD_FAILED);
      expect(json).toHaveProperty('severity');
      expect(json).toHaveProperty('context');
      expect(json).toHaveProperty('timestamp');
    });
  });
});

describe('ErrorHandler', () => {
  describe('wrap', () => {
    it('should wrap regular Error as FileManagementError', () => {
      const originalError = new Error('Test error');
      const wrapped = ErrorHandler.wrap(
        originalError,
        ERROR_CODES.UPLOAD_FAILED,
        { operation: 'upload' }
      );

      expect(wrapped).toBeInstanceOf(FileManagementError);
      expect(wrapped.code).toBe(ERROR_CODES.UPLOAD_FAILED);
      expect(wrapped.originalError).toBe(originalError);
    });

    it('should return FileManagementError as-is', () => {
      const fileError = new FileManagementError(
        ERROR_CODES.UPLOAD_FAILED,
        { operation: 'upload' }
      );

      const wrapped = ErrorHandler.wrap(
        fileError,
        ERROR_CODES.NETWORK_ERROR,
        { operation: 'retry' }
      );

      expect(wrapped).toBe(fileError);
    });

    it('should handle non-Error objects', () => {
      const wrapped = ErrorHandler.wrap(
        'String error',
        ERROR_CODES.PROCESSING_FAILED,
        { operation: 'process' }
      );

      expect(wrapped).toBeInstanceOf(FileManagementError);
      expect(wrapped.originalError).toBeUndefined();
    });
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await ErrorHandler.executeWithRetry(
        operation,
        { operation: 'test' },
        { maxRetries: 3 }
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new FileManagementError(
          ERROR_CODES.NETWORK_ERROR,
          { operation: 'test' }
        ))
        .mockResolvedValueOnce('success');

      const result = await ErrorHandler.executeWithRetry(
        operation,
        { operation: 'test' },
        { maxRetries: 3, retryDelay: 10 }
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable error', async () => {
      const operation = vi.fn()
        .mockRejectedValue(new FileManagementError(
          ERROR_CODES.FILE_TOO_LARGE,
          { operation: 'test' }
        ));

      await expect(
        ErrorHandler.executeWithRetry(
          operation,
          { operation: 'test' },
          { maxRetries: 3, retryDelay: 10 }
        )
      ).rejects.toThrow(FileManagementError);

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries', async () => {
      const operation = vi.fn()
        .mockRejectedValue(new FileManagementError(
          ERROR_CODES.NETWORK_ERROR,
          { operation: 'test' }
        ));

      await expect(
        ErrorHandler.executeWithRetry(
          operation,
          { operation: 'test' },
          { maxRetries: 2, retryDelay: 10 }
        )
      ).rejects.toThrow(FileManagementError);

      expect(operation).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should use exponential backoff', async () => {
      const operation = vi.fn()
        .mockRejectedValue(new FileManagementError(
          ERROR_CODES.NETWORK_ERROR,
          { operation: 'test' }
        ));

      const startTime = Date.now();

      await expect(
        ErrorHandler.executeWithRetry(
          operation,
          { operation: 'test' },
          { maxRetries: 2, retryDelay: 100, backoffMultiplier: 2 }
        )
      ).rejects.toThrow();

      const duration = Date.now() - startTime;

      // Should wait 100ms + 200ms = 300ms
      expect(duration).toBeGreaterThanOrEqual(290);
    });
  });

  describe('executeWithRecovery', () => {
    it('should succeed without recovery', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const recovery = vi.fn();

      const result = await ErrorHandler.executeWithRecovery(
        operation,
        { operation: 'test' },
        recovery
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(recovery).not.toHaveBeenCalled();
    });

    it('should attempt recovery on recoverable error', async () => {
      const operation = vi.fn().mockRejectedValue(
        new FileManagementError(
          ERROR_CODES.UPLOAD_TIMEOUT,
          { operation: 'test' }
        )
      );
      const recovery = vi.fn().mockResolvedValue('recovered');

      const result = await ErrorHandler.executeWithRecovery(
        operation,
        { operation: 'test' },
        recovery
      );

      expect(result).toBe('recovered');
      expect(recovery).toHaveBeenCalledTimes(1);
    });

    it('should not attempt recovery on unrecoverable error', async () => {
      const operation = vi.fn().mockRejectedValue(
        new FileManagementError(
          ERROR_CODES.VIRUS_DETECTED,
          { operation: 'test' }
        )
      );
      const recovery = vi.fn();

      await expect(
        ErrorHandler.executeWithRecovery(
          operation,
          { operation: 'test' },
          recovery
        )
      ).rejects.toThrow(FileManagementError);

      expect(recovery).not.toHaveBeenCalled();
    });

    it('should throw original error if recovery fails', async () => {
      const originalError = new FileManagementError(
        ERROR_CODES.UPLOAD_TIMEOUT,
        { operation: 'test' }
      );
      const operation = vi.fn().mockRejectedValue(originalError);
      const recovery = vi.fn().mockRejectedValue(new Error('Recovery failed'));

      await expect(
        ErrorHandler.executeWithRecovery(
          operation,
          { operation: 'test' },
          recovery
        )
      ).rejects.toBe(originalError);
    });
  });

  describe('handleBatch', () => {
    it('should handle all successful operations', async () => {
      const items = [1, 2, 3];
      const operation = vi.fn().mockResolvedValue(undefined);

      const result = await ErrorHandler.handleBatch(
        items,
        operation,
        { operation: 'batch' }
      );

      expect(result.successful).toEqual([1, 2, 3]);
      expect(result.failed).toEqual([]);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure', async () => {
      const items = [1, 2, 3];
      const operation = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(undefined);

      const result = await ErrorHandler.handleBatch(
        items,
        operation,
        { operation: 'batch' }
      );

      expect(result.successful).toEqual([1, 3]);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].item).toBe(2);
      expect(result.failed[0].error).toBeInstanceOf(FileManagementError);
    });

    it('should handle all failed operations', async () => {
      const items = [1, 2, 3];
      const operation = vi.fn().mockRejectedValue(new Error('Failed'));

      const result = await ErrorHandler.handleBatch(
        items,
        operation,
        { operation: 'batch' }
      );

      expect(result.successful).toEqual([]);
      expect(result.failed).toHaveLength(3);
    });
  });
});

describe('FileLogger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('Basic logging', () => {
    it('should log info messages', () => {
      const logger = new FileLogger({ operation: 'test' });
      logger.info('Test message', { data: 'value' });

      expect(consoleInfoSpy).toHaveBeenCalled();
    });

    it('should log warning messages', () => {
      const logger = new FileLogger({ operation: 'test' });
      logger.warn('Test warning', { data: 'value' });

      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      const logger = new FileLogger({ operation: 'test' });
      const error = new Error('Test error');
      logger.error('Test error', error);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should log debug messages', () => {
      const logger = new FileLogger({ operation: 'test' });
      logger.debug('Debug message', { data: 'value' });

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Context inheritance', () => {
    it('should inherit context in child logger', () => {
      const parentLogger = new FileLogger({ operation: 'parent', userId: 'user123' });
      const childLogger = parentLogger.child({ fileId: 'file456' });

      childLogger.info('Test message');

      const callArgs = consoleInfoSpy.mock.calls[0];
      const logEntry = callArgs[1];

      expect(logEntry.context).toMatchObject({
        operation: 'parent',
        userId: 'user123',
        fileId: 'file456'
      });
    });
  });

  describe('Error logging', () => {
    it('should format FileManagementError correctly', () => {
      const logger = new FileLogger({ operation: 'test' });
      const error = new FileManagementError(
        ERROR_CODES.UPLOAD_FAILED,
        { operation: 'upload' }
      );

      logger.error('Upload failed', error);

      const callArgs = consoleErrorSpy.mock.calls[0];
      const logEntry = callArgs[1];

      expect(logEntry.error).toHaveProperty('code', ERROR_CODES.UPLOAD_FAILED);
    });

    it('should format regular Error correctly', () => {
      const logger = new FileLogger({ operation: 'test' });
      const error = new Error('Regular error');

      logger.error('Error occurred', error);

      const callArgs = consoleErrorSpy.mock.calls[0];
      const logEntry = callArgs[1];

      expect(logEntry.error).toHaveProperty('name', 'Error');
      expect(logEntry.error).toHaveProperty('message', 'Regular error');
    });
  });
});