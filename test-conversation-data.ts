// 測試對話數據腳本
import { execSync } from 'child_process'

const TEST_CONVERSATION_SQL = `
INSERT OR REPLACE INTO customers (id, display_name, platform, platform_user_id, avatar_url, created_at, updated_at) 
VALUES 
  ('customer-001', '測試用戶1', 'line', 'line-user-001', 'https://example.com/avatar1.jpg', datetime('now'), datetime('now')),
  ('customer-002', '測試用戶2', 'facebook', 'fb-user-002', 'https://example.com/avatar2.jpg', datetime('now'), datetime('now'));

INSERT OR REPLACE INTO conversations (id, customer_id, status, priority, created_at, updated_at, last_message_at) 
VALUES 
  ('conv-001', 'customer-001', 'active', 'normal', datetime('now', '-2 hours'), datetime('now'), datetime('now', '-1 hour')),
  ('conv-002', 'customer-002', 'pending', 'high', datetime('now', '-1 hour'), datetime('now'), datetime('now', '-30 minutes'));

INSERT OR REPLACE INTO messages (id, conversation_id, sender_type, sender_id, content, message_type, platform, created_at) 
VALUES 
  ('msg-001', 'conv-001', 'customer', 'customer-001', '你好，我需要幫助', 'text', 'line', datetime('now', '-2 hours')),
  ('msg-002', 'conv-001', 'agent', 'admin-001', '您好！我是客服，請問有什麼可以幫助您的？', 'text', 'line', datetime('now', '-1 hour')),
  ('msg-003', 'conv-002', 'customer', 'customer-002', 'I have a problem with my order', 'text', 'facebook', datetime('now', '-30 minutes'));
`;

async function createTestData() {
  try {
    console.log('🔧 正在創建測試對話數據...')
    
    // 使用 wrangler d1 execute 來執行 SQL
    execSync(`wrangler d1 execute d1-multi-channel --command "${TEST_CONVERSATION_SQL}"`, { 
      stdio: 'inherit' 
    })
    
    console.log('✅ 測試數據創建成功!')
    
    // 檢查數據是否創建成功
    console.log('\n📊 檢查創建的數據:')
    
    const checkSql = 'SELECT COUNT(*) as count FROM conversations;'
    execSync(`wrangler d1 execute d1-multi-channel --command "${checkSql}"`, { 
      stdio: 'inherit' 
    })
    
  } catch (error) {
    console.error('❌ 創建測試數據失敗:', error)
  }
}

// 檢查現有數據
async function checkExistingData() {
  try {
    console.log('🔍 檢查現有數據...')
    
    const queries = [
      'SELECT COUNT(*) as customer_count FROM customers;',
      'SELECT COUNT(*) as conversation_count FROM conversations;', 
      'SELECT COUNT(*) as message_count FROM messages;',
      'SELECT * FROM conversations LIMIT 5;'
    ]
    
    for (const query of queries) {
      console.log(`\n查詢: ${query}`)
      execSync(`wrangler d1 execute d1-multi-channel --command "${query}"`, { 
        stdio: 'inherit' 
      })
    }
    
  } catch (error) {
    console.error('❌ 檢查數據失敗:', error)
  }
}

// 主函數
async function main() {
  const action = process.argv[2] || 'check'
  
  if (action === 'create') {
    await createTestData()
  } else if (action === 'check') {
    await checkExistingData()
  } else {
    console.log('用法:')
    console.log('  npx tsx test-conversation-data.ts check   # 檢查現有數據')
    console.log('  npx tsx test-conversation-data.ts create  # 創建測試數據')
  }
}

main().catch(console.error)