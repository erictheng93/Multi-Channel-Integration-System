/**
 * Performance Baseline Establishment
 * Measures and records test execution times for future comparison
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

interface TestFilePerformance {
  file: string;
  duration: number;
  testCount: number;
  passed: number;
  failed: number;
  averageTestTime: number;
  status: 'slow' | 'medium' | 'fast';
}

interface PerformanceBaseline {
  timestamp: string;
  totalDuration: number;
  totalTests: number;
  totalFiles: number;
  files: TestFilePerformance[];
  slowFiles: TestFilePerformance[];
  recommendations: string[];
}

async function measureTestPerformance(): Promise<PerformanceBaseline> {
  console.log(' Running tests to establish performance baseline...\n');

  const startTime = Date.now();

  try {
    // Run tests with JSON reporter
    const { stdout, stderr } = await execAsync(
      'npx vitest run --reporter=json --reporter=basic',
      {
        timeout: 300000,
        maxBuffer: 20 * 1024 * 1024
      }
    );

    const endTime = Date.now();
    const totalDuration = (endTime - startTime) / 1000;

    // Parse JSON output
    let testResults: any = null;
    const lines = stdout.split('\n');

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.testResults) {
          testResults = parsed;
          break;
        }
      } catch (e) {
        // Not JSON, skip
      }
    }

    if (!testResults) {
      throw new Error('Could not parse test results');
    }

    // Process file-level performance
    const filePerformance: TestFilePerformance[] = [];

    if (testResults.testResults) {
      for (const fileResult of testResults.testResults) {
        const duration = (fileResult.endTime - fileResult.startTime) / 1000;
        const testCount = fileResult.assertionResults?.length || 0;
        const passed = fileResult.assertionResults?.filter((t: any) => t.status === 'passed').length || 0;
        const failed = fileResult.assertionResults?.filter((t: any) => t.status === 'failed').length || 0;

        let status: 'slow' | 'medium' | 'fast' = 'fast';
        if (duration > 5) status = 'slow';
        else if (duration > 2) status = 'medium';

        filePerformance.push({
          file: fileResult.name.replace(process.cwd(), '').replace(/\\/g, '/'),
          duration,
          testCount,
          passed,
          failed,
          averageTestTime: testCount > 0 ? duration / testCount : 0,
          status
        });
      }
    }

    // Sort by duration (slowest first)
    filePerformance.sort((a, b) => b.duration - a.duration);

    // Identify slow files (>2 seconds)
    const slowFiles = filePerformance.filter(f => f.status === 'slow' || f.status === 'medium');

    // Generate recommendations
    const recommendations: string[] = [];

    if (slowFiles.length > 0) {
      recommendations.push(`Found ${slowFiles.length} slow test files (>2s)`);
      recommendations.push('Consider optimizing these files with:');
      recommendations.push('  - Reduce mock complexity');
      recommendations.push('  - Use vi.useFakeTimers() for time-dependent tests');
      recommendations.push('  - Minimize file I/O operations');
      recommendations.push('  - Cache expensive computations');
    }

    const baseline: PerformanceBaseline = {
      timestamp: new Date().toISOString(),
      totalDuration,
      totalTests: testResults.numTotalTests || 0,
      totalFiles: filePerformance.length,
      files: filePerformance,
      slowFiles,
      recommendations
    };

    return baseline;

  } catch (error: any) {
    console.error('Error running tests:', error.message);

    // Return partial baseline
    return {
      timestamp: new Date().toISOString(),
      totalDuration: (Date.now() - startTime) / 1000,
      totalTests: 0,
      totalFiles: 0,
      files: [],
      slowFiles: [],
      recommendations: ['Tests failed to run - check test configuration']
    };
  }
}

async function saveBaseline(baseline: PerformanceBaseline): Promise<void> {
  const baselineDir = join(process.cwd(), 'performance-baselines');

  try {
    await mkdir(baselineDir, { recursive: true });
  } catch (e) {
    // Directory might already exist
  }

  const filename = `baseline-${new Date().toISOString().split('T')[0]}.json`;
  const filepath = join(baselineDir, filename);

  await writeFile(filepath, JSON.stringify(baseline, null, 2));
  console.log(`\n Baseline saved to: ${filepath}\n`);

  // Also save as 'latest'
  await writeFile(
    join(baselineDir, 'baseline-latest.json'),
    JSON.stringify(baseline, null, 2)
  );
}

async function generateReport(baseline: PerformanceBaseline): Promise<void> {
  let report = `#  Performance Baseline Report\n\n`;
  report += `**Date:** ${baseline.timestamp.split('T')[0]}\n`;
  report += `**Total Duration:** ${baseline.totalDuration.toFixed(2)}s\n`;
  report += `**Total Tests:** ${baseline.totalTests}\n`;
  report += `**Total Files:** ${baseline.totalFiles}\n\n`;

  report += `##  Summary Statistics\n\n`;
  report += `| Metric | Value |\n`;
  report += `|--------|-------|\n`;
  report += `| Total Duration | ${baseline.totalDuration.toFixed(2)}s |\n`;
  report += `| Total Tests | ${baseline.totalTests} |\n`;
  report += `| Test Files | ${baseline.totalFiles} |\n`;
  report += `| Average per File | ${(baseline.totalDuration / baseline.totalFiles).toFixed(2)}s |\n`;
  report += `| Average per Test | ${(baseline.totalDuration / baseline.totalTests).toFixed(3)}s |\n\n`;

  // Slow files
  if (baseline.slowFiles.length > 0) {
    report += `##  Slow Test Files (Top 20)\n\n`;
    report += `| File | Duration | Tests | Avg/Test | Status |\n`;
    report += `|------|----------|-------|----------|--------|\n`;

    baseline.slowFiles.slice(0, 20).forEach(file => {
      const statusEmoji = file.status === 'slow' ? '' : '';
      report += `| ${file.file.slice(0, 60)} | ${file.duration.toFixed(2)}s | ${file.testCount} | ${file.averageTestTime.toFixed(3)}s | ${statusEmoji} ${file.status} |\n`;
    });
    report += `\n`;
  }

  // Fast files
  const fastFiles = baseline.files.filter(f => f.status === 'fast').slice(0, 10);
  if (fastFiles.length > 0) {
    report += `##  Fastest Test Files (Top 10)\n\n`;
    report += `| File | Duration | Tests |\n`;
    report += `|------|----------|-------|\n`;

    fastFiles.forEach(file => {
      report += `| ${file.file.slice(0, 70)} | ${file.duration.toFixed(2)}s | ${file.testCount} |\n`;
    });
    report += `\n`;
  }

  // Distribution
  const slowCount = baseline.files.filter(f => f.status === 'slow').length;
  const mediumCount = baseline.files.filter(f => f.status === 'medium').length;
  const fastCount = baseline.files.filter(f => f.status === 'fast').length;

  report += `##  Performance Distribution\n\n`;
  report += `| Category | Count | Percentage |\n`;
  report += `|----------|-------|------------|\n`;
  report += `|  Slow (>5s) | ${slowCount} | ${((slowCount / baseline.totalFiles) * 100).toFixed(1)}% |\n`;
  report += `|  Medium (2-5s) | ${mediumCount} | ${((mediumCount / baseline.totalFiles) * 100).toFixed(1)}% |\n`;
  report += `|  Fast (<2s) | ${fastCount} | ${((fastCount / baseline.totalFiles) * 100).toFixed(1)}% |\n\n`;

  // Recommendations
  if (baseline.recommendations.length > 0) {
    report += `##  Recommendations\n\n`;
    baseline.recommendations.forEach(rec => {
      report += `- ${rec}\n`;
    });
    report += `\n`;
  }

  // Save report
  const reportPath = join(process.cwd(), 'docs', 'PERFORMANCE_BASELINE_REPORT.md');
  await writeFile(reportPath, report);
  console.log(` Report saved to: ${reportPath}\n`);
}

async function displayResults(baseline: PerformanceBaseline): Promise<void> {
  console.log(`\n Performance Baseline Results\n${'='.repeat(60)}\n`);

  console.log(`Total Duration: ${baseline.totalDuration.toFixed(2)}s`);
  console.log(`Total Tests: ${baseline.totalTests}`);
  console.log(`Test Files: ${baseline.totalFiles}`);
  console.log(`Average per File: ${(baseline.totalDuration / baseline.totalFiles).toFixed(2)}s`);
  console.log(`Average per Test: ${(baseline.totalDuration / baseline.totalTests).toFixed(3)}s\n`);

  if (baseline.slowFiles.length > 0) {
    console.log(` Slow Files (${baseline.slowFiles.length}):\n`);
    baseline.slowFiles.slice(0, 10).forEach((file, i) => {
      const statusEmoji = file.status === 'slow' ? '' : '';
      console.log(` ${i + 1}. ${statusEmoji} ${file.file.slice(0, 50)}`);
      console.log(` Duration: ${file.duration.toFixed(2)}s, Tests: ${file.testCount}, Avg: ${file.averageTestTime.toFixed(3)}s`);
    });
    console.log('');
  }

  const slowCount = baseline.files.filter(f => f.status === 'slow').length;
  const mediumCount = baseline.files.filter(f => f.status === 'medium').length;
  const fastCount = baseline.files.filter(f => f.status === 'fast').length;

  console.log(` Distribution:`);
  console.log(` Slow (>5s): ${slowCount} (${((slowCount / baseline.totalFiles) * 100).toFixed(1)}%)`);
  console.log(` Medium (2-5s): ${mediumCount} (${((mediumCount / baseline.totalFiles) * 100).toFixed(1)}%)`);
  console.log(` Fast (<2s): ${fastCount} (${((fastCount / baseline.totalFiles) * 100).toFixed(1)}%)\n`);
}

async function main() {
  console.log('\n Performance Baseline Establishment\n' + '='.repeat(60) + '\n');

  const baseline = await measureTestPerformance();

  await saveBaseline(baseline);
  await generateReport(baseline);
  await displayResults(baseline);

  console.log(' Performance baseline established!\n');
}

main().catch(console.error);
