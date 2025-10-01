// Reports & Analytics API Integration Tests
// 測試 Reports 和 Analytics 模組的完整 API 流程

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { reportsHandler } from '@modules/reports/handlers/reports-main';
import { analyticsHandler } from '@modules/analytics/handlers/analytics-main';
import type { Bindings } from '../../src/types';

// ======================== 測試環境設置 ========================

let app: Hono<{ Bindings: Bindings }>;
let mockD1: any;
let mockKV: any;
let testDb: ReturnType<typeof drizzle>;
let authToken: string;

beforeAll(async () => {
  // 創建測試應用
  app = new Hono<{ Bindings: Bindings }>();

  // Mock D1 Database
  mockD1 = {
    prepare: vi.fn((query: string) => ({
      bind: vi.fn((...args: any[]) => ({
        all: vi.fn(async () => ({
          results: [
            {
              id: 1,
              title: 'Test Report',
              type: 'conversation_summary',
              status: 'completed',
              format: 'json',
              createdBy: 'test-user',
              createdAt: new Date().toISOString(),
              downloadUrl: '/api/reports/test-id/download',
              fileSize: 1024,
              completedAt: new Date().toISOString()
            }
          ],
          success: true
        })),
        first: vi.fn(async () => ({
          id: 1,
          title: 'Test Report',
          type: 'conversation_summary',
          status: 'completed',
          format: 'json',
          createdBy: 'test-user',
          createdAt: new Date().toISOString(),
          downloadUrl: '/api/reports/test-id/download',
          fileSize: 1024,
          completedAt: new Date().toISOString()
        })),
        run: vi.fn(async () => ({ success: true })),
        raw: vi.fn(async () => [])
      })),
      all: vi.fn(async () => ({ results: [], success: true })),
      first: vi.fn(async () => null),
      run: vi.fn(async () => ({ success: true })),
      raw: vi.fn(async () => [])
    })),
    batch: vi.fn(async () => [{ success: true }]),
    exec: vi.fn(async () => ({ success: true }))
  };

  // Mock KV Storage
  mockKV = {
    get: vi.fn(async (key: string) => {
      if (key.startsWith('analytics:cache:')) {
        return null; // No cache by default
      }
      return null;
    }),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    list: vi.fn(async () => ({ keys: [] }))
  };

  testDb = drizzle(mockD1 as any);

  // Mount handlers
  app.route('/api/reports', reportsHandler);
  app.route('/api/analytics', analyticsHandler);

  // Mock authentication token
  authToken = 'Bearer test-jwt-token';

  console.log('✅ Reports & Analytics API Test Environment Initialized');
});

afterAll(async () => {
  console.log('🧹 Cleaning up test environment');
});

// ======================== Reports API 測試 ========================

