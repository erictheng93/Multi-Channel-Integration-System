/**
 * Cloudflare 服務設置腳本
 * 
 * 此腳本幫助用戶設置所有必要的 Cloudflare 服務：
 * 1. D1 資料庫
 * 2. KV 命名空間
 * 3. R2 存儲桶
 * 4. 環境變數
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

console.log('🚀 開始設置 Cloudflare 服務...\n');

interface Namespace {
  name: string;
  binding: string;
}

interface Bucket {
  name: string;
  binding: string;
}

interface Secret {
  name: string;
  description: string;
  required: boolean;
  generate?: boolean;
}

/**
 * 執行命令並返回結果
 */
function runCommand(command: string, description: string): string | null {
  console.log(`📝 ${description}...`);
  try {
    const result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    console.log(`✅ ${description} 完成`);
    return result.trim();
  } catch (error: any) {
    console.error(`❌ ${description} 失敗:`, error.message);
    return null;
  }
}

/**
 * 檢查 wrangler 是否已安裝
 */
function checkWrangler(): boolean {
  console.log('🔍 檢查 Wrangler CLI...');
  try {
    const version = execSync('wrangler --version', { encoding: 'utf8' });
    console.log(`✅ Wrangler 已安裝: ${version.trim()}`);
    return true;
  } catch (error) {
    console.error('❌ Wrangler 未安裝，請先安裝:');
    console.error('   npm install -g wrangler');
    return false;
  }
}

/**
 * 檢查是否已登入 Cloudflare
 */
function checkLogin(): boolean {
  console.log('🔍 檢查 Cloudflare 登入狀態...');
  try {
    execSync('wrangler whoami', { encoding: 'utf8', stdio: 'pipe' });
    console.log('✅ 已登入 Cloudflare');
    return true;
  } catch (error) {
    console.error('❌ 未登入 Cloudflare，請先登入:');
    console.error('   wrangler login');
    return false;
  }
}

/**
 * 創建 D1 資料庫
 */
function createD1Database(): boolean {
  console.log('\n📊 設置 D1 資料庫...');
  
  // 檢查是否已存在
  try {
    const databases = execSync('wrangler d1 list', { encoding: 'utf8' });
    if (databases.includes('multi-channel-platform')) {
      console.log('✅ D1 資料庫 "multi-channel-platform" 已存在');
      return true;
    }
  } catch (error) {
    console.log('📝 檢查現有資料庫時出錯，繼續創建...');
  }
  
  // 創建新資料庫
  const result = runCommand(
    'wrangler d1 create multi-channel-platform',
    '創建 D1 資料庫'
  );
  
  if (result) {
    console.log('📋 請將以下配置添加到 wrangler.jsonc:');
    console.log(result);
    return true;
  }
  
  return false;
}

/**
 * 創建 KV 命名空間
 */
function createKVNamespaces(): void {
  console.log('\n🗄️ 設置 KV 命名空間...');
  
  const namespaces: Namespace[] = [
    { name: 'sessions', binding: 'SESSIONS' },
    { name: 'cache', binding: 'CACHE' }
  ];
  
  for (const ns of namespaces) {
    // 生產環境
    const prodResult = runCommand(
      `wrangler kv:namespace create "${ns.name}"`,
      `創建 KV 命名空間 "${ns.name}"`
    );
    
    // 預覽環境
    const previewResult = runCommand(
      `wrangler kv:namespace create "${ns.name}" --preview`,
      `創建 KV 預覽命名空間 "${ns.name}"`
    );
    
    if (prodResult && previewResult) {
      console.log(`📋 請將以下配置添加到 wrangler.jsonc 的 kv_namespaces 中:`);
      console.log(`{`);
      console.log(`  "binding": "${ns.binding}",`);
      console.log(`  "id": "從上面的輸出中複製",`);
      console.log(`  "preview_id": "從上面的預覽輸出中複製"`);
      console.log(`}`);
    }
  }
}

/**
 * 創建 R2 存儲桶
 */
function createR2Buckets(): void {
  console.log('\n🪣 設置 R2 存儲桶...');
  
  const buckets: Bucket[] = [
    { name: 'omni-files', binding: 'FILES' },
    { name: 'omni-avatars', binding: 'AVATARS' }
  ];
  
  for (const bucket of buckets) {
    const result = runCommand(
      `wrangler r2 bucket create ${bucket.name}`,
      `創建 R2 存儲桶 "${bucket.name}"`
    );
    
    if (result) {
      console.log(`📋 請將以下配置添加到 wrangler.jsonc 的 r2_buckets 中:`);
      console.log(`{`);
      console.log(`  "binding": "${bucket.binding}",`);
      console.log(`  "bucket_name": "${bucket.name}"`);
      console.log(`}`);
    }
  }
}

