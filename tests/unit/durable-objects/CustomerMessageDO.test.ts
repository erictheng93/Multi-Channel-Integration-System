/**
 * CustomerMessageDO Durable Object Unit Tests
 *
 * Comprehensive test suite for customer message management
 * Tests all functionality includimport { MockFactory } from '@helpers/mockFactory';
ing:
 * - Message fetching with pagination (load more support)
 * - Message creation with complete data validation
 * - File upload to Cloudflare R2
 * - JWT token parsing for agent identification
 * - Integration with CustomerConversationDO for broadcasting
 * - Error handling and validation
 * - CORS middleware
 * - Database operations with Drizzle ORM
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CustomerMessageDO } from '@/durable-objects/CustomerMessageDO';

// Mock Drizzle ORM
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => mockDb)
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args) => ({ eq: args })),
  lt: vi.fn((...args) => ({ lt: args })),
  desc: vi.fn((...args) => ({ desc: args })),
  and: vi.fn((...args) => ({ and: args }))
}));

// Mock database
let mockDb: any;

beforeEach(() => {
  mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined)
  };
});

/**
 * Mock Durable Object State
 */
class MockDurableObjectState implements DurableObjectState {
  id: DurableObjectId;
  storage: DurableObjectStorage;

  constructor(id: DurableObjectId) {
    this.id = id;
    this.storage = {
      get: vi.fn(),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue(new Map()),
      deleteAll: vi.fn().mockResolvedValue(undefined),
      transaction: vi.fn((callback) => callback(this.storage)),
      getAlarm: vi.fn().mockResolvedValue(null),
      setAlarm: vi.fn().mockResolvedValue(undefined),
      deleteAlarm: vi.fn().mockResolvedValue(undefined),
      sync: vi.fn().mockResolvedValue(undefined),
      transactionSync: vi.fn((callback) => callback())
    } as any;
  }

  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
    return callback();
  }

  acceptWebSocket(ws: WebSocket, tags?: string[]): void {}
  getWebSockets(tag?: string): WebSocket[] { return []; }
  setWebSocketAutoResponse(webSocketRequestResponsePair?: WebSocketRequestResponsePair): void {}
  getWebSocketAutoResponse(): WebSocketRequestResponsePair | null { return null; }
  getWebSocketAutoResponseTimestamp(ws: WebSocket): Date | null { return null; }
  getTags(ws: WebSocket): string[] { return []; }
  waitUntil(promise: Promise<any>): void {}
  abort(reason?: any): void {}
}

/**
 * Mock Durable Object ID
 */
class MockDurableObjectId implements DurableObjectId {
  constructor(private name: string) {}
  toString(): string { return this.name; }
  equals(other: DurableObjectId): boolean { return this.toString() === other.toString(); }
}

