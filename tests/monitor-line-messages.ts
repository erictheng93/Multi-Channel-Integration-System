// 即時監控 LINE 訊息處理
const PRODUCTION_URL: string = 'https://multi-channel.imfinethankyouandyou.com';

let lastMessageCount: number = 0;
let lastCustomerCount: number = 0;
let lastConversationCount: number = 0;

interface Message {
  sender_type: string;
  content: string;
  created_at: string;
  platform?: string;
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

async function getStats(): Promise<StatsData | null> {
  try {
    const response = await fetch(`${PRODUCTION_URL}/api/stats`);
    const data: StatsResponse = await response.json();
    return data.success ? data.data : null;
  } catch (error: any) {
    console.error('獲取統計失敗:', error.message);
    return null;
  }
}

async function monitorMessages(): Promise<void> {
  console.log('🔍 開始監控 LINE 訊息處理');
  console.log('============================');
  console.log('📱 請在你的手機上發送 "Hello World" 給 LINE Bot');
  console.log('⏰ 監控中... (按 Ctrl+C 停止)\n');

  // 獲取初始狀態
  const initialStats = await getStats();
  if (initialStats) {
    lastMessageCount = initialStats.totalMessages;
    lastCustomerCount = initialStats.totalCustomers;
    lastConversationCount = initialStats.totalConversations;
    
    console.log('📊 初始狀態:');
    console.log(`   總訊息數: ${lastMessageCount}`);
    console.log(`   總客戶數: ${lastCustomerCount}`);
    console.log(`   總對話數: ${lastConversationCount}\n`);
  }

  // 開始監控
  const interval = setInterval(async () => {
    const currentStats = await getStats();
    
    if (!currentStats) {
      return;
    }

    // 檢查是否有新的變化
    const messageChanged = currentStats.totalMessages !== lastMessageCount;
    const customerChanged = currentStats.totalCustomers !== lastCustomerCount;
    const conversationChanged = currentStats.totalConversations !== lastConversationCount;

    if (messageChanged || customerChanged || conversationChanged) {
      const timestamp = new Date().toLocaleString();
      console.log(`🔔 [${timestamp}] 檢測到變化:`);
      
      if (messageChanged) {
        const newMessages = currentStats.totalMessages - lastMessageCount;
        console.log(`   📨 新訊息: +${newMessages} (總計: ${currentStats.totalMessages})`);
        lastMessageCount = currentStats.totalMessages;
      }
      
      if (customerChanged) {
        const newCustomers = currentStats.totalCustomers - lastCustomerCount;
        console.log(`   👤 新客戶: +${newCustomers} (總計: ${currentStats.totalCustomers})`);
        lastCustomerCount = currentStats.totalCustomers;
      }
      
      if (conversationChanged) {
        const newConversations = currentStats.totalConversations - lastConversationCount;
        console.log(`   💬 新對話: +${newConversations} (總計: ${currentStats.totalConversations})`);
        lastConversationCount = currentStats.totalConversations;
      }

      // 顯示最新的訊息
      if (currentStats.recentMessages && currentStats.recentMessages.length > 0) {
        console.log('\n📋 最新訊息:');
        currentStats.recentMessages.slice(0, 3).forEach((msg: Message, index: number) => {
          const time = new Date(msg.created_at).toLocaleString();
          console.log(`   ${index + 1}. [${msg.sender_type}] ${msg.content}`);
          console.log(`      時間: ${time}`);
          console.log(`      平台: ${msg.platform || 'N/A'}`);
        });
      }
      
      console.log('\n' + '='.repeat(50) + '\n');
    } else {
      // 顯示等待狀態
      process.stdout.write('.');
    }
  }, 2000); // 每2秒檢查一次

  // 處理 Ctrl+C
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n\n🛑 監控已停止');
    console.log('📊 最終統計:');
    console.log(`   總訊息數: ${lastMessageCount}`);
    console.log(`   總客戶數: ${lastCustomerCount}`);
    console.log(`   總對話數: ${lastConversationCount}`);
    process.exit(0);
  });
}

// 開始監控
monitorMessages();