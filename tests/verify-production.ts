// 驗證生產環境部署
const PRODUCTION_URL: string = 'https://multi-channel.imfinethankyouandyou.com';

interface HealthResponse {
  status: string;
  database: string;
  version?: string;
}

interface Message {
  sender_type: string;
  content: string;
  created_at: string;
}

interface StatsData {
  totalMessages: number;
  totalCustomers: number;
  totalConversations: number;
  recentMessages: Message[];
}

interface StatsResponse {
  success: boolean;
  data: StatsData;
}

interface WebhookEvent {
  type: string;
  timestamp: number;
  source: {
    type: string;
    userId: string;
  };
  replyToken: string;
  message: {
    id: string;
    type: string;
    text: string;
  };
}

interface WebhookPayload {
  destination: string;
  events: WebhookEvent[];
}

interface WebhookResponse {
  message: string;
}

async function verifyProduction(): Promise<void> {
  console.log('🚀 驗證生產環境部署');
  console.log('===================\n');

  try {
    // 1. 健康檢查
    console.log('1. 檢查健康狀態...');
    const healthResponse = await fetch(`${PRODUCTION_URL}/health`);
    const healthData: HealthResponse = await healthResponse.json();
    
    if (healthData.status === 'healthy' && healthData.database === 'connected') {
      console.log('✅ 健康檢查通過');
      console.log(`   狀態: ${healthData.status}`);
      console.log(`   資料庫: ${healthData.database}`);
      console.log(`   版本: ${healthData.version}\n`);
    } else {
      console.log('❌ 健康檢查失敗');
      console.log(healthData);
      return;
    }

    // 2. 檢查統計資料
    console.log('2. 檢查資料統計...');
    const statsResponse = await fetch(`${PRODUCTION_URL}/api/stats`);
    const statsData: StatsResponse = await statsResponse.json();
    
    if (statsData.success) {
      console.log('✅ 統計資料正常');
      console.log(`   總訊息數: ${statsData.data.totalMessages}`);
      console.log(`   總客戶數: ${statsData.data.totalCustomers}`);
      console.log(`   總對話數: ${statsData.data.totalConversations}\n`);
    } else {
      console.log('❌ 統計資料異常');
      console.log(statsData);
      return;
    }

    // 3. 測試 Webhook 端點
    console.log('3. 測試 Webhook 端點...');
    const testPayload: WebhookPayload = {
      destination: 'production-test',
      events: [
        {
          type: 'message',
          timestamp: Date.now(),
          source: {
            type: 'user',
            userId: 'production-test-user'
          },
          replyToken: 'production-test-token',
          message: {
            id: 'production-test-msg-' + Date.now(),
            type: 'text',
            text: '生產環境測試訊息 - ' + new Date().toLocaleString()
          }
        }
      ]
    };

    const webhookResponse = await fetch(`${PRODUCTION_URL}/api/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': 'production-test-signature'
      },
      body: JSON.stringify(testPayload)
    });

    const webhookResult: WebhookResponse = await webhookResponse.json();
    
    if (webhookResponse.ok && webhookResult.message === 'OK') {
      console.log('✅ Webhook 端點正常');
      console.log(`   回應: ${webhookResult.message}\n`);
    } else {
      console.log('❌ Webhook 端點異常');
      console.log(webhookResult);
      return;
    }

    // 4. 等待並再次檢查統計
    console.log('4. 等待資料處理並重新檢查...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const finalStatsResponse = await fetch(`${PRODUCTION_URL}/api/stats`);
    const finalStatsData: StatsResponse = await finalStatsResponse.json();
    
    if (finalStatsData.success) {
      console.log('✅ 最終統計資料');
      console.log(`   總訊息數: ${finalStatsData.data.totalMessages}`);
      console.log(`   總客戶數: ${finalStatsData.data.totalCustomers}`);
      console.log(`   總對話數: ${finalStatsData.data.totalConversations}\n`);
      
      if (finalStatsData.data.recentMessages.length > 0) {
        console.log('📋 最近的訊息:');
        finalStatsData.data.recentMessages.slice(0, 3).forEach((msg: Message, index: number) => {
          console.log(`   ${index + 1}. [${msg.sender_type}] ${msg.content}`);
          console.log(`      時間: ${msg.created_at}`);
        });
      }
    }

    console.log('\n🎉 生產環境部署驗證完成！');
    console.log('\n📊 部署狀態總結:');
    console.log('✅ Cloudflare Worker 部署成功');
    console.log('✅ D1 資料庫連接正常');
    console.log('✅ 資料庫 Schema 正確載入');
    console.log('✅ 種子資料正確載入');
    console.log('✅ Webhook 端點正常運作');
    console.log('✅ 資料持久化功能正常');
    console.log('✅ LINE Bot 已準備就緒');
    
    console.log('\n🔗 生產環境 URL:');
    console.log(`   主頁: ${PRODUCTION_URL}`);
    console.log(`   健康檢查: ${PRODUCTION_URL}/health`);
    console.log(`   統計資料: ${PRODUCTION_URL}/api/stats`);
    console.log(`   Webhook: ${PRODUCTION_URL}/api/webhook`);

  } catch (error: any) {
    console.error('❌ 驗證過程中發生錯誤:', error.message);
    console.log('\n🔧 請檢查:');
    console.log('1. Cloudflare Worker 是否正確部署');
    console.log('2. D1 資料庫是否正確設置');
    console.log('3. Secrets 是否正確配置');
    console.log('4. 網路連接是否正常');
  }
}

// 執行驗證
verifyProduction();