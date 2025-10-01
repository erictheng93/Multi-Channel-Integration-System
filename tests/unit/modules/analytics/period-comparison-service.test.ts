// Period Comparison Service 單元測試
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PeriodComparisonService } from '@modules/analytics/services/period-comparison-service';
import type { Period } from '@modules/analytics/services/period-comparison-service';

describe('PeriodComparisonService', () => {
  let mockDb: any;
  let comparisonService: PeriodComparisonService;

  beforeEach(() => {
    // Mock Drizzle Database
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis()
    };

    comparisonService = new PeriodComparisonService(mockDb);
  });

  describe('calculatePreviousPeriod', () => {
    it('should calculate previous period with same duration', () => {
      const currentPeriod: Period = {
        start: '2025-01-23T00:00:00Z',
        end: '2025-01-30T23:59:59Z',
        label: '本週'
      };

      const previousPeriod = comparisonService.calculatePreviousPeriod(currentPeriod);

      // Verify that previous period has same duration as current period
      const currentDuration = new Date(currentPeriod.end).getTime() - new Date(currentPeriod.start).getTime();
      const previousDuration = new Date(previousPeriod.end).getTime() - new Date(previousPeriod.start).getTime();

      expect(previousDuration).toBeCloseTo(currentDuration, -3); // Same duration
      expect(new Date(previousPeriod.end).getTime()).toBeLessThan(new Date(currentPeriod.start).getTime()); // Previous ends before current starts
    });

    it('should handle 1-hour periods', () => {
      const currentPeriod: Period = {
        start: '2025-01-30T14:00:00Z',
        end: '2025-01-30T15:00:00Z'
      };

      const previousPeriod = comparisonService.calculatePreviousPeriod(currentPeriod);

      // Check approximate times (allowing for 1-2 second difference)
      const expectedStart = new Date('2025-01-30T13:00:00.000Z').getTime();
      const actualStart = new Date(previousPeriod.start).getTime();
      expect(Math.abs(actualStart - expectedStart)).toBeLessThan(2000);
      expect(previousPeriod.label).toContain('上');
    });

    it('should handle 24-hour periods', () => {
      const currentPeriod: Period = {
        start: '2025-01-29T00:00:00Z',
        end: '2025-01-30T00:00:00Z'
      };

      const previousPeriod = comparisonService.calculatePreviousPeriod(currentPeriod);

      const currentDuration = new Date(currentPeriod.end).getTime() - new Date(currentPeriod.start).getTime();
      const previousDuration = new Date(previousPeriod.end).getTime() - new Date(previousPeriod.start).getTime();

      expect(previousDuration).toBeCloseTo(currentDuration, -3); // Within 1 second
    });

    it('should handle 30-day periods', () => {
      const currentPeriod: Period = {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-31T00:00:00Z'
      };

      const previousPeriod = comparisonService.calculatePreviousPeriod(currentPeriod);

      const currentDuration = new Date(currentPeriod.end).getTime() - new Date(currentPeriod.start).getTime();
      const previousDuration = new Date(previousPeriod.end).getTime() - new Date(previousPeriod.start).getTime();

      expect(previousDuration).toBeCloseTo(currentDuration, -3);
    });
  });

  describe('compareMetric', () => {
    it('should compare metric between two periods', async () => {
      const currentPeriod: Period = {
        start: '2025-01-23T00:00:00Z',
        end: '2025-01-30T23:59:59Z'
      };

      // Mock database responses
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValueOnce([{ count: 1250 }]); // Current
      mockDb.where.mockResolvedValueOnce([{ count: 1100 }]); // Previous

      const comparison = await comparisonService.compareMetric({
        metric: 'total_conversations',
        currentPeriod
      });

      expect(comparison.current).toBe(1250);
      expect(comparison.previous).toBe(1100);
      expect(comparison.change).toBe(150);
      expect(comparison.changePercentage).toBeCloseTo(13.64, 1);
      expect(comparison.trend).toBe('up');
    });

    it('should handle zero previous value', async () => {
      const currentPeriod: Period = {
        start: '2025-01-23T00:00:00Z',
        end: '2025-01-30T23:59:59Z'
      };

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValueOnce([{ count: 100 }]); // Current
      mockDb.where.mockResolvedValueOnce([{ count: 0 }]);   // Previous

      const comparison = await comparisonService.compareMetric({
        metric: 'total_conversations',
        currentPeriod
      });

      expect(comparison.current).toBe(100);
      expect(comparison.previous).toBe(0);
      expect(comparison.changePercentage).toBe(100); // 100% increase from 0
    });

    it('should handle declining metrics', async () => {
      const currentPeriod: Period = {
        start: '2025-01-23T00:00:00Z',
        end: '2025-01-30T23:59:59Z'
      };

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValueOnce([{ count: 900 }]);  // Current
      mockDb.where.mockResolvedValueOnce([{ count: 1100 }]); // Previous

      const comparison = await comparisonService.compareMetric({
        metric: 'total_conversations',
        currentPeriod
      });

      expect(comparison.change).toBe(-200);
      expect(comparison.changePercentage).toBeCloseTo(-18.18, 1);
      expect(comparison.trend).toBe('down');
    });

    it('should mark stable trend for small changes', async () => {
      const currentPeriod: Period = {
        start: '2025-01-23T00:00:00Z',
        end: '2025-01-30T23:59:59Z'
      };

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValueOnce([{ count: 1020 }]); // Current
      mockDb.where.mockResolvedValueOnce([{ count: 1000 }]); // Previous

      const comparison = await comparisonService.compareMetric({
        metric: 'total_conversations',
        currentPeriod
      });

      expect(comparison.changePercentage).toBe(2); // Less than 5%
      expect(comparison.trend).toBe('stable');
    });
  });

  describe('compareMultipleMetrics', () => {
    it('should compare multiple metrics in parallel', async () => {
      const currentPeriod: Period = {
        start: '2025-01-23T00:00:00Z',
        end: '2025-01-30T23:59:59Z'
      };

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();

      // Mock responses for multiple metrics
      let callCount = 0;
      mockDb.where.mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 1) {
          // Current period responses
          return Promise.resolve([{ count: 1250 }]);
        } else {
          // Previous period responses
          return Promise.resolve([{ count: 1100 }]);
        }
      });

      const comparison = await comparisonService.compareMultipleMetrics(
        ['total_conversations', 'active_conversations'],
        currentPeriod
      );

      expect(comparison.metrics).toHaveProperty('total_conversations');
      expect(comparison.metrics).toHaveProperty('active_conversations');
      expect(comparison.summary.totalMetrics).toBe(2);
    });

    it('should calculate overall trend correctly', async () => {
      const currentPeriod: Period = {
        start: '2025-01-23T00:00:00Z',
        end: '2025-01-30T23:59:59Z'
      };

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();

      // Mock 3 metrics: 2 up, 1 stable
      let callCount = 0;
      mockDb.where.mockImplementation(() => {
        callCount++;
        const responses = [
          [{ count: 1250 }], [{ count: 1000 }], // Metric 1: +25% up
          [{ count: 450 }],  [{ count: 400 }],  // Metric 2: +12.5% up
          [{ count: 102 }],  [{ count: 100 }]   // Metric 3: +2% stable
        ];
        return Promise.resolve(responses[callCount - 1]);
      });

      const comparison = await comparisonService.compareMultipleMetrics(
        ['total_conversations', 'active_conversations', 'closed_conversations'],
        currentPeriod
      );

      // Verify summary statistics
      expect(comparison.summary.totalMetrics).toBe(3);
      // At least 2 metrics should show improvement
      expect(comparison.summary.improvedMetrics).toBeGreaterThanOrEqual(2);
      expect(comparison.summary.overallTrend).toBe('positive');
    });
  });

  describe('formatComparisonText', () => {
    it('should format comparison as readable text', () => {
      const comparison = {
        current: 1250,
        previous: 1100,
        change: 150,
        changePercentage: 13.64,
        trend: 'up' as const,
        period: {
          current: { start: '', end: '' },
          previous: { start: '', end: '' }
        }
      };

      const text = comparisonService.formatComparisonText(comparison);

      expect(text).toContain('1250');
      expect(text).toContain('1100');
      expect(text).toContain('上升');
      expect(text).toContain('13.64');
    });

    it('should handle declining trends', () => {
      const comparison = {
        current: 900,
        previous: 1100,
        change: -200,
        changePercentage: -18.18,
        trend: 'down' as const,
        period: {
          current: { start: '', end: '' },
          previous: { start: '', end: '' }
        }
      };

      const text = comparisonService.formatComparisonText(comparison);

      expect(text).toContain('下降');
      expect(text).toContain('18.18');
    });

    it('should handle stable trends', () => {
      const comparison = {
        current: 1020,
        previous: 1000,
        change: 20,
        changePercentage: 2,
        trend: 'stable' as const,
        period: {
          current: { start: '', end: '' },
          previous: { start: '', end: '' }
        }
      };

      const text = comparisonService.formatComparisonText(comparison);

      expect(text).toContain('保持穩定');
    });
  });

  describe('preset metric sets', () => {
    beforeEach(() => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValue([{ count: 100 }]);
    });

    it('should compare conversation metrics', async () => {
      const currentPeriod: Period = {
        start: '2025-01-23T00:00:00Z',
        end: '2025-01-30T23:59:59Z'
      };

      const comparison = await comparisonService.compareConversationMetrics(currentPeriod);

      expect(comparison.metrics).toHaveProperty('total_conversations');
      expect(comparison.metrics).toHaveProperty('active_conversations');
      expect(comparison.metrics).toHaveProperty('closed_conversations');
    });

    it('should compare message metrics', async () => {
      const currentPeriod: Period = {
        start: '2025-01-23T00:00:00Z',
        end: '2025-01-30T23:59:59Z'
      };

      const comparison = await comparisonService.compareMessageMetrics(currentPeriod);

      expect(comparison.metrics).toHaveProperty('total_messages');
      expect(comparison.metrics).toHaveProperty('customer_messages');
      expect(comparison.metrics).toHaveProperty('agent_messages');
    });

    it('should compare user activity metrics', async () => {
      const currentPeriod: Period = {
        start: '2025-01-23T00:00:00Z',
        end: '2025-01-30T23:59:59Z'
      };

      const comparison = await comparisonService.compareUserActivityMetrics(currentPeriod);

      expect(comparison.metrics).toHaveProperty('active_users');
      expect(comparison.metrics).toHaveProperty('total_activities');
    });
  });
});