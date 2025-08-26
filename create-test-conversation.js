// 創建測試對話和訊息的腳本
const API_BASE = 'http://127.0.0.1:8787';

// 登入獲取 token
async function login() {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'test@dacit.net',
      password: '16011587'
    }),
  });
  
  const result = await response.json();
  if (result.success) {
    console.log('✅ 登入成功:', result.data.agent.name);
    return result.data.token;
  } else {
    console.error('❌ 登入失敗:', result.error);
    return null;
  }
}

// 直接在資料庫創建測試數據
async function createTestData() {
  console.log('🔨 創建測試對話和訊息...');
  
  const token = await login();
  if (!token) return;

  // 1. 創建客戶
  const customerSQL = `
    INSERT OR REPLACE INTO users (
      id, display_name, platform, platform_user_id, 
      created_at, updated_at
    ) VALUES (
      'customer-line-001',
      '測試 LINE 用戶', 
      'line', 
      'U1234567890abcdef',
      datetime('now'),
      datetime('now')
    );
  `;

  // 2. 創建對話
  const conversationSQL = `
    INSERT OR REPLACE INTO conversations (
      id, customer_id, status, platform, 
      created_at, updated_at
    ) VALUES (
      'conv-001',
      'customer-line-001',
      'open',
      'line',
      datetime('now'),
      datetime('now')
    );
  `;

  // 3. 創建訊息
  const messageSQL = `
    INSERT OR REPLACE INTO messages (
      id, conversation_id, sender_type, sender_id, 
      content, message_type, platform_message_id,
      direction, thread_id, created_at, updated_at
    ) VALUES 
    (
      'msg-001',
      'conv-001',
      'customer',
      'customer-line-001',
      '你好，我需要幫助！',
      'text',
      'line-msg-001',
      'inbound',
      'thread_conv-001_1756113600000',
      datetime('now', '-5 minutes'),
      datetime('now', '-5 minutes')
    ),
    (
      'msg-002',
      'conv-001',
      'customer',
      'customer-line-001',
      '請問你們的服務時間是？',
      'text',
      'line-msg-002',
      'inbound',
      'thread_conv-001_1756113600000',
      datetime('now', '-3 minutes'),
      datetime('now', '-3 minutes')
    ),
    (
      'msg-003',
      'conv-001',
      'agent',
      'test-agent-001',
      '您好！我們的服務時間是週一到週五 9:00-18:00',
      'text',
      'agent-reply-001',
      'outbound',
      'thread_conv-001_1756113600000',
      datetime('now', '-1 minute'),
      datetime('now', '-1 minute')
    );
  `;

  try {
    // 執行 SQL
    console.log('📝 插入客戶資料...');
    await executeSQL(customerSQL);
    
    console.log('💬 插入對話資料...');
    await executeSQL(conversationSQL);
    
    console.log('📨 插入訊息資料...');
    await executeSQL(messageSQL);
    
    console.log('✅ 測試資料創建完成！');
    
    // 驗證資料
    console.log('🔍 驗證資料...');
    const conversations = await fetch(`${API_BASE}/api/conversations`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const convResult = await conversations.json();
    console.log('對話數量:', convResult.data?.length || 0);
    
    if (convResult.data && convResult.data.length > 0) {
      console.log('✅ 成功！現在你可以在前端看到對話了');
      console.log('🌐 訪問: http://localhost:3002/conversations');
    }
    
  } catch (error) {
    console.error('❌ 創建測試資料失敗:', error);
  }
}

async function executeSQL(sql) {
  const response = await fetch('http://127.0.0.1:8787/api/system/execute-sql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });
  
  if (!response.ok) {
    // 如果沒有直接 SQL API，使用 wrangler
    console.log('使用 wrangler 執行 SQL...');
    const { spawn } = require('child_process');
    const process = spawn('wrangler', ['d1', 'execute', 'multi-channel-platform-dev', '--local', '--command', sql]);
    
    return new Promise((resolve, reject) => {
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`wrangler process exited with code ${code}`));
        }
      });
    });
  }
  
  return response.json();
}

// 執行
createTestData().catch(console.error);