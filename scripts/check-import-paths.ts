/**
 * Pre-commit Hook: 檢查深層相對路徑導入
 *
 * 此腳本會檢查暫存的文件，確保沒有使用深層相對路徑（3層或以上）
 * 建議使用 TypeScript 路徑別名代替
 */

import * as fs from 'fs';
import { execSync } from 'child_process';

interface ImportIssue {
  file: string;
  line: number;
  import: string;
  suggestion: string;
}

const issues: ImportIssue[] = [];

// 獲取所有暫存的 TypeScript 文件
function getStagedFiles(): string[] {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf-8',
    });

    return output
      .split('\n')
      .filter(file => file.endsWith('.ts') || file.endsWith('.tsx'))
      .filter(file => !file.includes('node_modules'))
      .filter(file => !file.endsWith('.d.ts'));
  } catch (error) {
    console.error('Error getting staged files:', error);
    return [];
  }
}

/**
 * 檢查文件中的深層相對路徑
 */
function checkFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // 匹配導入語句中的相對路徑
    const importMatch = line.match(/from\s+['"]([^'"]+)['"]/);

    if (importMatch) {
      const importPath = importMatch[1];

      // 檢查是否為深層相對路徑（3層或以上）
      const depth = (importPath.match(/\.\.\//g) || []).length;

      if (depth >= 3) {
        // 嘗試提供別名建議
        const suggestion = suggestAlias(importPath);

        issues.push({
          file: filePath,
          line: index + 1,
          import: importPath,
          suggestion,
        });
      }
    }
  });
}

/**
 * 根據路徑提供別名建議
 */
function suggestAlias(importPath: string): string {
  if (importPath.includes('/modules/analytics')) {
    return importPath.replace(/^.*\/modules\/analytics\//, '@analytics/');
  }
  if (importPath.includes('/modules/reports')) {
    return importPath.replace(/^.*\/modules\/reports\//, '@modules/reports/');
  }
  if (importPath.includes('/modules/')) {
    return importPath.replace(/^.*\/modules\//, '@modules/');
  }
  if (importPath.includes('/shared/')) {
    return importPath.replace(/^.*\/shared\//, '@shared/');
  }

  return '考慮使用 @modules 或 @shared 別名';
}

/**
 * 主函數
 */
function main(): void {
  console.log('🔍 檢查路徑導入規範...\n');

  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    console.log('✅ 沒有暫存的 TypeScript 文件');
    process.exit(0);
  }

  console.log(`📂 檢查 ${stagedFiles.length} 個文件...\n`);

  stagedFiles.forEach(file => checkFile(file));

  if (issues.length === 0) {
    console.log('✅ 所有導入語句符合規範！\n');
    process.exit(0);
  }

  // 顯示問題
  console.log('⚠️  發現深層相對路徑導入：\n');
  console.log('=' .repeat(80));

  issues.forEach(issue => {
    console.log(`\n文件: ${issue.file}:${issue.line}`);
    console.log(`當前: ${issue.import}`);
    console.log(`建議: ${issue.suggestion}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log(`\n❌ 發現 ${issues.length} 個問題`);
  console.log('\n建議：');
  console.log('  1. 使用路徑別名代替深層相對路徑');
  console.log('  2. 運行自動遷移: npx tsx scripts/migrate-to-path-aliases.ts <目錄>');
  console.log('  3. 查看指南: docs/standards/PATH_ALIAS_GUIDE.md\n');
  console.log('如果確定要提交，使用: git commit --no-verify\n');

  process.exit(1);
}

main();