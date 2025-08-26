#!/usr/bin/env node

/**
 * Cloudflare R2 存儲設定腳本
 * 專案名稱：Multi-Channel Support MVP
 * 檔案路徑：/scripts/setup-r2-storage.ts
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CorsPolicy {
  AllowedOrigins: string[];
  AllowedMethods: string[];
  AllowedHeaders: string[];
  MaxAgeSeconds: number;
}

interface R2Environment {
  bucketName: string;
  corsPolicy: CorsPolicy;
}

interface R2ConfigType {
  development: R2Environment;
  production: R2Environment;
}

// R2 Bucket 配置
const R2_CONFIG: R2ConfigType = {
  development: {
    bucketName: 'multi-channel-platform-attachments-dev',
    corsPolicy: {
      AllowedOrigins: ['http://localhost:5173', 'http://localhost:8787', 'https://s3-dev.imfinethankyouandyou.com'],
      AllowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
      AllowedHeaders: ['*'],
      MaxAgeSeconds: 3600
    }
  },
  production: {
    bucketName: 'multi-channel-platform-attachments',
    corsPolicy: {
      AllowedOrigins: ['https://multi-channel.imfinethankyouandyou.com', 'https://s3.imfinethankyouandyou.com'], // 實際域名
      AllowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
      AllowedHeaders: ['*'],
      MaxAgeSeconds: 3600
    }
  }
};

// 檢查 Cloudflare CLI 是否已安裝
function checkCloudflareAuth(): boolean {
  try {
    execSync('wrangler whoami', { stdio: 'pipe' });
    console.log('✅ Cloudflare 認證已設定');
    return true;
  } catch (error) {
    console.error('❌ Cloudflare 認證未設定，請先執行: wrangler login');
    return false;
  }
}

// 創建 R2 Bucket
function createR2Bucket(bucketName: string, environment: string = 'development'): boolean {
  try {
    console.log(`🪣 創建 R2 Bucket: ${bucketName}`);
    
    // 檢查 bucket 是否已存在
    try {
      execSync(`wrangler r2 bucket list | grep ${bucketName}`, { stdio: 'pipe' });
      console.log(`ℹ️  Bucket ${bucketName} 已存在`);
      return true;
    } catch (error) {
      // Bucket 不存在，創建新的
    }
    
    // 創建 bucket
    execSync(`wrangler r2 bucket create ${bucketName}`, { stdio: 'inherit' });
    console.log(`✅ Bucket ${bucketName} 創建成功`);
    
    return true;
  } catch (error: any) {
    console.error(`❌ 創建 Bucket 失敗: ${error.message}`);
    return false;
  }
}

// 設定 CORS 政策
function setupCORS(bucketName: string, corsPolicy: CorsPolicy): boolean {
  try {
    console.log(`🔧 設定 ${bucketName} 的 CORS 政策...`);
    
    // 創建臨時 CORS 配置檔案
    const corsConfigPath = path.join(__dirname, 'temp-cors.json');
    const corsConfig = {
      CORSRules: [{
        AllowedOrigins: corsPolicy.AllowedOrigins,
        AllowedMethods: corsPolicy.AllowedMethods,
        AllowedHeaders: corsPolicy.AllowedHeaders,
        MaxAgeSeconds: corsPolicy.MaxAgeSeconds
      }]
    };
    
    fs.writeFileSync(corsConfigPath, JSON.stringify(corsConfig, null, 2));
    
    try {
      // 設定 CORS
      execSync(`wrangler r2 bucket cors put ${bucketName} --file ${corsConfigPath}`, {
        stdio: 'inherit'
      });
      console.log(`✅ ${bucketName} CORS 設定完成`);
    } finally {
      // 清理臨時檔案
      if (fs.existsSync(corsConfigPath)) {
        fs.unlinkSync(corsConfigPath);
      }
    }
    
    return true;
  } catch (error: any) {
    console.error(`❌ CORS 設定失敗: ${error.message}`);
    return false;
  }
}

// 測試 R2 存取
function testR2Access(bucketName: string): boolean {
  try {
    console.log(`🧪 測試 ${bucketName} 存取權限...`);
    
    // 創建測試檔案
    const testFilePath = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(testFilePath, 'R2 存取測試檔案');
    
    try {
      // 上傳測試檔案
      execSync(`wrangler r2 object put ${bucketName}/test/test-file.txt --file ${testFilePath}`, {
        stdio: 'pipe'
      });
      
      // 列出檔案
      execSync(`wrangler r2 object list ${bucketName} --prefix test/`, {
        stdio: 'inherit'
      });
      
      // 刪除測試檔案
      execSync(`wrangler r2 object delete ${bucketName}/test/test-file.txt`, {
        stdio: 'pipe'
      });
      
      console.log(`✅ ${bucketName} 存取測試通過`);
      return true;
    } finally {
      // 清理本地測試檔案
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  } catch (error: any) {
    console.error(`❌ R2 存取測試失敗: ${error.message}`);
    return false;
  }
}

// 生成環境變數配置
function generateEnvConfig(): void {
  console.log('📝 生成環境變數配置...');
  
  const envConfig = `
# Cloudflare R2 配置
# 開發環境: https://s3dev.imfinethankyouandyou.com
# 生產環境: https://s3.imfinethankyouandyou.com
R2_PUBLIC_URL=https://s3dev.imfinethankyouandyou.com
R2_ACCOUNT_ID=your-cloudflare-account-id

# 檔案上傳配置
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document
`;

  console.log('請將以下配置添加到您的 .env 檔案中:');
  console.log(envConfig);
  
  // 如果 .env 檔案不存在，創建它
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    const envExamplePath = path.join(__dirname, '..', '.env.example');
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      console.log('✅ 已創建 .env 檔案，請填入實際配置值');
    }
  }
}

// 主設定函數
async function setupR2Storage(environment: keyof R2ConfigType = 'development'): Promise<boolean> {
  console.log(`🚀 開始設定 Cloudflare R2 存儲 (${environment})...`);
  
  // 檢查認證
  if (!checkCloudflareAuth()) {
    return false;
  }
  
  const config = R2_CONFIG[environment];
  if (!config) {
    console.error(`❌ 不支援的環境: ${environment}`);
    return false;
  }
  
  // 創建 R2 Bucket
  if (!createR2Bucket(config.bucketName, environment)) {
    return false;
  }
  
  // 設定 CORS
  if (!setupCORS(config.bucketName, config.corsPolicy)) {
    return false;
  }
  
  // 測試存取
  if (!testR2Access(config.bucketName)) {
    return false;
  }
  
  // 生成環境變數配置
  generateEnvConfig();
  
  console.log(`✅ Cloudflare R2 存儲設定完成 (${environment})`);
  return true;
}

// 主函數
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const environment: keyof R2ConfigType = args.includes('--prod') ? 'production' : 'development';
  
  if (args.includes('--help')) {
    console.log(`
使用方法:
  node setup-r2-storage.ts [選項]

選項:
  --prod     設定生產環境 R2 存儲
  --help     顯示此幫助訊息

範例:
  node setup-r2-storage.ts          # 設定開發環境
  node setup-r2-storage.ts --prod   # 設定生產環境
    `);
    return;
  }
  
  await setupR2Storage(environment);
}

// 執行腳本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { setupR2Storage };