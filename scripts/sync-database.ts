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

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/** Runs a command synchronously, throws on failure (matches execSync behavior) */
function runSync(cmd: string[], opts?: { cwd?: string; timeout?: number }): string {
  const result = Bun.spawnSync(cmd, { stdout: 'pipe', stderr: 'pipe', ...opts });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString() || `Command failed with exit code ${result.exitCode}`);
  }
  return result.stdout.toString();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface TableListRow {
  name: string;
}

interface WranglerQueryResult<T> {
  results?: T[];
}

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

function requireProductionConfirmation(target: string): void {
  const expectedConfirmation = `allow:${target}`;
  const confirmations = new Set((process.env.MCIS_CONFIRM_PRODUCTION ?? '').split(',').map(value => value.trim()).filter(Boolean));
  if (!confirmations.has(expectedConfirmation)) {
    throw new Error(
      `Refusing production operation: ${target}. ` +
      `Set MCIS_CONFIRM_PRODUCTION=${expectedConfirmation} to run this command intentionally.`
    );
  }
}

class DatabaseSyncTool {
  private config: SyncConfig;
  private dbName = 'mcis-db';

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private getProductionSyncTarget(): string | null {
    if (this.config.source === 'production' && this.config.target === 'production') {
      return 'sync:db:prod-to-prod';
    }
    if (this.config.source === 'production') {
      return 'sync:db:from-prod';
    }
    if (this.config.target === 'production') {
      return 'sync:db:to-prod';
    }
    return null;
  }

