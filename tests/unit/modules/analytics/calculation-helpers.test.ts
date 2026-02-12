// Analytics Calculation Helpers Unit Tests
// Comprehensive tests for statistical calculation utilities

import { describe, it, expect } from 'vitest';
import {
  CalculationHelpers,
  formatNumber,
  formatDuration,
  calculateDataPoints
} from '@modules/analytics/utils/calculation-helpers';
import type { TimeSeriesData } from '@modules/analytics/types/analytics-types';

describe('CalculationHelpers', () => {
  describe('calculateBasicStats', () => {
    test('should calculate correct statistics for a simple dataset', () => {
      const values = [1, 2, 3, 4, 5];
      const stats = CalculationHelpers.calculateBasicStats(values);

      expect(stats.count).toBe(5);
      expect(stats.sum).toBe(15);
      expect(stats.mean).toBe(3);
      expect(stats.median).toBe(3);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(5);
      expect(stats.range).toBe(4);
      expect(stats.variance).toBeCloseTo(2, 1);
      expect(stats.standardDeviation).toBeCloseTo(1.41, 2);
    });

    test('should handle empty array gracefully', () => {
      const stats = CalculationHelpers.calculateBasicStats([]);

      expect(stats.count).toBe(0);
      expect(stats.sum).toBe(0);
      expect(stats.mean).toBe(0);
      expect(stats.median).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
    });

    test('should calculate mode correctly', () => {
      const values = [1, 2, 2, 3, 4, 2, 5];
      const stats = CalculationHelpers.calculateBasicStats(values);

      expect(stats.mode).toBe(2);
    });

    test('should handle single value', () => {
      const stats = CalculationHelpers.calculateBasicStats([42]);

      expect(stats.count).toBe(1);
      expect(stats.sum).toBe(42);
      expect(stats.mean).toBe(42);
      expect(stats.median).toBe(42);
      expect(stats.variance).toBe(0);
      expect(stats.standardDeviation).toBe(0);
    });

    test('should calculate median correctly for even count', () => {
      const values = [1, 2, 3, 4];
      const stats = CalculationHelpers.calculateBasicStats(values);

      expect(stats.median).toBe(2.5); // (2 + 3) / 2
    });

    test('should calculate median correctly for odd count', () => {
      const values = [1, 2, 3, 4, 5];
      const stats = CalculationHelpers.calculateBasicStats(values);

      expect(stats.median).toBe(3);
    });

    test('should handle negative numbers', () => {
      const values = [-5, -2, 0, 3, 10];
      const stats = CalculationHelpers.calculateBasicStats(values);

      expect(stats.mean).toBeCloseTo(1.2, 1);
      expect(stats.median).toBe(0);
      expect(stats.min).toBe(-5);
      expect(stats.max).toBe(10);
    });

    test('should handle decimal values', () => {
      const values = [1.5, 2.3, 3.7, 4.1];
      const stats = CalculationHelpers.calculateBasicStats(values);

      expect(stats.mean).toBeCloseTo(2.9, 1);
      expect(stats.sum).toBeCloseTo(11.6, 1);
    });
  });

  describe('calculatePercentile', () => {
    test('should calculate 50th percentile (median)', () => {
      const values = [1, 2, 3, 4, 5];
      const p50 = CalculationHelpers.calculatePercentile(values, 50);

      expect(p50).toBe(3);
    });

    test('should calculate 95th percentile', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      const p95 = CalculationHelpers.calculatePercentile(values, 95);

      expect(p95).toBeCloseTo(95, 0);
    });

    test('should calculate 25th percentile (Q1)', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8];
      const q1 = CalculationHelpers.calculatePercentile(values, 25);

      expect(q1).toBeCloseTo(2.75, 2);
    });

    test('should calculate 75th percentile (Q3)', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8];
      const q3 = CalculationHelpers.calculatePercentile(values, 75);

      expect(q3).toBeCloseTo(6.25, 2);
    });

    test('should throw error for percentile < 0', () => {
      expect(() => CalculationHelpers.calculatePercentile([1, 2, 3], -10))
        .toThrow('Percentile must be between 0 and 100');
    });

    test('should throw error for percentile > 100', () => {
      expect(() => CalculationHelpers.calculatePercentile([1, 2, 3], 150))
        .toThrow('Percentile must be between 0 and 100');
    });

    test('should return 0 for empty array', () => {
      const result = CalculationHelpers.calculatePercentile([], 50);
      expect(result).toBe(0);
    });

    test('should handle single value', () => {
      const result = CalculationHelpers.calculatePercentile([42], 50);
      expect(result).toBe(42);
    });
  });

  describe('calculateMovingAverage', () => {
    const testData: TimeSeriesData[] = [
      { timestamp: '2024-01-01', value: 10, label: 'Day 1' },
      { timestamp: '2024-01-02', value: 20, label: 'Day 2' },
      { timestamp: '2024-01-03', value: 30, label: 'Day 3' },
      { timestamp: '2024-01-04', value: 40, label: 'Day 4' },
      { timestamp: '2024-01-05', value: 50, label: 'Day 5' }
    ];

    test('should calculate moving average with window size 3', () => {
      const result = CalculationHelpers.calculateMovingAverage(testData, 3);

      expect(result).toHaveLength(3);
      expect(result[0].value).toBe(20); // (10 + 20 + 30) / 3
      expect(result[1].value).toBe(30); // (20 + 30 + 40) / 3
      expect(result[2].value).toBe(40); // (30 + 40 + 50) / 3
    });

    test('should return empty array for window size > data length', () => {
      const result = CalculationHelpers.calculateMovingAverage(testData, 10);
      expect(result).toEqual([]);
    });

    test('should return empty array for window size <= 0', () => {
      const result = CalculationHelpers.calculateMovingAverage(testData, 0);
      expect(result).toEqual([]);
    });

    test('should include metadata in results', () => {
      const result = CalculationHelpers.calculateMovingAverage(testData, 2);

      expect(result[0].metadata).toBeDefined();
      expect(result[0].metadata?.windowSize).toBe(2);
      expect(result[0].metadata?.samples).toBe(2);
      expect(result[0].label).toBe('MA(2)');
    });

    test('should calculate MA(1) as same values', () => {
      const result = CalculationHelpers.calculateMovingAverage(testData, 1);

      expect(result).toHaveLength(testData.length);
      result.forEach((item, i) => {
        expect(item.value).toBe(testData[i].value);
      });
    });
  });

  describe('calculateExponentialMovingAverage', () => {
    const testData: TimeSeriesData[] = [
      { timestamp: '2024-01-01', value: 10, label: 'Day 1' },
      { timestamp: '2024-01-02', value: 20, label: 'Day 2' },
      { timestamp: '2024-01-03', value: 30, label: 'Day 3' }
    ];

    test('should calculate EMA with alpha = 0.5', () => {
      const result = CalculationHelpers.calculateExponentialMovingAverage(testData, 0.5);

      expect(result).toHaveLength(3);
      expect(result[0].value).toBe(10); // First value
      expect(result[1].value).toBe(15); // 0.5 * 20 + 0.5 * 10
      expect(result[2].value).toBe(22.5); // 0.5 * 30 + 0.5 * 15
    });

    test('should throw error for alpha < 0', () => {
      expect(() => CalculationHelpers.calculateExponentialMovingAverage(testData, -0.1))
        .toThrow('Alpha must be between 0 and 1');
    });

    test('should throw error for alpha > 1', () => {
      expect(() => CalculationHelpers.calculateExponentialMovingAverage(testData, 1.5))
        .toThrow('Alpha must be between 0 and 1');
    });

    test('should return empty array for empty data', () => {
      const result = CalculationHelpers.calculateExponentialMovingAverage([], 0.5);
      expect(result).toEqual([]);
    });

    test('should handle alpha = 1 (no smoothing)', () => {
      const result = CalculationHelpers.calculateExponentialMovingAverage(testData, 1);

      // Alpha = 1 means current value only
      result.forEach((item, i) => {
        expect(item.value).toBe(testData[i].value);
      });
    });

    test('should handle alpha = 0 (maximum smoothing)', () => {
      const result = CalculationHelpers.calculateExponentialMovingAverage(testData, 0);

      // Alpha = 0 means all previous, first value propagates
      expect(result[0].value).toBe(10);
      expect(result[1].value).toBe(10);
      expect(result[2].value).toBe(10);
    });
  });

  describe('calculateLinearTrend', () => {
    test('should detect increasing trend', () => {
      const data: TimeSeriesData[] = [
        { timestamp: '2024-01-01', value: 10, label: 'Day 1' },
        { timestamp: '2024-01-02', value: 20, label: 'Day 2' },
        { timestamp: '2024-01-03', value: 30, label: 'Day 3' },
        { timestamp: '2024-01-04', value: 40, label: 'Day 4' }
      ];

      const trend = CalculationHelpers.calculateLinearTrend(data);

      expect(trend.slope).toBeGreaterThan(0);
      expect(trend.trend).toBe('increasing');
      expect(trend.r2).toBeGreaterThan(0.95); // Should be very strong
      expect(trend.trendStrength).toBe('strong');
    });

    test('should detect decreasing trend', () => {
      const data: TimeSeriesData[] = [
        { timestamp: '2024-01-01', value: 40, label: 'Day 1' },
        { timestamp: '2024-01-02', value: 30, label: 'Day 2' },
        { timestamp: '2024-01-03', value: 20, label: 'Day 3' },
        { timestamp: '2024-01-04', value: 10, label: 'Day 4' }
      ];

      const trend = CalculationHelpers.calculateLinearTrend(data);

      expect(trend.slope).toBeLessThan(0);
      expect(trend.trend).toBe('decreasing');
    });

    test('should detect stable trend', () => {
      const data: TimeSeriesData[] = [
        { timestamp: '2024-01-01', value: 25, label: 'Day 1' },
        { timestamp: '2024-01-02', value: 25.001, label: 'Day 2' },
        { timestamp: '2024-01-03', value: 24.999, label: 'Day 3' }
      ];

      const trend = CalculationHelpers.calculateLinearTrend(data);

      expect(trend.trend).toBe('stable');
    });

    test('should make predictions', () => {
      const data: TimeSeriesData[] = [
        { timestamp: '2024-01-01T00:00:00Z', value: 10, label: 'Day 1' },
        { timestamp: '2024-01-02T00:00:00Z', value: 20, label: 'Day 2' },
        { timestamp: '2024-01-03T00:00:00Z', value: 30, label: 'Day 3' }
      ];

      const trend = CalculationHelpers.calculateLinearTrend(data);
      const prediction = trend.prediction('2024-01-04T00:00:00Z');

      expect(prediction).toBeGreaterThan(30); // Should predict higher
      expect(prediction).toBeCloseTo(40, 0); // Should be around 40
    });

    test('should handle insufficient data', () => {
      const data: TimeSeriesData[] = [
        { timestamp: '2024-01-01', value: 10, label: 'Day 1' }
      ];

      const trend = CalculationHelpers.calculateLinearTrend(data);

      expect(trend.slope).toBe(0);
      expect(trend.r2).toBe(0);
      expect(trend.trend).toBe('stable');
      expect(trend.trendStrength).toBe('weak');
    });
  });

  describe('detectAnomalies', () => {
    const normalData = [10, 12, 11, 13, 12, 11, 10, 12, 13, 11];

    test('should detect anomalies using IQR method', () => {
      const dataWithAnomaly = [...normalData, 100]; // Clear anomaly
      const result = CalculationHelpers.detectAnomalies(dataWithAnomaly, 'iqr');

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies[0].value).toBe(100);
      expect(result.statistics.q1).toBeDefined();
      expect(result.statistics.q3).toBeDefined();
      expect(result.statistics.iqr).toBeDefined();
    });

    test('should detect anomalies using Z-score method', () => {
      const dataWithAnomaly = [...normalData, 50];
      const result = CalculationHelpers.detectAnomalies(dataWithAnomaly, 'zscore');

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies[0].score).toBeGreaterThan(2.5);
    });

    test('should detect anomalies using modified Z-score method', () => {
      const dataWithAnomaly = [...normalData, 80];
      const result = CalculationHelpers.detectAnomalies(dataWithAnomaly, 'modified_zscore');

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.statistics.mad).toBeDefined();
    });

    test('should return no anomalies for normal data', () => {
      const result = CalculationHelpers.detectAnomalies(normalData, 'iqr');

      expect(result.anomalies.length).toBe(0);
    });

    test('should handle empty array', () => {
      const result = CalculationHelpers.detectAnomalies([], 'iqr');

      expect(result.anomalies).toEqual([]);
      expect(result.statistics).toEqual({});
    });

    test('should sort anomalies by score descending', () => {
      const dataWithMultipleAnomalies = [...normalData, 30, 40, 50];
      const result = CalculationHelpers.detectAnomalies(dataWithMultipleAnomalies, 'iqr');

      if (result.anomalies.length > 1) {
        for (let i = 0; i < result.anomalies.length - 1; i++) {
          expect(result.anomalies[i].score).toBeGreaterThanOrEqual(
            result.anomalies[i + 1].score
          );
        }
      }
    });
  });

  describe('calculateGrowthRate', () => {
    test('should calculate percentage growth rate', () => {
      const rate = CalculationHelpers.calculateGrowthRate(120, 100, 'percentage');
      expect(rate).toBe(20); // 20% increase
    });

    test('should calculate negative growth rate', () => {
      const rate = CalculationHelpers.calculateGrowthRate(80, 100, 'percentage');
      expect(rate).toBe(-20); // 20% decrease
    });

    test('should calculate absolute growth', () => {
      const rate = CalculationHelpers.calculateGrowthRate(150, 100, 'absolute');
      expect(rate).toBe(50);
    });

    test('should handle zero previous value', () => {
      const rate = CalculationHelpers.calculateGrowthRate(100, 0, 'percentage');
      expect(rate).toBe(0);
    });

    test('should calculate compound growth', () => {
      const rate = CalculationHelpers.calculateGrowthRate(121, 100, 'compound');
      expect(rate).toBeCloseTo(0.21, 2);
    });
  });

  describe('calculateCorrelation', () => {
    test('should calculate perfect positive correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      const result = CalculationHelpers.calculateCorrelation(x, y);

      expect(result.pearson).toBeCloseTo(1, 2);
      expect(result.interpretation).toContain('positive');
    });

    test('should calculate perfect negative correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [10, 8, 6, 4, 2];
      const result = CalculationHelpers.calculateCorrelation(x, y);

      expect(result.pearson).toBeCloseTo(-1, 2);
      expect(result.interpretation).toContain('negative');
    });

    test('should calculate no correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [3, 1, 4, 2, 5]; // Random order
      const result = CalculationHelpers.calculateCorrelation(x, y);

      // 允许较弱的相关性（moderate or below）
      expect(Math.abs(result.pearson)).toBeLessThanOrEqual(0.7);
    });

    test('should handle mismatched array lengths', () => {
      const x = [1, 2, 3];
      const y = [1, 2];
      const result = CalculationHelpers.calculateCorrelation(x, y);

      expect(result.pearson).toBe(0);
      expect(result.spearman).toBe(0);
      expect(result.interpretation).toBe('insufficient data');
    });

    test('should handle insufficient data (< 2 points)', () => {
      const x = [1];
      const y = [1];
      const result = CalculationHelpers.calculateCorrelation(x, y);

      expect(result.interpretation).toBe('insufficient data');
    });
  });
});

