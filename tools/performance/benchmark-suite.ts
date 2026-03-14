#!/usr/bin/env node
/**
 * Performance Benchmarking Suite
 * 專案名稱：Multi-Channel Support MVP - Performance Tools
 *
 * Comprehensive performance benchmarking for WebSocket + Durable Objects
 * Measures latency, throughput, memory usage, and system performance
 */

import { performance } from 'perf_hooks';
import WebSocket from 'ws';
import fetch from 'node-fetch';
import { EventEmitter } from 'events';

// =================== Configuration ===================

interface BenchmarkConfig {
  workerUrl: string;
  websocketUrl: string;
  authToken?: string;
  benchmarkSuites: string[];
  iterations: number;
  warmupIterations: number;
  cooldownMs: number;
  timeoutMs: number;
  concurrencyLevels: number[];
  measureMemory: boolean;
  measureCpu: boolean;
  outputFormat: 'json' | 'csv' | 'console';
  saveResults: boolean;
}

const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  workerUrl: 'https://localhost:8787',
  websocketUrl: 'wss://localhost:8787/api/websocket/connect',
  benchmarkSuites: ['latency', 'throughput', 'memory', 'websocket', 'durableobjects'],
  iterations: 1000,
  warmupIterations: 100,
  cooldownMs: 1000,
  timeoutMs: 30000,
  concurrencyLevels: [1, 5, 10, 25, 50, 100],
  measureMemory: true,
  measureCpu: true,
  outputFormat: 'console',
  saveResults: true
};

// =================== Benchmark Results ===================

interface PerformanceMetrics {
  latency: {
    min: number;
    max: number;
    mean: number;
    median: number;
    p90: number;
    p95: number;
    p99: number;
    stdDev: number;
  };
  throughput: {
    requestsPerSecond: number;
    operationsPerSecond: number;
    bytesPerSecond: number;
  };
  resource: {
    memoryUsage: {
      heapUsed: number;
      heapTotal: number;
      external: number;
      rss: number;
    };
    cpuUsage: {
      user: number;
      system: number;
    };
  };
  error: {
    rate: number;
    count: number;
    types: Record<string, number>;
  };
}

interface BenchmarkResult {
  suiteName: string;
  testName: string;
  concurrency: number;
  iterations: number;
  duration: number;
  metrics: PerformanceMetrics;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface BenchmarkReport {
  summary: {
    totalTests: number;
    totalDuration: number;
    successRate: number;
    timestamp: number;
  };
  results: BenchmarkResult[];
  systemInfo: {
    nodeVersion: string;
    platform: string;
    arch: string;
    memory: number;
  };
}

// =================== Benchmark Engine ===================

class PerformanceBenchmarkSuite extends EventEmitter {
  private config: BenchmarkConfig;
  private results: BenchmarkResult[] = [];
  private systemBaseline: { memory: NodeJS.MemoryUsage; cpu: NodeJS.CpuUsage } | null = null;

  constructor(config: Partial<BenchmarkConfig> = {}) {
    super();
    this.config = { ...DEFAULT_BENCHMARK_CONFIG, ...config };
  }

  async runBenchmarks(): Promise<BenchmarkReport> {
    console.log(' Starting Performance Benchmark Suite');
    console.log('Configuration:', JSON.stringify(this.config, null, 2));

    const startTime = performance.now();

    // Establish system baseline
    await this.establishBaseline();

    try {
      // Run each benchmark suite
      for (const suiteName of this.config.benchmarkSuites) {
        console.log(`\n Running ${suiteName} benchmark suite`);
        await this.runBenchmarkSuite(suiteName);

        // Cooldown between suites
        console.log(` Cooldown for ${this.config.cooldownMs}ms`);
        await this.sleep(this.config.cooldownMs);
      }

    } catch (error) {
      console.error(' Benchmark error:', error);
    }

    const totalDuration = performance.now() - startTime;

    return this.generateReport(totalDuration);
  }

