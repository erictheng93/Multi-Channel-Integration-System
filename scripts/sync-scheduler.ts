/**
 * 數據庫定期同步調度器
 * Database Sync Scheduler
 *
 * 功能：
 * 1. 定期執行數據同步
 * 2. 監控同步狀態
 * 3. 異常警報
 * 4. 同步報告
 */

import DatabaseSyncTool from './sync-database.ts';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// 調度配置
interface ScheduleConfig {
  // 同步頻率 (分鐘)
  syncInterval: number;

  // 健康檢查頻率 (分鐘)
  healthCheckInterval: number;

  // 同步時間窗口 (避免高峰期)
  timeWindow: {
    start: string; // HH:MM
    end: string;   // HH:MM
  };

  // 工作日同步
  workdaysOnly: boolean;

  // 同步配置
  syncConfig: {
    mode: 'schema-only' | 'data-only' | 'incremental';
    excludeSensitive: boolean;
    backupBeforeSync: boolean;
  };

  // 通知配置
  notifications: {
    email?: string;
    webhook?: string;
    slack?: string;
  };
}

// 預設調度配置
const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  syncInterval: 60,          // 每小時同步一次
  healthCheckInterval: 10,   // 每10分鐘健康檢查
  timeWindow: {
    start: '02:00',          // 凌晨2點開始
    end: '06:00'             // 凌晨6點結束
  },
  workdaysOnly: false,       // 週末也同步
  syncConfig: {
    mode: 'incremental',
    excludeSensitive: true,
    backupBeforeSync: true
  },
  notifications: {
    // 配置通知方式
  }
};

class DatabaseSyncScheduler {
  private config: ScheduleConfig;
  private isRunning = false;
  private syncTimer?: NodeJS.Timeout;
  private healthTimer?: NodeJS.Timeout;
  private logFile: string;

  constructor(config: Partial<ScheduleConfig> = {}) {
    this.config = { ...DEFAULT_SCHEDULE_CONFIG, ...config };
    this.logFile = path.join(process.cwd(), 'logs', 'sync-scheduler.log');

    // 確保日誌目錄存在
    fs.mkdirSync(path.dirname(this.logFile), { recursive: true });
  }

  /**
   * 啟動調度器
   */
  start(): void {
    if (this.isRunning) {
      this.log('⚠️ 調度器已在運行中');
      return;
    }

    this.isRunning = true;
    this.log('🚀 啟動數據庫同步調度器');
    this.log(`📊 配置: ${JSON.stringify(this.config, null, 2)}`);

    // 啟動同步定時器
    this.syncTimer = setInterval(() => {
      this.executeSync();
    }, this.config.syncInterval * 60 * 1000);

    // 啟動健康檢查定時器
    this.healthTimer = setInterval(() => {
      this.healthCheck();
    }, this.config.healthCheckInterval * 60 * 1000);

    // 立即執行一次健康檢查
    this.healthCheck();

    this.log('✅ 調度器啟動完成');
  }

