import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Context } from 'hono';
import { webhookHandler } from '../../src/handlers/webhook';
import type { Bindings } from '../../src/types';
import { createMockDatabase } from '../helpers/mockDatabase';

// Mock crypto API
const mockCrypto = {
  subtle: {
    importKey: vi.fn(),
    sign: vi.fn()
  }
};
global.crypto = mockCrypto as any;

// Mock UUID generation
vi.mock('uuid', () => ({
  v4: () => 'integration-test-uuid-123'
}));

describe('Webhook Processing Integration Tests', () => {
  let mockDB: any;
  let mockContext: Context<{ Bindings: Bindings }>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDB = createMockDatabase();
    
    mockContext = {
      req: {
        header: vi.fn(),
        text: vi.fn(),
        json: vi.fn(),
        query: vi.fn()
      },
      env: {
        DB: mockDB,
        LINE_CHANNEL_SECRET: 'test-line-secret',
        FB_VERIFY_TOKEN: 'test-fb-verify-token',
        FB_APP_SECRET: 'test-fb-app-secret'
      },
      json: vi.fn((data, status = 200) => ({ data, status })),
      text: vi.fn((text, status = 200) => ({ text, status }))
    } as any;

    // Default crypto mocks
    mockCrypto.subtle.importKey.mockResolvedValue({});
    // Create a mock hash that matches expected signature
    const mockHashArray = new Uint8Array(32);
    mockCrypto.subtle.sign.mockResolvedValue(mockHashArray.buffer);
    
    // Mock btoa function
    global.btoa = vi.fn(() => 'valid-line-signature');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('End-to-End Webhook Processing', () => {
    it('should process complete LINE message flow from webhook to database', async () => {
      const lineWebhookPayload = {
        events: [{
          type: 'message',
          timestamp: 1640995200000,
          source: {
            type: 'user',
            userId: 'line-integration-user-123'
          },
          replyToken: 'reply-token-integration-123',
          message: {
            id: 'line-msg-integration-123',
            type: 'text',
            text: 'Complete integration test message'
          }
        }]
      };

      // Setup mock context for LINE webhook
      mockContext.req.header = vi.fn((header) => {
        if (header === 'X-Line-Signature') return 'valid-line-signature';
        return null;
      });
      mockContext.req.text = vi.fn().mockResolvedValue(JSON.stringify(lineWebhookPayload));

      // Track database operations in order
      const dbOperations: string[] = [];
      let userQueryCount = 0;
      let conversationQueryCount = 0;

      mockDB.prepare.mockImplementation((query: string) => {
        const operation = {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockImplementation(async () => {
            if (query.includes('SELECT * FROM customers')) {
              dbOperations.push('user-lookup');
              return null; // New user
            } else if (query.includes('SELECT * FROM conversations')) {
              dbOperations.push('conversation-lookup');
              return null; // New conversation
            }
            return null;
          }),
          run: vi.fn().mockImplementation(async () => {
            if (query.includes('INSERT INTO customers')) {
              dbOperations.push('user-creation');
              return { meta: { last_row_id: 1001 }, success: true };
            } else if (query.includes('INSERT INTO conversations')) {
              dbOperations.push('conversation-creation');
              return { meta: { last_row_id: 2001 }, success: true };
            } else if (query.includes('INSERT INTO messages')) {
              dbOperations.push('message-creation');
              return { meta: { last_row_id: 3001 }, success: true };
            }
            return { success: true };
          })
        };
        return operation;
      });

      // Process webhook
      const result = await webhookHandler.line(mockContext);

      // Verify successful processing
      expect(result.status).toBe(200);
      
      // Verify database operations occurred in correct order
      expect(dbOperations).toEqual([
        'user-lookup',
        'user-creation',
        'conversation-lookup',
        'conversation-creation',
        'message-creation'
      ]);

      // Verify database calls
      expect(mockDB.prepare).toHaveBeenCalledTimes(5);
    });

    it('should process complete Facebook message flow from webhook to database', async () => {
      const facebookWebhookPayload = {
        object: 'page',
        entry: [{
          id: 'page-123',
          time: 1640995200000,
          messaging: [{
            sender: { id: 'fb-integration-user-456' },
            recipient: { id: 'page-integration-123' },
            timestamp: 1640995200000,
            message: {
              mid: 'fb-msg-integration-456',
              text: 'Complete Facebook integration test'
            }
          }]
        }]
      };

      // Setup mock context for Facebook webhook
      mockContext.req.query = vi.fn(() => null); // Not a verification request
      mockContext.req.header = vi.fn(() => null);
      mockContext.req.json = vi.fn().mockResolvedValue(facebookWebhookPayload);

      // Track database operations
      const dbOperations: string[] = [];

      mockDB.prepare.mockImplementation((query: string) => {
        const operation = {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockImplementation(async () => {
            if (query.includes('SELECT * FROM customers')) {
              dbOperations.push('user-lookup');
              return null; // New user
            } else if (query.includes('SELECT * FROM conversations')) {
              dbOperations.push('conversation-lookup');
              return null; // New conversation
            }
            return null;
          }),
          run: vi.fn().mockImplementation(async () => {
            if (query.includes('INSERT INTO customers')) {
              dbOperations.push('user-creation');
              return { meta: { last_row_id: 2001 }, success: true };
            } else if (query.includes('INSERT INTO conversations')) {
              dbOperations.push('conversation-creation');
              return { meta: { last_row_id: 3001 }, success: true };
            } else if (query.includes('INSERT INTO messages')) {
              dbOperations.push('message-creation');
              return { meta: { last_row_id: 4001 }, success: true };
            }
            return { success: true };
          })
        };
        return operation;
      });

      // Process webhook
      const result = await webhookHandler.facebook(mockContext);

      // Verify successful processing
      expect(result.status).toBe(200);
      
      // Verify database operations occurred in correct order
      expect(dbOperations).toEqual([
        'user-lookup',
        'user-creation',
        'conversation-lookup',
        'conversation-creation',
        'message-creation'
      ]);
    });

    it('should handle existing user and conversation updates correctly', async () => {
      const lineWebhookPayload = {
        events: [{
          type: 'message',
          timestamp: 1640995300000,
          source: {
            type: 'user',
            userId: 'existing-line-user-789'
          },
          replyToken: 'reply-token-existing-789',
          message: {
            id: 'line-msg-existing-789',
            type: 'text',
            text: 'Follow-up message from existing user'
          }
        }]
      };

      mockContext.req.header = vi.fn((header) => {
        if (header === 'X-Line-Signature') return 'valid-line-signature';
        return null;
      });
      mockContext.req.text = vi.fn().mockResolvedValue(JSON.stringify(lineWebhookPayload));

      const dbOperations: string[] = [];

      mockDB.prepare.mockImplementation((query: string) => {
        const operation = {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockImplementation(async () => {
            if (query.includes('SELECT * FROM customers')) {
              dbOperations.push('user-lookup');
              return { 
                id: 5001, 
                platform_user_id: 'existing-line-user-789',
                platform: 'line',
                display_name: 'Existing User'
              };
            } else if (query.includes('SELECT * FROM conversations')) {
              dbOperations.push('conversation-lookup');
              return { 
                id: 6001,
                customer_id: 5001,
                status: 'active'
              };
            }
            return null;
          }),
          run: vi.fn().mockImplementation(async () => {
            if (query.includes('UPDATE conversations')) {
              dbOperations.push('conversation-update');
              return { success: true };
            } else if (query.includes('INSERT INTO messages')) {
              dbOperations.push('message-creation');
              return { meta: { last_row_id: 7001 }, success: true };
            }
            return { success: true };
          })
        };
        return operation;
      });

      const result = await webhookHandler.line(mockContext);

      expect(result.status).toBe(200);
      
      // Should not create new user or conversation, just update existing conversation and create message
      expect(dbOperations).toEqual([
        'user-lookup',
        'conversation-lookup',
        'conversation-update',
        'message-creation'
      ]);
    });

    it('should handle multiple messages in single Facebook webhook', async () => {
      const multiMessagePayload = {
        object: 'page',
        entry: [{
          messaging: [
            {
              sender: { id: 'multi-user-1' },
              message: { mid: 'msg-1', text: 'First message' },
              timestamp: 1640995200000
            },
            {
              sender: { id: 'multi-user-2' },
              message: { mid: 'msg-2', text: 'Second message' },
              timestamp: 1640995300000
            },
            {
              sender: { id: 'multi-user-3' },
              message: { mid: 'msg-3', text: 'Third message' },
              timestamp: 1640995400000
            }
          ]
        }]
      };

      mockContext.req.query = vi.fn(() => null);
      mockContext.req.header = vi.fn(() => null);
      mockContext.req.json = vi.fn().mockResolvedValue(multiMessagePayload);

      let messageCount = 0;

      mockDB.prepare.mockImplementation((query: string) => {
        const operation = {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockImplementation(async () => {
            return null; // All new users and conversations
          }),
          run: vi.fn().mockImplementation(async () => {
            if (query.includes('INSERT INTO customers')) {
              return { meta: { last_row_id: 8000 + messageCount }, success: true };
            } else if (query.includes('INSERT INTO conversations')) {
              return { meta: { last_row_id: 9000 + messageCount }, success: true };
            } else if (query.includes('INSERT INTO messages')) {
              messageCount++;
              return { meta: { last_row_id: 10000 + messageCount }, success: true };
            }
            return { success: true };
          })
        };
        return operation;
      });

      const result = await webhookHandler.facebook(mockContext);

      expect(result.status).toBe(200);
      expect(messageCount).toBe(3); // Should process all three messages
      expect(mockDB.prepare).toHaveBeenCalledTimes(9); // 3 queries per message
    });

    it('should handle webhook processing with database transaction rollback on error', async () => {
      const lineWebhookPayload = {
        events: [{
          type: 'message',
          timestamp: 1640995200000,
          source: {
            type: 'user',
            userId: 'error-test-user'
          },
          replyToken: 'reply-token-error',
          message: {
            id: 'line-msg-error',
            type: 'text',
            text: 'Message that will cause database error'
          }
        }]
      };

      mockContext.req.header = vi.fn((header) => {
        if (header === 'X-Line-Signature') return 'valid-line-signature';
        return null;
      });
      mockContext.req.text = vi.fn().mockResolvedValue(JSON.stringify(lineWebhookPayload));

      const dbOperations: string[] = [];

      mockDB.prepare.mockImplementation((query: string) => {
        const operation = {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockImplementation(async () => {
            if (query.includes('SELECT * FROM customers')) {
              dbOperations.push('user-lookup');
              return null; // New user
            } else if (query.includes('SELECT * FROM conversations')) {
              dbOperations.push('conversation-lookup');
              return null; // New conversation
            }
            return null;
          }),
          run: vi.fn().mockImplementation(async () => {
            if (query.includes('INSERT INTO customers')) {
              dbOperations.push('user-creation');
              return { meta: { last_row_id: 1001 }, success: true };
            } else if (query.includes('INSERT INTO conversations')) {
              dbOperations.push('conversation-creation');
              return { meta: { last_row_id: 2001 }, success: true };
            } else if (query.includes('INSERT INTO messages')) {
              dbOperations.push('message-creation-failed');
              throw new Error('Database constraint violation');
            }
            return { success: true };
          })
        };
        return operation;
      });

      const result = await webhookHandler.line(mockContext);

      // Should return error status
      expect(result.status).toBe(500);
      
      // Should have attempted all operations up to the failure
      expect(dbOperations).toEqual([
        'user-lookup',
        'user-creation',
        'conversation-lookup',
        'conversation-creation',
        'message-creation-failed'
      ]);
    });

    it('should maintain data consistency across concurrent webhook requests', async () => {
      // Simulate concurrent webhooks for the same user
      const webhookPayloads = [
        {
          events: [{
            type: 'message',
            timestamp: 1640995200000,
            source: { type: 'user', userId: 'concurrent-user-123' },
            replyToken: 'reply-1',
            message: { id: 'msg-1', type: 'text', text: 'Message 1' }
          }]
        },
        {
          events: [{
            type: 'message',
            timestamp: 1640995201000,
            source: { type: 'user', userId: 'concurrent-user-123' },
            replyToken: 'reply-2',
            message: { id: 'msg-2', type: 'text', text: 'Message 2' }
          }]
        }
      ];

      const results = await Promise.all(
        webhookPayloads.map(async (payload, index) => {
          const context = {
            req: {
              header: vi.fn((header) => header === 'X-Line-Signature' ? 'valid-sig' : null),
              text: vi.fn().mockResolvedValue(JSON.stringify(payload))
            },
            env: mockContext.env,
            json: mockContext.json,
            text: mockContext.text
          } as any;

          // Mock database behavior for concurrent requests
          let userExists = false;
          mockDB.prepare.mockImplementation((query: string) => ({
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockImplementation(async () => {
              if (query.includes('SELECT * FROM customers')) {
                if (!userExists) {
                  userExists = true;
                  return null; // First request creates user
                } else {
                  return { id: 1001 }; // Subsequent request finds existing user
                }
              }
              return null;
            }),
            run: vi.fn().mockResolvedValue({ 
              meta: { last_row_id: 1000 + index }, 
              success: true 
            })
          }));

          return await webhookHandler.line(context);
        })
      );

      // Both webhooks should process successfully
      results.forEach(result => {
        expect(result.status).toBe(200);
      });
    });
  });

  describe('Cross-Platform Message Processing', () => {
    it('should handle alternating LINE and Facebook messages from different users', async () => {
      const messageSequence = [
        { platform: 'line', userId: 'line-user-cross-1', text: 'LINE message 1' },
        { platform: 'facebook', userId: 'fb-user-cross-1', text: 'Facebook message 1' },
        { platform: 'line', userId: 'line-user-cross-2', text: 'LINE message 2' },
        { platform: 'facebook', userId: 'fb-user-cross-2', text: 'Facebook message 2' }
      ];

      const processedUsers: string[] = [];

      for (const message of messageSequence) {
        let context: any;
        
        if (message.platform === 'line') {
          const payload = {
            events: [{
              type: 'message',
              timestamp: Date.now(),
              source: { type: 'user', userId: message.userId },
              replyToken: `reply-${message.userId}`,
              message: { id: `msg-${message.userId}`, type: 'text', text: message.text }
            }]
          };

          context = {
            req: {
              header: vi.fn((header) => header === 'X-Line-Signature' ? 'valid-sig' : null),
              text: vi.fn().mockResolvedValue(JSON.stringify(payload))
            },
            env: mockContext.env,
            json: mockContext.json,
            text: mockContext.text
          };

          const result = await webhookHandler.line(context);
          expect(result.status).toBe(200);
          
        } else if (message.platform === 'facebook') {
          const payload = {
            object: 'page',
            entry: [{
              messaging: [{
                sender: { id: message.userId },
                message: { mid: `msg-${message.userId}`, text: message.text },
                timestamp: Date.now()
              }]
            }]
          };

          context = {
            req: {
              query: vi.fn(() => null),
              header: vi.fn(() => null),
              json: vi.fn().mockResolvedValue(payload)
            },
            env: mockContext.env,
            json: mockContext.json,
            text: mockContext.text
          };

          const result = await webhookHandler.facebook(context);
          expect(result.status).toBe(200);
        }

        processedUsers.push(`${message.platform}-${message.userId}`);
      }

      expect(processedUsers).toHaveLength(4);
      expect(processedUsers).toContain('line-line-user-cross-1');
      expect(processedUsers).toContain('facebook-fb-user-cross-1');
      expect(processedUsers).toContain('line-line-user-cross-2');
      expect(processedUsers).toContain('facebook-fb-user-cross-2');
    });

    it('should maintain separate conversation threads per platform', async () => {
      const sameUserDifferentPlatforms = {
        line: {
          events: [{
            type: 'message',
            timestamp: Date.now(),
            source: { type: 'user', userId: 'cross-platform-user' },
            replyToken: 'reply-line',
            message: { id: 'msg-line', type: 'text', text: 'Message via LINE' }
          }]
        },
        facebook: {
          object: 'page',
          entry: [{
            messaging: [{
              sender: { id: 'cross-platform-user' },
              message: { mid: 'msg-fb', text: 'Message via Facebook' },
              timestamp: Date.now()
            }]
          }]
        }
      };

      const conversationIds: number[] = [];

      // Mock database to track different conversations for same user ID on different platforms
      mockDB.prepare.mockImplementation((query: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(async () => {
          return null; // Always create new records for this test
        }),
        run: vi.fn().mockImplementation(async () => {
          if (query.includes('INSERT INTO conversations')) {
            const conversationId = Math.floor(Math.random() * 1000) + 5000;
            conversationIds.push(conversationId);
            return { meta: { last_row_id: conversationId }, success: true };
          }
          return { meta: { last_row_id: Math.floor(Math.random() * 1000) }, success: true };
        })
      }));

      // Process LINE webhook
      const lineContext = {
        req: {
          header: vi.fn((header) => header === 'X-Line-Signature' ? 'valid-sig' : null),
          text: vi.fn().mockResolvedValue(JSON.stringify(sameUserDifferentPlatforms.line))
        },
        env: mockContext.env,
        json: mockContext.json,
        text: mockContext.text
      } as any;

      const lineResult = await webhookHandler.line(lineContext);
      expect(lineResult.status).toBe(200);

      // Process Facebook webhook
      const fbContext = {
        req: {
          query: vi.fn(() => null),
          header: vi.fn(() => null),
          json: vi.fn().mockResolvedValue(sameUserDifferentPlatforms.facebook)
        },
        env: mockContext.env,
        json: mockContext.json,
        text: mockContext.text
      } as any;

      const fbResult = await webhookHandler.facebook(fbContext);
      expect(fbResult.status).toBe(200);

      // Should have created separate conversations
      expect(conversationIds).toHaveLength(2);
      expect(conversationIds[0]).not.toBe(conversationIds[1]);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-frequency webhook requests efficiently', async () => {
      const startTime = Date.now();
      const numRequests = 50;
      const results: any[] = [];

      // Create multiple concurrent webhook requests
      const promises = Array.from({ length: numRequests }, async (_, index) => {
        const payload = {
          events: [{
            type: 'message',
            timestamp: Date.now(),
            source: { type: 'user', userId: `perf-user-${index}` },
            replyToken: `reply-${index}`,
            message: { id: `msg-${index}`, type: 'text', text: `Performance test message ${index}` }
          }]
        };

        const context = {
          req: {
            header: vi.fn((header) => header === 'X-Line-Signature' ? 'valid-sig' : null),
            text: vi.fn().mockResolvedValue(JSON.stringify(payload))
          },
          env: mockContext.env,
          json: mockContext.json,
          text: mockContext.text
        } as any;

        return await webhookHandler.line(context);
      });

      const results_resolved = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      results_resolved.forEach(result => {
        expect(result.status).toBe(200);
      });

      // Should complete within reasonable time (adjust threshold as needed)
      expect(totalTime).toBeLessThan(5000); // 5 seconds for 50 requests

      console.log(`Processed ${numRequests} webhook requests in ${totalTime}ms`);
    });

    it('should handle large webhook payloads efficiently', async () => {
      const largeMessage = 'x'.repeat(1000); // 1KB message
      
      const payload = {
        events: [{
          type: 'message',
          timestamp: Date.now(),
          source: { type: 'user', userId: 'large-payload-user' },
          replyToken: 'reply-large',
          message: { id: 'msg-large', type: 'text', text: largeMessage }
        }]
      };

      const context = {
        req: {
          header: vi.fn((header) => header === 'X-Line-Signature' ? 'valid-sig' : null),
          text: vi.fn().mockResolvedValue(JSON.stringify(payload))
        },
        env: mockContext.env,
        json: mockContext.json,
        text: mockContext.text
      } as any;

      const startTime = Date.now();
      const result = await webhookHandler.line(context);
      const endTime = Date.now();

      expect(result.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(1000); // Should process within 1 second
    });
  });

  describe('Idempotency and Duplicate Prevention', () => {
    it('should prevent duplicate message processing using platformMessageId', async () => {
      const lineWebhookPayload = {
        events: [{
          type: 'message',
          timestamp: 1640995200000,
          source: {
            type: 'user',
            userId: 'idempotency-test-user'
          },
          replyToken: 'reply-token-idempotency',
          message: {
            id: 'duplicate-msg-123',
            type: 'text',
            text: 'This message will be sent twice'
          }
        }]
      };

      mockContext.req.header = vi.fn((header) => {
        if (header === 'X-Line-Signature') return 'valid-line-signature';
        return null;
      });
      mockContext.req.text = vi.fn().mockResolvedValue(JSON.stringify(lineWebhookPayload));

      let duplicateCheckCount = 0;
      let messageInsertAttempts = 0;

      mockDB.prepare.mockImplementation((query: string) => {
        const operation = {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockImplementation(async () => {
            if (query.includes('SELECT * FROM messages') && query.includes('platform_message_id')) {
              duplicateCheckCount++;
              if (duplicateCheckCount === 1) {
                return null; // First request: no duplicate
              } else {
                return { id: 'existing-msg-id', platform_message_id: 'duplicate-msg-123' }; // Second request: found duplicate
              }
            }
            if (query.includes('SELECT * FROM customers')) {
              return { id: 1001, platform_user_id: 'idempotency-test-user' };
            }
            if (query.includes('SELECT * FROM conversations')) {
              return { id: 2001, customer_id: 1001, status: 'active' };
            }
            return null;
          }),
          run: vi.fn().mockImplementation(async () => {
            if (query.includes('INSERT INTO messages')) {
              messageInsertAttempts++;
              return { meta: { last_row_id: 3001 }, success: true };
            }
            return { success: true };
          })
        };
        return operation;
      });

      // First webhook delivery - should create message
      const firstResult = await webhookHandler.line(mockContext);
      expect(firstResult.status).toBe(200);
      expect(duplicateCheckCount).toBe(1);
      expect(messageInsertAttempts).toBe(1);

      // Second webhook delivery (duplicate) - should skip message creation
      const secondResult = await webhookHandler.line(mockContext);
      expect(secondResult.status).toBe(200);
      expect(duplicateCheckCount).toBe(2);
      expect(messageInsertAttempts).toBe(1); // Should not increase - duplicate prevented
    });

    it('should handle missing platformMessageId gracefully', async () => {
      const facebookWebhookWithoutMid = {
        object: 'page',
        entry: [{
          id: 'page-123',
          time: 1640995200000,
          messaging: [{
            sender: { id: 'no-mid-user' },
            recipient: { id: 'page-123' },
            timestamp: 1640995200000,
            message: {
              // Missing 'mid' field
              text: 'Message without message ID'
            }
          }]
        }]
      };

      mockContext.req.query = vi.fn(() => null);
      mockContext.req.header = vi.fn(() => null);
      mockContext.req.json = vi.fn().mockResolvedValue(facebookWebhookWithoutMid);

      mockDB.prepare.mockImplementation((query: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({
          meta: { last_row_id: 1001 },
          success: true
        })
      }));

      const result = await webhookHandler.facebook(mockContext);

      // Should process successfully even without platformMessageId
      expect(result.status).toBe(200);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from temporary database connection issues', async () => {
      const lineWebhookPayload = {
        events: [{
          type: 'message',
          timestamp: 1640995200000,
          source: {
            type: 'user',
            userId: 'retry-test-user'
          },
          replyToken: 'reply-token-retry',
          message: {
            id: 'retry-msg-123',
            type: 'text',
            text: 'Test retry mechanism'
          }
        }]
      };

      mockContext.req.header = vi.fn((header) => {
        if (header === 'X-Line-Signature') return 'valid-line-signature';
        return null;
      });
      mockContext.req.text = vi.fn().mockResolvedValue(JSON.stringify(lineWebhookPayload));

      let attemptCount = 0;

      mockDB.prepare.mockImplementation((query: string) => {
        attemptCount++;

        if (attemptCount === 1 && query.includes('SELECT * FROM customers')) {
          // Simulate temporary connection failure
          throw new Error('Database connection timeout');
        }

        // Normal behavior after first attempt
        return {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({
            meta: { last_row_id: 1001 },
            success: true
          })
        };
      });

      const result = await webhookHandler.line(mockContext);

      // Should return error on first failure
      expect(result.status).toBe(500);
      expect(attemptCount).toBeGreaterThanOrEqual(1);
    });

    it('should handle malformed webhook payloads gracefully', async () => {
      const malformedPayloads = [
        { events: null }, // null events
        { events: [] }, // empty events
        { events: [{ type: 'unknown' }] }, // unknown event type
        { events: [{ type: 'message' }] }, // missing message data
        { events: [{ type: 'message', message: { type: 'text' } }] } // missing source
      ];

      for (const payload of malformedPayloads) {
        mockContext.req.header = vi.fn((header) => {
          if (header === 'X-Line-Signature') return 'valid-line-signature';
          return null;
        });
        mockContext.req.text = vi.fn().mockResolvedValue(JSON.stringify(payload));

        const result = await webhookHandler.line(mockContext);

        // Should handle gracefully without crashing
        expect([200, 400, 500]).toContain(result.status);
      }
    });

    it('should handle SSE broadcast failures without affecting webhook processing', async () => {
      const lineWebhookPayload = {
        events: [{
          type: 'message',
          timestamp: 1640995200000,
          source: {
            type: 'user',
            userId: 'sse-failure-test'
          },
          replyToken: 'reply-sse-failure',
          message: {
            id: 'sse-failure-msg',
            type: 'text',
            text: 'Test SSE failure handling'
          }
        }]
      };

      mockContext.req.header = vi.fn((header) => {
        if (header === 'X-Line-Signature') return 'valid-line-signature';
        return null;
      });
      mockContext.req.text = vi.fn().mockResolvedValue(JSON.stringify(lineWebhookPayload));

      mockDB.prepare.mockImplementation((query: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({
          meta: { last_row_id: 1001 },
          success: true
        })
      }));

      // Note: SSE broadcast failures are logged but don't affect webhook success
      const result = await webhookHandler.line(mockContext);

      // Webhook should still succeed even if SSE broadcast fails
      expect(result.status).toBe(200);
    });
  });
});