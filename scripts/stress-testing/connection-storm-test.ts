#!/usr/bin/env node
/**
 * Connection Storm Stress Test
 * 專案名稱：Multi-Channel Support MVP - Stress Testing
 *
 * Simulates rapid connection/disconnection waves to test system resilience
 * Tests connection pooling, resource cleanup, and recovery mechanisms
 */

import WebSocket from 'ws';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

// =================== Configuration ===================

interface ConnectionStormConfig {
  targetUrl: string;
  authToken?: string;
  stormWaves: number;
  connectionsPerWave: number;
  waveIntervalMs: number;
  connectionHoldTimeMs: number;
  rapidDisconnectRatio: number; // 0.0 to 1.0
  concurrentWaves: number;
  gracefulShutdownRatio: number; // 0.0 to 1.0
  networkLatencySimulation: boolean;
  measureRecoveryTime: boolean;
  outputFile?: string;
}

const DEFAULT_STORM_CONFIG: ConnectionStormConfig = {
  targetUrl: 'wss://localhost:8787/api/websocket/connect',
  stormWaves: 10,
  connectionsPerWave: 100,
  waveIntervalMs: 5000,
  connectionHoldTimeMs: 2000,
  rapidDisconnectRatio: 0.3,
  concurrentWaves: 3,
  gracefulShutdownRatio: 0.7,
  networkLatencySimulation: true,
  measureRecoveryTime: true
};

// =================== Test Results ===================

interface ConnectionStormResults {
  summary: {
    totalWaves: number;
    totalConnections: number;
    successfulConnections: number;
    failedConnections: number;
    totalDuration: number;
    averageWaveDuration: number;
    systemRecoveryTime: number;
    peakConcurrentConnections: number;
  };
  waveResults: WaveResult[];
  systemStress: {
    connectionRateLimit: boolean;
    memoryPressure: boolean;
    latencyDegradation: boolean;
    errorRateSpike: boolean;
    recoverySuccess: boolean;
  };
  performance: {
    connectionLatencies: number[];
    disconnectionLatencies: number[];
    systemResponseTimes: number[];
    errorsByType: Record<string, number>;
  };
  recommendations: string[];
}

interface WaveResult {
  waveId: number;
  startTime: number;
  endTime: number;
  duration: number;
  connectionsAttempted: number;
  connectionsSuccessful: number;
  connectionsFailed: number;
  averageConnectionTime: number;
  peakLatency: number;
  errorRate: number;
  concurrentConnections: number;
  systemLoad: {
    before: SystemMetrics;
    during: SystemMetrics;
    after: SystemMetrics;
  };
}

interface SystemMetrics {
  timestamp: number;
  activeConnections: number;
  systemLatency: number;
  errorRate: number;
  memoryUsage?: number;
}

interface ConnectionResult {
  success: boolean;
  connectionTime: number;
  error?: string;
  connectionId: string;
  lifecycle: {
    connectStart: number;
    connected?: number;
    disconnectStart?: number;
    disconnected?: number;
  };
}

// =================== Connection Storm Tester ===================

export class ConnectionStormTester extends EventEmitter {
  private config: ConnectionStormConfig;
  private results: ConnectionStormResults;
  private activeConnections: Map<string, WebSocket> = new Map();
  private connectionResults: ConnectionResult[] = [];
  private systemMetrics: SystemMetrics[] = [];
  private testStartTime: number = 0;
  private peakConnections: number = 0;

  constructor(config: Partial<ConnectionStormConfig> = {}) {
    super();
    this.config = { ...DEFAULT_STORM_CONFIG, ...config };
    this.results = this.initializeResults();
  }

  async runConnectionStorm(): Promise<ConnectionStormResults> {
    console.log(' Starting Connection Storm Test');
    console.log('Configuration:', JSON.stringify(this.config, null, 2));

    this.testStartTime = performance.now();

    try {
      // Start system monitoring
      this.startSystemMonitoring();

      // Execute connection storm waves
      await this.executeStormWaves();

      // Measure system recovery
      if (this.config.measureRecoveryTime) {
        await this.measureSystemRecovery();
      }

      // Analyze results
      this.analyzeResults();

    } catch (error) {
      console.error(' Connection storm test error:', error);
    } finally {
      // Cleanup any remaining connections
      await this.cleanup();
    }

    return this.results;
  }