describe('formatNumber', () => {
  test('should format number with default decimals', () => {
    expect(formatNumber(123.456)).toBe('123.46');
  });

  test('should format number with custom decimals', () => {
    expect(formatNumber(123.456, { decimals: 1 })).toBe('123.5');
  });

  test('should format number with unit', () => {
    expect(formatNumber(100, { unit: 'kg' })).toBe('100.00kg');
  });

  test('should format percentage', () => {
    expect(formatNumber(0.5, { percentage: true })).toBe('50.00%');
  });

  test('should format in compact mode (K)', () => {
    expect(formatNumber(1500, { compact: true, decimals: 1 })).toBe('1.5K');
  });

  test('should format in compact mode (M)', () => {
    expect(formatNumber(1500000, { compact: true, decimals: 1 })).toBe('1.5M');
  });

  test('should format in compact mode (B)', () => {
    expect(formatNumber(2500000000, { compact: true, decimals: 1 })).toBe('2.5B');
  });

  test('should handle negative numbers', () => {
    expect(formatNumber(-123.45, { decimals: 1 })).toBe('-123.5');
  });

  test('should handle zero', () => {
    expect(formatNumber(0)).toBe('0.00');
  });

  test('should combine compact, percentage, and unit', () => {
    const result = formatNumber(15000, {
      compact: true,
      percentage: true,
      unit: 'pts',
      decimals: 1
    });
    // 15000 * 100 = 1,500,000 -> 1.5M
    expect(result).toContain('M'); // Not 'K' because percentage multiplies by 100
    expect(result).toContain('%');
    expect(result).toContain('pts');
  });
});

