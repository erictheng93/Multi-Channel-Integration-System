// Calculation Helpers - 分析計算輔助函數
// 整合原有的統計計算邏輯

import type { TimeSeriesData, DistributionData, ComparisonData } from '@modules/analytics/types/analytics-types';

/**
 * 統計計算輔助函數集合
 */
export class CalculationHelpers {
  /**
   * 計算基本統計數據
   */
  static calculateBasicStats(values: number[]): {
    count: number;
    sum: number;
    mean: number;
    median: number;
    mode: number;
    min: number;
    max: number;
    range: number;
    variance: number;
    standardDeviation: number;
    q1?: number;
    q3?: number;
    iqr?: number;
    lowerBound?: number;
    upperBound?: number;
    mad?: number;
  } {
    if (values.length === 0) {
      return {
        count: 0,
        sum: 0,
        mean: 0,
        median: 0,
        mode: 0,
        min: 0,
        max: 0,
        range: 0,
        variance: 0,
        standardDeviation: 0
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / count;

    // 中位數
    const median = count % 2 === 0
      ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
      : sorted[Math.floor(count / 2)];

    // 眾數
    const frequency = new Map<number, number>();
    values.forEach(val => {
      frequency.set(val, (frequency.get(val) || 0) + 1);
    });
    let maxFreq = 0;
    let mode = values[0];
    frequency.forEach((freq, val) => {
      if (freq > maxFreq) {
        maxFreq = freq;
        mode = val;
      }
    });

    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const range = max - min;

    // 方差和標準差
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
    const standardDeviation = Math.sqrt(variance);

    return {
      count,
      sum,
      mean,
      median,
      mode,
      min,
      max,
      range,
      variance,
      standardDeviation
    };
  }

  /**
   * 計算百分位數
   */
  static calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    if (percentile < 0 || percentile > 100) throw new Error('Percentile must be between 0 and 100');

    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    return lower === upper
      ? sorted[lower]
      : sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * 計算移動平均
   */
  static calculateMovingAverage(data: TimeSeriesData[], windowSize: number): TimeSeriesData[] {
    if (windowSize <= 0 || windowSize > data.length) {
      return [];
    }

    const result: TimeSeriesData[] = [];

    for (let i = windowSize - 1; i < data.length; i++) {
      const window = data.slice(i - windowSize + 1, i + 1);
      const average = window.reduce((sum, item) => sum + item.value, 0) / windowSize;

      result.push({
        timestamp: data[i].timestamp,
        value: average,
        label: `MA(${windowSize})`,
        metadata: {
          originalValue: data[i].value,
          windowSize,
          samples: window.length
        }
      });
    }

    return result;
  }

  /**
   * 計算指數移動平均 (EMA)
   */
  static calculateExponentialMovingAverage(data: TimeSeriesData[], alpha: number): TimeSeriesData[] {
    if (alpha < 0 || alpha > 1) {
      throw new Error('Alpha must be between 0 and 1');
    }

    if (data.length === 0) return [];

    const result: TimeSeriesData[] = [];
    let ema = data[0].value; // 初始值使用第一個數據點

    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        ema = data[i].value;
      } else {
        ema = alpha * data[i].value + (1 - alpha) * ema;
      }

      result.push({
        timestamp: data[i].timestamp,
        value: ema,
        label: `EMA(${alpha})`,
        metadata: {
          originalValue: data[i].value,
          alpha,
          smoothingFactor: alpha
        }
      });
    }

    return result;
  }

  /**
   * 計算線性趨勢
   */
  static calculateLinearTrend(data: TimeSeriesData[]): {
    slope: number;
    intercept: number;
    r2: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    trendStrength: 'strong' | 'moderate' | 'weak';
    prediction: (timestamp: string) => number;
  } {
    if (data.length < 2) {
      return {
        slope: 0,
        intercept: 0,
        r2: 0,
        trend: 'stable',
        trendStrength: 'weak',
        prediction: () => 0
      };
    }

    // 轉換時間戳為數值
    const points = data.map((d, i) => ({
      x: i, // 使用索引作為 x 值
      y: d.value,
      timestamp: new Date(d.timestamp).getTime()
    }));

    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);
    const sumYY = points.reduce((sum, p) => sum + p.y * p.y, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // 計算 R²
    const meanY = sumY / n;
    const totalVariation = points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
    const residualVariation = points.reduce((sum, p) => {
      const predicted = slope * p.x + intercept;
      return sum + Math.pow(p.y - predicted, 2);
    }, 0);
    const r2 = totalVariation > 0 ? 1 - (residualVariation / totalVariation) : 0;

    // 判斷趨勢
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(slope) > 0.01) { // 設定最小閾值避免噪音
      trend = slope > 0 ? 'increasing' : 'decreasing';
    }