  private async executeStormWaves(): Promise<void> {
    console.log(` Executing ${this.config.stormWaves} storm waves`);

    for (let waveIndex = 0; waveIndex < this.config.stormWaves; waveIndex++) {
      console.log(`\n Wave ${waveIndex + 1}/${this.config.stormWaves}`);

      const waveResult = await this.executeWave(waveIndex);
      this.results.waveResults.push(waveResult);

      // Log wave summary
      console.log(` Wave ${waveIndex + 1} complete:`);
      console.log(`  - Connections: ${waveResult.connectionsSuccessful}/${waveResult.connectionsAttempted}`);
      console.log(`  - Duration: ${waveResult.duration.toFixed(0)}ms`);
      console.log(`  - Error rate: ${(waveResult.errorRate * 100).toFixed(1)}%`);

      // Wait between waves (except for the last wave)
      if (waveIndex < this.config.stormWaves - 1) {
        console.log(` Waiting ${this.config.waveIntervalMs}ms before next wave`);
        await this.sleep(this.config.waveIntervalMs);
      }
    }
  }

  private async executeWave(waveId: number): Promise<WaveResult> {
    const waveStartTime = performance.now();
    const beforeMetrics = await this.captureSystemMetrics();

    const waveResult: WaveResult = {
      waveId,
      startTime: waveStartTime,
      endTime: 0,
      duration: 0,
      connectionsAttempted: this.config.connectionsPerWave,
      connectionsSuccessful: 0,
      connectionsFailed: 0,
      averageConnectionTime: 0,
      peakLatency: 0,
      errorRate: 0,
      concurrentConnections: 0,
      systemLoad: {
        before: beforeMetrics,
        during: beforeMetrics, // Will be updated
        after: beforeMetrics  // Will be updated
      }
    };

    try {
      // Create connections with different patterns
      const connectionPromises = this.createWaveConnections(waveId);

      // Monitor during connection phase
      const duringMetrics = await this.captureSystemMetrics();
      waveResult.systemLoad.during = duringMetrics;

      // Wait for all connections to complete (or timeout)
      const connectionResults = await Promise.allSettled(connectionPromises);

      // Process results
      const successfulResults = connectionResults
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<ConnectionResult>).value)
        .filter(result => result.success);

      waveResult.connectionsSuccessful = successfulResults.length;
      waveResult.connectionsFailed = this.config.connectionsPerWave - successfulResults.length;
      waveResult.errorRate = waveResult.connectionsFailed / this.config.connectionsPerWave;

      if (successfulResults.length > 0) {
        const connectionTimes = successfulResults.map(r => r.connectionTime);
        waveResult.averageConnectionTime = connectionTimes.reduce((sum, time) => sum + time, 0) / connectionTimes.length;
        waveResult.peakLatency = Math.max(...connectionTimes);
      }

      waveResult.concurrentConnections = this.activeConnections.size;
      this.peakConnections = Math.max(this.peakConnections, this.activeConnections.size);

      // Hold connections for specified time
      console.log(` Holding ${this.activeConnections.size} connections for ${this.config.connectionHoldTimeMs}ms`);
      await this.sleep(this.config.connectionHoldTimeMs);

