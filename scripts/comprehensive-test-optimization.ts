/**
 * Comprehensive Test Optimization Script
 *
 * Goals:
 * 1. Migrate suitable tests to use MockFactory (targeting 50% usage)
 * 2. Fix common test failures
 * 3. Optimize test execution time
 * 4. Improve test reliability
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface OptimizationResult {
  file: string;
  optimizations: string[];
  errors: string[];
}

async function optimizeTestFile(filePath: string): Promise<OptimizationResult> {
  const result: OptimizationResult = {
    file: filePath,
    optimizations: [],
    errors: []
  };

  try {
    const content = await readFile(filePath, 'utf-8');
    let optimizedContent = content;
    let hasChanges = false;

    // Optimization 1: Add MockFactory import if using Bindings but not MockFactory
    if (content.includes('Bindings') && !content.includes('MockFactory')) {
      const hasManualEnvMock = /const\s+\w*[Ee]nv\w*\s*[:=]\s*\{[\s\S]*?DB\s*:/.test(content);

      if (hasManualEnvMock) {
        // Add import after existing imports
        const importMatch = content.match(/(import[\s\S]*?from\s+['"][^'"]+['"];\s*)+/);
        if (importMatch) {
          const lastImportEnd = importMatch[0].length;
          optimizedContent =
            content.slice(0, lastImportEnd) +
            `import { MockFactory } from '@helpers/mockFactory';\n` +
            content.slice(lastImportEnd);
          hasChanges = true;
          result.optimizations.push('Added MockFactory import');
        }
      }
    }

    // Optimization 2: Standardize beforeEach/afterEach
    if (content.includes('beforeEach') && !content.includes('vi.clearAllMocks()')) {
      optimizedContent = optimizedContent.replace(
        /beforeEach\((async\s+)?\(\)\s*=>\s*\{/,
        `beforeEach($1() => {\n vi.clearAllMocks();`
      );
      hasChanges = true;
      result.optimizations.push('Added vi.clearAllMocks() to beforeEach');
    }

    if (content.includes('beforeEach') && !content.includes('afterEach')) {
      // Find the describe block and add afterEach
      const describeMatch = content.match(/describe\(['"](.*?)['"],\s*\(\)\s*=>\s*\{/);
      if (describeMatch) {
        const beforeEachEnd = content.indexOf('});', content.indexOf('beforeEach'));
        if (beforeEachEnd > 0) {
          optimizedContent =
            content.slice(0, beforeEachEnd + 4) +
            `\n\n  afterEach(() => {\n vi.restoreAllMocks();\n  });` +
            content.slice(beforeEachEnd + 4);
          hasChanges = true;
          result.optimizations.push('Added afterEach with vi.restoreAllMocks()');
        }
      }
    }

    // Optimization 3: Fix common timeout issues
    if (content.includes('await') && !content.includes('testTimeout')) {
      // Add timeout configuration to vitest config comments
      const hasSlowTests = content.includes('database') || content.includes('integration');
      if (hasSlowTests) {
        result.optimizations.push('File may need timeout configuration (manual review)');
      }
    }

    // Optimization 4: Fix common mock patterns
    // Replace complex DB mocks with simpler patterns
    const complexDbMock = /const\s+mockDb\s*=\s*\{[\s\S]{200,}?\};/;
    if (complexDbMock.test(content) && !content.includes('MockFactory')) {
      result.optimizations.push('Complex DB mock detected - consider using MockFactory.createD1()');
    }

    // Optimization 5: Standardize test naming
    const testPatterns = [
      { old: /it\(/g, new: 'test(', name: 'Standardized test() over it()' },
      { old: /describe\.only\(/g, new: 'describe(', name: 'Removed .only from describe' },
      { old: /test\.only\(/g, new: 'test(', name: 'Removed .only from test' },
      { old: /it\.only\(/g, new: 'test(', name: 'Removed .only from it' }
    ];

    for (const pattern of testPatterns) {
      if (pattern.old.test(optimizedContent)) {
        optimizedContent = optimizedContent.replace(pattern.old, pattern.new);
        hasChanges = true;
        result.optimizations.push(pattern.name);
      }
    }

    // Write changes if any
    if (hasChanges) {
      await writeFile(filePath, optimizedContent, 'utf-8');
    }

  } catch (error) {
    result.errors.push(`Optimization failed: ${error}`);
  }

  return result;
}

async function findAllTestFiles(): Promise<string[]> {
  const files: string[] = [];

  async function scanDir(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!['node_modules', 'coverage', 'dist', '.archive'].includes(entry.name)) {
            await scanDir(fullPath);
          }
        } else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }

  await scanDir(join(process.cwd(), 'tests'));
  return files;
}

async function runOptimization(): Promise<void> {
  console.log(`\n Comprehensive Test Optimization\n${'='.repeat(60)}\n`);

  // Step 1: Find all test files
  console.log(' Scanning test files...\n');
  const testFiles = await findAllTestFiles();
  console.log(`Found ${testFiles.length} test files\n`);

  // Step 2: Optimize each file
  console.log(` Optimizing test files...\n`);
  const results: OptimizationResult[] = [];

  for (let i = 0; i < testFiles.length; i++) {
    const file = testFiles[i];
    const relativePath = file.replace(process.cwd() + '\\', '');

    process.stdout.write(`\r  Progress: ${i + 1}/${testFiles.length} - ${relativePath.slice(0, 50)}...`);

    const result = await optimizeTestFile(file);
    if (result.optimizations.length > 0 || result.errors.length > 0) {
      results.push(result);
    }
  }

  console.log(`\n\n Optimization complete!\n`);

  // Step 3: Summary
  const successfulOptimizations = results.filter(r => r.optimizations.length > 0);
  const failedOptimizations = results.filter(r => r.errors.length > 0);

  console.log(` Optimization Summary:\n`);
  console.log(` Files optimized: ${successfulOptimizations.length}`);
  console.log(` Files with errors: ${failedOptimizations.length}`);
  console.log(` Files skipped: ${testFiles.length - results.length}\n`);

  // Step 4: Detailed results
  if (successfulOptimizations.length > 0) {
    console.log(`\n Successfully Optimized Files:\n`);
    successfulOptimizations.slice(0, 20).forEach(r => {
      console.log(` ${r.file.replace(process.cwd(), '').slice(0, 60)}`);
      r.optimizations.forEach(opt => {
        console.log(` - ${opt}`);
      });
    });

    if (successfulOptimizations.length > 20) {
      console.log(`\n ... and ${successfulOptimizations.length - 20} more files\n`);
    }
  }

  if (failedOptimizations.length > 0) {
    console.log(`\n Files with Errors:\n`);
    failedOptimizations.forEach(r => {
      console.log(` ${r.file.replace(process.cwd(), '')}`);
      r.errors.forEach(err => {
        console.log(` - ${err}`);
      });
    });
  }

  // Step 5: Run tests to check improvements
  console.log(`\n\n Running test suite to measure improvements...\n`);

  try {
    const startTime = Date.now();
    const { stdout } = await execAsync('npx vitest run --reporter=json', {
      timeout: 300000 // 5 minutes
    });
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);

    try {
      const testResults = JSON.parse(stdout);
      const totalTests = testResults.numTotalTests || 0;
      const passedTests = testResults.numPassedTests || 0;
      const failedTests = testResults.numFailedTests || 0;
      const passRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0.0';

      console.log(`\n Test Results:\n`);
      console.log(` Total tests: ${totalTests}`);
      console.log(` Passed: ${passedTests}`);
      console.log(` Failed: ${failedTests}`);
      console.log(` Pass rate: ${passRate}%`);
      console.log(` Duration: ${duration}s\n`);

      // Check if we met our goals
      const passRateNum = parseFloat(passRate);
      if (passRateNum >= 92) {
        console.log(` GOAL MET: Pass rate >= 92%\n`);
      } else {
        console.log(` GOAL PENDING: Need ${(92 - passRateNum).toFixed(1)}% more to reach 92%\n`);
      }

    } catch (parseError) {
      console.log(` Could not parse test results\n`);
    }

  } catch (error) {
    console.log(` Test run failed or timed out\n`);
  }

  console.log(`\n Next Steps:\n`);
  console.log(` 1. Review optimized files and verify changes`);
  console.log(` 2. Run tests manually: npx vitest run`);
  console.log(` 3. Address remaining failures`);
  console.log(` 4. Continue MockFactory migration for suitable files\n`);
}

// Run optimization
runOptimization().catch(console.error);
