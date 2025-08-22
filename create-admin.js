#!/usr/bin/env node
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';

// 創建管理員用戶的腳本
async function createAdmin() {
  const email = 'admin@dacit.net';
  const password = '16011587DaC';
  const username = 'admin';
  const displayName = 'System Administrator';
  
  try {
    // 生成正確的密碼哈希
    const passwordHash = await bcrypt.hash(password, 12);
    
    console.log('Password:', password);
    console.log('Hash:', passwordHash);
    
    // 驗證哈希
    const isValid = await bcrypt.compare(password, passwordHash);
    console.log('Hash verification:', isValid);
    
    // 生成 SQL 語句
    const sql = `DELETE FROM agents WHERE email = '${email}';
INSERT INTO agents (id, username, email, password_hash, display_name, role, is_active, created_at, updated_at) 
VALUES ('admin-001', '${username}', '${email}', '${passwordHash}', '${displayName}', 'admin', 1, datetime('now'), datetime('now'));`;
    
    console.log('SQL to execute:');
    console.log(sql);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createAdmin();