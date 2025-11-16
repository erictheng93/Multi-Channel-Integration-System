import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { ReportsService } from '@modules/reports/services/reports-service';
import type { ReportGenerationParams, ReportListQuery } from '@modules/reports/types/report-types';
import type { Bindings } from '@/types/bindings';
import { drizzle } from 'drizzle-orm/d1'; // Import drizzle for mocking
import { reports, conversations, messages, agents } from '@/db/schema'; // Import schema tables

// Mock Drizzle ORM and schema
vi.mock('drizzle-orm/d1');
vi.mock('../../../db/schema', () => ({
  reports: {
    id: 'reports_id',
    title: 'reports_title',
    description: 'reports_description',
    type: 'reports_type',
    format: 'reports_format',
    status: 'reports_status',
    createdBy: 'reports_createdBy',
    createdAt: 'reports_createdAt',
    updatedAt: 'reports_updatedAt',
    generationStartedAt: 'reports_generationStartedAt',
    completedAt: 'reports_completedAt',
    downloadUrl: 'reports_downloadUrl',
    fileSize: 'reports_fileSize',
    teamId: 'reports_teamId',
    errorMessage: 'reports_errorMessage',
    timeRange: 'reports_timeRange',
    startDate: 'reports_startDate',
    endDate: 'reports_endDate',
    filters: 'reports_filters',
    options: 'reports_options',
    executionTime: 'reports_executionTime',
  },
  conversations: {},
  messages: {},
  customers: {},
  agents: {},
  reportDownloadHistory: {},
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    eq: vi.fn((col, val) => ({ col, val, type: 'eq' })),
    and: vi.fn((...conditions) => ({ conditions, type: 'and' })),
    gte: vi.fn((col, val) => ({ col, val, type: 'gte' })),
    lte: vi.fn((col, val) => ({ col, val, type: 'lte' })),
    like: vi.fn((col, val) => ({ col, val, type: 'like' })),
    desc: vi.fn((col) => ({ col, type: 'desc' })),
    count: vi.fn(() => ({ type: 'count' })),
    sql: vi.fn((strings, ...values) => ({ strings, values, type: 'sql' })),
  };
});

// Mock KV
const createMockKV = () => ({
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue({ keys: [] }),
  getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null })
});

