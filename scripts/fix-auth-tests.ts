/**
 * Fix Authentication Test Failures
 * Analyzes and fixes 401 authentication errors in tests
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface AuthIssue {
  file: string;
  line: number;
  issue: string;
  suggestion: string;
}

async function analyzeAuthIssues(filePath: string): Promise<AuthIssue[]> {
  const content = await readFile(filePath, 'utf-8');
  const issues: AuthIssue[] = [];
  const lines = content.split('\n');

  // Check for missing jwtAuth mock
  const hasJwtAuth = content.includes('jwtAuth');
  const hasJwtPayload = content.includes('jwtPayload');
  const hasSetUser = content.includes("c.set('user'");

  if (!hasJwtAuth && !hasJwtPayload && !hasSetUser) {
    issues.push({
      file: filePath,
      line: 0,
      issue: 'Missing authentication mock',
      suggestion: 'Add jwtAuth middleware mock or set jwtPayload in context'
    });
  }

  // Check for incorrect jwt payload structure
  lines.forEach((line, index) => {
    if (line.includes('jwtPayload') && !line.includes('userId')) {
      issues.push({
        file: filePath,
        line: index + 1,
        issue: 'Incomplete jwtPayload',
        suggestion: 'Ensure jwtPayload includes userId, role, and teamId'
      });
    }

    // Check for missing role in payload
    if (line.includes('jwtPayload') && !line.includes('role')) {
      issues.push({
        file: filePath,
        line: index + 1,
        issue: 'Missing role in jwtPayload',
        suggestion: "Add role: 'admin' or role: 'agent' to jwtPayload"
      });
    }
  });

  return issues;
}

async function fixAuthTest(filePath: string): Promise<boolean> {
  let content = await readFile(filePath, 'utf-8');
  const original = content;
  let fixed = false;

  // Fix 1: Ensure jwtAuth mock exists
  if (!content.includes('jwtAuth') && content.includes('app.request')) {
    // Add jwtAuth mock before describe block
    const describeMatch = content.match(/describe\(/);
    if (describeMatch) {
      const insertPos = content.indexOf(describeMatch[0]);
      const beforeInsert = content.slice(0, insertPos);
      const afterInsert = content.slice(insertPos);

      content = beforeInsert +
        `// Mock JWT authentication\n` +
        `vi.mock('@/middleware/auth', () => ({\n` +
        `  jwtAuth: vi.fn((c, next) => {\n` +
        ` c.set('jwtPayload', {\n` +
        ` userId: 1,\n` +
        ` username: 'test-user',\n` +
        ` role: 'admin',\n` +
        ` teamId: 1\n` +
        ` });\n` +
        ` return next();\n` +
        `  })\n` +
        `}));\n\n` +
        afterInsert;
      fixed = true;
    }
  }

  // Fix 2: Add headers with auth token if missing
  const requestPattern = /app\.request\([^,]+,\s*\{[^}]*method:\s*['"](?:POST|PUT|DELETE)['"]/g;
  let match;
  const matches: string[] = [];

  while ((match = requestPattern.exec(content)) !== null) {
    matches.push(match[0]);
  }

  for (const matchStr of matches) {
    if (!matchStr.includes('headers') && !matchStr.includes('Authorization')) {
      const newRequest = matchStr.replace(
        /method:\s*['"](POST|PUT|DELETE)['"]/,
        `method: '$1',\n headers: { 'Authorization': 'Bearer test-token' }`
      );
      content = content.replace(matchStr, newRequest);
      fixed = true;
    }
  }

  if (fixed && content !== original) {
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
  console.log('\n Fixing Authentication Test Failures\n' + '='.repeat(60) + '\n');

  const files = await findTestFiles();
  const issues: AuthIssue[] = [];
  let fixedCount = 0;

  console.log('Analyzing test files for auth issues...\n');

  for (const file of files) {
    const fileIssues = await analyzeAuthIssues(file);
    issues.push(...fileIssues);

    if (fileIssues.length > 0) {
      const wasFixed = await fixAuthTest(file);
      if (wasFixed) {
        fixedCount++;
        console.log(` Fixed: ${file.replace(process.cwd(), '').slice(1)}`);
      }
    }
  }

  console.log(`\n Results:\n`);
  console.log(` Files analyzed: ${files.length}`);
  console.log(` Auth issues found: ${issues.length}`);
  console.log(` Files fixed: ${fixedCount}\n`);

  if (issues.length > 0) {
    console.log(`\n  Remaining Issues:\n`);
    issues.slice(0, 10).forEach(issue => {
      console.log(` File: ${issue.file.replace(process.cwd(), '').slice(1)}`);
      console.log(` Issue: ${issue.issue}`);
      console.log(` Suggestion: ${issue.suggestion}\n`);
    });
  }

  // Generate report
  let report = `#  Authentication Test Fix Report\n\n`;
  report += `**Date:** ${new Date().toISOString().split('T')[0]}\n\n`;
  report += `## Summary\n\n`;
  report += `- Files analyzed: ${files.length}\n`;
  report += `- Auth issues found: ${issues.length}\n`;
  report += `- Files fixed: ${fixedCount}\n\n`;

  if (issues.length > 0) {
    report += `## Common Issues\n\n`;
    report += `1. Missing jwtAuth middleware mock\n`;
    report += `2. Incomplete jwtPayload structure\n`;
    report += `3. Missing Authorization headers\n`;
    report += `4. Incorrect role/permissions in payload\n\n`;

    report += `## Recommended Fixes\n\n`;
    report += `\`\`\`typescript\n`;
    report += `// Add this mock before your tests:\n`;
    report += `vi.mock('@/middleware/auth', () => ({\n`;
    report += `  jwtAuth: vi.fn((c, next) => {\n`;
    report += ` c.set('jwtPayload', {\n`;
    report += ` userId: 1,\n`;
    report += ` username: 'test-user',\n`;
    report += ` role: 'admin', // or 'agent'\n`;
    report += ` teamId: 1\n`;
    report += ` });\n`;
    report += ` return next();\n`;
    report += `  })\n`;
    report += `}));\n`;
    report += `\`\`\`\n\n`;
  }

  await writeFile(
    join(process.cwd(), 'docs', 'AUTH_TEST_FIX_REPORT.md'),
    report
  );

  console.log(' Auth test fix complete!\n');
  console.log(' Report saved to: docs/AUTH_TEST_FIX_REPORT.md\n');
}

main().catch(console.error);
