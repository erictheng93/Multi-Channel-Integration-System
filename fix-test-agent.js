#!/usr/bin/env node
import bcrypt from 'bcryptjs';

// 為測試客服創建正確的密碼哈希
async function createTestAgent() {
  const email = 'test@dacit.net';
  const password = '16011587@test';
  const username = 'test';
  const displayName = 'Test Agent';
  
  try {
    // 生成正確的密碼哈希
    const passwordHash = await bcrypt.hash(password, 12);
    
    console.log('Test Agent Details:');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Hash:', passwordHash);
    
    // 驗證哈希
    const isValid = await bcrypt.compare(password, passwordHash);
    console.log('Hash verification:', isValid);
    
    // 生成 SQL 語句來更新數據庫
    const sql = `UPDATE agents 
SET password_hash = '${passwordHash}', 
    username = '${username}',
    display_name = '${displayName}',
    is_active = 1,
    updated_at = datetime('now')
WHERE email = '${email}';`;
    
    console.log('\nSQL to execute:');
    console.log(sql);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createTestAgent();