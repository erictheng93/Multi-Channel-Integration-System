/**
 * 測試 Drizzle Studio 設定
 */
import { config } from 'dotenv';

// 載入環境變數
config();

console.log('=== Drizzle Studio 設定檢查 ===\n');

const requiredVars = {
  'CLOUDFLARE_ACCOUNT_ID': process.env.CLOUDFLARE_ACCOUNT_ID,
  'CLOUDFLARE_DATABASE_ID': process.env.CLOUDFLARE_DATABASE_ID,
  'CLOUDFLARE_D1_TOKEN': process.env.CLOUDFLARE_D1_TOKEN
};

let allSet = true;

for (const [key, value] of Object.entries(requiredVars)) {
  if (value) {
    if (key === 'CLOUDFLARE_D1_TOKEN') {
      // 只顯示 token 的前幾個字元
      console.log(` ${key}: ${value.substring(0, 10)}...`);
    } else {
      console.log(` ${key}: ${value}`);
    }
  } else {
    console.log(` ${key}: 未設定`);
    allSet = false;
  }
}

console.log('\n' + '='.repeat(40));

if (allSet) {
  console.log(' 所有必要的環境變數都已設定！');
  console.log('現在可以執行: npm run db:studio');
} else {
  console.log(' 請設定缺少的環境變數');
  console.log('編輯 .env 檔案並加入缺少的值');
}

console.log('\nDrizzle 設定檔案內容:');
try {
  const drizzleConfig = await import('../drizzle.config.ts');
  console.log(' drizzle.config.ts 載入成功');
} catch (error) {
  console.log(' drizzle.config.ts 載入失敗:', error);
}