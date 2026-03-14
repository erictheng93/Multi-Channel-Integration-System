#!/usr/bin/env npx tsx
/**
 * 錯誤處理自動修復工具
 * Auto-Fix Error Handling Tool
 *
 * 自動修復非標準化的錯誤處理模式
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface FixResult {
  file: string;
  fixesApplied: number;
  success: boolean;
  error?: string;
}

class AutoFixTool {
  private rootDir: string;
  private results: FixResult[] = [];
  private dryRun: boolean;

  constructor(rootDir: string, dryRun: boolean = false) {
    this.rootDir = rootDir;
    this.dryRun = dryRun;
  }

  /**
   * 修復單個檔案中的非標準化 catch 區塊
   */
  public fixFile(filePath: string): FixResult {
    const result: FixResult = {
      file: filePath,
      fixesApplied: 0,
      success: false
    };

    try {
      const content = readFileSync(filePath, 'utf-8');
      let modifiedContent = content;
      let fixCount = 0;

      // Pattern 1: 修復 catch 區塊中直接使用 c.json({ success: false, error: ... })
      const catchPattern1 = /} catch \((error|err|e)\) \{\s*\n\s*console\.(error|warn|log)\([^)]+\);\s*\n\s*return c\.json\(\s*\{[\s\S]*?success:\s*false[\s\S]*?\}\s*,\s*\d+\s*\);\s*\n\s*\}/g;

      modifiedContent = modifiedContent.replace(catchPattern1, (match, errorVar) => {
        fixCount++;
        return `} catch (${errorVar}) {
    console.error('Operation failed:', ${errorVar});
    return handleApiError(${errorVar}, c);
  }`;
      });

      // Pattern 2: 修復 catch 區塊中直接使用 c.json({ error: ... })
      const catchPattern2 = /} catch \((error|err|e)\) \{\s*\n\s*console\.(error|warn|log)\([^)]+\);\s*\n\s*return c\.json\(\s*\{[^}]*error:[^}]*\}\s*,\s*\d+\s*\);\s*\n\s*\}/g;

      modifiedContent = modifiedContent.replace(catchPattern2, (match, errorVar) => {
        fixCount++;
        return `} catch (${errorVar}) {
    console.error('Operation failed:', ${errorVar});
    return handleApiError(${errorVar}, c);
  }`;
      });

      // 檢查是否需要添加 import
      if (fixCount > 0 && !modifiedContent.includes('handleApiError')) {
        // 找到其他 import 語句的位置
        const importMatch = modifiedContent.match(/import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"]/);
        if (importMatch) {
          const importPos = modifiedContent.indexOf(importMatch[0]) + importMatch[0].length;

          // 檢查是否已經從 api-response 導入
          if (modifiedContent.includes("from '../utils/api-response'") ||
              modifiedContent.includes("from '../../utils/api-response'") ||
              modifiedContent.includes("from '../../../utils/api-response'")) {
            // 更新現有 import
            modifiedContent = modifiedContent.replace(
              /(from\s+['"]\.\.\/.*?utils\/api-response['"]\s*;?)/,
              (match) => {
                if (match.includes('handleApiError')) {
                  return match;
                }
                return match.replace(
                  /import\s+\{([^}]+)\}/,
                  (_, imports) => `import { ${imports.trim()}, handleApiError }`
                );
              }
            );
          } else {
            // 添加新的 import
            const depth = (filePath.match(/\\/g) || []).length - (this.rootDir.match(/\\/g) || []).length - 2;
            const importPath = '../'.repeat(Math.max(1, depth)) + 'utils/api-response';
            modifiedContent = modifiedContent.slice(0, importPos) +
                            `\nimport { handleApiError } from '${importPath}';` +
                            modifiedContent.slice(importPos);
          }
        }
      }

      result.fixesApplied = fixCount;
      result.success = true;

      // 如果不是 dry run，寫入檔案
      if (!this.dryRun && fixCount > 0) {
        writeFileSync(filePath, modifiedContent, 'utf-8');
        console.log(` 已修復 ${filePath}: ${fixCount} 處修改`);
      } else if (this.dryRun && fixCount > 0) {
        console.log(`[Dry Run] 發現可修復問題 ${filePath}: ${fixCount} 處`);
      }

      this.results.push(result);
      return result;

    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : String(error);
      console.error(` 修復失敗 ${filePath}:`, result.error);
      this.results.push(result);
      return result;
    }
  }

  /**
   * 批量修復核心檔案
   */
  public fixCoreFiles(): void {
    const coreFiles = [
      'src/handlers/auth-main.ts',
      'src/handlers/conversation.ts',
      'src/handlers/message.ts',
      'src/handlers/webhook.ts',
      'src/handlers/system-main.ts',
      'src/handlers/alert-config-management.ts',
      'src/handlers/customer-main.ts',
      'src/handlers/delayed-message-main.ts',
      'src/handlers/team.ts',
      'src/handlers/qrcode-main.ts'
    ];

    console.log(`\n 開始批量修復核心檔案...\n`);
    console.log(`模式: ${this.dryRun ? '預覽模式 (Dry Run)' : '實際修復模式'}\n`);

    for (const file of coreFiles) {
      const fullPath = join(this.rootDir, file);
      try {
        this.fixFile(fullPath);
      } catch (error) {
        console.warn(` 跳過檔案 ${file}:`, error);
      }
    }
  }

  /**
   * 生成修復摘要報告
   */
  public getSummary(): string {
    const totalFiles = this.results.length;
    const successfulFixes = this.results.filter(r => r.success).length;
    const totalFixesApplied = this.results.reduce((sum, r) => sum + r.fixesApplied, 0);
    const failedFixes = this.results.filter(r => !r.success);

    let summary = '\n' + '='.repeat(60) + '\n';
    summary += ' 修復摘要報告\n';
    summary += '='.repeat(60) + '\n\n';
    summary += `總處理檔案數: ${totalFiles}\n`;
    summary += `成功修復: ${successfulFixes}\n`;
    summary += `失敗: ${failedFixes.length}\n`;
    summary += `總修改點數: ${totalFixesApplied}\n\n`;

    if (totalFixesApplied > 0) {
      summary += ' 已修復的檔案:\n';
      this.results
        .filter(r => r.fixesApplied > 0)
        .forEach(r => {
          summary += `  - ${r.file}: ${r.fixesApplied} 處修改\n`;
        });
      summary += '\n';
    }

    if (failedFixes.length > 0) {
      summary += ' 修復失敗的檔案:\n';
      failedFixes.forEach(r => {
        summary += `  - ${r.file}: ${r.error}\n`;
      });
      summary += '\n';
    }

    summary += '='.repeat(60) + '\n';

    return summary;
  }
}

// 執行主函數
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');

  console.log(' 錯誤處理自動修復工具\n');

  const rootDir = join(__dirname, '..');
  const tool = new AutoFixTool(rootDir, dryRun);

  // 修復核心檔案
  tool.fixCoreFiles();

  // 顯示摘要
  const summary = tool.getSummary();
  console.log(summary);

  if (dryRun) {
    console.log('  這是預覽模式，沒有實際修改檔案');
    console.log('  移除 --dry-run 參數以執行實際修復\n');
  } else {
    console.log(' 修復完成！\n');
    console.log('  建議執行以下檢查：');
    console.log('  1. npm run type-check  (檢查 TypeScript 錯誤)');
    console.log('  2. npm run lint (檢查代碼風格)');
    console.log('  3. npm run test (運行測試)\n');
  }
}

// 執行
main();

export { AutoFixTool };