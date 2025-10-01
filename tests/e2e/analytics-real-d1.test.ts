// Analytics E2E Tests with Real D1 Database
// 真實 D1 數據庫端到端測試

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { unstable_dev, UnstableDevWorker } from 'wrangler';
import type {
  ConversationAnalyticsQuery,
  MessageAnalyticsQuery,
  UserAnalyticsQuery,
  PerformanceAnalyticsQuery
} from '../../src/modules/analytics/types/analytics-types';

/**
 * 生成測試 JWT Token
 * 用於繞過身份驗證進行 E2E 測試
 */
function generateTestJWTToken(): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    userId: '1',
    email: 'test@example.com',
    displayName: 'Test Admin',
    role: 'admin',
    teamId: '1',
    teamName: 'Test Team',
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    iat: Math.floor(Date.now() / 1000)
  };

  // 簡單的 base64 編碼（測試用途）
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const signature = 'test-signature'; // 測試簽名

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * E2E 測試配置
 * 使用 Wrangler unstable_dev API 連接真實 D1 數據庫
 */
describe('Analytics E2E Tests - Real D1 Database', () => {
  let worker: UnstableDevWorker;
  let baseUrl: string;

  beforeAll(async () => {
    console.log('🚀 Starting Wrangler dev server for E2E tests...');

    try {
      // 啟動 Wrangler dev server with local D1
      worker = await unstable_dev('src/index.ts', {
        experimental: {
          disableExperimentalWarning: true
        },
        local: true, // Use local D1 database
        persist: true, // Enable persistence for local D1
        config: 'wrangler.toml'
      });

      baseUrl = `http://localhost:${worker.port}`;
      console.log(`✅ Wrangler dev server started at ${baseUrl}`);

      // Wait for server to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error('❌ Failed to start Wrangler dev server:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (worker) {
      console.log('🛑 Stopping Wrangler dev server...');
      await worker.stop();
      console.log('✅ Wrangler dev server stopped');
    }
  });

  // ======================== Health Check Tests ========================

  describe('Health Check', () => {
    it('should access analytics health endpoint', async () => {
      try {
        const response = await fetch(`${baseUrl}/api/analytics/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        console.log('Health check status:', response.status);

        expect(response.ok).toBe(true);

        const data = await response.json();
        console.log('Health check data:', data);

        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('status');
        expect(data.status).toBe('healthy');
        expect(data.services).toHaveProperty('database');
        expect(data.services.database).toBe('healthy');
      } catch (error) {
        console.error('Health check failed:', error);
        throw error;
      }
    });
  });

  // ======================== Conversation Analytics Tests ========================

  describe('Conversation Analytics - Real D1', () => {
    it('should fetch conversation analytics with real database', async () => {
      try {
        const query = new URLSearchParams({
          timeRange: '7d',
          metrics: 'total_conversations,active_conversations'
        });

        const response = await fetch(
          `${baseUrl}/api/analytics/conversations?${query}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-token' // Mock auth for testing
            }
          }
        );

        console.log('Conversation analytics status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error response:', errorText);
        }

        const data = await response.json();
        console.log('Conversation analytics data:', JSON.stringify(data, null, 2));

        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('summary');
        expect(data.data).toHaveProperty('metadata');

      } catch (error) {
        console.error('Conversation analytics test failed:', error);
        throw error;
      }
    });

    it('should support platform filtering with real database', async () => {
      try {
        const query = new URLSearchParams({
          timeRange: '7d',
          metrics: 'total_conversations',
          platform: 'line'
        });

        const response = await fetch(
          `${baseUrl}/api/analytics/conversations?${query}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-token'
            }
          }
        );

        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();

      } catch (error) {
        console.error('Platform filtering test failed:', error);
        throw error;
      }
    });

    it('should support time range filtering', async () => {
      try {
        const query = new URLSearchParams({
          timeRange: '24h',
          metrics: 'total_conversations'
        });

        const response = await fetch(
          `${baseUrl}/api/analytics/conversations?${query}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-token'
            }
          }
        );

        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data.success).toBe(true);

      } catch (error) {
        console.error('Time range filtering test failed:', error);
        throw error;
      }
    });
  });

  // ======================== Message Analytics Tests ========================

  describe('Message Analytics - Real D1', () => {
    it('should fetch message analytics with real database', async () => {
      try {
        const query = new URLSearchParams({
          timeRange: '7d',
          metrics: 'total_messages,messages_per_hour'
        });

        const response = await fetch(
          `${baseUrl}/api/analytics/messages?${query}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-token'
            }
          }
        );

        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('summary');
        expect(data.data).toHaveProperty('volume');

      } catch (error) {
        console.error('Message analytics test failed:', error);
        throw error;
      }
    });

    it('should calculate message volume trends', async () => {
      try {
        const query = new URLSearchParams({
          timeRange: '7d',
          metrics: 'total_messages'
        });

        const response = await fetch(
          `${baseUrl}/api/analytics/messages?${query}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-token'
            }
          }
        );

        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data.data).toHaveProperty('volume');
        expect(typeof data.data.volume).toBe('object');

      } catch (error) {
        console.error('Message volume trends test failed:', error);
        throw error;
      }
    });
  });

  // ======================== User Analytics Tests ========================

  describe('User Analytics - Real D1', () => {
    it('should fetch user analytics with real database', async () => {
      try {
        const query = new URLSearchParams({
          timeRange: '7d',
          metrics: 'active_users,user_activity',
          userType: 'agent'
        });

        const response = await fetch(
          `${baseUrl}/api/analytics/users?${query}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-token'
            }
          }
        );

        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('summary');

      } catch (error) {
        console.error('User analytics test failed:', error);
        throw error;
      }
    });
  });

  // ======================== Performance Analytics Tests ========================

  describe('Performance Analytics - Real D1', () => {
    it('should fetch performance analytics with real database', async () => {
      try {
        const query = new URLSearchParams({
          timeRange: '24h',
          metrics: 'response_times,throughput,error_rates'
        });

        const response = await fetch(
          `${baseUrl}/api/analytics/performance?${query}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-token'
            }
          }
        );

        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('summary');
        expect(data.data).toHaveProperty('trends');

      } catch (error) {
        console.error('Performance analytics test failed:', error);
        throw error;
      }
    });
  });

  // ======================== Export Tests ========================

  describe('Data Export - Real D1', () => {
    it('should export analytics data in JSON format', async () => {
      try {
        const response = await fetch(`${baseUrl}/api/analytics/export`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          },
          body: JSON.stringify({
            timeRange: '7d',
            format: 'json',
            metrics: ['total_conversations']
          })
        });

        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('format');
        expect(data.data.format).toBe('json');

      } catch (error) {
        console.error('Export test failed:', error);
        throw error;
      }
    });
  });

  // ======================== Error Handling Tests ========================

  describe('Error Handling - Real D1', () => {
    it('should handle invalid time range gracefully', async () => {
      try {
        const response = await fetch(`${baseUrl}/api/analytics/conversations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          },
          body: JSON.stringify({
            startDate: '2024-01-31',
            endDate: '2024-01-01', // Invalid: end before start
            metrics: ['total_conversations']
          })
        });

        // Should return error status
        expect(response.ok).toBe(false);

      } catch (error) {
        console.error('Error handling test failed:', error);
        throw error;
      }
    });

    it('should handle empty results gracefully', async () => {
      try {
        const query = new URLSearchParams({
          timeRange: '24h',
          metrics: 'total_conversations',
          teamId: '99999' // Non-existent team
        });

        const response = await fetch(
          `${baseUrl}/api/analytics/conversations?${query}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-token'
            }
          }
        );

        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data.success).toBe(true);

      } catch (error) {
        console.error('Empty results test failed:', error);
        throw error;
      }
    });
  });
});

// ======================== Test Metadata ========================

export const getE2ETestSummary = () => {
  return {
    description: 'Analytics 模組真實 D1 數據庫 E2E 測試',
    purpose: '驗證 Analytics Service 在真實 Cloudflare D1 環境的完整功能',
    coverage: {
      healthCheck: '✅ 數據庫連接健康檢查',
      conversationAnalytics: '✅ 對話分析查詢 (3 tests)',
      messageAnalytics: '✅ 消息分析查詢 (2 tests)',
      userAnalytics: '✅ 用戶分析查詢 (1 test)',
      performanceAnalytics: '✅ 性能分析查詢 (1 test)',
      export: '✅ 數據導出 (1 test)',
      errorHandling: '✅ 錯誤處理 (2 tests)'
    },
    totalTests: 11,
    environment: 'Real Cloudflare D1 via Wrangler',
    requirements: [
      'Wrangler CLI installed',
      'Local D1 database configured',
      'wrangler.toml properly configured'
    ]
  };
};