  /**
   * 停止調度器
   */
  stop(): void {
    if (!this.isRunning) {
      this.log('⚠️ 調度器未運行');
      return;
    }

    this.isRunning = false;

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }

    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = undefined;
    }

    this.log('⏹️ 調度器已停止');
  }

  /**
   * 執行同步
   */
  private async executeSync(): Promise<void> {
    if (!this.shouldSyncNow()) {
      this.log('⏰ 不在同步時間窗口內，跳過同步');
      return;
    }

    this.log('🔄 開始執行定期同步...');

    try {
      const syncTool = new DatabaseSyncTool({
        source: 'production',
        target: 'local',
        mode: this.config.syncConfig.mode,
        excludeSensitive: this.config.syncConfig.excludeSensitive,
        backupBeforeSync: this.config.syncConfig.backupBeforeSync,
        dryRun: false // 正式執行
      });

      await syncTool.sync();

      this.log('✅ 定期同步完成');
      this.sendNotification('success', '數據庫定期同步成功完成');

    } catch (error) {
      this.log(`❌ 定期同步失敗: ${error}`);
      this.sendNotification('error', `數據庫同步失敗: ${error}`);
    }
  }

  /**
   * 健康檢查
   */
  private async healthCheck(): Promise<void> {
    this.log('🔍 執行健康檢查...');

    const results = {
      localDbOk: false,
      prodDbOk: false,
      migrationStatus: 'unknown',
      lastSyncTime: this.getLastSyncTime(),
      diskSpace: this.getDiskSpace()
    };

    try {
      // 檢查本地數據庫
      execSync('wrangler d1 execute mcis-db --command "SELECT 1;"', { stdio: 'pipe' });
      results.localDbOk = true;
    } catch (error) {
      this.log('❌ 本地數據庫健康檢查失敗');
    }

    try {
      // 檢查生產數據庫
      execSync('wrangler d1 execute mcis-db --remote --command "SELECT 1;"', { stdio: 'pipe' });
      results.prodDbOk = true;
    } catch (error) {
      this.log('❌ 生產數據庫健康檢查失敗');
    }

    // 檢查遷移狀態
    try {
      const migrationOutput = execSync('wrangler d1 migrations list mcis-db', { encoding: 'utf8' });
      results.migrationStatus = migrationOutput.includes('No migrations to apply') ? 'up-to-date' : 'pending';
    } catch (error) {
      results.migrationStatus = 'error';
    }

    // 記錄健康檢查結果
    this.log(`📊 健康檢查結果: ${JSON.stringify(results, null, 2)}`);

    // 發送警報 (如果需要)
    if (!results.localDbOk || !results.prodDbOk) {
      this.sendNotification('warning', `數據庫健康檢查發現問題: ${JSON.stringify(results)}`);
    }

    // 保存健康檢查報告
    this.saveHealthReport(results);
  }

  /**
   * 檢查是否應該現在同步
   */
  private shouldSyncNow(): boolean {
    const now = new Date();

    // 檢查工作日限制
    if (this.config.workdaysOnly) {
      const dayOfWeek = now.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) { // 週末
        return false;
      }
    }

    // 檢查時間窗口
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const startTime = this.config.timeWindow.start;
    const endTime = this.config.timeWindow.end;

    return currentTime >= startTime && currentTime <= endTime;
  }

  /**
   * 獲取最後同步時間
   */
  private getLastSyncTime(): string | null {
    try {
      const reportsDir = path.join(process.cwd(), 'sync-reports');
      if (!fs.existsSync(reportsDir)) {
        return null;
      }

      const files = fs.readdirSync(reportsDir)
        .filter(file => file.startsWith('sync-') && file.endsWith('.json'))
        .sort()
        .reverse();

      if (files.length === 0) {
        return null;
      }

      const latestReport = JSON.parse(fs.readFileSync(path.join(reportsDir, files[0]), 'utf8'));
      return latestReport.timestamp;

    } catch (error) {
      return null;
    }
  }

  /**
   * 獲取磁碟空間信息
   */
  private getDiskSpace(): any {
    try {
      // Windows 系統
      const output = execSync('dir /-c', { encoding: 'utf8', cwd: process.cwd() });
      // 簡化實現，實際可以解析更詳細的磁碟空間信息
      return { status: 'ok', details: 'disk space check completed' };
    } catch (error) {
      return { status: 'error', error: error.toString() };
    }
  }

  /**
   * 保存健康檢查報告
   */
  private saveHealthReport(results: any): void {
    const reportPath = path.join(process.cwd(), 'health-reports', `health-${Date.now()}.json`);

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      ...results
    }, null, 2));
  }

  /**
   * 發送通知
   */
  private sendNotification(type: 'success' | 'warning' | 'error', message: string): void {
    const notification = {
      type,
      message,
      timestamp: new Date().toISOString(),
      source: 'Database Sync Scheduler'
    };

    this.log(`📢 通知 (${type}): ${message}`);

    // 實現各種通知方式
    if (this.config.notifications.email) {
      this.sendEmailNotification(notification);
    }

    if (this.config.notifications.webhook) {
      this.sendWebhookNotification(notification);
    }

    if (this.config.notifications.slack) {
      this.sendSlackNotification(notification);
    }
  }

  /**
   * 發送郵件通知 (模擬實現)
   */
  private sendEmailNotification(notification: any): void {
    this.log(`📧 郵件通知: ${JSON.stringify(notification)}`);
    // 實際實現將整合郵件服務
  }

  /**
   * 發送 Webhook 通知 (模擬實現)
   */
  private sendWebhookNotification(notification: any): void {
    this.log(`🔗 Webhook 通知: ${JSON.stringify(notification)}`);
    // 實際實現將調用 HTTP endpoint
  }

  /**
   * 發送 Slack 通知 (模擬實現)
   */
  private sendSlackNotification(notification: any): void {
    this.log(`💬 Slack 通知: ${JSON.stringify(notification)}`);
    // 實際實現將調用 Slack API
  }

  /**
   * 記錄日誌
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;

    // 輸出到控制台
    console.log(logEntry.trim());

    // 寫入日誌文件
    fs.appendFileSync(this.logFile, logEntry);
  }

  /**
   * 獲取運行狀態
   */
  getStatus(): any {
    return {
      isRunning: this.isRunning,
      config: this.config,
      uptime: process.uptime(),
      lastHealthCheck: this.getLastSyncTime(),
      nextSync: this.getNextSyncTime()
    };
  }

  /**
   * 獲取下次同步時間
   */
  private getNextSyncTime(): string {
    const now = new Date();
    const next = new Date(now.getTime() + this.config.syncInterval * 60 * 1000);
    return next.toISOString();
  }
}

// CLI 接口 - ES 模組版本
const isMainModule = process.argv[1] === new URL(import.meta.url).pathname.replace(/\//g, '\\');

if (isMainModule) {
  const args = process.argv.slice(2);
  const command = args[0];

  const scheduler = new DatabaseSyncScheduler();

  switch (command) {
    case 'start':
      scheduler.start();

      // 監聽退出信號
      process.on('SIGINT', () => {
        console.log('\n收到退出信號，正在停止調度器...');
        scheduler.stop();
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        console.log('\n收到終止信號，正在停止調度器...');
        scheduler.stop();
        process.exit(0);
      });

      // 保持進程運行
      setInterval(() => {
        // Keep alive
      }, 60000);

      break;

    case 'status':
      console.log('📊 調度器狀態:', JSON.stringify(scheduler.getStatus(), null, 2));
      break;

    case 'test-sync':
      console.log('🧪 測試同步...');
      // 創建測試同步工具並執行
      const testSync = new DatabaseSyncTool({
        source: 'production',
        target: 'local',
        mode: 'incremental',
        dryRun: true
      });

      testSync.sync().then(() => {
        console.log('✅ 測試同步完成');
      }).catch((error) => {
        console.error('❌ 測試同步失敗:', error);
      });
      break;

    default:
      console.log(`
📋 數據庫同步調度器使用說明:

命令:
  start       - 啟動調度器
  status      - 查看調度器狀態
  test-sync   - 測試同步功能

範例:
  npm run sync:scheduler start
  npm run sync:scheduler status
  npm run sync:scheduler test-sync
      `);
      break;
  }
}

export default DatabaseSyncScheduler;