describe('formatDuration', () => {
  test('should format seconds', () => {
    expect(formatDuration(30)).toBe('30s');
  });

  test('should format minutes', () => {
    expect(formatDuration(120)).toBe('2m');
  });

  test('should format hours', () => {
    expect(formatDuration(7200)).toBe('2h');
  });

  test('should format days', () => {
    expect(formatDuration(172800)).toBe('2d');
  });

  test('should round fractional seconds', () => {
    expect(formatDuration(45.7)).toBe('46s');
  });

  test('should round fractional minutes', () => {
    expect(formatDuration(90)).toBe('2m'); // 1.5 minutes -> 2m
  });

  test('should handle zero', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  test('should handle large durations', () => {
    expect(formatDuration(1000000)).toBe('12d'); // ~11.57 days
  });
});

describe('calculateDataPoints', () => {
  test('should calculate data points for 1-hour interval', () => {
    const startTime = '2024-01-01T00:00:00Z';
    const endTime = '2024-01-01T05:00:00Z'; // 5 hours
    const points = calculateDataPoints(startTime, endTime, '1h');

    expect(points).toBe(5);
  });

  test('should calculate data points for 1-minute interval', () => {
    const startTime = '2024-01-01T00:00:00Z';
    const endTime = '2024-01-01T00:30:00Z'; // 30 minutes
    const points = calculateDataPoints(startTime, endTime, '1m');

    expect(points).toBe(30);
  });

  test('should calculate data points for 1-day interval', () => {
    const startTime = '2024-01-01T00:00:00Z';
    const endTime = '2024-01-08T00:00:00Z'; // 7 days
    const points = calculateDataPoints(startTime, endTime, '1d');

    expect(points).toBe(7);
  });

  test('should use 1m as default interval for unknown intervals', () => {
    const startTime = '2024-01-01T00:00:00Z';
    const endTime = '2024-01-01T00:10:00Z'; // 10 minutes
    const points = calculateDataPoints(startTime, endTime, 'unknown');

    expect(points).toBe(10); // 10 minutes at 1m interval
  });

  test('should round up partial intervals', () => {
    const startTime = '2024-01-01T00:00:00Z';
    const endTime = '2024-01-01T00:02:30Z'; // 2.5 minutes
    const points = calculateDataPoints(startTime, endTime, '1m');

    expect(points).toBe(3); // Rounds up to 3
  });

  test('should handle same start and end time', () => {
    const time = '2024-01-01T00:00:00Z';
    const points = calculateDataPoints(time, time, '1h');

    expect(points).toBe(0);
  });
});
