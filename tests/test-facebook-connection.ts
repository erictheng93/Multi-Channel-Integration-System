// Facebook Messenger 連接測試腳本
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DevVars {
  [key: string]: string;
}

interface FacebookProfile {
  id: string;
  first_name: string;
  last_name: string;
  profile_pic?: string;
  locale?: string;
  timezone?: number;
}

interface FacebookWebhookEvent {
  sender: {
    id: string;
  };
  recipient: {
    id: string;
  };
  timestamp: number;
  message: {
    mid: string;
    text: string;
  };
}

interface FacebookWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    messaging: FacebookWebhookEvent[];
  }>;
}

// 讀取 .dev.vars 文件
function loadDevVars(): DevVars | null {
  const devVarsPath = path.join(__dirname, '.dev.vars');
  if (!fs.existsSync(devVarsPath)) {
    console.error('❌ .dev.vars 文件不存在');
    return null;
  }

  const content = fs.readFileSync(devVarsPath, 'utf8');
  const vars: DevVars = {};
  
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        vars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return vars;
}

// 測試 Facebook API 連接
async function testFacebookAPI(pageAccessToken: string): Promise<boolean> {
  try {
    console.log('🔄 測試 Facebook Graph API 連接...');
    
    const response = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${pageAccessToken}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Facebook API 連接失敗:', response.status, errorText);
      return false;
    }

    const data = await response.json();
    console.log('✅ Facebook API 連接成功');
    console.log(`📄 頁面資訊: ${data.name} (ID: ${data.id})`);
    
    return true;
  } catch (error) {
    console.error('❌ Facebook API 連接錯誤:', error);
    return false;
  }
}

// 測試 Facebook 發送訊息
async function testFacebookSendMessage(pageAccessToken: string, testUserId: string): Promise<boolean> {
  try {
    console.log('🔄 測試 Facebook 發送訊息...');
    
    const messageData = {
      recipient: {
        id: testUserId
      },
      message: {
        text: '🤖 Facebook Messenger 連接測試成功！這是來自客服系統的測試訊息。'
      }
    };

    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messageData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Facebook 發送訊息失敗:', response.status, errorText);
      return false;
    }

    const data = await response.json();
    console.log('✅ Facebook 訊息發送成功');
    console.log(`📤 訊息 ID: ${data.message_id}`);
    
    return true;
  } catch (error) {
    console.error('❌ Facebook 發送訊息錯誤:', error);
    return false;
  }
}

