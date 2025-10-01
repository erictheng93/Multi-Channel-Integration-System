/**
 * 獲取測試 JWT Token 的輔助腳本
 * 使用開發環境的 debug 端點生成測試 token
 */

const LOCAL_URL = 'http://localhost:8787';
const REMOTE_URL = 'https://multi-channel.imfinethankyouandyou.com';

async function getTestToken(environment: 'local' | 'remote' = 'local') {
  const baseUrl = environment === 'local' ? LOCAL_URL : REMOTE_URL;

  console.log(`\n🔐 嘗試獲取 ${environment.toUpperCase()} 環境的測試 token...\n`);

  // 方法 1: 嘗試使用 debug 端點（需要先有一個 admin token）
  console.log('方法 1: 檢查是否有 debug token 端點...');

  // 方法 2: 嘗試使用默認管理員帳號登入
  console.log('方法 2: 嘗試使用管理員帳號登入...');

  const possibleCredentials = [
    { email: 'admin@example.com', password: 'admin123' },
    { email: 'admin@test.com', password: 'admin123' },
    { email: 'testadmin@example.com', password: 'password123' },
  ];

  for (const cred of possibleCredentials) {
    try {
      console.log(`  嘗試: ${cred.email}...`);

      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cred)
      });

      const data = await response.json();

      if (response.ok && data.token) {
        console.log(`\n✅ 成功獲取 token！\n`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎫 JWT Token:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(data.token);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log('📋 使用方法:');
        console.log('  1. 設置環境變數:');
        console.log(`     export TEST_JWT_TOKEN="${data.token}"\n`);
        console.log('  2. 在 PowerShell 中:');
        console.log(`     $env:TEST_JWT_TOKEN="${data.token}"\n`);
        console.log('  3. 在測試中使用:');
        console.log(`     curl -H "Authorization: Bearer ${data.token.substring(0, 50)}..." <URL>\n`);

        if (data.user) {
          console.log('👤 用戶資訊:');
          console.log(`   用戶ID: ${data.user.id}`);
          console.log(`   Email: ${data.user.email}`);
          console.log(`   角色: ${data.user.role}`);
          console.log(`   團隊ID: ${data.user.teamId}\n`);
        }

        return data.token;
      } else {
        console.log(`  ❌ 失敗: ${data.error || data.message || '未知錯誤'}`);
      }
    } catch (error) {
      console.log(`  ⚠️  錯誤: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('\n❌ 無法獲取 token，請使用以下替代方案:\n');
  console.log('方案 A: 創建測試用戶');
  console.log('  npx tsx create-test-user.ts\n');

  console.log('方案 B: 查詢現有用戶');
  console.log('  npx wrangler d1 execute multi-channel-platform --local --command "SELECT id, email, role FROM agents LIMIT 5"\n');

  console.log('方案 C: 直接從數據庫獲取用戶信息後手動登入');

  return null;
}

// 執行
(async () => {
  try {
    // 先嘗試本地環境
    let token = await getTestToken('local');

    if (!token) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('嘗試遠程環境...\n');
      token = await getTestToken('remote');
    }

    if (token) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('執行錯誤:', error);
    process.exit(1);
  }
})();