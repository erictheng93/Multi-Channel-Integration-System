#!/usr/bin/env node
import bcrypt from 'bcryptjs'

interface AdminDetails {
  email: string
  password: string
  displayName: string
}

// 創建管理員用戶的腳本
async function createAdmin(): Promise<void> {
  const password = process.env.ADMIN_PASSWORD
  if (!password) throw new Error('ADMIN_PASSWORD env var is required')

  const adminDetails: AdminDetails = {
    email: 'admin@dacit.net',
    password,
    displayName: 'System Administrator'
  }

  try {
    // 生成正確的密碼哈希
    const passwordHash: string = await bcrypt.hash(adminDetails.password, 12)

    console.log('Hash:', passwordHash)
    
    // 驗證哈希
    const isValid: boolean = await bcrypt.compare(adminDetails.password, passwordHash)
    console.log('Hash verification:', isValid)
    
    // 生成 SQL 語句
    const sql = `DELETE FROM agents WHERE email = '${adminDetails.email}';
INSERT INTO agents (id, email, password_hash, display_name, role, is_active, created_at, updated_at) 
VALUES ('admin-001', '${adminDetails.email}', '${passwordHash}', '${adminDetails.displayName}', 'admin', 1, datetime('now'), datetime('now'));`
    
    console.log('SQL to execute:')
    console.log(sql)
    
  } catch (error: unknown) {
    console.error('Error:', error instanceof Error ? error.message : String(error))
  }
}

createAdmin()