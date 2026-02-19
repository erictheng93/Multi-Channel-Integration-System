// WebSocket Circuit Breaker Service
// 自動化容錯機制 - 故障隔離與自動恢復
// 🆕 Enhanced with structured logging, advanced degradation, and monitoring

import type { Bindings } from '../types';
import { Logger, LogLevel, createLogger, type LogContext } from './logger-service';
import { nowISO, nowMs } from '@/utils/timestamp'

/**
 * 斷路器狀態
 */
export enum CircuitState {
  CLOSED = 'CLOSED',     // 正常運行
  OPEN = 'OPEN',         // 斷路 (故障隔離)
  HALF_OPEN = 'HALF_OPEN' // 半開 (嘗試恢復)
}

/**
 * 降級策略類型
 */
export enum FallbackStrategy {
  POLLING = 'polling',          // 降級到輪詢
  QUEUE = 'queue',              // 隊列延遲處理
  FAIL_FAST = 'fail_fast',      // 快速失敗（不降級）
  RETRY_LATER = 'retry_later'   // 延遲重試
}

/**
 * 🆕 增強的斷路器配置
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;           // 失敗閾值 (連續失敗次數)
  successThreshold: number;           // 成功閾值 (恢復需要的成功次數)
  timeout: number;                    // 開路超時 (ms)
  halfOpenMaxCalls: number;           // 半開狀態最大測試調用數
  monitoringWindow: number;           // 監控時間窗口 (ms)

  // 🆕 降級策略
  fallbackStrategy: FallbackStrategy; // 默認降級策略
  enableAutoRecovery: boolean;        // 啟用自動恢復

  // 🆕 高級監控
  errorRateThreshold: number;         // 錯誤率閾值（0-1）
  latencyThreshold: number;           // 延遲閾值（ms）
  volumeThreshold: number;            // 最小請求量閾值（避免低流量誤判）
}

/**
 * 斷路器統計
 */
interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastStateChange: number;
  totalCalls: number;
  failedCalls: number;
  successfulCalls: number;
  rejectedCalls: number;
}

/**
 * 斷路器事件
 */
interface CircuitBreakerEvent {
  type: 'state_change' | 'failure' | 'success' | 'rejected';
  timestamp: string;
  state: CircuitState;
  details?: any;
}

/**
 * 🆕 增強的 WebSocket Circuit Breaker
 * 實現自動故障隔離、智能降級和恢復機制
 *
 * 新功能：
 * - 結構化日誌記錄
 * - 多種降級策略
 * - 錯誤率和延遲監控
 * - 自動恢復機制
 */
