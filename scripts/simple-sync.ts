/**
 * 簡化的數據同步腳本
 * 使用 SQL 導出/導入方式
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const BACKUP_DIR = path.join(process.cwd(), 'database', 'backup');

// 確保備份目錄存在
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

async function exportDevData(): Promise<string> {
  console.log(' 導出開發環境數據...');
  
  const exportFile = path.join(BACKUP_DIR, `dev-export-${timestamp}.sql`);
  
  try {
    execSync(`wrangler d1 export DB --output="${exportFile}"`, {
      cwd: process.cwd(),
      stdio: 'inherit'
    });
    
    console.log(` 開發環境數據已導出到: ${exportFile}`);
    return exportFile;
  } catch (error) {
    console.error(' 導出開發環境數據失敗:', error);
    throw error;
  }
}

async function backupProdData(): Promise<void> {
  console.log(' 備份生產環境數據...');
  
  const backupFile = path.join(BACKUP_DIR, `production-backup-${timestamp}.sql`);
  
  try {
    execSync(`wrangler d1 export DB --env production --output="${backupFile}"`, {
      cwd: process.cwd(),
      stdio: 'inherit'
    });
    
    console.log(` 生產環境數據已備份到: ${backupFile}`);
  } catch (error) {
    console.error(' 備份生產環境數據失敗:', error);
    throw error;
  }
}

async function importToProd(exportFile: string): Promise<void> {
  console.log(' 導入開發環境數據到生產環境...');
  
  if (!fs.existsSync(exportFile)) {
    throw new Error(`導出文件不存在: ${exportFile}`);
  }
  
  try {
    execSync(`wrangler d1 execute DB --env production --file="${exportFile}"`, {
      cwd: process.cwd(),
      stdio: 'inherit'
    });
    
    console.log(' 數據導入完成');
  } catch (error) {
    console.error(' 導入數據失敗:', error);
    throw error;
  }
}

async function verifySync(): Promise<void> {
  console.log(' 驗證同步結果...');
  
  try {
    // 檢查 agents 表的記錄數量
    const devResult = execSync('wrangler d1 execute DB --command="SELECT COUNT(*) as count FROM agents"', {
      cwd: process.cwd(),
      encoding: 'utf8'
    });
    
    const prodResult = execSync('wrangler d1 execute DB --env production --command="SELECT COUNT(*) as count FROM agents"', {
      cwd: process.cwd(),
      encoding: 'utf8'
    });
    
    console.log('開發環境 agents 數量:', devResult);
    console.log('生產環境 agents 數量:', prodResult);
    
  } catch (error) {
    console.warn(' 驗證過程中出現問題:', error);
  }
}

async function main() {
  try {
    console.log(' 開始數據同步任務...');
    console.log(' 警告：這將完全覆蓋生產環境的數據！\n');
    
    // 1. 備份生產環境數據
    await backupProdData();
    
    // 2. 導出開發環境數據
    const exportFile = await exportDevData();
    
    // 3. 導入到生產環境
    await importToProd(exportFile);
    
    // 4. 驗證同步結果
    await verifySync();
    
    console.log('\n 數據同步任務完成！');
    
  } catch (error) {
    console.error(' 同步過程中出現錯誤:', error);
    process.exit(1);
  }
}

main();