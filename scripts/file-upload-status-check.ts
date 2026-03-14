#!/usr/bin/env node

/**
 * 檔案上傳整合狀態檢查腳本
 * 專案名稱：Multi-Channel Support MVP
 * 檔案路徑：/scripts/file-upload-status-check.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

// 類型定義
interface CheckResults {
  frontend: Record<string, boolean>;
  backend: Record<string, boolean>;
  database: Record<string, boolean>;
  config: Record<string, boolean>;
  tests: Record<string, boolean>;
}

interface CompletionRate {
  passed: number;
  total: number;
  percentage: number;
}

interface Category {
  name: string;
  key: keyof CheckResults;
  icon: string;
}

// 顏色輸出類型
type ColorName = 'green' | 'red' | 'yellow' | 'blue' | 'reset' | 'bold';

// 檢查結果存儲
const checkResults: CheckResults = {
  frontend: {},
  backend: {},
  database: {},
  config: {},
  tests: {}
};

// 顏色輸出
const colors: Record<ColorName, string> = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message: string, color: ColorName = 'reset'): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath: string, description: string): boolean {
  const fullPath = path.join(rootDir, filePath);
  const exists = fs.existsSync(fullPath);
  log(`  ${exists ? '' : ''} ${description}`, exists ? 'green' : 'red');
  return exists;
}

function checkFileContent(filePath: string, searchTerms: string[], description: string): boolean {
  try {
    const fullPath = path.join(rootDir, filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const hasAllTerms = searchTerms.every(term => content.includes(term));
    log(`  ${hasAllTerms ? '' : ''} ${description}`, hasAllTerms ? 'green' : 'red');
    return hasAllTerms;
  } catch (error) {
    log(` ${description} (檔案不存在)`, 'red');
    return false;
  }
}

// 前端組件檢查
function checkFrontendComponents(): void {
  log('\n 前端組件檢查', 'blue');
  
  // MessageInput 組件
  checkResults.frontend.messageInputExists = checkFileExists(
    'frontend/src/components/conversation/MessageInput.vue',
    'MessageInput 組件存在'
  );
  
  checkResults.frontend.messageInputFeatures = checkFileContent(
    'frontend/src/components/conversation/MessageInput.vue',
    ['uploadAttachment', 'attachments', 'file-input', 'handleFileSelect'],
    'MessageInput 包含檔案上傳功能'
  );
  
  // API 客戶端
  checkResults.frontend.messageApiExists = checkFileExists(
    'frontend/src/api/message.ts',
    'Message API 客戶端存在'
  );
  
  checkResults.frontend.messageApiFeatures = checkFileContent(
    'frontend/src/api/message.ts',
    ['uploadAttachment', 'attachmentIds', 'UploadAttachmentRequest'],
    'Message API 包含檔案上傳方法'
  );
  
  // Base API 客戶端
  checkResults.frontend.baseApiFeatures = checkFileContent(
    'frontend/src/api/base.ts',
    ['uploadFile', 'FormData', 'multipart/form-data'],
    'Base API 支援檔案上傳'
  );
}

// 後端組件檢查
function checkBackendComponents(): void {
  log('\n 後端組件檢查', 'blue');
  
  // Attachment Handler
  checkResults.backend.attachmentHandlerExists = checkFileExists(
    'src/handlers/attachment.ts',
    'Attachment Handler 存在'
  );
  
  checkResults.backend.attachmentHandlerFeatures = checkFileContent(
    'src/handlers/attachment.ts',
    ['attachmentHandler', 'upload', 'download', 'delete', 'R2_BUCKET'],
    'Attachment Handler 功能完整'
  );
  
  // Message Handler 更新
  checkResults.backend.messageHandlerUpdated = checkFileContent(
    'src/handlers/message.ts',
    ['attachmentIds', 'has_attachments', 'file_attachments'],
    'Message Handler 支援檔案附件'
  );
  
  // 路由配置
  checkResults.backend.routesConfigured = checkFileContent(
    'src/index.ts',
    ['attachmentHandler', '/api/conversations/:id/attachments'],
    'API 路由已配置'
  );
}

// 資料庫結構檢查
function checkDatabaseStructure(): void {
  log('\n 資料庫結構檢查', 'blue');
  
  // 檔案附件 Schema
  checkResults.database.attachmentSchemaExists = checkFileExists(
    'database/file-attachments-schema.sql',
    '檔案附件 Schema 存在'
  );
  
  checkResults.database.attachmentSchemaComplete = checkFileContent(
    'database/file-attachments-schema.sql',
    ['file_attachments', 'file_metadata', 'file_access_logs', 'has_attachments'],
    '檔案附件 Schema 完整'
  );
  
  // 主要 Schema 更新
  checkResults.database.mainSchemaUpdated = checkFileContent(
    'database/schema.sql',
    ['messages', 'conversations'],
    '主要資料庫 Schema 存在'
  );
}

// 配置檢查
function checkConfiguration(): void {
  log('\n 配置檢查', 'blue');
  
  // Package.json 腳本
  checkResults.config.packageScripts = checkFileContent(
    'package.json',
    ['verify:upload', 'test:upload'],
    'Package.json 包含檔案上傳相關腳本'
  );
  
  // Wrangler 配置
  checkResults.config.wranglerExists = checkFileExists(
    'wrangler.toml',
    'Wrangler 配置檔案存在'
  );
  
  // 環境變數範例
  checkResults.config.envExample = checkFileExists(
    '.env.example',
    '環境變數範例檔案存在'
  );
}

// 測試檢查
function checkTests(): void {
  log('\n 測試檢查', 'blue');
  
  // MessageInput 測試
  checkResults.tests.messageInputTest = checkFileExists(
    'tests/unit/components/MessageInput.test.ts',
    'MessageInput 單元測試存在'
  );
  
  checkResults.tests.messageInputTestFeatures = checkFileContent(
    'tests/unit/components/MessageInput.test.ts',
    ['File Attachment Functionality', 'uploadAttachment', 'attachments'],
    'MessageInput 測試包含檔案上傳功能'
  );
  
  // 端到端測試
  checkResults.tests.e2eTest = checkFileExists(
    'tests/file-upload-end-to-end.test.ts',
    '端到端測試存在'
  );
  
  checkResults.tests.e2eTestFeatures = checkFileContent(
    'tests/file-upload-end-to-end.test.ts',
    ['Complete File Upload Flow', 'File Validation', 'UI State Management'],
    '端到端測試功能完整'
  );
}

// 計算完成度
function calculateCompletionRate(): CompletionRate {
  const allChecks = Object.values(checkResults).flatMap(category => Object.values(category));
  const passedChecks = allChecks.filter(result => result === true).length;
  const totalChecks = allChecks.length;
  
  return {
    passed: passedChecks,
    total: totalChecks,
    percentage: Math.round((passedChecks / totalChecks) * 100)
  };
}

// 生成報告
function generateReport(): void {
  const completion = calculateCompletionRate();
  
  log('\n 檢查結果總覽', 'bold');
  log(`完成度: ${completion.passed}/${completion.total} (${completion.percentage}%)`, 
      completion.percentage >= 80 ? 'green' : completion.percentage >= 60 ? 'yellow' : 'red');
  
  // 各類別結果
  const categories: Category[] = [
    { name: '前端組件', key: 'frontend', icon: '' },
    { name: '後端組件', key: 'backend', icon: '' },
    { name: '資料庫結構', key: 'database', icon: '' },
    { name: '配置', key: 'config', icon: '' },
    { name: '測試', key: 'tests', icon: '' }
  ];
  
  categories.forEach(category => {
    const results = Object.values(checkResults[category.key]);
    const passed = results.filter(r => r === true).length;
    const total = results.length;
    const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
    
    log(`${category.icon} ${category.name}: ${passed}/${total} (${percentage}%)`,
        percentage >= 80 ? 'green' : percentage >= 60 ? 'yellow' : 'red');
  });
}

// 生成建議
function generateRecommendations(): void {
  log('\n 建議和下一步', 'blue');
  
  const issues: string[] = [];
  
  // 檢查各種問題
  if (!checkResults.backend.attachmentHandlerExists) {
    issues.push(' 需要創建 Attachment Handler');
  }
  
  if (!checkResults.database.attachmentSchemaExists) {
    issues.push(' 需要創建檔案附件資料庫 Schema');
  }
  
  if (!checkResults.frontend.messageInputFeatures) {
    issues.push(' 需要完善 MessageInput 檔案上傳功能');
  }
  
  if (!checkResults.config.wranglerExists) {
    issues.push(' 需要配置 Wrangler.toml');
  }
  
  if (issues.length === 0) {
    log(' 所有核心組件都已實作完成！', 'green');
    log('\n 下一步行動：', 'bold');
    log('1. 配置 Cloudflare R2 存儲');
    log('2. 執行資料庫遷移');
    log('3. 設定環境變數');
    log('4. 執行端到端測試');
  } else {
    log(' 發現以下問題需要解決：', 'yellow');
    issues.forEach(issue => log(issue, 'red'));
  }
}

// 主函數
async function main(): Promise<void> {
  log(' 檔案上傳整合狀態檢查開始...', 'bold');
  
  checkFrontendComponents();
  checkBackendComponents();
  checkDatabaseStructure();
  checkConfiguration();
  checkTests();
  
  generateReport();
  generateRecommendations();
  
  const completion = calculateCompletionRate();
  
  if (completion.percentage >= 80) {
    log('\n 檔案上傳功能整合狀態良好！', 'green');
    process.exit(0);
  } else {
    log('\n 檔案上傳功能需要進一步完善。', 'yellow');
    process.exit(1);
  }
}

// 執行檢查
main().catch(console.error);

export { checkResults, calculateCompletionRate };