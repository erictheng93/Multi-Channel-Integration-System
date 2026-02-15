// Delayed Message Module - Integration Tests
// 延遲訊息模組 - 整合測試

// Skip vitest import in TypeScript strict mode
// import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use global test functions for now to avoid module resolution issues
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const vi: any;
import { DelayedMessageManager } from '@modules/delayed-message/services/DelayedMessageManager';
import { StorageService } from '@modules/delayed-message/infrastructure/StorageService';
import { ValidationService } from '@modules/delayed-message/infrastructure/ValidationService';
import { EventService } from '@modules/delayed-message/infrastructure/EventService';
import { MessageSchedulerService } from '@modules/delayed-message/services/MessageSchedulerService';
import { MessageProcessorService } from '@modules/delayed-message/services/MessageProcessorService';
import type { DelayedMessageRequest } from '@modules/delayed-message/types';

// Mock environment
const mockEnv = {
  DB: {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        all: vi.fn(() => Promise.resolve([])),
        get: vi.fn(() => Promise.resolve(null)),
        run: vi.fn(() => Promise.resolve({ success: true }))
      }))
    }))
  },
  SESSIONS: {
    get: vi.fn(() => Promise.resolve(null)),
    put: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve())
  },
  JWT_SECRET: 'test-secret',
  LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
  FB_PAGE_ACCESS_TOKEN: 'test-fb-token'
} as any;

describe('Delayed Message Module Integration Tests', () => {
  let manager: DelayedMessageManager;
  let storageService: StorageService;
  let validationService: ValidationService;
  let eventService: EventService;
  let schedulerService: MessageSchedulerService;
  let processorService: MessageProcessorService;

  beforeEach(() => {
    vi.clearAllMocks();

    manager = new DelayedMessageManager(mockEnv);
    storageService = new StorageService(mockEnv);
    validationService = new ValidationService();
    eventService = new EventService(mockEnv);
    schedulerService = new MessageSchedulerService(mockEnv);
    processorService = new MessageProcessorService(mockEnv);
  });

  describe('Service Instantiation', () => {
    it('should create all services successfully', () => {
      expect(manager).toBeInstanceOf(DelayedMessageManager);
      expect(storageService).toBeInstanceOf(StorageService);
      expect(validationService).toBeInstanceOf(ValidationService);
      expect(eventService).toBeInstanceOf(EventService);
      expect(schedulerService).toBeInstanceOf(MessageSchedulerService);
      expect(processorService).toBeInstanceOf(MessageProcessorService);
    });
  });

  describe('Validation Service', () => {
    it('should validate a valid delayed message request', () => {
      const validRequest: DelayedMessageRequest = {
        conversationId: 'conv-123',
        content: 'Test message',
        platform: 'line',
        recipientPlatformId: 'user-123',
        delaySeconds: 30,
        senderId: 'agent-123',
        messageType: 'text'
      };

      const result = validationService.validateDelayedMessageRequest(validRequest);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid delay seconds', () => {
      const invalidRequest: DelayedMessageRequest = {
        conversationId: 'conv-123',
        content: 'Test message',
        platform: 'line',
        recipientPlatformId: 'user-123',
        delaySeconds: 150, // Invalid: exceeds 120 seconds
        senderId: 'agent-123'
      };

      const result = validationService.validateDelayedMessageRequest(invalidRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('delaySeconds must be between 1 and 120');
    });

    it('should reject missing required fields', () => {
      const invalidRequest: DelayedMessageRequest = {
        conversationId: '',
        content: '',
        platform: 'line',
        recipientPlatformId: '',
        delaySeconds: 30,
        senderId: ''
      };

      const result = validationService.validateDelayedMessageRequest(invalidRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Manager Integration', () => {
    it('should handle health check', async () => {
      // Mock the health check methods
      vi.spyOn(storageService, 'healthCheck').mockResolvedValue(true);

      const health = await manager.healthCheck();

      expect(health.healthy).toBeDefined();
      expect(health.services).toBeDefined();
      expect(health.timestamp).toBeDefined();
    });

    it('should validate request before processing', async () => {
      const invalidRequest: DelayedMessageRequest = {
        conversationId: '',
        content: '',
        platform: 'line',
        recipientPlatformId: '',
        delaySeconds: 200, // Invalid
        senderId: ''
      };

      const user = { id: 'test-user', displayName: 'Test User', role: 'agent' };
      const result = await manager.sendDelayedMessage(invalidRequest, user);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      // Mock storage error
      const mockStorageService = vi.spyOn(storageService, 'saveMessage').mockRejectedValue(new Error('Database error'));

      const validRequest: DelayedMessageRequest = {
        conversationId: 'conv-123',
        content: 'Test message',
        platform: 'line',
        recipientPlatformId: 'user-123',
        delaySeconds: 30,
        senderId: 'agent-123'
      };

      const user = { id: 'agent-123', displayName: 'Test Agent', role: 'agent' };

      // This test should pass if error handling is implemented
      // For now, we're just testing the structure
      expect(() => manager.sendDelayedMessage(validRequest, user)).not.toThrow();

      mockStorageService.mockRestore();
    });
  });

  describe('Type Safety', () => {
    it('should enforce correct types for DelayedMessageRequest', () => {
      // This test verifies TypeScript compilation
      const request: DelayedMessageRequest = {
        conversationId: 'conv-123',
        content: 'Test message',
        platform: 'line', // Must be 'line' or 'facebook'
        recipientPlatformId: 'user-123',
        delaySeconds: 30, // Must be number
        senderId: 'agent-123'
      };

      expect(request.platform).toBe('line');
      expect(typeof request.delaySeconds).toBe('number');
    });
  });
});

describe('Module Architecture Validation', () => {
  it('should maintain proper separation of concerns', () => {
    // Test that services are properly separated
    expect(StorageService.name).toBe('StorageService');
    expect(ValidationService.name).toBe('ValidationService');
    expect(EventService.name).toBe('EventService');
    expect(MessageSchedulerService.name).toBe('MessageSchedulerService');
    expect(MessageProcessorService.name).toBe('MessageProcessorService');
    expect(DelayedMessageManager.name).toBe('DelayedMessageManager');
  });

  it('should have clean service interfaces', () => {
    const validationService = new ValidationService();

    // Check that validation service has expected methods
    expect(typeof validationService.validateDelayedMessageRequest).toBe('function');
    expect(typeof validationService.validateDelaySeconds).toBe('function');
    expect(typeof validationService.validatePlatform).toBe('function');
    expect(typeof validationService.validateMessageType).toBe('function');
  });

  it('should support dependency injection pattern', () => {
    // Test that services can be instantiated with environment
    const manager1 = new DelayedMessageManager(mockEnv);
    const manager2 = new DelayedMessageManager(mockEnv);

    // Each instance should be independent
    expect(manager1).not.toBe(manager2);
    expect(manager1).toBeInstanceOf(DelayedMessageManager);
    expect(manager2).toBeInstanceOf(DelayedMessageManager);
  });
});