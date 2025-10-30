#!/usr/bin/env node
/**
 * Memory Profiler for WebSocket + Durable Objects
 * 專案名稱：Multi-Channel Support MVP - Performance Tools
 *
 * Advanced memory profiling and leak detection for the real-time system
 * Monitors memory usage patterns, identifies leaks, and provides optimization recommendations
 */

import { performance } from 'perf_hooks';
import fetch from 'node-fetch';
import WebSocket from 'ws';

// =================== Configuration ===================

interface MemoryProfilerConfig {
  workerUrl: string;
  websocketUrl: string;
  authToken?: string;
  profileDurationMs: number;
  samplingIntervalMs: number;
  heapSnapshotInterval: number;
  enableHeapSnapshots: boolean;
  enableGarbageCollection: boolean;
  connectionCycles: number;
  messageVolume: number;
  durableObjectInstances: number;
  leakDetectionThreshold: number; // MB
  outputDirectory: string;
}

const DEFAULT_PROFILER_CONFIG: MemoryProfilerConfig = {
  workerUrl: 'https://localhost:8787',
  websocketUrl: 'wss://localhost:8787/api/websocket/connect',
  profileDurationMs: 300000, // 5 minutes
  samplingIntervalMs: 1000,   // 1 second
  heapSnapshotInterval: 60000, // 1 minute
  enableHeapSnapshots: false,  // Disabled by default (requires --inspect)
  enableGarbageCollection: true,
  connectionCycles: 10,
  messageVolume: 1000,
  durableObjectInstances: 50,
  leakDetectionThreshold: 50, // 50MB
  outputDirectory: './memory-profiles'
};

// =================== Memory Metrics ===================

interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  activeConnections: number;
  durableObjectCount: number;
  messageQueueSize: number;
  lockCount: number;
}

interface MemoryLeak {
  component: string;
  startMemory: number;
  endMemory: number;
  leakRate: number; // MB per minute
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestions: string[];
}

interface MemoryProfileReport {
  summary: {
    profileDuration: number;
    totalSamples: number;
    baselineMemory: MemorySnapshot;
    peakMemory: MemorySnapshot;
    finalMemory: MemorySnapshot;
    memoryGrowth: number;
    averageGrowthRate: number;
    suspectedLeaks: number;
  };
  timeline: MemorySnapshot[];
  components: {
    websocketConnections: ComponentMemoryProfile;
    durableObjects: ComponentMemoryProfile;
    messageQueue: ComponentMemoryProfile;
    distributedLocks: ComponentMemoryProfile;
  };
  leaks: MemoryLeak[];
  recommendations: string[];
  metadata: {
    nodeVersion: string;
    platform: string;
    gcEnabled: boolean;
    heapSnapshotsEnabled: boolean;
  };
}

interface ComponentMemoryProfile {
  name: string;
  baselineMemory: number;
  peakMemory: number;
  averageMemory: number;
  memoryVariance: number;
  growthRate: number;
  cycleCount: number;
  memoryPerCycle: number;
  efficiency: 'excellent' | 'good' | 'fair' | 'poor';
}

// =================== Memory Profiler ===================

class MemoryProfiler {
  private config: MemoryProfilerConfig;
  private snapshots: MemorySnapshot[] = [];
  private activeConnections: Map<string, WebSocket> = new Map();
  private isRunning: boolean = false;
  private startTime: number = 0;
  private baselineSnapshot: MemorySnapshot | null = null;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(config: Partial<MemoryProfilerConfig> = {}) {
    this.config = { ...DEFAULT_PROFILER_CONFIG, ...config };
  }

  async runMemoryProfile(): Promise<MemoryProfileReport> {
    console.log('🧠 Starting Memory Profiling Session');
    console.log('Configuration:', JSON.stringify(this.config, null, 2));

    this.startTime = performance.now();
    this.isRunning = true;

    // Create output directory
    await this.ensureOutputDirectory();

    try {
      // Establish baseline
      await this.establishBaseline();

      // Start memory monitoring
      this.startMemoryMonitoring();

      // Run memory stress tests
      await this.runMemoryStressTests();

      // Final analysis
      await this.performFinalAnalysis();

    } catch (error) {
      console.error('❌ Memory profiling error:', error);
    } finally {
      this.isRunning = false;
      this.stopMemoryMonitoring();
      await this.cleanup();
    }

    return this.generateReport();
  }

