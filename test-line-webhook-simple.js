// 簡單的 LINE Webhook 測試
// 這個腳本不需要簽名，只是測試 endpoint 是否能接收請求

const WEBHOOK_URL = 'https://multi-channel.imfinethankyouandyou.com/api/webhook';

async function testSimple() {
  console.log('📡 Testing webhook endpoint without signature...\n');

  // 簡單的測試請求（會被簽名驗證拒絕，但能確認 endpoint 存在）
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        test: 'ping',
        timestamp: new Date().toISOString()
      })
    });

    console.log('✅ Endpoint reached!');
    console.log('📊 Status:', response.status);
    console.log('📄 Response:', await response.text());
    
    if (response.status === 401) {
      console.log('\n⚠️ 收到 401 錯誤是預期的，因為沒有提供簽名');
      console.log('這表示 webhook endpoint 正在工作！');
    }
  } catch (error) {
    console.log('❌ Cannot reach endpoint!');
    console.log('Error:', error.message);
    console.log('\n可能的原因：');
    console.log('1. URL 錯誤');
    console.log('2. 網路問題');
    console.log('3. Worker 未部署');
  }
}

testSimple().catch(console.error);