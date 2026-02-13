// Session 邊界檢測測試
// Session boundary detection tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionService } from '@modules/session/services/session-service';
import {
  createMockSession,
  createBoundaryDetectionScenarios,
  validateSessionData
} from '../../helpers/session-test-helpers';
import {
  mockBoundaryScenarios,
  mockSessions
} from '../../helpers/mock-data';
import type {
  ConversationSession,
  SessionBoundaryDetection
} from '@modules/session/types/session-types';

// ======================== Mock Setup ========================

// Mock D1 Database
const mockDatabase = {
  prepare: vi.fn(),
  dump: vi.fn(),
  batch: vi.fn(),
  exec: vi.fn()
} as unknown as D1Database;

describe('Session Boundary Detection', () => {
  let sessionService: SessionService;
  let mockDb: any;

  // Freeze time to prevent Date.now() drift between session creation
  // and boundary detection (causes flaky failures in full suite runs)
  const frozenNow = Date.now();

  beforeEach(() => {
    vi.useFakeTimers({ now: frozenNow });
    // Setup mock database responses
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn(),
      all: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnValue([])
    };

    // Mock drizzle function
    vi.doMock('drizzle-orm/d1', () => ({
      drizzle: () => mockDb
    }));

    sessionService = new SessionService(mockDatabase);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ======================== 基礎邊界檢測測試 ========================

  describe('Basic Boundary Detection', () => {
    test('should create new session when no current session exists', async () => {
      const detection = await sessionService.detectSessionBoundary(
        null,
        'Hello, I need help',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(true);
      expect(detection.reason).toBe('first_session');
      expect(detection.confidence).toBe(1.0);
    });

    test('should continue session for normal message flow', async () => {
      const currentSession = createMockSession({
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        messageCount: 10,
        isActive: true
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        'Thanks for your help',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(false);
      expect(detection.reason).toBe('manual');
      expect(detection.confidence).toBeLessThanOrEqual(0.2);
    });
  });

  // ======================== 時間間隔檢測測試 ========================

  describe('Time Gap Detection', () => {
    test('should detect time gap and create new session', async () => {
      const currentSession = createMockSession({
        lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        isActive: true
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        'Hi, I have a new question',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(true);
      expect(detection.reason).toBe('time_gap');
      expect(detection.confidence).toBe(0.9);
      expect(detection.metadata?.timeDiffMinutes).toBeGreaterThan(30);
    });

    test('should not create new session for short time gap', async () => {
      const currentSession = createMockSession({
        lastActivity: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
        isActive: true
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        'One more question',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(false);
      expect(detection.reason).toBe('manual');
    });

    test('should handle edge case time boundaries', async () => {
      // Exactly at threshold (30 minutes)
      const currentSession = createMockSession({
        lastActivity: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        isActive: true
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        'Is this a new session?',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(false); // Should be <= threshold
    });

    test('should handle different time zones', async () => {
      const currentSession = createMockSession({
        lastActivity: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        isActive: true
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        'Hello from different timezone',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(true);
      expect(detection.reason).toBe('time_gap');
    });
  });

  // ======================== 訊息數量限制檢測測試 ========================

  describe('Message Limit Detection', () => {
    test('should create new session when message limit reached', async () => {
      const currentSession = createMockSession({
        messageCount: 50, // At default limit
        isActive: true,
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        'This should create a new session',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(true);
      expect(detection.reason).toBe('message_limit');
      expect(detection.confidence).toBe(0.8);
      expect(detection.metadata?.currentMessageCount).toBe(50);
    });

    test('should not create new session when below message limit', async () => {
      const currentSession = createMockSession({
        messageCount: 25,
        isActive: true,
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        'Still within limits',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(false);
    });

    test('should handle message limit edge cases', async () => {
      const currentSession = createMockSession({
        messageCount: 49, // Just below limit
        isActive: true,
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        'One more message',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(false);
    });
  });

  // ======================== 會話持續時間檢測測試 ========================

  describe('Session Duration Detection', () => {
    test('should create new session when duration limit exceeded', async () => {
      const currentSession = createMockSession({
        startTime: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        isActive: true
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        'This session has been going too long',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(true);
      expect(detection.reason).toBe('duration_limit');
      expect(detection.confidence).toBe(0.7);
      expect(detection.metadata?.sessionDurationHours).toBeGreaterThan(24);
    });

    test('should not create new session within duration limit', async () => {
      const currentSession = createMockSession({
        startTime: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        isActive: true
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        'Still within duration limit',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(false);
    });

    test('should handle exactly at duration limit', async () => {
      const currentSession = createMockSession({
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Exactly 24 hours
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        isActive: true
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        'At the duration boundary',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(false); // Should be <= limit
    });
  });

  // ======================== 主題變化檢測測試 ========================

  describe('Topic Change Detection', () => {
    test('should detect topic change with keywords', async () => {
      const currentSession = createMockSession({
        topic: 'Product Inquiry',
        isActive: true,
        messageCount: 10,
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        '另外，我想問一下關於帳單的問題',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(true);
      expect(detection.reason).toBe('topic_change');
      expect(detection.confidence).toBe(0.6);
      expect(detection.suggestedTopic).toBeDefined();
      expect(detection.metadata?.detectedKeywords).toBeInstanceOf(Array);
    });

    test('should detect English topic change keywords', async () => {
      const currentSession = createMockSession({
        topic: 'Technical Support',
        isActive: true,
        messageCount: 5,
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        'By the way, I have another question about billing',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(true);
      expect(detection.reason).toBe('topic_change');
      expect(detection.metadata?.detectedKeywords).toContain('by the way');
    });

    test('should not trigger topic change for agent messages', async () => {
      const currentSession = createMockSession({
        topic: 'General Inquiry',
        isActive: true,
        messageCount: 10,
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        '另外，我們還有其他產品可以推薦',
        'agent' // Agent message
      );

      expect(detection.shouldCreateNew).toBe(false);
      expect(detection.reason).toBe('manual');
    });

    test('should handle multiple topic change indicators', async () => {
      const currentSession = createMockSession({
        topic: 'Account Setup',
        isActive: true,
        messageCount: 15,
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        '另外，還有一個新問題，換個話題',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(true);
      expect(detection.reason).toBe('topic_change');
      expect(detection.metadata?.detectedKeywords?.length).toBeGreaterThan(1);
    });
  });

  // ======================== 主題提取測試 ========================

  describe('Topic Extraction', () => {
    test('should extract product inquiry topic', async () => {
      const topic = await sessionService.extractTopic('我想了解你們的產品功能');
      expect(topic).toBe('產品諮詢');
    });

    test('should extract technical support topic', async () => {
      const topic = await sessionService.extractTopic('系統出現錯誤無法登入');
      expect(topic).toBe('技術支援');
    });

    test('should extract order inquiry topic', async () => {
      const topic = await sessionService.extractTopic('我的訂單什麼時候配送');
      expect(topic).toBe('訂單查詢');
    });

    test('should extract account management topic', async () => {
      const topic = await sessionService.extractTopic('我忘記密碼了');
      expect(topic).toBe('帳戶問題');
    });

    test('should extract complaint topic', async () => {
      const topic = await sessionService.extractTopic('我要投訴你們的服務');
      expect(topic).toBe('投訴建議');
    });

    test('should extract general inquiry topic', async () => {
      const topic = await sessionService.extractTopic('你好，請問營業時間');
      expect(topic).toBe('一般諮詢');
    });

    test('should handle English content', async () => {
      const topic = await sessionService.extractTopic('I have an issue with login');
      expect(topic).toBe('技術支援');
    });

    test('should return null for unrecognized content', async () => {
      const topic = await sessionService.extractTopic('xyz random content 123');
      expect(topic).toBe(null);
    });

    test('should handle empty or whitespace content', async () => {
      expect(await sessionService.extractTopic('')).toBe(null);
      expect(await sessionService.extractTopic('   ')).toBe(null);
    });
  });

  // ======================== 複雜場景測試 ========================

  describe('Complex Boundary Scenarios', () => {
    test('should handle multiple boundary conditions simultaneously', async () => {
      // Session that meets both time gap and message limit
      const currentSession = createMockSession({
        lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        messageCount: 50, // At limit
        isActive: true
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        'Hello again',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(true);
      // Should pick the highest confidence reason (time_gap)
      expect(detection.reason).toBe('time_gap');
      expect(detection.confidence).toBe(0.9);
    });

    test('should prioritize different boundary conditions correctly', async () => {
      // Session with multiple issues, but topic change should have lower priority
      const currentSession = createMockSession({
        lastActivity: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutes ago
        messageCount: 45,
        isActive: true,
        topic: 'Product Inquiry'
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        '另外，我想問帳單問題', // Topic change
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(true);
      expect(detection.reason).toBe('time_gap'); // Time gap should take priority
    });

    test('should handle inactive session edge case', async () => {
      const currentSession = createMockSession({
        isActive: false,
        lastActivity: new Date(Date.now() - 10 * 60 * 1000).toISOString()
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        'New message to inactive session',
        'customer'
      );

      // Even though session is inactive, the detection logic should still work
      expect(detection.shouldCreateNew).toBe(false); // Within time and message limits
    });

    test('should handle system messages differently', async () => {
      const currentSession = createMockSession({
        lastActivity: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        isActive: true
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        'System notification: User has been idle',
        'system'
      );

      // System messages shouldn't trigger topic change
      expect(detection.shouldCreateNew).toBe(true);
      expect(detection.reason).toBe('time_gap'); // Should still respect time gap
    });
  });

  // ======================== 邊界檢測配置測試 ========================

  describe('Boundary Detection Configuration', () => {
    test('should use custom configuration', async () => {
      // Create service with custom config
      const customConfig = {
        timeGapThreshold: 60, // 60 minutes instead of default 30
        maxMessagesPerSession: 25, // Lower limit
        maxSessionDuration: 12 // 12 hours
      };

      const customService = new SessionService(mockDatabase, customConfig);

      const currentSession = createMockSession({
        lastActivity: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutes
        messageCount: 20,
        isActive: true
      });

      const detection = await customService.detectSessionBoundary(
        currentSession,
        'Test message',
        'customer'
      );

      // Should not create new session with custom 60-minute threshold
      expect(detection.shouldCreateNew).toBe(false);
    });

    test('should respect disabled topic detection', async () => {
      const customConfig = {
        enableTopicDetection: false
      };

      const customService = new SessionService(mockDatabase, customConfig);

      const currentSession = createMockSession({
        topic: 'Product Inquiry',
        isActive: true,
        messageCount: 10,
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      });

      const detection = await customService.detectSessionBoundary(
        currentSession,
        '另外，我想問帳單問題', // Should normally trigger topic change
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(false);
      expect(detection.reason).not.toBe('topic_change');
    });
  });

  // ======================== 效能和邊界測試 ========================

  describe('Performance and Edge Cases', () => {
    test('should handle very long message content', async () => {
      const longMessage = 'A'.repeat(10000); // Very long message

      const currentSession = createMockSession({
        isActive: true,
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        longMessage,
        'customer'
      );

      expect(detection).toBeDefined();
      expect(typeof detection.shouldCreateNew).toBe('boolean');
    });

    test('should handle special characters and unicode', async () => {
      const unicodeMessage = '你好 🌟 ñáéíóú 中文测试 emoji 😊';

      const currentSession = createMockSession({
        isActive: true,
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      });

      const detection = await sessionService.detectSessionBoundary(
        currentSession,
        unicodeMessage,
        'customer'
      );

      expect(detection).toBeDefined();
    });

    test('should handle concurrent boundary detection calls', async () => {
      const currentSession = createMockSession({
        isActive: true,
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      });

      // Simulate concurrent calls
      const promises = Array.from({ length: 5 }, () =>
        sessionService.detectSessionBoundary(
          currentSession,
          'Concurrent test message',
          'customer'
        )
      );

      const results = await Promise.all(promises);

      // All results should be consistent
      results.forEach((result, index) => {
        expect(result.shouldCreateNew).toBe(results[0].shouldCreateNew);
        expect(result.reason).toBe(results[0].reason);
      });
    });

    test('should handle malformed session data gracefully', async () => {
      const malformedSession = {
        ...createMockSession(),
        lastActivity: 'invalid-date',
        startTime: 'also-invalid'
      } as any;

      const detection = await sessionService.detectSessionBoundary(
        malformedSession,
        'Test message',
        'customer'
      );

      expect(detection).toBeDefined();
      expect(typeof detection.shouldCreateNew).toBe('boolean');
    });
  });
});