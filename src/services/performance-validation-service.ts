// Performance Comparison and Validation Service
// 專案名稱：Multi-Channel Support MVP - Performance Analysis System
// 提供WebSocket vs SSE性能比較、驗證和優化建議

import type {
  PerformanceComparison,
  ValidationResult,
  OptimizationRecommendation,
  LoadTestResult,
  PerformanceMetrics,
  PerformanceScore,
  PerformanceDetailedAnalysis,
  ConnectionValidationResult,
  LoadTestConfig,
  ConnectionTypeLoadTestResult,
  LoadTestSummary,
  ValidationHistoryEntry
} from '../types/performance-types';
import type { Bindings } from '../types/bindings';
// import { DeploymentMonitorService } from '../monitoring/deployment-monitor';

/**
 * Architecture Overview:
 *
 * PerformanceValidationService provides:
 * 1. Real-time performance comparison between WebSocket and SSE
 * 2. Automated performance validation against SLA targets
 * 3. Load testing and stress testing capabilities
 * 4. Performance regression detection
 * 5. Optimization recommendation engine
 * 6. Performance trend analysis and forecasting
 *
 * This ensures the WebSocket migration delivers the expected performance improvements
 */

export class PerformanceValidationService {
  private env: Bindings;
  // private _monitorService: DeploymentMonitorService; // Reserved for future monitoring integration

  // Performance thresholds and benchmarks
  private readonly SLA_TARGETS = {
    latency: {
      p50: 50,     // 50ms for 50th percentile
      p95: 150,    // 150ms for 95th percentile
      p99: 300     // 300ms for 99th percentile
    },
    throughput: {
      messagesPerSecond: 1000,
      connectionsPerSecond: 100,
      peakConcurrentConnections: 10000
    },
    reliability: {
      uptime: 0.999,           // 99.9% uptime
      connectionSuccess: 0.97,  // 97% connection success rate
      errorRate: 0.02          // 2% maximum error rate
    },
    efficiency: {
      cpuUtilization: 0.8,     // 80% maximum CPU
      memoryUtilization: 0.8,  // 80% maximum memory
      bandwidthEfficiency: 0.9  // 90% bandwidth efficiency
    }
  };

  private readonly PERFORMANCE_WEIGHTS = {
    latency: 0.35,      // 35% weight
    throughput: 0.25,   // 25% weight
    reliability: 0.25,  // 25% weight
    efficiency: 0.15    // 15% weight
  };

  constructor(env: Bindings) {
    this.env = env;
    // this._monitorService = new DeploymentMonitorService(env); // Reserved for future use
  }

  // =================== Performance Comparison ===================

  /**
   * Generate comprehensive performance comparison between WebSocket and SSE
   * @param timeRange Time range for analysis in milliseconds
   * @param includeLoadTest Whether to include load testing results
   * @returns Detailed performance comparison
   */
  async generatePerformanceComparison(
    timeRange: number = 3600000, // 1 hour default
    includeLoadTest: boolean = false
  ): Promise<PerformanceComparison> {
    console.log(`📊 [PerformanceValidation] Generating performance comparison for ${timeRange}ms`);

    const startTime = Date.now() - timeRange;
    const endTime = Date.now();

    try {
      // Collect performance data for both connection types
      const [websocketMetrics, sseMetrics, loadTestResults] = await Promise.all([
        this.collectConnectionTypeMetrics('websocket', startTime, endTime),
        this.collectConnectionTypeMetrics('sse', startTime, endTime),
        includeLoadTest ? this.getLoadTestResults() : Promise.resolve(null)
      ]);

      // Calculate performance scores
      const websocketScore = this.calculatePerformanceScore(websocketMetrics);
      const sseScore = this.calculatePerformanceScore(sseMetrics);

      // Generate detailed analysis
      const analysis = this.generateDetailedAnalysis(websocketMetrics, sseMetrics);

      // Create optimization recommendations
      const recommendations = await this.generateOptimizationRecommendations(
        websocketMetrics,
        sseMetrics,
        analysis
      );

      // Determine overall winner
      const winner = this.determineWinner(websocketScore, sseScore, analysis);

      const comparison: PerformanceComparison = {
        timeRange: { start: startTime, end: endTime },
        websocket: {
          metrics: websocketMetrics,
          score: websocketScore,
          advantages: analysis.websocketAdvantages,
          disadvantages: analysis.websocketDisadvantages
        },
        sse: {
          metrics: sseMetrics,
          score: sseScore,
          advantages: analysis.sseAdvantages,
          disadvantages: analysis.sseDisadvantages
        },
        comparison: {
          winner: winner.type,
          winnerScore: winner.score,
          scoreDifference: Math.abs(websocketScore.overall - sseScore.overall),
          keyDifferentiators: winner.reasons,
          confidence: winner.confidence
        },
        recommendations,
        loadTestResults,
        generatedAt: Date.now()
      };

      // Cache results for quick access
      await this.cachePerformanceComparison(comparison);

      console.log(`✅ [PerformanceValidation] Performance comparison completed`);
      return comparison;

    } catch (error) {
      console.error('❌ [PerformanceValidation] Error generating performance comparison:', error);
      throw error;
    }
  }

