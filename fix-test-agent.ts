#!/usr/bin/env node
import bcrypt from 'bcryptjs'

interface AgentDetails {
  email: string
  password: string
  username: string
  displayName: string
}

// 為測試客服創建正確的密碼哈希
async function createTestAgent(): Promise<void> {
  const agentDetails: AgentDetails = {
    email: 'test@dacit.net',
    password: '16011587@test',
    username: 'test',
    displayName: 'Test Agent'
  }
  
  try {
    // 生成正確的密碼哈希
    const passwordHash: string = await bcrypt.hash(agentDetails.password, 12)
    
    console.log('Test Agent Details:')
    console.log('Email:', agentDetails.email)
    console.log('Password:', agentDetails.password)
    console.log('Hash:', passwordHash)
    
    // 驗證哈希
    const isValid: boolean = await bcrypt.compare(agentDetails.password, passwordHash)
    console.log('Hash verification:', isValid)
    
    // 生成 SQL 語句來更新數據庫
    const sql = `UPDATE agents 
SET password_hash = '${passwordHash}', 
    username = '${agentDetails.username}',
    display_name = '${agentDetails.displayName}',
    is_active = 1,
    updated_at = datetime('now')
WHERE email = '${agentDetails.email}';`
    
    console.log('\nSQL to execute:')
    console.log(sql)
    
  } catch (error: unknown) {
    console.error('Error:', error instanceof Error ? error.message : String(error))
  }
}

createTestAgent()