describe('Reports API Integration', () => {
  describe('POST /api/reports/generate', () => {
    it('should generate a new report successfully', async () => {
      const req = new Request('http://localhost/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken
        },
        body: JSON.stringify({
          type: 'conversation_summary',
          title: 'Test Conversation Report',
          format: 'json',
          timeRange: '7d'
        })
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it('should handle invalid report type', async () => {
      const req = new Request('http://localhost/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken
        },
        body: JSON.stringify({
          type: 'invalid_type',
          title: 'Test Report',
          format: 'json',
          timeRange: '7d'
        })
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should generate CSV format report', async () => {
      const req = new Request('http://localhost/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken
        },
        body: JSON.stringify({
          type: 'message_statistics',
          title: 'Message Stats CSV',
          format: 'csv',
          timeRange: '30d'
        })
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data?.format).toBe('csv');
    });

    it('should support custom date ranges', async () => {
      const req = new Request('http://localhost/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken
        },
        body: JSON.stringify({
          type: 'agent_performance',
          title: 'Custom Date Report',
          format: 'json',
          timeRange: 'custom',
          startDate: '2025-09-01',
          endDate: '2025-09-30'
        })
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('GET /api/reports', () => {
    it('should list all reports', async () => {
      const req = new Request('http://localhost/api/reports', {
        method: 'GET',
        headers: {
          'Authorization': authToken
        }
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data.reports)).toBe(true);
    });

    it('should support pagination', async () => {
      const req = new Request('http://localhost/api/reports?page=2&pageSize=10', {
        method: 'GET',
        headers: {
          'Authorization': authToken
        }
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.pagination.page).toBe(2);
      expect(data.data.pagination.pageSize).toBe(10);
    });

    it('should filter by report type', async () => {
      const req = new Request('http://localhost/api/reports?type=conversation_summary', {
        method: 'GET',
        headers: {
          'Authorization': authToken
        }
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by status', async () => {
      const req = new Request('http://localhost/api/reports?status=completed', {
        method: 'GET',
        headers: {
          'Authorization': authToken
        }
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('GET /api/reports/:id/status', () => {
    it('should get report status', async () => {
      const req = new Request('http://localhost/api/reports/test-id/status', {
        method: 'GET',
        headers: {
          'Authorization': authToken
        }
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('GET /api/reports/:id/download', () => {
    it('should download completed report', async () => {
      const req = new Request('http://localhost/api/reports/test-id/download', {
        method: 'GET',
        headers: {
          'Authorization': authToken
        }
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});

// ======================== Analytics API 測試 ========================

describe('Analytics API Integration', () => {
  describe('GET /api/analytics/conversations', () => {
    it('should get conversation analytics', async () => {
      const req = new Request('http://localhost/api/analytics/conversations?timeRange=7d', {
        method: 'GET',
        headers: {
          'Authorization': authToken
        }
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it('should support platform filtering', async () => {
      const req = new Request('http://localhost/api/analytics/conversations?timeRange=7d&platform=line', {
        method: 'GET',
        headers: {
          'Authorization': authToken
        }
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
    });

    it('should support custom date ranges', async () => {
      const req = new Request('http://localhost/api/analytics/conversations?timeRange=custom&startDate=2025-09-01&endDate=2025-09-30', {
        method: 'GET',
        headers: {
          'Authorization': authToken
        }
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
    });

    it('should handle validation errors', async () => {
      const req = new Request('http://localhost/api/analytics/conversations?timeRange=invalid', {
        method: 'GET',
        headers: {
          'Authorization': authToken
        }
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.metadata?.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/analytics/messages', () => {
    it('should get message analytics', async () => {
      const req = new Request('http://localhost/api/analytics/messages?timeRange=7d', {
        method: 'GET',
        headers: {
          'Authorization': authToken
        }
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by conversation ID', async () => {
      const req = new Request('http://localhost/api/analytics/messages?timeRange=7d&conversationId=conv_123', {
        method: 'GET',
        headers: {
          'Authorization': authToken
        }
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
    });

    it('should support multiple metrics', async () => {
      const req = new Request('http://localhost/api/analytics/messages?timeRange=7d&metrics=total_messages,messages_per_hour,avg_message_length', {
        method: 'GET',
        headers: {
          'Authorization': authToken
        }
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/analytics/users', () => {
    it('should get user analytics', async () => {
      const req = new Request('http://localhost/api/analytics/users?timeRange=7d&userType=agent', {
        method: 'GET',
        headers: {
          'Authorization': authToken
        }
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by team ID', async () => {
      const req = new Request('http://localhost/api/analytics/users?timeRange=7d&userType=agent&teamId=1', {
        method: 'GET',
        headers: {
          'Authorization': authToken
        }
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/analytics/performance', () => {
    it('should get performance analytics', async () => {
      const req = new Request('http://localhost/api/analytics/performance?timeRange=24h', {
        method: 'GET',
        headers: {
          'Authorization': authToken
        }
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should support performance metrics', async () => {
      const req = new Request('http://localhost/api/analytics/performance?timeRange=24h&metrics=response_times,throughput,error_rates', {
        method: 'GET',
        headers: {
          'Authorization': authToken
        }
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/analytics/custom', () => {
    it('should execute custom analytics query', async () => {
      const req = new Request('http://localhost/api/analytics/custom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken
        },
        body: JSON.stringify({
          timeRange: '7d',
          query: 'SELECT COUNT(*) as total FROM conversations',
          parameters: {},
          aggregation: 'sum',
          filters: {},
          groupBy: []
        })
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/analytics/export', () => {
    it('should export analytics data in JSON format', async () => {
      const req = new Request('http://localhost/api/analytics/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken
        },
        body: JSON.stringify({
          timeRange: '7d',
          format: 'json',
          metrics: ['total_conversations', 'active_conversations'],
          includeCharts: false,
          filters: {},
          groupBy: []
        })
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should export analytics data in CSV format', async () => {
      const req = new Request('http://localhost/api/analytics/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken
        },
        body: JSON.stringify({
          timeRange: '7d',
          format: 'csv',
          metrics: ['total_messages'],
          includeCharts: false,
          filters: {},
          groupBy: []
        })
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/analytics/health', () => {
    it('should check analytics service health', async () => {
      const req = new Request('http://localhost/api/analytics/health', {
        method: 'GET',
        headers: {
          'Authorization': authToken
        }
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.status).toBe('healthy');
    });
  });

  describe('POST /api/analytics/metrics', () => {
    it('should collect metrics data', async () => {
      const req = new Request('http://localhost/api/analytics/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken
        },
        body: JSON.stringify({
          metric: {
            name: 'api_requests',
            value: 1,
            timestamp: Date.now(),
            tags: { endpoint: '/api/conversations' }
          }
        })
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should collect batch metrics', async () => {
      const req = new Request('http://localhost/api/analytics/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken
        },
        body: JSON.stringify({
          metrics: [
            { name: 'metric1', value: 1, timestamp: Date.now() },
            { name: 'metric2', value: 2, timestamp: Date.now() }
          ]
        })
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/analytics/metrics/:name', () => {
    it('should query metrics data', async () => {
      const req = new Request('http://localhost/api/analytics/metrics/api_requests?startTime=0&aggregation=avg', {
        method: 'GET',
        headers: {
          'Authorization': authToken
        }
      });

      const res = await app.fetch(req, {
        DB: mockD1,
        KV: mockKV
      } as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});

// ======================== Error Handling 測試 ========================

describe('Error Handling', () => {
  it('should handle database errors gracefully', async () => {
    // Mock database error
    mockD1.prepare = vi.fn(() => {
      throw new Error('Database connection failed');
    });

    const req = new Request('http://localhost/api/analytics/conversations?timeRange=7d', {
      method: 'GET',
      headers: {
        'Authorization': authToken
      }
    });

    const res = await app.fetch(req, {
      DB: mockD1,
      KV: mockKV
    } as any);

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('should return proper error codes', async () => {
    const req = new Request('http://localhost/api/analytics/conversations?timeRange=invalid', {
      method: 'GET',
      headers: {
        'Authorization': authToken
      }
    });

    const res = await app.fetch(req, {
      DB: mockD1,
      KV: mockKV
    } as any);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.metadata?.errorCode).toBe('VALIDATION_ERROR');
  });
});

// ======================== Performance 測試 ========================

describe('Performance', () => {
  it('should complete API requests in reasonable time', async () => {
    const startTime = Date.now();

    const req = new Request('http://localhost/api/analytics/conversations?timeRange=7d', {
      method: 'GET',
      headers: {
        'Authorization': authToken
      }
    });

    await app.fetch(req, {
      DB: mockD1,
      KV: mockKV
    } as any);

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    // Should complete within 1 second
    expect(executionTime).toBeLessThan(1000);
  });
});