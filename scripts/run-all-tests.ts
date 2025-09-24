#!/usr/bin/env node
/**
 * Comprehensive Test Runner
 * 專案名稱：Multi-Channel Support MVP - Test Automation
 *
 * Orchestrates all load testing, benchmarking, and stress testing scenarios
 * Provides unified test execution and comprehensive reporting
 */

import { performance } from 'perf_hooks';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

// =================== Configuration ===================

interface TestSuite {
  name: string;
  description: string;
  script: string;
  args: string[];
  timeout: number;
  required: boolean;
  category: 'load' | 'stress' | 'benchmark' | 'monitor';
}

interface TestConfig {
  targetUrl: string;
  websocketUrl: string;
  authToken?: string;
  outputDirectory: string;
  parallel: boolean;
  maxConcurrency: number;
  skipOnFailure: boolean;
  generateReport: boolean;
}

const DEFAULT_CONFIG: TestConfig = {
  targetUrl: 'https://localhost:8787',
  websocketUrl: 'wss://localhost:8787/api/websocket/connect',
  outputDirectory: './test-results',
  parallel: false,
  maxConcurrency: 3,
  skipOnFailure: false,
  generateReport: true
};

// =================== Test Suites ===================

const TEST_SUITES: TestSuite[] = [
  // Load Testing Suites
  {
    name: 'websocket-load-test',
    description: 'WebSocket connection and message load testing',
    script: 'scripts/load-testing/websocket-load-test.ts',
    args: ['--connections', '1000', '--rate', '50', '--messages', '100', '--duration', '300'],
    timeout: 600000, // 10 minutes
    required: true,
    category: 'load'
  },
  {
    name: 'durable-objects-stress-test',
    description: 'Durable Objects performance and stress testing',
    script: 'scripts/load-testing/durable-objects-stress-test.ts',
    args: ['--rooms', '100', '--users', '1000', '--messages', '500', '--duration', '300'],
    timeout: 900000, // 15 minutes
    required: true,
    category: 'load'
  },

  // Stress Testing Suites
  {
    name: 'connection-storm-test',
    description: 'Connection storm and recovery testing',
    script: 'scripts/stress-testing/connection-storm-test.ts',
    args: ['--waves', '10', '--connections', '100', '--interval', '5000', '--hold-time', '2000'],
    timeout: 600000, // 10 minutes
    required: true,
    category: 'stress'
  },
  {
    name: 'message-flood-test',
    description: 'High-volume message flooding stress test',
    script: 'scripts/stress-testing/message-flood-test.ts',
    args: ['--messages', '10000', '--rate', '100', '--connections', '50', '--size', '1024'],
    timeout: 900000, // 15 minutes
    required: true,
    category: 'stress'
  },

  // Performance Benchmarking
  {
    name: 'benchmark-suite',
    description: 'Comprehensive performance benchmarking',
    script: 'tools/performance/benchmark-suite.ts',
    args: ['--iterations', '1000', '--suites', 'latency,throughput,memory,websocket,durableobjects'],
    timeout: 1200000, // 20 minutes
    required: true,
    category: 'benchmark'
  },
  {
    name: 'memory-profiler',
    description: 'Memory usage profiling and leak detection',
    script: 'tools/performance/memory-profiler.ts',
    args: ['--duration', '300', '--connections', '10', '--messages', '1000', '--threshold', '50'],
    timeout: 600000, // 10 minutes
    required: false,
    category: 'benchmark'
  },

  // Optional Extended Tests
  {
    name: 'extended-websocket-test',
    description: 'Extended WebSocket testing with high concurrency',
    script: 'scripts/load-testing/websocket-load-test.ts',
    args: ['--connections', '5000', '--rate', '100', '--messages', '500', '--duration', '600'],
    timeout: 1800000, // 30 minutes
    required: false,
    category: 'load'
  },
  {
    name: 'extreme-stress-test',
    description: 'Extreme stress testing for system limits',
    script: 'scripts/stress-testing/connection-storm-test.ts',
    args: ['--waves', '20', '--connections', '500', '--interval', '1000', '--rapid-ratio', '0.5'],
    timeout: 1800000, // 30 minutes
    required: false,
    category: 'stress'
  }
];

