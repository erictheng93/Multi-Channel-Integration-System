// 延遲訊息主要處理器測試 - Handler-based 架構
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import delayedMessageMainHandler from '../../../src/handlers/delayed-message-main';
import { MessageRecallService } from '../../../src/services/message-recall-service';
import { PermissionService } from '../../../src/services/permission-service';
import type { Bindings } from '../../../src/types';

// Mock services
vi.mock('../../../src/services/message-recall-service');
vi.mock('../../../src/services/permission-service');

// Mock middleware
vi.mock('../../../src/middleware/auth', () => ({
  jwtAuth: vi.fn((c, next) => {
    c.set('user', { 
      id: 'user-123', 
      role: 'agent',
      username: 'test-user',
      email: 'test@example.com'
    });
    return next();
  })
}));

describe('DelayedMessage Main Handler', () => {
  let app: Hono<{ Bindings: Bindings }>;
  let mockMessageRecallService: any;
  let mockPermissionService: any;

  beforeEach(() => {
    app = new Hono<{ Bindings: Bindings }>();
    app.route('/api/delayed-messages', delayedMessageMainHandler);

    // Mock context values
    app.use('*', (c, next) => {
      c.env = {
        DB: {} as any,
        JWT_SECRET: 'test-secret',
        AGENT_QUEUE: {} as any,
        SESSIONS: {} as any,
        CACHE: {} as any
      } as any;
      return next();
    });

    // Reset mocks
    vi.clearAllMocks();

    // Setup service mocks
    mockMessageRecallService = {
      sendDelayedMessage: vi.fn(),
      recallMessage: vi.fn(),
      getPendingMessages: vi.fn(),
      processQueueMessage: vi.fn()
    };

    mockPermissionService = {
      checkPermission: vi.fn()
    };

    (MessageRecallService as any).mockImplementation(() => mockMessageRecallService);
    (PermissionService.checkPermission as any) = mockPermissionService.checkPermission;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /send', () => {
    const validRequest = {
      conversationId: 123,
      content: 'Test message',
      platform: 'line',
      recipientPlatformId: 'user123',
      delaySeconds: 30,
      messageType: 'text'
    };

    it('should successfully send delayed message', async () => {
      // Setup mocks
      mockPermissionService.checkPermission.mockResolvedValue(true);
      mockMessageRecallService.sendDelayedMessage.mockResolvedValue({
        success: true,
        messageId: 'msg-123',
        scheduledSendTime: '2025-01-01T10:00:30Z',
        recallDeadline: '2025-01-01T10:00:25Z'
      });

      const response = await app.request('/api/delayed-messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.messageId).toBe('msg-123');
      expect(result.data.scheduledSendTime).toBeDefined();
      expect(result.data.recallDeadline).toBeDefined();

      // Verify service calls
      expect(mockPermissionService.checkPermission).toHaveBeenCalledWith(
        'user-123',
        'message',
        'send',
        expect.objectContaining({
          userId: 'user-123',
          role: 'agent',
          resourceId: 123
        })
      );

      expect(mockMessageRecallService.sendDelayedMessage).toHaveBeenCalledWith({
        conversationId: 123,
        senderId: 'user-123',
        content: 'Test message',
        recipientPlatformId: 'user123',
        platform: 'line',
        delaySeconds: 30,
        messageType: 'text'
      });
    });

    it('should reject empty content', async () => {
      const invalidRequest = { ...validRequest, content: '' };

      const response = await app.request('/api/delayed-messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequest)
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toBe('Missing required fields');
    });

    it('should reject invalid delay seconds', async () => {
      const invalidRequest = { ...validRequest, delaySeconds: 150 };

      const response = await app.request('/api/delayed-messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequest)
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toBe('Delay seconds must be between 1 and 120');
    });

    it('should reject when permission denied', async () => {
      mockPermissionService.checkPermission.mockResolvedValue(false);

      const response = await app.request('/api/delayed-messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      expect(response.status).toBe(403);
      const result = await response.json();
      expect(result.error).toBe('Permission denied');
    });

    it('should handle service errors', async () => {
      mockPermissionService.checkPermission.mockResolvedValue(true);
      mockMessageRecallService.sendDelayedMessage.mockResolvedValue({
        success: false,
        error: 'Service error'
      });

      const response = await app.request('/api/delayed-messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Service error');
    });
  });

  describe('POST /recall/:messageId', () => {
    const messageId = 'msg-123';

    it('should successfully recall message', async () => {
      mockMessageRecallService.recallMessage.mockResolvedValue({
        success: true,
        messageId: messageId
      });

      const response = await app.request(`/api/delayed-messages/recall/${messageId}`, {
        method: 'POST'
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.messageId).toBe(messageId);

      expect(mockMessageRecallService.recallMessage).toHaveBeenCalledWith(
        messageId,
        'user-123'
      );
    });

    it('should handle recall failure', async () => {
      mockMessageRecallService.recallMessage.mockResolvedValue({
        success: false,
        error: 'Message not found'
      });

      const response = await app.request(`/api/delayed-messages/recall/${messageId}`, {
        method: 'POST'
      });

      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Message not found');
    });

    it('should require messageId parameter', async () => {
      const response = await app.request('/api/delayed-messages/recall/', {
        method: 'POST'
      });

      expect(response.status).toBe(404); // Route not found without messageId
    });
  });

  describe('GET /pending', () => {
    it('should return pending messages', async () => {
      const mockPendingMessages = {
        items: [
          {
            id: 'msg-1',
            content: 'Test message 1',
            scheduledSendTime: '2025-01-01T10:00:00Z',
            canRecall: true
          }
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 1
        }
      };

      mockMessageRecallService.getPendingMessages.mockResolvedValue(mockPendingMessages);

      const response = await app.request('/api/delayed-messages/pending');

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPendingMessages);

      expect(mockMessageRecallService.getPendingMessages).toHaveBeenCalledWith(
        'user-123',
        1,
        20
      );
    });

    it('should handle pagination parameters', async () => {
      mockMessageRecallService.getPendingMessages.mockResolvedValue({
        items: [],
        pagination: { page: 2, pageSize: 10, total: 0 }
      });

      const response = await app.request('/api/delayed-messages/pending?page=2&pageSize=10');

      expect(response.status).toBe(200);

      expect(mockMessageRecallService.getPendingMessages).toHaveBeenCalledWith(
        'user-123',
        2,
        10
      );
    });
  });

  describe('POST /process', () => {
    it('should process queue message successfully', async () => {
      const messageId = 'msg-123';
      mockMessageRecallService.processQueueMessage.mockResolvedValue({
        success: true,
        skipped: false
      });

      const response = await app.request('/api/delayed-messages/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.messageId).toBe(messageId);
      expect(result.data.processed).toBe(true);
      expect(result.data.skipped).toBe(false);

      expect(mockMessageRecallService.processQueueMessage).toHaveBeenCalledWith(messageId);
    });

    it('should handle skipped messages', async () => {
      const messageId = 'msg-123';
      mockMessageRecallService.processQueueMessage.mockResolvedValue({
        success: true,
        skipped: true
      });

      const response = await app.request('/api/delayed-messages/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.skipped).toBe(true);
    });

    it('should require messageId', async () => {
      const response = await app.request('/api/delayed-messages/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.error).toBe('Message ID is required');
    });

    it('should handle processing errors', async () => {
      const messageId = 'msg-123';
      mockMessageRecallService.processQueueMessage.mockResolvedValue({
        success: false,
        error: 'Processing failed'
      });

      const response = await app.request('/api/delayed-messages/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Processing failed');
    });
  });

  describe('Error Handling', () => {
    it('should handle JSON parsing errors', async () => {
      const response = await app.request('/api/delayed-messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json'
      });

      expect(response.status).toBe(500);
    });

    it('should handle service initialization errors', async () => {
      // Mock permission service to return true first
      mockPermissionService.checkPermission.mockResolvedValue(true);
      
      (MessageRecallService as any).mockImplementation(() => {
        throw new Error('Service initialization failed');
      });

      const response = await app.request('/api/delayed-messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 123,
          content: 'Test',
          platform: 'line',
          recipientPlatformId: 'user123',
          delaySeconds: 30
        })
      });

      expect(response.status).toBe(500);
    });
  });
});