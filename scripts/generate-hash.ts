#!/usr/bin/env tsx

import { generateHashCLI, generateMultipleHashesCLI } from '../src/utils/password-hash.ts';

/**
 * CLI script for generating password hashes
 * Usage:
 *   npm run hash                    # Generate hash for default password
 *   npm run hash mypassword         # Generate hash for specific password
 *   npm run hash:batch              # Generate hashes for multiple passwords
 *   
 * 環境變數支援:
 *   ADMIN_PASSWORD=your-password npm run hash:batch
 *   AGENT_PASSWORD=your-password npm run hash:batch
 */

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'batch') {
    // 根據你的實際系統用戶生成雜湊
    // 從環境變數或使用預設值
    const adminPassword = process.env.ADMIN_PASSWORD || 'CHANGE-THIS-ADMIN-PASSWORD';
    const testAgentPassword = process.env.TEST_AGENT_PASSWORD || 'CHANGE-THIS-TEST-AGENT-PASSWORD';
    const agent1Password = process.env.AGENT1_PASSWORD || 'CHANGE-THIS-AGENT1-PASSWORD';
    const agent2Password = process.env.AGENT2_PASSWORD || 'CHANGE-THIS-AGENT2-PASSWORD';
    const agent3Password = process.env.AGENT3_PASSWORD || 'CHANGE-THIS-AGENT3-PASSWORD';
    
    const passwords = [
      { name: 'admin-001 (System Administrator)', password: adminPassword },
      { name: 'agent-001 (Test Agent)', password: testAgentPassword },
      { name: 'agent-002 (Agent 1)', password: agent1Password },
      { name: 'agent-003 (Agent 2)', password: agent2Password },
      { name: 'agent-004 (Agent 3)', password: agent3Password },
    ];

    console.log('🔐 為你的實際系統用戶生成密碼雜湊');
    console.log('⚠️  請先設定環境變數或修改腳本中的密碼');
    console.log('💡 範例：ADMIN_PASSWORD=your-secure-password npm run hash:batch');
    console.log('');
    
    const results = await generateMultipleHashesCLI(passwords);

    results.forEach(({ name, password, hash }) => {
      console.log(`${name}:`);
      console.log(`  Password: ${password}`);
      console.log(`  Hash: ${hash}`);
      console.log('');
    });
    
    console.log('📝 使用這些雜湊更新資料庫：');
    console.log('   UPDATE agents SET password_hash = "hash-value" WHERE id = "user-id";');
  } else {
    // Single password generation
    const password = command || undefined;
    await generateHashCLI(password);
  }
}

main().catch(console.error);