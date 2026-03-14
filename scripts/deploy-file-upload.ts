#!/usr/bin/env node

/**
 * 檔案上傳功能快速部署腳本
 * 專案名稱：Multi-Channel Support MVP
 * 檔案路徑：/scripts/deploy-file-upload.ts
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

// 類型定義
type ColorName = 'green' | 'red' | 'yellow' | 'blue' | 'reset' | 'bold';

interface ExecuteOptions {
  silent?: boolean;
  optional?: boolean;
  cwd?: string;
}

interface DeploymentReport {
  timestamp: string;
  status: 'completed' | 'failed' | 'partial';
  components: {
    r2Storage: string;
    database: string;
    worker: string;
    tests: string;
  };
  nextSteps: string[];
}

interface Secret {
  name: string;
  description: string;
}

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

function executeCommand(command: string, description: string, options: ExecuteOptions = {}): string | null {
  log(`\n ${description}...`, 'blue');
  try {
    const result = execSync(command, {
      cwd: options.cwd || rootDir,
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    log(` ${description} 完成`, 'green');
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(` ${description} 失敗: ${errorMessage}`, 'red');
    if (!options.optional) {
      process.exit(1);
    }
    return null;
  }
}

function checkPrerequisites(): void {
  log(' 檢查部署前置條件...', 'bold');
  
  // 檢查 wrangler 是否安裝
  try {
    execSync('wrangler --version', { stdio: 'pipe' });
    log(' Wrangler CLI 已安裝', 'green');
  } catch (error) {
    log(' Wrangler CLI 未安裝，請先安裝: npm install -g wrangler', 'red');
    process.exit(1);
  }
  
  // 檢查是否已登入 Cloudflare
  try {
    execSync('wrangler whoami', { stdio: 'pipe' });
    log(' 已登入 Cloudflare 帳戶', 'green');
  } catch (error) {
    log(' 未登入 Cloudflare，請先執行: wrangler login', 'red');
    process.exit(1);
  }
  
  // 檢查必要檔案
  const requiredFiles: string[] = [
    'wrangler.toml',
    'database/file-attachments-schema.sql',
    'src/handlers/attachment.ts',
    'frontend/src/components/conversation/MessageInput.vue'
  ];
  
  for (const file of requiredFiles) {
    if (fs.existsSync(path.join(rootDir, file))) {
      log(` ${file} 存在`, 'green');
    } else {
      log(` ${file} 不存在`, 'red');
      process.exit(1);
    }
  }
}

function setupR2Storage(): void {
  log('\n 設定 Cloudflare R2 存儲...', 'bold');
  
  // 檢查 R2 Bucket 是否存在
  try {
    const buckets = execSync('wrangler r2 bucket list', { encoding: 'utf8', stdio: 'pipe' });
    if (buckets.includes('omni-channel-attachments')) {
      log(' R2 Bucket 已存在', 'green');
    } else {
      executeCommand(
        'wrangler r2 bucket create omni-channel-attachments',
        '創建 R2 Bucket'
      );
    }
  } catch (error) {
    executeCommand(
      'wrangler r2 bucket create omni-channel-attachments',
      '創建 R2 Bucket'
    );
  }
  
  // 檢查 wrangler.toml 中的 R2 配置
  const wranglerPath = path.join(rootDir, 'wrangler.toml');
  const wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
  
  if (!wranglerContent.includes('R2_BUCKET')) {
    log(' wrangler.toml 中缺少 R2 配置，請手動添加:', 'yellow');
    log(`
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "omni-channel-attachments"
    `, 'yellow');
  } else {
    log(' wrangler.toml R2 配置已存在', 'green');
  }
}

function setupEnvironmentVariables(): void {
  log('\n 設定環境變數...', 'bold');
  
  const secrets: Secret[] = [
    { name: 'JWT_SECRET', description: 'JWT 密鑰' },
    { name: 'R2_PUBLIC_URL', description: 'R2 公開 URL' }
  ];
  
  for (const secret of secrets) {
    try {
      const existingSecrets = execSync('wrangler secret list', { encoding: 'utf8', stdio: 'pipe' });
      if (existingSecrets.includes(secret.name)) {
        log(` ${secret.description} 已設定`, 'green');
      } else {
        log(` ${secret.description} 未設定，請手動執行:`, 'yellow');
        log(`wrangler secret put ${secret.name}`, 'yellow');
      }
    } catch (error) {
      log(` 無法檢查 ${secret.description}，請確保已設定`, 'yellow');
    }
  }
}

function migrateDatabase(): void {
  log('\n 執行資料庫遷移...', 'bold');
  
  // 檢查資料庫是否存在
  try {
    const databases = execSync('wrangler d1 list', { encoding: 'utf8', stdio: 'pipe' });
    if (!databases.includes('omni-channel-platform')) {
      log(' 資料庫不存在，請先創建資料庫', 'red');
      process.exit(1);
    }
  } catch (error) {
    log(' 無法檢查資料庫狀態', 'yellow');
  }
  
  // 執行本地遷移
  executeCommand(
    'wrangler d1 execute omni-channel-platform --local --file=database/file-attachments-schema.sql',
    '執行本地資料庫遷移',
    { optional: true }
  );
  
  // 執行生產遷移
  executeCommand(
    'wrangler d1 execute omni-channel-platform --file=database/file-attachments-schema.sql',
    '執行生產資料庫遷移'
  );
  
  // 驗證表是否創建成功
  try {
    const result = executeCommand(
      'wrangler d1 execute omni-channel-platform --command="SELECT name FROM sqlite_master WHERE type=\'table\' AND name LIKE \'file_%\';"',
      '驗證資料庫表創建',
      { silent: true }
    );
    
    if (result && result.includes('file_attachments')) {
      log(' 檔案附件表創建成功', 'green');
    } else {
      log(' 無法確認檔案附件表狀態', 'yellow');
    }
  } catch (error) {
    log(' 無法驗證資料庫表狀態', 'yellow');
  }
}

function buildAndDeploy(): void {
  log('\n 建置和部署應用程式...', 'bold');
  
  // 建置前端
  if (fs.existsSync(path.join(rootDir, 'frontend'))) {
    executeCommand(
      'npm run build',
      '建置前端應用程式',
      { cwd: path.join(rootDir, 'frontend') }
    );
  }
  
  // 部署 Worker
  executeCommand(
    'wrangler deploy',
    '部署 Cloudflare Worker'
  );
}

function runTests(): void {
  log('\n 執行測試驗證...', 'bold');
  
  // 執行檔案上傳狀態檢查
  executeCommand(
    'npx tsx scripts/file-upload-status-check.ts',
    '執行整合狀態檢查',
    { optional: true }
  );
  
  // 執行檔案上傳驗證
  executeCommand(
    'npx tsx scripts/verify-file-upload.ts',
    '執行檔案上傳驗證',
    { optional: true }
  );
}

function generateDeploymentReport(): void {
  log('\n 生成部署報告...', 'bold');
  
  const report: DeploymentReport = {
    timestamp: new Date().toISOString(),
    status: 'completed',
    components: {
      r2Storage: ' 已配置',
      database: ' 已遷移',
      worker: ' 已部署',
      tests: ' 已執行'
    },
    nextSteps: [
      '1. 檢查應用程式是否正常運行',
      '2. 執行手動測試驗證',
      '3. 監控系統運行狀況',
      '4. 設定告警和監控'
    ]
  };
  
  const reportPath = path.join(rootDir, 'deployment-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  log(' 部署報告已生成: deployment-report.json', 'green');
}

async function main(): Promise<void> {
  log(' 檔案上傳功能部署開始...', 'bold');
  
  try {
    checkPrerequisites();
    setupR2Storage();
    setupEnvironmentVariables();
    migrateDatabase();
    buildAndDeploy();
    runTests();
    generateDeploymentReport();
    
    log('\n 檔案上傳功能部署完成！', 'green');
    log('\n 後續步驟:', 'blue');
    log('1. 檢查應用程式運行狀況');
    log('2. 執行手動測試');
    log('3. 設定監控和告警');
    log('4. 查看部署報告: deployment-report.json');
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`\n 部署過程中發生錯誤: ${errorMessage}`, 'red');
    process.exit(1);
  }
}

// 執行部署
main().catch(console.error);