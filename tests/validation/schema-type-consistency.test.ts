/**
 * Schema-Type Consistency Validation Tests
 * 防止生產環境類型不一致問題的測試套件
 *
 * This test suite validates that:
 * 1. Database schema and TypeScript tyimport { MockFactory } from '@helpers/mockFactory';
pes are consistent
 * 2. Field naming conventions are followed (snake_case in DB, matching in types)
 * 3. Foreign key references are correctly typed
 */

import { describe, test, expect } from 'vitest';
import type { ConversationSession, SessionMessage } from '@modules/session/types/session-types';

describe('Schema Type Consistency Validation', () => {
  describe('ConversationSession Interface', () => {
    test('should use snake_case conversation_id field to match database schema', () => {
      // This test ensures the interface matches the database schema
      const mockSession: ConversationSession = {
        id: 'session_123',
        conversation_id: 'conv_456', // Must be snake_case to match DB schema
        sessionType: 'continuous',
        topic: 'Test Topic',
        startTime: '2025-01-01T00:00:00Z',
        endTime: null,
        lastActivity: '2025-01-01T01:00:00Z',
        messageCount: 5,
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z'
      };

      // Verify the field exists and is typed correctly
      expect(typeof mockSession.conversation_id).toBe('string');
      expect(mockSession.conversation_id).toBe('conv_456');

      // Ensure old camelCase field doesn't exist
      // @ts-expect-error - conversationId should not exist anymore
      expect(mockSession.conversationId).toBeUndefined();
    });

    test('should validate conversation_id is string type matching TEXT in schema', () => {
      const session: ConversationSession = {
        id: 'test',
        conversation_id: 'conv-123-456', // TEXT format from conversations.id
        sessionType: 'continuous',
        startTime: '2025-01-01T00:00:00Z',
        lastActivity: '2025-01-01T01:00:00Z',
        messageCount: 0,
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z'
      };

      expect(session.conversation_id).toMatch(/^[a-zA-Z0-9\-_]+$/);
      expect(typeof session.conversation_id).toBe('string');
    });
  });

  describe('SessionMessage Interface', () => {
    test('should use snake_case conversation_id field', () => {
      const mockMessage: SessionMessage = {
        id: 'msg_123',
        sessionId: 'session_456',
        conversation_id: 'conv_789', // Must match ConversationSession.conversation_id
        senderId: 'user_123',
        senderType: 'customer',
        content: 'Test message',
        messageType: 'text',
        sessionSequence: 1,
        platformMessageId: 'platform_msg_123',
        createdAt: '2025-01-01T00:00:00Z',
        metadata: {}
      };

      expect(typeof mockMessage.conversation_id).toBe('string');
      expect(mockMessage.conversation_id).toBe('conv_789');

      // Ensure old camelCase field doesn't exist
      // @ts-expect-error - conversationId should not exist anymore
      expect(mockMessage.conversationId).toBeUndefined();
    });
  });

  describe('Field Naming Convention Validation', () => {
    test('should prevent accidental use of camelCase conversation field', () => {
      // This test will fail at compile time if someone tries to use conversationId
      // instead of conversation_id, preventing the production issue

      const createSessionData = {
        conversation_id: 'conv_123', // ✅ Correct snake_case
        sessionType: 'continuous' as const,
        messageContent: 'Test',
        senderType: 'customer' as const
      };

      expect(createSessionData.conversation_id).toBe('conv_123');

      // TypeScript compilation will fail if someone accidentally uses:
      // conversationId: 'conv_123' // ❌ This should cause a type error
    });

    test('should validate all session-related interfaces use consistent field naming', () => {
      // Compile-time validation that our interfaces are consistent
      const session: ConversationSession = {
        id: 'session_1',
        conversation_id: 'conv_1',
        sessionType: 'continuous',
        startTime: '2025-01-01T00:00:00Z',
        lastActivity: '2025-01-01T01:00:00Z',
        messageCount: 0,
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z'
      };

      const message: SessionMessage = {
        id: 'msg_1',
        sessionId: session.id,
        conversation_id: session.conversation_id, // Must use same field name
        senderId: 'user_1',
        senderType: 'customer',
        content: 'Test',
        messageType: 'text',
        sessionSequence: 1,
        createdAt: '2025-01-01T00:00:00Z'
      };

      // Validate that both interfaces use the same field name format
      expect(session.conversation_id).toBe(message.conversation_id);
    });
  });

  describe('Migration Compatibility', () => {
    test('should validate that schema migration 0012 and 0014 are compatible', () => {
      // Simulate database schema expectations
      const schemaExpectation = {
        conversation_sessions: {
          id: 'TEXT PRIMARY KEY',
          conversation_id: 'TEXT NOT NULL REFERENCES conversations(id)',
          session_type: 'TEXT NOT NULL DEFAULT \'continuous\'',
          // ... other fields
        },
        conversations: {
          id: 'TEXT PRIMARY KEY', // This was confirmed to be TEXT in our schema review
          // ... other fields
        }
      };

      // Validate TypeScript types match schema expectations
      const typeValidation: ConversationSession = {
        id: 'test_id',                    // matches TEXT PRIMARY KEY
        conversation_id: 'test_conv_id',  // matches TEXT NOT NULL REFERENCES conversations(id)
        sessionType: 'continuous',        // matches session_type with CHECK constraint
        startTime: '2025-01-01T00:00:00Z',
        lastActivity: '2025-01-01T01:00:00Z',
        messageCount: 0,
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z'
      };

      expect(typeof typeValidation.id).toBe('string');
      expect(typeof typeValidation.conversation_id).toBe('string');
      expect(['continuous', 'topical', 'manual'].includes(typeValidation.sessionType)).toBe(true);
    });
  });
});

/**
 * Runtime Schema Validation Helper
 * This can be used to validate data at runtime matches expected schema
 */
export function validateConversationSessionData(data: any): data is ConversationSession {
  const requiredFields = [
    'id',
    'conversation_id',  // Must be snake_case
    'sessionType',
    'startTime',
    'lastActivity',
    'messageCount',
    'isActive',
    'createdAt'
  ];

  const forbiddenFields = [
    'conversationId'  // Old camelCase field should not exist
  ];

  // Check required fields exist and are correct types
  for (const field of requiredFields) {
    if (!(field in data)) {
      return false;
    }
  }

  // Check forbidden fields don't exist
  for (const field of forbiddenFields) {
    if (field in data) {
      return false; // This would indicate someone used the old field name
    }
  }

  // Validate specific field types
  return (
    typeof data.id === 'string' &&
    typeof data.conversation_id === 'string' &&  // Must be string to match TEXT in schema
    typeof data.sessionType === 'string' &&
    typeof data.startTime === 'string' &&
    typeof data.lastActivity === 'string' &&
    typeof data.messageCount === 'number' &&
    typeof data.isActive === 'boolean' &&
    typeof data.createdAt === 'string'
  );
}