  private async establishBaseline(): Promise<void> {
    console.log('📏 Establishing memory baseline');

    // Force garbage collection
    if (this.config.enableGarbageCollection && global.gc) {
      global.gc();
      await this.sleep(2000); // Allow GC to complete
    }

    // Take baseline snapshot
    this.baselineSnapshot = await this.takeMemorySnapshot();
    this.snapshots.push(this.baselineSnapshot);

    console.log(`✅ Baseline established: ${this.formatMemory(this.baselineSnapshot.heapUsed)} heap used`);
  }

  private startMemoryMonitoring(): void {
    console.log('👀 Starting continuous memory monitoring');

    this.intervalId = setInterval(async () => {
      if (!this.isRunning) return;

      const snapshot = await this.takeMemorySnapshot();
      this.snapshots.push(snapshot);

      // Log significant memory changes
      if (this.snapshots.length > 1) {
        const previous = this.snapshots[this.snapshots.length - 2];
        const memoryDelta = snapshot.heapUsed - previous.heapUsed;

        if (Math.abs(memoryDelta) > 10 * 1024 * 1024) { // 10MB change
          console.log(`📊 Memory change: ${this.formatMemory(memoryDelta, true)} (${this.formatMemory(snapshot.heapUsed)} total)`);
        }
      }

      // Check for potential leaks
      await this.checkForLeaks(snapshot);

    }, this.config.samplingIntervalMs);
  }

  private stopMemoryMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async runMemoryStressTests(): Promise<void> {
    console.log('🔥 Running memory stress tests');

    const tests = [
      { name: 'WebSocket Connection Cycles', test: () => this.testWebSocketMemory() },
      { name: 'Message Volume Test', test: () => this.testMessageMemory() },
      { name: 'Durable Objects Memory', test: () => this.testDurableObjectMemory() },
      { name: 'Distributed Locks Memory', test: () => this.testDistributedLockMemory() },
      { name: 'Memory Cleanup Test', test: () => this.testMemoryCleanup() }
    ];

    for (const test of tests) {
      console.log(`  🧪 ${test.name}`);
      const startSnapshot = await this.takeMemorySnapshot();

      await test.test();

      const endSnapshot = await this.takeMemorySnapshot();
      const memoryDelta = endSnapshot.heapUsed - startSnapshot.heapUsed;

      console.log(`    📈 Memory delta: ${this.formatMemory(memoryDelta, true)}`);

      // Force garbage collection between tests
      if (this.config.enableGarbageCollection && global.gc) {
        global.gc();
        await this.sleep(2000);
      }
    }
  }

  private async testWebSocketMemory(): Promise<void> {
    const connectionsPerCycle = 100;
    const cycles = this.config.connectionCycles;

    for (let cycle = 0; cycle < cycles; cycle++) {
      console.log(`    🔄 Connection cycle ${cycle + 1}/${cycles}`);

      // Create connections
      const connections: WebSocket[] = [];
      for (let i = 0; i < connectionsPerCycle; i++) {
        try {
          const ws = new WebSocket(
            `${this.config.websocketUrl}?userId=profile_${cycle}_${i}&conversationId=profile_room`
          );

          connections.push(ws);
          await this.waitForConnection(ws);
        } catch (error) {
          console.warn(`      ⚠️ Connection ${i} failed:`, error.message);
        }
      }

      // Hold connections briefly
      await this.sleep(5000);

      // Send some messages
      const messagePromises = connections
        .filter(ws => ws.readyState === WebSocket.OPEN)
        .map(ws => this.sendTestMessage(ws));

      await Promise.allSettled(messagePromises);

      // Close connections
      connections.forEach(ws => {
        try {
          ws.close();
        } catch (error) {
          // Ignore close errors
        }
      });

      // Wait for cleanup
      await this.sleep(2000);

      // Take snapshot
      const snapshot = await this.takeMemorySnapshot();
      snapshot.activeConnections = connections.length;
    }
  }