  private async establishBaseline(): Promise<void> {
    console.log(' Establishing system baseline');

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Wait for system to stabilize
    await this.sleep(2000);

    this.systemBaseline = {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    };

    console.log(' Baseline established');
  }

  private async runBenchmarkSuite(suiteName: string): Promise<void> {
    switch (suiteName) {
      case 'latency':
        await this.runLatencyBenchmarks();
        break;
      case 'throughput':
        await this.runThroughputBenchmarks();
        break;
      case 'memory':
        await this.runMemoryBenchmarks();
        break;
      case 'websocket':
        await this.runWebSocketBenchmarks();
        break;
      case 'durableobjects':
        await this.runDurableObjectsBenchmarks();
        break;
      default:
        console.warn(` Unknown benchmark suite: ${suiteName}`);
    }
  }

  // =================== Latency Benchmarks ===================

  private async runLatencyBenchmarks(): Promise<void> {
    const latencyTests = [
      { name: 'HTTP Request Latency', endpoint: '/api/health', method: 'GET' },
      { name: 'Authentication Latency', endpoint: '/api/auth/verify', method: 'POST' },
      { name: 'Conversation Create', endpoint: '/api/conversations', method: 'POST' },
      { name: 'Message Send', endpoint: '/api/conversations/test/messages', method: 'POST' },
      { name: 'WebSocket Connect', endpoint: 'websocket', method: 'CONNECT' }
    ];

    for (const test of latencyTests) {
      for (const concurrency of this.config.concurrencyLevels) {
        console.log(` ${test.name} (concurrency: ${concurrency})`);

        const result = await this.measureLatency(
          test.name,
          concurrency,
          async () => {
            if (test.endpoint === 'websocket') {
              return this.benchmarkWebSocketConnect();
            } else {
              return this.benchmarkHttpRequest(test.endpoint, test.method);
            }
          }
        );

        this.results.push(result);
      }
    }
  }

  private async measureLatency(
    testName: string,
    concurrency: number,
    operation: () => Promise<any>
  ): Promise<BenchmarkResult> {
    const latencies: number[] = [];
    const errors: Record<string, number> = {};
    let errorCount = 0;

    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    const startCpu = process.cpuUsage();

    // Warmup
    console.log(` Warming up (${this.config.warmupIterations} iterations)`);
    for (let i = 0; i < this.config.warmupIterations; i++) {
      try {
        await operation();
      } catch (error) {
        // Ignore warmup errors
      }
    }

    // Actual benchmark
    console.log(` Measuring (${this.config.iterations} iterations, concurrency: ${concurrency})`);

    for (let batch = 0; batch < Math.ceil(this.config.iterations / concurrency); batch++) {
      const batchPromises = [];
      const batchSize = Math.min(concurrency, this.config.iterations - batch * concurrency);

      for (let i = 0; i < batchSize; i++) {
        batchPromises.push(this.measureSingleOperation(operation));
      }

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          latencies.push(result.value.latency);
        } else {
          errorCount++;
          const errorType = result.reason?.message || 'Unknown error';
          errors[errorType] = (errors[errorType] || 0) + 1;
        }
      }
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    const endCpu = process.cpuUsage(startCpu);

    const duration = endTime - startTime;
    const sortedLatencies = latencies.sort((a, b) => a - b);

    const metrics: PerformanceMetrics = {
      latency: {
        min: sortedLatencies[0] || 0,
        max: sortedLatencies[sortedLatencies.length - 1] || 0,
        mean: latencies.length > 0 ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length : 0,
        median: this.percentile(sortedLatencies, 50),
        p90: this.percentile(sortedLatencies, 90),
        p95: this.percentile(sortedLatencies, 95),
        p99: this.percentile(sortedLatencies, 99),
        stdDev: this.standardDeviation(latencies)
      },
      throughput: {
        requestsPerSecond: (latencies.length / duration) * 1000,
        operationsPerSecond: (latencies.length / duration) * 1000,
        bytesPerSecond: 0 // Would need to track bytes transferred
      },
      resource: {
        memoryUsage: {
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          external: endMemory.external - startMemory.external,
          rss: endMemory.rss - startMemory.rss
        },
        cpuUsage: {
          user: endCpu.user / 1000, // Convert to milliseconds
          system: endCpu.system / 1000
        }
      },
      error: {
        rate: (this.config.iterations > 0) ? errorCount / this.config.iterations : 0,
        count: errorCount,
        types: errors
      }
    };