    // 判斷趨勢強度
    let trendStrength: 'strong' | 'moderate' | 'weak' = 'weak';
    if (r2 > 0.7) {
      trendStrength = 'strong';
    } else if (r2 > 0.4) {
      trendStrength = 'moderate';
    }

    // 預測函數
    const prediction = (timestamp: string): number => {
      const targetTime = new Date(timestamp).getTime();
      const timeRange = points[points.length - 1].timestamp - points[0].timestamp;
      const timeStep = timeRange / (points.length - 1);
      const x = (targetTime - points[0].timestamp) / timeStep;
      return slope * x + intercept;
    };

    return {
      slope,
      intercept,
      r2,
      trend,
      trendStrength,
      prediction
    };
  }

  /**
   * 檢測異常值
   */
  static detectAnomalies(values: number[], method: 'iqr' | 'zscore' | 'modified_zscore' = 'iqr'): {
    anomalies: { index: number; value: number; score: number }[];
    statistics: any;
  } {
    if (values.length === 0) {
      return { anomalies: [], statistics: {} };
    }

    const statistics = this.calculateBasicStats(values);
    const anomalies: { index: number; value: number; score: number }[] = [];

    switch (method) {
      case 'iqr': {
        const q1 = this.calculatePercentile(values, 25);
        const q3 = this.calculatePercentile(values, 75);
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;

        values.forEach((value, index) => {
          if (value < lowerBound || value > upperBound) {
            const score = Math.max(
              Math.abs(value - lowerBound) / iqr,
              Math.abs(value - upperBound) / iqr
            );
            anomalies.push({ index, value, score });
          }
        });

        statistics.q1 = q1;
        statistics.q3 = q3;
        statistics.iqr = iqr;
        statistics.lowerBound = lowerBound;
        statistics.upperBound = upperBound;
        break;
      }

      case 'zscore': {
        const mean = statistics.mean;
        const stdDev = statistics.standardDeviation;

        values.forEach((value, index) => {
          const zscore = Math.abs(value - mean) / stdDev;
          if (zscore > 2.5) { // 通常使用 2.5 或 3 作為閾值
            anomalies.push({ index, value, score: zscore });
          }
        });
        break;
      }

      case 'modified_zscore': {
        const median = statistics.median;
        const deviations = values.map(v => Math.abs(v - median));
        const mad = this.calculateBasicStats(deviations).median; // Median Absolute Deviation

        values.forEach((value, index) => {
          const modifiedZScore = 0.6745 * (value - median) / mad;
          if (Math.abs(modifiedZScore) > 3.5) {
            anomalies.push({ index, value, score: Math.abs(modifiedZScore) });
          }
        });

        statistics.mad = mad;
        break;
      }
    }

    return {
      anomalies: anomalies.sort((a, b) => b.score - a.score),
      statistics
    };
  }

  /**
   * 計算季節性調整
   */
  static calculateSeasonality(data: TimeSeriesData[], period: number): {
    seasonal: TimeSeriesData[];
    trend: TimeSeriesData[];
    residual: TimeSeriesData[];
    seasonalFactors: number[];
  } {
    if (data.length < period * 2) {
      // 數據不足以進行季節性分解
      return {
        seasonal: [],
        trend: [],
        residual: [],
        seasonalFactors: []
      };
    }

    // 簡化的季節性分解 (加法模型: Y = Trend + Seasonal + Residual)

    // 1. 計算趨勢 (使用移動平均)
    const trend = this.calculateMovingAverage(data, period);

    // 2. 計算季節性成分
    const seasonalFactors: number[] = new Array(period).fill(0);
    const seasonalCounts: number[] = new Array(period).fill(0);

    for (let i = 0; i < data.length; i++) {
      const seasonIndex = i % period;
      const trendIndex = Math.min(i, trend.length - 1);
      if (trendIndex >= 0 && trend[trendIndex]) {
        const detrended = data[i].value - trend[trendIndex].value;
        seasonalFactors[seasonIndex] += detrended;
        seasonalCounts[seasonIndex]++;
      }
    }

    // 平均化季節性因子
    for (let i = 0; i < period; i++) {
      if (seasonalCounts[i] > 0) {
        seasonalFactors[i] /= seasonalCounts[i];
      }
    }

    // 3. 生成季節性序列
    const seasonal: TimeSeriesData[] = data.map((d, i) => ({
      timestamp: d.timestamp,
      value: seasonalFactors[i % period],
      label: 'Seasonal',
      metadata: { period, seasonIndex: i % period }
    }));

    // 4. 計算殘差
    const residual: TimeSeriesData[] = data.map((d, i) => {
      const trendValue = i < trend.length ? trend[i].value : 0;
      const seasonalValue = seasonal[i].value;
      return {
        timestamp: d.timestamp,
        value: d.value - trendValue - seasonalValue,
        label: 'Residual',
        metadata: {
          original: d.value,
          trend: trendValue,
          seasonal: seasonalValue
        }
      };
    });

    return {
      seasonal,
      trend,
      residual,
      seasonalFactors
    };
  }

  /**
   * 計算相關係數
   */
  static calculateCorrelation(x: number[], y: number[]): {
    pearson: number;
    spearman: number;
    interpretation: string;
  } {
    if (x.length !== y.length || x.length < 2) {
      return { pearson: 0, spearman: 0, interpretation: 'insufficient data' };
    }

    // Pearson 相關係數
    const pearson = this.calculatePearsonCorrelation(x, y);

    // Spearman 秩相關係數 (對秩應用 Pearson 公式)
    const xRanks = this.getRanks(x);
    const yRanks = this.getRanks(y);
    const spearman = this.calculatePearsonCorrelation(xRanks, yRanks);

    // 解釋相關強度
    const absValue = Math.abs(pearson);
    let interpretation: string;
    if (absValue >= 0.9) {
      interpretation = 'very strong';
    } else if (absValue >= 0.7) {
      interpretation = 'strong';
    } else if (absValue >= 0.5) {
      interpretation = 'moderate';
    } else if (absValue >= 0.3) {
      interpretation = 'weak';
    } else {
      interpretation = 'very weak or no';
    }

    interpretation += pearson >= 0 ? ' positive correlation' : ' negative correlation';

    return { pearson, spearman, interpretation };
  }

  /**
   * 計算增長率
   */
  static calculateGrowthRate(
    current: number,
    previous: number,
    type: 'percentage' | 'absolute' | 'compound' = 'percentage'
  ): number {
    if (previous === 0) return 0;

    switch (type) {
      case 'percentage':
        return ((current - previous) / previous) * 100;

      case 'absolute':
        return current - previous;

      case 'compound':
        return Math.pow(current / previous, 1) - 1; // 對於單期，等同於百分比增長

      default:
        return 0;
    }
  }

  /**
   * 計算累積分佈函數 (CDF)
   */
  static calculateCDF(values: number[]): { value: number; cdf: number }[] {
    if (values.length === 0) return [];

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    return sorted.map((value, index) => ({
      value,
      cdf: (index + 1) / n
    }));
  }

  // 私有輔助方法

  /**
   * 計算 Pearson 相關係數 (私有輔助方法)
   */
  private static calculatePearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) {
      return 0;
    }

    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private static getRanks(values: number[]): number[] {
    const indexed = values.map((value, index) => ({ value, index }));
    indexed.sort((a, b) => a.value - b.value);

    const ranks = new Array(values.length);
    for (let i = 0; i < indexed.length; i++) {
      ranks[indexed[i].index] = i + 1;
    }

    return ranks;
  }
}

