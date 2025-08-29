// Test LINE webhook fix
import crypto from 'crypto';

const API_URL = 'https://multi-channel.imfinethankyouandyou.com';
const LINE_CHANNEL_SECRET = 'your_channel_secret_here'; // 從環境變數獲取

// 生成 LINE 簽名
function generateSignature(body: string, secret: string): string {
  const hmac = crypto.createHmac('SHA256', secret);
  hmac.update(body);
  return hmac.digest('base64');
}

// 測試 webhook
async function testWebhook() {
  console.log('🧪 Testing LINE webhook integration...\n');

  // 模擬 LINE 訊息事件
  const webhookBody = {
    destination: 'U1234567890abcdef',
    events: [
      {
        type: 'message',
        mode: 'active',
        timestamp: Date.now(),
        source: {
          type: 'user',
          userId: 'Utest123456789'
        },
        replyToken: 'replytoken123',
        message: {
          type: 'text',
          id: `msg_${Date.now()}`,
          text: `測試訊息 - ${new Date().toISOString()}`
        }
      }
    ]
  };

  const bodyString = JSON.stringify(webhookBody);
  const signature = generateSignature(bodyString, LINE_CHANNEL_SECRET);

  try {
    // 發送 webhook 請求
    console.log('📤 Sending webhook to:', `${API_URL}/api/webhook`);
    console.log('📝 Message content:', webhookBody.events[0].message.text);
    
    const response = await fetch(`${API_URL}/api/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Line-Signature': signature
      },
      body: bodyString
    });

    console.log('📥 Response status:', response.status);
    const result = await response.json();
    console.log('📥 Response body:', result);

    if (response.ok) {
      console.log('\n✅ Webhook processed successfully!');
      
      // 等待一下讓資料寫入
      console.log('\n⏳ Waiting 2 seconds for data to be written...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 現在檢查對話列表
      console.log('\n🔍 Checking conversations API...');
      const token = 'your_jwt_token_here'; // 需要有效的 JWT token
      
      const conversationsResponse = await fetch(`${API_URL}/api/conversations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (conversationsResponse.ok) {
        const conversations = await conversationsResponse.json();
        console.log('📋 Total conversations:', conversations.data?.items?.length || 0);
        
        // 查找最新的對話
        const latestConversation = conversations.data?.items?.[0];
        if (latestConversation) {
          console.log('📌 Latest conversation:', {
            id: latestConversation.id,
            customerId: latestConversation.customer?.id,
            platform: latestConversation.customer?.platform,
            lastMessage: latestConversation.lastMessage?.content
          });
        }
      } else {
        console.log('❌ Failed to fetch conversations:', conversationsResponse.status);
      }
    } else {
      console.log('\n❌ Webhook processing failed');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// 執行測試
testWebhook().catch(console.error);

console.log(`
📋 測試說明：
1. 這個腳本會發送一個模擬的 LINE webhook 到後端
2. 後端應該會處理訊息並儲存到資料庫
3. 然後透過 SSE 推送更新到前端

⚠️ 注意事項：
- 需要正確的 LINE_CHANNEL_SECRET 才能通過簽名驗證
- 需要有效的 JWT token 來查詢對話列表
- 確保後端服務正在運行

🔧 如果測試失敗，請檢查：
1. 後端日誌中的錯誤訊息
2. 簽名驗證是否正確
3. 資料庫寫入是否成功
4. SSE 連接是否正常
`);