    return {
      suiteName: 'latency',
      testName,
      concurrency,
      iterations: this.config.iterations,
      duration,
      metrics,
      timestamp: Date.now()
    };
  }

  private async measureSingleOperation(operation: () => Promise<any>): Promise<{ latency: number; result: any }> {
    const startTime = performance.now();
    const result = await operation();
    const endTime = performance.now();

    return {
      latency: endTime - startTime,
      result
    };
  }

  // =================== Throughput Benchmarks ===================

  private async runThroughputBenchmarks(): Promise<void> {
    const throughputTests = [
      { name: 'Message Broadcasting', operation: () => this.benchmarkMessageBroadcast() },
      { name: 'Conversation Creation', operation: () => this.benchmarkConversationCreate() },
      { name: 'User Connection', operation: () => this.benchmarkUserConnection() },
      { name: 'Delayed Message Scheduling', operation: () => this.benchmarkDelayedMessage() }
    ];

    for (const test of throughputTests) {
      for (const concurrency of this.config.concurrencyLevels) {
        console.log(` ${test.name} (concurrency: ${concurrency})`);

        const result = await this.measureThroughput(
          test.name,
          concurrency,
          test.operation
        );

        this.results.push(result);
      }
    }
  }

  private async measureThroughput(
    testName: string,
    concurrency: number,
    operation: () => Promise<any>
  ): Promise<BenchmarkResult> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    const startCpu = process.cpuUsage();

    let successCount = 0;
    let errorCount = 0;
    const errors: Record<string, number> = {};

    const testDuration = 10000; // 10 seconds
    const endTime = startTime + testDuration;

    console.log(` Running for ${testDuration}ms with concurrency ${concurrency}`);

    // Continuous throughput test
    const workers = Array(concurrency).fill(null).map(async () => {
      while (performance.now() < endTime) {
        try {
          await operation();
          successCount++;
        } catch (error) {
          errorCount++;
          const errorType = error instanceof Error ? error.message : 'Unknown error';
          errors[errorType] = (errors[errorType] || 0) + 1;
        }
      }
    });

    await Promise.all(workers);

    const actualDuration = performance.now() - startTime;
    const endMemory = process.memoryUsage();
    const endCpu = process.cpuUsage(startCpu);

    const metrics: PerformanceMetrics = {
      latency: {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        stdDev: 0
      },
      throughput: {
        requestsPerSecond: (successCount / actualDuration) * 1000,
        operationsPerSecond: (successCount / actualDuration) * 1000,
        bytesPerSecond: 0
      },
      resource: {
        memoryUsage: {
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          external: endMemory.external - startMemory.external,
          rss: endMemory.rss - startMemory.rss
        },
        cpuUsage: {
          user: endCpu.user / 1000,
          system: endCpu.system / 1000
        }
      },
      error: {
        rate: (successCount + errorCount) > 0 ? errorCount / (successCount + errorCount) : 0,
        count: errorCount,
        types: errors
      }
    };

