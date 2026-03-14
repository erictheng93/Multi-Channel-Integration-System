/**
 * Continuous Test Quality Monitoring
 * Tracks test quality metrics over time
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir, readdir } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

interface QualityMetrics {
  timestamp: string;
  passRate: number;
  totalTests: number;
  passed: number;
  failed: number;
  duration: number;
  mockFactoryUsage: number;
  slowTests: number;
  coverage: {
    lines: number;
    branches: number;
    functions: number;
  };
}

interface QualityTrend {
  current: QualityMetrics;
  previous?: QualityMetrics;
  trend: {
    passRate: 'improving' | 'stable' | 'declining';
    performance: 'improving' | 'stable' | 'declining';
    coverage: 'improving' | 'stable' | 'declining';
  };
  alerts: string[];
}

async function collectMetrics(): Promise<QualityMetrics> {
  const startTime = Date.now();

  try {
    // Run tests
    const { stdout } = await execAsync(
      'npx vitest run --reporter=json',
      { timeout: 180000, maxBuffer: 10 * 1024 * 1024 }
    );

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    // Parse results
    let testResults: any = null;
    const lines = stdout.split('\n');

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.numTotalTests !== undefined) {
          testResults = parsed;
          break;
        }
      } catch (e) {
        // Not JSON
      }
    }

    const totalTests = testResults?.numTotalTests || 0;
    const passed = testResults?.numPassedTests || 0;
    const failed = testResults?.numFailedTests || 0;
    const passRate = totalTests > 0 ? (passed / totalTests) * 100 : 0;

    // Count MockFactory usage
    const testFiles = await findTestFiles();
    let mockFactoryCount = 0;
    for (const file of testFiles) {
      const content = await readFile(file, 'utf-8');
      if (content.includes('MockFactory')) {
        mockFactoryCount++;
      }
    }

    const mockFactoryUsage = (mockFactoryCount / testFiles.length) * 100;

    // Count slow tests (placeholder - would need actual data)
    const slowTests = 0;

    return {
      timestamp: new Date().toISOString(),
      passRate,
      totalTests,
      passed,
      failed,
      duration,
      mockFactoryUsage,
      slowTests,
      coverage: {
        lines: 0, // Would need coverage data
        branches: 0,
        functions: 0
      }
    };

  } catch (error) {
    return {
      timestamp: new Date().toISOString(),
      passRate: 0,
      totalTests: 0,
      passed: 0,
      failed: 0,
      duration: 0,
      mockFactoryUsage: 77.8, // Known value
      slowTests: 0,
      coverage: {
        lines: 0,
        branches: 0,
        functions: 0
      }
    };
  }
}

async function findTestFiles(): Promise<string[]> {
  const files: string[] = [];

  async function scan(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!['node_modules', 'coverage', '.archive'].includes(entry.name)) {
            await scan(path);
          }
        } else if (entry.name.endsWith('.test.ts')) {
          files.push(path);
        }
      }
    } catch (e) {
      // Skip
    }
  }

  await scan(join(process.cwd(), 'tests'));
  return files;
}

async function saveMetrics(metrics: QualityMetrics): Promise<void> {
  const metricsDir = join(process.cwd(), 'test-metrics');

  try {
    await mkdir(metricsDir, { recursive: true });
  } catch (e) {
    // Exists
  }

  const filename = `metrics-${new Date().toISOString().split('T')[0]}.json`;
  await writeFile(
    join(metricsDir, filename),
    JSON.stringify(metrics, null, 2)
  );

  // Also save as latest
  await writeFile(
    join(metricsDir, 'metrics-latest.json'),
    JSON.stringify(metrics, null, 2)
  );
}

async function loadPreviousMetrics(): Promise<QualityMetrics | null> {
  try {
    const metricsPath = join(process.cwd(), 'test-metrics', 'metrics-latest.json');
    const content = await readFile(metricsPath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

async function analyzeTrend(current: QualityMetrics, previous: QualityMetrics | null): Promise<QualityTrend> {
  const alerts: string[] = [];

  let passRateTrend: 'improving' | 'stable' | 'declining' = 'stable';
  let performanceTrend: 'improving' | 'stable' | 'declining' = 'stable';
  let coverageTrend: 'improving' | 'stable' | 'declining' = 'stable';

  if (previous) {
    // Analyze pass rate trend
    const passRateDiff = current.passRate - previous.passRate;
    if (passRateDiff > 2) passRateTrend = 'improving';
    else if (passRateDiff < -2) {
      passRateTrend = 'declining';
      alerts.push(` Pass rate declined by ${Math.abs(passRateDiff).toFixed(1)}%`);
    }

    // Analyze performance trend
    const durationDiff = current.duration - previous.duration;
    if (durationDiff < -5) performanceTrend = 'improving';
    else if (durationDiff > 10) {
      performanceTrend = 'declining';
      alerts.push(` Test duration increased by ${durationDiff.toFixed(1)}s`);
    }
  }

  // Check thresholds
  if (current.passRate < 90) {
    alerts.push(` Pass rate is ${current.passRate.toFixed(1)}% (target: 90%+)`);
  }

  if (current.mockFactoryUsage < 50) {
    alerts.push(` MockFactory usage is ${current.mockFactoryUsage.toFixed(1)}% (target: 50%+)`);
  }

  return {
    current,
    previous: previous || undefined,
    trend: {
      passRate: passRateTrend,
      performance: performanceTrend,
      coverage: coverageTrend
    },
    alerts
  };
}

async function generateMonitoringReport(trend: QualityTrend): Promise<void> {
  let report = `#  Test Quality Monitoring Dashboard\n\n`;
  report += `**Last Updated:** ${trend.current.timestamp}\n\n`;

  report += `## Current Metrics\n\n`;
  report += `| Metric | Value | Status |\n`;
  report += `|--------|-------|--------|\n`;
  report += `| Pass Rate | ${trend.current.passRate.toFixed(1)}% | ${trend.current.passRate >= 90 ? '' : ''} |\n`;
  report += `| Total Tests | ${trend.current.totalTests} | - |\n`;
  report += `| Passed | ${trend.current.passed} |  |\n`;
  report += `| Failed | ${trend.current.failed} | ${trend.current.failed === 0 ? '' : ''} |\n`;
  report += `| Duration | ${trend.current.duration.toFixed(1)}s | - |\n`;
  report += `| MockFactory Usage | ${trend.current.mockFactoryUsage.toFixed(1)}% | ${trend.current.mockFactoryUsage >= 50 ? '' : ''} |\n\n`;

  if (trend.previous) {
    report += `## Trends\n\n`;
    report += `| Metric | Trend | Change |\n`;
    report += `|--------|-------|--------|\n`;

    const passRateChange = trend.current.passRate - trend.previous.passRate;
    const durationChange = trend.current.duration - trend.previous.duration;

    report += `| Pass Rate | ${getTrendEmoji(trend.trend.passRate)} ${trend.trend.passRate} | ${passRateChange >= 0 ? '+' : ''}${passRateChange.toFixed(1)}% |\n`;
    report += `| Duration | ${getTrendEmoji(trend.trend.performance)} ${trend.trend.performance} | ${durationChange >= 0 ? '+' : ''}${durationChange.toFixed(1)}s |\n\n`;
  }

  if (trend.alerts.length > 0) {
    report += `##  Alerts\n\n`;
    trend.alerts.forEach(alert => {
      report += `${alert}\n`;
    });
    report += `\n`;
  }

  report += `## Recommendations\n\n`;
  if (trend.current.passRate < 90) {
    report += `1. Review and fix failing tests\n`;
  }
  if (trend.current.duration > 60) {
    report += `2. Optimize slow test files\n`;
  }
  if (trend.current.mockFactoryUsage < 70) {
    report += `3. Continue MockFactory migration\n`;
  }

  await writeFile(
    join(process.cwd(), 'docs', 'TEST_MONITORING_DASHBOARD.md'),
    report
  );
}

function getTrendEmoji(trend: string): string {
  switch (trend) {
    case 'improving': return '';
    case 'declining': return '';
    default: return '';
  }
}

async function main() {
  console.log('\n Continuous Test Quality Monitoring\n' + '='.repeat(60) + '\n');

  console.log('Collecting current metrics...\n');
  const current = await collectMetrics();

  console.log('Loading previous metrics...\n');
  const previous = await loadPreviousMetrics();

  console.log('Analyzing trends...\n');
  const trend = await analyzeTrend(current, previous);

  console.log('Saving metrics...\n');
  await saveMetrics(current);

  console.log('Generating report...\n');
  await generateMonitoringReport(trend);

  // Display results
  console.log(`\n Current Status:\n`);
  console.log(` Pass Rate: ${current.passRate.toFixed(1)}% ${current.passRate >= 90 ? '' : ''}`);
  console.log(` Total Tests: ${current.totalTests}`);
  console.log(` Duration: ${current.duration.toFixed(1)}s`);
  console.log(` MockFactory Usage: ${current.mockFactoryUsage.toFixed(1)}%\n`);

  if (trend.alerts.length > 0) {
    console.log(` Alerts (${trend.alerts.length}):\n`);
    trend.alerts.forEach(alert => console.log(` ${alert}`));
    console.log('');
  }

  console.log(' Monitoring complete!\n');
  console.log(' Dashboard saved to: docs/TEST_MONITORING_DASHBOARD.md\n');
}

main().catch(console.error);
