/**
 * 登入並獲取 JWT Token，然後進行完整測試
 */

const REMOTE_URL = 'https://multi-channel.imfinethankyouandyou.com';

// 您的登入憑證 - 請填入密碼
const credentials = {
  email: 'admin@dacit.net',  // 或使用 'dacagent@dacit.net' 或 'test@dacit.net'
  password: ''  // ⚠️ 請填入您的密碼
};

async function login() {
  console.log('🔐 正在登入...\n');
  console.log(`Email: ${credentials.email}\n`);

  if (!credentials.password) {
    console.error('❌ 錯誤: 請在腳本中設置您的密碼');
    console.log('\n請編輯 login-and-test.ts 並設置 credentials.password\n');
    return null;
  }

  try {
    const response = await fetch(`${REMOTE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ 登入失敗: ${data.error || data.message}`);
      return null;
    }

    console.log('✅ 登入成功！\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎫 JWT Token:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(data.token);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (data.user) {
      console.log('👤 用戶資訊:');
      console.log(`   ID: ${data.user.id}`);
      console.log(`   Email: ${data.user.email}`);
      console.log(`   角色: ${data.user.role}`);
      console.log(`   團隊ID: ${data.user.teamId || 'N/A'}\n`);
    }

    console.log('📋 使用此 Token 的方法:\n');
    console.log('1️⃣  設置環境變數並重新執行測試:');
    console.log('   PowerShell:');
    console.log(`   $env:TEST_JWT_TOKEN="${data.token}"`);
    console.log('   npx tsx test-messaging-dual.ts\n');

    console.log('2️⃣  直接在 curl 中使用:');
    console.log(`   curl -H "Authorization: Bearer ${data.token.substring(0, 50)}..." https://multi-channel.imfinethankyouandyou.com/api/messages/stats\n`);

    return data.token;

  } catch (error) {
    console.error('❌ 連接錯誤:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

// 測試 token 是否有效
async function testToken(token: string) {
  console.log('\n🧪 測試 Token 有效性...\n');

  const testEndpoints = [
    { name: 'Stats', url: '/api/messages/stats', method: 'GET' },
    { name: 'Search', url: '/api/messages/search?q=test', method: 'GET' },
    { name: 'Tags', url: '/api/messages/tags', method: 'GET' }
  ];

  for (const endpoint of testEndpoints) {
    try {
      const response = await fetch(`${REMOTE_URL}${endpoint.url}`, {
        method: endpoint.method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      const status = response.ok ? '✅' : '❌';

      console.log(`${status} ${endpoint.name}: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        console.log(`   錯誤: ${data.error || data.message || JSON.stringify(data)}`);
      }

    } catch (error) {
      console.log(`❌ ${endpoint.name}: 連接失敗`);
    }
  }

  console.log('');
}

// 主程序
(async () => {
  const token = await login();

  if (token) {
    await testToken(token);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Token 獲取成功！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('💡 下一步: 使用此 token 進行完整測試\n');
    console.log('複製上面的環境變數設置命令並執行測試腳本。\n');

    process.exit(0);
  } else {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ 無法獲取 Token');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('請檢查:');
    console.log('  1. 密碼是否正確');
    console.log('  2. 用戶是否存在');
    console.log('  3. 網絡連接是否正常\n');

    console.log('可用的用戶 email:');
    console.log('  • admin@dacit.net (管理員)');
    console.log('  • dacagent@dacit.net (客服)');
    console.log('  • test@dacit.net (測試用戶)\n');

    process.exit(1);
  }
})();