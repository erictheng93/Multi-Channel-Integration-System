// 測試完整的 LINE webhook 到前端對話顯示流程

const crypto = require('crypto');

const API_BASE = 'http://127.0.0.1:8787';
const LINE_CHANNEL_SECRET = 'e4043079a1ad87f1a8869799b98819a4';

// 生成 LINE signature
function generateLineSignature(body, channelSecret) {
  const signature = crypto.createHmac('sha256', channelSecret)
    .update(body, 'utf8')
    .digest('base64');
  return signature;
}

// 模擬 LINE webhook 事件
async function simulateLineWebhook() {
  console.log('🔗 模擬 LINE webhook 事件...');

  const webhookBody = {
    events: [{
      type: 'message',
      message: {
        type: 'text',
        id: `test-msg-${Date.now()}`,
        text: '你好！這是測試訊息'
      },
      source: {
        userId: `U${Math.random().toString(36).substring(2, 17)}`
      },
      replyToken: `reply-token-${Date.now()}`,
      timestamp: Date.now()
    }]
  };

  const bodyStr = JSON.stringify(webhookBody);
  const signature = generateLineSignature(bodyStr, LINE_CHANNEL_SECRET);

  try {
    // 發送 webhook
    console.log('📤 發送 webhook 到:', `${API_BASE}/api/webhook`);
    
    const response = await fetch(`${API_BASE}/api/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': signature
      },
      body: bodyStr
    });

    const result = await response.text();
    console.log('📨 Webhook 回應:', result);

    if (response.ok) {
      console.log('✅ Webhook 處理成功');
      return true;
    } else {
      console.log('❌ Webhook 處理失敗:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Webhook 錯誤:', error);
    return false;
  }
}

// 測試登入並檢查對話
async function testConversationAPI() {
  console.log('\n🔐 測試登入和對話 API...');

  try {
    // 登入
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@dacit.net',
        password: '16011587'
      }),
    });

    const loginResult = await loginResponse.json();
    
    if (!loginResult.success) {
      console.error('❌ 登入失敗:', loginResult.error);
      return false;
    }

    const token = loginResult.data.token;
    console.log('✅ 登入成功:', loginResult.data.agent.name);

    // 等待一下讓 webhook 處理完成
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 檢查對話
    const conversationsResponse = await fetch(`${API_BASE}/api/conversations`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const conversationsResult = await conversationsResponse.json();
    
    if (conversationsResult.success) {
      console.log('📋 對話數量:', conversationsResult.data.length);
      
      if (conversationsResult.data.length > 0) {
        console.log('✅ 成功！對話已顯示在系統中');
        conversationsResult.data.forEach((conv, index) => {
          console.log(`  ${index + 1}. 對話 ID: ${conv.id}, 客戶: ${conv.customer_name || '未知'}`);
        });
        return true;
      } else {
        console.log('⚠️  沒有對話顯示，檢查權限設定');
        return false;
      }
    } else {
      console.error('❌ 對話 API 失敗:', conversationsResult.error);
      return false;
    }

  } catch (error) {
    console.error('❌ API 測試錯誤:', error);
    return false;
  }
}

// 執行完整測試
async function runFullTest() {
  console.log('🚀 開始完整的對話管理功能測試\n');

  // 1. 模擬 LINE webhook
  const webhookSuccess = await simulateLineWebhook();
  
  if (!webhookSuccess) {
    console.log('\n❌ 測試失敗：Webhook 處理不成功');
    return;
  }

  // 2. 測試對話 API
  const apiSuccess = await testConversationAPI();

  if (apiSuccess) {
    console.log('\n🎉 測試完成！系統可以正常處理 LINE 訊息並顯示在對話管理界面');
    console.log('🌐 請訪問前端界面確認: http://localhost:3002/conversations');
  } else {
    console.log('\n⚠️  測試部分成功：Webhook 正常但對話可能未正確顯示');
    console.log('建議檢查權限設定和資料庫查詢');
  }
}

// 執行測試
runFullTest().catch(console.error);