// DelayedMessage API 端點測試
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import delayedMessages from '../../../src/handlers/delayed-message-drizzle';
import type { HonoContext } from '../../../src/types/bindings';

// Mock DatabaseService at module level
vi.mock('../../../src/services/database', () => ({
  DatabaseService: vi.fn().mockImplementation(() => ({
    getConversationById: vi.fn(),
    createDelayedMessage: vi.fn(),
    updateDelayedMessageStatus: vi.fn(),
    createMessage: vi.fn(),
    createUser: vi.fn(),
    getUserById: vi.fn(),
    getUserByPlatformId: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    createTeam: vi.fn(),
    getTeamById: vi.fn(),
    updateTeam: vi.fn(),
    deleteTeam: vi.fn(),
    addUserToTeam: vi.fn(),
    removeUserFromTeam: vi.fn(),
    createConversation: vi.fn(),
    updateConversation: vi.fn(),
    deleteConversation: vi.fn(),
    createCustomer: vi.fn(),
    getCustomerById: vi.fn(),
    updateCustomer: vi.fn(),
    deleteCustomer: vi.fn(),
    getCachedConversation: vi.fn(),
    cacheConversation: vi.fn(),
    invalidateConversationCache: vi.fn()
  }))
}));

// Mock middleware - simplified
vi.mock('../../../src/middleware/database', () => ({
  databaseMiddleware: vi.fn((c, next) => next()),
  authMiddleware: vi.fn((c, next) => {
    c.set('agent', { 
      id: 'agent-123', 
      username: 'testagent',
      role: 'agent', 
      permissions: [],
      sessionId: 'session-123',
      lastActivity: new Date(),
      teamId: 'team-123'
    });
    return next();
  })
}));

describe('DelayedMessage API Handler', () => {
  let app: Hono<HonoContext>;
  let mockDbService: any;

  beforeEach(async () => {
    app = new Hono<HonoContext>();
    
    // Get the mocked DatabaseService and set up a fresh instance for each test
    const { DatabaseService } = await import('../../../src/services/database');
    mockDbService = new (DatabaseService as any)({}, {});
    
    // Ensure all methods are properly mocked
    Object.keys(mockDbService).forEach(method => {
      if (typeof mockDbService[method] === 'function' && mockDbService[method].mockReset) {
        mockDbService[method].mockReset();
      }
    });
    
    // 設置環境和必要的 context values
    app.use('*', (c, next) => {
      c.env = {
        AGENT_QUEUE: {
          send: vi.fn().mockResolvedValue(undefined)
        }
      } as any;
      
      // Set required context values - these are used by the handler
      c.set('db', {} as any);
      c.set('kv', {} as any);
      c.set('agent', { 
        id: 'agent-123', 
        username: 'testagent',
        role: 'agent', 
        permissions: [],
        sessionId: 'session-123',
        lastActivity: new Date(),
        teamId: 'team-123'
      });
      
      return next();
    });
    
    app.route('/api/delayed-messages', delayedMessages);
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /send', () => {
    const validRequest = {
      conversationId: 'conv-123',
      content: 'Test delayed message',
      delaySeconds: 30,
      messageType: 'text',
      metadata: { priority: 'normal' }
    };

    it('should successfully send delayed message', async () => {
      mockDbService.getConversationById.mockResolvedValue({
        id: 'conv-123',
        status: 'active'
      });

      mockDbService.createDelayedMessage.mockResolvedValue([{
        id: 'delayed-msg-123',
        conversationId: 'conv-123',
        content: 'Test delayed message'
      }]);

      const response = await app.request('/api/delayed-messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.messageId).toBe('delayed-msg-123');
      expect(result.data.canRecall).toBe(true);
    });

    it('should reject empty content', async () => {
      const response = await app.request('/api/delayed-messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validRequest, content: '' })
      });

      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Content is required');
    });

    it('should reject invalid delay seconds', async () => {
      const response = await app.request('/api/delayed-messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validRequest, delaySeconds: 150 })
      });

      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Delay must be between 1 and 120 seconds');
    });

    it('should reject non-existent conversation', async () => {
      // Mock returns null for non-existent conversation
      mockDbService.getConversationById.mockResolvedValue(null);

      const response = await app.request('/api/delayed-messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      expect(response.status).toBe(404);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Conversation not found');
    });
  });

  describe('Input Validation', () => {
    it('should validate JSON format', async () => {
      const response = await app.request('/api/delayed-messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });

      // JSON parse error results in 500
      expect(response.status).toBe(500);
    });

    it('should handle missing required fields', async () => {
      const response = await app.request('/api/delayed-messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'test' }) // missing other required fields
      });

      // Will trigger error before reaching conversation check
      expect(response.status).toBe(500);
    });

    it('should validate delay seconds boundaries', async () => {
      const response = await app.request('/api/delayed-messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'test',
          content: 'test',
          delaySeconds: 200 // exceeds limit
        })
      });

      expect(response.status).toBe(400);
    });
  });
});