describe('CustomerMessageDO Durable Object', () => {
  let customerMessageDO: CustomerMessageDO;
  let mockState: MockDurableObjectState;
  let mockEnv: any;
  let mockConversationDO: any;

  beforeEach(() => {
    const id = new MockDurableObjectId('test_customer_message_do');
    mockState = new MockDurableObjectState(id);

    // Mock CustomerConversationDO
    mockConversationDO = {
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      )
    };

    mockEnv = {
      DB: {},
      R2_BUCKET: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn(),
        delete: vi.fn()
      },
      R2_PUBLIC_URL: 'https://r2.example.com',
      CUSTOMER_CONVERSATION_DO: {
        idFromName: vi.fn(() => new MockDurableObjectId('conversation_do')),
        get: vi.fn(() => mockConversationDO)
      }
    };

    customerMessageDO = new CustomerMessageDO(mockState, mockEnv);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /messages - Fetch Messages', () => {
    test('should fetch messages successfully', async () => {
      const mockMessages = [
        {
          id: 'msg_001',
          conversationId: 'conv_123',
          senderType: 'agent',
          agentSenderId: 'agent_1',
          customerSenderId: null,
          content: 'Test message 1',
          createdAt: new Date().toISOString()
        },
        {
          id: 'msg_002',
          conversationId: 'conv_123',
          senderType: 'customer',
          agentSenderId: null,
          customerSenderId: 'customer_1',
          content: 'Test message 2',
          createdAt: new Date().toISOString()
        }
      ];

      mockDb.limit.mockResolvedValue(mockMessages);

      const request = new Request('http://test/messages', {
        headers: { 'X-Conversation-Id': 'conv_123' }
      });

      const response = await customerMessageDO.fetch(request);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].senderId).toBe('agent_1');
      expect(result.messages[1].senderId).toBe('customer_1');
      expect(result.hasMore).toBe(false);
    });

    test('should reject request without conversation ID', async () => {
      const request = new Request('http://test/messages');

      const response = await customerMessageDO.fetch(request);
      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Conversation ID is required');
    });

    test('should paginate with default limit of 50', async () => {
      const mockMessages = new Array(50).fill(null).map((_, i) => ({
        id: `msg_${i}`,
        conversationId: 'conv_123',
        senderType: 'agent',
        agentSenderId: 'agent_1',
        content: `Message ${i}`,
        createdAt: new Date().toISOString()
      }));

      mockDb.limit.mockResolvedValue(mockMessages);

      const request = new Request('http://test/messages', {
        headers: { 'X-Conversation-Id': 'conv_123' }
      });

      const response = await customerMessageDO.fetch(request);
      const result = await response.json();

      expect(result.messages).toHaveLength(50);
      expect(result.hasMore).toBe(true); // Indicates more messages available
    });

    test('should support custom limit', async () => {
      const mockMessages = new Array(20).fill(null).map((_, i) => ({
        id: `msg_${i}`,
        conversationId: 'conv_123',
        content: `Message ${i}`,
        createdAt: new Date().toISOString()
      }));

      mockDb.limit.mockResolvedValue(mockMessages);

      const request = new Request('http://test/messages?limit=20', {
        headers: { 'X-Conversation-Id': 'conv_123' }
      });

      const response = await customerMessageDO.fetch(request);
      const result = await response.json();

      expect(result.messages).toHaveLength(20);
    });

    test('should paginate with before parameter', async () => {
      // Mock the "before" message lookup
      const beforeMessage = [{
        id: 'msg_before',
        createdAt: '2025-01-01T12:00:00Z'
      }];

      const olderMessages = [
        {
          id: 'msg_003',
          conversationId: 'conv_123',
          content: 'Older message',
          createdAt: '2025-01-01T11:00:00Z'
        }
      ];

      mockDb.limit
        .mockResolvedValueOnce(beforeMessage) // First call for before message
        .mockResolvedValueOnce(olderMessages); // Second call for older messages

      const request = new Request('http://test/messages?before=msg_before', {
        headers: { 'X-Conversation-Id': 'conv_123' }
      });

      const response = await customerMessageDO.fetch(request);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].id).toBe('msg_003');
    });

    test('should handle before parameter with non-existent message', async () => {
      mockDb.limit
        .mockResolvedValueOnce([]) // Before message not found
        .mockResolvedValueOnce([ // Return latest messages
          {
            id: 'msg_latest',
            conversationId: 'conv_123',
            content: 'Latest message',
            createdAt: new Date().toISOString()
          }
        ]);

      const request = new Request('http://test/messages?before=nonexistent', {
        headers: { 'X-Conversation-Id': 'conv_123' }
      });

      const response = await customerMessageDO.fetch(request);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(1);
    });

    test('should handle database errors gracefully', async () => {
      mockDb.limit.mockRejectedValue(new Error('Database error'));

      const request = new Request('http://test/messages', {
        headers: { 'X-Conversation-Id': 'conv_123' }
      });

      const response = await customerMessageDO.fetch(request);
      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fetch messages');
    });

    test('should map agentSenderId to senderId correctly', async () => {
      mockDb.limit.mockResolvedValue([{
        id: 'msg_001',
        conversationId: 'conv_123',
        senderType: 'agent',
        agentSenderId: 'agent_123',
        customerSenderId: null,
        content: 'Test',
        createdAt: new Date().toISOString()
      }]);

      const request = new Request('http://test/messages', {
        headers: { 'X-Conversation-Id': 'conv_123' }
      });

      const response = await customerMessageDO.fetch(request);
      const result = await response.json();

      expect(result.messages[0].senderId).toBe('agent_123');
    });

    test('should map customerSenderId to senderId correctly', async () => {
      mockDb.limit.mockResolvedValue([{
        id: 'msg_002',
        conversationId: 'conv_123',
        senderType: 'customer',
        agentSenderId: null,
        customerSenderId: 'customer_456',
        content: 'Test',
        createdAt: new Date().toISOString()
      }]);

      const request = new Request('http://test/messages', {
        headers: { 'X-Conversation-Id': 'conv_123' }
      });

      const response = await customerMessageDO.fetch(request);
      const result = await response.json();

      expect(result.messages[0].senderId).toBe('customer_456');
    });
  });

  describe('POST /messages - Create Message', () => {
    test('should create message successfully', async () => {
      const request = new Request('http://test/messages', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_123',
          'X-Session-Id': 'agent_1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: 'Hello, this is a test message'
        })
      });

      const response = await customerMessageDO.fetch(request);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.message.id).toBeDefined();
      expect(result.message.content).toBe('Hello, this is a test message');
      expect(result.message.senderType).toBe('agent');
      expect(result.message.senderId).toBe('agent_1');

      // Verify database insertion
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv_123',
          content: 'Hello, this is a test message',
          senderType: 'agent',
          agentSenderId: 'agent_1'
        })
      );
    });

    test('should reject message without conversation ID', async () => {
      const request = new Request('http://test/messages', {
        method: 'POST',
        headers: {
          'X-Session-Id': 'agent_1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: 'Test' })
      });

      const response = await customerMessageDO.fetch(request);
      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Conversation ID is required');
    });

    test('should reject message without session ID', async () => {
      const request = new Request('http://test/messages', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_123',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: 'Test' })
      });

      const response = await customerMessageDO.fetch(request);
      expect(response.status).toBe(401);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Session ID is required');
    });

    test('should reject message with empty content', async () => {
      const request = new Request('http://test/messages', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_123',
          'X-Session-Id': 'agent_1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: '   ' }) // Whitespace only
      });

      const response = await customerMessageDO.fetch(request);
      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Message content is required');
    });

    test('should parse JWT token correctly', async () => {
      // Create a mock JWT: header.payload.signature
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ userId: 'agent_jwt_123', role: 'agent' }));
      const signature = 'mock_signature';
      const jwt = `${header}.${payload}.${signature}`;

      const request = new Request('http://test/messages', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_123',
          'X-Session-Id': jwt,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: 'JWT test message' })
      });

      const response = await customerMessageDO.fetch(request);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.message.agentSenderId).toBe('agent_jwt_123');
    });

    test('should fallback to sessionId if JWT parsing fails', async () => {
      const request = new Request('http://test/messages', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_123',
          'X-Session-Id': 'invalid_jwt_format',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: 'Fallback test' })
      });

      const response = await customerMessageDO.fetch(request);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.message.agentSenderId).toBe('invalid_jwt_format');
    });

    test('should store assets in metadata field', async () => {
      const assets = [
        'https://r2.example.com/file1.jpg',
        'https://r2.example.com/file2.pdf'
      ];

      const request = new Request('http://test/messages', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_123',
          'X-Session-Id': 'agent_1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: 'Message with attachments',
          assets
        })
      });

      await customerMessageDO.fetch(request);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.stringContaining('file1.jpg')
        })
      );
    });

    test('should notify CustomerConversationDO after message creation', async () => {
      const request = new Request('http://test/messages', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_123',
          'X-Session-Id': 'agent_1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: 'Broadcast test' })
      });

      await customerMessageDO.fetch(request);

      // Verify CustomerConversationDO was called
      expect(mockConversationDO.fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'https://fake-host/notify-message'
        })
      );
    });

    test('should continue if broadcast fails', async () => {
      // Mock CustomerConversationDO to fail
      mockConversationDO.fetch.mockRejectedValue(new Error('Broadcast failed'));

      const request = new Request('http://test/messages', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_123',
          'X-Session-Id': 'agent_1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: 'Test' })
      });

      const response = await customerMessageDO.fetch(request);

      // Should still succeed even if broadcast fails
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
    });

    test('should handle database insertion errors', async () => {
      mockDb.values.mockRejectedValue(new Error('Database insert failed'));

      const request = new Request('http://test/messages', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_123',
          'X-Session-Id': 'agent_1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: 'Test' })
      });

      const response = await customerMessageDO.fetch(request);
      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create message');
    });

    test('should generate unique message ID', async () => {
      const request1 = new Request('http://test/messages', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_123',
          'X-Session-Id': 'agent_1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: 'Message 1' })
      });

      const request2 = new Request('http://test/messages', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_123',
          'X-Session-Id': 'agent_1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: 'Message 2' })
      });

      const response1 = await customerMessageDO.fetch(request1);
      const result1 = await response1.json();

      const response2 = await customerMessageDO.fetch(request2);
      const result2 = await response2.json();

      expect(result1.message.id).not.toBe(result2.message.id);
    });

    test('should set correct message defaults', async () => {
      const request = new Request('http://test/messages', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_123',
          'X-Session-Id': 'agent_1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: 'Test defaults' })
      });

      await customerMessageDO.fetch(request);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          senderType: 'agent',
          messageType: 'text',
          isSent: true,
          deliveryStatus: 'delivered',
          isRecalled: false,
          customerSenderId: null,
          platformMessageId: null,
          sessionSequence: 1
        })
      );
    });
  });

  describe('POST /upload - File Upload', () => {
    test('should upload file successfully', async () => {
      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', mockFile);

      const request = new Request('http://test/upload', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_123',
          'X-Session-Id': 'agent_1'
        },
        body: formData
      });

      const response = await customerMessageDO.fetch(request);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.url).toBeDefined();
      expect(result.url).toContain('https://r2.example.com');
      expect(result.filename).toBe('test.jpg');
      expect(result.size).toBe(12); // 'test content' length
      expect(result.contentType).toBe('image/jpeg');

      // Verify R2 bucket was called
      expect(mockEnv.R2_BUCKET.put).toHaveBeenCalled();
    });

    test('should reject upload without conversation ID', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', mockFile);

      const request = new Request('http://test/upload', {
        method: 'POST',
        headers: { 'X-Session-Id': 'agent_1' },
        body: formData
      });

      const response = await customerMessageDO.fetch(request);
      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Conversation ID is required');
    });

    test('should reject upload without session ID', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', mockFile);

      const request = new Request('http://test/upload', {
        method: 'POST',
        headers: { 'X-Conversation-Id': 'conv_123' },
        body: formData
      });

      const response = await customerMessageDO.fetch(request);
      expect(response.status).toBe(401);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Session ID is required');
    });

    test('should reject upload without file', async () => {
      const formData = new FormData();

      const request = new Request('http://test/upload', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_123',
          'X-Session-Id': 'agent_1'
        },
        body: formData
      });

      const response = await customerMessageDO.fetch(request);
      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('No file provided');
    });

    test('should generate unique filename for upload', async () => {
      const mockFile = new File(['test'], 'document.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', mockFile);

      const request = new Request('http://test/upload', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_123',
          'X-Session-Id': 'agent_1'
        },
        body: formData
      });

      await customerMessageDO.fetch(request);

      // Verify R2 put was called with unique filename
      expect(mockEnv.R2_BUCKET.put).toHaveBeenCalledWith(
        expect.stringMatching(/^conv_123\/[a-f0-9-]+\.pdf$/),
        expect.anything(),
        expect.any(Object)
      );
    });

    test('should preserve file extension in upload', async () => {
      const mockFile = new File(['test'], 'image.png', { type: 'image/png' });
      const formData = new FormData();
      formData.append('file', mockFile);

      const request = new Request('http://test/upload', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_123',
          'X-Session-Id': 'agent_1'
        },
        body: formData
      });

      await customerMessageDO.fetch(request);

      expect(mockEnv.R2_BUCKET.put).toHaveBeenCalledWith(
        expect.stringMatching(/\.png$/),
        expect.anything(),
        expect.any(Object)
      );
    });

    test('should set correct content type in R2', async () => {
      const mockFile = new File(['test'], 'video.mp4', { type: 'video/mp4' });
      const formData = new FormData();
      formData.append('file', mockFile);

      const request = new Request('http://test/upload', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_123',
          'X-Session-Id': 'agent_1'
        },
        body: formData
      });

      await customerMessageDO.fetch(request);

      expect(mockEnv.R2_BUCKET.put).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        expect.objectContaining({
          httpMetadata: {
            contentType: 'video/mp4'
          }
        })
      );
    });

    test('should handle R2 upload errors', async () => {
      mockEnv.R2_BUCKET.put.mockRejectedValue(new Error('R2 upload failed'));

      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', mockFile);

      const request = new Request('http://test/upload', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_123',
          'X-Session-Id': 'agent_1'
        },
        body: formData
      });

      const response = await customerMessageDO.fetch(request);
      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to upload file');
    });

    test('should organize uploads by conversation ID', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', mockFile);

      const request = new Request('http://test/upload', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_999',
          'X-Session-Id': 'agent_1'
        },
        body: formData
      });

      await customerMessageDO.fetch(request);

      expect(mockEnv.R2_BUCKET.put).toHaveBeenCalledWith(
        expect.stringMatching(/^conv_999\//),
        expect.anything(),
        expect.any(Object)
      );
    });
  });

  describe('CORS Middleware', () => {
    test('should include CORS headers in response', async () => {
      const request = new Request('http://test/messages', {
        headers: {
          'X-Conversation-Id': 'conv_123',
          'Origin': 'https://example.com'
        }
      });

      const response = await customerMessageDO.fetch(request);

      expect(response.headers.has('Access-Control-Allow-Origin') ||
             response.headers.has('access-control-allow-origin')).toBe(true);
    });

    test('should handle OPTIONS preflight requests', async () => {
      const request = new Request('http://test/messages', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'POST'
        }
      });

      const response = await customerMessageDO.fetch(request);

      // Hono CORS middleware should handle OPTIONS
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for unknown endpoints', async () => {
      const request = new Request('http://test/unknown-endpoint');

      const response = await customerMessageDO.fetch(request);
      expect(response.status).toBe(404);
    });

    test('should handle malformed JSON in message creation', async () => {
      const request = new Request('http://test/messages', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_123',
          'X-Session-Id': 'agent_1',
          'Content-Type': 'application/json'
        },
        body: 'invalid json{'
      });

      const response = await customerMessageDO.fetch(request);

      // Should handle parse error gracefully
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should handle concurrent message creation', async () => {
      const requests = Array(5).fill(null).map((_, i) =>
        new Request('http://test/messages', {
          method: 'POST',
          headers: {
            'X-Conversation-Id': 'conv_123',
            'X-Session-Id': 'agent_1',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content: `Message ${i}` })
        })
      );

      const responses = await Promise.all(
        requests.map(req => customerMessageDO.fetch(req))
      );

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Integration with CustomerConversationDO', () => {
    test('should send correct notification payload', async () => {
      const request = new Request('http://test/messages', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_123',
          'X-Session-Id': 'agent_1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: 'Integration test' })
      });

      await customerMessageDO.fetch(request);

      expect(mockConversationDO.fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );

      // Verify notification payload structure
      const fetchCall = mockConversationDO.fetch.mock.calls[0][0];
      const body = JSON.parse(await fetchCall.text());

      expect(body).toHaveProperty('conversationId');
      expect(body).toHaveProperty('message');
      expect(body.message).toHaveProperty('id');
      expect(body.message).toHaveProperty('content');
    });

    test('should get correct CustomerConversationDO instance', async () => {
      const request = new Request('http://test/messages', {
        method: 'POST',
        headers: {
          'X-Conversation-Id': 'conv_unique_123',
          'X-Session-Id': 'agent_1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: 'Test' })
      });

      await customerMessageDO.fetch(request);

      expect(mockEnv.CUSTOMER_CONVERSATION_DO.idFromName)
        .toHaveBeenCalledWith('conv_unique_123');
    });
  });
});
