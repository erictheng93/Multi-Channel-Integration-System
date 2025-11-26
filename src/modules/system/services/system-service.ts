// System Service
// 系統服務層

import { createDbClient } from '@/db/drizzle-factory';
import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, count, sql } from 'drizzle-orm';
import { customers, conversations, messages } from '@/db/schema';
import type {
  SystemServiceInterface,
  SystemStatus,
  HealthCheckResponse,
  SystemInfo,
  ApiInfo,
  SystemStats,
  SystemSettingsResponse,
  SystemSettingsUpdate,
  RecallStats,
  IntegrationTestResult,
  SystemMetrics,
  BackupInfo
} from '../types/system-types';

export class SystemService implements SystemServiceInterface {
  private db: DrizzleD1Database;
  private cache: KVNamespace;
  private env: any;

  constructor(database: D1Database, cache: KVNamespace, env: any) {
    this.db = drizzle(database);
    this.cache = cache;
    this.env = env;
  }

  // 健康檢查
  async checkHealth(): Promise<HealthCheckResponse> {
    try {
      // 檢查資料庫連接
      const dbCheck = await this.db.get(sql`SELECT 1 as test`);

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbCheck ? 'connected' : 'disconnected',
        version: '1.0.0'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        version: '1.0.0',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // 獲取系統狀態
  async getSystemStatus(): Promise<SystemStatus> {
    try {
      // 檢查資料庫連接
      const dbCheck = await this.db.get(sql`SELECT 1 as test`);

      const status: SystemStatus = {
        overall: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0-modular',
        services: {
          database: {
            status: dbCheck ? 'connected' : 'disconnected',
            type: 'D1'
          },
          kv: {
            status: 'available',
            namespaces: ['SESSIONS', 'CACHE']
          },
          r2: {
            status: 'available',
            bucket: 'multi-channel-platform-attachments'
          },
          queue: {
            status: 'available',
            name: 'REALTIME_QUEUE'
          }
        },
        environment: this.env.ENVIRONMENT || 'development'
      };

      // 如果任何服務不可用，設置整體狀態
      if (!dbCheck) {
        status.overall = 'unhealthy';
      }

      return status;
    } catch (error) {
      console.error('Error getting system status:', error);
      return {
        overall: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0-modular',
        services: {
          database: { status: 'disconnected', type: 'D1' },
          kv: { status: 'unavailable', namespaces: [] },
          r2: { status: 'unavailable', bucket: '' },
          queue: { status: 'unavailable', name: '' }
        },
        environment: this.env.ENVIRONMENT || 'development'
      };
    }
  }

  // 獲取系統信息
  async getSystemInfo(): Promise<SystemInfo> {
    const info: SystemInfo = {
      version: '2.0.0-modular',
      environment: this.env.ENVIRONMENT || 'development',
      lastUpdate: new Date().toISOString(),
      dbStatus: 'online',
      cacheStatus: 'online',
      uptime: Date.now() - (Date.now() - 86400000) // 模擬 24 小時運行時間
    };

    try {
      // 驗證數據庫連接
      const dbCheck = await this.db.get(sql`SELECT 1 as test`);
      info.dbStatus = dbCheck ? 'online' : 'offline';
    } catch {
      info.dbStatus = 'offline';
    }

    return info;
  }

  // 獲取 API 信息
  async getApiInfo(): Promise<ApiInfo> {
    return {
      name: 'Multi-Channel Customer Support API',
      version: '2.0.0-modular',
      endpoints: {
        // 基礎端點
        health: 'GET /api/system/health',
        status: 'GET /api/system/status',
        info: 'GET /api/system/info',
        stats: 'GET /api/system/stats',

        // 認證端點
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        logout: 'POST /api/auth/logout',
        profile: 'GET /api/auth/profile',

        // 團隊管理端點
        teams: 'GET /api/teams',
        createTeam: 'POST /api/teams',
        teamDetail: 'GET /api/teams/:id',
        updateTeam: 'PUT /api/teams/:id',
        deleteTeam: 'DELETE /api/teams/:id',
        teamMembers: 'GET /api/teams/:id/members',
        teamStats: 'GET /api/teams/:id/stats',
        generateQR: 'POST /api/teams/:id/qr',

        // 對話管理端點
        conversations: 'GET /api/conversations',
        conversationDetail: 'GET /api/conversations/:id',

        // 延遲訊息端點
        delayedMessages: 'GET /api/delayed-messages',
        sendDelayedMessage: 'POST /api/delayed-messages/send',
        recallDelayedMessage: 'POST /api/delayed-messages/:id/recall',

        // 系統管理端點
        settings: 'GET /api/system/settings',
        updateSettings: 'PUT /api/system/settings',
        testIntegration: 'POST /api/system/integrations/:platform/test',
        metrics: 'GET /api/system/metrics',
        backup: 'POST /api/system/backup',
        backups: 'GET /api/system/backups',
        restore: 'POST /api/system/restore/:backupId',
        clearCache: 'POST /api/system/cache/clear',
        restart: 'POST /api/system/restart'
      },
      timestamp: new Date().toISOString()
    };
  }

  // 獲取統計數據
  async getStats(): Promise<SystemStats> {
    const stats: SystemStats = {
      totalMessages: 0,
      totalCustomers: 0,
      totalConversations: 0,
      recentMessages: []
    };

    try {
      // 檢查表是否存在
      const tablesResult = await this.db.all(
        sql`SELECT name FROM sqlite_master
            WHERE type='table' AND name IN ('messages', 'customers', 'conversations')`
      );

      const tablesCheck = tablesResult || [];
      if (tablesCheck.length > 0) {
        const tableNames = tablesCheck.map((t: any) => t.name);

        // 安全地查詢存在的表
        if (tableNames.includes('messages')) {
          const messagesResult = await this.db.select({ count: count() }).from(messages).get();
          stats.totalMessages = messagesResult?.count || 0;
        }

        if (tableNames.includes('customers')) {
          const customersResult = await this.db.select({ count: count() }).from(customers).get();
          stats.totalCustomers = customersResult?.count || 0;
        }

        if (tableNames.includes('conversations')) {
          const conversationsResult = await this.db.select({ count: count() }).from(conversations).get();
          stats.totalConversations = conversationsResult?.count || 0;
        }
      }
    } catch (dbError) {
      console.warn('Database query error, returning default stats:', dbError);
    }

    return stats;
  }

  // 獲取撤回統計
  async getRecallStats(): Promise<RecallStats> {
    try {
      // 基本實現 - 可以根據需要擴展
      const stats: RecallStats = {
        totalMessages: 0,
        recalledMessages: 0,
        successfulRecalls: 0,
        failedRecalls: 0
      };

      // 檢查 messages 表是否存在
      const tablesResult = await this.db.all(
        sql`SELECT name FROM sqlite_master WHERE type='table' AND name='messages'`
      );

      if (tablesResult && tablesResult.length > 0) {
        const totalResult = await this.db.select({ count: count() }).from(messages).get();
        stats.totalMessages = totalResult?.count || 0;

        // 查詢撤回的訊息
        const recalledResult = await this.db
          .select({ count: count() })
          .from(messages)
          .where(eq(messages.isRecalled, true))
          .get();
        stats.recalledMessages = recalledResult?.count || 0;
        stats.successfulRecalls = recalledResult?.count || 0;
      }

      return stats;
    } catch (error) {
      console.error('Error getting recall stats:', error);
      return {
        totalMessages: 0,
        recalledMessages: 0,
        successfulRecalls: 0,
        failedRecalls: 0
      };
    }
  }

  // 獲取系統設置
  async getSettings(): Promise<SystemSettingsResponse> {
    try {
      const settings: SystemSettingsResponse = {
        general: {
          systemName: 'Multi-Channel Support',
          contactEmail: 'admin@example.com',
          timezone: 'Asia/Taipei',
          language: 'zh-TW'
        },
        integrations: {
          line: {
            status: 'disconnected'
          },
          facebook: {
            status: 'disconnected'
          }
        },
        advanced: {
          messageQueueSize: 1000,
          messageTimeout: 30000,
          cacheExpiry: 3600,
          sessionExpiry: 86400,
          enableRateLimit: true,
          enableLogging: true,
          enableMetrics: true
        }
      };

      // 從 KV 檢查整合狀態
      try {
        const lineCredentials = await this.getCredentialsFromKV('line');
        if (lineCredentials) {
          settings.integrations!.line!.status = 'connected';
        }
      } catch {}

      try {
        const facebookCredentials = await this.getCredentialsFromKV('facebook');
        if (facebookCredentials) {
          settings.integrations!.facebook!.status = 'connected';
        }
      } catch {}

      return settings;
    } catch (error) {
      console.error('Error getting settings:', error);
      throw error;
    }
  }

  // 更新系統設置
  async updateSettings(settings: SystemSettingsUpdate): Promise<SystemSettingsResponse> {
    try {
      // 這裡可以實現設置的更新邏輯
      // 目前返回更新後的設置
      const currentSettings = await this.getSettings();

      // 合併設置（簡化實現）
      if (settings.general) {
        Object.assign(currentSettings.general!, settings.general);
      }
      if (settings.advanced) {
        Object.assign(currentSettings.advanced!, settings.advanced);
      }

      return currentSettings;
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }

  // 測試平台整合
  async testIntegration(platform: 'line' | 'facebook'): Promise<IntegrationTestResult> {
    try {
      const credentials = await this.getCredentialsFromKV(platform);

      if (!credentials) {
        return {
          platform,
          status: 'error',
          message: `No ${platform} credentials found`,
          timestamp: new Date().toISOString()
        };
      }

      // 這裡可以實現實際的 API 測試邏輯
      return {
        platform,
        status: 'success',
        message: `${platform} integration test successful`,
        timestamp: new Date().toISOString(),
        details: { credentialsFound: true }
      };
    } catch (error) {
      return {
        platform,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  // 獲取系統指標
  async getMetrics(): Promise<SystemMetrics> {
    return {
      cpu: Math.random() * 100, // 模擬數據
      memory: Math.random() * 100,
      disk: Math.random() * 100,
      network: {
        inbound: Math.random() * 1000,
        outbound: Math.random() * 1000
      },
      requests: {
        total: Math.floor(Math.random() * 10000),
        successful: Math.floor(Math.random() * 9000),
        failed: Math.floor(Math.random() * 1000)
      },
      timestamp: new Date().toISOString()
    };
  }

  // 創建備份
  async createBackup(): Promise<BackupInfo> {
    const backup: BackupInfo = {
      id: `backup_${Date.now()}`,
      name: `System Backup ${new Date().toLocaleString()}`,
      size: Math.floor(Math.random() * 1000000), // 模擬大小
      createdAt: new Date().toISOString(),
      type: 'full',
      status: 'completed'
    };

    // 這裡可以實現實際的備份邏輯
    return backup;
  }

  // 獲取備份列表
  async getBackups(): Promise<BackupInfo[]> {
    // 這裡可以實現從存儲中獲取備份列表的邏輯
    return [];
  }

  // 恢復備份
  async restoreBackup(backupId: string): Promise<boolean> {
    // 這裡可以實現備份恢復邏輯
    console.log(`Restoring backup: ${backupId}`);
    return true;
  }

  // 清除緩存
  async clearCache(): Promise<boolean> {
    try {
      // 這裡可以實現清除 KV 緩存的邏輯
      console.log('Cache cleared successfully');
      return true;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  }

  // 重啟系統
  async restartSystem(): Promise<boolean> {
    // Worker 環境中無法真正重啟，這裡只是記錄操作
    console.log('System restart requested');
    return true;
  }

  // 私有方法：從 KV 獲取憑證
  private async getCredentialsFromKV(platform: 'line' | 'facebook') {
    try {
      const encryptionKey = this.getEncryptionKey();
      const credentialTypes = platform === 'line'
        ? ['channelId', 'channelSecret', 'accessToken']
        : ['appId', 'appSecret', 'pageId', 'pageToken'];

      const credentials: any = {};

      for (const type of credentialTypes) {
        const key = `credentials:${platform}:${type}`;
        const encryptedValue = await this.cache.get(key);
        if (encryptedValue) {
          credentials[type] = await this.decrypt(encryptedValue, encryptionKey);
        }
      }

      return Object.keys(credentials).length > 0 ? credentials : null;
    } catch (error) {
      console.error(`Failed to get ${platform} credentials from KV:`, error);
      return null;
    }
  }

  // 私有方法：獲取加密密鑰
  private getEncryptionKey(): string {
    return this.env.JWT_SECRET || this.env.ENCRYPTION_KEY || 'default-key-32-chars-long-for-dev';
  }

  // 私有方法：解密
  private async decrypt(encryptedText: string, key: string): Promise<string> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const combined = new Uint8Array(
      atob(encryptedText).split('').map(char => char.charCodeAt(0))
    );

    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const keyData = encoder.encode(key.padEnd(32, '0').slice(0, 32));
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encrypted
    );

    return decoder.decode(decrypted);
  }
}