// 統一健康檢查服務
import type {
  SystemHealth,
  HealthCheckResult,
  ComponentHealth,
  HealthChecker,
  HealthLevel,
} from '../types/health-check';
import { nowISO, nowMs } from '@/utils/timestamp'

export class HealthCheckService {
  private checkers: Map<string, HealthChecker> = new Map();
  private results: Map<string, HealthCheckResult> = new Map();
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map();

  constructor() {
    this.initializeStandardCheckers();
  }

  /**
   * 註冊健康檢查器
   */
  registerChecker(checker: HealthChecker): void {
    this.checkers.set(checker.name, checker);
    this.startPeriodicCheck(checker);
  }

  /**
   * 執行單一檢查
   */
  async runCheck(checkerName: string): Promise<HealthCheckResult> {
    const checker = this.checkers.get(checkerName);
    if (!checker) {
      throw new Error(`Health checker '${checkerName}' not found`);
    }

    const startTime = nowMs();
    try {
      const result = await this.executeWithTimeout(
        checker.check(),
        checker.getConfig().timeout
      );

      result.responseTime = Date.now() - startTime;
      result.timestamp = nowISO();

      this.results.set(checkerName, result);
      return result;
    } catch (error) {
      const errorResult: HealthCheckResult = {
        status: 'critical',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: nowISO(),
        responseTime: Date.now() - startTime
      };

      this.results.set(checkerName, errorResult);
      return errorResult;
    }
  }

  /**
   * 執行所有檢查
   */
  async runAllChecks(): Promise<SystemHealth> {
    const checkPromises = Array.from(this.checkers.keys()).map(name =>
      this.runCheck(name)
    );

    const results = await Promise.allSettled(checkPromises);

    return this.buildSystemHealth(results);
  }

  /**
   * 獲取系統健康狀態
   */
  async getSystemHealth(): Promise<SystemHealth> {
    // 如果有快取結果且還新鮮，直接返回
    const cachedResults = this.getCachedResults();
    if (cachedResults.length > 0) {
      return this.buildSystemHealthFromCache();
    }

    // 否則執行所有檢查
    return this.runAllChecks();
  }

  /**
   * 獲取特定層級的健康狀態
   */
  async getHealthByLevel(level: HealthLevel): Promise<ComponentHealth[]> {
    const levelCheckers = Array.from(this.checkers.values())
      .filter(checker => checker.level === level);

    const results = await Promise.all(
      levelCheckers.map(async checker => {
        const result = await this.runCheck(checker.name);
        return {
          component: checker.name,
          version: '1.0.0', // 可以從配置中獲取
          status: result,
          lastCheck: result.timestamp,
          checkInterval: checker.getConfig().interval
        };
      })
    );

    return results;
  }

  /**
   * 啟動週期性檢查
   */
  private startPeriodicCheck(checker: HealthChecker): void {
    const config = checker.getConfig();
    if (!config.enabled) return;

    const intervalId = setInterval(() => {
      this.runCheck(checker.name).catch(error => {
        console.error(`Periodic health check failed for ${checker.name}:`, error);
      });
    }, config.interval * 1000);

    this.intervals.set(checker.name, intervalId);
  }