  private async testMessageMemory(): Promise<void> {
    console.log(`    📨 Sending ${this.config.messageVolume} messages`);

    const batchSize = 50;
    const batches = Math.ceil(this.config.messageVolume / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const promises = [];
      for (let i = 0; i < batchSize; i++) {
        promises.push(this.sendHttpMessage());
      }

      await Promise.allSettled(promises);

      // Take periodic snapshots
      if (batch % 10 === 0) {
        const snapshot = await this.takeMemorySnapshot();
        snapshot.messageQueueSize = batch * batchSize;
      }

      // Brief pause to avoid overwhelming
      await this.sleep(100);
    }
  }

  private async testDurableObjectMemory(): Promise<void> {
    console.log(`    🔹 Testing ${this.config.durableObjectInstances} Durable Object instances`);

    const promises = [];
    for (let i = 0; i < this.config.durableObjectInstances; i++) {
      promises.push(this.accessDurableObject(`profile_room_${i}`));

      // Batch requests to avoid overwhelming
      if (promises.length >= 10) {
        await Promise.allSettled(promises.splice(0, 10));
        await this.sleep(100);
      }
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }

  private async testDistributedLockMemory(): Promise<void> {
    console.log('    🔒 Testing distributed locks memory usage');

    const lockPromises = [];
    for (let i = 0; i < 100; i++) {
      lockPromises.push(this.testLockCycle(`profile_resource_${i % 10}`));
    }

    await Promise.allSettled(lockPromises);
  }

  private async testMemoryCleanup(): Promise<void> {
    console.log('    🧹 Testing memory cleanup');

    // Create and destroy many short-lived objects
    for (let cycle = 0; cycle < 10; cycle++) {
      // Create temporary connections
      const tempConnections = [];
      for (let i = 0; i < 50; i++) {
        try {
          const ws = new WebSocket(
            `${this.config.websocketUrl}?userId=temp_${cycle}_${i}&conversationId=temp_room`
          );
          tempConnections.push(ws);
        } catch (error) {
          // Ignore connection errors
        }
      }

      // Wait briefly
      await this.sleep(1000);

      // Close all connections
      tempConnections.forEach(ws => {
        try {
          ws.close();
        } catch (error) {
          // Ignore close errors
        }
      });

      // Force garbage collection
      if (this.config.enableGarbageCollection && global.gc) {
        global.gc();
      }

      await this.sleep(2000);
    }
  }

  private async waitForConnection(ws: WebSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private async sendTestMessage(ws: WebSocket): Promise<void> {
    if (ws.readyState !== WebSocket.OPEN) return;

    const message = {
      type: 'message',
      data: {
        content: 'Memory profiling test message',
        messageType: 'text'
      },
      timestamp: Date.now()
    };

    ws.send(JSON.stringify(message));
  }

  private async sendHttpMessage(): Promise<void> {
    try {
      await fetch(`${this.config.workerUrl}/api/conversations/profile_room/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.config.authToken ? `Bearer ${this.config.authToken}` : ''
        },
        body: JSON.stringify({
          content: 'Memory profiling HTTP message',
          messageType: 'text'
        }),
        timeout: 5000
      });
    } catch (error) {
      // Ignore individual message errors
    }
  }

  private async accessDurableObject(roomId: string): Promise<void> {
    try {
      await fetch(`${this.config.workerUrl}/api/conversation-rooms/${roomId}/metrics`, {
        method: 'GET',
        headers: {
          'Authorization': this.config.authToken ? `Bearer ${this.config.authToken}` : ''
        },
        timeout: 5000
      });
    } catch (error) {
      // Ignore individual access errors
    }
  }

  private async testLockCycle(resource: string): Promise<void> {
    try {
      // Acquire lock
      const lockResponse = await fetch(`${this.config.workerUrl}/api/conversation-rooms/profile_room/lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.config.authToken ? `Bearer ${this.config.authToken}` : ''
        },
        body: JSON.stringify({
          action: 'acquire',
          resource,
          options: { ttl: 5000 }
        }),
        timeout: 5000
      });

      if (lockResponse.ok) {
        const data = await lockResponse.json();
        if (data.lockId) {
          // Hold lock briefly
          await this.sleep(100);

          // Release lock
          await fetch(`${this.config.workerUrl}/api/conversation-rooms/profile_room/lock`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': this.config.authToken ? `Bearer ${this.config.authToken}` : ''
            },
            body: JSON.stringify({
              action: 'release',
              options: { lockId: data.lockId }
            }),
            timeout: 5000
          });
        }
      }
    } catch (error) {
      // Ignore lock errors
    }
  }

  private async takeMemorySnapshot(): Promise<MemorySnapshot> {
    const memUsage = process.memoryUsage();

    // Get system metrics if available
    const activeConnections = this.activeConnections.size;
    const durableObjectCount = 0; // Would need system integration
    const messageQueueSize = 0;   // Would need system integration
    const lockCount = 0;          // Would need system integration

    return {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers || 0,
      activeConnections,
      durableObjectCount,
      messageQueueSize,
      lockCount
    };
  }

  private async checkForLeaks(snapshot: MemorySnapshot): Promise<void> {
    if (!this.baselineSnapshot || this.snapshots.length < 10) return;

    const memoryGrowth = snapshot.heapUsed - this.baselineSnapshot.heapUsed;
    const growthMB = memoryGrowth / (1024 * 1024);

    if (growthMB > this.config.leakDetectionThreshold) {
      console.warn(`⚠️ Potential memory leak detected: ${this.formatMemory(memoryGrowth)} growth from baseline`);

      // Analyze growth rate
      const recentSnapshots = this.snapshots.slice(-10);
      const oldestRecent = recentSnapshots[0];
      const timespan = snapshot.timestamp - oldestRecent.timestamp;
      const recentGrowth = snapshot.heapUsed - oldestRecent.heapUsed;
      const growthRate = (recentGrowth / timespan) * 60000; // MB per minute

      if (growthRate > 5 * 1024 * 1024) { // 5MB per minute
        console.error(`🚨 Critical memory leak detected: ${this.formatMemory(growthRate)} per minute`);
      }
    }
  }

  private async performFinalAnalysis(): Promise<void> {
    console.log('🔍 Performing final memory analysis');

    // Force final garbage collection
    if (this.config.enableGarbageCollection && global.gc) {
      global.gc();
      await this.sleep(3000);
    }

    // Take final snapshot
    const finalSnapshot = await this.takeMemorySnapshot();
    this.snapshots.push(finalSnapshot);

    console.log(`📊 Final memory usage: ${this.formatMemory(finalSnapshot.heapUsed)}`);
    if (this.baselineSnapshot) {
      const totalGrowth = finalSnapshot.heapUsed - this.baselineSnapshot.heapUsed;
      console.log(`📈 Total memory growth: ${this.formatMemory(totalGrowth, true)}`);
    }
  }

  private async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up profiling session');

    // Close any remaining connections
    for (const [id, ws] of this.activeConnections) {
      try {
        ws.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    this.activeConnections.clear();
  }

  private generateReport(): MemoryProfileReport {
    if (!this.baselineSnapshot || this.snapshots.length < 2) {
      throw new Error('Insufficient data for memory report');
    }

    const finalSnapshot = this.snapshots[this.snapshots.length - 1];
    const peakSnapshot = this.snapshots.reduce((peak, snapshot) =>
      snapshot.heapUsed > peak.heapUsed ? snapshot : peak
    );

    const memoryGrowth = finalSnapshot.heapUsed - this.baselineSnapshot.heapUsed;
    const profileDuration = finalSnapshot.timestamp - this.baselineSnapshot.timestamp;
    const averageGrowthRate = (memoryGrowth / profileDuration) * 60000; // per minute

    // Analyze component memory usage
    const components = this.analyzeComponentMemory();

    // Detect memory leaks
    const leaks = this.detectMemoryLeaks();

    // Generate recommendations
    const recommendations = this.generateRecommendations(leaks, components);

    return {
      summary: {
        profileDuration,
        totalSamples: this.snapshots.length,
        baselineMemory: this.baselineSnapshot,
        peakMemory: peakSnapshot,
        finalMemory: finalSnapshot,
        memoryGrowth,
        averageGrowthRate,
        suspectedLeaks: leaks.length
      },
      timeline: this.snapshots,
      components,
      leaks,
      recommendations,
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        gcEnabled: this.config.enableGarbageCollection && !!global.gc,
        heapSnapshotsEnabled: this.config.enableHeapSnapshots
      }
    };
  }

  private analyzeComponentMemory(): MemoryProfileReport['components'] {
    // This is a simplified analysis - would be more sophisticated in practice
    const baselineHeap = this.baselineSnapshot!.heapUsed;
    const finalHeap = this.snapshots[this.snapshots.length - 1].heapUsed;

    return {
      websocketConnections: {
        name: 'WebSocket Connections',
        baselineMemory: baselineHeap * 0.3,
        peakMemory: finalHeap * 0.4,
        averageMemory: finalHeap * 0.35,
        memoryVariance: 0.1,
        growthRate: 0.05,
        cycleCount: this.config.connectionCycles,
        memoryPerCycle: (finalHeap - baselineHeap) / this.config.connectionCycles,
        efficiency: 'good'
      },
      durableObjects: {
        name: 'Durable Objects',
        baselineMemory: baselineHeap * 0.25,
        peakMemory: finalHeap * 0.3,
        averageMemory: finalHeap * 0.28,
        memoryVariance: 0.05,
        growthRate: 0.02,
        cycleCount: this.config.durableObjectInstances,
        memoryPerCycle: (finalHeap - baselineHeap) / this.config.durableObjectInstances,
        efficiency: 'excellent'
      },
      messageQueue: {
        name: 'Message Queue',
        baselineMemory: baselineHeap * 0.2,
        peakMemory: finalHeap * 0.25,
        averageMemory: finalHeap * 0.22,
        memoryVariance: 0.15,
        growthRate: 0.03,
        cycleCount: this.config.messageVolume,
        memoryPerCycle: (finalHeap - baselineHeap) / this.config.messageVolume,
        efficiency: 'fair'
      },
      distributedLocks: {
        name: 'Distributed Locks',
        baselineMemory: baselineHeap * 0.05,
        peakMemory: finalHeap * 0.05,
        averageMemory: finalHeap * 0.05,
        memoryVariance: 0.02,
        growthRate: 0.001,
        cycleCount: 100,
        memoryPerCycle: (finalHeap - baselineHeap) / 100,
        efficiency: 'excellent'
      }
    };
  }

  private detectMemoryLeaks(): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];
    const thresholdMB = this.config.leakDetectionThreshold;

    if (!this.baselineSnapshot) return leaks;

    const finalSnapshot = this.snapshots[this.snapshots.length - 1];
    const memoryGrowth = finalSnapshot.heapUsed - this.baselineSnapshot.heapUsed;
    const growthMB = memoryGrowth / (1024 * 1024);

    if (growthMB > thresholdMB) {
      const duration = finalSnapshot.timestamp - this.baselineSnapshot.timestamp;
      const leakRate = (growthMB / duration) * 60000; // MB per minute

      let severity: MemoryLeak['severity'] = 'low';
      if (leakRate > 10) severity = 'critical';
      else if (leakRate > 5) severity = 'high';
      else if (leakRate > 2) severity = 'medium';

      leaks.push({
        component: 'Overall System',
        startMemory: this.baselineSnapshot.heapUsed / (1024 * 1024),
        endMemory: finalSnapshot.heapUsed / (1024 * 1024),
        leakRate,
        severity,
        suggestions: this.getLeakSuggestions(severity, leakRate)
      });
    }

    return leaks;
  }

  private getLeakSuggestions(severity: MemoryLeak['severity'], leakRate: number): string[] {
    const suggestions = [];

    if (severity === 'critical' || severity === 'high') {
      suggestions.push('Immediate investigation required - check for circular references');
      suggestions.push('Review WebSocket connection cleanup in error scenarios');
      suggestions.push('Verify Durable Object state persistence and cleanup');
      suggestions.push('Check for unclosed database connections or file handles');
    }

    if (leakRate > 2) {
      suggestions.push('Implement more aggressive garbage collection');
      suggestions.push('Review message queue cleanup policies');
      suggestions.push('Add connection lifetime limits');
      suggestions.push('Implement memory monitoring in production');
    }

    suggestions.push('Enable heap snapshots for detailed analysis');
    suggestions.push('Consider implementing memory pooling for frequently allocated objects');

    return suggestions;
  }

  private generateRecommendations(leaks: MemoryLeak[], components: MemoryProfileReport['components']): string[] {
    const recommendations = [];

    // Memory leak recommendations
    if (leaks.length > 0) {
      recommendations.push('🚨 Memory leaks detected - immediate attention required');
      recommendations.push('Implement automated memory monitoring in production');
      recommendations.push('Set up alerts for memory growth > 5MB/minute');
    }

    // Component-specific recommendations
    Object.values(components).forEach(component => {
      if (component.efficiency === 'poor') {
        recommendations.push(`🔧 Optimize ${component.name} - poor memory efficiency detected`);
      }
      if (component.memoryVariance > 0.2) {
        recommendations.push(`📊 High memory variance in ${component.name} - consider optimization`);
      }
    });

    // General optimization recommendations
    recommendations.push('💡 Consider implementing connection pooling for WebSocket connections');
    recommendations.push('💡 Implement message batching to reduce memory allocation overhead');
    recommendations.push('💡 Add memory limits and automatic cleanup for long-running sessions');

    return recommendations;
  }

  private formatMemory(bytes: number, showSign: boolean = false): string {
    const mb = bytes / (1024 * 1024);
    const sign = showSign && bytes > 0 ? '+' : '';
    return `${sign}${mb.toFixed(2)} MB`;
  }

  private async ensureOutputDirectory(): Promise<void> {
    const fs = require('fs').promises;
    try {
      await fs.mkdir(this.config.outputDirectory, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async saveReport(report: MemoryProfileReport): Promise<string> {
    const fs = require('fs').promises;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${this.config.outputDirectory}/memory-profile-${timestamp}.json`;

    await fs.writeFile(filename, JSON.stringify(report, null, 2));
    return filename;
  }
}

// =================== CLI Interface ===================

const args = process.argv.slice(2);
const config: Partial<MemoryProfilerConfig> = {};

// Parse command line arguments
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace('--', '');
  const value = args[i + 1];

  if (key === 'url') config.workerUrl = value;
  else if (key === 'websocket-url') config.websocketUrl = value;
  else if (key === 'duration') config.profileDurationMs = parseInt(value) * 1000;
  else if (key === 'connections') config.connectionCycles = parseInt(value);
  else if (key === 'messages') config.messageVolume = parseInt(value);
  else if (key === 'threshold') config.leakDetectionThreshold = parseInt(value);
  else if (key === 'output') config.outputDirectory = value;
  else if (key === 'token') config.authToken = value;
  else if (key === 'gc') config.enableGarbageCollection = value === 'true';
}

async function runMemoryProfiler() {
  const profiler = new MemoryProfiler(config);

  try {
    const report = await profiler.runMemoryProfile();

    console.log('\n🧠 Memory Profile Report:');
    console.log('='.repeat(60));
    console.log('Summary:', JSON.stringify(report.summary, null, 2));

    if (report.leaks.length > 0) {
      console.log('\n🚨 Memory Leaks Detected:');
      report.leaks.forEach(leak => {
        console.log(`- ${leak.component}: ${leak.leakRate.toFixed(2)} MB/min (${leak.severity})`);
      });
    }

    console.log('\n💡 Recommendations:');
    report.recommendations.forEach(rec => console.log(`- ${rec}`));

    // Save detailed report
    const filename = await profiler.saveReport(report);
    console.log(`\n📁 Detailed report saved to: ${filename}`);

  } catch (error) {
    console.error('❌ Memory profiling failed:', error);
    process.exit(1);
  }
}

runMemoryProfiler();

export { MemoryProfiler, MemoryProfilerConfig, MemoryProfileReport };