    return {
      suiteName: 'throughput',
      testName,
      concurrency,
      iterations: successCount,
      duration: actualDuration,
      metrics,
      timestamp: Date.now()
    };
  }

  // =================== Memory Benchmarks ===================

  private async runMemoryBenchmarks(): Promise<void> {
    const memoryTests = [
      { name: 'Connection Memory Usage', operation: () => this.benchmarkConnectionMemory() },
      { name: 'Message History Memory', operation: () => this.benchmarkMessageMemory() },
      { name: 'Durable Object Memory', operation: () => this.benchmarkDurableObjectMemory() }
    ];

    for (const test of memoryTests) {
      console.log(` ${test.name}`);

      const result = await this.measureMemoryUsage(test.name, test.operation);
      this.results.push(result);
    }
  }

  private async measureMemoryUsage(
    testName: string,
    operation: () => Promise<any>
  ): Promise<BenchmarkResult> {
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }

    const startTime = performance.now();
    const baselineMemory = process.memoryUsage();

    const memorySnapshots: NodeJS.MemoryUsage[] = [];
    const interval = setInterval(() => {
      memorySnapshots.push(process.memoryUsage());
    }, 100); // Every 100ms

    try {
      await operation();
    } finally {
      clearInterval(interval);
    }

    // Force garbage collection again
    if (global.gc) {
      global.gc();
    }

    const endTime = performance.now();
    const finalMemory = process.memoryUsage();

    const peakMemory = memorySnapshots.reduce((peak, snapshot) => ({
      heapUsed: Math.max(peak.heapUsed, snapshot.heapUsed),
      heapTotal: Math.max(peak.heapTotal, snapshot.heapTotal),
      external: Math.max(peak.external, snapshot.external),
      rss: Math.max(peak.rss, snapshot.rss)
    }), baselineMemory);

    const metrics: PerformanceMetrics = {
      latency: { min: 0, max: 0, mean: 0, median: 0, p90: 0, p95: 0, p99: 0, stdDev: 0 },
      throughput: { requestsPerSecond: 0, operationsPerSecond: 0, bytesPerSecond: 0 },
      resource: {
        memoryUsage: {
          heapUsed: peakMemory.heapUsed - baselineMemory.heapUsed,
          heapTotal: peakMemory.heapTotal - baselineMemory.heapTotal,
          external: peakMemory.external - baselineMemory.external,
          rss: peakMemory.rss - baselineMemory.rss
        },
        cpuUsage: { user: 0, system: 0 }
      },
      error: { rate: 0, count: 0, types: {} }
    };

    return {
      suiteName: 'memory',
      testName,
      concurrency: 1,
      iterations: 1,
      duration: endTime - startTime,
      metrics,
      timestamp: Date.now(),
      metadata: {
        baselineMemory,
        finalMemory,
        peakMemory,
        snapshotCount: memorySnapshots.length
      }
    };
  }

  // =================== WebSocket Benchmarks ===================

  private async runWebSocketBenchmarks(): Promise<void> {
    const websocketTests = [
      { name: 'WebSocket Connection Time', operation: () => this.benchmarkWebSocketConnect() },
      { name: 'WebSocket Message Echo', operation: () => this.benchmarkWebSocketEcho() },
      { name: 'WebSocket Message Broadcasting', operation: () => this.benchmarkWebSocketBroadcast() }
    ];

    for (const test of websocketTests) {
      for (const concurrency of this.config.concurrencyLevels.slice(0, 3)) { // Limit WebSocket concurrency
        console.log(` ${test.name} (concurrency: ${concurrency})`);

        const result = await this.measureLatency(
          test.name,
          concurrency,
          test.operation
        );

        this.results.push(result);
      }
    }
  }

  // =================== Durable Objects Benchmarks ===================

  private async runDurableObjectsBenchmarks(): Promise<void> {
    const doTests = [
      { name: 'ConversationRoom Operations', operation: () => this.benchmarkConversationRoom() },
      { name: 'MessageBroadcaster Operations', operation: () => this.benchmarkMessageBroadcaster() },
      { name: 'UserConnection Operations', operation: () => this.benchmarkUserConnection() },
      { name: 'Distributed Lock Operations', operation: () => this.benchmarkDistributedLock() }
    ];

    for (const test of doTests) {
      for (const concurrency of this.config.concurrencyLevels) {
        console.log(` ${test.name} (concurrency: ${concurrency})`);

        const result = await this.measureLatency(
          test.name,
          concurrency,
          test.operation
        );

        this.results.push(result);
      }
    }
  }

  // =================== Individual Benchmark Operations ===================

  private async benchmarkHttpRequest(endpoint: string, method: string): Promise<any> {
    const url = `${this.config.workerUrl}${endpoint}`;
    const headers: Record<string, string> = {};

    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    let body;
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ test: true, timestamp: Date.now() });
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
      timeout: this.config.timeoutMs
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  private async benchmarkWebSocketConnect(): Promise<any> {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      const ws = new WebSocket(this.config.websocketUrl + '?userId=benchmark&conversationId=test');

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, this.config.timeoutMs);

      ws.on('open', () => {
        clearTimeout(timeout);
        const connectionTime = performance.now() - startTime;
        ws.close();
        resolve({ connectionTime });
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private async benchmarkWebSocketEcho(): Promise<any> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.config.websocketUrl + '?userId=benchmark&conversationId=test');
      const testMessage = { type: 'ping', timestamp: Date.now() };

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket echo timeout'));
      }, this.config.timeoutMs);

      ws.on('open', () => {
        ws.send(JSON.stringify(testMessage));
      });

      ws.on('message', (data) => {
        clearTimeout(timeout);
        const response = JSON.parse(data.toString());
        ws.close();
        resolve(response);
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private async benchmarkWebSocketBroadcast(): Promise<any> {
    const ws = new WebSocket(this.config.websocketUrl + '?userId=benchmark&conversationId=test');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket broadcast timeout'));
      }, this.config.timeoutMs);

      ws.on('open', () => {
        const message = {
          type: 'message',
          data: {
            content: 'Benchmark test message',
            messageType: 'text'
          },
          timestamp: Date.now()
        };
        ws.send(JSON.stringify(message));
      });

      ws.on('message', (data) => {
        clearTimeout(timeout);
        ws.close();
        resolve(JSON.parse(data.toString()));
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private async benchmarkMessageBroadcast(): Promise<any> {
    return this.benchmarkHttpRequest('/api/message-broadcaster/broadcast', 'POST');
  }

  private async benchmarkConversationCreate(): Promise<any> {
    return this.benchmarkHttpRequest('/api/conversations', 'POST');
  }

  private async benchmarkUserConnection(): Promise<any> {
    const userId = `benchmark_user_${Math.random().toString(36).substring(7)}`;
    return this.benchmarkHttpRequest(`/api/user-connections/${userId}/connect`, 'POST');
  }

  private async benchmarkDelayedMessage(): Promise<any> {
    return this.benchmarkHttpRequest('/api/delayed-messages/schedule', 'POST');
  }

  private async benchmarkConnectionMemory(): Promise<any> {
    // Create multiple connections to test memory usage
    const connections = [];
    for (let i = 0; i < 100; i++) {
      const ws = new WebSocket(this.config.websocketUrl + `?userId=mem_test_${i}&conversationId=test`);
      connections.push(ws);
    }

    // Hold connections for a bit
    await this.sleep(5000);

    // Close all connections
    connections.forEach(ws => ws.close());

    return { connectionsCreated: connections.length };
  }

  private async benchmarkMessageMemory(): Promise<any> {
    // Send many messages to test message history memory
    const promises = [];
    for (let i = 0; i < 1000; i++) {
      promises.push(this.benchmarkHttpRequest('/api/conversations/test/messages', 'POST'));
    }

    await Promise.allSettled(promises);
    return { messagesSent: promises.length };
  }

  private async benchmarkDurableObjectMemory(): Promise<any> {
    // Create multiple Durable Object instances
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(this.benchmarkHttpRequest(`/api/conversation-rooms/room_${i}/metrics`, 'GET'));
    }

    await Promise.allSettled(promises);
    return { durableObjectsAccessed: promises.length };
  }

  private async benchmarkConversationRoom(): Promise<any> {
    const roomId = `benchmark_room_${Math.random().toString(36).substring(7)}`;
    return this.benchmarkHttpRequest(`/api/conversation-rooms/${roomId}/participants`, 'GET');
  }

  private async benchmarkMessageBroadcaster(): Promise<any> {
    return this.benchmarkHttpRequest('/api/message-broadcaster/metrics', 'GET');
  }

  private async benchmarkDistributedLock(): Promise<any> {
    const roomId = 'benchmark_room';
    const resource = `resource_${Math.random().toString(36).substring(7)}`;

    // Acquire lock
    const lockResponse = await this.benchmarkHttpRequest(
      `/api/conversation-rooms/${roomId}/lock`,
      'POST'
    );

    // Release lock if acquired
    if (lockResponse.lockId) {
      await this.benchmarkHttpRequest(
        `/api/conversation-rooms/${roomId}/lock`,
        'POST'
      );
    }

    return lockResponse;
  }

  // =================== Utility Methods ===================

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  private standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateReport(totalDuration: number): BenchmarkReport {
    const successfulTests = this.results.filter(r => r.metrics.error.rate < 0.1);
    const successRate = this.results.length > 0 ? successfulTests.length / this.results.length : 0;

    return {
      summary: {
        totalTests: this.results.length,
        totalDuration,
        successRate,
        timestamp: Date.now()
      },
      results: this.results,
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024) // MB
      }
    };
  }

  async saveReport(report: BenchmarkReport): Promise<string> {
    if (!this.config.saveResults) return '';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (this.config.outputFormat === 'json') {
      const filename = `benchmark-report-${timestamp}.json`;
      const fs = require('fs');
      fs.writeFileSync(filename, JSON.stringify(report, null, 2));
      return filename;
    } else if (this.config.outputFormat === 'csv') {
      const filename = `benchmark-report-${timestamp}.csv`;
      const csvContent = this.convertToCSV(report);
      const fs = require('fs');
      fs.writeFileSync(filename, csvContent);
      return filename;
    }

    return '';
  }

  private convertToCSV(report: BenchmarkReport): string {
    const headers = [
      'Suite',
      'Test',
      'Concurrency',
      'Iterations',
      'Duration(ms)',
      'Mean Latency(ms)',
      'P95 Latency(ms)',
      'P99 Latency(ms)',
      'Throughput(ops/s)',
      'Error Rate',
      'Memory Usage(MB)'
    ];

    const rows = report.results.map(result => [
      result.suiteName,
      result.testName,
      result.concurrency,
      result.iterations,
      result.duration.toFixed(2),
      result.metrics.latency.mean.toFixed(2),
      result.metrics.latency.p95.toFixed(2),
      result.metrics.latency.p99.toFixed(2),
      result.metrics.throughput.operationsPerSecond.toFixed(2),
      (result.metrics.error.rate * 100).toFixed(2) + '%',
      (result.metrics.resource.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }
}

// =================== CLI Interface ===================

const args = process.argv.slice(2);
const config: Partial<BenchmarkConfig> = {};

// Parse command line arguments
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace('--', '');
  const value = args[i + 1];

  if (key === 'url') config.workerUrl = value;
  else if (key === 'websocket-url') config.websocketUrl = value;
  else if (key === 'iterations') config.iterations = parseInt(value);
  else if (key === 'suites') config.benchmarkSuites = value.split(',');
  else if (key === 'format') config.outputFormat = value as 'json' | 'csv' | 'console';
  else if (key === 'token') config.authToken = value;
}

async function runBenchmarks() {
  const benchmarkSuite = new PerformanceBenchmarkSuite(config);

  try {
    const report = await benchmarkSuite.runBenchmarks();

    console.log('\n Benchmark Report:');
    console.log('='.repeat(60));
    console.log('Summary:', JSON.stringify(report.summary, null, 2));

    // Display top performing tests
    const sortedResults = report.results
      .sort((a, b) => a.metrics.latency.mean - b.metrics.latency.mean)
      .slice(0, 10);

    console.log('\n Top 10 Fastest Tests:');
    sortedResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.testName} (${result.suiteName}): ${result.metrics.latency.mean.toFixed(2)}ms`);
    });

    // Save report
    const filename = await benchmarkSuite.saveReport(report);
    if (filename) {
      console.log(`\n Report saved to: ${filename}`);
    }

  } catch (error) {
    console.error(' Benchmark failed:', error);
    process.exit(1);
  }
}

runBenchmarks();

export { PerformanceBenchmarkSuite, BenchmarkConfig, BenchmarkReport };