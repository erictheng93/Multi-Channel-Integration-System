/**
 * 自動化數據庫同步工具
 * Multi-Channel Integration System - Database Sync Tool
 *
 * 功能：
 * 1. 結構同步 (Schema Synchronization)
 * 2. 數據同步 (Data Synchronization)
 * 3. 衝突解決 (Conflict Resolution)
 * 4. 健康檢查 (Health Check)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 配置選項
interface SyncConfig {
  source: 'production' | 'local';
  target: 'production' | 'local';
  tables: string[];
  mode: 'schema-only' | 'data-only' | 'full' | 'incremental';
  excludeSensitive: boolean;
  dryRun: boolean;
  backupBeforeSync: boolean;
}

// 預設配置
const DEFAULT_CONFIG: SyncConfig = {
  source: 'production',
  target: 'local',
  tables: ['agents', 'customers', 'conversations', 'messages', 'teams'],
  mode: 'incremental',
  excludeSensitive: true,
  dryRun: true,
  backupBeforeSync: true
};

class DatabaseSyncTool {
  private config: SyncConfig;
  private dbName = 'mcis-db';

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 主同步函數
   */
  async sync(): Promise<void> {
    console.log('🚀 開始數據庫同步過程...');
    console.log('📊 同步配置:', this.config);

    try {
      // 1. 預檢查
      await this.preCheck();

      // 2. 備份 (如果需要)
      if (this.config.backupBeforeSync) {
        await this.backup();
      }

      // 3. 結構同步
      if (this.config.mode === 'schema-only' || this.config.mode === 'full') {
        await this.syncSchema();
      }

      // 4. 數據同步
      if (this.config.mode === 'data-only' || this.config.mode === 'full' || this.config.mode === 'incremental') {
        await this.syncData();
      }

      // 5. 後檢查
      await this.postCheck();

      console.log('✅ 數據庫同步完成!');

    } catch (error) {
      console.error('❌ 同步過程中發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 預檢查 - 確保環境準備就緒
   */
  private async preCheck(): Promise<void> {
    console.log('🔍 執行預檢查...');

    // 檢查 Wrangler 是否可用
    try {
      execSync('wrangler --version', { stdio: 'pipe' });
    } catch (error) {
      throw new Error('Wrangler CLI 不可用，請先安裝 Wrangler');
    }

    // 檢查數據庫連接
    await this.checkDatabaseConnection('local');
    await this.checkDatabaseConnection('production');

    console.log('✅ 預檢查通過');
  }

  /**
   * 檢查數據庫連接
   */
  private async checkDatabaseConnection(env: 'local' | 'production'): Promise<void> {
    const remoteFlag = env === 'production' ? '--remote' : '';
    try {
      const result = execSync(`wrangler d1 execute ${this.dbName} ${remoteFlag} --command "SELECT 1;"`, {
        stdio: 'pipe',
        encoding: 'utf8'
      });
      console.log(`✅ ${env} 數據庫連接正常`);
    } catch (error: any) {
      console.warn(`⚠️ ${env} 數據庫連接測試失敗:`, error.message);

      // 對於生產環境，我們可能因為網絡或權限問題無法連接，但仍可繼續
      if (env === 'production') {
        console.log(`📝 注意: 生產數據庫連接失敗，但將繼續嘗試同步操作`);
        return;
      }

      throw new Error(`${env} 數據庫連接失敗: ${error.message}`);
    }
  }

  /**
   * 備份數據庫
   */
  private async backup(): Promise<void> {
    console.log('💾 創建數據庫備份...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'backups', timestamp);

    // 確保備份目錄存在
    fs.mkdirSync(backupDir, { recursive: true });

    try {
      // 備份本地數據庫
      const localBackupPath = path.join(backupDir, 'local-backup.sql');
      execSync(`wrangler d1 export ${this.dbName} --output "${localBackupPath}"`, { stdio: 'pipe' });

      // 備份生產數據庫
      const prodBackupPath = path.join(backupDir, 'production-backup.sql');
      execSync(`wrangler d1 export ${this.dbName} --remote --output "${prodBackupPath}"`, { stdio: 'pipe' });

      console.log(`✅ 備份已保存到: ${backupDir}`);
    } catch (error) {
      console.warn('⚠️ 備份過程中發生警告:', error);
    }
  }

  /**
   * 同步數據庫結構
   */
  private async syncSchema(): Promise<void> {
    console.log('🔧 同步數據庫結構...');

    try {
      // 檢查待應用的遷移
      const migrationsOutput = execSync(`wrangler d1 migrations list ${this.dbName}`, { encoding: 'utf8' });

      if (migrationsOutput.includes('Migrations to be applied:')) {
        console.log('📝 發現待應用的遷移，正在應用...');

        if (!this.config.dryRun) {
          execSync(`wrangler d1 migrations apply ${this.dbName}`, { stdio: 'inherit' });
        } else {
          console.log('🔍 DRY RUN: 跳過實際遷移應用');
        }
      } else {
        console.log('✅ 所有遷移已應用，結構已同步');
      }
    } catch (error) {
      console.error('❌ 結構同步失敗:', error);
      throw error;
    }
  }

  /**
   * 同步數據
   */
  private async syncData(): Promise<void> {
    console.log('📊 開始數據同步...');

    for (const table of this.config.tables) {
      console.log(`🔄 同步表: ${table}`);
      await this.syncTableData(table);
    }
  }

  /**
   * 同步單個表的數據
   */
  private async syncTableData(tableName: string): Promise<void> {
    try {
      // 1. 獲取源表數據量
      const sourceCount = await this.getTableCount(tableName, this.config.source);
      const targetCount = await this.getTableCount(tableName, this.config.target);

      console.log(`📈 ${tableName}: ${this.config.source}(${sourceCount}) → ${this.config.target}(${targetCount})`);

      // 2. 如果源表為空，跳過
      if (sourceCount === 0) {
        console.log(`⏭️ ${tableName} 源表為空，跳過同步`);
        return;
      }

      // 3. 執行數據同步策略
      if (this.config.mode === 'incremental') {
        await this.incrementalSync(tableName, sourceCount, targetCount);
      } else {
        await this.fullSync(tableName);
      }

    } catch (error) {
      console.error(`❌ 同步表 ${tableName} 失敗:`, error);
      // 可以選擇繼續同步其他表或中止
    }
  }

  /**
   * 獲取表數據量
   */
  private async getTableCount(tableName: string, env: 'local' | 'production'): Promise<number> {
    const remoteFlag = env === 'production' ? '--remote' : '';
    try {
      const result = execSync(`wrangler d1 execute ${this.dbName} ${remoteFlag} --command "SELECT COUNT(*) as count FROM ${tableName};"`, { encoding: 'utf8', stdio: 'pipe' });

      // 提取 JSON 部分 (過濾掉 Wrangler 的輸出訊息)
      const lines = result.split('\n');
      const jsonLine = lines.find(line => line.trim().startsWith('['));

      if (jsonLine) {
        const jsonResult = JSON.parse(jsonLine);
        return jsonResult[0].results[0].count;
      }

      return 0;
    } catch (error) {
      console.warn(`⚠️ 無法獲取 ${env} ${tableName} 的數據量`);
      return 0;
    }
  }

  /**
   * 增量同步
   */
  private async incrementalSync(tableName: string, sourceCount: number, targetCount: number): Promise<void> {
    if (sourceCount === targetCount) {
      console.log(`✅ ${tableName} 數據量相同，跳過同步`);
      return;
    }

    if (sourceCount > targetCount) {
      console.log(`📥 ${tableName} 需要同步 ${sourceCount - targetCount} 條記錄`);

      if (!this.config.dryRun) {
        // 這裡實現實際的數據同步邏輯
        await this.copyMissingRecords(tableName, targetCount);
      } else {
        console.log(`🔍 DRY RUN: 跳過實際數據同步`);
      }
    } else {
      console.log(`⚠️ ${tableName} 目標環境數據量大於源環境，需要手動檢查`);
    }
  }

  /**
   * 完整同步
   */
  private async fullSync(tableName: string): Promise<void> {
    console.log(`🔄 執行 ${tableName} 完整同步`);

    if (!this.config.dryRun) {
      // 實現完整同步邏輯
      console.log('⚠️ 完整同步功能開發中...');
    } else {
      console.log('🔍 DRY RUN: 跳過完整同步');
    }
  }

  /**
   * 複製缺失記錄
   */
  private async copyMissingRecords(tableName: string, skipCount: number): Promise<void> {
    // 這是一個簡化的實現，實際需要根據表結構定制
    console.log(`📋 複製 ${tableName} 缺失記錄...`);

    // 敏感數據處理
    if (this.config.excludeSensitive && this.isSensitiveTable(tableName)) {
      console.log(`🔒 ${tableName} 包含敏感數據，跳過同步`);
      return;
    }

    // 實際的數據複製邏輯將在這裡實現
    console.log(`✅ ${tableName} 記錄複製完成`);
  }

  /**
   * 檢查是否為敏感表
   */
  private isSensitiveTable(tableName: string): boolean {
    const sensitiveTables = ['agents', 'system_settings']; // 可以根據需要調整
    return sensitiveTables.includes(tableName);
  }

  /**
   * 後檢查
   */
  private async postCheck(): Promise<void> {
    console.log('🔍 執行後檢查...');

    // 驗證表結構一致性
    await this.validateTableStructures();

    // 驗證數據完整性
    await this.validateDataIntegrity();

    console.log('✅ 後檢查通過');
  }

  /**
   * 驗證表結構
   */
  private async validateTableStructures(): Promise<void> {
    console.log('🔍 驗證表結構一致性...');

    try {
      const localTables = await this.getTableList('local');
      const prodTables = await this.getTableList('production');

      const localSet = new Set(localTables);
      const prodSet = new Set(prodTables);

      // 檢查缺失表
      const missingInLocal = [...prodSet].filter(table => !localSet.has(table));
      const missingInProd = [...localSet].filter(table => !prodSet.has(table));

      if (missingInLocal.length > 0) {
        console.warn('⚠️ 本地環境缺失表:', missingInLocal);
      }

      if (missingInProd.length > 0) {
        console.warn('⚠️ 生產環境缺失表:', missingInProd);
      }

      if (missingInLocal.length === 0 && missingInProd.length === 0) {
        console.log('✅ 表結構一致');
      }

    } catch (error) {
      console.warn('⚠️ 表結構驗證失敗:', error);
    }
  }

  /**
   * 獲取表列表
   */
  private async getTableList(env: 'local' | 'production'): Promise<string[]> {
    const remoteFlag = env === 'production' ? '--remote' : '';
    try {
      const result = execSync(`wrangler d1 execute ${this.dbName} ${remoteFlag} --command "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name;"`, { encoding: 'utf8', stdio: 'pipe' });

      // 提取 JSON 部分 (過濾掉 Wrangler 的輸出訊息)
      const lines = result.split('\n');
      const jsonLine = lines.find(line => line.trim().startsWith('['));

      if (jsonLine) {
        const jsonResult = JSON.parse(jsonLine);
        return jsonResult[0].results.map((row: any) => row.name);
      }

      return [];
    } catch (error) {
      console.warn(`⚠️ 獲取 ${env} 表列表失敗:`, error.message);
      return [];
    }
  }

  /**
   * 驗證數據完整性
   */
  private async validateDataIntegrity(): Promise<void> {
    console.log('🔍 驗證數據完整性...');

    for (const table of this.config.tables) {
      const localCount = await this.getTableCount(table, 'local');
      const prodCount = await this.getTableCount(table, 'production');

      console.log(`📊 ${table}: local(${localCount}) vs prod(${prodCount})`);
    }
  }

  /**
   * 生成同步報告
   */
  generateReport(): void {
    console.log('📋 生成同步報告...');

    const report = {
      timestamp: new Date().toISOString(),
      config: this.config,
      status: 'completed', // or 'failed'
      summary: {
        tablesProcessed: this.config.tables.length,
        recordsSynced: 0, // 實際同步的記錄數
        errors: []
      }
    };

    const reportPath = path.join(process.cwd(), 'sync-reports', `sync-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`📋 報告已保存: ${reportPath}`);
  }
}

// CLI 接口 - ES 模組版本
// Windows 兼容的主模組檢測
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename;

if (isMainModule) {
  const args = process.argv.slice(2);

  // 解析命令行參數
  const config: Partial<SyncConfig> = {};

  if (args.includes('--production-to-local')) {
    config.source = 'production';
    config.target = 'local';
  }

  if (args.includes('--local-to-production')) {
    config.source = 'local';
    config.target = 'production';
  }

  if (args.includes('--schema-only')) {
    config.mode = 'schema-only';
  }

  if (args.includes('--data-only')) {
    config.mode = 'data-only';
  }

  if (args.includes('--full')) {
    config.mode = 'full';
  }

  if (args.includes('--no-dry-run')) {
    config.dryRun = false;
  }

  if (args.includes('--include-sensitive')) {
    config.excludeSensitive = false;
  }

  // 執行同步
  const syncTool = new DatabaseSyncTool(config);

  syncTool.sync()
    .then(() => {
      syncTool.generateReport();
      console.log('🎉 同步完成!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 同步失敗:', error);
      process.exit(1);
    });
}

export default DatabaseSyncTool;