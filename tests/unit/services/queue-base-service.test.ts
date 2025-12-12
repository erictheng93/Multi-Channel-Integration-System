// Queue Base Service 單元測試
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  QueueBaseService,
  QueueErrorType,
  type QueueProcessingResult,
  type RetryConfig
} from '@/services/queue-base-service';
import type { Bindings } from '@/types';

// 測試用的具體實現類
class TestQueueService extends QueueBaseService {
  public processMessageSpy = vi.fn<[any], Promise<QueueProcessingResult>>();

  protected async processMessage(messageBody: any): Promise<QueueProcessingResult> {
    return this.processMessageSpy(messageBody);
  }

  // 公開私有方法以便測試
  public getPublicStats() {
    return this.getProcessingStats();
  }
}

describe('QueueBaseService', () => {
  let mockEnv: Bindings;
  let queueService: TestQueueService;
  let mockMessage: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock environment bindings
    mockEnv = {
      REALTIME_QUEUE: {} as any,
      KV: {} as any,
      DB: {} as any,
      R2: {} as any,
      CONVERSATION_ROOM: {} as any,
      USER_CONNECTION: {} as any,
      MESSAGE_BROADCASTER: {} as any,
      DELAYED_MESSAGE_PROCESSOR: {} as any,
      DELAYED_MESSAGE_BUFFER: {} as any,
      JWT_SECRET: 'test-secret',
      LINE_CHANNEL_SECRET: 'test-line-secret',
      LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
      FRONTEND_URL: 'http://localhost:3000',
      ENCRYPTION_KEY: 'test-encryption-key'
    };

    queueService = new TestQueueService(mockEnv, 'TEST_QUEUE', {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2
    });

    // Mock message
    mockMessage = {
      id: 'msg-123',
      body: { data: 'test message' },
      attempts: 0,
      ack: vi.fn(),
      retry: vi.fn()
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleQueueMessage', () => {
    it('should successfully process a message', async () => {
      const successResult: QueueProcessingResult = {
        success: true,
        messageId: 'msg-123',
        processingTime: 100
      };

      queueService.processMessageSpy.mockResolvedValue(successResult);

      await queueService.handleQueueMessage(mockMessage);

      expect(queueService.processMessageSpy).toHaveBeenCalledWith(mockMessage.body);
      expect(mockMessage.ack).toHaveBeenCalled();
      expect(mockMessage.retry).not.toHaveBeenCalled();

      const stats = queueService.getPublicStats();
      expect(stats.totalProcessed).toBe(1);
      expect(stats.successCount).toBe(1);
      expect(stats.errorCount).toBe(0);
    });

    it('should retry on retryable error', async () => {
      const failureResult: QueueProcessingResult = {
        success: false,
        messageId: 'msg-123',
        processingTime: 50,
        error: 'Network error occurred'
      };

      queueService.processMessageSpy.mockResolvedValue(failureResult);
      mockMessage.attempts = 1;

      await queueService.handleQueueMessage(mockMessage);

      expect(mockMessage.retry).toHaveBeenCalled();
      expect(mockMessage.ack).not.toHaveBeenCalled();

      const stats = queueService.getPublicStats();
      expect(stats.totalProcessed).toBe(1);
      expect(stats.successCount).toBe(0);
      expect(stats.errorCount).toBe(1);
      expect(stats.retryCount).toBe(1);
    });

    it('should not retry after max retries', async () => {
      const failureResult: QueueProcessingResult = {
        success: false,
        messageId: 'msg-123',
        processingTime: 50,
        error: 'Network error'
      };

      queueService.processMessageSpy.mockResolvedValue(failureResult);
      mockMessage.attempts = 3; // At max retries

      await queueService.handleQueueMessage(mockMessage);

      expect(mockMessage.ack).toHaveBeenCalled();
      expect(mockMessage.retry).not.toHaveBeenCalled();

      const stats = queueService.getPublicStats();
      expect(stats.errorCount).toBe(1);
      expect(stats.retryCount).toBe(0);
    });

    it('should not retry on non-retryable error', async () => {
      const failureResult: QueueProcessingResult = {
        success: false,
        messageId: 'msg-123',
        processingTime: 50,
        error: 'Validation error: invalid data'
      };

      queueService.processMessageSpy.mockResolvedValue(failureResult);
      mockMessage.attempts = 1;

      await queueService.handleQueueMessage(mockMessage);

      expect(mockMessage.ack).toHaveBeenCalled();
      expect(mockMessage.retry).not.toHaveBeenCalled();
    });

    it('should handle unexpected exceptions', async () => {
      queueService.processMessageSpy.mockRejectedValue(new Error('Unexpected error'));

      await queueService.handleQueueMessage(mockMessage);

      expect(mockMessage.retry).toHaveBeenCalled();

      const stats = queueService.getPublicStats();
      expect(stats.errorCount).toBe(1);
    });

    it('should calculate processing time correctly', async () => {
      const successResult: QueueProcessingResult = {
        success: true,
        messageId: 'msg-123',
        processingTime: 0 // Will be overwritten
      };

      queueService.processMessageSpy.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return successResult;
      });

      await queueService.handleQueueMessage(mockMessage);

      const stats = queueService.getPublicStats();
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
    });
  });

  describe('error classification', () => {
    it('should classify network errors', async () => {
      const failureResult: QueueProcessingResult = {
        success: false,
        messageId: 'msg-123',
        processingTime: 50,
        error: 'Network connection failed'
      };

      queueService.processMessageSpy.mockResolvedValue(failureResult);

      await queueService.handleQueueMessage(mockMessage);

      expect(mockMessage.retry).toHaveBeenCalled();
    });

    it('should classify timeout errors', async () => {
      const failureResult: QueueProcessingResult = {
        success: false,
        messageId: 'msg-123',
        processingTime: 50,
        error: 'Request timeout exceeded'
      };

      queueService.processMessageSpy.mockResolvedValue(failureResult);

      await queueService.handleQueueMessage(mockMessage);

      expect(mockMessage.retry).toHaveBeenCalled();
    });

    it('should classify rate limit errors', async () => {
      const failureResult: QueueProcessingResult = {
        success: false,
        messageId: 'msg-123',
        processingTime: 50,
        error: 'Rate limit exceeded'
      };

      queueService.processMessageSpy.mockResolvedValue(failureResult);

      await queueService.handleQueueMessage(mockMessage);

      expect(mockMessage.retry).toHaveBeenCalled();
    });

    it('should classify validation errors as non-retryable', async () => {
      const failureResult: QueueProcessingResult = {
        success: false,
        messageId: 'msg-123',
        processingTime: 50,
        error: 'Validation failed: invalid email'
      };

      queueService.processMessageSpy.mockResolvedValue(failureResult);

      await queueService.handleQueueMessage(mockMessage);

      expect(mockMessage.ack).toHaveBeenCalled();
      expect(mockMessage.retry).not.toHaveBeenCalled();
    });
  });

  describe('retry delay calculation', () => {
    it('should use exponential backoff', async () => {
      const failureResult: QueueProcessingResult = {
        success: false,
        messageId: 'msg-123',
        processingTime: 50,
        error: 'Temporary failure'
      };

      queueService.processMessageSpy.mockResolvedValue(failureResult);

      // First attempt
      mockMessage.attempts = 0;
      await queueService.handleQueueMessage(mockMessage);
      expect(mockMessage.retry).toHaveBeenCalledWith({ delaySeconds: 1 }); // 1000ms / 1000

      // Second attempt
      mockMessage.retry.mockClear();
      mockMessage.attempts = 1;
      await queueService.handleQueueMessage(mockMessage);
      expect(mockMessage.retry).toHaveBeenCalledWith({ delaySeconds: 2 }); // 2000ms / 1000

      // Third attempt
      mockMessage.retry.mockClear();
      mockMessage.attempts = 2;
      await queueService.handleQueueMessage(mockMessage);
      expect(mockMessage.retry).toHaveBeenCalledWith({ delaySeconds: 4 }); // 4000ms / 1000
    });

    it('should cap delay at maxDelay', async () => {
      const failureResult: QueueProcessingResult = {
        success: false,
        messageId: 'msg-123',
        processingTime: 50,
        error: 'Temporary failure'
      };

      queueService.processMessageSpy.mockResolvedValue(failureResult);

      // Attempt with very high retry count
      mockMessage.attempts = 10;
      await queueService.handleQueueMessage(mockMessage);

      // Should be capped at 30 seconds
      expect(mockMessage.retry).toHaveBeenCalledWith({ delaySeconds: 30 });
    });
  });

  describe('statistics tracking', () => {
    it('should track total processed messages', async () => {
      const successResult: QueueProcessingResult = {
        success: true,
        messageId: 'msg-123',
        processingTime: 100
      };

      queueService.processMessageSpy.mockResolvedValue(successResult);

      await queueService.handleQueueMessage(mockMessage);
      await queueService.handleQueueMessage(mockMessage);
      await queueService.handleQueueMessage(mockMessage);

      const stats = queueService.getPublicStats();
      expect(stats.totalProcessed).toBe(3);
    });

    it('should track success count', async () => {
      const successResult: QueueProcessingResult = {
        success: true,
        messageId: 'msg-123',
        processingTime: 100
      };

      queueService.processMessageSpy.mockResolvedValue(successResult);

      await queueService.handleQueueMessage(mockMessage);
      await queueService.handleQueueMessage(mockMessage);

      const stats = queueService.getPublicStats();
      expect(stats.successCount).toBe(2);
      expect(stats.errorCount).toBe(0);
    });

    it('should track error count', async () => {
      const failureResult: QueueProcessingResult = {
        success: false,
        messageId: 'msg-123',
        processingTime: 50,
        error: 'Validation error'
      };

      queueService.processMessageSpy.mockResolvedValue(failureResult);

      await queueService.handleQueueMessage(mockMessage);
      await queueService.handleQueueMessage(mockMessage);

      const stats = queueService.getPublicStats();
      expect(stats.successCount).toBe(0);
      expect(stats.errorCount).toBe(2);
    });

    it('should track retry count', async () => {
      const failureResult: QueueProcessingResult = {
        success: false,
        messageId: 'msg-123',
        processingTime: 50,
        error: 'Network error'
      };

      queueService.processMessageSpy.mockResolvedValue(failureResult);

      await queueService.handleQueueMessage(mockMessage);
      await queueService.handleQueueMessage(mockMessage);

      const stats = queueService.getPublicStats();
      expect(stats.retryCount).toBe(2);
    });

    it('should calculate average processing time', async () => {
      const result1: QueueProcessingResult = {
        success: true,
        messageId: 'msg-1',
        processingTime: 100
      };

      const result2: QueueProcessingResult = {
        success: true,
        messageId: 'msg-2',
        processingTime: 200
      };

      queueService.processMessageSpy
        .mockResolvedValueOnce(result1)
        .mockResolvedValueOnce(result2);

      await queueService.handleQueueMessage(mockMessage);
      await queueService.handleQueueMessage(mockMessage);

      const stats = queueService.getPublicStats();
      expect(stats.averageProcessingTime).toBeCloseTo(150, 1);
    });

    it('should update lastProcessedAt timestamp', async () => {
      const successResult: QueueProcessingResult = {
        success: true,
        messageId: 'msg-123',
        processingTime: 100
      };

      queueService.processMessageSpy.mockResolvedValue(successResult);

      const beforeTime = new Date();
      await queueService.handleQueueMessage(mockMessage);
      const afterTime = new Date();

      const stats = queueService.getPublicStats();
      const lastProcessedTime = new Date(stats.lastProcessedAt);

      expect(lastProcessedTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(lastProcessedTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics to zero', async () => {
      const successResult: QueueProcessingResult = {
        success: true,
        messageId: 'msg-123',
        processingTime: 100
      };

      queueService.processMessageSpy.mockResolvedValue(successResult);

      // Generate some stats
      await queueService.handleQueueMessage(mockMessage);
      await queueService.handleQueueMessage(mockMessage);

      // Reset
      queueService.resetStats();

      const stats = queueService.getPublicStats();
      expect(stats.totalProcessed).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.errorCount).toBe(0);
      expect(stats.retryCount).toBe(0);
      expect(stats.averageProcessingTime).toBe(0);
    });
  });

  describe('measurePerformance', () => {
    it('should measure operation duration', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'result';
      };

      const result = await queueService['measurePerformance'](operation, 'TestOperation');

      expect(result).toBe('result');
      expect(consoleSpy).toHaveBeenCalled();

      const logCall = consoleSpy.mock.calls[0];
      expect(logCall[0]).toContain('操作完成: TestOperation');

      consoleSpy.mockRestore();
    });

    it('should log error on operation failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const operation = async () => {
        throw new Error('Operation failed');
      };

      await expect(queueService['measurePerformance'](operation, 'FailedOperation'))
        .rejects.toThrow('Operation failed');

      expect(consoleErrorSpy).toHaveBeenCalled();

      const errorCall = consoleErrorSpy.mock.calls[0];
      expect(errorCall[0]).toContain('操作失敗: FailedOperation');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('processBatch', () => {
    it('should process items in batches', async () => {
      const items = Array.from({ length: 12 }, (_, i) => ({ id: i }));
      const processedItems: any[] = [];

      const processor = async (item: any) => {
        processedItems.push(item);
      };

      await queueService['processBatch'](items, processor, 5);

      expect(processedItems).toHaveLength(12);
    });

    it('should process batches sequentially', async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({ id: i }));
      const processingOrder: number[] = [];

      const processor = async (item: any) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        processingOrder.push(item.id);
      };

      await queueService['processBatch'](items, processor, 5);

      // Verify all items processed
      expect(processingOrder).toHaveLength(10);
    });

    it('should throw error if batch processing fails', async () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];

      const processor = async (item: any) => {
        if (item.id === 2) {
          throw new Error('Processing failed');
        }
      };

      await expect(queueService['processBatch'](items, processor, 2))
        .rejects.toThrow('Processing failed');
    });

    it('should use default batch size when not specified', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const items = Array.from({ length: 6 }, (_, i) => ({ id: i }));
      const processor = async () => {};

      await queueService['processBatch'](items, processor);

      // Should log batch start with default batch size
      const logCalls = consoleSpy.mock.calls;
      const startLog = logCalls.find(call => call[0].includes('開始批次處理'));
      expect(startLog).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  describe('custom retry configuration', () => {
    it('should respect custom retry config', () => {
      const customConfig: Partial<RetryConfig> = {
        maxRetries: 5,
        baseDelay: 2000,
        maxDelay: 60000,
        backoffMultiplier: 3
      };

      const customService = new TestQueueService(mockEnv, 'CUSTOM_QUEUE', customConfig);

      const stats = customService.getPublicStats();
      expect(stats).toBeDefined();
    });

    it('should use default config when not provided', () => {
      const defaultService = new TestQueueService(mockEnv, 'DEFAULT_QUEUE');

      const stats = defaultService.getPublicStats();
      expect(stats).toBeDefined();
    });
  });
});