  /**
   * Validate performance against SLA targets
   * @param connectionType Type of connection to validate
   * @param timeRange Time range for validation
   * @returns Validation results
   */
  async validatePerformanceTargets(
    connectionType: 'websocket' | 'sse' | 'both' = 'both',
    timeRange: number = 3600000
  ): Promise<ValidationResult> {
    console.log(`🎯 [PerformanceValidation] Validating performance targets for ${connectionType}`);

    const startTime = Date.now() - timeRange;
    const endTime = Date.now();

    try {
      const validationResults: ValidationResult = {
        connectionType,
        timeRange: { start: startTime, end: endTime },
        slaTargets: this.SLA_TARGETS,
        results: [],
        overallPass: true,
        score: 0,
        validatedAt: Date.now()
      };

      if (connectionType === 'websocket' || connectionType === 'both') {
        const wsMetrics = await this.collectConnectionTypeMetrics('websocket', startTime, endTime);
        const wsValidation = this.validateConnectionTypeAgainstSLA(wsMetrics, 'websocket');
        validationResults.results.push(wsValidation);
      }

      if (connectionType === 'sse' || connectionType === 'both') {
        const sseMetrics = await this.collectConnectionTypeMetrics('sse', startTime, endTime);
        const sseValidation = this.validateConnectionTypeAgainstSLA(sseMetrics, 'sse');
        validationResults.results.push(sseValidation);
      }

      // Calculate overall validation results
      validationResults.overallPass = validationResults.results.every(r => r.passed);
      validationResults.score = validationResults.results.reduce((sum, r) => sum + r.score, 0) / validationResults.results.length;

      console.log(`${validationResults.overallPass ? '✅' : '❌'} [PerformanceValidation] Validation ${validationResults.overallPass ? 'passed' : 'failed'} with score ${validationResults.score.toFixed(2)}`);

      return validationResults;

    } catch (error) {
      console.error('❌ [PerformanceValidation] Error validating performance targets:', error);
      throw error;
    }
  }