// =================== Test Results ===================

interface TestResult {
  suiteName: string;
  description: string;
  category: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: 'passed' | 'failed' | 'skipped' | 'timeout';
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  outputFile?: string;
  metrics?: any;
  error?: string;
}

interface TestReport {
  summary: {
    totalSuites: number;
    passedSuites: number;
    failedSuites: number;
    skippedSuites: number;
    totalDuration: number;
    startTime: number;
    endTime: number;
  };
  results: TestResult[];
  systemInfo: {
    nodeVersion: string;
    platform: string;
    arch: string;
    memory: number;
  };
  configuration: TestConfig;
  recommendations: string[];
}

// =================== Test Runner ===================

export class ComprehensiveTestRunner {
  private config: TestConfig;
  private results: TestResult[] = [];
  private startTime: number = 0;
  private outputDirectory: string;

  constructor(config: Partial<TestConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.outputDirectory = path.resolve(this.config.outputDirectory);
  }

  async runAllTests(suiteFilter?: string[]): Promise<TestReport> {
    console.log('🚀 Starting Comprehensive Test Suite');
    console.log('Configuration:', JSON.stringify(this.config, null, 2));

    this.startTime = performance.now();

    try {
      // Prepare output directory
      await this.prepareOutputDirectory();

      // Filter test suites
      const suitesToRun = this.filterTestSuites(suiteFilter);
      console.log(`📋 Running ${suitesToRun.length} test suites`);

      // Run tests
      if (this.config.parallel) {
        await this.runTestsInParallel(suitesToRun);
      } else {
        await this.runTestsSequentially(suitesToRun);
      }

      // Generate report
      const report = await this.generateReport();

      // Save report
      if (this.config.generateReport) {
        await this.saveReport(report);
      }

      return report;

    } catch (error) {
      console.error('❌ Test runner error:', error);
      throw error;
    }
  }

  private filterTestSuites(suiteFilter?: string[]): TestSuite[] {
    let suites = TEST_SUITES;

    // Filter by names if provided
    if (suiteFilter && suiteFilter.length > 0) {
      suites = suites.filter(suite =>
        suiteFilter.some(filter =>
          suite.name.includes(filter) || suite.category === filter
        )
      );
    }

    // Always include required suites unless explicitly filtered
    if (suiteFilter && suiteFilter.length > 0) {
      const requiredSuites = TEST_SUITES.filter(suite => suite.required);
      suites = [...new Set([...suites, ...requiredSuites])];
    }

    return suites;
  }

  private async runTestsSequentially(suites: TestSuite[]): Promise<void> {
    console.log('📝 Running tests sequentially');

    for (const [index, suite] of suites.entries()) {
      console.log(`\n[${index + 1}/${suites.length}] Running: ${suite.name}`);
      console.log(`Description: ${suite.description}`);

      const result = await this.runSingleTest(suite);
      this.results.push(result);

      // Log result
      this.logTestResult(result);

      // Check if we should stop on failure
      if (this.config.skipOnFailure && result.status === 'failed') {
        console.log('⚠️ Stopping execution due to test failure');
        break;
      }

      // Brief pause between tests
      if (index < suites.length - 1) {
        console.log('⏳ Pausing 5 seconds before next test...');
        await this.sleep(5000);
      }
    }
  }

