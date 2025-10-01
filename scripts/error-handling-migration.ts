#!/usr/bin/env npx tsx
/**
 * 錯誤處理遷移工具
 * Error Handling Migration Tool
 *
 * 自動檢測並建議修復非標準化的錯誤處理
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ErrorHandlingIssue {
  file: string;
  line: number;
  type: 'non_standardized_catch' | 'missing_error_handling' | 'inconsistent_response';
  currentCode: string;
  suggestedFix: string;
  severity: 'high' | 'medium' | 'low';
}

interface MigrationReport {
  totalFiles: number;
  filesAnalyzed: number;
  issuesFound: number;
  issuesByType: Record<string, number>;
  issuesBySeverity: Record<string, number>;
  issues: ErrorHandlingIssue[];
}

class ErrorHandlingMigrationTool {
  private rootDir: string;
  private report: MigrationReport;
  private excludeDirs = ['node_modules', 'dist', 'build', '.git', 'tests', '__tests__'];

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.report = {
      totalFiles: 0,
      filesAnalyzed: 0,
      issuesFound: 0,
      issuesByType: {},
      issuesBySeverity: {},
      issues: []
    };
  }

  /**
   * 掃描目錄並分析所有 TypeScript 檔案
   */
  public scan(directory: string = this.rootDir): void {
    const entries = readdirSync(directory);

    for (const entry of entries) {
      const fullPath = join(directory, entry);
      const stats = statSync(fullPath);

      if (stats.isDirectory()) {
        if (!this.excludeDirs.includes(entry)) {
          this.scan(fullPath);
        }
      } else if (stats.isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx'))) {
        this.report.totalFiles++;
        this.analyzeFile(fullPath);
      }
    }
  }

  /**
   * 分析單個檔案
   */
  private analyzeFile(filePath: string): void {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      this.report.filesAnalyzed++;

      // 檢測模式
      this.detectNonStandardizedCatch(filePath, lines);
      this.detectInconsistentResponse(filePath, lines);
      this.detectMissingErrorHandling(filePath, lines);

    } catch (error) {
      console.warn(`⚠️ 無法讀取檔案: ${filePath}`);
    }
  }

  /**
   * 檢測非標準化的 catch 區塊
   */
  private detectNonStandardizedCatch(filePath: string, lines: string[]): void {
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmedLine = line.trim();

      // 檢測 catch 區塊
      if (trimmedLine.includes('catch') && trimmedLine.includes('(')) {
        // 檢查接下來的幾行是否使用標準化處理
        const nextLines = lines.slice(index, Math.min(index + 10, lines.length)).join('\n');

        const hasStandardizedHandling =
          nextLines.includes('handleStandardError') ||
          nextLines.includes('handleModuleError') ||
          nextLines.includes('handleApiError') ||
          nextLines.includes('safeAsync') ||
          nextLines.includes('safeSync');

        if (!hasStandardizedHandling) {
          // 檢測是否直接返回 c.json({ error:
          const hasDirectJsonError = nextLines.includes('c.json') &&
                                     (nextLines.includes('error:') || nextLines.includes('success: false'));

          if (hasDirectJsonError) {
            this.addIssue({
              file: relative(this.rootDir, filePath),
              line: lineNum,
              type: 'non_standardized_catch',
              currentCode: this.extractCodeBlock(lines, index, 'catch'),
              suggestedFix: this.generateCatchBlockFix(lines, index),
              severity: 'high'
            });
          }
        }
      }
    });
  }

  /**
   * 檢測不一致的響應格式
   */
  private detectInconsistentResponse(filePath: string, lines: string[]): void {
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmedLine = line.trim();

      // 檢測直接返回錯誤響應而非使用標準化函數
      if (trimmedLine.includes('return c.json(') &&
          (trimmedLine.includes('error:') || trimmedLine.includes('success: false'))) {

        // 檢查是否在 catch 區塊外（正常流程中）
        const contextLines = lines.slice(Math.max(0, index - 5), index).join('\n');
        const isInCatch = contextLines.includes('catch');

        if (!isInCatch) {
          // 這是驗證錯誤或業務邏輯錯誤，應使用標準化響應
          this.addIssue({
            file: relative(this.rootDir, filePath),
            line: lineNum,
            type: 'inconsistent_response',
            currentCode: trimmedLine,
            suggestedFix: this.generateResponseFix(trimmedLine),
            severity: 'medium'
          });
        }
      }
    });
  }

  /**
   * 檢測缺少錯誤處理的異步函數
   */
  private detectMissingErrorHandling(filePath: string, lines: string[]): void {
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmedLine = line.trim();

      // 檢測異步函數定義
      if ((trimmedLine.includes('async (c') || trimmedLine.includes('async function')) &&
          trimmedLine.includes('=>') || trimmedLine.includes('(')) {

        // 檢查函數體是否包含 try-catch
        const functionBody = this.extractFunctionBody(lines, index);
        const hasTryCatch = functionBody.includes('try') && functionBody.includes('catch');

        if (!hasTryCatch && functionBody.length > 50) {
          // 函數體較大但沒有錯誤處理
          this.addIssue({
            file: relative(this.rootDir, filePath),
            line: lineNum,
            type: 'missing_error_handling',
            currentCode: lines[index],
            suggestedFix: 'Add try-catch block or use withErrorHandling wrapper',
            severity: 'low'
          });
        }
      }
    });
  }

  /**
   * 提取代碼區塊
   */
  private extractCodeBlock(lines: string[], startIndex: number, keyword: string): string {
    let braceCount = 0;
    let block: string[] = [];
    let started = false;

    for (let i = startIndex; i < Math.min(startIndex + 20, lines.length); i++) {
      const line = lines[i];
      block.push(line);

      if (line.includes(keyword) && line.includes('{')) {
        started = true;
      }

      if (started) {
        braceCount += (line.match(/{/g) || []).length;
        braceCount -= (line.match(/}/g) || []).length;

        if (braceCount === 0 && started) {
          break;
        }
      }
    }

    return block.join('\n').trim();
  }

  /**
   * 提取函數體
   */
  private extractFunctionBody(lines: string[], startIndex: number): string {
    let braceCount = 0;
    let body: string[] = [];
    let started = false;

    for (let i = startIndex; i < Math.min(startIndex + 50, lines.length); i++) {
      const line = lines[i];

      if (line.includes('{')) {
        started = true;
      }

      if (started) {
        body.push(line);
        braceCount += (line.match(/{/g) || []).length;
        braceCount -= (line.match(/}/g) || []).length;

        if (braceCount === 0) {
          break;
        }
      }
    }

    return body.join('\n');
  }

  /**
   * 生成 catch 區塊的修復建議
   */
  private generateCatchBlockFix(lines: string[], catchIndex: number): string {
    const indent = lines[catchIndex].match(/^(\s*)/)?.[1] || '';

    return `${indent}try {
${indent}  // ... existing code ...
${indent}} catch (error) {
${indent}  console.error('Operation failed:', error);
${indent}  return handleApiError(error, c);
${indent}}`;
  }

  /**
   * 生成響應的修復建議
   */
  private generateResponseFix(currentCode: string): string {
    if (currentCode.includes('404')) {
      return 'return notFoundResponse(c, "Resource");';
    } else if (currentCode.includes('400')) {
      return 'return validationErrorResponse(c, [{ field: "field", message: "error message" }]);';
    } else if (currentCode.includes('403')) {
      return 'return errorResponse(c, "Access denied", 403);';
    } else if (currentCode.includes('401')) {
      return 'return errorResponse(c, "Unauthorized", 401);';
    }

    return 'return errorResponse(c, "Error message", statusCode);';
  }

  /**
   * 添加問題到報告
   */
  private addIssue(issue: ErrorHandlingIssue): void {
    this.report.issues.push(issue);
    this.report.issuesFound++;

    // 統計
    this.report.issuesByType[issue.type] = (this.report.issuesByType[issue.type] || 0) + 1;
    this.report.issuesBySeverity[issue.severity] = (this.report.issuesBySeverity[issue.severity] || 0) + 1;
  }

  /**
   * 生成報告
   */
  public generateReport(): string {
    let report = '# 錯誤處理遷移報告\n\n';
    report += `生成時間: ${new Date().toISOString()}\n\n`;

    report += '## 總覽\n\n';
    report += `- 總檔案數: ${this.report.totalFiles}\n`;
    report += `- 已分析檔案: ${this.report.filesAnalyzed}\n`;
    report += `- 發現問題: ${this.report.issuesFound}\n\n`;

    report += '## 問題統計\n\n';
    report += '### 按類型分類\n';
    Object.entries(this.report.issuesByType).forEach(([type, count]) => {
      report += `- ${type}: ${count}\n`;
    });
    report += '\n';

    report += '### 按嚴重性分類\n';
    Object.entries(this.report.issuesBySeverity).forEach(([severity, count]) => {
      const icon = severity === 'high' ? '🔴' : severity === 'medium' ? '🟡' : '🟢';
      report += `- ${icon} ${severity}: ${count}\n`;
    });
    report += '\n';

    report += '## 詳細問題列表\n\n';

    // 按嚴重性排序
    const sortedIssues = [...this.report.issues].sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    sortedIssues.forEach((issue, index) => {
      const severityIcon = issue.severity === 'high' ? '🔴' :
                          issue.severity === 'medium' ? '🟡' : '🟢';

      report += `### ${index + 1}. ${severityIcon} ${issue.type}\n\n`;
      report += `**檔案**: \`${issue.file}:${issue.line}\`\n\n`;
      report += `**當前代碼**:\n\`\`\`typescript\n${issue.currentCode}\n\`\`\`\n\n`;
      report += `**建議修復**:\n\`\`\`typescript\n${issue.suggestedFix}\n\`\`\`\n\n`;
      report += '---\n\n';
    });

    return report;
  }

  /**
   * 保存報告到檔案
   */
  public saveReport(outputPath: string): void {
    const reportContent = this.generateReport();
    writeFileSync(outputPath, reportContent, 'utf-8');
    console.log(`✅ 報告已保存: ${outputPath}`);
  }

  /**
   * 獲取統計資料
   */
  public getStats() {
    return {
      totalFiles: this.report.totalFiles,
      filesAnalyzed: this.report.filesAnalyzed,
      issuesFound: this.report.issuesFound,
      standardizationRate: ((this.report.filesAnalyzed - this.report.issuesFound) / this.report.filesAnalyzed * 100).toFixed(2) + '%'
    };
  }
}

// 執行工具
function main() {
  console.log('🔍 開始錯誤處理遷移分析...\n');

  const rootDir = join(__dirname, '..');
  const tool = new ErrorHandlingMigrationTool(rootDir);

  // 掃描 src 目錄
  console.log('📂 掃描 src 目錄...');
  tool.scan(join(rootDir, 'src'));

  // 顯示統計
  const stats = tool.getStats();
  console.log('\n📊 掃描完成！\n');
  console.log(`總檔案數: ${stats.totalFiles}`);
  console.log(`已分析: ${stats.filesAnalyzed}`);
  console.log(`發現問題: ${stats.issuesFound}`);
  console.log(`標準化率: ${stats.standardizationRate}\n`);

  // 保存報告
  const reportPath = join(rootDir, 'ERROR_HANDLING_MIGRATION_REPORT.md');
  tool.saveReport(reportPath);

  console.log('✨ 遷移分析完成！');
}

export { ErrorHandlingMigrationTool };

// 執行主函數
main();