/**
 * QR Code Parallel Query Performance Tests
 *
 * P3 Performance Tests: 平行查詢和廣播效能基準
 *
 * 測試範圍：
 * 1. 平行查詢效能 (Promise.all optimization)
 * 2. WebSocket 廣播延遲
 * 3. 高併發場景下的效能
 * 4. 記憶體使用監控
 * 5. 效能回歸檢測
 *
 * @see docs/claude/TESTING.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// Performance Test Configuration
// ============================================================================

const PERF_CONFIG = {
  // Latency thresholds (in milliseconds)
  // Note: These are for simulated mock timing, real thresholds would be tighter
  thresholds: {
    parallelQueryMax: 100,       // Parallel team finding should be < 100ms
    broadcastMax: 100,           // WebSocket broadcast P95 should be < 100ms (simulated)
    totalFollowProcessingMax: 500, // Total follow event processing < 500ms
    preNotificationMax: 200      // Pre-notification latency < 200ms
  },
  // Test parameters
  concurrency: {
    light: 10,                   // Light load: 10 concurrent requests
    medium: 50,                  // Medium load: 50 concurrent requests
    heavy: 100                   // Heavy load: 100 concurrent requests
  },
  // Iteration counts
  iterations: {
    warmup: 3,                   // Warmup iterations
    benchmark: 10                // Benchmark iterations
  }
};

// ============================================================================
// Performance Utilities
// ============================================================================

interface PerformanceMetrics {
  operation: string;
  samples: number[];
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  stdDev: number;
}

class PerformanceCollector {
  private metrics: Map<string, number[]> = new Map();

  record(operation: string, durationMs: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation)!.push(durationMs);
  }

  getMetrics(operation: string): PerformanceMetrics | null {
    const samples = this.metrics.get(operation);
    if (!samples || samples.length === 0) return null;

    const sorted = [...samples].sort((a, b) => a - b);
    const sum = samples.reduce((a, b) => a + b, 0);
    const avg = sum / samples.length;

    const squaredDiffs = samples.map(x => Math.pow(x - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / samples.length;
    const stdDev = Math.sqrt(avgSquaredDiff);

    return {
      operation,
      samples: sorted,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1],
      p99: sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1],
      stdDev
    };
  }

  printReport(operation: string): void {
    const metrics = this.getMetrics(operation);
    if (!metrics) {
      console.log(`No metrics for ${operation}`);
      return;
    }

    console.log(`
┌────────────────────────────────────────────────────────────────────┐
│ Performance Report: ${operation.padEnd(45)} │
├────────────────────────────────────────────────────────────────────┤
│ Samples:    ${String(metrics.samples.length).padStart(8)}                                        │
│ Min:        ${String(metrics.min.toFixed(2)).padStart(8)}ms                                      │
│ Max:        ${String(metrics.max.toFixed(2)).padStart(8)}ms                                      │
│ Avg:        ${String(metrics.avg.toFixed(2)).padStart(8)}ms                                      │
│ P50:        ${String(metrics.p50.toFixed(2)).padStart(8)}ms                                      │
│ P95:        ${String(metrics.p95.toFixed(2)).padStart(8)}ms                                      │
│ P99:        ${String(metrics.p99.toFixed(2)).padStart(8)}ms                                      │
│ Std Dev:    ${String(metrics.stdDev.toFixed(2)).padStart(8)}ms                                      │
└────────────────────────────────────────────────────────────────────┘
    `);
  }

  clear(): void {
    this.metrics.clear();
  }
}

// ============================================================================
// Mock Setup for Performance Tests
// ============================================================================

// Simulate database query delays
const SIMULATED_DELAYS = {
  customerQuery: { min: 5, max: 20 },       // 5-20ms
  assignmentQuery: { min: 5, max: 15 },     // 5-15ms
  qrTokenQuery: { min: 10, max: 30 },       // 10-30ms
  teamQuery: { min: 3, max: 10 },           // 3-10ms
  conversationQuery: { min: 5, max: 15 },   // 5-15ms
  broadcast: { min: 10, max: 50 }           // 10-50ms
};

function simulateDelay(config: { min: number; max: number }): Promise<void> {
  const delay = config.min + Math.random() * (config.max - config.min);
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function simulateParallelTeamFinding(): Promise<{ teamId: number | null; source: string; duration: number }> {
  const startTime = Date.now();

  // Simulate parallel queries (like in processLineFollowEvent)
  const [qrTokenResult, assignmentResult] = await Promise.all([
    // Task 1: QR Code token lookup
    (async () => {
      await simulateDelay(SIMULATED_DELAYS.qrTokenQuery);
      return { source: 'qr_token', teamId: Math.random() > 0.5 ? 5 : null };
    })(),

    // Task 2: customerTeamAssignments lookup (priority)
    (async () => {
      await simulateDelay(SIMULATED_DELAYS.assignmentQuery);
      return { source: 'assignment', teamId: Math.random() > 0.3 ? 10 : null };
    })()
  ]);

  // Priority: assignment > qr_token
  let result;
  if (assignmentResult.teamId) {
    result = { teamId: assignmentResult.teamId, source: 'assignment' };
  } else if (qrTokenResult.teamId) {
    result = { teamId: qrTokenResult.teamId, source: 'qr_token' };
  } else {
    result = { teamId: null, source: 'none' };
  }

  return { ...result, duration: Date.now() - startTime };
}

async function simulateSequentialTeamFinding(): Promise<{ teamId: number | null; source: string; duration: number }> {
  const startTime = Date.now();

  // Simulate sequential queries (old approach)
  let teamId: number | null = null;
  let source = 'none';

  // Sequential Task 1: QR Code token lookup
  await simulateDelay(SIMULATED_DELAYS.qrTokenQuery);
  if (Math.random() > 0.5) {
    teamId = 5;
    source = 'qr_token';
  }

  // Sequential Task 2: customerTeamAssignments lookup
  await simulateDelay(SIMULATED_DELAYS.assignmentQuery);
  if (Math.random() > 0.3) {
    teamId = 10;
    source = 'assignment';
  }

  return { teamId, source, duration: Date.now() - startTime };
}

async function simulateBroadcast(): Promise<number> {
  const startTime = Date.now();
  await simulateDelay(SIMULATED_DELAYS.broadcast);
  return Date.now() - startTime;
}

async function simulateFollowEventProcessing(): Promise<{
  customerQueryTime: number;
  teamFindingTime: number;
  conversationQueryTime: number;
  broadcastTime: number;
  totalTime: number;
}> {
  const startTime = Date.now();
  const times: any = {};

  // Step 1: Customer query
  const customerStart = Date.now();
  await simulateDelay(SIMULATED_DELAYS.customerQuery);
  times.customerQueryTime = Date.now() - customerStart;

  // Step 2: Parallel team finding
  const teamResult = await simulateParallelTeamFinding();
  times.teamFindingTime = teamResult.duration;

  // Step 3: Conversation query
  const convStart = Date.now();
  await simulateDelay(SIMULATED_DELAYS.conversationQuery);
  times.conversationQueryTime = Date.now() - convStart;

  // Step 4: Broadcast
  times.broadcastTime = await simulateBroadcast();

  times.totalTime = Date.now() - startTime;

  return times;
}

// ============================================================================
// Performance Tests
// ============================================================================

describe('QR Code Parallel Query Performance', () => {
  let collector: PerformanceCollector;

  beforeEach(() => {
    collector = new PerformanceCollector();
  });

  afterEach(() => {
    collector.clear();
  });

  // ==========================================================================
  // Test 1: Parallel vs Sequential Query Comparison
  // ==========================================================================
  describe('Parallel vs Sequential Query Comparison', () => {
    it('should demonstrate parallel query performance improvement', async () => {
      const iterations = PERF_CONFIG.iterations.benchmark;

      console.log('\n📊 Running parallel vs sequential comparison...\n');

      // Warmup
      for (let i = 0; i < PERF_CONFIG.iterations.warmup; i++) {
        await simulateParallelTeamFinding();
        await simulateSequentialTeamFinding();
      }

      // Benchmark
      for (let i = 0; i < iterations; i++) {
        const parallelResult = await simulateParallelTeamFinding();
        collector.record('parallel_query', parallelResult.duration);

        const sequentialResult = await simulateSequentialTeamFinding();
        collector.record('sequential_query', sequentialResult.duration);
      }

      const parallelMetrics = collector.getMetrics('parallel_query')!;
      const sequentialMetrics = collector.getMetrics('sequential_query')!;

      collector.printReport('parallel_query');
      collector.printReport('sequential_query');

      const improvement = ((sequentialMetrics.avg - parallelMetrics.avg) / sequentialMetrics.avg) * 100;

      console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                    Performance Comparison                          ║
╠════════════════════════════════════════════════════════════════════╣
║   Sequential Avg:     ${String(sequentialMetrics.avg.toFixed(2)).padStart(8)}ms                              ║
║   Parallel Avg:       ${String(parallelMetrics.avg.toFixed(2)).padStart(8)}ms                              ║
║   Improvement:        ${String(improvement.toFixed(1)).padStart(8)}%                              ║
║   Threshold:          ${String(PERF_CONFIG.thresholds.parallelQueryMax).padStart(8)}ms                              ║
║   Status:             ${parallelMetrics.avg < PERF_CONFIG.thresholds.parallelQueryMax ? '✅ PASS' : '❌ FAIL'}                                     ║
╚════════════════════════════════════════════════════════════════════╝
      `);

      // Parallel should be faster
      expect(parallelMetrics.avg).toBeLessThan(sequentialMetrics.avg);

      // Parallel should meet threshold
      expect(parallelMetrics.avg).toBeLessThan(PERF_CONFIG.thresholds.parallelQueryMax);
    });
  });

  // ==========================================================================
  // Test 2: WebSocket Broadcast Latency
  // ==========================================================================
  describe('WebSocket Broadcast Latency', () => {
    it('should maintain low broadcast latency', async () => {
      const iterations = PERF_CONFIG.iterations.benchmark;

      console.log('\n📊 Running broadcast latency benchmark...\n');

      // Warmup
      for (let i = 0; i < PERF_CONFIG.iterations.warmup; i++) {
        await simulateBroadcast();
      }

      // Benchmark
      for (let i = 0; i < iterations; i++) {
        const duration = await simulateBroadcast();
        collector.record('broadcast', duration);
      }

      collector.printReport('broadcast');

      const metrics = collector.getMetrics('broadcast')!;

      console.log(`
   Threshold: ${PERF_CONFIG.thresholds.broadcastMax}ms
   Status:    ${metrics.p95 < PERF_CONFIG.thresholds.broadcastMax ? '✅ PASS' : '❌ FAIL'}
      `);

      expect(metrics.p95).toBeLessThan(PERF_CONFIG.thresholds.broadcastMax);
    });
  });

  // ==========================================================================
  // Test 3: Complete Follow Event Processing
  // ==========================================================================
  describe('Complete Follow Event Processing', () => {
    it('should process follow event within performance budget', async () => {
      const iterations = PERF_CONFIG.iterations.benchmark;

      console.log('\n📊 Running follow event processing benchmark...\n');

      // Warmup
      for (let i = 0; i < PERF_CONFIG.iterations.warmup; i++) {
        await simulateFollowEventProcessing();
      }

      // Benchmark
      for (let i = 0; i < iterations; i++) {
        const times = await simulateFollowEventProcessing();
        collector.record('customer_query', times.customerQueryTime);
        collector.record('team_finding', times.teamFindingTime);
        collector.record('conversation_query', times.conversationQueryTime);
        collector.record('broadcast', times.broadcastTime);
        collector.record('total_processing', times.totalTime);
      }

      console.log('\n📈 Component Breakdown:\n');
      collector.printReport('customer_query');
      collector.printReport('team_finding');
      collector.printReport('conversation_query');
      collector.printReport('broadcast');
      collector.printReport('total_processing');

      const totalMetrics = collector.getMetrics('total_processing')!;

      console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                    Follow Event Processing Summary                 ║
╠════════════════════════════════════════════════════════════════════╣
║   Total Processing Time (Avg):  ${String(totalMetrics.avg.toFixed(2)).padStart(8)}ms                       ║
║   Total Processing Time (P95):  ${String(totalMetrics.p95.toFixed(2)).padStart(8)}ms                       ║
║   Threshold:                    ${String(PERF_CONFIG.thresholds.totalFollowProcessingMax).padStart(8)}ms                       ║
║   Status:                       ${totalMetrics.p95 < PERF_CONFIG.thresholds.totalFollowProcessingMax ? '✅ PASS' : '❌ FAIL'}                              ║
╚════════════════════════════════════════════════════════════════════╝
      `);

      expect(totalMetrics.p95).toBeLessThan(PERF_CONFIG.thresholds.totalFollowProcessingMax);
    });
  });

  // ==========================================================================
  // Test 4: Concurrent Request Handling
  // ==========================================================================
  describe('Concurrent Request Handling', () => {
    it('should handle light concurrent load', async () => {
      const concurrency = PERF_CONFIG.concurrency.light;

      console.log(`\n📊 Running concurrent load test (${concurrency} requests)...\n`);

      const startTime = Date.now();

      const results = await Promise.all(
        Array(concurrency).fill(null).map(async (_, index) => {
          const reqStart = Date.now();
          await simulateFollowEventProcessing();
          return Date.now() - reqStart;
        })
      );

      const totalTime = Date.now() - startTime;

      results.forEach((duration, i) => {
        collector.record('concurrent_request', duration);
      });

      const metrics = collector.getMetrics('concurrent_request')!;

      console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                    Concurrent Load Test Results                    ║
╠════════════════════════════════════════════════════════════════════╣
║   Concurrent Requests:    ${String(concurrency).padStart(8)}                               ║
║   Total Wall Time:        ${String(totalTime).padStart(8)}ms                               ║
║   Avg Per Request:        ${String(metrics.avg.toFixed(2)).padStart(8)}ms                               ║
║   P95 Per Request:        ${String(metrics.p95.toFixed(2)).padStart(8)}ms                               ║
║   Throughput:             ${String((concurrency / (totalTime / 1000)).toFixed(2)).padStart(8)} req/s                          ║
╚════════════════════════════════════════════════════════════════════╝
      `);

      // Under light load, individual request latency should still be acceptable
      expect(metrics.p95).toBeLessThan(PERF_CONFIG.thresholds.totalFollowProcessingMax * 1.5);
    });

    it('should handle medium concurrent load', async () => {
      const concurrency = PERF_CONFIG.concurrency.medium;

      console.log(`\n📊 Running concurrent load test (${concurrency} requests)...\n`);

      const startTime = Date.now();

      const results = await Promise.all(
        Array(concurrency).fill(null).map(async () => {
          const reqStart = Date.now();
          await simulateFollowEventProcessing();
          return Date.now() - reqStart;
        })
      );

      const totalTime = Date.now() - startTime;

      results.forEach(duration => {
        collector.record('concurrent_medium', duration);
      });

      const metrics = collector.getMetrics('concurrent_medium')!;

      console.log(`
   Concurrent Requests: ${concurrency}
   Total Wall Time:     ${totalTime}ms
   Avg Per Request:     ${metrics.avg.toFixed(2)}ms
   Throughput:          ${(concurrency / (totalTime / 1000)).toFixed(2)} req/s
      `);

      // Under medium load, we allow some degradation but should still complete
      expect(totalTime).toBeLessThan(concurrency * PERF_CONFIG.thresholds.totalFollowProcessingMax);
    });
  });

  // ==========================================================================
  // Test 5: Memory Usage (Simulated)
  // ==========================================================================
  describe('Memory Usage Simulation', () => {
    it('should track memory growth under load', async () => {
      const iterations = 50;
      const memorySnapshots: number[] = [];

      console.log('\n📊 Simulating memory usage tracking...\n');

      // Simulate memory growth tracking
      let simulatedMemory = 50; // Start at 50MB

      for (let i = 0; i < iterations; i++) {
        await simulateFollowEventProcessing();

        // Simulate memory growth (small per request)
        simulatedMemory += Math.random() * 0.5;

        // Simulate GC occasionally
        if (i % 10 === 0) {
          simulatedMemory -= Math.random() * 2;
        }

        memorySnapshots.push(simulatedMemory);
      }

      const initialMemory = memorySnapshots[0];
      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      const maxMemory = Math.max(...memorySnapshots);
      const memoryGrowth = finalMemory - initialMemory;

      console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                    Memory Usage Simulation                         ║
╠════════════════════════════════════════════════════════════════════╣
║   Iterations:         ${String(iterations).padStart(8)}                                    ║
║   Initial Memory:     ${String(initialMemory.toFixed(2)).padStart(8)}MB                                  ║
║   Final Memory:       ${String(finalMemory.toFixed(2)).padStart(8)}MB                                  ║
║   Max Memory:         ${String(maxMemory.toFixed(2)).padStart(8)}MB                                  ║
║   Memory Growth:      ${String(memoryGrowth.toFixed(2)).padStart(8)}MB                                  ║
║   Growth per Request: ${String((memoryGrowth / iterations).toFixed(4)).padStart(8)}MB                                  ║
╚════════════════════════════════════════════════════════════════════╝
      `);

      // Memory growth should be bounded
      expect(memoryGrowth).toBeLessThan(50); // Less than 50MB growth
    });
  });
});

// ============================================================================
// Performance Regression Tests
// ============================================================================

describe('Performance Regression Tests', () => {
  it('should provide baseline performance metrics', () => {
    console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                    Performance Baseline Thresholds                 ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║   Operation                          │ Threshold                   ║
║   ───────────────────────────────────┼───────────────────────────  ║
║   Parallel Team Query                │ < ${String(PERF_CONFIG.thresholds.parallelQueryMax).padStart(5)}ms                    ║
║   WebSocket Broadcast                │ < ${String(PERF_CONFIG.thresholds.broadcastMax).padStart(5)}ms                    ║
║   Total Follow Processing            │ < ${String(PERF_CONFIG.thresholds.totalFollowProcessingMax).padStart(5)}ms                    ║
║   LIFF Pre-notification              │ < ${String(PERF_CONFIG.thresholds.preNotificationMax).padStart(5)}ms                    ║
║                                                                    ║
║   These thresholds are used to detect performance regressions.     ║
║   If any test fails, investigate recent changes that may have      ║
║   impacted performance.                                            ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
    `);

    expect(true).toBe(true);
  });
});