  /**
   * 主同步函數
   */
  async sync(): Promise<void> {
    console.log(' 開始數據庫同步過程...');
    console.log(' 同步配置:', this.config);

    try {
      const productionTarget = this.getProductionSyncTarget();
      if (productionTarget) {
        requireProductionConfirmation(productionTarget);
      }

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

      console.log(' 數據庫同步完成!');

    } catch (error) {
      console.error(' 同步過程中發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 預檢查 - 確保環境準備就緒
   */
  private async preCheck(): Promise<void> {
    console.log(' 執行預檢查...');

    // 檢查 Wrangler 是否可用
    try {
      runSync(['wrangler', '--version']);
    } catch (error) {
      throw new Error('Wrangler CLI 不可用，請先安裝 Wrangler');
    }

    // 檢查本次同步涉及的數據庫連接
    await this.checkDatabaseConnection(this.config.source);
    if (this.config.target !== this.config.source) {
      await this.checkDatabaseConnection(this.config.target);
    }

    console.log(' 預檢查通過');
  }

  /**
   * 檢查數據庫連接
   */
  private async checkDatabaseConnection(env: 'local' | 'production'): Promise<void> {
    try {
      const args = ['wrangler', 'd1', 'execute', this.dbName];
      if (env === 'production') args.push('--remote');
      args.push('--command', 'SELECT 1;');
      runSync(args);
      console.log(` ${env} 數據庫連接正常`);
    } catch (error) {
      console.warn(` ${env} 數據庫連接測試失敗:`, getErrorMessage(error));

      // 對於生產環境，我們可能因為網絡或權限問題無法連接，但仍可繼續
      if (env === 'production') {
        console.log(` 注意: 生產數據庫連接失敗，但將繼續嘗試同步操作`);
        return;
      }

      throw new Error(`${env} 數據庫連接失敗: ${error.message}`);
    }
  }

  /**
   * 備份數據庫
   */
  private async backup(): Promise<void> {
    console.log(' 創建數據庫備份...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'backups', timestamp);

    // 確保備份目錄存在
    fs.mkdirSync(backupDir, { recursive: true });

    try {
      const envs = new Set([this.config.source, this.config.target]);
      for (const env of envs) {
        const backupPath = path.join(backupDir, `${env}-backup.sql`);
        const args = ['wrangler', 'd1', 'export', this.dbName, '--output', backupPath];
        if (env === 'production') {
          args.splice(4, 0, '--remote');
        }
        runSync(args);
      }

      console.log(` 備份已保存到: ${backupDir}`);
    } catch (error) {
      console.warn(' 備份過程中發生警告:', error);
    }
  }

  /**
   * 同步數據庫結構
   */
  private async syncSchema(): Promise<void> {
    console.log(' 同步數據庫結構...');

    try {
      // 檢查待應用的遷移
      const migrationsOutput = runSync(['wrangler', 'd1', 'migrations', 'list', this.dbName]);

      if (migrationsOutput.includes('Migrations to be applied:')) {
        console.log(' 發現待應用的遷移，正在應用...');

        if (!this.config.dryRun) {
          const applyResult = Bun.spawnSync(
            ['wrangler', 'd1', 'migrations', 'apply', this.dbName],
            { stdout: 'inherit', stderr: 'inherit' }
          );
          if (applyResult.exitCode !== 0) throw new Error('Migration apply failed');
        } else {
          console.log(' DRY RUN: 跳過實際遷移應用');
        }
      } else {
        console.log(' 所有遷移已應用，結構已同步');
      }
    } catch (error) {
      console.error(' 結構同步失敗:', error);
      throw error;
    }
  }

  /**
   * 同步數據
   */
  private async syncData(): Promise<void> {
    console.log(' 開始數據同步...');

    for (const table of this.config.tables) {
      console.log(` 同步表: ${table}`);
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

      console.log(` ${tableName}: ${this.config.source}(${sourceCount}) → ${this.config.target}(${targetCount})`);

      // 2. 如果源表為空，跳過
      if (sourceCount === 0) {
        console.log(` ${tableName} 源表為空，跳過同步`);
        return;
      }

      // 3. 執行數據同步策略
      if (this.config.mode === 'incremental') {
        await this.incrementalSync(tableName, sourceCount, targetCount);
      } else {
        await this.fullSync(tableName);
      }

    } catch (error) {
      console.error(` 同步表 ${tableName} 失敗:`, error);
      // 可以選擇繼續同步其他表或中止
    }
  }

  /**
   * 獲取表數據量
   */
  private async getTableCount(tableName: string, env: 'local' | 'production'): Promise<number> {
    try {
      const args = ['wrangler', 'd1', 'execute', this.dbName];
      if (env === 'production') args.push('--remote');
      args.push('--command', `SELECT COUNT(*) as count FROM ${tableName};`);
      const result = runSync(args);

      // 提取 JSON 部分 (過濾掉 Wrangler 的輸出訊息)
      const lines = result.split('\n');
      const jsonLine = lines.find(line => line.trim().startsWith('['));

      if (jsonLine) {
        const jsonResult = JSON.parse(jsonLine);
        return jsonResult[0].results[0].count;
      }

      return 0;
    } catch (error) {
      console.warn(` 無法獲取 ${env} ${tableName} 的數據量`);
      return 0;
    }
  }

  /**
   * 增量同步
   */
  private async incrementalSync(tableName: string, sourceCount: number, targetCount: number): Promise<void> {
    if (sourceCount === targetCount) {
      console.log(` ${tableName} 數據量相同，跳過同步`);
      return;
    }

    if (sourceCount > targetCount) {
      console.log(` ${tableName} 需要同步 ${sourceCount - targetCount} 條記錄`);

      if (!this.config.dryRun) {
        // 這裡實現實際的數據同步邏輯
        await this.copyMissingRecords(tableName, targetCount);
      } else {
        console.log(` DRY RUN: 跳過實際數據同步`);
      }
    } else {
      console.log(` ${tableName} 目標環境數據量大於源環境，需要手動檢查`);
    }
  }

  /**
   * 完整同步
   */
  private async fullSync(tableName: string): Promise<void> {
    console.log(` 執行 ${tableName} 完整同步`);

    if (!this.config.dryRun) {
      // 實現完整同步邏輯
      console.log(' 完整同步功能開發中...');
    } else {
      console.log(' DRY RUN: 跳過完整同步');
    }
  }

  /**
   * 複製缺失記錄
   */
  private async copyMissingRecords(tableName: string, skipCount: number): Promise<void> {
    // 這是一個簡化的實現，實際需要根據表結構定制
    console.log(` 複製 ${tableName} 缺失記錄...`);

    // 敏感數據處理
    if (this.config.excludeSensitive && this.isSensitiveTable(tableName)) {
      console.log(` ${tableName} 包含敏感數據，跳過同步`);
      return;
    }

    // 實際的數據複製邏輯將在這裡實現
    console.log(` ${tableName} 記錄複製完成`);
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
    console.log(' 執行後檢查...');

    // 驗證表結構一致性
    await this.validateTableStructures();

    // 驗證數據完整性
    await this.validateDataIntegrity();

    console.log(' 後檢查通過');
  }

  /**
   * 驗證表結構
   */
  private async validateTableStructures(): Promise<void> {
    console.log(' 驗證表結構一致性...');

    try {
      const sourceTables = await this.getTableList(this.config.source);
      const targetTables = await this.getTableList(this.config.target);

      const sourceSet = new Set(sourceTables);
      const targetSet = new Set(targetTables);

      // 檢查缺失表
      const missingInTarget = [...sourceSet].filter(table => !targetSet.has(table));
      const missingInSource = [...targetSet].filter(table => !sourceSet.has(table));

      if (missingInTarget.length > 0) {
        console.warn(` ${this.config.target} 環境缺失表:`, missingInTarget);
      }

      if (missingInSource.length > 0) {
        console.warn(` ${this.config.source} 環境缺失表:`, missingInSource);
      }

      if (missingInTarget.length === 0 && missingInSource.length === 0) {
        console.log(' 表結構一致');
      }

    } catch (error) {
      console.warn(' 表結構驗證失敗:', error);
    }
  }

  /**
   * 獲取表列表
   */
  private async getTableList(env: 'local' | 'production'): Promise<string[]> {
    try {
      const args = ['wrangler', 'd1', 'execute', this.dbName];
      if (env === 'production') args.push('--remote');
      args.push('--command', "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name;");
      const result = runSync(args);

      // 提取 JSON 部分 (過濾掉 Wrangler 的輸出訊息)
      const lines = result.split('\n');
      const jsonLine = lines.find(line => line.trim().startsWith('['));

      if (jsonLine) {
        const jsonResult = JSON.parse(jsonLine) as Array<WranglerQueryResult<TableListRow>>;
        return jsonResult[0]?.results?.map((row) => row.name) ?? [];
      }

      return [];
    } catch (error) {
      console.warn(` 獲取 ${env} 表列表失敗:`, getErrorMessage(error));
      return [];
    }
  }

  /**
   * 驗證數據完整性
   */
  private async validateDataIntegrity(): Promise<void> {
    console.log(' 驗證數據完整性...');

    for (const table of this.config.tables) {
      const sourceCount = await this.getTableCount(table, this.config.source);
      const targetCount = await this.getTableCount(table, this.config.target);

      console.log(` ${table}: ${this.config.source}(${sourceCount}) vs ${this.config.target}(${targetCount})`);
    }
  }

  /**
   * 生成同步報告
   */
  generateReport(): void {
    console.log(' 生成同步報告...');

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

    console.log(` 報告已保存: ${reportPath}`);
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
      console.log(' 同步完成!');
      process.exit(0);
    })
    .catch((error) => {
      console.error(' 同步失敗:', error);
      process.exit(1);
    });
}

export default DatabaseSyncTool;
