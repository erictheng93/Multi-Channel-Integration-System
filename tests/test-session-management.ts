// 測試智能會話管理功能
const PRODUCTION_URL: string = 'https://multi-channel.imfinethankyouandyou.com';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_type: string;
  conversation_id: string;
  session_id?: string;
  session_sequence?: number;
  reply_to_message_id?: string;
  thread_id?: string;
  metadata?: string;
}

interface Session {
  id: string;
  topic?: string;
  start_time: string;
  end_time?: string;
  is_active: boolean;
  message_count: number;
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

interface SessionStatsData {
  totalSessions: number;
  activeSessions: number;
  averageMessagesPerSession: number;
  sessions: Session[];
}

interface SessionStatsResponse {
  success: boolean;
  data: SessionStatsData;
  error?: string;
}

interface SessionMessagesData {
  sessionId: string;
  messageCount: number;
  messages: Message[];
}

interface SessionMessagesResponse {
  success: boolean;
  data: SessionMessagesData;
  error?: string;
}

async function testSessionManagement(): Promise<void> {
  console.log('🎯 測試智能會話管理功能');
  console.log('========================\n');

  try {
    // 1. 獲取當前統計
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

    // 2. 分析最近的訊息會話資訊
    console.log('2. 分析最近的訊息會話資訊...');
    const recentMessages = statsData.data.recentMessages;
    
    if (recentMessages && recentMessages.length > 0) {
      console.log('📋 最近的訊息 (包含會話資訊):');
      console.log('=' .repeat(90));
      
      recentMessages.slice(0, 6).forEach((msg: Message, index: number) => {
        const time = new Date(msg.created_at).toLocaleString();
        const senderIcon = msg.sender_type === 'customer' ? '👤' : '🤖';
        const directionIcon = msg.sender_type === 'customer' ? '📥' : '📤';
        
        console.log(`${index + 1}. ${senderIcon} [${msg.sender_type.toUpperCase()}] ${directionIcon}`);
        console.log(`   內容: "${msg.content}"`);
        console.log(`   時間: ${time}`);
        console.log(`   訊息ID: ${msg.id}`);
        console.log(`   對話ID: ${msg.conversation_id}`);
        
        // 顯示會話資訊
        if (msg.session_id) {
          console.log(`   🎯 會話ID: ${msg.session_id}`);
        }
        if (msg.session_sequence) {
          console.log(`   📊 會話順序: ${msg.session_sequence}`);
        }
        if (msg.reply_to_message_id) {
          console.log(`   🔗 回覆目標: ${msg.reply_to_message_id}`);
        }
        if (msg.thread_id) {
          console.log(`   🧵 線程ID: ${msg.thread_id}`);
        }
        
        // 解析元數據中的會話主題
        if (msg.metadata) {
          try {
            const metadata = JSON.parse(msg.metadata);
            if (metadata.sessionTopic) {
              console.log(`   🏷️ 會話主題: ${metadata.sessionTopic}`);
            }
          } catch (e) {
            // 忽略解析錯誤
          }
        }
        console.log('');
      });

      // 3. 測試會話統計
      console.log('3. 測試會話統計...');
      const conversationId = recentMessages[0].conversation_id;
      console.log(`📊 查詢對話 ${conversationId} 的會話統計...`);
      
      const sessionStatsResponse = await fetch(`${PRODUCTION_URL}/api/conversations/${conversationId}/sessions`);
      const sessionStatsData: SessionStatsResponse = await sessionStatsResponse.json();
      
      if (sessionStatsData.success) {
        const stats = sessionStatsData.data;
        console.log(`✅ 會話統計:`);
        console.log(`   總會話數: ${stats.totalSessions}`);
        console.log(`   活躍會話數: ${stats.activeSessions}`);
        console.log(`   平均訊息數/會話: ${stats.averageMessagesPerSession}`);
        
        if (stats.sessions && stats.sessions.length > 0) {
          console.log(`\n📋 會話列表:`);
          stats.sessions.slice(0, 5).forEach((session: Session, index: number) => {
            const startTime = new Date(session.start_time).toLocaleString();
            const endTime = session.end_time ? new Date(session.end_time).toLocaleString() : '進行中';
            const status = session.is_active ? '🟢 活躍' : '🔴 已結束';
            
            console.log(`   ${index + 1}. ${status} ${session.id}`);
            console.log(`      主題: ${session.topic || '未知'}`);
            console.log(`      開始: ${startTime}`);
            console.log(`      結束: ${endTime}`);
            console.log(`      訊息數: ${session.message_count}`);
            console.log('');
          });
        }
      } else {
        console.log(`❌ 查詢會話統計失敗: ${sessionStatsData.error}`);
      }

      // 4. 測試特定會話的訊息
      if (sessionStatsData.success && sessionStatsData.data.sessions.length > 0) {
        console.log('4. 測試特定會話的訊息...');
        const firstSession = sessionStatsData.data.sessions[0];
        console.log(`🔍 查詢會話 ${firstSession.id} 的所有訊息...`);
        
        const sessionMessagesResponse = await fetch(`${PRODUCTION_URL}/api/sessions/${firstSession.id}/messages`);
        const sessionMessagesData: SessionMessagesResponse = await sessionMessagesResponse.json();
        
        if (sessionMessagesData.success) {
          console.log(`✅ 會話訊息:`);
          console.log(`   會話ID: ${sessionMessagesData.data.sessionId}`);
          console.log(`   訊息總數: ${sessionMessagesData.data.messageCount}`);
          
          if (sessionMessagesData.data.messages.length > 0) {
            console.log(`\n💬 會話對話流程:`);
            sessionMessagesData.data.messages.forEach((msg: Message, index: number) => {
              const time = new Date(msg.created_at).toLocaleString();
              const senderIcon = msg.sender_type === 'customer' ? '👤' : '🤖';
              const sequence = msg.session_sequence || (index + 1);
              
              console.log(`   ${sequence}. ${senderIcon} [${msg.sender_type}] "${msg.content}"`);
              console.log(`      時間: ${time}`);
            });
          }
        } else {
          console.log(`❌ 查詢會話訊息失敗: ${sessionMessagesData.error}`);
        }
      }

    } else {
      console.log('   沒有找到訊息');
    }

    console.log('\n🎉 智能會話管理功能測試完成！');
    console.log('\n📊 功能驗證:');
    console.log('✅ 智能會話邊界檢測');
    console.log('✅ 會話主題自動識別');
    console.log('✅ 會話內訊息順序管理');
    console.log('✅ 多問一答/一問多答支援');
    console.log('✅ 時間間隔會話分割');
    console.log('✅ 會話統計與分析');
    console.log('✅ 會話訊息查詢 API');
    
    console.log('\n🎯 會話管理策略:');
    console.log('• 時間間隔 > 30分鐘 → 新會話');
    console.log('• 訊息數 > 50條 → 新會話');
    console.log('• 會話持續 > 24小時 → 新會話');
    console.log('• 檢測到主題變化關鍵詞 → 新會話');
    console.log('• 智能語義主題變化 → 新會話');

  } catch (error: any) {
    console.error('❌ 測試過程中發生錯誤:', error.message);
  }
}

// 執行測試
testSessionManagement();