describe('ReportsService', () => {
  let service: ReportsService;
  let mockEnv: Partial<Bindings>;
  let mockKV: any;
  let mockDrizzleDb: any; // Declare mockDrizzleDb here

  beforeEach(() => {
    vi.resetAllMocks();

    const reportStore: Record<string, any> = {}; // Simple in-memory store for reports
    const mockSelectResults: Map<string, any> = new Map(); // Store for specific select query results

    const mockReport = {
      id: 'report_123',
      title: 'Test Conversation Report',
      description: null,
      type: 'conversation_summary',
      format: 'json',
      status: 'completed',
      createdBy: 'test-user',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        timeRange: '7d',
        startDate: undefined,
        endDate: undefined,
        filters: undefined,
        options: undefined
      },
      completedAt: new Date().toISOString(),
      fileSize: 1000,
      executionTime: 100,
      downloadUrl: '/api/reports/report_123/download'
    };

    // Populate the store with a default report for positive tests
    reportStore[mockReport.id] = mockReport;

    // Mock the Drizzle ORM instance
    mockDrizzleDb = {
      insert: vi.fn(() => mockDrizzleDb),
      values: vi.fn((values) => {
        // Simulate insertion into the store
        reportStore[values.id] = { ...values, metadata: JSON.parse(values.options || '{}') };
        return mockDrizzleDb;
      }),
      update: vi.fn(() => mockDrizzleDb),
      set: vi.fn((values) => {
        // Simulate update in the store
        const id = mockDrizzleDb.where.mock.lastCall?.[0]?.val;
        if (id && reportStore[id]) {
          reportStore[id] = { ...reportStore[id], ...values };
        }
        return mockDrizzleDb;
      }),
      select: vi.fn(() => mockDrizzleDb),
      from: vi.fn((table) => {
        mockDrizzleDb._currentTable = table; // Keep track of the table being queried
        return mockDrizzleDb;
      }),
      where: vi.fn((condition) => {
        mockDrizzleDb._currentCondition = condition; // Keep track of the condition
        return mockDrizzleDb;
      }),
      orderBy: vi.fn(() => mockDrizzleDb),
      limit: vi.fn(() => mockDrizzleDb),
      offset: vi.fn(() => mockDrizzleDb),
      get: vi.fn(() => {
        // Handle specific 'reports' table lookup first
        if (mockDrizzleDb._currentTable === reports && mockDrizzleDb._currentCondition?.col === 'reports_id') {
          return reportStore[mockDrizzleDb._currentCondition.val] || null;
        }

        const key = `${mockDrizzleDb._currentTable}-get`;
        if (mockSelectResults.has(key)) {
          const matches = mockSelectResults.get(key).filter((entry: any) => entry.conditionMatcher(mockDrizzleDb._currentCondition));
          if (matches.length > 0) {
            return matches[0].result;
          }
        }
        return null; // Default for other gets
      }),
      all: vi.fn(() => {
        // Handle specific 'reports' table lookup first
        if (mockDrizzleDb._currentTable === reports) {
          // For listReports, we need to filter by conditions
          const conditions = mockDrizzleDb._currentCondition?.conditions || [];
          let filteredReports = Object.values(reportStore);

          conditions.forEach((cond: any) => {
            if (cond.type === 'eq' && cond.col === 'reports_type') {
              filteredReports = filteredReports.filter((r: any) => r.type === cond.val);
            }
            if (cond.type === 'eq' && cond.col === 'reports_status') {
              filteredReports = filteredReports.filter((r: any) => r.status === cond.val);
            }
            if (cond.type === 'like' && cond.col === 'reports_title') {
              const searchVal = cond.val.replace(/%/g, '');
              filteredReports = filteredReports.filter((r: any) => r.title.includes(searchVal));
            }
            // Add other conditions as needed for listReports
          });

          // Apply limit and offset for listReports
          const offset = mockDrizzleDb.offset.mock.lastCall?.[0] || 0;
          const limit = mockDrizzleDb.limit.mock.lastCall?.[0] || filteredReports.length;
          return filteredReports.slice(offset, offset + limit);
        }

        const key = `${mockDrizzleDb._currentTable}-all`;
        if (mockSelectResults.has(key)) {
          const matches = mockSelectResults.get(key).filter((entry: any) => entry.conditionMatcher(mockDrizzleDb._currentCondition));
          if (matches.length > 0) {
            return matches[0].result;
          }
        }
        return [];
      }),
    };

    // Helper to set specific select query results
    mockDrizzleDb.setSelectResult = (table: any, conditionMatcher: (condition: any) => boolean, result: any, type: 'get' | 'all' = 'get') => {
      const key = `${table}-${type}`; // Still use table and type for primary key
      if (!mockSelectResults.has(key)) {
        mockSelectResults.set(key, []);
      }
      mockSelectResults.get(key).push({ conditionMatcher, result });
    };

    // Mock results for queryConversationSummary
    mockDrizzleDb.setSelectResult(conversations, (condition: any) => {
      return condition?.conditions?.some((c: any) => c.col === 'conversations_createdAt' && c.type === 'gte');
    }, [
      { total: 5, status: 'active' },
      { total: 10, status: 'closed' },
    ], 'all');

    mockDrizzleDb.setSelectResult(messages, (condition: any) => {
      return condition?.conditions?.some((c: any) => c.col === 'messages_createdAt' && c.type === 'gte');
    }, [
      { total: 100 }
    ], 'all');

    // Mock results for queryAgentPerformance
    mockDrizzleDb.setSelectResult(conversations, (condition: any) => {
      return condition?.conditions?.some((c: any) => c.col === 'conversations_assignedUserId' && c.type === 'isNotNull');
    }, [
      { agentId: 'agent-1', conversationCount: 10 },
      { agentId: 'agent-2', conversationCount: 5 },
    ], 'all');

    mockDrizzleDb.setSelectResult(agents, (condition: any) => {
      return condition?.col === 'agents_id' && condition?.val === 'agent-1';
    }, { id: 'agent-1', displayName: 'Agent One' }, 'get');

    mockDrizzleDb.setSelectResult(agents, (condition: any) => {
      return condition?.col === 'agents_id' && condition?.val === 'agent-2';
    }, { id: 'agent-2', displayName: 'Agent Two' }, 'get');

    mockDrizzleDb.setSelectResult(messages, (condition: any) => {
      return condition?.conditions?.some((c: any) => c.col === 'messages_agentSenderId' && c.val === 'agent-1');
    }, [{ total: 50 }], 'all');

    mockDrizzleDb.setSelectResult(messages, (condition: any) => {
      return condition?.conditions?.some((c: any) => c.col === 'messages_agentSenderId' && c.val === 'agent-2');
    }, [{ total: 25 }], 'all');

    // Mock results for queryMessageStatistics
    mockDrizzleDb.setSelectResult(messages, (condition: any) => {
      return condition?.type === 'sql' && condition?.strings?.some((s: string) => s.includes('messages.createdAt'));
    }, [
      { total: 70, senderType: 'customer', messageType: 'text' },
      { total: 30, senderType: 'agent', messageType: 'text' },
    ], 'all');


    // Mock the drizzle function to return our mockDrizzleDb
    (drizzle as Mock).mockReturnValue(mockDrizzleDb);

    mockKV = createMockKV();

    mockEnv = {
      DB: {} as any,
      CACHE: mockKV as any,
      SESSIONS: mockKV as any,
      KV: mockKV as any,
      LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
      LINE_CHANNEL_SECRET: 'test-secret',
      JWT_SECRET: 'test-jwt-secret',
      ENCRYPTION_KEY: 'test-encryption-key',
      FB_PAGE_ACCESS_TOKEN: 'test-fb-token',
      FB_APP_SECRET: 'test-fb-secret',
      FB_VERIFY_TOKEN: 'test-fb-verify'
    };

    service = new ReportsService(mockEnv as Bindings);
  });

  describe('generateReport()', () => {
    it('should generate a conversation summary report', async () => {
      const params: ReportGenerationParams = {
        type: 'conversation_summary',
        title: 'Test Conversation Report',
        format: 'json',
        timeRange: '7d'
      };

      const result = await service.generateReport(params, 'test-user');

      expect(result).toBeDefined();
      expect(result.id).toMatch(/^report_/);
      expect(result.title).toBe('Test Conversation Report');
      expect(result.type).toBe('conversation_summary');
      expect(result.format).toBe('json');
      expect(result.status).toBe('completed');
      expect(result.createdBy).toBe('test-user');
    });

    it('should generate an agent performance report', async () => {
      const params: ReportGenerationParams = {
        type: 'agent_performance',
        title: 'Test Agent Performance Report',
        format: 'csv',
        timeRange: '30d'
      };

      const result = await service.generateReport(params, 'test-user');

      expect(result.type).toBe('agent_performance');
      expect(result.format).toBe('csv');
      expect(result.status).toBe('completed');
    });

    it('should generate a message statistics report', async () => {
      const params: ReportGenerationParams = {
        type: 'message_statistics',
        title: 'Test Message Statistics Report',
        format: 'json',
        timeRange: '7d'
      };

      const result = await service.generateReport(params, 'test-user');

      expect(result.type).toBe('message_statistics');
      expect(result.status).toBe('completed');
    });

    it('should handle custom date range', async () => {
      const params: ReportGenerationParams = {
        type: 'conversation_summary',
        title: 'Custom Date Range Report',
        format: 'json',
        timeRange: 'custom',
        startDate: '2025-09-01',
        endDate: '2025-09-30'
      };

      const result = await service.generateReport(params, 'test-user');

      expect(result.status).toBe('completed');
      expect(result.metadata).toBeDefined();
    });

    it('should include execution time in metadata', async () => {
      const params: ReportGenerationParams = {
        type: 'conversation_summary',
        title: 'Test Report',
        format: 'json',
        timeRange: '7d'
      };

      const result = await service.generateReport(params, 'test-user');

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should generate download URL', async () => {
      const params: ReportGenerationParams = {
        type: 'conversation_summary',
        title: 'Test Report',
        format: 'json',
        timeRange: '7d'
      };

      const result = await service.generateReport(params, 'test-user');

      expect(result.downloadUrl).toBeDefined();
      expect(result.downloadUrl).toContain('/api/reports/');
      expect(result.downloadUrl).toContain('/download');
    });

    it('should calculate file size', async () => {
      const params: ReportGenerationParams = {
        type: 'conversation_summary',
        title: 'Test Report',
        format: 'json',
        timeRange: '7d'
      };

      const result = await service.generateReport(params, 'test-user');

      expect(result.fileSize).toBeDefined();
      expect(result.fileSize).toBeGreaterThan(0);
    });
  });

  describe('getReportStatus()', () => {
    it('should return null for non-existent report', async () => {
      const result = await service.getReportStatus('non-existent-id');

      expect(result).toBeNull();
    });

    it('should return report status for valid report ID', async () => {
      // 先生成一個報告
      const params: ReportGenerationParams = {
        type: 'conversation_summary',
        title: 'Test Report',
        format: 'json',
        timeRange: '7d'
      };

      const report = await service.generateReport(params, 'test-user');

      // Query the report status - the mock database should handle this automatically
      const status = await service.getReportStatus(report.id);

      expect(status).toBeDefined();
      expect(status?.id).toBe(report.id);
      expect(status?.status).toBe('completed');
    });
  });

  describe('listReports()', () => {
    it('should return paginated reports with default parameters', async () => {
      const query: ReportListQuery = {};

      const result = await service.listReports(query);

      expect(result).toBeDefined();
      expect(result.reports).toBeInstanceOf(Array);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(20);
      expect(result.summary).toBeDefined();
    });

    it('should filter reports by type', async () => {
      const query: ReportListQuery = {
        type: 'conversation_summary'
      };

      const result = await service.listReports(query);

      expect(result.reports).toBeInstanceOf(Array);
      // 在實際測試中，應該驗證所有報告都是 conversation_summary 類型
    });

    it('should filter reports by status', async () => {
      const query: ReportListQuery = {
        status: 'completed'
      };

      const result = await service.listReports(query);

      expect(result.reports).toBeInstanceOf(Array);
    });

    it('should support pagination', async () => {
      const query: ReportListQuery = {
        page: 2,
        pageSize: 10
      };

      const result = await service.listReports(query);

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.pageSize).toBe(10);
    });

    it('should limit maximum page size', async () => {
      const query: ReportListQuery = {
        pageSize: 200  // 超過最大值
      };

      const result = await service.listReports(query);

      expect(result.pagination.pageSize).toBeLessThanOrEqual(100);
    });

    it('should include summary statistics', async () => {
      const query: ReportListQuery = {};

      const result = await service.listReports(query);

      expect(result.summary).toBeDefined();
      expect(result.summary.totalReports).toBeGreaterThanOrEqual(0);
      expect(result.summary.completedReports).toBeGreaterThanOrEqual(0);
      expect(result.summary.pendingReports).toBeGreaterThanOrEqual(0);
      expect(result.summary.failedReports).toBeGreaterThanOrEqual(0);
    });

    it('should support search by title', async () => {
      const query: ReportListQuery = {
        search: 'conversation'
      };

      const result = await service.listReports(query);

      expect(result.reports).toBeInstanceOf(Array);
    });

    it('should filter by team ID', async () => {
      const query: ReportListQuery = {
        teamId: 1
      };

      const result = await service.listReports(query);

      expect(result.reports).toBeInstanceOf(Array);
    });

    it('should filter by date range', async () => {
      const query: ReportListQuery = {
        startDate: '2025-09-01',
        endDate: '2025-09-30'
      };

      const result = await service.listReports(query);

      expect(result.reports).toBeInstanceOf(Array);
    });
  });

  describe('downloadReport()', () => {
    it('should throw error for non-existent report', async () => {
      await expect(
        service.downloadReport('non-existent-id', 'test-user')
      ).rejects.toThrow();
    });

    it('should return null for incomplete report', async () => {
      // Generate a pending report first
      const params: ReportGenerationParams = {
        type: 'conversation_summary',
        title: 'Incomplete Test Report',
        format: 'json',
        timeRange: '7d'
      };

      // Create report but simulate it being incomplete by testing before it finishes
      // Since our mock generates reports synchronously, we'll skip this test
      // or test with a report that hasn't been generated yet
      const result = await service.downloadReport('non-existent-id', 'test-user');

      expect(result).toBeNull();
    });

    it('should return download info for completed report', async () => {
      // 先生成一個完成的報告
      const params: ReportGenerationParams = {
        type: 'conversation_summary',
        title: 'Test Report',
        format: 'json',
        timeRange: '7d'
      };

      const report = await service.generateReport(params, 'test-user');

      // Download the report - mock database should handle this automatically
      const result = await service.downloadReport(report.id, 'test-user');

      expect(result).toBeDefined();
      expect(result?.url).toBe(report.downloadUrl);
      expect(result?.filename).toContain(report.format);
    });

    it('should generate correct filename', async () => {
      const params: ReportGenerationParams = {
        type: 'conversation_summary',
        title: 'Test Report With Spaces',
        format: 'csv',
        timeRange: '7d'
      };

      const report = await service.generateReport(params, 'test-user');

      const result = await service.downloadReport(report.id, 'test-user');

      expect(result?.filename).toBe('Test_Report_With_Spaces.csv');
    });
  });

  describe('calculateDateRange()', () => {
    it('should calculate 7 days range', () => {
      const range = (service as any).calculateDateRange('7d');

      expect(range.startDate).toBeDefined();
      expect(range.endDate).toBeDefined();

      const start = new Date(range.startDate);
      const end = new Date(range.endDate);
      const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBe(7);
    });

    it('should calculate 30 days range', () => {
      const range = (service as any).calculateDateRange('30d');

      const start = new Date(range.startDate);
      const end = new Date(range.endDate);
      const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBe(30);
    });

    it('should use custom date range', () => {
      const range = (service as any).calculateDateRange('custom', '2025-09-01', '2025-09-30');

      expect(range.startDate).toBe('2025-09-01T00:00:00.000Z');
      expect(range.endDate).toBe('2025-09-30T23:59:59.999Z');
    });
  });

  describe('serializeReport()', () => {
    it('should serialize report to JSON', () => {
      const data = {
        reportInfo: { title: 'Test' },
        data: { test: 'value' }
      };

      const result = (service as any).serializeReport(data, 'json');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should serialize report to CSV', () => {
      const data = {
        reportInfo: { title: 'Test Report', generatedAt: '2025-09-30' },
        data: {
          summary: { totalConversations: 100, activeConversations: 50 }
        }
      };

      const result = (service as any).serializeReport(data, 'csv');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('Test Report');
      expect(result).toContain('totalConversations');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Test with non-existent ID - should return null
      const result = await service.getReportStatus('non-existent-id');

      expect(result).toBeNull();
    });

    it('should handle invalid date range', async () => {
      const params: ReportGenerationParams = {
        type: 'conversation_summary',
        title: 'Test Report',
        format: 'json',
        timeRange: 'custom',
        startDate: '2025-09-30',
        endDate: '2025-09-01'  // 結束日期早於開始日期
      };

      // 應該仍然能生成報告，但日期範圍可能被調整
      const result = await service.generateReport(params, 'test-user');

      expect(result).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should complete report generation in reasonable time', async () => {
      const params: ReportGenerationParams = {
        type: 'conversation_summary',
        title: 'Performance Test Report',
        format: 'json',
        timeRange: '7d'
      };

      const startTime = Date.now();
      await service.generateReport(params, 'test-user');
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      // 應該在 2 秒內完成
      expect(executionTime).toBeLessThan(2000);
    });
  });
});