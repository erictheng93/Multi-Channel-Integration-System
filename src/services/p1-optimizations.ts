// P1 Optimizations Export
// 優先級 P1 優化功能統一導出

// 1. WebSocket Circuit Breaker - 自動化容錯機制
export {
  WebSocketCircuitBreaker,
  CircuitState,
  getCircuitBreaker,
  resetGlobalCircuitBreaker
} from './websocket-circuit-breaker';
export type {
  CircuitBreakerConfig
} from './websocket-circuit-breaker';

// 2. Message Persistence Service - 訊息持久化與重播
export {
  MessagePersistenceService,
  createMessagePersistenceService
} from './message-persistence-service';
export type {
  PersistedMessage,
  ReplayConfig,
  ReplayStats
} from './message-persistence-service';

/**
 * P1 優化功能初始化器
 * 在應用啟動時初始化所有 P1 優化功能
 */
import type { Bindings } from '../types';
import { getCircuitBreaker as getCB } from './websocket-circuit-breaker';
import { createMessagePersistenceService as createMPS } from './message-persistence-service';

export async function initializeP1Optimizations(env: Bindings): Promise<void> {
  console.log('🚀 [P1 Optimizations] Initializing...');

  try {
    // 初始化 Circuit Breaker
    const circuitBreaker = getCB({
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
      halfOpenMaxCalls: 3,
      monitoringWindow: 300000
    });

    circuitBreaker.setEnv(env);
    await circuitBreaker.loadStats();

    console.log('✅ [P1 Optimizations] Circuit Breaker initialized');

    // 初始化 Message Persistence Service
    createMPS(env);

    console.log('✅ [P1 Optimizations] Message Persistence Service initialized');

    console.log('🎉 [P1 Optimizations] All P1 optimizations initialized successfully');

  } catch (error) {
    console.error('❌ [P1 Optimizations] Initialization failed:', error);
    throw error;
  }
}

/**
 * P1 優化狀態檢查
 */
export async function checkP1OptimizationsHealth(env: Bindings): Promise<{
  circuitBreaker: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    state: string;
    stats: any;
  };
  messagePersistence: {
    status: 'healthy' | 'unhealthy';
    available: boolean;
  };
}> {
  const health = {
    circuitBreaker: {
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      state: 'unknown',
      stats: {}
    },
    messagePersistence: {
      status: 'healthy' as 'healthy' | 'unhealthy',
      available: false
    }
  };

  try {
    // Check Circuit Breaker
    const circuitBreaker = getCB();
    const state = circuitBreaker.getState();
    const stats = circuitBreaker.getStats();

    health.circuitBreaker.state = state;
    health.circuitBreaker.stats = stats;

    if (state === 'OPEN') {
      health.circuitBreaker.status = 'unhealthy';
    } else if (state === 'HALF_OPEN') {
      health.circuitBreaker.status = 'degraded';
    } else {
      health.circuitBreaker.status = 'healthy';
    }

    // Check Message Persistence
    createMPS(env);
    health.messagePersistence.available = true;
    health.messagePersistence.status = 'healthy';

  } catch (error) {
    console.error('❌ [P1 Optimizations] Health check failed:', error);
  }

  return health;
}
