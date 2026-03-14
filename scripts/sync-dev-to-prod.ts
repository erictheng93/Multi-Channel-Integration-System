/**
 * 數據同步腳本：從開發環境同步到生產環境
 * 警告：這會完全覆蓋生產環境的數據
 */

import fs from 'fs';
import path from 'path';

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

interface DatabaseRow {
  [key: string]: any;
}

interface TableData {
  tableName: string;
  schema: string;
  data: DatabaseRow[];
}

async function executeWranglerCommand(command: string): Promise<any> {
  const { execSync } = await import('child_process');
  try {
    const result = execSync(command, { 
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    // 解析 JSON 輸出
    const lines = result.split('\n');
    const jsonLine = lines.find(line => line.trim().startsWith('[') || line.trim().startsWith('{'));
    
    if (jsonLine) {
      return JSON.parse(jsonLine);
    }
    
    return null;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    console.error(error);
    throw error;
  }
}

async function getTableSchema(tableName: string, env: string = ''): Promise<string> {
  const envFlag = env ? `--env ${env}` : '';
  const command = `wrangler d1 execute DB ${envFlag} --command="SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'"`;
  
  const result = await executeWranglerCommand(command);
  
  if (result && result[0] && result[0].results && result[0].results[0]) {
    return result[0].results[0].sql;
  }
  
  throw new Error(`無法獲取表 ${tableName} 的 schema`);
}

async function getTableData(tableName: string, env: string = ''): Promise<DatabaseRow[]> {
  const envFlag = env ? `--env ${env}` : '';
  const command = `wrangler d1 execute DB ${envFlag} --command="SELECT * FROM ${tableName}"`;
  
  const result = await executeWranglerCommand(command);
  
  if (result && result[0] && result[0].results) {
    return result[0].results;
  }
  
  return [];
}

async function clearTable(tableName: string, env: string = ''): Promise<void> {
  const envFlag = env ? `--env ${env}` : '';
  const command = `wrangler d1 execute DB ${envFlag} --command="DELETE FROM ${tableName}"`;
  
  await executeWranglerCommand(command);
  console.log(` 已清空表: ${tableName}`);
}

async function insertTableData(tableName: string, data: DatabaseRow[], env: string = ''): Promise<void> {
  if (data.length === 0) {
    console.log(` 表 ${tableName} 無數據，跳過插入`);
    return;
  }

  const envFlag = env ? `--env ${env}` : '';
  
  // 獲取第一行數據的鍵來構建 INSERT 語句
  const columns = Object.keys(data[0]);
  const columnsList = columns.join(', ');
  
  // 分批插入數據，避免 SQL 語句過長
  const batchSize = 50;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    const values = batch.map(row => {
      const rowValues = columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) {
          return 'NULL';
        }
        if (typeof value === 'string') {
          return `'${value.replace(/'/g, "''")}'`; // 轉義單引號
        }
        return value;
      });
      return `(${rowValues.join(', ')})`;
    }).join(', ');
    
    const insertSQL = `INSERT INTO ${tableName} (${columnsList}) VALUES ${values}`;
    const command = `wrangler d1 execute DB ${envFlag} --command="${insertSQL}"`;
    
    await executeWranglerCommand(command);
    console.log(` 已插入 ${batch.length} 行到表 ${tableName} (${i + 1}-${i + batch.length}/${data.length})`);
  }
}

async function backupProductionData(): Promise<void> {
  console.log(' 開始備份生產環境數據...');
  
  const backupDir = path.join(process.cwd(), 'database', 'backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `production-backup-${timestamp}.sql`);
  
  let backupSQL = `-- 生產環境數據備份 - ${new Date().toISOString()}\n\n`;
  
  for (const tableName of TABLES_TO_SYNC) {
    try {
      console.log(` 備份表: ${tableName}`);
      
      // 獲取表結構
      const schema = await getTableSchema(tableName, 'production');
      backupSQL += `-- 表: ${tableName}\n${schema};\n\n`;
      
      // 獲取表數據
      const data = await getTableData(tableName, 'production');
      if (data.length > 0) {
        const columns = Object.keys(data[0]);
        const columnsList = columns.join(', ');
        
        for (const row of data) {
          const values = columns.map(col => {
            const value = row[col];
            if (value === null || value === undefined) {
              return 'NULL';
            }
            if (typeof value === 'string') {
              return `'${value.replace(/'/g, "''")}'`;
            }
            return value;
          }).join(', ');
          
          backupSQL += `INSERT INTO ${tableName} (${columnsList}) VALUES (${values});\n`;
        }
        backupSQL += '\n';
      }
    } catch (error) {
      console.warn(` 無法備份表 ${tableName}:`, error);
    }
  }
  
  fs.writeFileSync(backupFile, backupSQL, 'utf8');
  console.log(` 生產環境數據已備份到: ${backupFile}`);
}

async function syncDevToProduction(): Promise<void> {
  console.log(' 開始同步開發環境數據到生產環境...');
  
  // 1. 備份生產環境數據
  await backupProductionData();
  
  // 2. 同步每個表
  for (const tableName of TABLES_TO_SYNC) {
    try {
      console.log(`\n 處理表: ${tableName}`);
      
      // 獲取開發環境數據
      console.log(` 獲取開發環境數據...`);
      const devData = await getTableData(tableName);
      console.log(` 開發環境有 ${devData.length} 條記錄`);
      
      // 清空生產環境表
      console.log(` 清空生產環境表...`);
      await clearTable(tableName, 'production');
      
      // 插入開發環境數據到生產環境
      if (devData.length > 0) {
        console.log(` 插入數據到生產環境...`);
        await insertTableData(tableName, devData, 'production');
      }
      
      console.log(` 表 ${tableName} 同步完成`);
      
    } catch (error) {
      console.error(` 同步表 ${tableName} 失敗:`, error);
      throw error;
    }
  }
  
  console.log('\n 所有數據同步完成！');
}

async function verifySync(): Promise<void> {
  console.log('\n 驗證同步結果...');
  
  for (const tableName of TABLES_TO_SYNC) {
    try {
      const devCount = (await getTableData(tableName)).length;
      const prodCount = (await getTableData(tableName, 'production')).length;
      
      if (devCount === prodCount) {
        console.log(` ${tableName}: ${devCount} 條記錄 (一致)`);
      } else {
        console.log(` ${tableName}: 開發 ${devCount} vs 生產 ${prodCount} (不一致)`);
      }
    } catch (error) {
      console.warn(` 無法驗證表 ${tableName}:`, error);
    }
  }
}

async function main() {
  try {
    console.log(' 開始數據同步任務...');
    console.log(' 警告：這將完全覆蓋生產環境的數據！\n');
    
    await syncDevToProduction();
    await verifySync();
    
    console.log('\n 數據同步任務完成！');
    
  } catch (error) {
    console.error(' 同步過程中出現錯誤:', error);
    process.exit(1);
  }
}

// 直接執行
main();