export class WebSocketCircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private lastStateChange: number = nowMs();
  private halfOpenCalls = 0;

  // 🆕 結構化日誌
  private logger: Logger;

  // 統計數據
  private stats: CircuitBreakerStats = {
    state: CircuitState.CLOSED,
    failureCount: 0,
    successCount: 0,
    lastStateChange: nowMs(),
    totalCalls: 0,
    failedCalls: 0,
    successfulCalls: 0,
    rejectedCalls: 0
  };

  private config: CircuitBreakerConfig;
  private env?: Bindings;
  private events: CircuitBreakerEvent[] = [];

  // 🆕 性能監控
  private latencyBuffer: number[] = [];
  private errorBuffer: boolean[] = [];

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold || 5,      // 連續 5 次失敗
      successThreshold: config?.successThreshold || 2,      // 2 次成功後恢復
      timeout: config?.timeout || 60000,                    // 1 分鐘
      halfOpenMaxCalls: config?.halfOpenMaxCalls || 3,      // 半開狀態允許 3 次測試
      monitoringWindow: config?.monitoringWindow || 300000, // 5 分鐘監控窗口

      // 🆕 降級策略配置
      fallbackStrategy: config?.fallbackStrategy || FallbackStrategy.QUEUE,
      enableAutoRecovery: config?.enableAutoRecovery !== false,

      // 🆕 高級監控配置
      errorRateThreshold: config?.errorRateThreshold || 0.25,  // 25% error rate
      latencyThreshold: config?.latencyThreshold || 3000,      // 3 seconds
      volumeThreshold: config?.volumeThreshold || 10           // 最少 10 個請求
    };

    // 🆕 初始化結構化日誌
    this.logger = createLogger({ service: 'Circuit-Breaker' }, {
      minLevel: LogLevel.INFO,
      serviceName: 'circuit-breaker'
    });

    this.logger.info('Circuit Breaker initialized', undefined, {
      config: this.config
    });
  }

  /**
   * 設置環境變數 (用於持久化)
   */
  setEnv(env: Bindings): void {
    this.env = env;
  }

  /**
   * 🆕 增強的執行操作 (帶斷路器保護和降級)
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
    operationContext?: LogContext
  ): Promise<T> {
    this.stats.totalCalls++;

    // 檢查斷路器狀態
    if (this.state === CircuitState.OPEN) {
      // 檢查是否應該嘗試恢復
      if (this.shouldAttemptReset()) {
        this.logger.info('Attempting circuit reset', operationContext);
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        // 斷路器開啟,直接拒絕請求
        this.stats.rejectedCalls++;
        this.recordEvent('rejected', { reason: 'Circuit breaker OPEN' });

        this.logger.warn('Request rejected - Circuit OPEN', operationContext, {
          rejectedCalls: this.stats.rejectedCalls,
          fallbackStrategy: this.config.fallbackStrategy
        });

        if (fallback) {
          this.logger.info('Using fallback strategy', operationContext, {
            strategy: this.config.fallbackStrategy
          });
          return await fallback();
        }

        throw new Error('Circuit breaker is OPEN - operation rejected');
      }
    }

    // 半開狀態下限制調用次數
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.stats.rejectedCalls++;

        this.logger.warn('Half-open call limit reached', operationContext, {
          halfOpenCalls: this.halfOpenCalls,
          maxCalls: this.config.halfOpenMaxCalls
        });

        if (fallback) {
          return await fallback();
        }
        throw new Error('Circuit breaker HALF_OPEN - max test calls reached');
      }
      this.halfOpenCalls++;
    }

    try {
      const startTime = nowMs();
      const result = await operation();
      const duration = Date.now() - startTime;

      // 操作成功
      this.onSuccess(duration, operationContext);
      return result;

    } catch (error) {
      // 操作失敗
      this.onFailure(error, operationContext);

      // 使用降級方案
      if (fallback) {
        this.logger.info('Operation failed, using fallback', operationContext, {
          error: error instanceof Error ? error.message : String(error)
        });
        return await fallback();
      }

      throw error;
    }
  }

  /**
   * 🆕 成功處理（帶性能監控）
   */
  private onSuccess(duration: number, context?: LogContext): void {
    this.stats.successfulCalls++;
    this.failureCount = 0; // 重置失敗計數
    this.successCount++;

    // 🆕 記錄延遲到緩衝區
    this.latencyBuffer.push(duration);
    this.errorBuffer.push(false);
    this.trimBuffers();

    this.recordEvent('success', { duration });

    // 🆕 檢查延遲是否超標
    if (duration > this.config.latencyThreshold) {
      this.logger.warn('High latency detected', context, {
        latency: duration,
        threshold: this.config.latencyThreshold
      });
    }

    // 半開狀態下成功達到閾值,關閉斷路器
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.config.successThreshold) {
        this.logger.info('Recovery successful, closing circuit', context, {
          successCount: this.successCount,
          threshold: this.config.successThreshold
        });
        this.transitionTo(CircuitState.CLOSED);
        this.successCount = 0;
        this.halfOpenCalls = 0;
      }
    }

    this.persistStats();
  }

  /**
   * 🆕 失敗處理（帶錯誤率監控）
   */
  private onFailure(error: any, context?: LogContext): void {
    this.stats.failedCalls++;
    this.failureCount++;
    this.lastFailureTime = nowMs();
    this.successCount = 0; // 重置成功計數

    // 🆕 記錄錯誤到緩衝區
    this.errorBuffer.push(true);
    this.trimBuffers();

    this.recordEvent('failure', {
      error: error instanceof Error ? error.message : String(error)
    });

    this.logger.error('Operation failed', error, context, {
      failureCount: this.failureCount,
      threshold: this.config.failureThreshold,
      currentErrorRate: this.calculateErrorRate()
    });

    // 🆕 高級判斷：同時考慮失敗次數和錯誤率
    const shouldOpen = this.shouldOpenCircuit();

    if (shouldOpen && (this.state === CircuitState.CLOSED || this.state === CircuitState.HALF_OPEN)) {
      this.logger.critical('Circuit breaker threshold reached, opening circuit', undefined, context, {
        failureCount: this.failureCount,
        errorRate: this.calculateErrorRate(),
        totalCalls: this.stats.totalCalls
      });
      this.transitionTo(CircuitState.OPEN);
    }

    this.persistStats();
  }

  /**
   * 🆕 判斷是否應該開啟斷路器（綜合考慮失敗次數和錯誤率）
   */
  private shouldOpenCircuit(): boolean {
    // 條件1：連續失敗達到閾值
    const consecutiveFailures = this.failureCount >= this.config.failureThreshold;

    // 條件2：錯誤率超過閾值（且請求量足夠）
    const errorRate = this.calculateErrorRate();
    const hasEnoughVolume = this.stats.totalCalls >= this.config.volumeThreshold;
    const highErrorRate = errorRate > this.config.errorRateThreshold && hasEnoughVolume;

    return consecutiveFailures || highErrorRate;
  }

  /**
   * 🆕 計算當前錯誤率
   */
  private calculateErrorRate(): number {
    if (this.errorBuffer.length === 0) return 0;

    const errors = this.errorBuffer.filter(e => e).length;
    return errors / this.errorBuffer.length;
  }

  /**
   * 🆕 計算平均延遲
   */
  private calculateAverageLatency(): number {
    if (this.latencyBuffer.length === 0) return 0;

    const sum = this.latencyBuffer.reduce((a, b) => a + b, 0);
    return sum / this.latencyBuffer.length;
  }

  /**
   * 🆕 修剪緩衝區（保留最近100個記錄）
   */
  private trimBuffers(): void {
    const maxSize = 100;

    if (this.latencyBuffer.length > maxSize) {
      this.latencyBuffer = this.latencyBuffer.slice(-maxSize);
    }

    if (this.errorBuffer.length > maxSize) {
      this.errorBuffer = this.errorBuffer.slice(-maxSize);
    }
  }

  /**
   * 🆕 狀態轉換（帶結構化日誌）
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.stats.state = newState;
    this.lastStateChange = nowMs();

    this.recordEvent('state_change', {
      from: oldState,
      to: newState
    });

    // 🆕 使用適當的日誌級別
    const logLevel = newState === CircuitState.OPEN ? LogLevel.CRITICAL : LogLevel.INFO;
    this.logger.log(
      logLevel,
      `Circuit state transition: ${oldState} -> ${newState}`,
      {
        oldState,
        newState,
        errorRate: this.calculateErrorRate(),
        averageLatency: this.calculateAverageLatency()
      },
      undefined,
      {
        stateTransition: true,
        timestamp: this.lastStateChange
      }
    );

    // 狀態轉換後的清理
    if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.halfOpenCalls = 0;
      this.successCount = 0;
    }

    this.persistStats();
    this.sendAlert(oldState, newState);
  }


  /**
   * 檢查是否應該嘗試重置
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;

    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    return timeSinceLastFailure >= this.config.timeout;
  }

  /**
   * 手動重置斷路器
   */
  reset(): void {
    console.log('🔄 [Circuit Breaker] Manual reset');
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCalls = 0;
    this.transitionTo(CircuitState.CLOSED);
  }

  /**
   * 手動開啟斷路器
   */
  open(): void {
    console.log('🚨 [Circuit Breaker] Manual open');
    this.transitionTo(CircuitState.OPEN);
  }

  /**
   * 獲取當前狀態
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * 獲取統計信息
   */
  getStats(): CircuitBreakerStats {
    return {
      ...this.stats,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange
    };
  }

  /**
   * 獲取事件歷史
   */
  getEvents(): CircuitBreakerEvent[] {
    return this.events;
  }

  /**
   * 記錄事件
   */
  private recordEvent(
    type: CircuitBreakerEvent['type'],
    details?: any
  ): void {
    const event: CircuitBreakerEvent = {
      type,
      timestamp: nowISO(),
      state: this.state,
      details
    };

    this.events.push(event);

    // 只保留最近 100 個事件
    if (this.events.length > 100) {
      this.events.shift();
    }
  }

  /**
   * 持久化統計數據到 KV
   */
  private async persistStats(): Promise<void> {
    if (!this.env?.SESSIONS) return;

    try {
      const statsKey = 'circuit_breaker:stats';
      await this.env.SESSIONS.put(
        statsKey,
        JSON.stringify(this.getStats()),
        { expirationTtl: this.config.monitoringWindow / 1000 }
      );
    } catch (error) {
      console.error('❌ [Circuit Breaker] Failed to persist stats:', error);
    }
  }

  /**
   * 從 KV 恢復狀態
   */
  async loadStats(): Promise<void> {
    if (!this.env?.SESSIONS) return;

    try {
      const statsKey = 'circuit_breaker:stats';
      const data = await this.env.SESSIONS.get(statsKey);

      if (data) {
        const savedStats = JSON.parse(data) as CircuitBreakerStats;
        this.state = savedStats.state;
        this.failureCount = savedStats.failureCount;
        this.successCount = savedStats.successCount;
        this.lastFailureTime = savedStats.lastFailureTime;
        this.lastStateChange = savedStats.lastStateChange;
        this.stats = savedStats;

        console.log('📊 [Circuit Breaker] Stats loaded from KV');
      }
    } catch (error) {
      console.error('❌ [Circuit Breaker] Failed to load stats:', error);
    }
  }

  /**
   * 發送警報
   */
  private async sendAlert(oldState: CircuitState, newState: CircuitState): Promise<void> {
    if (!this.env?.SESSIONS) return;

    try {
      // 只在關鍵狀態變化時發送警報
      if (newState === CircuitState.OPEN ||
          (oldState === CircuitState.OPEN && newState === CircuitState.CLOSED)) {

        const alertKey = `circuit_breaker:alert:${nowMs()}`;
        const alert = {
          type: newState === CircuitState.OPEN ? 'circuit_opened' : 'circuit_closed',
          timestamp: nowISO(),
          oldState,
          newState,
          stats: this.getStats()
        };

        await this.env.SESSIONS.put(
          alertKey,
          JSON.stringify(alert),
          { expirationTtl: 86400 } // 24 小時
        );

        // 添加到活躍警報列表
        const activeAlertsKey = 'websocket:active_alerts';
        const activeAlertsData = await this.env.SESSIONS.get(activeAlertsKey);
        const activeAlerts = activeAlertsData ? JSON.parse(activeAlertsData) : [];

        if (newState === CircuitState.OPEN) {
          activeAlerts.push(alert);
        } else {
          // 移除相關警報
          const filtered = activeAlerts.filter((a: any) => a.type !== 'circuit_opened');
          await this.env.SESSIONS.put(
            activeAlertsKey,
            JSON.stringify(filtered),
            { expirationTtl: 86400 }
          );
          return;
        }

        await this.env.SESSIONS.put(
          activeAlertsKey,
          JSON.stringify(activeAlerts),
          { expirationTtl: 86400 }
        );

        console.log(`🚨 [Circuit Breaker] Alert sent: ${alert.type}`);
      }
    } catch (error) {
      console.error('❌ [Circuit Breaker] Failed to send alert:', error);
    }
  }
}

/**
 * 全域斷路器實例
 */
let globalCircuitBreaker: WebSocketCircuitBreaker | null = null;

/**
 * 獲取全域斷路器實例
 */
export function getCircuitBreaker(config?: Partial<CircuitBreakerConfig>): WebSocketCircuitBreaker {
  if (!globalCircuitBreaker) {
    globalCircuitBreaker = new WebSocketCircuitBreaker(config);
  }
  return globalCircuitBreaker;
}

/**
 * 重置全域斷路器
 */
export function resetGlobalCircuitBreaker(): void {
  if (globalCircuitBreaker) {
    globalCircuitBreaker.reset();
  }
}
