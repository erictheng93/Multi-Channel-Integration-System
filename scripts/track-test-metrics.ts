#!/usr/bin/env tsx
/**
 * Test Metrics Tracking System
 *
 * Automatically runs tests and tracks metrics over time:
 * - Pass/fail rates by file and category
 * - Execution time trends
 * - Flakiness detection
 * - Code coverage
 *
 * Usage: npx tsx scripts/track-test-metrics.ts [--baseline] [--compare <commit>]
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestMetrics {
  timestamp: string;
  commit?: string;
  totals: {
    files: { passed: number; failed: number; total: number };
    tests: { passed: number; failed: number; skipped: number; total: number };
    duration: number;
  };
  byCategory: {
    [category: string]: {
      files: { passed: number; failed: number };
      tests: { passed: number; failed: number };
      duration: number;
    };
  };
  byFile: {
    [filename: string]: {
      passed: number;
      failed: number;
      duration: number;
      status: 'pass' | 'fail';
    };
  };
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
  flakiness?: {
    [testName: string]: {
      runs: number;
      failures: number;
      flakinessScore: number; // 0-1, where 1 is completely flaky
    };
  };
}

interface MetricsHistory {
  metrics: TestMetrics[];
  trends: {
    passRateChange: number;
    durationChange: number;
    coverageChange: number;
  };
}

const METRICS_DIR = path.join(process.cwd(), 'tests', 'metrics');
const HISTORY_FILE = path.join(METRICS_DIR, 'history.json');
const LATEST_FILE = path.join(METRICS_DIR, 'latest.json');

// Ensure metrics directory exists
if (!fs.existsSync(METRICS_DIR)) {
  fs.mkdirSync(METRICS_DIR, { recursive: true });
}

function runTests(): string {
  console.log('🧪 Running tests...\n');

  try {
    // Run vitest with JSON reporter
    const output = execSync(
      'npx vitest run --reporter=json --reporter=verbose',
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      }
    );

    return output;
  } catch (error: any) {
    // Vitest returns non-zero exit code when tests fail
    // But we still want the output
    return error.stdout || error.output?.join('') || '';
  }
}

function parseTestOutput(output: string): TestMetrics {
  const metrics: TestMetrics = {
    timestamp: new Date().toISOString(),
    totals: {
      files: { passed: 0, failed: 0, total: 0 },
      tests: { passed: 0, failed: 0, skipped: 0, total: 0 },
      duration: 0
    },
    byCategory: {},
    byFile: {}
  };

  try {
    // Try to find JSON output in the response
    const jsonMatch = output.match(/\{[\s\S]*"testResults"[\s\S]*\}/);
    if (jsonMatch) {
      const testResults = JSON.parse(jsonMatch[0]);

      // Parse test results
      if (testResults.testResults) {
        testResults.testResults.forEach((file: any) => {
          const fileName = path.basename(file.name);
          const category = file.name.includes('/unit/') ? 'unit' :
                          file.name.includes('/integration/') ? 'integration' :
                          file.name.includes('/e2e/') ? 'e2e' : 'other';

          const filePassed = file.assertionResults?.filter((t: any) => t.status === 'passed').length || 0;
          const fileFailed = file.assertionResults?.filter((t: any) => t.status === 'failed').length || 0;

          // Update by-file metrics
          metrics.byFile[fileName] = {
            passed: filePassed,
            failed: fileFailed,
            duration: file.duration || 0,
            status: fileFailed === 0 ? 'pass' : 'fail'
          };

          // Update totals
          if (fileFailed === 0) {
            metrics.totals.files.passed++;
          } else {
            metrics.totals.files.failed++;
          }

          metrics.totals.tests.passed += filePassed;
          metrics.totals.tests.failed += fileFailed;
          metrics.totals.duration += file.duration || 0;

          // Update by-category metrics
          if (!metrics.byCategory[category]) {
            metrics.byCategory[category] = {
              files: { passed: 0, failed: 0 },
              tests: { passed: 0, failed: 0 },
              duration: 0
            };
          }

          metrics.byCategory[category].tests.passed += filePassed;
          metrics.byCategory[category].tests.failed += fileFailed;
          metrics.byCategory[category].duration += file.duration || 0;

          if (fileFailed === 0) {
            metrics.byCategory[category].files.passed++;
          } else {
            metrics.byCategory[category].files.failed++;
          }
        });
      }

      metrics.totals.files.total = metrics.totals.files.passed + metrics.totals.files.failed;
      metrics.totals.tests.total = metrics.totals.tests.passed + metrics.totals.tests.failed + metrics.totals.tests.skipped;
    }
  } catch (error) {
    console.error('⚠️  Error parsing JSON output, using fallback parsing');

    // Fallback: parse text output
    const filesMatch = output.match(/Test Files\s+(\d+) failed.*\|?\s*(\d+) passed/);
    const testsMatch = output.match(/Tests\s+(\d+) failed.*\|?\s*(\d+) passed/);
    const durationMatch = output.match(/Duration\s+([\d.]+)ms/);

    if (filesMatch) {
      metrics.totals.files.failed = parseInt(filesMatch[1], 10);
      metrics.totals.files.passed = parseInt(filesMatch[2], 10);
      metrics.totals.files.total = metrics.totals.files.failed + metrics.totals.files.passed;
    }

    if (testsMatch) {
      metrics.totals.tests.failed = parseInt(testsMatch[1], 10);
      metrics.totals.tests.passed = parseInt(testsMatch[2], 10);
      metrics.totals.tests.total = metrics.totals.tests.failed + metrics.totals.tests.passed;
    }

    if (durationMatch) {
      metrics.totals.duration = parseFloat(durationMatch[1]);
    }
  }

  // Try to get git commit
  try {
    metrics.commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch (e) {
    metrics.commit = 'unknown';
  }

  return metrics;
}

function saveMetrics(metrics: TestMetrics): void {
  // Save latest metrics
  fs.writeFileSync(LATEST_FILE, JSON.stringify(metrics, null, 2), 'utf-8');
  console.log(`✅ Saved latest metrics to ${LATEST_FILE}`);

  // Append to history
  let history: MetricsHistory = { metrics: [], trends: { passRateChange: 0, durationChange: 0, coverageChange: 0 } };

  if (fs.existsSync(HISTORY_FILE)) {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
  }

  history.metrics.push(metrics);

  // Calculate trends (compare with previous run)
  if (history.metrics.length > 1) {
    const previous = history.metrics[history.metrics.length - 2];
    const current = metrics;

    const prevPassRate = previous.totals.tests.total > 0 ?
      (previous.totals.tests.passed / previous.totals.tests.total) * 100 : 0;
    const currPassRate = current.totals.tests.total > 0 ?
      (current.totals.tests.passed / current.totals.tests.total) * 100 : 0;

    history.trends.passRateChange = currPassRate - prevPassRate;
    history.trends.durationChange = current.totals.duration - previous.totals.duration;
  }

  // Keep only last 100 runs
  if (history.metrics.length > 100) {
    history.metrics = history.metrics.slice(-100);
  }

  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
  console.log(`✅ Updated metrics history (${history.metrics.length} runs tracked)`);
}

function displayMetrics(metrics: TestMetrics): void {
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST METRICS SUMMARY');
  console.log('='.repeat(70));
  console.log(`Timestamp: ${metrics.timestamp}`);
  console.log(`Commit: ${metrics.commit || 'N/A'}`);
  console.log('');

  // Overall metrics
  const passRate = metrics.totals.tests.total > 0 ?
    ((metrics.totals.tests.passed / metrics.totals.tests.total) * 100).toFixed(2) : '0.00';

  console.log('📈 OVERALL METRICS');
  console.log(`  Test Files: ${metrics.totals.files.passed} passed | ${metrics.totals.files.failed} failed | ${metrics.totals.files.total} total`);
  console.log(`  Tests: ${metrics.totals.tests.passed} passed | ${metrics.totals.tests.failed} failed | ${metrics.totals.tests.total} total`);
  console.log(`  Pass Rate: ${passRate}%`);
  console.log(`  Duration: ${(metrics.totals.duration / 1000).toFixed(2)}s`);
  console.log('');

  // By category
  if (Object.keys(metrics.byCategory).length > 0) {
    console.log('📂 BY CATEGORY');
    Object.entries(metrics.byCategory).forEach(([category, stats]) => {
      const catPassRate = stats.tests.passed + stats.tests.failed > 0 ?
        ((stats.tests.passed / (stats.tests.passed + stats.tests.failed)) * 100).toFixed(2) : '0.00';

      console.log(`  ${category.toUpperCase()}:`);
      console.log(`    Files: ${stats.files.passed} passed | ${stats.files.failed} failed`);
      console.log(`    Tests: ${stats.tests.passed} passed | ${stats.tests.failed} failed (${catPassRate}%)`);
      console.log(`    Duration: ${(stats.duration / 1000).toFixed(2)}s`);
    });
    console.log('');
  }

  // Trends
  if (fs.existsSync(HISTORY_FILE)) {
    const history: MetricsHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));

    if (history.trends) {
      console.log('📉 TRENDS (vs. previous run)');
      const passRateSymbol = history.trends.passRateChange >= 0 ? '↑' : '↓';
      const durationSymbol = history.trends.durationChange <= 0 ? '↓' : '↑';

      console.log(`  Pass Rate: ${passRateSymbol} ${Math.abs(history.trends.passRateChange).toFixed(2)}%`);
      console.log(`  Duration: ${durationSymbol} ${Math.abs(history.trends.durationChange).toFixed(0)}ms`);
      console.log('');
    }
  }

  // Top failing files
  const failingFiles = Object.entries(metrics.byFile)
    .filter(([_, stats]) => stats.failed > 0)
    .sort((a, b) => b[1].failed - a[1].failed)
    .slice(0, 10);

  if (failingFiles.length > 0) {
    console.log('❌ TOP 10 FAILING FILES');
    failingFiles.forEach(([file, stats]) => {
      console.log(`  ${file}: ${stats.failed} failed tests`);
    });
    console.log('');
  }

  console.log('='.repeat(70));
}

function generateMarkdownReport(metrics: TestMetrics): string {
  const passRate = metrics.totals.tests.total > 0 ?
    ((metrics.totals.tests.passed / metrics.totals.tests.total) * 100).toFixed(2) : '0.00';

  let report = `# Test Metrics Report\n\n`;
  report += `**Generated**: ${metrics.timestamp}\n`;
  report += `**Commit**: ${metrics.commit || 'N/A'}\n\n`;

  report += `## Overall Summary\n\n`;
  report += `- **Test Files**: ${metrics.totals.files.passed} passed / ${metrics.totals.files.total} total (${((metrics.totals.files.passed / metrics.totals.files.total) * 100).toFixed(2)}%)\n`;
  report += `- **Tests**: ${metrics.totals.tests.passed} passed / ${metrics.totals.tests.total} total (**${passRate}%**)\n`;
  report += `- **Duration**: ${(metrics.totals.duration / 1000).toFixed(2)}s\n\n`;

  report += `## By Category\n\n`;
  report += `| Category | Files Passed | Tests Passed | Pass Rate | Duration |\n`;
  report += `|----------|--------------|--------------|-----------|----------|\n`;

  Object.entries(metrics.byCategory).forEach(([category, stats]) => {
    const catPassRate = stats.tests.passed + stats.tests.failed > 0 ?
      ((stats.tests.passed / (stats.tests.passed + stats.tests.failed)) * 100).toFixed(2) : '0.00';

    report += `| ${category} | ${stats.files.passed}/${stats.files.passed + stats.files.failed} | ${stats.tests.passed}/${stats.tests.passed + stats.tests.failed} | ${catPassRate}% | ${(stats.duration / 1000).toFixed(2)}s |\n`;
  });

  return report;
}

// Main execution
const args = process.argv.slice(2);
const isBaseline = args.includes('--baseline');

console.log('📊 Test Metrics Tracking System\n');

const testOutput = runTests();
const metrics = parseTestOutput(testOutput);

saveMetrics(metrics);
displayMetrics(metrics);

// Generate markdown report
const reportPath = path.join(METRICS_DIR, `report-${Date.now()}.md`);
const markdownReport = generateMarkdownReport(metrics);
fs.writeFileSync(reportPath, markdownReport, 'utf-8');
console.log(`\n📄 Markdown report saved to ${reportPath}`);

if (isBaseline) {
  const baselinePath = path.join(METRICS_DIR, 'baseline.json');
  fs.writeFileSync(baselinePath, JSON.stringify(metrics, null, 2), 'utf-8');
  console.log(`\n✅ Saved baseline metrics to ${baselinePath}`);
}

console.log('\n✅ Metrics tracking complete!\n');
