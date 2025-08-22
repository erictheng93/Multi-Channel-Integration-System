#!/usr/bin/env node

/**
 * 檔案附件資料庫遷移腳本
 * 專案名稱：Multi-Channel Support MVP
 * 檔案路徑：/database/migrate-file-attachments.ts
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DatabaseConfig {
  name: string;
  id: string;
}

// 讀取 wrangler.toml 獲取資料庫配置
function getDatabaseConfig(): DatabaseConfig {
  const wranglerPath = path.join(__dirname, '..', 'wrangler.toml');
  const wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
  
  // 簡單解析 database_name 和 database_id
  const nameMatch = wranglerContent.match(/database_name\s*=\s*"([^"]+)"/);
  const idMatch = wranglerContent.match(/database_id\s*=\s*"([^"]+)"/);
  
  if (!nameMatch || !idMatch) {
    throw new Error('無法從 wrangler.toml 讀取資料庫配置');
  }
  
  return {
    name: nameMatch[1],
    id: idMatch[1]
  };
}

// 執行資料庫遷移
async function runMigration(): Promise<void> {
  try {
    console.log('🚀 開始執行檔案附件資料庫遷移...');
    
    const dbConfig = getDatabaseConfig();
    console.log(`📊 資料庫: ${dbConfig.name} (${dbConfig.id})`);
    
    // 檢查 SQL 檔案是否存在
    const sqlFile = path.join(__dirname, 'file-attachments-schema.sql');
    if (!fs.existsSync(sqlFile)) {
      throw new Error(`SQL 檔案不存在: ${sqlFile}`);
    }
    
    console.log('📄 執行 SQL 檔案:', sqlFile);
    
    // 執行本地遷移
    console.log('🔧 執行本地資料庫遷移...');
    execSync(`wrangler d1 execute ${dbConfig.name} --local --file=${sqlFile}`, {
      stdio: 'inherit'
    });
    
    console.log('✅ 本地資料庫遷移完成');
    
    // 詢問是否執行生產環境遷移
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('是否要執行生產環境遷移？(y/N): ', (answer: string) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        try {
          console.log('🌐 執行生產環境資料庫遷移...');
          execSync(`wrangler d1 execute ${dbConfig.name} --file=${sqlFile}`, {
            stdio: 'inherit'
          });
          console.log('✅ 生產環境資料庫遷移完成');
        } catch (error: any) {
          console.error('❌ 生產環境遷移失敗:', error.message);
        }
      } else {
        console.log('⏭️  跳過生產環境遷移');
      }
      rl.close();
    });
  } catch (error: any) {
    console.error('❌ 遷移失敗:', error.message);
    process.exit(1);
  }
}

// 驗證遷移結果
async function verifyMigration(): Promise<void> {
  try {
    console.log('🔍 驗證遷移結果...');
    
    const dbConfig = getDatabaseConfig();
    
    // 檢查表是否存在
    const checkTablesSQL = `
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name IN ('file_attachments', 'file_metadata', 'file_access_logs');
    `;
    
    // 創建臨時 SQL 檔案
    const tempSQLFile = path.join(__dirname, 'temp-check.sql');
    fs.writeFileSync(tempSQLFile, checkTablesSQL);
    
    try {
      execSync(`wrangler d1 execute ${dbConfig.name} --local --file=${tempSQLFile}`, {
        stdio: 'inherit'
      });
      console.log('✅ 資料表驗證通過');
    } finally {
      // 清理臨時檔案
      if (fs.existsSync(tempSQLFile)) {
        fs.unlinkSync(tempSQLFile);
      }
    }
  } catch (error: any) {
    console.error('❌ 驗證失敗:', error.message);
  }
}

// 主函數
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes('--verify')) {
    await verifyMigration();
  } else {
    await runMigration();
  }
}

// 執行腳本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { runMigration, verifyMigration };