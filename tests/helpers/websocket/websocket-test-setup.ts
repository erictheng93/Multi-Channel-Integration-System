// WebSocket Test Setup
// Global setup and utilities for WebSocket testing environment
// Configures test environment, mocks, and performance monitoring

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { testEnv } from './durable-objects-test-env';

// Global test configuration
const TEST_CONFIG = {
  enablePerformanceMonitoring: process.env.PERFORMANCE_TEST_MODE === 'benchmark',
  enableStressTesting: process.env.STRESS_TEST_ENABLED === 'true',
  enableMemoryMonitoring: process.env.MEMORY_MONITORING === 'true',
  defaultTimeout: parseInt(process.env.WEBSOCKET_TEST_TIMEOUT || '120000', 10),
  enableDetailedLogging: process.env.NODE_ENV === 'development'
};

// Global performance tracking
const globalPerformanceMetrics = {
  testStartTime: 0,
  testCount: 0,
  totalTestTime: 0,
  slowTests: [] as Array<{ name: string; duration: number }>,
  memoryLeaks: [] as Array<{ test: string; leak: number }>
};

// Global test setup
beforeAll(async () => {
  console.log(' Starting WebSocket test suite...');
  console.log(' Test configuration:', TEST_CONFIG);

  globalPerformanceMetrics.testStartTime = Date.now();

  // Initialize test environment
  testEnv.reset();

  // Setup global mocks if needed
  setupGlobalMocks();

  // Configure console output for tests
  if (!TEST_CONFIG.enableDetailedLogging) {
    // Suppress debug logs during tests
    const originalConsoleLog = console.log;
    console.log = (...args: any[]) => {
      if (!args[0]?.toString().includes('') && !args[0]?.toString().includes('')) {
        originalConsoleLog(...args);
      }
    };
  }

  console.log(' WebSocket test environment initialized');
});

// Global test cleanup
afterAll(async () => {
  const totalDuration = Date.now() - globalPerformanceMetrics.testStartTime;
  globalPerformanceMetrics.totalTestTime = totalDuration;

  console.log(' WebSocket test suite completed');
  console.log(' Performance summary:');
  console.log(` Total tests: ${globalPerformanceMetrics.testCount}`);
  console.log(` Total time: ${totalDuration}ms`);
  console.log(` Average per test: ${(totalDuration / Math.max(globalPerformanceMetrics.testCount, 1)).toFixed(2)}ms`);

  if (globalPerformanceMetrics.slowTests.length > 0) {
    console.log(' Slow tests (>10s):');
    globalPerformanceMetrics.slowTests
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5)
      .forEach(test => {
        console.log(` ${test.name}: ${test.duration}ms`);
      });
  }

  if (globalPerformanceMetrics.memoryLeaks.length > 0) {
    console.log(' Potential memory leaks detected:');
    globalPerformanceMetrics.memoryLeaks.forEach(leak => {
      console.log(` ${leak.test}: +${(leak.leak / 1024 / 1024).toFixed(2)}MB`);
    });
  }

  // Reset test environment
  testEnv.reset();
});

// Per-test setup
beforeEach(async (ctx) => {
  globalPerformanceMetrics.testCount++;

  // Reset test environment for each test
  testEnv.reset();

  // Track test start time for performance monitoring
  if (TEST_CONFIG.enablePerformanceMonitoring) {
    (ctx as any).testStartTime = Date.now();
    (ctx as any).initialMemory = getMemoryUsage();
  }

  // Set test-specific timeout
  if (ctx.meta.name?.includes('stress') || ctx.meta.name?.includes('performance')) {
    // Extend timeout for performance and stress tests
    (ctx as any).timeout = TEST_CONFIG.defaultTimeout * 2;
  }
});

// Per-test cleanup
afterEach(async (ctx) => {
  // Performance monitoring
  if (TEST_CONFIG.enablePerformanceMonitoring && (ctx as any).testStartTime) {
    const testDuration = Date.now() - (ctx as any).testStartTime;

    // Track slow tests
    if (testDuration > 10000) { // > 10 seconds
      globalPerformanceMetrics.slowTests.push({
        name: ctx.meta.name || 'unknown',
        duration: testDuration
      });
    }

    // Memory leak detection
    if (TEST_CONFIG.enableMemoryMonitoring && (ctx as any).initialMemory) {
      const finalMemory = getMemoryUsage();
      const memoryIncrease = finalMemory - (ctx as any).initialMemory;

      if (memoryIncrease > 50 * 1024 * 1024) { // > 50MB increase
        globalPerformanceMetrics.memoryLeaks.push({
          test: ctx.meta.name || 'unknown',
          leak: memoryIncrease
        });
      }
    }
  }

  // Force garbage collection after memory-intensive tests
  if (ctx.meta.name?.includes('stress') || ctx.meta.name?.includes('memory')) {
    if (global.gc) {
      global.gc();
    }
  }

  // Reset test environment
  testEnv.reset();
});

// Global mock setup
function setupGlobalMocks(): void {
  // Mock WebSocket if not available in test environment
  if (typeof WebSocket === 'undefined') {
    global.WebSocket = class MockWebSocket {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;

      readyState = 0;
      url = '';
      protocol = '';

      constructor(url: string) {
        this.url = url;
        setTimeout(() => {
          this.readyState = 1;
          if (this.onopen) this.onopen({} as Event);
        }, 0);
      }

      send() {}
      close() {}

      onopen: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;

      addEventListener() {}
      removeEventListener() {}
      dispatchEvent() { return true; }
    } as any;
  }

  // Mock WebSocketPair if not available
  if (typeof WebSocketPair === 'undefined') {
    global.WebSocketPair = class MockWebSocketPair {
      0: WebSocket;
      1: WebSocket;

      constructor() {
        this[0] = new WebSocket('ws://test-0');
        this[1] = new WebSocket('ws://test-1');
      }
    } as any;
  }

  // Mock performance if not available
  if (typeof performance === 'undefined') {
    global.performance = {
      now: () => Date.now(),
      mark: () => {},
      measure: () => {},
      getEntriesByName: () => [],
      getEntriesByType: () => [],
      clearMarks: () => {},
      clearMeasures: () => {}
    } as any;
  }

  // Mock crypto.randomUUID if not available
  if (!global.crypto?.randomUUID) {
    global.crypto = {
      ...global.crypto,
      randomUUID: () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }
    } as any;
  }
}

// Utility function to get memory usage
function getMemoryUsage(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed;
  }
  return 0;
}

// Export test configuration for use in tests
export { TEST_CONFIG, globalPerformanceMetrics };

// Export utility functions
export const testUtils = {
  getMemoryUsage,

  /**
   * Wait for a condition to be true with timeout
   */
  waitFor: async (condition: () => boolean, timeout: number = 5000): Promise<void> => {
    const startTime = Date.now();
    while (!condition() && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!condition()) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }
  },

  /**
   * Create a delay
   */
  delay: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Generate test data
   */
  generateTestData: (size: number): string => {
    return Array.from({ length: size }, () =>
      Math.random().toString(36).substring(2, 15)
    ).join('');
  },

  /**
   * Measure execution time
   */
  measureTime: async <T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> => {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  },

  /**
   * Check if running in CI environment
   */
  isCI: (): boolean => {
    return !!(process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI);
  },

  /**
   * Get test timeout based on environment
   */
  getTestTimeout: (baseTimeout: number = 5000): number => {
    const multiplier = testUtils.isCI() ? 3 : 1; // 3x timeout in CI
    return baseTimeout * multiplier;
  }
};

console.log(' WebSocket test setup loaded');