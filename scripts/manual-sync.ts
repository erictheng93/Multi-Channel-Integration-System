/**
 * 手動數據同步腳本
 * 逐表同步，避免衝突
 */

import { execSync } from 'child_process';

const TABLES_TO_SYNC = [
  'users',
  'conversations', 
  'messages',
  'agents',
  'file_attachments',
  'file_metadata',
  'file_access_logs',
  'teams',
  'pending_messages',
  'message_recall_logs',
  'activities',
  'system_settings',
  'customers'
];

async function clearProductionTables(): Promise<void> {
  console.log('🗑️ 清空生產環境表...');
  
  for (const table of TABLES_TO_SYNC) {
    try {
      execSync(`wrangler d1 execute DB --env production --remote --command="DELETE FROM ${table}"`, {
        cwd: process.cwd(),
        stdio: 'inherit'
      });
      console.log(`✅ 已清空表: ${table}`);
    } catch (error) {
      console.warn(`⚠️ 清空表 ${table} 失敗:`, error);
    }
  }
}

async function syncTableData(tableName: string): Promise<void> {
  console.log(`🔄 同步表: ${tableName}`);
  
  try {
    // 1. 從開發環境獲取數據
    const devData = execSync(`wrangler d1 execute DB --command="SELECT * FROM ${tableName}" --json`, {
      cwd: process.cwd(),
      encoding: 'utf8'
    });
    
    const result = JSON.parse(devData);
    const rows = result[0]?.results || [];
    
    console.log(`📊 開發環境有 ${rows.length} 條記錄`);
    
    if (rows.length === 0) {
      console.log(`⚠️ 表 ${tableName} 無數據，跳過`);
      return;
    }
    
    // 2. 準備插入語句
    const columns = Object.keys(rows[0]);
    const columnsList = columns.join(', ');
    
    // 分批插入，避免 SQL 過長
    const batchSize = 50;
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      const values = batch.map((row: any) => {
        const rowValues = columns.map(col => {
          const value = row[col];
          if (value === null || value === undefined) {
            return 'NULL';
          }
          if (typeof value === 'string') {
            return `'${value.replace(/'/g, "''")}'`;
          }
          return value;
        });
        return `(${rowValues.join(', ')})`;
      }).join(', ');
      
      const insertSQL = `INSERT INTO ${tableName} (${columnsList}) VALUES ${values}`;
      
      execSync(`wrangler d1 execute DB --env production --remote --command="${insertSQL}"`, {
        cwd: process.cwd(),
        stdio: 'inherit'
      });
      
      console.log(`✅ 已插入 ${batch.length} 行到 ${tableName} (${i + 1}-${i + batch.length}/${rows.length})`);
    }
    
  } catch (error) {
    console.error(`❌ 同步表 ${tableName} 失敗:`, error);
    throw error;
  }
}

async function verifySync(): Promise<void> {
  console.log('\n🔍 驗證同步結果...');
  
  for (const tableName of TABLES_TO_SYNC) {
    try {
      const devData = execSync(`wrangler d1 execute DB --command="SELECT COUNT(*) as count FROM ${tableName}" --json`, {
        cwd: process.cwd(),
        encoding: 'utf8'
      });
      
      const prodData = execSync(`wrangler d1 execute DB --env production --remote --command="SELECT COUNT(*) as count FROM ${tableName}" --json`, {
        cwd: process.cwd(),
        encoding: 'utf8'
      });
      
      const devResult = JSON.parse(devData);
      const prodResult = JSON.parse(prodData);
      
      const devCount = devResult[0]?.results[0]?.count || 0;
      const prodCount = prodResult[0]?.results[0]?.count || 0;
      
      if (devCount === prodCount) {
        console.log(`✅ ${tableName}: ${devCount} 條記錄 (一致)`);
      } else {
        console.log(`❌ ${tableName}: 開發 ${devCount} vs 生產 ${prodCount} (不一致)`);
      }
    } catch (error) {
      console.warn(`⚠️ 無法驗證表 ${tableName}:`, error);
    }
  }
}

async function main() {
  try {
    console.log('🚀 開始手動數據同步任務...');
    console.log('⚠️ 警告：這將完全覆蓋生產環境的數據！\n');
    
    // 1. 清空生產環境表
    await clearProductionTables();
    
    console.log('\n🔄 開始同步數據...');
    
    // 2. 逐表同步
    for (const table of TABLES_TO_SYNC) {
      await syncTableData(table);
    }
    
    // 3. 驗證同步結果
    await verifySync();
    
    console.log('\n✨ 數據同步任務完成！');
    
  } catch (error) {
    console.error('💥 同步過程中出現錯誤:', error);
    process.exit(1);
  }
}

main();