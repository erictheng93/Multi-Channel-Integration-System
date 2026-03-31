#!/usr/bin/env node

/**
 * 檔案上傳功能驗證腳本
 * 專案名稱：Multi-Channel Support MVP
 * 檔案路徑：/scripts/verify-file-upload.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

// 類型定義
type ColorName = 'green' | 'red' | 'yellow' | 'blue' | 'reset' | 'bold';

interface VerificationCheck {
  name: string;
  check: () => Promise<boolean> | boolean;
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

// 驗證項目
const verificationChecks: VerificationCheck[] = [
  {
    name: '資料庫表結構',
    check: async (): Promise<boolean> => {
      try {
        const checkSQL = `
          SELECT name FROM sqlite_master 
          WHERE type='table' 
          AND name IN ('file_attachments', 'file_metadata', 'file_access_logs');
        `;
        
        const tempFile = path.join(__dirname, 'temp-check.sql');
        fs.writeFileSync(tempFile, checkSQL);
        
        const proc = Bun.spawnSync(
          ['wrangler', 'd1', 'execute', 'omni-channel-platform', '--local', `--file=${tempFile}`],
          { stdout: 'pipe', stderr: 'pipe' }
        );
        if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
        const result = proc.stdout.toString();
        
        fs.unlinkSync(tempFile);
        
        return result.includes('file_attachments') && 
               result.includes('file_metadata') && 
               result.includes('file_access_logs');
      } catch (error) {
        return false;
      }
    }
  },
  {
    name: 'R2 Bucket 配置',
    check: async (): Promise<boolean> => {
      try {
        const proc = Bun.spawnSync(['wrangler', 'r2', 'bucket', 'list'], { stdout: 'pipe', stderr: 'pipe' });
        if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
        const result = proc.stdout.toString();
        return result.includes('omni-channel-attachments');
      } catch (error) {
        return false;
      }
    }
  },
  {
    name: 'wrangler.toml R2 綁定',
    check: async (): Promise<boolean> => {
      try {
        const wranglerPath = path.join(rootDir, 'wrangler.toml');
        const content = fs.readFileSync(wranglerPath, 'utf8');
        return content.includes('R2_BUCKET') && content.includes('omni-channel-attachments');
      } catch (error) {
        return false;
      }
    }
  },
  {
    name: '前端 MessageInput 組件',
    check: async (): Promise<boolean> => {
      try {
        const componentPath = path.join(rootDir, 'frontend', 'src', 'components', 'conversation', 'MessageInput.vue');
        const content = fs.readFileSync(componentPath, 'utf8');
        return content.includes('uploadAttachment') && 
               content.includes('attachments') && 
               content.includes('file-input');
      } catch (error) {
        return false;
      }
    }
  },
  {
    name: '後端附件處理器',
    check: async (): Promise<boolean> => {
      try {
        const handlerPath = path.join(rootDir, 'src', 'handlers', 'attachment.ts');
        const content = fs.readFileSync(handlerPath, 'utf8');
        return content.includes('attachmentHandler') && 
               content.includes('upload') && 
               content.includes('R2_BUCKET');
      } catch (error) {
        return false;
      }
    }
  },
  {
    name: 'API 路由配置',
    check: async (): Promise<boolean> => {
      try {
        const indexPath = path.join(rootDir, 'src', 'index.ts');
        const content = fs.readFileSync(indexPath, 'utf8');
        return content.includes('attachmentHandler') && 
               content.includes('/api/conversations/:id/attachments');
      } catch (error) {
        return false;
      }
    }
  },
  {
    name: 'API 客戶端整合',
    check: async (): Promise<boolean> => {
      try {
        const apiPath = path.join(rootDir, 'frontend', 'src', 'api', 'message.ts');
        const content = fs.readFileSync(apiPath, 'utf8');
        return content.includes('uploadAttachment') && 
               content.includes('attachmentIds');
      } catch (error) {
        return false;
      }
    }
  },
  {
    name: '環境變數範例',
    check: async (): Promise<boolean> => {
      try {
        const envPath = path.join(rootDir, '.env.example');
        const content = fs.readFileSync(envPath, 'utf8');
        return content.includes('R2_PUBLIC_URL') && 
               content.includes('MAX_FILE_SIZE');
      } catch (error) {
        return false;
      }
    }
  }
];

// 執行驗證
async function runVerification(): Promise<boolean> {
  log(' 檔案上傳功能驗證開始...', 'bold');
  
  let passedChecks = 0;
  const totalChecks = verificationChecks.length;
  
  for (const check of verificationChecks) {
    process.stdout.write(`檢查 ${check.name}... `);
    
    try {
      const result = await check.check();
      if (result) {
        log(' 通過', 'green');
        passedChecks++;
      } else {
        log(' 失敗', 'red');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(` 錯誤: ${errorMessage}`, 'red');
    }
  }
  
  log(`\n 驗證結果: ${passedChecks}/${totalChecks} 項檢查通過`, 'blue');
  
  if (passedChecks === totalChecks) {
    log(' 所有檢查都通過！檔案上傳功能已完全配置。', 'green');
    return true;
  } else {
    log('  部分檢查未通過，請檢查上述失敗項目。', 'yellow');
    return false;
  }
}

// 生成配置報告
function generateConfigReport(): void {
  log('\n 配置報告:\n', 'bold');
  
  log('  資料庫表:', 'blue');
  log('  - file_attachments: 檔案附件主表');
  log('  - file_metadata: 檔案元數據表');
  log('  - file_access_logs: 檔案存取記錄表');
  
  log('\n R2 Buckets:', 'blue');
  log('  - omni-channel-attachments: 開發環境存儲');
  log('  - omni-channel-attachments-prod: 生產環境存儲');
  
  log('\n 需要配置的環境變數:', 'blue');
  log('  - R2_PUBLIC_URL: R2 公開存取 URL');
  log('  - MAX_FILE_SIZE: 檔案大小限制 (預設: 10MB)');
  log('  - JWT_SECRET: JWT 密鑰');
  
  log('\n 部署指令:', 'blue');
  log('  npx tsx scripts/setup-r2.ts # 設定開發環境 R2');
  log('  npx tsx scripts/setup-r2.ts --prod # 設定生產環境 R2');
  log('  npm run db:migrate:attachments # 執行資料庫遷移');
  log('  npm run deploy # 部署到 Cloudflare Workers');
}

// 主函數
async function main(): Promise<void> {
  const success = await runVerification();
  generateConfigReport();
  
  if (success) {
    log('\n 檔案上傳功能已完全準備就緒！', 'green');
    process.exit(0);
  } else {
    log('\n 請修正上述問題後重新驗證。', 'red');
    process.exit(1);
  }
}

// 執行腳本
main().catch(console.error);

export { runVerification };