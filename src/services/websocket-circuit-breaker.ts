// WebSocket Circuit Breaker Service
// 自動化容錯機制 - 故障隔離與自動恢復

import type { Bindings } from '../types';

/**
 * 斷路器狀態
 */
export enum CircuitState {
  CLOSED = 'CLOSED',     // 正常運行
  OPEN = 'OPEN',         // 斷路 (故障隔離)
  HALF_OPEN = 'HALF_OPEN' // 半開 (嘗試恢復)
}

/**
 * 斷路器配置
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;      // 失敗閾值 (連續失敗次數)
  successThreshold: number;      // 成功閾值 (恢復需要的成功次數)
  timeout: number;               // 開路超時 (ms)
  halfOpenMaxCalls: number;      // 半開狀態最大測試調用數
  monitoringWindow: number;      // 監控時間窗口 (ms)
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
 * WebSocket Circuit Breaker
 * 實現自動故障隔離和恢復機制
 */
export class WebSocketCircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private lastStateChange: number = Date.now();
  private halfOpenCalls = 0;

  // 統計數據
  private stats: CircuitBreakerStats = {
    state: CircuitState.CLOSED,
    failureCount: 0,
    successCount: 0,
    lastStateChange: Date.now(),
    totalCalls: 0,
    failedCalls: 0,
    successfulCalls: 0,
    rejectedCalls: 0
  };

  private config: CircuitBreakerConfig;
  private env?: Bindings;
  private events: CircuitBreakerEvent[] = [];

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold || 5,      // 連續 5 次失敗
      successThreshold: config?.successThreshold || 2,      // 2 次成功後恢復
      timeout: config?.timeout || 60000,                    // 1 分鐘
      halfOpenMaxCalls: config?.halfOpenMaxCalls || 3,      // 半開狀態允許 3 次測試
      monitoringWindow: config?.monitoringWindow || 300000  // 5 分鐘監控窗口
    };
  }

  /**
   * 設置環境變數 (用於持久化)
   */
  setEnv(env: Bindings): void {
    this.env = env;
  }

  /**
   * 執行操作 (帶斷路器保護)
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    this.stats.totalCalls++;

    // 檢查斷路器狀態
    if (this.state === CircuitState.OPEN) {
      // 檢查是否應該嘗試恢復
      if (this.shouldAttemptReset()) {
        console.log('🔄 [Circuit Breaker] Attempting to reset (transition to HALF_OPEN)');
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        // 斷路器開啟,直接拒絕請求
        this.stats.rejectedCalls++;
        this.recordEvent('rejected', { reason: 'Circuit breaker OPEN' });

        if (fallback) {
          console.log('⚡ [Circuit Breaker] Using fallback (SSE)');
          return await fallback();
        }

        throw new Error('Circuit breaker is OPEN - operation rejected');
      }
    }

    // 半開狀態下限制調用次數
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.stats.rejectedCalls++;
        if (fallback) {
          return await fallback();
        }
        throw new Error('Circuit breaker HALF_OPEN - max test calls reached');
      }
      this.halfOpenCalls++;
    }

    try {
      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;

      // 操作成功
      this.onSuccess(duration);
      return result;

    } catch (error) {
      // 操作失敗
      this.onFailure(error);

      // 使用降級方案
      if (fallback) {
        console.log('⚡ [Circuit Breaker] Operation failed, using fallback');
        return await fallback();
      }

      throw error;
    }
  }

  /**
   * 成功處理
   */
  private onSuccess(duration: number): void {
    this.stats.successfulCalls++;
    this.failureCount = 0; // 重置失敗計數
    this.successCount++;

    this.recordEvent('success', { duration });

    // 半開狀態下成功達到閾值,關閉斷路器
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.config.successThreshold) {
        console.log('✅ [Circuit Breaker] Recovery successful, closing circuit');
        this.transitionTo(CircuitState.CLOSED);
        this.successCount = 0;
        this.halfOpenCalls = 0;
      }
    }

    this.persistStats();
  }

  /**
   * 失敗處理
   */
  private onFailure(error: any): void {
    this.stats.failedCalls++;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0; // 重置成功計數

    this.recordEvent('failure', {
      error: error instanceof Error ? error.message : String(error)
    });

    console.error(`❌ [Circuit Breaker] Failure recorded (${this.failureCount}/${this.config.failureThreshold})`);

    // 檢查是否應該開啟斷路器
    if (this.state === CircuitState.CLOSED || this.state === CircuitState.HALF_OPEN) {
      if (this.failureCount >= this.config.failureThreshold) {
        console.warn('🚨 [Circuit Breaker] Threshold reached, opening circuit');
        this.transitionTo(CircuitState.OPEN);
      }
    }

    this.persistStats();
  }

  /**
   * 狀態轉換
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.stats.state = newState;
    this.lastStateChange = Date.now();

    this.recordEvent('state_change', {
      from: oldState,
      to: newState
    });

    console.log(`🔀 [Circuit Breaker] State transition: ${oldState} -> ${newState}`);

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
      timestamp: new Date().toISOString(),
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

        const alertKey = `circuit_breaker:alert:${Date.now()}`;
        const alert = {
          type: newState === CircuitState.OPEN ? 'circuit_opened' : 'circuit_closed',
          timestamp: new Date().toISOString(),
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
