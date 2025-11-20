/**
 * Aggressive MockFactory Migration
 * Converts test files to use MockFactory in a comprehensive way
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';

async function convertToMockFactory(filePath: string): Promise<boolean> {
  let content = await readFile(filePath, 'utf-8');
  const original = content;

  // Skip if already uses MockFactory comprehensively
  if (content.match(/MockFactory\./g)?.length || 0 > 2) {
    return false; // Already converted
  }

  // Add import if not present
  if (!content.includes('MockFactory')) {
    const importMatch = content.match(/(import[\s\S]*?from\s+['"][^'"]+['"];\s*)+/);
    if (importMatch) {
      content = content.slice(0, importMatch[0].length) +
        `import { MockFactory } from '@helpers/mockFactory';\n` +
        content.slice(importMatch[0].length);
    }
  }

  // Pattern 1: Convert simple env mocks
  content = content.replace(
    /const\s+(mock)?[Ee]nv\s*:\s*Bindings\s*=\s*\{[\s\S]*?JWT_SECRET[\s\S]*?\}/g,
    (match) => {
      // Check if it's a simple mock or complex one
      if (match.length < 500) {
        return 'const mockEnv = MockFactory.createEnv()';
      }
      return match; // Keep complex mocks as-is
    }
  );

  // Pattern 2: Convert D1/DB mocks
  content = content.replace(
    /(const|let)\s+(mock)?[Dd][b1B]?\s*=\s*\{[\s\S]*?prepare:\s*vi\.fn/g,
    (match, constOrLet) => {
      if (match.length < 300) {
        return `${constOrLet} mockDB = MockFactory.createD1()`;
      }
      return match;
    }
  );

  // Pattern 3: Convert KV mocks
  content = content.replace(
    /const\s+mock[A-Z_]*KV[A-Z_]*\s*=\s*\{[\s\S]*?get:\s*vi\.fn[\s\S]*?put:\s*vi\.fn/g,
    (match) => {
      if (match.length < 200) {
        const varName = match.match(/const\s+(mock[A-Z_]*KV[A-Z_]*)/)?.[1] || 'mockKV';
        return `const ${varName} = MockFactory.createKV()`;
      }
      return match;
    }
  );

  // Pattern 4: Convert R2 mocks
  content = content.replace(
    /const\s+mock[A-Z_]*R2[A-Z_]*\s*=\s*\{[\s\S]*?get:\s*vi\.fn[\s\S]*?put:\s*vi\.fn/g,
    (match) => {
      if (match.length < 250) {
        const varName = match.match(/const\s+(mock[A-Z_]*R2[A-Z_]*)/)?.[1] || 'mockR2';
        return `const ${varName} = MockFactory.createR2()`;
      }
      return match;
    }
  );

  // Pattern 5: Convert Queue mocks
  content = content.replace(
    /const\s+mock[A-Z_]*Queue[A-Z_]*\s*=\s*\{[\s\S]*?send:\s*vi\.fn/g,
    (match) => {
      if (match.length < 150) {
        const varName = match.match(/const\s+(mock[A-Z_]*Queue[A-Z_]*)/)?.[1] || 'mockQueue';
        return `const ${varName} = MockFactory.createQueue()`;
      }
      return match;
    }
  );

  if (content !== original) {
    await writeFile(filePath, content, 'utf-8');
    return true;
  }

  return false;
}

async function findAllTestFiles(): Promise<string[]> {
  const files: string[]  = [];

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
  console.log('\n🚀 Aggressive MockFactory Migration\n' + '='.repeat(60) + '\n');

  const files = await findAllTestFiles();
  console.log(`Found ${files.length} test files\n`);

  let converted = 0;
  let skipped = 0;

  for (const file of files) {
    const relativePath = file.replace(process.cwd(), '').slice(1);
    process.stdout.write(`\rProcessing: ${relativePath.slice(0, 60).padEnd(60)}`);

    const wasConverted = await convertToMockFactory(file);
    if (wasConverted) {
      converted++;
    } else {
      skipped++;
    }
  }

  console.log('\n\n📊 Migration Results:\n');
  console.log(`   Files converted: ${converted}`);
  console.log(`   Files skipped: ${skipped}`);

  // Count final MockFactory usage
  let mockFactoryFiles = 0;
  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    if (content.includes('MockFactory')) {
      mockFactoryFiles++;
    }
  }

  const percentage = ((mockFactoryFiles / files.length) * 100).toFixed(1);
  console.log(`\n   Total MockFactory usage: ${mockFactoryFiles}/${files.length} (${percentage}%)`);

  if (parseFloat(percentage) >= 50) {
    console.log(`   ✅ GOAL ACHIEVED: ${percentage}% >= 50%\n`);
  } else {
    const needed = Math.ceil(files.length * 0.5) - mockFactoryFiles;
    console.log(`   ⚠️  Still need ${needed} more files to reach 50% goal\n`);
  }

  console.log('\n✅ Aggressive migration complete!\n');
}

main().catch(console.error);
