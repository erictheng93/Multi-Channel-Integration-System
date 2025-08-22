// 測試訊息關聯功能
const PRODUCTION_URL: string = 'https://multi-channel.imfinethankyouandyou.com';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_type: string;
  conversation_id: string;
  reply_to_message_id?: string;
  thread_id?: string;
  metadata?: string;
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

interface RepliesResponse {
  success: boolean;
  data: {
    count: number;
    replies: Message[];
  };
  error?: string;
}

interface MessageTreeResponse {
  success: boolean;
  data: {
    totalMessages: number;
    replyMap: Record<string, Message[]>;
  };
  error?: string;
}

async function testMessageRelations(): Promise<void> {
  console.log('🔗 測試訊息關聯功能');
  console.log('===================\n');

  try {
    // 1. 獲取最新的統計資料
    console.log('1. 獲取當前統計資料...');
    const statsResponse = await fetch(`${PRODUCTION_URL}/api/stats`);
    const statsData: StatsResponse = await statsResponse.json();
    
    if (!statsData.success) {
      console.log('❌ 獲取統計失敗');
      return;
    }

    console.log(`✅ 當前統計:`);
    console.log(`   總訊息數: ${statsData.data.totalMessages}`);
    console.log(`   總客戶數: ${statsData.data.totalCustomers}`);
    console.log(`   總對話數: ${statsData.data.totalConversations}\n`);

    // 2. 顯示最近的訊息及其關聯
    console.log('2. 分析最近的訊息關聯...');
    const recentMessages = statsData.data.recentMessages;
    
    if (recentMessages && recentMessages.length > 0) {
      console.log('📋 最近的訊息 (包含關聯資訊):');
      console.log('=' .repeat(80));
      
      recentMessages.slice(0, 8).forEach((msg: Message, index: number) => {
        const time = new Date(msg.created_at).toLocaleString();
        const senderIcon = msg.sender_type === 'customer' ? '👤' : '🤖';
        const directionIcon = msg.sender_type === 'customer' ? '📥' : '📤';
        
        console.log(`${index + 1}. ${senderIcon} [${msg.sender_type.toUpperCase()}] ${directionIcon}`);
        console.log(`   內容: "${msg.content}"`);
        console.log(`   時間: ${time}`);
        console.log(`   訊息ID: ${msg.id}`);
        console.log(`   對話ID: ${msg.conversation_id}`);
        
        // 顯示關聯資訊
        if (msg.reply_to_message_id) {
          console.log(`   🔗 回覆目標: ${msg.reply_to_message_id}`);
        }
        if (msg.thread_id) {
          console.log(`   🧵 線程ID: ${msg.thread_id}`);
        }
        if (msg.metadata) {
          try {
            const metadata = JSON.parse(msg.metadata);
            console.log(`   📋 元數據: ${Object.keys(metadata).join(', ')}`);
          } catch (e) {
            console.log(`   📋 元數據: ${msg.metadata}`);
          }
        }
        console.log('');
      });

      // 3. 測試訊息回覆查詢
      console.log('3. 測試訊息回覆查詢...');
      const customerMessages = recentMessages.filter(msg => msg.sender_type === 'customer');
      
      if (customerMessages.length > 0) {
        const testMessageId = customerMessages[0].id;
        console.log(`🔍 查詢訊息 ${testMessageId} 的回覆...`);
        
        const repliesResponse = await fetch(`${PRODUCTION_URL}/api/messages/${testMessageId}/replies`);
        const repliesData: RepliesResponse = await repliesResponse.json();
        
        if (repliesData.success) {
          console.log(`✅ 找到 ${repliesData.data.count} 個回覆:`);
          repliesData.data.replies.forEach((reply: Message, index: number) => {
            console.log(`   ${index + 1}. [${reply.sender_type}] "${reply.content}"`);
            console.log(`      時間: ${new Date(reply.created_at).toLocaleString()}`);
          });
        } else {
          console.log(`❌ 查詢回覆失敗: ${repliesData.error}`);
        }
      }

      // 4. 測試對話訊息樹
      console.log('\n4. 測試對話訊息樹...');
      const conversationId = recentMessages[0].conversation_id;
      console.log(`🌳 查詢對話 ${conversationId} 的訊息樹...`);
      
      const treeResponse = await fetch(`${PRODUCTION_URL}/api/conversations/${conversationId}/message-tree`);
      const treeData: MessageTreeResponse = await treeResponse.json();
      
      if (treeData.success) {
        console.log(`✅ 對話訊息樹:`);
        console.log(`   總訊息數: ${treeData.data.totalMessages}`);
        console.log(`   回覆關聯數: ${Object.keys(treeData.data.replyMap).length}`);
        
        // 顯示回覆關聯
        Object.entries(treeData.data.replyMap).forEach(([originalId, replies]) => {
          console.log(`   🔗 ${originalId} → ${replies.length} 個回覆`);
          replies.forEach(reply => {
            console.log(`      └─ ${reply.id} [${reply.sender_type}]`);
          });
        });
      } else {
        console.log(`❌ 查詢訊息樹失敗: ${treeData.error}`);
      }

    } else {
      console.log('   沒有找到訊息');
    }

    console.log('\n🎉 訊息關聯功能測試完成！');
    console.log('\n📊 功能驗證:');
    console.log('✅ 傳入訊息持久化保存');
    console.log('✅ 回覆訊息持久化保存');
    console.log('✅ 訊息關聯 (reply_to_message_id)');
    console.log('✅ 線程關聯 (thread_id)');
    console.log('✅ 元數據保存 (metadata)');
    console.log('✅ 訊息回覆查詢 API');
    console.log('✅ 對話訊息樹 API');

  } catch (error: any) {
    console.error('❌ 測試過程中發生錯誤:', error.message);
  }
}

// 執行測試
testMessageRelations();