// 遷移明文密碼到加密存儲
import { encryptPassword } from '../src/utils/encryption'

interface Agent {
  id: string
  username: string
  password_plaintext: string
}

export async function migratePasswords(db: any, env: any) {
  try {
    console.log('🔄 Starting password migration...')
    
    // 獲取所有有明文密碼的用戶
    const agents = await db
      .prepare('SELECT id, username, password_plaintext FROM agents WHERE password_plaintext IS NOT NULL AND password_plaintext != "null"')
      .all<Agent>()

    console.log(`📋 Found ${agents.results.length} users with plaintext passwords`)

    for (const agent of agents.results) {
      try {
        console.log(`🔐 Encrypting password for user: ${agent.username}`)
        
        // 加密明文密碼
        const encryptedPassword = await encryptPassword(agent.password_plaintext, env)
        
        // 更新數據庫：設定加密密碼，清除明文密碼
        await db
          .prepare('UPDATE agents SET password_encrypted = ?, password_plaintext = NULL WHERE id = ?')
          .bind(encryptedPassword, agent.id)
          .run()
        
        console.log(`✅ Successfully migrated password for: ${agent.username}`)
      } catch (error) {
        console.error(`❌ Failed to migrate password for ${agent.username}:`, error)
      }
    }

    console.log('🎉 Password migration completed!')
    
    // 驗證遷移結果
    const remaining = await db
      .prepare('SELECT COUNT(*) as count FROM agents WHERE password_plaintext IS NOT NULL AND password_plaintext != "null"')
      .first<{ count: number }>()
    
    console.log(`📊 Remaining plaintext passwords: ${remaining.count}`)
    
  } catch (error) {
    console.error('💥 Migration failed:', error)
    throw error
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  console.log('❌ This script should be called with proper database and environment context')
  console.log('Use: wrangler dev and call migration endpoint instead')
}