/**
 * 設置環境變數
 */
function setupSecrets(): void {
  console.log('\n🔐 設置環境變數...');
  
  const secrets: Secret[] = [
    {
      name: 'LINE_CHANNEL_ACCESS_TOKEN',
      description: 'LINE Channel Access Token',
      required: true
    },
    {
      name: 'LINE_CHANNEL_SECRET',
      description: 'LINE Channel Secret',
      required: true
    },
    {
      name: 'JWT_SECRET',
      description: 'JWT 簽名密鑰',
      required: true,
      generate: true
    },
    {
      name: 'ENCRYPTION_KEY',
      description: '資料加密密鑰',
      required: true,
      generate: true
    },
    {
      name: 'FACEBOOK_PAGE_ACCESS_TOKEN',
      description: 'Facebook Page Access Token',
      required: false
    },
    {
      name: 'FACEBOOK_APP_SECRET',
      description: 'Facebook App Secret',
      required: false
    }
  ];
  
  console.log('請設置以下環境變數:');
  
  for (const secret of secrets) {
    console.log(`\n📝 ${secret.description}:`);
    
    if (secret.generate) {
      const randomValue = crypto.randomBytes(32).toString('hex');
      console.log(`   建議值: ${randomValue}`);
      console.log(`   命令: wrangler secret put ${secret.name}`);
    } else {
      console.log(`   命令: wrangler secret put ${secret.name}`);
    }
    
    if (secret.required) {
      console.log(`   ⚠️  必需設置`);
    } else {
      console.log(`   ℹ️  可選設置`);
    }
  }
}

/**
 * 初始化資料庫
 */
function initializeDatabase(): boolean {
  console.log('\n🗃️ 初始化資料庫...');
  
  // 檢查 schema.sql 是否存在
  if (!fs.existsSync('schema.sql')) {
    console.error('❌ schema.sql 文件不存在');
    return false;
  }
  
  // 執行本地遷移
  const localResult = runCommand(
    'wrangler d1 execute multi-channel-platform --local --file=./schema.sql',
    '執行本地資料庫遷移'
  );
  
  if (localResult) {
    // 執行種子資料
    if (fs.existsSync('seed.sql')) {
      runCommand(
        'wrangler d1 execute multi-channel-platform --local --file=./seed.sql',
        '載入種子資料'
      );
    }
    
    console.log('\n📋 生產環境部署時，請執行:');
    console.log('   wrangler d1 execute multi-channel-platform --file=./schema.sql');
    if (fs.existsSync('seed.sql')) {
      console.log('   wrangler d1 execute multi-channel-platform --file=./seed.sql');
    }
  }
  
  return localResult !== null;
}

/**
 * 生成類型定義
 */
function generateTypes(): void {
  console.log('\n🔧 生成類型定義...');
  
  runCommand(
    'npm run cf-typegen',
    '生成 Cloudflare Workers 類型定義'
  );
}

/**
 * 主函數
 */
async function main(): Promise<void> {
  console.log('🎯 multi-channel-platform Cloudflare 服務設置');
  console.log('=====================================\n');
  
  // 檢查前置條件
  if (!checkWrangler()) {
    process.exit(1);
  }
  
  if (!checkLogin()) {
    process.exit(1);
  }
  
  // 創建服務
  const d1Success = createD1Database();
  createKVNamespaces();
  createR2Buckets();
  setupSecrets();
  
  if (d1Success) {
    initializeDatabase();
  }
  
  generateTypes();
  
  console.log('\n🎉 Cloudflare 服務設置完成！');
  console.log('\n📋 下一步:');
  console.log('1. 更新 wrangler.jsonc 中的服務 ID');
  console.log('2. 設置所有必要的環境變數');
  console.log('3. 執行 npm run dev 開始開發');
  console.log('4. 執行 npm run deploy 部署到生產環境');
  
  console.log('\n🔗 有用的命令:');
  console.log('   npm run dev          # 本地開發');
  console.log('   npm run deploy       # 部署到生產環境');
  console.log('   npm run cf-typegen   # 生成類型定義');
  console.log('   wrangler tail        # 查看實時日誌');
  console.log('   wrangler d1 execute multi-channel-platform --local --command="SELECT * FROM users" # 查詢資料庫');
}

// 執行主函數
main().catch(console.error);