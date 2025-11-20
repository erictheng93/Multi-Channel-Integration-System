/**
 * Fix mockDB undefined references caused by MockFactory migration
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';

async function fixMockDBReferences(filePath: string): Promise<boolean> {
  let content = await readFile(filePath, 'utf-8');
  const original = content;

  // Check if file uses mockDB but doesn't declare it
  const usesMockDB = content.includes('mockDB') && content.includes('MockFactory');
  const declaresMockDB = /let\s+mockDB\s*:|const\s+mockDB\s*=/.test(content);

  if (usesMockDB && !declaresMockDB) {
    // Find the mockEnv declaration in beforeEach
    const beforeEachMatch = content.match(/beforeEach\((async\s+)?\(\)\s*=>\s*\{[\s\S]*?mockEnv\s*=\s*MockFactory\.createEnv/);

    if (beforeEachMatch) {
      // Add mockDB variable declaration before beforeEach
      const beforeEachIndex = content.indexOf('beforeEach');
      const insertPosition = content.lastIndexOf('\n', beforeEachIndex);

      if (insertPosition > 0) {
        content =
          content.slice(0, insertPosition + 1) +
          `  let mockDB: any; // Reference to mockEnv.DB\n` +
          content.slice(insertPosition + 1);

        // Add mockDB assignment in beforeEach
        const mockEnvAssignment = content.match(/(mockEnv\s*=\s*MockFactory\.createEnv\([^;]+\);)/);
        if (mockEnvAssignment) {
          const assignmentEnd = content.indexOf(mockEnvAssignment[0]) + mockEnvAssignment[0].length;
          content =
            content.slice(0, assignmentEnd) +
            `\n\n    // Reference mockDB for compatibility\n    mockDB = mockEnv.DB;` +
            content.slice(assignmentEnd);
        }

        return content !== original;
      }
    }
  }

  if (content !== original) {
    await writeFile(filePath, content, 'utf-8');
    return true;
  }

  return false;
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

async function main() {
  console.log('\n🔧 Fixing mockDB undefined references\n' + '='.repeat(60) + '\n');

  const files = await findTestFiles();
  let fixed = 0;

  for (const file of files) {
    const relativePath = file.replace(process.cwd(), '').slice(1);
    const wasFixed = await fixMockDBReferences(file);
    if (wasFixed) {
      fixed++;
      console.log(`✅ Fixed: ${relativePath}`);
    }
  }

  console.log(`\n📊 Results:\n`);
  console.log(`   Files processed: ${files.length}`);
  console.log(`   Files fixed: ${fixed}`);
  console.log(`\n✅ Fix complete!\n`);
}

main().catch(console.error);
