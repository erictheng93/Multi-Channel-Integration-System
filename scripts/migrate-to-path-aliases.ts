/**
 * 自動化路徑別名遷移腳本
 *
 * 功能：
 * 1. 掃描所有 TypeScript 文件
 * 2. 識別相對路徑導入
 * 3. 自動轉換為路徑別名
 * 4. 生成遷移報告
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// 路徑別名映射（對應 tsconfig.json）
const ALIAS_MAPPINGS = {
  '@': 'src',
  '@modules': 'src/modules',
  '@shared': 'src/shared',
  '@infrastructure': 'src/infrastructure',
  '@auth': 'src/modules/auth',
  '@conversations': 'src/modules/conversations',
  '@teams': 'src/modules/teams',
  '@customer': 'src/modules/customer',
  '@integrations': 'src/modules/integrations',
  '@real-time': 'src/modules/real-time',
  '@messaging': 'src/modules/messaging',
  '@analytics': 'src/modules/analytics',
  '@file-management': 'src/modules/file-management',
};

interface MigrationStats {
  totalFiles: number;
  modifiedFiles: number;
  totalImports: number;
  convertedImports: number;
  errors: string[];
}

const stats: MigrationStats = {
  totalFiles: 0,
  modifiedFiles: 0,
  totalImports: 0,
  convertedImports: 0,
  errors: [],
};

/**
 * 解析相對路徑並轉換為絕對路徑
 */
function resolveRelativePath(fromFile: string, relativePath: string): string {
  const fromDir = path.dirname(fromFile);
  const resolved = path.resolve(fromDir, relativePath);
  return resolved.replace(/\\/g, '/'); // 統一使用正斜線
}

/**
 * 檢查路徑是否匹配某個別名
 */
function findMatchingAlias(absolutePath: string): { alias: string; remainder: string } | null {
  // 嘗試匹配每個別名
  for (const [alias, aliasPath] of Object.entries(ALIAS_MAPPINGS)) {
    const fullAliasPath = path.resolve(aliasPath).replace(/\\/g, '/');

    if (absolutePath.startsWith(fullAliasPath)) {
      const remainder = absolutePath.substring(fullAliasPath.length);
      return { alias, remainder: remainder.replace(/^\//, '') };
    }
  }

  return null;
}

/**
 * 轉換單個導入語句
 */
function convertImportStatement(
  line: string,
  currentFile: string
): { converted: string; changed: boolean } {
  // 匹配 import 語句
  const importRegex = /^(\s*import\s+(?:{[^}]+}|[^'"]+)\s+from\s+['"])([^'"]+)(['"];?\s*)$/;
  const match = line.match(importRegex);

  if (!match) {
    return { converted: line, changed: false };
  }

  const [, prefix, importPath, suffix] = match;

  // 只處理相對路徑（以 . 或 .. 開頭）
  if (!importPath.startsWith('.')) {
    return { converted: line, changed: false };
  }

  stats.totalImports++;

  try {
    // 解析為絕對路徑
    const absolutePath = resolveRelativePath(currentFile, importPath);

    // 查找匹配的別名
    const aliasMatch = findMatchingAlias(absolutePath);

    if (aliasMatch) {
      const { alias, remainder } = aliasMatch;
      const newPath = remainder ? `${alias}/${remainder}` : alias;
      const converted = `${prefix}${newPath}${suffix}`;

      stats.convertedImports++;
      console.log(` ${importPath} → ${newPath}`);

      return { converted, changed: true };
    }
  } catch (error) {
    stats.errors.push(`Error converting ${importPath} in ${currentFile}: ${error}`);
  }

  return { converted: line, changed: false };
}

/**
 * 處理單個文件
 */
async function migrateFile(filePath: string, dryRun: boolean = false): Promise<boolean> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let modified = false;
    const newLines: string[] = [];

    for (const line of lines) {
      const { converted, changed } = convertImportStatement(line, filePath);
      newLines.push(converted);

      if (changed) {
        modified = true;
      }
    }

    if (modified && !dryRun) {
      fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
      console.log(` Modified: ${filePath}`);
      stats.modifiedFiles++;
    } else if (modified && dryRun) {
      console.log(` Would modify: ${filePath}`);
      stats.modifiedFiles++;
    }

    return modified;
  } catch (error) {
    stats.errors.push(`Error processing ${filePath}: ${error}`);
    return false;
  }
}

/**
 * 主函數
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const targetDir = args.find(arg => !arg.startsWith('--')) || 'src';

  console.log(' 路徑別名遷移腳本');
  console.log('='.repeat(50));
  console.log(`目標目錄: ${targetDir}`);
  console.log(`模式: ${dryRun ? '預覽模式 (不修改文件)' : '實際遷移'}`);
  console.log('='.repeat(50));
  console.log('');

  // 查找所有 TypeScript 文件
  const files = await glob(`${targetDir}/**/*.ts`, {
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
  });

  stats.totalFiles = files.length;
  console.log(` 找到 ${files.length} 個 TypeScript 文件\n`);

  // 處理每個文件
  for (const file of files) {
    await migrateFile(file, dryRun);
  }

  // 輸出統計
  console.log('\n' + '='.repeat(50));
  console.log(' 遷移統計');
  console.log('='.repeat(50));
  console.log(`總文件數: ${stats.totalFiles}`);
  console.log(`修改文件數: ${stats.modifiedFiles}`);
  console.log(`總導入語句: ${stats.totalImports}`);
  console.log(`已轉換: ${stats.convertedImports}`);
  console.log(`轉換率: ${stats.totalImports > 0 ? ((stats.convertedImports / stats.totalImports) * 100).toFixed(2) : 0}%`);

  if (stats.errors.length > 0) {
    console.log('\n 錯誤:');
    stats.errors.forEach(err => console.log(`  - ${err}`));
  }

  if (dryRun) {
    console.log('\n 這是預覽模式，沒有修改任何文件');
    console.log(' 移除 --dry-run 參數以執行實際遷移');
  } else {
    console.log('\n 遷移完成！');
    console.log(' 建議執行: npm run build 檢查是否有錯誤');
  }
}

// 執行
main().catch(error => {
  console.error(' 腳本執行失敗:', error);
  process.exit(1);
});