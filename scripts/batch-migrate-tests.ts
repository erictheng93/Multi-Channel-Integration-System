/**
 * Batch Test Migration Script
 * Automatically migrates test files to use MockFactory
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const BATCH_1_FILES = [
  'tests\\modules\\session\\unit\\handlers\\session-boundary.test.ts',
  'tests\\unit\\handlers\\delayed-message-main.test.ts',
  'tests\\unit\\handlers\\system-main.test.ts',
  'tests\\unit\\handlers\\auth-main.test.ts',
  'tests\\unit\\handlers\\conversation-edge-cases.test.ts',
  'tests\\unit\\handlers\\conversation.test.ts',
  'tests\\unit\\handlers\\delayed-message-drizzle.test.ts',
  'tests\\modules\\session\\unit\\services\\boundary-detection.test.ts',
  'tests\\unit\\services\\permission-edge-cases.test.ts',
  'tests\\modules\\session\\unit\\handlers\\session-main.test.ts',
];

interface MigrationResult {
  file: string;
  success: boolean;
  changes: string[];
  errors: string[];
}

async function migrateTestFile(filePath: string): Promise<MigrationResult> {
  const result: MigrationResult = {
    file: filePath,
    success: false,
    changes: [],
    errors: []
  };

  try {
    const fullPath = join(process.cwd(), filePath.replace(/\\/g, '/'));
    let content = await readFile(fullPath, 'utf-8');
    const originalContent = content;

    // 1. Add MockFactory import if not exists
    if (!content.includes('MockFactory')) {
      const importSection = content.match(/(import.*from.*['"];?\n)+/)?.[0] || '';
      const newImport = `import { MockFactory } from '@helpers/mockFactory';\n`;

      if (importSection) {
        content = content.replace(importSection, importSection + newImport);
        result.changes.push('Added MockFactory import');
      } else {
        // Add at the beginning
        content = newImport + content;
        result.changes.push('Added MockFactory import at beginning');
      }
    }

    // 2. Replace common manual mock patterns
    const replacements = [
      // Database mocks
      {
        pattern: /const\s+mockDb\s*=\s*\{[\s\S]*?select:[\s\S]*?\}/g,
        replacement: 'const mockDb = MockFactory.createDatabase([])',
        description: 'Replaced manual DB mock with MockFactory.createDatabase()'
      },
      // KV mocks
      {
        pattern: /const\s+mockKV\s*=\s*\{[\s\S]*?get:[\s\S]*?put:[\s\S]*?\}/g,
        replacement: 'const mockKV = MockFactory.createKV()',
        description: 'Replaced manual KV mock with MockFactory.createKV()'
      },
      // R2 mocks
      {
        pattern: /const\s+mockR2\s*=\s*\{[\s\S]*?get:[\s\S]*?put:[\s\S]*?\}/g,
        replacement: 'const mockR2 = MockFactory.createR2()',
        description: 'Replaced manual R2 mock with MockFactory.createR2()'
      },
      // Environment mocks - more careful replacement
      {
        pattern: /const\s+mockEnv\s*:\s*Bindings\s*=\s*\{[\s\S]*?DB:[\s\S]*?\}/g,
        replacement: 'const mockEnv = MockFactory.createEnv()',
        description: 'Replaced manual env mock with MockFactory.createEnv()'
      }
    ];

    for (const { pattern, replacement, description } of replacements) {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        result.changes.push(description);
      }
    }

    // 3. Simplify beforeEach setup
    const beforeEachPattern = /beforeEach\(\(\)\s*=>\s*\{[\s\S]*?vi\.clearAllMocks\(\);?[\s\S]*?\}\);?/g;
    if (beforeEachPattern.test(content)) {
      // Check if it has complex mock setup
      const match = content.match(beforeEachPattern);
      if (match && match[0].split('\n').length > 10) {
        result.changes.push('Complex beforeEach detected - manual review needed');
      }
    }

    // Only write if changes were made
    if (content !== originalContent) {
      await writeFile(fullPath, content, 'utf-8');
      result.success = true;
    } else {
      result.errors.push('No changes detected');
    }

  } catch (error) {
    result.errors.push(`Migration failed: ${error}`);
  }

  return result;
}

async function migrateBatch(batchNumber: number, files: string[]): Promise<void> {
  console.log(`\n🚀 Migrating Batch ${batchNumber} (${files.length} files)\n${'='.repeat(60)}\n`);

  const results: MigrationResult[] = [];

  for (const file of files) {
    console.log(`\n📝 Migrating: ${file}...`);
    const result = await migrateTestFile(file);
    results.push(result);

    if (result.success) {
      console.log(`   ✅ Success`);
      result.changes.forEach(change => {
        console.log(`      - ${change}`);
      });
    } else {
      console.log(`   ❌ Failed`);
      result.errors.forEach(error => {
        console.log(`      - ${error}`);
      });
    }
  }

  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n\n📊 Batch ${batchNumber} Summary:\n`);
  console.log(`   ✅ Successful: ${successful}/${files.length}`);
  console.log(`   ❌ Failed: ${failed}/${files.length}`);
  console.log(`   📈 Success rate: ${((successful / files.length) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log(`\n⚠️  Files needing manual review:\n`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.file}`);
      r.errors.forEach(err => console.log(`     ${err}`));
    });
  }
}

// Run migration
migrateBatch(1, BATCH_1_FILES).catch(console.error);