  /**
   * 停止週期性檢查
   */
  private stopPeriodicCheck(checkerName: string): void {
    const intervalId = this.intervals.get(checkerName);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(checkerName);
    }
  }

  /**
   * 帶超時的執行
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * 建構系統健康狀態
   */
  private buildSystemHealth(results: PromiseSettledResult<HealthCheckResult>[]): SystemHealth {
    // 計算整體狀態
    const overallStatus = this.calculateOverallStatus(results);

    // 建構組件健康狀態
    const components = this.buildComponentsHealth();

    return {
      overall: {
        status: overallStatus,
        message: this.getOverallMessage(overallStatus),
        timestamp: nowISO()
      },
      components,
      infrastructure: this.buildInfrastructureHealth(),
      performance: this.buildPerformanceMetrics()
    };
  }

  /**
   * 從快取建構系統健康狀態
   */
  private buildSystemHealthFromCache(): SystemHealth {
    const cachedResults = Array.from(this.results.values());
    const overallStatus = this.calculateOverallStatusFromResults(cachedResults);

    return {
      overall: {
        status: overallStatus,
        message: this.getOverallMessage(overallStatus),
        timestamp: nowISO()
      },
      components: this.buildComponentsHealth(),
      infrastructure: this.buildInfrastructureHealth(),
      performance: this.buildPerformanceMetrics()
    };
  }

  /**
   * 計算整體狀態
   */
  private calculateOverallStatus(
    results: PromiseSettledResult<HealthCheckResult>[]
  ): 'healthy' | 'warning' | 'critical' | 'unknown' {
    const statuses = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<HealthCheckResult>).value.status);

    if (statuses.includes('critical')) return 'critical';
    if (statuses.includes('warning')) return 'warning';
    if (statuses.includes('unknown')) return 'unknown';
    return 'healthy';
  }

  /**
   * 從結果計算整體狀態
   */
  private calculateOverallStatusFromResults(
    results: HealthCheckResult[]
  ): 'healthy' | 'warning' | 'critical' | 'unknown' {
    const statuses = results.map(r => r.status);

    if (statuses.includes('critical')) return 'critical';
    if (statuses.includes('warning')) return 'warning';
    if (statuses.includes('unknown')) return 'unknown';
    return 'healthy';
  }

  /**
   * 獲取快取結果
   */
  private getCachedResults(): HealthCheckResult[] {
    return Array.from(this.results.values());
  }

  /**
   * 建構組件健康狀態
   */
  private buildComponentsHealth(): ComponentHealth[] {
    return Array.from(this.checkers.entries()).map(([name, checker]) => {
      const result = this.results.get(name) || {
        status: 'unknown' as const,
        message: 'Not checked yet',
        timestamp: nowISO()
      };

      return {
        component: name,
        version: '1.0.0',
        status: result,
        lastCheck: result.timestamp,
        checkInterval: checker.getConfig().interval
      };
    });
  }

  /**
   * 建構基礎設施健康狀態
   */
  private buildInfrastructureHealth() {
    return {
      database: this.getResultByChecker('database') || this.getUnknownResult('Database not checked'),
      cache: this.getResultByChecker('cache') || this.getUnknownResult('Cache not checked')
    };
  }

  /**
   * 建構效能指標
   */
  private buildPerformanceMetrics() {
    const results = Array.from(this.results.values());
    const responseTimes = results
      .filter(r => r.responseTime !== undefined)
      .map(r => r.responseTime!);

    return {
      apiResponseTime: responseTimes.length > 0 ?
        Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0,
      databaseQueryTime: 0, // 需要從資料庫檢查器獲取
      cacheHitRate: 0 // 需要從快取檢查器獲取
    };
  }

  /**
   * 根據檢查器名稱獲取結果
   */
  private getResultByChecker(checkerName: string): HealthCheckResult | undefined {
    return this.results.get(checkerName);
  }

  /**
   * 獲取未知狀態結果
   */
  private getUnknownResult(message: string): HealthCheckResult {
    return {
      status: 'unknown',
      message,
      timestamp: nowISO()
    };
  }

  /**
   * 獲取整體狀態訊息
   */
  private getOverallMessage(status: string): string {
    switch (status) {
      case 'healthy': return 'All systems operational';
      case 'warning': return 'Some components need attention';
      case 'critical': return 'Critical issues detected';
      default: return 'System status unknown';
    }
  }

  /**
   * 初始化標準檢查器
   */
  private initializeStandardCheckers(): void {
    // 這裡會註冊標準的檢查器
    // 實際的檢查器會在後續建立
  }

  /**
   * 清理資源
   */
  destroy(): void {
    // 停止所有週期性檢查
    this.intervals.forEach((_intervalId, checkerName) => {
      this.stopPeriodicCheck(checkerName);
    });

    // 清理資料
    this.checkers.clear();
    this.results.clear();
    this.intervals.clear();
  }
}

// 單例模式
export const healthCheckService = new HealthCheckService();