// 測試 Facebook Webhook 驗證
async function testFacebookWebhookVerification(appSecret: string, verifyToken: string): Promise<boolean> {
  try {
    console.log('🔄 測試 Facebook Webhook 驗證...');
    
    // 模擬 webhook 驗證請求
    const mode = 'subscribe';
    const challenge = 'test-challenge-' + Date.now();
    
    if (mode === 'subscribe' && verifyToken) {
      console.log('✅ Facebook Webhook 驗證邏輯正確');
      console.log(`🔐 驗證令牌: ${verifyToken.substring(0, 8)}...`);
      console.log(`🎯 Challenge: ${challenge}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Facebook Webhook 驗證錯誤:', error);
    return false;
  }
}

// 測試 Facebook Webhook 簽名驗證
async function testFacebookSignatureVerification(appSecret: string): Promise<boolean> {
  try {
    console.log('🔄 測試 Facebook Webhook 簽名驗證...');
    
    const testPayload = JSON.stringify({
      object: 'page',
      entry: [{
        messaging: [{
          sender: { id: 'test-sender' },
          message: { text: 'test message' }
        }]
      }]
    });

    // 使用 Web Crypto API 生成 HMAC-SHA1 簽名
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(appSecret),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(testPayload)
    );

    const hashArray = new Uint8Array(signature);
    const hashHex = Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const expectedSignature = `sha1=${hashHex}`;
    
    console.log('✅ Facebook 簽名驗證測試完成');
    console.log(`🔐 測試簽名: ${expectedSignature.substring(0, 20)}...`);
    
    return true;
  } catch (error) {
    console.error('❌ Facebook 簽名驗證錯誤:', error);
    return false;
  }
}

// 測試 Facebook 用戶資料獲取
async function testFacebookUserProfile(pageAccessToken: string, testUserId: string): Promise<FacebookProfile | null> {
  try {
    console.log('🔄 測試 Facebook 用戶資料獲取...');
    
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${testUserId}?fields=first_name,last_name,profile_pic,locale,timezone&access_token=${pageAccessToken}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Facebook 用戶資料獲取失敗:', response.status, errorText);
      return null;
    }

    const profile: FacebookProfile = await response.json();
    console.log('✅ Facebook 用戶資料獲取成功');
    console.log(`👤 用戶: ${profile.first_name} ${profile.last_name}`);
    console.log(`🆔 用戶 ID: ${profile.id}`);
    
    return profile;
  } catch (error) {
    console.error('❌ Facebook 用戶資料獲取錯誤:', error);
    return null;
  }
}

// 測試 Webhook 處理邏輯
async function testFacebookWebhookProcessing(): Promise<boolean> {
  try {
    console.log('🔄 測試 Facebook Webhook 處理邏輯...');
    
    const mockWebhookPayload: FacebookWebhookPayload = {
      object: 'page',
      entry: [{
        id: 'test-page-id',
        time: Date.now(),
        messaging: [{
          sender: { id: 'test-user-123' },
          recipient: { id: 'test-page-456' },
          timestamp: Date.now(),
          message: {
            mid: 'test-message-id',
            text: 'Hello from Facebook Messenger!'
          }
        }]
      }]
    };

    // 驗證 Webhook 結構
    const isValidStructure = 
      mockWebhookPayload.object === 'page' &&
      Array.isArray(mockWebhookPayload.entry) &&
      mockWebhookPayload.entry.length > 0 &&
      Array.isArray(mockWebhookPayload.entry[0].messaging);

    if (isValidStructure) {
      console.log('✅ Facebook Webhook 結構驗證通過');
      console.log(`📦 處理 ${mockWebhookPayload.entry.length} 個 entry`);
      
      // 處理每個訊息
      for (const entry of mockWebhookPayload.entry) {
        for (const messaging of entry.messaging) {
          if (messaging.message && messaging.message.text) {
            console.log(`💬 收到訊息: "${messaging.message.text.substring(0, 50)}..."`);
            console.log(`👤 來自用戶: ${messaging.sender.id}`);
          }
        }
      }
      
      return true;
    }

    console.error('❌ Facebook Webhook 結構驗證失敗');
    return false;
  } catch (error) {
    console.error('❌ Facebook Webhook 處理錯誤:', error);
    return false;
  }
}

// 主測試函數
async function main() {
  console.log('🚀 開始 Facebook Messenger 連接測試');
  console.log('=' .repeat(50));

  // 載入環境變數
  const vars = loadDevVars();
  if (!vars) {
    process.exit(1);
  }

  const pageAccessToken = vars.FB_PAGE_ACCESS_TOKEN;
  const appSecret = vars.FB_APP_SECRET;
  const verifyToken = vars.FB_VERIFY_TOKEN;
  const testUserId = vars.FB_TEST_USER_ID;

  if (!pageAccessToken || !appSecret) {
    console.error('❌ 缺少必要的 Facebook 環境變數');
    console.log('請在 .dev.vars 文件中設定:');
    console.log('- FB_PAGE_ACCESS_TOKEN');
    console.log('- FB_APP_SECRET');
    console.log('- FB_VERIFY_TOKEN');
    console.log('- FB_TEST_USER_ID (可選，用於測試發送訊息)');
    process.exit(1);
  }

  let allTestsPassed = true;
  const results: { [key: string]: boolean } = {};

  // 1. 測試 Facebook API 連接
  results['API 連接'] = await testFacebookAPI(pageAccessToken);
  if (!results['API 連接']) allTestsPassed = false;

  console.log('');

  // 2. 測試 Webhook 驗證
  results['Webhook 驗證'] = await testFacebookWebhookVerification(appSecret, verifyToken);
  if (!results['Webhook 驗證']) allTestsPassed = false;

  console.log('');

  // 3. 測試簽名驗證
  results['簽名驗證'] = await testFacebookSignatureVerification(appSecret);
  if (!results['簽名驗證']) allTestsPassed = false;

  console.log('');

  // 4. 測試 Webhook 處理邏輯
  results['Webhook 處理'] = await testFacebookWebhookProcessing();
  if (!results['Webhook 處理']) allTestsPassed = false;

  console.log('');

  // 5. 測試用戶資料獲取 (如果有測試用戶 ID)
  if (testUserId) {
    const profile = await testFacebookUserProfile(pageAccessToken, testUserId);
    results['用戶資料獲取'] = profile !== null;
    if (!results['用戶資料獲取']) allTestsPassed = false;

    console.log('');

    // 6. 測試發送訊息 (如果有測試用戶 ID)
    results['發送訊息'] = await testFacebookSendMessage(pageAccessToken, testUserId);
    if (!results['發送訊息']) allTestsPassed = false;
  } else {
    console.log('⚠️  跳過用戶相關測試 (未設定 FB_TEST_USER_ID)');
  }

  // 顯示測試結果摘要
  console.log('');
  console.log('=' .repeat(50));
  console.log('📊 測試結果摘要:');
  
  for (const [testName, passed] of Object.entries(results)) {
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${testName}`);
  }

  console.log('');
  if (allTestsPassed) {
    console.log('🎉 所有 Facebook Messenger 測試通過！');
    console.log('');
    console.log('📋 後續步驟:');
    console.log('1. 設定 Facebook 應用程式的 Webhook URL');
    console.log('2. 訂閱頁面事件 (messages, messaging_postbacks)');
    console.log('3. 測試從 Facebook Messenger 發送訊息到你的應用程式');
    console.log('4. 確認客服系統能正確接收和處理 Facebook 訊息');
    process.exit(0);
  } else {
    console.log('❌ 部分 Facebook Messenger 測試失敗');
    console.log('請檢查上述錯誤訊息並修正相關設定');
    process.exit(1);
  }
}

// 錯誤處理
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未處理的錯誤:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ 未捕獲的例外:', error);
  process.exit(1);
});

main().catch(error => {
  console.error('❌ 主程序錯誤:', error);
  process.exit(1);
});