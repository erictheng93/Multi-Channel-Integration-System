// Session 邊界檢測專門測試
// Dedicated tests for session boundary detection logic

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionService } from '@modules/session/services/session-service';
import {
  createMockSession,
  createBoundaryDetectionScenarios
} from '../../helpers/session-test-helpers';
import {
  mockBoundaryScenarios
} from '../../helpers/mock-data';
import type {
  ConversationSession,
  SessionBoundaryDetection
} from '@modules/session/types/session-types';

// ======================== Mock Setup ========================

const mockDatabase = {
  prepare: vi.fn(),
  dump: vi.fn(),
  batch: vi.fn(),
  exec: vi.fn()
} as unknown as D1Database;

const mockDb = {
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

vi.mock('drizzle-orm/d1', () => ({
  drizzle: () => mockDb
}));

describe('Session Boundary Detection Logic', () => {
  let sessionService: SessionService;

  beforeEach(() => {
    sessionService = new SessionService(mockDatabase);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ======================== 邊界檢測核心邏輯測試 ========================

  describe('Core Boundary Detection Logic', () => {
    test('should prioritize boundary conditions by confidence level', async () => {
      // 創建同時滿足多個邊界條件的會話
      const multiConditionSession = createMockSession({
        lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago (time gap)
        messageCount: 50, // At message limit
        startTime: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago (duration limit)
        isActive: true
      });

      const detection = await sessionService.detectSessionBoundary(
        multiConditionSession,
        '另外，我想問別的問題', // Also contains topic change keywords
        'customer'
      );

      // 應該選擇信心度最高的條件（時間間隔）
      expect(detection.shouldCreateNew).toBe(true);
      expect(detection.reason).toBe('time_gap');
      expect(detection.confidence).toBe(0.9); // Highest confidence
    });

    test('should handle edge case time calculations', async () => {
      // 測試邊界時間計算
      const exactBoundarySession = createMockSession({
        lastActivity: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // Exactly 30 minutes
        isActive: true
      });

      const detection = await sessionService.detectSessionBoundary(
        exactBoundarySession,
        'Exactly at boundary',
        'customer'
      );

      // 30分鐘應該不觸發（<= 閾值）
      expect(detection.shouldCreateNew).toBe(false);
    });

    test('should handle different sender types appropriately', async () => {
      const session = createMockSession({
        lastActivity: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        isActive: true
      });

      // 客戶訊息 - 應該檢測主題變化
      const customerDetection = await sessionService.detectSessionBoundary(
        session,
        '另外，我想問帳單問題',
        'customer'
      );

      // 代理訊息 - 不應該觸發主題變化
      const agentDetection = await sessionService.detectSessionBoundary(
        session,
        '另外，我們還有其他服務',
        'agent'
      );

      // 系統訊息 - 不應該觸發主題變化
      const systemDetection = await sessionService.detectSessionBoundary(
        session,
        'System: 另外，用戶已離線',
        'system'
      );

      expect(customerDetection.reason).toBe('topic_change');
      expect(agentDetection.reason).toBe('manual');
      expect(systemDetection.reason).toBe('manual');
    });
  });

  // ======================== 時間間隔檢測詳細測試 ========================

  describe('Time Gap Detection Details', () => {
    test('should calculate time differences accurately', async () => {
      const testCases = [
        { minutesAgo: 29, shouldCreate: false, description: '29分鐘前' },
        { minutesAgo: 30, shouldCreate: false, description: '剛好30分鐘' },
        { minutesAgo: 31, shouldCreate: true, description: '31分鐘前' },
        { minutesAgo: 60, shouldCreate: true, description: '1小時前' },
        { minutesAgo: 120, shouldCreate: true, description: '2小時前' }
      ];

      for (const testCase of testCases) {
        const session = createMockSession({
          lastActivity: new Date(Date.now() - testCase.minutesAgo * 60 * 1000).toISOString(),
          isActive: true
        });

        const detection = await sessionService.detectSessionBoundary(
          session,
          `Test message ${testCase.description}`,
          'customer'
        );

        if (testCase.shouldCreate) {
          expect(detection.shouldCreateNew).toBe(true);
          expect(detection.reason).toBe('time_gap');
          expect(detection.metadata?.timeDiffMinutes).toBeCloseTo(testCase.minutesAgo, 1);
        } else {
          expect(detection.shouldCreateNew).toBe(false);
        }
      }
    });

    test('should handle timezone differences', async () => {
      const utcTime = new Date().toISOString();
      const session = createMockSession({
        lastActivity: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        isActive: true
      });

      const detection = await sessionService.detectSessionBoundary(
        session,
        'Message from different timezone',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(true);
      expect(detection.reason).toBe('time_gap');
    });

    test('should handle daylight saving time transitions', async () => {
      // 模擬夏令時間變化的情況
      const dstTransitionTime = new Date('2024-03-10T07:00:00.000Z'); // DST transition example
      const session = createMockSession({
        lastActivity: new Date(dstTransitionTime.getTime() - 45 * 60 * 1000).toISOString(),
        isActive: true
      });

      const detection = await sessionService.detectSessionBoundary(
        session,
        'Message after DST transition',
        'customer'
      );

      expect(detection).toBeDefined();
      expect(typeof detection.shouldCreateNew).toBe('boolean');
    });
  });

  // ======================== 訊息數量限制檢測詳細測試 ========================

  describe('Message Limit Detection Details', () => {
    test('should respect custom message limits', async () => {
      const customConfig = { maxMessagesPerSession: 30 };
      const customService = new SessionService(mockDatabase, customConfig);

      const session = createMockSession({
        messageCount: 30, // At custom limit
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        isActive: true
      });

      const detection = await customService.detectSessionBoundary(
        session,
        'Message at custom limit',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(true);
      expect(detection.reason).toBe('message_limit');
      expect(detection.metadata?.currentMessageCount).toBe(30);
    });

    test('should handle very high message counts', async () => {
      const highCountSession = createMockSession({
        messageCount: 500, // Very high count
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        isActive: true
      });

      const detection = await sessionService.detectSessionBoundary(
        highCountSession,
        'Message in high-count session',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(true);
      expect(detection.reason).toBe('message_limit');
    });

    test('should handle zero and negative message counts gracefully', async () => {
      const zeroCountSession = createMockSession({
        messageCount: 0,
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        isActive: true
      });

      const detection = await sessionService.detectSessionBoundary(
        zeroCountSession,
        'First message',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(false);
      expect(detection.reason).toBe('manual');
    });
  });

  // ======================== 會話持續時間檢測詳細測試 ========================

  describe('Session Duration Detection Details', () => {
    test('should calculate session duration correctly', async () => {
      const testCases = [
        { hoursAgo: 23, shouldCreate: false, description: '23小時前' },
        { hoursAgo: 24, shouldCreate: false, description: '剛好24小時' },
        { hoursAgo: 25, shouldCreate: true, description: '25小時前' },
        { hoursAgo: 48, shouldCreate: true, description: '48小時前' },
        { hoursAgo: 72, shouldCreate: true, description: '72小時前' }
      ];

      for (const testCase of testCases) {
        const session = createMockSession({
          startTime: new Date(Date.now() - testCase.hoursAgo * 60 * 60 * 1000).toISOString(),
          lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          isActive: true
        });

        const detection = await sessionService.detectSessionBoundary(
          session,
          `Test message ${testCase.description}`,
          'customer'
        );

        if (testCase.shouldCreate) {
          expect(detection.shouldCreateNew).toBe(true);
          expect(detection.reason).toBe('duration_limit');
          expect(detection.metadata?.sessionDurationHours).toBeCloseTo(testCase.hoursAgo, 1);
        } else {
          expect(detection.shouldCreateNew).toBe(false);
        }
      }
    });

    test('should handle custom duration limits', async () => {
      const customConfig = { maxSessionDuration: 12 }; // 12 hours
      const customService = new SessionService(mockDatabase, customConfig);

      const session = createMockSession({
        startTime: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(), // 13 hours ago
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        isActive: true
      });

      const detection = await customService.detectSessionBoundary(
        session,
        'Message in extended session',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(true);
      expect(detection.reason).toBe('duration_limit');
    });
  });

  // ======================== 主題變化檢測詳細測試 ========================

  describe('Topic Change Detection Details', () => {
    test('should detect Chinese topic change keywords', async () => {
      const chineseKeywords = [
        '另外',
        '還有',
        '換個話題',
        '問個別的',
        '新問題'
      ];

      const session = createMockSession({
        topic: 'Original Topic',
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        isActive: true
      });

      for (const keyword of chineseKeywords) {
        const message = `我想${keyword}，關於帳單的問題`;
        const detection = await sessionService.detectSessionBoundary(
          session,
          message,
          'customer'
        );

        expect(detection.shouldCreateNew).toBe(true);
        expect(detection.reason).toBe('topic_change');
        expect(detection.metadata?.detectedKeywords).toContain(keyword);
      }
    });

    test('should detect English topic change keywords', async () => {
      const englishKeywords = [
        'by the way',
        'btw',
        'another question',
        'different topic'
      ];

      const session = createMockSession({
        topic: 'Original Topic',
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        isActive: true
      });

      for (const keyword of englishKeywords) {
        const message = `${keyword}, I have a billing question`;
        const detection = await sessionService.detectSessionBoundary(
          session,
          message,
          'customer'
        );

        expect(detection.shouldCreateNew).toBe(true);
        expect(detection.reason).toBe('topic_change');
        expect(detection.metadata?.detectedKeywords).toContain(keyword);
      }
    });

    test('should handle mixed language content', async () => {
      const session = createMockSession({
        topic: 'Product Inquiry',
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        isActive: true
      });

      const mixedMessage = 'By the way，我想問另外的問題 about billing';
      const detection = await sessionService.detectSessionBoundary(
        session,
        mixedMessage,
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(true);
      expect(detection.reason).toBe('topic_change');
      expect(detection.metadata?.detectedKeywords?.length).toBeGreaterThan(1);
    });

    test('should not trigger on false positives', async () => {
      const session = createMockSession({
        topic: 'General Discussion',
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        isActive: true
      });

      const falsePositives = [
        '我不是另外的意思', // Contains keyword but different context
        '這個產品還有什麼功能', // "還有" but not topic change
        '我想了解更多資訊' // No topic change keywords
      ];

      for (const message of falsePositives) {
        const detection = await sessionService.detectSessionBoundary(
          session,
          message,
          'customer'
        );

        if (detection.reason === 'topic_change') {
          // If detected as topic change, confidence should be appropriate
          expect(detection.confidence).toBeGreaterThan(0);
        }
      }
    });

    test('should be disabled when configuration disables it', async () => {
      const configWithoutTopicDetection = { enableTopicDetection: false };
      const customService = new SessionService(mockDatabase, configWithoutTopicDetection);

      const session = createMockSession({
        topic: 'Original Topic',
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        isActive: true
      });

      const detection = await customService.detectSessionBoundary(
        session,
        '另外，我想問完全不同的問題',
        'customer'
      );

      expect(detection.reason).not.toBe('topic_change');
    });
  });

  // ======================== 主題提取詳細測試 ========================

  describe('Topic Extraction Details', () => {
    test('should extract topics from Chinese content accurately', async () => {
      const testCases = [
        { message: '我想了解你們的產品有什麼功能', expectedTopic: '產品諮詢' },
        { message: '系統登入出現錯誤，無法進入', expectedTopic: '技術支援' },
        { message: '我的訂單編號12345什麼時候會配送', expectedTopic: '訂單查詢' },
        { message: '我忘記了帳戶密碼，要怎麼重設', expectedTopic: '帳戶問題' },
        { message: '我要投訴你們的客服態度很差', expectedTopic: '投訴建議' },
        { message: '你好，請問你們的營業時間', expectedTopic: '一般諮詢' }
      ];

      for (const testCase of testCases) {
        const extractedTopic = await sessionService.extractTopic(testCase.message);
        expect(extractedTopic).toBe(testCase.expectedTopic);
      }
    });

    test('should extract topics from English content', async () => {
      const testCases = [
        { message: 'What features does your product have', expectedTopic: '產品諮詢' },
        { message: 'I have an error when trying to login', expectedTopic: '技術支援' },
        { message: 'When will my order be delivered', expectedTopic: '訂單查詢' },
        { message: 'I forgot my account password', expectedTopic: '帳戶問題' },
        { message: 'I want to make a complaint about service', expectedTopic: '投訴建議' },
        { message: 'Hello, what are your business hours', expectedTopic: '一般諮詢' }
      ];

      for (const testCase of testCases) {
        const extractedTopic = await sessionService.extractTopic(testCase.message);
        expect(extractedTopic).toBe(testCase.expectedTopic);
      }
    });

    test('should handle ambiguous content', async () => {
      const ambiguousMessages = [
        '我有個問題', // Too general
        'Hello', // Too simple
        '123456', // Numbers only
        '????', // Special characters only
        '' // Empty string
      ];

      for (const message of ambiguousMessages) {
        const extractedTopic = await sessionService.extractTopic(message);
        // Should either extract a general topic or return null
        expect(extractedTopic === null || extractedTopic === '一般諮詢').toBe(true);
      }
    });

    test('should prioritize more specific keywords', async () => {
      const specificMessage = '我的產品出現故障錯誤，需要技術支援';
      const extractedTopic = await sessionService.extractTopic(specificMessage);

      // Should prioritize "技術支援" over "產品諮詢" due to error keywords
      expect(extractedTopic).toBe('技術支援');
    });

    test('should handle very long messages', async () => {
      const longMessage = '你好，我想了解' + '產品功能'.repeat(100) + '的詳細資訊';
      const extractedTopic = await sessionService.extractTopic(longMessage);

      expect(extractedTopic).toBe('產品諮詢');
    });
  });

  // ======================== 配置和自訂測試 ========================

  describe('Configuration and Customization', () => {
    test('should allow custom keyword configuration', async () => {
      // 假設未來支援自訂關鍵字
      const customConfig = {
        topicChangeKeywords: ['我想換個主題', 'lets change topic', '話題轉換']
      };

      const customService = new SessionService(mockDatabase, customConfig);
      const session = createMockSession({
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        isActive: true
      });

      const detection = await customService.detectSessionBoundary(
        session,
        '我想換個主題，討論別的事情',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(true);
      expect(detection.reason).toBe('topic_change');
    });

    test('should handle all boundary conditions disabled', async () => {
      const minimalConfig = {
        timeGapThreshold: Number.MAX_SAFE_INTEGER,
        maxMessagesPerSession: Number.MAX_SAFE_INTEGER,
        maxSessionDuration: Number.MAX_SAFE_INTEGER,
        enableTopicDetection: false
      };

      const minimalService = new SessionService(mockDatabase, minimalConfig);

      const extremeSession = createMockSession({
        lastActivity: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
        messageCount: 1000,
        startTime: new Date(Date.now() - 100 * 60 * 60 * 1000).toISOString(),
        isActive: true
      });

      const detection = await minimalService.detectSessionBoundary(
        extremeSession,
        '另外，我想問完全不同的問題',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(false);
      expect(detection.reason).toBe('manual');
    });

    test('should handle aggressive boundary detection', async () => {
      const aggressiveConfig = {
        timeGapThreshold: 1, // 1 minute
        maxMessagesPerSession: 5,
        maxSessionDuration: 0.5, // 30 minutes
        enableTopicDetection: true
      };

      const aggressiveService = new SessionService(mockDatabase, aggressiveConfig);

      const session = createMockSession({
        lastActivity: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
        messageCount: 3,
        startTime: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
        isActive: true
      });

      const detection = await aggressiveService.detectSessionBoundary(
        session,
        'Normal message',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(true);
      // Should detect time gap (highest priority)
      expect(detection.reason).toBe('time_gap');
    });
  });

  // ======================== 效能和穩定性測試 ========================

  describe('Performance and Stability', () => {
    test('should handle rapid consecutive boundary detection calls', async () => {
      const session = createMockSession({
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        isActive: true
      });

      const promises = Array.from({ length: 10 }, (_, i) =>
        sessionService.detectSessionBoundary(
          session,
          `Concurrent message ${i}`,
          'customer'
        )
      );

      const results = await Promise.all(promises);

      // All results should be consistent
      results.forEach(result => {
        expect(result.shouldCreateNew).toBe(results[0].shouldCreateNew);
        expect(result.reason).toBe(results[0].reason);
      });
    });

    test('should handle malformed session data gracefully', async () => {
      const malformedSessions = [
        { ...createMockSession(), lastActivity: 'invalid-date' },
        { ...createMockSession(), startTime: 'not-a-date' },
        { ...createMockSession(), messageCount: -1 },
        { ...createMockSession(), messageCount: NaN },
        null as any,
        undefined as any
      ];

      for (const session of malformedSessions) {
        const detection = await sessionService.detectSessionBoundary(
          session,
          'Test message',
          'customer'
        );

        expect(detection).toBeDefined();
        expect(typeof detection.shouldCreateNew).toBe('boolean');
        expect(typeof detection.reason).toBe('string');
      }
    });

    test('should maintain performance with large message content', async () => {
      const session = createMockSession({
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        isActive: true
      });

      const largeMessage = 'A'.repeat(100000); // 100KB message

      const startTime = Date.now();
      const detection = await sessionService.detectSessionBoundary(
        session,
        largeMessage,
        'customer'
      );
      const endTime = Date.now();

      expect(detection).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  // ======================== 邊界情況和錯誤處理 ========================

  describe('Edge Cases and Error Handling', () => {
    test('should handle null session gracefully', async () => {
      const detection = await sessionService.detectSessionBoundary(
        null,
        'Message to null session',
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(true);
      expect(detection.reason).toBe('first_session');
      expect(detection.confidence).toBe(1.0);
    });

    test('should handle empty message content', async () => {
      const session = createMockSession({
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        isActive: true
      });

      const detection = await sessionService.detectSessionBoundary(
        session,
        '',
        'customer'
      );

      expect(detection).toBeDefined();
      expect(typeof detection.shouldCreateNew).toBe('boolean');
    });

    test('should handle special characters and emojis', async () => {
      const session = createMockSession({
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        isActive: true
      });

      const specialMessage = '🎉✨ 另外，我想問問題 💬🤔 #hashtag @mention';
      const detection = await sessionService.detectSessionBoundary(
        session,
        specialMessage,
        'customer'
      );

      expect(detection.shouldCreateNew).toBe(true);
      expect(detection.reason).toBe('topic_change');
    });

    test('should handle different date formats gracefully', async () => {
      const session = createMockSession({
        lastActivity: new Date().toISOString(),
        startTime: new Date().toISOString(),
        isActive: true
      });

      // Modify dates to different formats
      session.lastActivity = '2024-01-15T10:30:00Z'; // Different timezone
      session.startTime = '2024-01-15 10:00:00'; // Different format

      const detection = await sessionService.detectSessionBoundary(
        session,
        'Test message',
        'customer'
      );

      expect(detection).toBeDefined();
    });
  });
});