      // Disconnect connections with different patterns
      await this.disconnectWaveConnections(waveId);

    } catch (error) {
      console.error(` Wave ${waveId} error:`, error);
      waveResult.connectionsFailed = this.config.connectionsPerWave;
      waveResult.errorRate = 1.0;
    }

    const waveEndTime = performance.now();
    const afterMetrics = await this.captureSystemMetrics();

    waveResult.endTime = waveEndTime;
    waveResult.duration = waveEndTime - waveStartTime;
    waveResult.systemLoad.after = afterMetrics;

    return waveResult;
  }

  private createWaveConnections(waveId: number): Promise<ConnectionResult>[] {
    const promises: Promise<ConnectionResult>[] = [];

    for (let i = 0; i < this.config.connectionsPerWave; i++) {
      const connectionId = `wave_${waveId}_conn_${i}`;
      const userId = `storm_user_${waveId}_${i}`;
      const conversationId = `storm_room_${Math.floor(i / 10)}`; // Group connections into rooms

      promises.push(this.createStormConnection(connectionId, userId, conversationId));

      // Add some delay to simulate more realistic connection patterns
      if (this.config.networkLatencySimulation && i % 10 === 0) {
        promises.push(this.sleep(Math.random() * 50).then(() =>
          this.createStormConnection(`delayed_${connectionId}`, `delayed_${userId}`, conversationId)
        ));
      }
    }

    return promises;
  }

  private async createStormConnection(
    connectionId: string,
    userId: string,
    conversationId: string
  ): Promise<ConnectionResult> {
    const result: ConnectionResult = {
      success: false,
      connectionTime: 0,
      connectionId,
      lifecycle: {
        connectStart: performance.now()
      }
    };

    try {
      // Build WebSocket URL
      const url = new URL(this.config.targetUrl);
      url.searchParams.set('userId', userId);
      url.searchParams.set('conversationId', conversationId);
      url.searchParams.set('deviceId', 'storm-test');

      // Add auth token if provided
      const headers: any = {};
      if (this.config.authToken) {
        headers['Authorization'] = `Bearer ${this.config.authToken}`;
      }

      // Create WebSocket connection
      const ws = new WebSocket(url.toString(), { headers });

      // Set up connection promise
      const connectionPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000); // 10 second timeout

        ws.on('open', () => {
          clearTimeout(timeout);
          result.lifecycle.connected = performance.now();
          result.success = true;
          result.connectionTime = result.lifecycle.connected - result.lifecycle.connectStart;
          resolve();
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          result.error = error.message;
          reject(error);
        });
      });

      // Wait for connection
      await connectionPromise;

      // Store active connection
      this.activeConnections.set(connectionId, ws);

      console.log(` Storm connection established: ${connectionId} (${result.connectionTime.toFixed(2)}ms)`);

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      console.warn(` Storm connection failed: ${connectionId} - ${result.error}`);
    }

    this.connectionResults.push(result);
    return result;
  }

  private async disconnectWaveConnections(waveId: number): Promise<void> {
    console.log(` Disconnecting wave ${waveId} connections`);

    const waveConnections = Array.from(this.activeConnections.entries())
      .filter(([id]) => id.startsWith(`wave_${waveId}_`));

    const disconnectPromises: Promise<void>[] = [];

    for (const [connectionId, ws] of waveConnections) {
      const shouldRapidDisconnect = Math.random() < this.config.rapidDisconnectRatio;
      const shouldGracefulShutdown = Math.random() < this.config.gracefulShutdownRatio;

      if (shouldRapidDisconnect) {
        // Immediate disconnection (simulates network issues)
        disconnectPromises.push(this.immediateDisconnect(connectionId, ws));
      } else if (shouldGracefulShutdown) {
        // Graceful disconnection
        disconnectPromises.push(this.gracefulDisconnect(connectionId, ws));
      } else {
        // Abrupt disconnection (simulates crashes)
        disconnectPromises.push(this.abruptDisconnect(connectionId, ws));
      }
    }

    await Promise.allSettled(disconnectPromises);
  }

  private async immediateDisconnect(connectionId: string, ws: WebSocket): Promise<void> {
    try {
      ws.terminate(); // Immediate termination
      this.activeConnections.delete(connectionId);
    } catch (error) {
      console.warn(` Immediate disconnect error for ${connectionId}:`, error);
    }
  }

  private async gracefulDisconnect(connectionId: string, ws: WebSocket): Promise<void> {
    try {
      // Send close frame and wait for response
      ws.close(1000, 'Storm test complete');

      // Give it time to close gracefully
      await this.sleep(100);

      this.activeConnections.delete(connectionId);
    } catch (error) {
      console.warn(` Graceful disconnect error for ${connectionId}:`, error);
    }
  }

  private async abruptDisconnect(connectionId: string, ws: WebSocket): Promise<void> {
    try {
      // Simulate network failure
      ws.close(1006, 'Network error simulation');
      this.activeConnections.delete(connectionId);
    } catch (error) {
      console.warn(` Abrupt disconnect error for ${connectionId}:`, error);
    }
  }

  private async measureSystemRecovery(): Promise<void> {
    console.log(' Measuring system recovery time');

    const recoveryStartTime = performance.now();
    const maxRecoveryTime = 30000; // 30 seconds max
    const checkInterval = 1000; // Check every second

    let recovered = false;
    let recoveryTime = 0;

    while (!recovered && recoveryTime < maxRecoveryTime) {
      await this.sleep(checkInterval);
      recoveryTime = performance.now() - recoveryStartTime;

      // Check if system has recovered
      const metrics = await this.captureSystemMetrics();
      const isRecovered = this.isSystemRecovered(metrics);

      if (isRecovered) {
        recovered = true;
        console.log(` System recovered in ${recoveryTime.toFixed(0)}ms`);
      } else {
        console.log(` System still recovering... (${recoveryTime.toFixed(0)}ms)`);
      }
    }

    if (!recovered) {
      console.warn(` System did not recover within ${maxRecoveryTime}ms`);
      recoveryTime = maxRecoveryTime;
    }

    this.results.summary.systemRecoveryTime = recoveryTime;
    this.results.systemStress.recoverySuccess = recovered;
  }

  private isSystemRecovered(metrics: SystemMetrics): boolean {
    // Define recovery criteria
    const latencyThreshold = 1000; // 1 second
    const errorRateThreshold = 0.05; // 5%

    return metrics.systemLatency < latencyThreshold &&
           metrics.errorRate < errorRateThreshold;
  }

  private startSystemMonitoring(): void {
    console.log(' Starting system monitoring');

    const monitoringInterval = setInterval(async () => {
      const metrics = await this.captureSystemMetrics();
      this.systemMetrics.push(metrics);

      // Keep only recent metrics to prevent memory issues
      if (this.systemMetrics.length > 1000) {
        this.systemMetrics.shift();
      }
    }, 1000); // Every second

    // Store interval for cleanup
    this.emit('monitoring_started', monitoringInterval);
  }

  private async captureSystemMetrics(): Promise<SystemMetrics> {
    try {
      // In a real implementation, this would call actual system endpoints
      // For now, we'll simulate metrics based on connection count
      const activeConnections = this.activeConnections.size;

      // Simulate increasing latency with more connections
      const baseLatency = 50;
      const latencyPerConnection = 0.5;
      const systemLatency = baseLatency + (activeConnections * latencyPerConnection);

      // Simulate error rate increase under stress
      const baseErrorRate = 0.01;
      const stressMultiplier = Math.max(1, activeConnections / 1000);
      const errorRate = Math.min(0.5, baseErrorRate * stressMultiplier);

      return {
        timestamp: Date.now(),
        activeConnections,
        systemLatency,
        errorRate,
        memoryUsage: Math.random() * 100 // Placeholder
      };
    } catch (error) {
      console.warn(' Error capturing system metrics:', error);
      return {
        timestamp: Date.now(),
        activeConnections: this.activeConnections.size,
        systemLatency: 9999,
        errorRate: 1.0
      };
    }
  }

  private analyzeResults(): void {
    console.log(' Analyzing connection storm results');

    const totalDuration = performance.now() - this.testStartTime;
    const successfulConnections = this.connectionResults.filter(r => r.success).length;
    const failedConnections = this.connectionResults.length - successfulConnections;

    // Update summary
    this.results.summary = {
      totalWaves: this.config.stormWaves,
      totalConnections: this.connectionResults.length,
      successfulConnections,
      failedConnections,
      totalDuration,
      averageWaveDuration: this.results.waveResults.reduce((sum, w) => sum + w.duration, 0) / this.results.waveResults.length,
      systemRecoveryTime: this.results.summary.systemRecoveryTime,
      peakConcurrentConnections: this.peakConnections
    };

    // Analyze system stress indicators
    this.analyzeSystemStress();

    // Generate performance metrics
    this.generatePerformanceMetrics();

    // Generate recommendations
    this.generateRecommendations();
  }

  private analyzeSystemStress(): void {
    const avgErrorRate = this.results.waveResults.reduce((sum, w) => sum + w.errorRate, 0) / this.results.waveResults.length;
    const maxLatency = Math.max(...this.results.waveResults.map(w => w.peakLatency));
    const peakConnections = Math.max(...this.results.waveResults.map(w => w.concurrentConnections));

    this.results.systemStress = {
      connectionRateLimit: this.results.summary.failedConnections > this.results.summary.successfulConnections * 0.1,
      memoryPressure: false, // Would analyze actual memory metrics
      latencyDegradation: maxLatency > 5000, // 5 second threshold
      errorRateSpike: avgErrorRate > 0.1, // 10% threshold
      recoverySuccess: this.results.systemStress.recoverySuccess
    };
  }

  private generatePerformanceMetrics(): void {
    const connectionLatencies = this.connectionResults
      .filter(r => r.success)
      .map(r => r.connectionTime);

    const errorsByType: Record<string, number> = {};
    this.connectionResults
      .filter(r => !r.success && r.error)
      .forEach(r => {
        const errorType = r.error!;
        errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
      });

    this.results.performance = {
      connectionLatencies,
      disconnectionLatencies: [], // Would be measured if needed
      systemResponseTimes: this.systemMetrics.map(m => m.systemLatency),
      errorsByType
    };
  }

  private generateRecommendations(): void {
    const recommendations: string[] = [];

    // Connection rate recommendations
    if (this.results.systemStress.connectionRateLimit) {
      recommendations.push(' Implement connection rate limiting with exponential backoff');
      recommendations.push(' Add connection pooling to reduce overhead');
    }

    // Latency recommendations
    if (this.results.systemStress.latencyDegradation) {
      recommendations.push(' Optimize WebSocket handshake process');
      recommendations.push(' Consider implementing connection preloading');
    }

    // Error rate recommendations
    if (this.results.systemStress.errorRateSpike) {
      recommendations.push(' Implement circuit breaker pattern for overload protection');
      recommendations.push(' Add health checks and automatic failover mechanisms');
    }

    // Recovery recommendations
    if (!this.results.systemStress.recoverySuccess) {
      recommendations.push(' Implement graceful degradation under high load');
      recommendations.push(' Add automatic scaling mechanisms');
    }

    // General recommendations
    recommendations.push(' Implement real-time monitoring for connection storms');
    recommendations.push(' Set up alerts for rapid connection rate increases');
    recommendations.push(' Consider implementing connection recycling');

    this.results.recommendations = recommendations;
  }

  private async cleanup(): Promise<void> {
    console.log(' Cleaning up storm test connections');

    // Close all remaining connections
    const closePromises = Array.from(this.activeConnections.entries()).map(async ([id, ws]) => {
      try {
        ws.close(1000, 'Storm test cleanup');
      } catch (error) {
        console.warn(` Cleanup error for ${id}:`, error);
      }
    });

    await Promise.allSettled(closePromises);
    this.activeConnections.clear();

    console.log(' Storm test cleanup complete');
  }

  private initializeResults(): ConnectionStormResults {
    return {
      summary: {
        totalWaves: 0,
        totalConnections: 0,
        successfulConnections: 0,
        failedConnections: 0,
        totalDuration: 0,
        averageWaveDuration: 0,
        systemRecoveryTime: 0,
        peakConcurrentConnections: 0
      },
      waveResults: [],
      systemStress: {
        connectionRateLimit: false,
        memoryPressure: false,
        latencyDegradation: false,
        errorRateSpike: false,
        recoverySuccess: true
      },
      performance: {
        connectionLatencies: [],
        disconnectionLatencies: [],
        systemResponseTimes: [],
        errorsByType: {}
      },
      recommendations: []
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // =================== Results Export ===================

  async saveResults(): Promise<string | null> {
    if (!this.config.outputFile) return null;

    try {
      const fs = require('fs').promises;
      await fs.writeFile(this.config.outputFile, JSON.stringify(this.results, null, 2));
      return this.config.outputFile;
    } catch (error) {
      console.error(' Error saving results:', error);
      return null;
    }
  }
}

// =================== CLI Interface ===================

const args = process.argv.slice(2);
const config: Partial<ConnectionStormConfig> = {};

// Parse command line arguments
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace('--', '');
  const value = args[i + 1];

  if (key === 'websocket-url') config.targetUrl = value;
  else if (key === 'url' && !config.targetUrl) config.targetUrl = value;
  else if (key === 'waves') config.stormWaves = parseInt(value);
  else if (key === 'connections') config.connectionsPerWave = parseInt(value);
  else if (key === 'interval') config.waveIntervalMs = parseInt(value);
  else if (key === 'hold-time') config.connectionHoldTimeMs = parseInt(value);
  else if (key === 'rapid-ratio') config.rapidDisconnectRatio = parseFloat(value);
  else if (key === 'token') config.authToken = value;
  else if (key === 'output') config.outputFile = value;
}

async function runConnectionStorm() {
  const tester = new ConnectionStormTester(config);

  try {
    const results = await tester.runConnectionStorm();

    console.log('\n Connection Storm Test Results:');
    console.log('='.repeat(60));
    console.log('Summary:', JSON.stringify(results.summary, null, 2));
    console.log('\n System Stress Indicators:', JSON.stringify(results.systemStress, null, 2));
    console.log('\n Recommendations:');
    results.recommendations.forEach(rec => console.log(`- ${rec}`));

    // Save results if output file specified
    const savedFile = await tester.saveResults();
    if (savedFile) {
      console.log(`\n Detailed results saved to: ${savedFile}`);
    }

  } catch (error) {
    console.error(' Connection storm test failed:', error);
    process.exit(1);
  }
}

runConnectionStorm();

export { ConnectionStormTester, ConnectionStormConfig, ConnectionStormResults };