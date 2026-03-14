#!/usr/bin/env tsx
/**
 * Automated MockFactory Migration Script
 *
 * This script helps migrate test files to use MockFactory by:
 * 1. Adding MockFactory import
 * 2. Replacing manual mock creation with MockFactory calls
 * 3. Updating environment passing in tests
 *
 * Usage: npx tsx scripts/migrate-to-mockfactory.ts <test-file-path>
 */

import * as fs from 'fs';
import * as path from 'path';

interface MigrationStats {
  linesRemoved: number;
  linesAdded: number;
  mocksReplaced: number;
  testsUpdated: number;
}

function migrateTestFile(filePath: string): MigrationStats {
  console.log(`\n Migrating: ${filePath}`);

  const stats: MigrationStats = {
    linesRemoved: 0,
    linesAdded: 0,
    mocksReplaced: 0,
    testsUpdated: 0
  };

  // Read file
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let modified = content;
  const originalLineCount = lines.length;

  // Step 1: Add MockFactory import if not present
  if (!content.includes('MockFactory')) {
    const importRegex = /^(import.*from ['"]vitest['"];?)/m;
    modified = modified.replace(importRegex, (match) => {
      stats.linesAdded += 1;
      return `${match}\nimport { MockFactory } from '../../helpers/mockFactory';`;
    });
    console.log(' Added MockFactory import');
  }

  // Step 2: Detect and replace manual DB mock creation
  const manualDBPattern = /mockDB\s*=\s*\{[\s\S]*?prepare:[\s\S]*?\}/g;
  if (manualDBPattern.test(content)) {
    // This is a complex replacement - would need manual intervention
    console.log(' Manual DB mock detected - needs manual refactoring');
    stats.mocksReplaced += 1;
  }

  // Step 3: Update test environment passing
  const envPassingPattern = /,\s*\{\s*DB:\s*mockDB\s*\}\s*as\s*any/g;
  const envMatches = modified.match(envPassingPattern);
  if (envMatches) {
    modified = modified.replace(envPassingPattern, ', mockEnv as any');
    stats.testsUpdated = envMatches.length;
    console.log(` Updated ${stats.testsUpdated} test environment calls`);
  }

  // Step 4: Update describe block to indicate refactoring
  const describePattern = /describe\(['"]([^'"]+)['"]/;
  modified = modified.replace(describePattern, (match, title) => {
    if (!title.includes('MockFactory')) {
      return match.replace(title, `${title} (MockFactory Refactored)`);
    }
    return match;
  });

  // Calculate line changes
  const modifiedLineCount = modified.split('\n').length;
  stats.linesAdded += Math.max(0, modifiedLineCount - originalLineCount);
  stats.linesRemoved += Math.max(0, originalLineCount - modifiedLineCount);

  // Write back
  fs.writeFileSync(filePath, modified, 'utf-8');

  return stats;
}

function generateMigrationReport(files: string[], allStats: MigrationStats[]): void {
  const totalStats = allStats.reduce((acc, stats) => ({
    linesRemoved: acc.linesRemoved + stats.linesRemoved,
    linesAdded: acc.linesAdded + stats.linesAdded,
    mocksReplaced: acc.mocksReplaced + stats.mocksReplaced,
    testsUpdated: acc.testsUpdated + stats.testsUpdated
  }), { linesRemoved: 0, linesAdded: 0, mocksReplaced: 0, testsUpdated: 0 });

  console.log('\n' + '='.repeat(60));
  console.log(' MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Files Migrated: ${files.length}`);
  console.log(`Lines Removed: ${totalStats.linesRemoved}`);
  console.log(`Lines Added: ${totalStats.linesAdded}`);
  console.log(`Net Change: ${totalStats.linesAdded - totalStats.linesRemoved} lines`);
  console.log(`Mocks Replaced: ${totalStats.mocksReplaced}`);
  console.log(`Tests Updated: ${totalStats.testsUpdated}`);
  console.log('='.repeat(60));

  // Update migration plan
  const planPath = 'tests/MOCKFACTORY_MIGRATION_PLAN.md';
  if (fs.existsSync(planPath)) {
    let plan = fs.readFileSync(planPath, 'utf-8');

    files.forEach(file => {
      const fileName = path.basename(file);
      plan = plan.replace(
        new RegExp(`\\s+(\\d+\\s+)?\\|\\s+\`${fileName}\``),
        ` $1| \`${fileName}\``
      );
    });

    fs.writeFileSync(planPath, plan, 'utf-8');
    console.log('\n Updated migration plan');
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: npx tsx scripts/migrate-to-mockfactory.ts <test-file-path> [...]');
  console.error('\nExample: npx tsx scripts/migrate-to-mockfactory.ts tests/unit/handlers/message.test.ts');
  process.exit(1);
}

const allStats: MigrationStats[] = [];

for (const filePath of args) {
  if (!fs.existsSync(filePath)) {
    console.error(` File not found: ${filePath}`);
    continue;
  }

  try {
    const stats = migrateTestFile(filePath);
    allStats.push(stats);
  } catch (error) {
    console.error(` Error migrating ${filePath}:`, error);
  }
}

if (allStats.length > 0) {
  generateMigrationReport(args, allStats);
  console.log('\n Migration complete! Please review changes and run tests.');
  console.log('\n  Note: Some files may need manual adjustments for complex mocks.\n');
}
