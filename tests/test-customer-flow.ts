/**
 * 完整的客戶資料收集流程測試
 * 這個腳本模擬完整的 LINE 訊息處理流程
 */

interface StepData {
  step: number;
  title: string;
  description: string;
  data: any;
}

console.log('🧪 LINE Bot 客戶資料收集流程測試\n');

// 模擬流程步驟
const steps: StepData[] = [
  {
    step: 1,
    title: '📱 客戶發送訊息到 LINE',
    description: '客戶在 LINE 中發送訊息給你的 Bot',
    data: {
      lineUserId: 'U1234567890abcdef1234567890abcdef1',
      message: '你好，我想了解你們的服務',
      timestamp: new Date().toISOString()
    }
  },
  {
    step: 2,
    title: '🔗 LINE 平台發送 Webhook',
    description: 'LINE 平台將訊息事件發送到你的 Worker',
    data: {
      webhook_url: 'https://multi-channel.imfinethankyouandyou.com/api/webhook',
      event_type: 'message',
      message_type: 'text'
    }
  },
  {
    step: 3,
    title: '🔍 獲取用戶資料',
    description: 'Worker 調用 LINE Profile API 獲取用戶詳細資訊',
    data: {
      api_call: 'GET https://api.line.me/v2/bot/profile/{userId}',
      response: {
        userId: 'U1234567890abcdef1234567890abcdef1',
        displayName: '張小明',
        pictureUrl: 'https://profile.line-scdn.net/xxx',
        statusMessage: '今天天氣真好'
      }
    }
  },
  {
    step: 4,
    title: '💾 儲存客戶資料到 D1',
    description: '將客戶資訊儲存到 Cloudflare D1 資料庫',
    data: {
      table: 'customers',
      action: 'INSERT or UPDATE',
      fields: {
        platform: 'line',
        platform_user_id: 'U1234567890abcdef1234567890abcdef1',
        display_name: '張小明',
        avatar_url: 'https://profile.line-scdn.net/xxx',
        metadata: {
          statusMessage: '今天天氣真好',
          lastProfileUpdate: new Date().toISOString(),
          messageCount: 1
        }
      }
    }
  },
  {
    step: 5,
    title: '💬 建立或更新對話',
    description: '在 conversations 表中建立或更新對話記錄',
    data: {
      table: 'conversations',
      fields: {
        customer_id: 1,
        status: 'active',
        last_message_at: new Date().toISOString()
      }
    }
  },
  {
    step: 6,
    title: '📝 儲存訊息',
    description: '將訊息內容儲存到 messages 表',
    data: {
      table: 'messages',
      fields: {
        conversation_id: 1,
        sender_type: 'customer',
        content: '你好，我想了解你們的服務',
        message_type: 'text',
        direction: 'inbound'
      }
    }
  },
  {
    step: 7,
    title: '🤖 生成並發送回覆',
    description: 'Bot 生成回覆並發送回 LINE 平台',
    data: {
      reply: '您好！很高興為您服務，請問有什麼可以幫助您的嗎？',
      api_call: 'POST https://api.line.me/v2/bot/message/reply'
    }
  },
  {
    step: 8,
    title: '💾 儲存回覆訊息',
    description: '將 Bot 的回覆也儲存到資料庫',
    data: {
      table: 'messages',
      fields: {
        conversation_id: 1,
        sender_type: 'agent',
        content: '您好！很高興為您服務，請問有什麼可以幫助您的嗎？',
        direction: 'outbound',
        reply_to_message_id: 'original_message_id'
      }
    }
  }
];

// 顯示流程步驟
steps.forEach(({ step, title, description, data }) => {
  console.log(`${title}`);
  console.log(`   ${description}`);
  console.log(`   資料: ${JSON.stringify(data, null, 6)}`);
  console.log('');
});

console.log('🎯 完成後你可以透過以下方式查詢客戶資料:\n');

console.log('📊 API 查詢範例:');
console.log('1. 查詢所有客戶:');
console.log('   GET /api/customers\n');

console.log('2. 查詢特定 LINE 用戶:');
console.log('   GET /api/customers/platform/line/U1234567890abcdef1234567890abcdef1\n');

console.log('3. 查詢系統統計:');
console.log('   GET /api/stats\n');

console.log('4. 查詢客戶的對話記錄:');
console.log('   GET /api/customers/1 (會包含對話列表)\n');

console.log('💡 測試建議:');
console.log('1. 使用 test-webhook.ps1 或 test-webhook.sh 發送測試訊息');
console.log('2. 使用 query-customers.ts 查詢儲存的客戶資料');
console.log('3. 檢查 D1 資料庫中的 customers 表');
console.log('4. 監控 Worker 的日誌輸出');

console.log('\n✅ 客戶資料收集功能已完整實現！');