/**
 * 格式化數值顯示
 */
export function formatNumber(
  value: number,
  options: {
    decimals?: number;
    unit?: string;
    compact?: boolean;
    percentage?: boolean;
  } = {}
): string {
  const { decimals = 2, unit = '', compact = false, percentage = false } = options;

  let formattedValue = value;

  if (percentage) {
    formattedValue = value * 100;
  }

  if (compact && Math.abs(formattedValue) >= 1000) {
    const units = ['', 'K', 'M', 'B', 'T'];
    const unitIndex = Math.floor(Math.log10(Math.abs(formattedValue)) / 3);
    formattedValue = formattedValue / Math.pow(1000, unitIndex);
    return `${formattedValue.toFixed(decimals)}${units[unitIndex]}${unit}${percentage ? '%' : ''}`;
  }

  return `${formattedValue.toFixed(decimals)}${unit}${percentage ? '%' : ''}`;
}

/**
 * 格式化時間差
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  } else if (seconds < 86400) {
    return `${Math.round(seconds / 3600)}h`;
  } else {
    return `${Math.round(seconds / 86400)}d`;
  }
}

/**
 * 計算時間範圍內的數據點數
 */
export function calculateDataPoints(
  startTime: string,
  endTime: string,
  interval: string
): number {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const duration = end - start;

  const intervalMs = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000
  }[interval] || 60 * 1000;

  return Math.ceil(duration / intervalMs);
}

export default CalculationHelpers;