  private async runTestsInParallel(suites: TestSuite[]): Promise<void> {
    console.log(`🔄 Running tests in parallel (max concurrency: ${this.config.maxConcurrency})`);

    // Group suites by category to avoid conflicts
    const suiteGroups = this.groupSuitesByCategory(suites);

    for (const [category, categorysuites] of Object.entries(suiteGroups)) {
      console.log(`\n📂 Running ${category} tests (${categorysuites.length} suites)`);

      // Run category suites in batches
      const batches = this.createBatches(categorysuites, this.config.maxConcurrency);

      for (const [batchIndex, batch] of batches.entries()) {
        console.log(`\n🔄 Batch ${batchIndex + 1}/${batches.length} (${batch.length} tests)`);

        const promises = batch.map(suite => this.runSingleTest(suite));
        const results = await Promise.allSettled(promises);

        // Process results
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            this.results.push(result.value);
            this.logTestResult(result.value);
          } else {
            const failedResult: TestResult = {
              suiteName: batch[index].name,
              description: batch[index].description,
              category: batch[index].category,
              startTime: Date.now(),
              endTime: Date.now(),
              duration: 0,
              status: 'failed',
              error: result.reason?.message || 'Unknown error'
            };
            this.results.push(failedResult);
            this.logTestResult(failedResult);
          }
        });
      }

      // Pause between categories
      console.log('⏳ Pausing 10 seconds before next category...');
      await this.sleep(10000);
    }
  }

  private groupSuitesByCategory(suites: TestSuite[]): Record<string, TestSuite[]> {
    const groups: Record<string, TestSuite[]> = {};

    for (const suite of suites) {
      if (!groups[suite.category]) {
        groups[suite.category] = [];
      }
      groups[suite.category].push(suite);
    }

    return groups;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async runSingleTest(suite: TestSuite): Promise<TestResult> {
    const result: TestResult = {
      suiteName: suite.name,
      description: suite.description,
      category: suite.category,
      startTime: performance.now(),
      endTime: 0,
      duration: 0,
      status: 'failed'
    };

    try {
      // Prepare command and arguments
      const scriptPath = path.resolve(suite.script);
      const args = [
        scriptPath,
        '--url', this.config.targetUrl,
        '--websocket-url', this.config.websocketUrl,
        ...suite.args
      ];

      // Add auth token if provided
      if (this.config.authToken) {
        args.push('--token', this.config.authToken);
      }

      // Add output file
      const outputFile = path.join(this.outputDirectory, `${suite.name}-results.json`);
      args.push('--output', outputFile);

      // Execute test
      const { stdout, stderr, exitCode } = await this.executeTest('node', args, suite.timeout);

      result.endTime = performance.now();
      result.duration = result.endTime - result.startTime;
      result.stdout = stdout;
      result.stderr = stderr;
      result.exitCode = exitCode;
      result.outputFile = outputFile;

      // Determine status
      if (exitCode === 0) {
        result.status = 'passed';
        // Try to load metrics from output file
        try {
          const metricsData = await fs.readFile(outputFile, 'utf8');
          result.metrics = JSON.parse(metricsData);
        } catch (error) {
          // Metrics loading failed, but test still passed
        }
      } else {
        result.status = 'failed';
        result.error = `Process exited with code ${exitCode}`;
      }

    } catch (error) {
      result.endTime = performance.now();
      result.duration = result.endTime - result.startTime;

      if (error.message?.includes('timeout')) {
        result.status = 'timeout';
        result.error = `Test timeout after ${suite.timeout}ms`;
      } else {
        result.status = 'failed';
        result.error = error.message;
      }
    }

    return result;
  }

  private executeTest(command: string, args: string[], timeout: number): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Test timeout after ${timeout}ms`));
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve({
          stdout,
          stderr,
          exitCode: code || 0
        });
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  private logTestResult(result: TestResult): void {
    const duration = (result.duration / 1000).toFixed(2);
    const statusEmoji = {
      passed: '✅',
      failed: '❌',
      skipped: '⏭️',
      timeout: '⏰'
    }[result.status];

    console.log(`${statusEmoji} ${result.suiteName}: ${result.status.toUpperCase()} (${duration}s)`);

    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }

    if (result.metrics) {
      console.log(`   Metrics: Output saved to ${result.outputFile}`);
    }
  }

  private async generateReport(): Promise<TestReport> {
    const endTime = performance.now();
    const totalDuration = endTime - this.startTime;

    const summary = {
      totalSuites: this.results.length,
      passedSuites: this.results.filter(r => r.status === 'passed').length,
      failedSuites: this.results.filter(r => r.status === 'failed').length,
      skippedSuites: this.results.filter(r => r.status === 'skipped').length,
      totalDuration,
      startTime: this.startTime,
      endTime
    };

    const recommendations = this.generateRecommendations();

    return {
      summary,
      results: this.results,
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024) // MB
      },
      configuration: this.config,
      recommendations
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const failedTests = this.results.filter(r => r.status === 'failed');
    const timeoutTests = this.results.filter(r => r.status === 'timeout');

    if (failedTests.length > 0) {
      recommendations.push(`🔧 ${failedTests.length} tests failed - investigate and fix underlying issues`);
      recommendations.push('🔍 Review error logs and stderr output for specific failure causes');
    }

    if (timeoutTests.length > 0) {
      recommendations.push(`⏰ ${timeoutTests.length} tests timed out - consider increasing timeout values or optimizing system performance`);
    }

    const longRunningTests = this.results.filter(r => r.duration > 600000); // > 10 minutes
    if (longRunningTests.length > 0) {
      recommendations.push('⚡ Some tests took longer than expected - optimize test parameters or system performance');
    }

    if (this.results.length > 0) {
      const averageDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
      if (averageDuration > 300000) { // > 5 minutes average
        recommendations.push('📊 Consider running tests in parallel to reduce total execution time');
      }
    }

    // General recommendations
    recommendations.push('📋 Review individual test results for detailed performance insights');
    recommendations.push('🚀 Use results to establish performance baselines and SLA targets');
    recommendations.push('🔄 Run tests regularly to monitor performance regression');

    return recommendations;
  }

  private async prepareOutputDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.outputDirectory, { recursive: true });
      console.log(`📁 Output directory prepared: ${this.outputDirectory}`);
    } catch (error) {
      console.error('❌ Failed to create output directory:', error);
      throw error;
    }
  }

  private async saveReport(report: TestReport): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(this.outputDirectory, `test-report-${timestamp}.json`);
    const summaryFile = path.join(this.outputDirectory, 'latest-test-summary.json');

    try {
      // Save detailed report
      await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

      // Save summary for quick access
      await fs.writeFile(summaryFile, JSON.stringify({
        summary: report.summary,
        timestamp: new Date().toISOString(),
        recommendations: report.recommendations
      }, null, 2));

      console.log(`📄 Test report saved: ${reportFile}`);
      console.log(`📋 Test summary saved: ${summaryFile}`);

    } catch (error) {
      console.error('❌ Failed to save test report:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =================== CLI Interface ===================

if (require.main === module) {
  const args = process.argv.slice(2);
  const config: Partial<TestConfig> = {};
  let suiteFilter: string[] = [];

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];

    if (key === 'url') config.targetUrl = value;
    else if (key === 'websocket-url') config.websocketUrl = value;
    else if (key === 'token') config.authToken = value;
    else if (key === 'output') config.outputDirectory = value;
    else if (key === 'parallel') config.parallel = value === 'true';
    else if (key === 'concurrency') config.maxConcurrency = parseInt(value);
    else if (key === 'skip-on-failure') config.skipOnFailure = value === 'true';
    else if (key === 'suites') suiteFilter = value.split(',');
    else if (key === 'category') suiteFilter = [value];
  }

  async function runTests() {
    const runner = new ComprehensiveTestRunner(config);

    try {
      const report = await runner.runAllTests(suiteFilter.length > 0 ? suiteFilter : undefined);

      console.log('\n🎉 Test Execution Complete!');
      console.log('='.repeat(60));
      console.log(`Total Suites: ${report.summary.totalSuites}`);
      console.log(`Passed: ${report.summary.passedSuites}`);
      console.log(`Failed: ${report.summary.failedSuites}`);
      console.log(`Skipped: ${report.summary.skippedSuites}`);
      console.log(`Duration: ${(report.summary.totalDuration / 1000 / 60).toFixed(2)} minutes`);

      if (report.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        report.recommendations.forEach(rec => console.log(`- ${rec}`));
      }

      // Exit with failure code if any required tests failed
      const requiredTestsf Лайled = report.results.filter(r =>
        r.status === 'failed' &&
        TEST_SUITES.find(s => s.name === r.suiteName)?.required
      );

      if (requiredTestsFailed.length > 0) {
        console.error(`\n❌ ${requiredTestsFailed.length} required tests failed`);
        process.exit(1);
      }

    } catch (error) {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    }
  }

  runTests();
}

export { ComprehensiveTestRunner, TestConfig, TestReport };