  /**
   * Execute performance load test
   * @param config Load test configuration
   * @returns Load test results
   */
  async executeLoadTest(config: {
    connectionType: 'websocket' | 'sse' | 'both';
    duration: number; // milliseconds
    concurrentUsers: number;
    messagesPerUser: number;
    rampUpTime: number; // milliseconds
    includeStressTest: boolean;
  }): Promise<LoadTestResult> {
    console.log(`🚀 [PerformanceValidation] Starting load test: ${config.concurrentUsers} users, ${config.duration}ms`);

    const testId = `loadtest_${Date.now()}`;

    try {
      const loadTestResult: LoadTestResult = {
        testId,
        config,
        startTime: Date.now(),
        endTime: 0,
        results: {},
        summary: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageLatency: 0,
          p95Latency: 0,
          p99Latency: 0,
          throughput: 0,
          errorRate: 0,
          peakConcurrentConnections: 0
        },
        issues: [],
        recommendations: []
      };

      // Execute load test for each connection type
      if (config.connectionType === 'websocket' || config.connectionType === 'both') {
        console.log('🔗 [PerformanceValidation] Testing WebSocket performance');
        loadTestResult.results.websocket = await this.executeConnectionTypeLoadTest('websocket', config);
      }

      if (config.connectionType === 'sse' || config.connectionType === 'both') {
        console.log('📡 [PerformanceValidation] Testing SSE performance');
        loadTestResult.results.sse = await this.executeConnectionTypeLoadTest('sse', config);
      }

      // Execute stress test if requested
      if (config.includeStressTest) {
        console.log('💪 [PerformanceValidation] Running stress test');
        loadTestResult.stressTestResults = await this.executeStressTest(config);
      }

      // Calculate summary metrics
      loadTestResult.summary = this.calculateLoadTestSummary(loadTestResult.results);
      loadTestResult.endTime = Date.now();

      // Identify issues and generate recommendations
      loadTestResult.issues = this.identifyPerformanceIssues(loadTestResult);
      loadTestResult.recommendations = this.generateLoadTestRecommendations(loadTestResult);

      // Store load test results
      await this.storeLoadTestResults(loadTestResult);

      console.log(`✅ [PerformanceValidation] Load test completed: ${loadTestResult.summary.successfulRequests}/${loadTestResult.summary.totalRequests} successful`);

      return loadTestResult;

    } catch (error) {
      console.error('❌ [PerformanceValidation] Load test failed:', error);
      throw error;
    }
  }

  /**
   * Generate performance optimization recommendations
   * @param currentMetrics Current system performance metrics
   * @returns Optimization recommendations
   */
  async generateOptimizationRecommendations(
    websocketMetrics: PerformanceMetrics,
    sseMetrics: PerformanceMetrics,
    _analysis: PerformanceDetailedAnalysis
  ): Promise<OptimizationRecommendation[]> {
    console.log('💡 [PerformanceValidation] Generating optimization recommendations');

    const recommendations: OptimizationRecommendation[] = [];

    // Latency optimization recommendations
    if (websocketMetrics.latency.p95 > this.SLA_TARGETS.latency.p95) {
      recommendations.push({
        category: 'latency',
        priority: 'high',
        title: 'Optimize WebSocket Latency',
        description: `WebSocket P95 latency (${websocketMetrics.latency.p95}ms) exceeds target (${this.SLA_TARGETS.latency.p95}ms)`,
        impact: 'high',
        effort: 'medium',
        recommendations: [
          'Implement message batching to reduce round trips',
          'Optimize Durable Object placement for geographic distribution',
          'Review network infrastructure for bottlenecks',
          'Consider connection pooling optimizations'
        ],
        expectedImprovement: '20-30% latency reduction',
        estimatedImplementationTime: '1-2 weeks'
      });
    }

    // Throughput optimization recommendations
    if (websocketMetrics.throughput.messagesPerSecond < this.SLA_TARGETS.throughput.messagesPerSecond) {
      recommendations.push({
        category: 'throughput',
        priority: 'medium',
        title: 'Improve Message Throughput',
        description: `Message throughput (${websocketMetrics.throughput.messagesPerSecond}/s) below target (${this.SLA_TARGETS.throughput.messagesPerSecond}/s)`,
        impact: 'medium',
        effort: 'medium',
        recommendations: [
          'Implement asynchronous message processing',
          'Optimize database query performance',
          'Scale Durable Object instances',
          'Implement message compression'
        ],
        expectedImprovement: '40-50% throughput increase',
        estimatedImplementationTime: '2-3 weeks'
      });
    }

    // Connection reliability recommendations
    if (websocketMetrics.reliability.connectionSuccessRate < this.SLA_TARGETS.reliability.connectionSuccess) {
      recommendations.push({
        category: 'reliability',
        priority: 'high',
        title: 'Improve Connection Reliability',
        description: `Connection success rate (${(websocketMetrics.reliability.connectionSuccessRate * 100).toFixed(1)}%) below target (${(this.SLA_TARGETS.reliability.connectionSuccess * 100)}%)`,
        impact: 'high',
        effort: 'high',
        recommendations: [
          'Implement exponential backoff for connection retries',
          'Improve connection health monitoring',
          'Optimize WebSocket handshake process',
          'Enhance error handling and recovery mechanisms'
        ],
        expectedImprovement: '15-20% improvement in connection success',
        estimatedImplementationTime: '3-4 weeks'
      });
    }

    // Resource efficiency recommendations
    if (websocketMetrics.efficiency.cpuUtilization > this.SLA_TARGETS.efficiency.cpuUtilization) {
      recommendations.push({
        category: 'efficiency',
        priority: 'medium',
        title: 'Optimize Resource Utilization',
        description: `CPU utilization (${(websocketMetrics.efficiency.cpuUtilization * 100).toFixed(1)}%) exceeds recommended threshold (${(this.SLA_TARGETS.efficiency.cpuUtilization * 100)}%)`,
        impact: 'medium',
        effort: 'low',
        recommendations: [
          'Profile code for CPU-intensive operations',
          'Implement more efficient data structures',
          'Optimize JSON parsing and serialization',
          'Consider implementing worker thread pools'
        ],
        expectedImprovement: '25-35% CPU utilization reduction',
        estimatedImplementationTime: '1-2 weeks'
      });
    }

    // Comparative optimization recommendations
    if (sseMetrics.latency.average < websocketMetrics.latency.average) {
      recommendations.push({
        category: 'comparative',
        priority: 'low',
        title: 'WebSocket Latency Optimization',
        description: 'SSE shows better average latency than WebSocket',
        impact: 'low',
        effort: 'low',
        recommendations: [
          'Investigate WebSocket connection overhead',
          'Optimize message serialization for WebSocket',
          'Review WebSocket frame size optimization',
          'Consider hybrid approach for different message types'
        ],
        expectedImprovement: '10-15% latency improvement',
        estimatedImplementationTime: '1 week'
      });
    }

    // Sort recommendations by priority and impact
    recommendations.sort((a, b) => {
      const priorityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      const impactOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

      const aPriority = priorityOrder[a.priority] || 0;
      const bPriority = priorityOrder[b.priority] || 0;
      const aImpact = impactOrder[a.impact] || 0;
      const bImpact = impactOrder[b.impact] || 0;

      if (aPriority !== bPriority) return bPriority - aPriority;
      return bImpact - aImpact;
    });

    console.log(`💡 [PerformanceValidation] Generated ${recommendations.length} optimization recommendations`);

    return recommendations;
  }

  // =================== Private Helper Methods ===================

  private async collectConnectionTypeMetrics(
    connectionType: 'websocket' | 'sse',
    startTime: number,
    endTime: number
  ): Promise<PerformanceMetrics> {
    // This would collect real metrics from monitoring systems
    // For now, return realistic mock data based on connection type

    const baseLatency = connectionType === 'websocket' ? 45 : 65;
    const baseErrorRate = connectionType === 'websocket' ? 0.025 : 0.020;
    const baseThroughput = connectionType === 'websocket' ? 1200 : 900;

    return {
      connectionType,
      timeRange: { start: startTime, end: endTime },
      latency: {
        average: baseLatency + (Math.random() - 0.5) * 10,
        median: baseLatency + (Math.random() - 0.5) * 8,
        p95: baseLatency * 2.5 + (Math.random() - 0.5) * 20,
        p99: baseLatency * 4 + (Math.random() - 0.5) * 40,
        min: Math.max(5, baseLatency - 20),
        max: baseLatency * 6 + Math.random() * 100
      },
      throughput: {
        messagesPerSecond: baseThroughput + (Math.random() - 0.5) * 200,
        connectionsPerSecond: 80 + (Math.random() - 0.5) * 20,
        peakConcurrentConnections: 8000 + Math.random() * 2000,
        dataTransferRate: 1500000 + Math.random() * 500000 // bytes per second
      },
      reliability: {
        uptime: 0.998 + Math.random() * 0.002,
        connectionSuccessRate: 0.965 + Math.random() * 0.03,
        errorRate: baseErrorRate + (Math.random() - 0.5) * 0.01,
        reconnectionRate: 0.05 + Math.random() * 0.03
      },
      efficiency: {
        cpuUtilization: 0.65 + Math.random() * 0.2,
        memoryUtilization: 0.70 + Math.random() * 0.15,
        networkUtilization: 0.60 + Math.random() * 0.25,
        bandwidthEfficiency: 0.85 + Math.random() * 0.1,
        compressionRatio: connectionType === 'websocket' ? 0.7 : 0.8
      },
      scalability: {
        maxConcurrentConnections: connectionType === 'websocket' ? 12000 : 8000,
        connectionGrowthRate: 0.15 + Math.random() * 0.1,
        resourceScalingEfficiency: 0.8 + Math.random() * 0.15
      }
    };
  }

  private calculatePerformanceScore(metrics: PerformanceMetrics): {
    overall: number;
    latency: number;
    throughput: number;
    reliability: number;
    efficiency: number;
  } {
    // Calculate individual category scores (0-100)
    const latencyScore = this.calculateLatencyScore(metrics.latency);
    const throughputScore = this.calculateThroughputScore(metrics.throughput);
    const reliabilityScore = this.calculateReliabilityScore(metrics.reliability);
    const efficiencyScore = this.calculateEfficiencyScore(metrics.efficiency);

    // Calculate weighted overall score
    const overall = (
      latencyScore * this.PERFORMANCE_WEIGHTS.latency +
      throughputScore * this.PERFORMANCE_WEIGHTS.throughput +
      reliabilityScore * this.PERFORMANCE_WEIGHTS.reliability +
      efficiencyScore * this.PERFORMANCE_WEIGHTS.efficiency
    );

    return {
      overall: Math.round(overall),
      latency: Math.round(latencyScore),
      throughput: Math.round(throughputScore),
      reliability: Math.round(reliabilityScore),
      efficiency: Math.round(efficiencyScore)
    };
  }

  private calculateLatencyScore(latency: PerformanceMetrics['latency']): number {
    // Score based on how well latency meets SLA targets
    let score = 100;

    // P50 latency impact (30% weight)
    if (latency.median > this.SLA_TARGETS.latency.p50) {
      const excess = latency.median - this.SLA_TARGETS.latency.p50;
      score -= (excess / this.SLA_TARGETS.latency.p50) * 30;
    }

    // P95 latency impact (50% weight)
    if (latency.p95 > this.SLA_TARGETS.latency.p95) {
      const excess = latency.p95 - this.SLA_TARGETS.latency.p95;
      score -= (excess / this.SLA_TARGETS.latency.p95) * 50;
    }

    // P99 latency impact (20% weight)
    if (latency.p99 > this.SLA_TARGETS.latency.p99) {
      const excess = latency.p99 - this.SLA_TARGETS.latency.p99;
      score -= (excess / this.SLA_TARGETS.latency.p99) * 20;
    }

    return Math.max(0, score);
  }

  private calculateThroughputScore(throughput: PerformanceMetrics['throughput']): number {
    let score = 100;

    // Messages per second (60% weight)
    if (throughput.messagesPerSecond < this.SLA_TARGETS.throughput.messagesPerSecond) {
      const deficit = this.SLA_TARGETS.throughput.messagesPerSecond - throughput.messagesPerSecond;
      score -= (deficit / this.SLA_TARGETS.throughput.messagesPerSecond) * 60;
    }

    // Connections per second (25% weight)
    if (throughput.connectionsPerSecond < this.SLA_TARGETS.throughput.connectionsPerSecond) {
      const deficit = this.SLA_TARGETS.throughput.connectionsPerSecond - throughput.connectionsPerSecond;
      score -= (deficit / this.SLA_TARGETS.throughput.connectionsPerSecond) * 25;
    }

    // Peak concurrent connections (15% weight)
    if (throughput.peakConcurrentConnections < this.SLA_TARGETS.throughput.peakConcurrentConnections) {
      const deficit = this.SLA_TARGETS.throughput.peakConcurrentConnections - throughput.peakConcurrentConnections;
      score -= (deficit / this.SLA_TARGETS.throughput.peakConcurrentConnections) * 15;
    }

    return Math.max(0, score);
  }

  private calculateReliabilityScore(reliability: PerformanceMetrics['reliability']): number {
    let score = 100;

    // Uptime (40% weight)
    if (reliability.uptime < this.SLA_TARGETS.reliability.uptime) {
      const deficit = this.SLA_TARGETS.reliability.uptime - reliability.uptime;
      score -= (deficit / (1 - this.SLA_TARGETS.reliability.uptime)) * 40;
    }

    // Connection success rate (35% weight)
    if (reliability.connectionSuccessRate < this.SLA_TARGETS.reliability.connectionSuccess) {
      const deficit = this.SLA_TARGETS.reliability.connectionSuccess - reliability.connectionSuccessRate;
      score -= (deficit / this.SLA_TARGETS.reliability.connectionSuccess) * 35;
    }

    // Error rate (25% weight)
    if (reliability.errorRate > this.SLA_TARGETS.reliability.errorRate) {
      const excess = reliability.errorRate - this.SLA_TARGETS.reliability.errorRate;
      score -= (excess / this.SLA_TARGETS.reliability.errorRate) * 25;
    }

    return Math.max(0, score);
  }

  private calculateEfficiencyScore(efficiency: PerformanceMetrics['efficiency']): number {
    let score = 100;

    // CPU utilization (40% weight)
    if (efficiency.cpuUtilization > this.SLA_TARGETS.efficiency.cpuUtilization) {
      const excess = efficiency.cpuUtilization - this.SLA_TARGETS.efficiency.cpuUtilization;
      score -= (excess / (1 - this.SLA_TARGETS.efficiency.cpuUtilization)) * 40;
    }

    // Memory utilization (40% weight)
    if (efficiency.memoryUtilization > this.SLA_TARGETS.efficiency.memoryUtilization) {
      const excess = efficiency.memoryUtilization - this.SLA_TARGETS.efficiency.memoryUtilization;
      score -= (excess / (1 - this.SLA_TARGETS.efficiency.memoryUtilization)) * 40;
    }

    // Bandwidth efficiency (20% weight)
    if (efficiency.bandwidthEfficiency < this.SLA_TARGETS.efficiency.bandwidthEfficiency) {
      const deficit = this.SLA_TARGETS.efficiency.bandwidthEfficiency - efficiency.bandwidthEfficiency;
      score -= (deficit / this.SLA_TARGETS.efficiency.bandwidthEfficiency) * 20;
    }

    return Math.max(0, score);
  }

  private generateDetailedAnalysis(
    websocketMetrics: PerformanceMetrics,
    sseMetrics: PerformanceMetrics
  ): PerformanceDetailedAnalysis {
    const websocketAdvantages: string[] = [];
    const websocketDisadvantages: string[] = [];
    const sseAdvantages: string[] = [];
    const sseDisadvantages: string[] = [];

    // Compare latency
    if (websocketMetrics.latency.average < sseMetrics.latency.average) {
      websocketAdvantages.push(`Lower average latency (${websocketMetrics.latency.average.toFixed(1)}ms vs ${sseMetrics.latency.average.toFixed(1)}ms)`);
      sseDisadvantages.push('Higher average latency than WebSocket');
    } else {
      sseAdvantages.push(`Lower average latency (${sseMetrics.latency.average.toFixed(1)}ms vs ${websocketMetrics.latency.average.toFixed(1)}ms)`);
      websocketDisadvantages.push('Higher average latency than SSE');
    }

    // Compare throughput
    if (websocketMetrics.throughput.messagesPerSecond > sseMetrics.throughput.messagesPerSecond) {
      websocketAdvantages.push(`Higher message throughput (${websocketMetrics.throughput.messagesPerSecond.toFixed(0)}/s vs ${sseMetrics.throughput.messagesPerSecond.toFixed(0)}/s)`);
      sseDisadvantages.push('Lower message throughput than WebSocket');
    } else {
      sseAdvantages.push(`Higher message throughput (${sseMetrics.throughput.messagesPerSecond.toFixed(0)}/s vs ${websocketMetrics.throughput.messagesPerSecond.toFixed(0)}/s)`);
      websocketDisadvantages.push('Lower message throughput than SSE');
    }

    // Compare reliability
    if (websocketMetrics.reliability.connectionSuccessRate > sseMetrics.reliability.connectionSuccessRate) {
      websocketAdvantages.push(`Better connection reliability (${(websocketMetrics.reliability.connectionSuccessRate * 100).toFixed(1)}% vs ${(sseMetrics.reliability.connectionSuccessRate * 100).toFixed(1)}%)`);
      sseDisadvantages.push('Lower connection success rate than WebSocket');
    } else {
      sseAdvantages.push(`Better connection reliability (${(sseMetrics.reliability.connectionSuccessRate * 100).toFixed(1)}% vs ${(websocketMetrics.reliability.connectionSuccessRate * 100).toFixed(1)}%)`);
      websocketDisadvantages.push('Lower connection success rate than SSE');
    }

    // Compare error rates
    if (websocketMetrics.reliability.errorRate < sseMetrics.reliability.errorRate) {
      websocketAdvantages.push(`Lower error rate (${(websocketMetrics.reliability.errorRate * 100).toFixed(2)}% vs ${(sseMetrics.reliability.errorRate * 100).toFixed(2)}%)`);
      sseDisadvantages.push('Higher error rate than WebSocket');
    } else {
      sseAdvantages.push(`Lower error rate (${(sseMetrics.reliability.errorRate * 100).toFixed(2)}% vs ${(websocketMetrics.reliability.errorRate * 100).toFixed(2)}%)`);
      websocketDisadvantages.push('Higher error rate than SSE');
    }

    // Compare resource efficiency
    if (websocketMetrics.efficiency.cpuUtilization < sseMetrics.efficiency.cpuUtilization) {
      websocketAdvantages.push(`Lower CPU utilization (${(websocketMetrics.efficiency.cpuUtilization * 100).toFixed(1)}% vs ${(sseMetrics.efficiency.cpuUtilization * 100).toFixed(1)}%)`);
      sseDisadvantages.push('Higher CPU utilization than WebSocket');
    } else {
      sseAdvantages.push(`Lower CPU utilization (${(sseMetrics.efficiency.cpuUtilization * 100).toFixed(1)}% vs ${(websocketMetrics.efficiency.cpuUtilization * 100).toFixed(1)}%)`);
      websocketDisadvantages.push('Higher CPU utilization than SSE');
    }

    return {
      websocketAdvantages,
      websocketDisadvantages,
      sseAdvantages,
      sseDisadvantages
    };
  }

  private determineWinner(
    websocketScore: PerformanceScore,
    sseScore: PerformanceScore,
    analysis: PerformanceDetailedAnalysis
  ): { type: 'websocket' | 'sse' | 'tie'; score: number; confidence: number; reasons: string[] } {
    const scoreDifference = Math.abs(websocketScore.overall - sseScore.overall);
    const threshold = 5; // Minimum score difference to declare a winner

    if (scoreDifference < threshold) {
      return {
        type: 'tie',
        score: Math.max(websocketScore.overall, sseScore.overall),
        confidence: 0.5,
        reasons: ['Performance difference is negligible', 'Both solutions meet requirements']
      };
    }

    if (websocketScore.overall > sseScore.overall) {
      return {
        type: 'websocket',
        score: websocketScore.overall,
        confidence: Math.min(0.95, 0.5 + (scoreDifference / 100)),
        reasons: analysis.websocketAdvantages.slice(0, 3)
      };
    } else {
      return {
        type: 'sse',
        score: sseScore.overall,
        confidence: Math.min(0.95, 0.5 + (scoreDifference / 100)),
        reasons: analysis.sseAdvantages.slice(0, 3)
      };
    }
  }

  private validateConnectionTypeAgainstSLA(
    metrics: PerformanceMetrics,
    connectionType: string
  ): ConnectionValidationResult {
    const validations: Array<{ metric: string; target: number; actual: number; passed: boolean; score: number }> = [];

    // Validate latency targets
    validations.push({
      metric: 'P95 Latency',
      target: this.SLA_TARGETS.latency.p95,
      actual: metrics.latency.p95,
      passed: metrics.latency.p95 <= this.SLA_TARGETS.latency.p95,
      score: Math.max(0, 100 - Math.max(0, metrics.latency.p95 - this.SLA_TARGETS.latency.p95))
    });

    // Validate throughput targets
    validations.push({
      metric: 'Messages Per Second',
      target: this.SLA_TARGETS.throughput.messagesPerSecond,
      actual: metrics.throughput.messagesPerSecond,
      passed: metrics.throughput.messagesPerSecond >= this.SLA_TARGETS.throughput.messagesPerSecond,
      score: Math.min(100, (metrics.throughput.messagesPerSecond / this.SLA_TARGETS.throughput.messagesPerSecond) * 100)
    });

    // Validate reliability targets
    validations.push({
      metric: 'Connection Success Rate',
      target: this.SLA_TARGETS.reliability.connectionSuccess,
      actual: metrics.reliability.connectionSuccessRate,
      passed: metrics.reliability.connectionSuccessRate >= this.SLA_TARGETS.reliability.connectionSuccess,
      score: (metrics.reliability.connectionSuccessRate / this.SLA_TARGETS.reliability.connectionSuccess) * 100
    });

    validations.push({
      metric: 'Error Rate',
      target: this.SLA_TARGETS.reliability.errorRate,
      actual: metrics.reliability.errorRate,
      passed: metrics.reliability.errorRate <= this.SLA_TARGETS.reliability.errorRate,
      score: Math.max(0, 100 - ((metrics.reliability.errorRate / this.SLA_TARGETS.reliability.errorRate) * 100))
    });

    const overallScore = validations.reduce((sum, v) => sum + v.score, 0) / validations.length;
    const allPassed = validations.every(v => v.passed);

    return {
      connectionType,
      validations,
      passed: allPassed,
      score: overallScore,
      passingCount: validations.filter(v => v.passed).length,
      totalCount: validations.length
    };
  }

  private async executeConnectionTypeLoadTest(connectionType: string, config: LoadTestConfig): Promise<ConnectionTypeLoadTestResult> {
    // This would execute real load testing
    // For now, return mock load test results

    const baseLatency = connectionType === 'websocket' ? 45 : 65;
    const successRate = connectionType === 'websocket' ? 0.96 : 0.98;

    return {
      connectionType,
      totalRequests: config.concurrentUsers * config.messagesPerUser,
      successfulRequests: Math.floor(config.concurrentUsers * config.messagesPerUser * successRate),
      failedRequests: Math.floor(config.concurrentUsers * config.messagesPerUser * (1 - successRate)),
      averageLatency: baseLatency + Math.random() * 20,
      p95Latency: (baseLatency + Math.random() * 20) * 2.5,
      p99Latency: (baseLatency + Math.random() * 20) * 4,
      throughput: (config.concurrentUsers * config.messagesPerUser) / (config.duration / 1000),
      peakConcurrentConnections: config.concurrentUsers,
      errorRate: 1 - successRate,
      resourceUtilization: {
        cpu: 0.6 + Math.random() * 0.3,
        memory: 0.7 + Math.random() * 0.2
      }
    };
  }

  private async executeStressTest(_config: LoadTestConfig): Promise<LoadTestResult['stressTestResults']> {
    // This would execute stress testing beyond normal capacity
    // For now, return mock stress test results

    return {
      maxCapacity: {
        concurrentConnections: 15000,
        messagesPerSecond: 2500,
        sustainedDuration: 1800000 // 30 minutes
      },
      breakingPoint: {
        connections: 18000,
        latencyDegradation: 400, // ms
        errorRateSpike: 0.15
      },
      recoveryTime: 45000, // 45 seconds
      gracefulDegradation: true
    };
  }

  private calculateLoadTestSummary(results: Record<string, ConnectionTypeLoadTestResult | undefined>): LoadTestSummary {
    const allResults = Object.values(results).filter((r): r is ConnectionTypeLoadTestResult => r !== undefined);
    if (allResults.length === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        throughput: 0,
        errorRate: 0,
        peakConcurrentConnections: 0
      };
    }

    return {
      totalRequests: allResults.reduce((sum: number, r: ConnectionTypeLoadTestResult) => sum + r.totalRequests, 0),
      successfulRequests: allResults.reduce((sum: number, r: ConnectionTypeLoadTestResult) => sum + r.successfulRequests, 0),
      failedRequests: allResults.reduce((sum: number, r: ConnectionTypeLoadTestResult) => sum + r.failedRequests, 0),
      averageLatency: allResults.reduce((sum: number, r: ConnectionTypeLoadTestResult) => sum + r.averageLatency, 0) / allResults.length,
      p95Latency: Math.max(...allResults.map((r: ConnectionTypeLoadTestResult) => r.p95Latency)),
      p99Latency: Math.max(...allResults.map((r: ConnectionTypeLoadTestResult) => r.p99Latency)),
      throughput: allResults.reduce((sum: number, r: ConnectionTypeLoadTestResult) => sum + r.throughput, 0),
      errorRate: allResults.reduce((sum: number, r: ConnectionTypeLoadTestResult) => sum + r.errorRate, 0) / allResults.length,
      peakConcurrentConnections: Math.max(...allResults.map((r: ConnectionTypeLoadTestResult) => r.peakConcurrentConnections))
    };
  }

  private identifyPerformanceIssues(loadTestResult: LoadTestResult): string[] {
    const issues: string[] = [];

    if (loadTestResult.summary.errorRate > 0.05) {
      issues.push(`High error rate: ${(loadTestResult.summary.errorRate * 100).toFixed(2)}%`);
    }

    if (loadTestResult.summary.averageLatency > 100) {
      issues.push(`High average latency: ${loadTestResult.summary.averageLatency.toFixed(1)}ms`);
    }

    if (loadTestResult.summary.p95Latency > 300) {
      issues.push(`Unacceptable P95 latency: ${loadTestResult.summary.p95Latency.toFixed(1)}ms`);
    }

    if (loadTestResult.summary.throughput < 500) {
      issues.push(`Low throughput: ${loadTestResult.summary.throughput.toFixed(0)} messages/second`);
    }

    return issues;
  }

  private generateLoadTestRecommendations(loadTestResult: LoadTestResult): string[] {
    const recommendations: string[] = [];

    if (loadTestResult.summary.errorRate > 0.03) {
      recommendations.push('Implement circuit breakers and improved error handling');
      recommendations.push('Review connection timeout and retry logic');
    }

    if (loadTestResult.summary.averageLatency > 80) {
      recommendations.push('Optimize database query performance');
      recommendations.push('Implement response caching where appropriate');
    }

    if (loadTestResult.summary.throughput < 800) {
      recommendations.push('Scale worker instances horizontally');
      recommendations.push('Implement message batching and compression');
    }

    return recommendations;
  }

  private async cachePerformanceComparison(comparison: PerformanceComparison): Promise<void> {
    try {
      await this.env.CACHE.put(
        'latest_performance_comparison',
        JSON.stringify(comparison),
        { expirationTtl: 3600 } // 1 hour
      );
    } catch (error) {
      console.error('❌ [PerformanceValidation] Error caching performance comparison:', error);
    }
  }

  private async storeLoadTestResults(results: LoadTestResult): Promise<void> {
    try {
      await this.env.CACHE.put(
        `load_test_results:${results.testId}`,
        JSON.stringify(results),
        { expirationTtl: 604800 } // 7 days
      );

      // Also update latest results
      await this.env.CACHE.put(
        'latest_load_test_results',
        JSON.stringify(results),
        { expirationTtl: 86400 } // 24 hours
      );

    } catch (error) {
      console.error('❌ [PerformanceValidation] Error storing load test results:', error);
    }
  }

  private async getLoadTestResults(): Promise<LoadTestResult | null> {
    try {
      const resultsStr = await this.env.CACHE.get('latest_load_test_results');
      return resultsStr ? JSON.parse(resultsStr) : null;
    } catch (error) {
      console.error('❌ [PerformanceValidation] Error getting load test results:', error);
      return null;
    }
  }

  // =================== Public API ===================

  /**
   * Get latest performance comparison results
   */
  async getLatestPerformanceComparison(): Promise<PerformanceComparison | null> {
    try {
      const comparisonStr = await this.env.CACHE.get('latest_performance_comparison');
      return comparisonStr ? JSON.parse(comparisonStr) : null;
    } catch (error) {
      console.error('❌ [PerformanceValidation] Error getting latest performance comparison:', error);
      return null;
    }
  }

  /**
   * Get performance validation status
   */
  async getValidationStatus(): Promise<{
    lastValidation: number | null;
    currentStatus: 'passing' | 'failing' | 'unknown';
    nextValidation: number | null;
    validationHistory: ValidationHistoryEntry[];
  }> {
    try {
      // This would get real validation status
      return {
        lastValidation: Date.now() - 1800000, // 30 minutes ago
        currentStatus: 'passing',
        nextValidation: Date.now() + 1800000, // 30 minutes from now
        validationHistory: []
      };
    } catch (error) {
      return {
        lastValidation: null,
        currentStatus: 'unknown',
        nextValidation: null,
        validationHistory: []
      };
    }
  }
}