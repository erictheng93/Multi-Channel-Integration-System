/**
 * Code Coverage Analysis
 * Analyzes test coverage and identifies areas needing more tests
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

interface CoverageData {
  timestamp: string;
  overall: {
    lines: number;
    statements: number;
    functions: number;
    branches: number;
  };
  uncoveredFiles: Array<{
    file: string;
    lines: number;
    statements: number;
    functions: number;
    branches: number;
  }>;
  recommendations: string[];
}

async function runCoverageAnalysis(): Promise<CoverageData> {
  console.log('📊 Running coverage analysis...\n');

  try {
    const { stdout, stderr } = await execAsync(
      'npx vitest run --coverage --reporter=json',
      {
        timeout: 300000,
        maxBuffer: 20 * 1024 * 1024
      }
    );

    // Try to parse coverage data from coverage/coverage-summary.json
    let coverageSummary: any = null;
    try {
      const summaryPath = join(process.cwd(), 'coverage', 'coverage-summary.json');
      const summaryContent = await readFile(summaryPath, 'utf-8');
      coverageSummary = JSON.parse(summaryContent);
    } catch (e) {
      console.log('⚠️  Could not read coverage summary, using defaults\n');
    }

    const recommendations: string[] = [];
    const uncoveredFiles: any[] = [];

    if (coverageSummary && coverageSummary.total) {
      const total = coverageSummary.total;

      // Analyze overall coverage
      if (total.lines.pct < 80) {
        recommendations.push(`Line coverage is ${total.lines.pct.toFixed(1)}% - aim for 80%+`);
      }
      if (total.branches.pct < 70) {
        recommendations.push(`Branch coverage is ${total.branches.pct.toFixed(1)}% - aim for 70%+`);
      }
      if (total.functions.pct < 80) {
        recommendations.push(`Function coverage is ${total.functions.pct.toFixed(1)}% - aim for 80%+`);
      }

      // Find files with low coverage
      for (const [file, data] of Object.entries(coverageSummary)) {
        if (file === 'total') continue;

        const fileData = data as any;
        if (fileData.lines && fileData.lines.pct < 50) {
          uncoveredFiles.push({
            file: file.replace(process.cwd(), ''),
            lines: fileData.lines.pct,
            statements: fileData.statements.pct,
            functions: fileData.functions.pct,
            branches: fileData.branches.pct
          });
        }
      }

      uncoveredFiles.sort((a, b) => a.lines - b.lines);

      return {
        timestamp: new Date().toISOString(),
        overall: {
          lines: total.lines.pct,
          statements: total.statements.pct,
          functions: total.functions.pct,
          branches: total.branches.pct
        },
        uncoveredFiles: uncoveredFiles.slice(0, 20),
        recommendations
      };
    }

    // Fallback if coverage summary not available
    return {
      timestamp: new Date().toISOString(),
      overall: {
        lines: 0,
        statements: 0,
        functions: 0,
        branches: 0
      },
      uncoveredFiles: [],
      recommendations: ['Coverage data not available - ensure vitest coverage is configured']
    };

  } catch (error: any) {
    console.error('Error running coverage:', error.message);

    return {
      timestamp: new Date().toISOString(),
      overall: {
        lines: 0,
        statements: 0,
        functions: 0,
        branches: 0
      },
      uncoveredFiles: [],
      recommendations: ['Coverage analysis failed - check configuration']
    };
  }
}

async function generateCoverageReport(data: CoverageData): Promise<void> {
  let report = `# 📊 Code Coverage Analysis\n\n`;
  report += `**Date:** ${data.timestamp.split('T')[0]}\n\n`;

  report += `## Overall Coverage\n\n`;
  report += `| Metric | Coverage | Status |\n`;
  report += `|--------|----------|--------|\n`;
  report += `| Lines | ${data.overall.lines.toFixed(1)}% | ${data.overall.lines >= 80 ? '✅' : '⚠️'} |\n`;
  report += `| Statements | ${data.overall.statements.toFixed(1)}% | ${data.overall.statements >= 80 ? '✅' : '⚠️'} |\n`;
  report += `| Functions | ${data.overall.functions.toFixed(1)}% | ${data.overall.functions >= 80 ? '✅' : '⚠️'} |\n`;
  report += `| Branches | ${data.overall.branches.toFixed(1)}% | ${data.overall.branches >= 70 ? '✅' : '⚠️'} |\n\n`;

  if (data.uncoveredFiles.length > 0) {
    report += `## Files Needing More Tests\n\n`;
    report += `| File | Lines | Functions | Branches |\n`;
    report += `|------|-------|-----------|----------|\n`;

    data.uncoveredFiles.forEach(file => {
      report += `| ${file.file.slice(0, 60)} | ${file.lines.toFixed(1)}% | ${file.functions.toFixed(1)}% | ${file.branches.toFixed(1)}% |\n`;
    });
    report += `\n`;
  }

  if (data.recommendations.length > 0) {
    report += `## Recommendations\n\n`;
    data.recommendations.forEach(rec => {
      report += `- ${rec}\n`;
    });
    report += `\n`;
  }

  report += `## Next Steps\n\n`;
  report += `1. Focus on files with <50% coverage\n`;
  report += `2. Add tests for uncovered branches\n`;
  report += `3. Test edge cases and error handling\n`;
  report += `4. Aim for 80%+ overall coverage\n`;

  const reportPath = join(process.cwd(), 'docs', 'COVERAGE_ANALYSIS_REPORT.md');
  await writeFile(reportPath, report);
  console.log(`\n📄 Coverage report saved to: ${reportPath}\n`);
}

async function main() {
  console.log('\n📊 Code Coverage Analysis\n' + '='.repeat(60) + '\n');

  const data = await runCoverageAnalysis();
  await generateCoverageReport(data);

  console.log(`\n📈 Coverage Summary:\n`);
  console.log(`   Lines: ${data.overall.lines.toFixed(1)}%`);
  console.log(`   Statements: ${data.overall.statements.toFixed(1)}%`);
  console.log(`   Functions: ${data.overall.functions.toFixed(1)}%`);
  console.log(`   Branches: ${data.overall.branches.toFixed(1)}%\n`);

  if (data.uncoveredFiles.length > 0) {
    console.log(`   Files needing tests: ${data.uncoveredFiles.length}\n`);
  }

  console.log('✅ Coverage analysis complete!\n');
}

main().catch(console.error);
