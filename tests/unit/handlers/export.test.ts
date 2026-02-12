/**
 * Export Handler Unit Tests
 *
 * Tests all 4 endpoints in src/handlers/messaging/routes/export.ts:
 * 1. GET /export/customers - Customer list for export filters
 * 2. GET /export/agents - Agent list for export filters
 * 3. GET /export/count - Message count with filters
 * 4. GET /export - Message export in JSON/CSV/TXT formats
 *
 * Mock Strategy:
 * - Endpoint-aware chainable DB mock that differentiates by query chain pattern:
 *   - No joins + no where = customers
 *   - No joins + where = agents
 *   - innerJoin + no leftJoin = count
 *   - innerJoin + leftJoin = messages
 * - JWT auth middleware bypassed with mock jwtPayload
 *
 * @see src/handlers/messaging/routes/export.ts
 * @see tests/unit/handlers/liff-assign-team.test.ts (pattern reference)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '@backend/types';

// ============================================================================
// Mock Setup (MUST be before handler import)
// ============================================================================

// Configurable mock state — set per-test in beforeEach or individual tests
let mockQueryResults: {
  customers: any[];
  agents: any[];
  count: any[];
  messages: any[];
} = {
  customers: [],
  agents: [],
  count: [{ value: 0 }],
  messages: []
};
let mockDbError: Error | null = null;

// Mock JWT auth middleware — bypass authentication, inject jwtPayload
vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn((c: any, next: any) => {
    c.set('jwtPayload', {
      userId: 1,
      username: 'test-admin',
      role: 'admin',
      teamId: 1
    });
    return next();
  })
}));

// Mock drizzle-factory with endpoint-aware chainable DB mock
// Each select() call creates a fresh chain that tracks its own state
// and resolves based on which chain methods were called.
vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn().mockImplementation(() => ({
    select: vi.fn().mockImplementation(() => {
      let hasInnerJoin = false;
      let hasLeftJoin = false;
      let hasWhere = false;

      const getResult = (): Promise<any> => {
        if (mockDbError) return Promise.reject(mockDbError);
        // Differentiate by chain pattern:
        // messages: innerJoin + leftJoin
        if (hasLeftJoin) return Promise.resolve(mockQueryResults.messages);
        // count: innerJoin without leftJoin
        if (hasInnerJoin) return Promise.resolve(mockQueryResults.count);
        // agents: where without innerJoin
        if (hasWhere) return Promise.resolve(mockQueryResults.agents);
        // customers: no joins, no where
        return Promise.resolve(mockQueryResults.customers);
      };

      const chain: Record<string, any> = {};

      chain.from = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockImplementation(() => {
        hasInnerJoin = true;
        return chain;
      });
      chain.leftJoin = vi.fn().mockImplementation(() => {
        hasLeftJoin = true;
        return chain;
      });
      chain.where = vi.fn().mockImplementation(() => {
        hasWhere = true;
        return chain;
      });
      chain.orderBy = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockReturnValue(chain);

      // Make the chain thenable so `await db.select().from()...` works
      chain.then = function (resolve: any, reject: any) {
        return getResult().then(resolve, reject);
      };

      return chain;
    })
  }))
}));

// Import handler AFTER mocks are registered
import exportRoutes from '@/handlers/messaging/routes/export';

// ============================================================================
// Test Utilities
// ============================================================================

function createTestApp() {
  const app = new Hono<{ Bindings: Bindings }>();
  app.use('*', async (c, next) => {
    c.env = { DB: {} } as any;
    await next();
  });
  app.route('/api/messages', exportRoutes);
  return app;
}

function createMockMessage(overrides: Record<string, any> = {}) {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderType: 'agent',
    senderName: null as string | null,
    content: 'Hello',
    messageType: 'text',
    sentAt: '2024-01-15T10:00:00Z',
    deliveryStatus: 'delivered',
    metadata: null as string | null,
    createdAt: '2024-01-15T10:00:00Z',
    agentName: 'Agent Alice' as string | null,
    customerName: null as string | null,
    ...overrides
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Export Handler', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbError = null;
    mockQueryResults = {
      customers: [],
      agents: [],
      count: [{ value: 0 }],
      messages: []
    };
    app = createTestApp();
  });

  // ==========================================================================
  // A. GET /export/customers
  // ==========================================================================
  describe('GET /export/customers', () => {
    it('should return customer list successfully', async () => {
      mockQueryResults.customers = [
        { id: 1, displayName: 'Alice', platform: 'line', platformUserId: 'U001' },
        { id: 2, displayName: 'Bob', platform: 'line', platformUserId: 'U002' }
      ];

      const res = await app.request('/api/messages/export/customers');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.timestamp).toBeDefined();
    });

    it('should return correct customer fields', async () => {
      mockQueryResults.customers = [
        { id: 1, displayName: 'Alice', platform: 'line', platformUserId: 'U001' }
      ];

      const res = await app.request('/api/messages/export/customers');
      const body = await res.json();

      expect(body.data[0]).toEqual({
        id: 1,
        displayName: 'Alice',
        platform: 'line',
        platformUserId: 'U001'
      });
    });

    it('should return empty array when no customers exist', async () => {
      mockQueryResults.customers = [];

      const res = await app.request('/api/messages/export/customers');
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });

    it('should handle multiple customers sorted by displayName', async () => {
      mockQueryResults.customers = [
        { id: 1, displayName: 'Alice', platform: 'line', platformUserId: 'U001' },
        { id: 3, displayName: 'Charlie', platform: 'facebook', platformUserId: 'F001' },
        { id: 2, displayName: 'Bob', platform: 'line', platformUserId: 'U002' }
      ];

      const res = await app.request('/api/messages/export/customers');
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
    });

    it('should return 500 on database error with Error message', async () => {
      mockDbError = new Error('Database connection lost');

      const res = await app.request('/api/messages/export/customers');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Database connection lost');
      expect(body.timestamp).toBeDefined();
    });

    it('should return generic message for non-Error throws', async () => {
      mockDbError = 'string error' as any;

      const res = await app.request('/api/messages/export/customers');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Failed to get customers');
    });

    it('should include timestamp in success response', async () => {
      mockQueryResults.customers = [];

      const res = await app.request('/api/messages/export/customers');
      const body = await res.json();

      expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  // ==========================================================================
  // B. GET /export/agents
  // ==========================================================================
  describe('GET /export/agents', () => {
    it('should return agent list successfully', async () => {
      mockQueryResults.agents = [
        { id: 'agent-1', displayName: 'Agent Alice', role: 'admin' },
        { id: 'agent-2', displayName: 'Agent Bob', role: 'agent' }
      ];

      const res = await app.request('/api/messages/export/agents');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
    });

    it('should return correct agent fields', async () => {
      mockQueryResults.agents = [
        { id: 'agent-1', displayName: 'Agent Alice', role: 'admin' }
      ];

      const res = await app.request('/api/messages/export/agents');
      const body = await res.json();

      expect(body.data[0]).toEqual({
        id: 'agent-1',
        displayName: 'Agent Alice',
        role: 'admin'
      });
    });

    it('should return empty array when no active agents exist', async () => {
      mockQueryResults.agents = [];

      const res = await app.request('/api/messages/export/agents');
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });

    it('should return 500 on database error', async () => {
      mockDbError = new Error('Query timeout');

      const res = await app.request('/api/messages/export/agents');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Query timeout');
    });

    it('should return generic message for non-Error throws', async () => {
      mockDbError = { code: 'UNKNOWN' } as any;

      const res = await app.request('/api/messages/export/agents');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.error).toBe('Failed to get agents');
    });

    it('should include timestamp in error response', async () => {
      mockDbError = new Error('fail');

      const res = await app.request('/api/messages/export/agents');
      const body = await res.json();

      expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  // ==========================================================================
  // C. GET /export/count
  // ==========================================================================
  describe('GET /export/count', () => {
    it('should return count with no filters', async () => {
      mockQueryResults.count = [{ value: 42 }];

      const res = await app.request('/api/messages/export/count');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.count).toBe(42);
      expect(body.data.limit).toBe(5000);
      expect(body.data.willBeTruncated).toBe(false);
    });

    it('should accept a single filter parameter', async () => {
      mockQueryResults.count = [{ value: 15 }];

      const res = await app.request('/api/messages/export/count?conversationId=conv-1');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.count).toBe(15);
    });

    it('should accept all filter parameters simultaneously', async () => {
      mockQueryResults.count = [{ value: 10 }];

      const params = new URLSearchParams({
        conversationId: 'conv-1',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        customerId: '5',
        agentId: 'agent-1'
      });

      const res = await app.request(`/api/messages/export/count?${params}`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.count).toBe(10);
    });

    it('should set willBeTruncated to true when count exceeds limit', async () => {
      mockQueryResults.count = [{ value: 5001 }];

      const res = await app.request('/api/messages/export/count');
      const body = await res.json();

      expect(body.data.willBeTruncated).toBe(true);
    });

    it('should set willBeTruncated to false at exactly the limit (5000)', async () => {
      mockQueryResults.count = [{ value: 5000 }];

      const res = await app.request('/api/messages/export/count');
      const body = await res.json();

      expect(body.data.willBeTruncated).toBe(false);
      expect(body.data.count).toBe(5000);
    });

    it('should handle empty result array (fallback to 0)', async () => {
      mockQueryResults.count = []; // result[0]?.value ?? 0

      const res = await app.request('/api/messages/export/count');
      const body = await res.json();

      expect(body.data.count).toBe(0);
      expect(body.data.willBeTruncated).toBe(false);
    });

    it('should handle null value in result (nullish coalescing)', async () => {
      mockQueryResults.count = [{ value: null }]; // null ?? 0 = 0

      const res = await app.request('/api/messages/export/count');
      const body = await res.json();

      expect(body.data.count).toBe(0);
    });

    it('should return 0 when count is explicitly zero', async () => {
      mockQueryResults.count = [{ value: 0 }];

      const res = await app.request('/api/messages/export/count');
      const body = await res.json();

      expect(body.data.count).toBe(0);
    });

    it('should return correct limit value (EXPORT_MAX_RECORDS = 5000)', async () => {
      mockQueryResults.count = [{ value: 1 }];

      const res = await app.request('/api/messages/export/count');
      const body = await res.json();

      expect(body.data.limit).toBe(5000);
    });

    it('should return 500 on database error', async () => {
      mockDbError = new Error('Count query failed');

      const res = await app.request('/api/messages/export/count');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Count query failed');
    });

    it('should return generic message for non-Error throws', async () => {
      mockDbError = 42 as any;

      const res = await app.request('/api/messages/export/count');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.error).toBe('Failed to get export count');
    });
  });

  // ==========================================================================
  // D. Format Validation (GET /export)
  // ==========================================================================
  describe('GET /export - Format Validation', () => {
    it('should reject invalid format "xml" with 400', async () => {
      const res = await app.request('/api/messages/export?format=xml');
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('Invalid format');
    });

    it('should reject invalid format "pdf" and show valid options', async () => {
      const res = await app.request('/api/messages/export?format=pdf');
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toContain('json');
      expect(body.error).toContain('csv');
      expect(body.error).toContain('txt');
    });

    it('should default to JSON when format is not specified', async () => {
      mockQueryResults.messages = [];

      const res = await app.request('/api/messages/export');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.exportInfo.format).toBe('json');
    });

    it('should accept all three valid formats', async () => {
      mockQueryResults.messages = [];

      const jsonRes = await app.request('/api/messages/export?format=json');
      expect(jsonRes.status).toBe(200);

      const csvRes = await app.request('/api/messages/export?format=csv');
      expect(csvRes.status).toBe(200);

      const txtRes = await app.request('/api/messages/export?format=txt');
      expect(txtRes.status).toBe(200);
    });
  });

  // ==========================================================================
  // E. JSON Export (GET /export?format=json)
  // ==========================================================================
  describe('GET /export - JSON Format', () => {
    it('should map message fields correctly', async () => {
      mockQueryResults.messages = [createMockMessage({
        id: 'msg-123',
        conversationId: 'conv-456',
        senderType: 'agent',
        senderName: 'Agent Alice',
        content: 'Hello customer',
        messageType: 'text',
        sentAt: '2024-01-15T10:00:00Z',
        deliveryStatus: 'delivered',
        metadata: null,
        createdAt: '2024-01-15T10:00:00Z'
      })];

      const res = await app.request('/api/messages/export?format=json');
      const body = await res.json();

      const msg = body.data.messages[0];
      expect(msg.id).toBe('msg-123');
      expect(msg.conversationId).toBe('conv-456');
      expect(msg.senderType).toBe('agent');
      expect(msg.senderName).toBe('Agent Alice');
      expect(msg.content).toBe('Hello customer');
      expect(msg.messageType).toBe('text');
      expect(msg.sentAt).toBe('2024-01-15T10:00:00Z');
      expect(msg.deliveryStatus).toBe('delivered');
      expect(msg.metadata).toBeNull();
      expect(msg.createdAt).toBe('2024-01-15T10:00:00Z');
    });

    it('should include exportInfo with correct structure', async () => {
      mockQueryResults.messages = [createMockMessage()];

      const params = new URLSearchParams({
        format: 'json',
        conversationId: 'conv-1',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        customerId: '5',
        agentId: 'agent-1',
        limit: '50'
      });

      const res = await app.request(`/api/messages/export?${params}`);
      const body = await res.json();

      expect(body.data.exportInfo).toMatchObject({
        format: 'json',
        totalRecords: 1,
        exportedBy: '1',
        filters: {
          conversationId: 'conv-1',
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
          customerId: '5',
          agentId: 'agent-1',
          limit: 50
        }
      });
      expect(body.data.exportInfo.exportedAt).toBeDefined();
    });

    it('should use senderName when present (highest priority)', async () => {
      mockQueryResults.messages = [createMockMessage({
        senderName: 'Custom Sender',
        agentName: 'Agent Name',
        customerName: 'Customer Name'
      })];

      const res = await app.request('/api/messages/export?format=json');
      const body = await res.json();

      expect(body.data.messages[0].senderName).toBe('Custom Sender');
    });

    it('should fall back to agentName for agent senderType', async () => {
      mockQueryResults.messages = [createMockMessage({
        senderName: null,
        senderType: 'agent',
        agentName: 'Agent Alice',
        customerName: null
      })];

      const res = await app.request('/api/messages/export?format=json');
      const body = await res.json();

      expect(body.data.messages[0].senderName).toBe('Agent Alice');
    });

    it('should fall back to customerName for customer senderType', async () => {
      mockQueryResults.messages = [createMockMessage({
        senderName: null,
        senderType: 'customer',
        agentName: null,
        customerName: 'Customer Bob'
      })];

      const res = await app.request('/api/messages/export?format=json');
      const body = await res.json();

      expect(body.data.messages[0].senderName).toBe('Customer Bob');
    });

    it('should return empty string when no sender name is available', async () => {
      mockQueryResults.messages = [createMockMessage({
        senderName: null,
        senderType: 'agent',
        agentName: null,
        customerName: null
      })];

      const res = await app.request('/api/messages/export?format=json');
      const body = await res.json();

      expect(body.data.messages[0].senderName).toBe('');
    });

    it('should parse valid metadata JSON string', async () => {
      mockQueryResults.messages = [createMockMessage({
        metadata: '{"source":"line","stickerId":"123"}'
      })];

      const res = await app.request('/api/messages/export?format=json');
      const body = await res.json();

      expect(body.data.messages[0].metadata).toEqual({
        source: 'line',
        stickerId: '123'
      });
    });

    it('should return null for null metadata', async () => {
      mockQueryResults.messages = [createMockMessage({ metadata: null })];

      const res = await app.request('/api/messages/export?format=json');
      const body = await res.json();

      expect(body.data.messages[0].metadata).toBeNull();
    });

    it('should cap limit at EXPORT_MAX_RECORDS (5000)', async () => {
      mockQueryResults.messages = [];

      const res = await app.request('/api/messages/export?format=json&limit=10000');
      const body = await res.json();

      expect(body.data.exportInfo.filters.limit).toBe(5000);
    });

    it('should default limit to 100 when not specified', async () => {
      mockQueryResults.messages = [];

      const res = await app.request('/api/messages/export?format=json');
      const body = await res.json();

      expect(body.data.exportInfo.filters.limit).toBe(100);
    });

    it('should respect limit value under the cap', async () => {
      mockQueryResults.messages = [];

      const res = await app.request('/api/messages/export?format=json&limit=50');
      const body = await res.json();

      expect(body.data.exportInfo.filters.limit).toBe(50);
    });

    it('should use userId.toString() for exportedBy', async () => {
      mockQueryResults.messages = [];

      const res = await app.request('/api/messages/export?format=json');
      const body = await res.json();

      // userId from mock jwtPayload is 1 (number), exported as '1' (string)
      expect(body.data.exportInfo.exportedBy).toBe('1');
    });
  });

  // ==========================================================================
  // F. CSV Export (GET /export?format=csv)
  // ==========================================================================
  describe('GET /export - CSV Format', () => {
    it('should set Content-Type to text/csv with charset', async () => {
      mockQueryResults.messages = [];

      const res = await app.request('/api/messages/export?format=csv');
      expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    });

    it('should set Content-Disposition with csv filename', async () => {
      mockQueryResults.messages = [];

      const res = await app.request('/api/messages/export?format=csv');
      const disposition = res.headers.get('Content-Disposition');

      expect(disposition).toContain('attachment;');
      expect(disposition).toContain('filename="messages_export_');
      expect(disposition).toContain('.csv"');
    });

    it('should include correct header row', async () => {
      mockQueryResults.messages = [];

      const res = await app.request('/api/messages/export?format=csv');
      const text = await res.text();
      const firstLine = text.split('\n')[0];

      expect(firstLine).toBe(
        'Message ID,Conversation ID,Sender Type,Sender Name,Content,Message Type,Sent At,Delivery Status,Created At'
      );
    });

    it('should escape double quotes in senderName and content', async () => {
      mockQueryResults.messages = [createMockMessage({
        senderName: 'Agent "Pro" Alice',
        content: 'He said "hello" to me'
      })];

      const res = await app.request('/api/messages/export?format=csv');
      const text = await res.text();
      const dataLine = text.split('\n')[1];

      expect(dataLine).toContain('"Agent ""Pro"" Alice"');
      expect(dataLine).toContain('"He said ""hello"" to me"');
    });

    it('should handle null optional fields as empty strings', async () => {
      mockQueryResults.messages = [createMockMessage({
        sentAt: null,
        deliveryStatus: null,
        createdAt: null
      })];

      const res = await app.request('/api/messages/export?format=csv');
      const text = await res.text();
      const dataLine = text.split('\n')[1];

      // sentAt, deliveryStatus, createdAt are the last 3 fields
      // When null, they produce empty strings, so line ends with ',,'
      expect(dataLine).toMatch(/,,$/);
    });

    it('should output correct number of data rows', async () => {
      mockQueryResults.messages = [
        createMockMessage({ id: 'msg-1' }),
        createMockMessage({ id: 'msg-2' }),
        createMockMessage({ id: 'msg-3' })
      ];

      const res = await app.request('/api/messages/export?format=csv');
      const text = await res.text();
      const lines = text.split('\n');

      expect(lines).toHaveLength(4); // 1 header + 3 data rows
    });

    it('should output only header row when no messages', async () => {
      mockQueryResults.messages = [];

      const res = await app.request('/api/messages/export?format=csv');
      const text = await res.text();
      const lines = text.split('\n');

      expect(lines).toHaveLength(1); // header only
    });
  });

  // ==========================================================================
  // G. TXT Export (GET /export?format=txt)
  // ==========================================================================
  describe('GET /export - TXT Format', () => {
    it('should set Content-Type to text/plain with charset', async () => {
      mockQueryResults.messages = [];

      const res = await app.request('/api/messages/export?format=txt');
      expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    });

    it('should set Content-Disposition with txt filename', async () => {
      mockQueryResults.messages = [];

      const res = await app.request('/api/messages/export?format=txt');
      const disposition = res.headers.get('Content-Disposition');

      expect(disposition).toContain('attachment;');
      expect(disposition).toContain('filename="chat_export_');
      expect(disposition).toContain('.txt"');
    });

    it('should include header block with title and record count', async () => {
      mockQueryResults.messages = [
        createMockMessage(),
        createMockMessage({ id: 'msg-2' })
      ];

      const res = await app.request('/api/messages/export?format=txt');
      const text = await res.text();

      expect(text).toContain('========================================');
      expect(text).toContain('對話記錄匯出');
      expect(text).toContain('總筆數: 2');
      expect(text).toContain('匯出時間:');
    });

    it('should include filter info in header when filters are provided', async () => {
      mockQueryResults.messages = [];

      const params = new URLSearchParams({
        format: 'txt',
        conversationId: 'conv-123',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        customerId: '5',
        agentId: 'agent-1'
      });

      const res = await app.request(`/api/messages/export?${params}`);
      const text = await res.text();

      expect(text).toContain('對話 ID: conv-123');
      expect(text).toContain('起始日期: 2024-01-01');
      expect(text).toContain('結束日期: 2024-01-31');
      expect(text).toContain('客戶 ID: 5');
      expect(text).toContain('客服 ID: agent-1');
    });

    it('should group messages by conversationId', async () => {
      mockQueryResults.messages = [
        createMockMessage({ id: 'msg-1', conversationId: 'conv-A', content: 'Message A1' }),
        createMockMessage({ id: 'msg-2', conversationId: 'conv-B', content: 'Message B1' }),
        createMockMessage({ id: 'msg-3', conversationId: 'conv-A', content: 'Message A2' })
      ];

      const res = await app.request('/api/messages/export?format=txt');
      const text = await res.text();

      expect(text).toContain('--- 對話: conv-A ---');
      expect(text).toContain('--- 對話: conv-B ---');
      expect(text).toContain('Message A1');
      expect(text).toContain('Message A2');
      expect(text).toContain('Message B1');
    });

    it('should sort messages chronologically within groups (ascending)', async () => {
      mockQueryResults.messages = [
        createMockMessage({
          id: 'msg-1',
          conversationId: 'conv-A',
          content: 'Later message',
          createdAt: '2024-01-15T12:00:00Z'
        }),
        createMockMessage({
          id: 'msg-2',
          conversationId: 'conv-A',
          content: 'Earlier message',
          createdAt: '2024-01-15T08:00:00Z'
        })
      ];

      const res = await app.request('/api/messages/export?format=txt');
      const text = await res.text();

      // Earlier message should appear before later message
      const earlierIdx = text.indexOf('Earlier message');
      const laterIdx = text.indexOf('Later message');
      expect(earlierIdx).toBeLessThan(laterIdx);
    });

    it('should use sender name fallback chain in TXT output', async () => {
      mockQueryResults.messages = [
        createMockMessage({
          id: 'msg-1',
          conversationId: 'conv-1',
          senderName: 'Custom Name',
          senderType: 'agent',
          agentName: 'Agent Default'
        }),
        createMockMessage({
          id: 'msg-2',
          conversationId: 'conv-1',
          senderName: null,
          senderType: 'customer',
          customerName: 'Customer Bob',
          createdAt: '2024-01-15T11:00:00Z'
        })
      ];

      const res = await app.request('/api/messages/export?format=txt');
      const text = await res.text();

      expect(text).toContain('Custom Name:');
      expect(text).toContain('Customer Bob:');
    });

    it('should fall back to senderType when no name available', async () => {
      mockQueryResults.messages = [createMockMessage({
        senderName: null,
        senderType: 'system',
        agentName: null,
        customerName: null
      })];

      const res = await app.request('/api/messages/export?format=txt');
      const text = await res.text();

      // getSenderName returns '' (empty string), which is falsy
      // So: '' || 'system' || '未知' = 'system'
      expect(text).toContain('system:');
    });

    it('should show "未知" when senderType is also empty', async () => {
      mockQueryResults.messages = [createMockMessage({
        senderName: null,
        senderType: '',
        agentName: null,
        customerName: null
      })];

      const res = await app.request('/api/messages/export?format=txt');
      const text = await res.text();

      // '' || '' || '未知' = '未知'
      expect(text).toContain('未知:');
    });

    it('should handle null createdAt gracefully with fallback text', async () => {
      mockQueryResults.messages = [createMockMessage({
        createdAt: null
      })];

      const res = await app.request('/api/messages/export?format=txt');
      const text = await res.text();

      expect(text).toContain('未知時間');
    });
  });

  // ==========================================================================
  // H. Error Handling & Edge Cases
  // ==========================================================================
  describe('Error Handling & Edge Cases', () => {
    it('should return consistent error format for export endpoint', async () => {
      mockDbError = new Error('Export failed');

      const res = await app.request('/api/messages/export?format=json');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body).toHaveProperty('success', false);
      expect(body).toHaveProperty('error', 'Export failed');
      expect(body).toHaveProperty('timestamp');
    });

    it('should return generic message for non-Error throws in export', async () => {
      mockDbError = 42 as any;

      const res = await app.request('/api/messages/export?format=json');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.error).toBe('Failed to export messages');
    });

    it('should produce valid JSON output with empty message list', async () => {
      mockQueryResults.messages = [];

      const res = await app.request('/api/messages/export?format=json');
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.data.messages).toEqual([]);
      expect(body.data.exportInfo.totalRecords).toBe(0);
    });

    it('should produce valid CSV output with empty message list', async () => {
      mockQueryResults.messages = [];

      const res = await app.request('/api/messages/export?format=csv');
      expect(res.status).toBe(200);

      const text = await res.text();
      expect(text).toContain('Message ID'); // Header still present
      expect(text.split('\n')).toHaveLength(1); // Only header
    });

    it('should produce valid TXT output with empty message list', async () => {
      mockQueryResults.messages = [];

      const res = await app.request('/api/messages/export?format=txt');
      expect(res.status).toBe(200);

      const text = await res.text();
      expect(text).toContain('總筆數: 0');
      // No conversation groups when no messages
      expect(text).not.toContain('--- 對話:');
    });
  });
});
