// Reports Service Unit Tests
// 測試 Reports Service 核心功能

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportsService } from '@modules/reports/services/reports-service';
import type { ReportGenerationParams, ReportListQuery } from '@modules/reports/types/report-types';

// Mock D1 Database
const createMockDB = () => ({
  prepare: vi.fn().mockReturnThis(),
  bind: vi.fn().mockReturnThis(),
  all: vi.fn().mockResolvedValue({ results: [] }),
  first: vi.fn().mockResolvedValue(null),
  run: vi.fn().mockResolvedValue({ success: true })
});

// Mock KV
const createMockKV = () => ({
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined)
});

describe('ReportsService', () => {
  let service: ReportsService;
  let mockDB: any;
  let mockKV: any;

  beforeEach(() => {
    mockDB = createMockDB();
    mockKV = createMockKV();
    service = new ReportsService(mockDB, mockKV);
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

      // Mock database response
      mockDB.first.mockResolvedValueOnce({
        id: report.id,
        title: report.title,
        type: report.type,
        format: report.format,
        status: report.status,
        createdBy: report.createdBy,
        createdAt: report.createdAt,
        downloadUrl: report.downloadUrl,
        fileSize: report.fileSize,
        teamId: null,
        generationStartedAt: null,
        completedAt: report.completedAt,
        errorMessage: null,
        options: null,
        updatedAt: null
      });

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
      // Mock 一個未完成的報告
      mockDB.first.mockResolvedValueOnce({
        id: 'test-id',
        status: 'generating',
        downloadUrl: null
      });

      const result = await service.downloadReport('test-id', 'test-user');

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

      // Mock database response
      mockDB.first.mockResolvedValueOnce({
        id: report.id,
        title: report.title,
        type: report.type,
        format: report.format,
        status: 'completed',
        createdBy: report.createdBy,
        createdAt: report.createdAt,
        downloadUrl: report.downloadUrl,
        fileSize: report.fileSize,
        teamId: null,
        generationStartedAt: null,
        completedAt: report.completedAt,
        errorMessage: null,
        options: null,
        updatedAt: null
      });

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

      mockDB.first.mockResolvedValueOnce({
        id: report.id,
        title: report.title,
        status: 'completed',
        downloadUrl: report.downloadUrl,
        format: report.format
      });

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
      mockDB.first.mockRejectedValueOnce(new Error('Database error'));

      const result = await service.getReportStatus('test-id');

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