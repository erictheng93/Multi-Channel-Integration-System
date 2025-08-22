// 檢查最近的訊息
const PRODUCTION_URL: string = 'https://multi-channel.imfinethankyouandyou.com';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_type: string;
  platform?: string;
  conversation_id: string;
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

async function checkRecentMessages(): Promise<void> {
  try {
    console.log('📋 檢查最近的 LINE 訊息');
    console.log('========================\n');

    const response = await fetch(`${PRODUCTION_URL}/api/stats`);
    const data: StatsResponse = await response.json();

    if (!data.success) {
      console.log('❌ 獲取資料失敗');
      return;
    }

    const stats: StatsData = data.data;
    
    console.log('📊 當前統計:');
    console.log(`   總訊息數: ${stats.totalMessages}`);
    console.log(`   總客戶數: ${stats.totalCustomers}`);
    console.log(`   總對話數: ${stats.totalConversations}\n`);

    console.log('💬 最近的訊息 (按時間排序):');
    console.log('=' .repeat(60));

    if (stats.recentMessages && stats.recentMessages.length > 0) {
      stats.recentMessages.forEach((msg: Message, index: number) => {
        const time = new Date(msg.created_at).toLocaleString();
        const senderIcon = msg.sender_type === 'customer' ? '👤' : '🤖';
        const directionIcon = msg.sender_type === 'customer' ? '📥' : '📤';
        
        console.log(`${index + 1}. ${senderIcon} [${msg.sender_type.toUpperCase()}] ${directionIcon}`);
        console.log(`   內容: "${msg.content}"`);
        console.log(`   時間: ${time}`);
        console.log(`   平台: ${msg.platform || 'N/A'}`);
        console.log(`   訊息ID: ${msg.id}`);
        console.log(`   對話ID: ${msg.conversation_id}`);
        console.log('');
      });
    } else {
      console.log('   沒有找到訊息');
    }

    // 檢查是否有回覆訊息
    const customerMessages = stats.recentMessages.filter(msg => msg.sender_type === 'customer');
    const agentMessages = stats.recentMessages.filter(msg => msg.sender_type === 'agent');
    
    console.log('📈 訊息類型統計:');
    console.log(`   客戶訊息: ${customerMessages.length}`);
    console.log(`   系統回覆: ${agentMessages.length}`);
    
    if (agentMessages.length === 0) {
      console.log('\n⚠️  注意: 沒有檢測到系統回覆訊息');
      console.log('   可能的原因:');
      console.log('   1. Reply Token 已過期 (LINE Reply Token 只能使用一次)');
      console.log('   2. 簽名驗證失敗');
      console.log('   3. LINE API 呼叫失敗');
    } else {
      console.log('\n✅ 系統正常回覆訊息');
    }

  } catch (error: any) {
    console.error('❌ 檢查訊息時發生錯誤:', error.message);
  }
}

// 執行檢查
checkRecentMessages();