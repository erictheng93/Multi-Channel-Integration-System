// 企業級操作日誌系統實現
import type { Context } from 'hono';
import type { Bindings, DbUser } from '../types';
import { nowMs } from '@/utils/timestamp'

// 日誌級別
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// 日誌分類
export enum LogCategory {
  SECURITY = 'security',
  BUSINESS = 'business',
  SYSTEM = 'system',
  AUDIT = 'audit'
}

// 操作結果
export enum OperationResult {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL = 'partial'
}

// 日誌條目接口
export interface AuditLogEntry {
  id: string;
  timestamp: number;
  userId?: number;
  userEmail?: string;
  sessionId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: AuditLogDetails;
  result: OperationResult;
  level: LogLevel;
  category: LogCategory;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogDetails {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changes?: string[];
  reason?: string;
  context?: Record<string, unknown>;
  duration?: number;
}

// 企業級審計日誌記錄器
export class EnterpriseAuditLogger {
  private db: D1Database;
  private kv: KVNamespace;
  
  constructor(db: D1Database, kv: KVNamespace) {
    this.db = db;
    this.kv = kv;
  }
  
  // 記錄操作日誌
  async log(entry: Partial<AuditLogEntry>): Promise<void> {
    const logEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: nowMs(),
      result: OperationResult.SUCCESS,
      level: LogLevel.INFO,
      category: LogCategory.BUSINESS,
      details: {},
      ...entry
    } as AuditLogEntry;
    
    try {
      // 寫入資料庫
      await this.writeToDatabase(logEntry);
      
      // 高優先級日誌同時寫入 KV
      if (logEntry.level === LogLevel.ERROR || logEntry.level === LogLevel.CRITICAL) {
        await this.writeToKV(logEntry);
      }
      
      // 觸發實時警報
      if (logEntry.level === LogLevel.CRITICAL) {
        await this.triggerAlert(logEntry);
      }
      
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }
  
  // 記錄業務操作
  async logBusinessOperation(
    user: DbUser,
    action: string,
    resource: string,
    details: AuditLogDetails,
    context: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      resourceId?: string;
    } = {}
  ): Promise<void> {
    await this.log({
      userId: typeof user.id === 'string' ? parseInt(user.id, 10) : user.id,
      userEmail: user.email,
      action,
      resource,
      ...(context.resourceId && { resourceId: context.resourceId }),
      details,
      category: LogCategory.BUSINESS,
      level: this.calculateLogLevel(action, resource),
      ...(context.ipAddress && { ipAddress: context.ipAddress }),
      ...(context.userAgent && { userAgent: context.userAgent }),
      ...(context.sessionId && { sessionId: context.sessionId })
    });
  }
  
  // 記錄安全事件
  async logSecurityEvent(
    event: string,
    details: AuditLogDetails,
    level: LogLevel = LogLevel.WARN,
    context: Record<string, unknown> = {}
  ): Promise<void> {
    await this.log({
      action: event,
      resource: 'security',
      details,
      category: LogCategory.SECURITY,
      level,
      ...context
    });
  }
  
  // 記錄系統事件
  async logSystemEvent(
    event: string,
    details: AuditLogDetails,
    level: LogLevel = LogLevel.INFO
  ): Promise<void> {
    await this.log({
      action: event,
      resource: 'system',
      details,
      category: LogCategory.SYSTEM,
      level
    });
  }
  
  // 記錄用戶活動
  async logUserActivity(
    userId: number,
    action: string,
    details: AuditLogDetails = {}
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource: 'user_activity',
      details,
      category: LogCategory.AUDIT,
      level: LogLevel.INFO
    });
  }

  // 私有方法：寫入資料庫
  private async writeToDatabase(entry: AuditLogEntry): Promise<void> {
    const { drizzle } = await import('drizzle-orm/d1');
    const { activities } = await import('../db/schema');
    const db = drizzle(this.db);
    
    await db.insert(activities).values({
      id: parseInt(entry.id.replace(/-/g, '').slice(0, 10), 16), // Convert UUID to int
      userId: entry.userId?.toString() || 'system',
      userName: entry.userEmail || 'system',
      userRole: 'unknown',
      action: entry.action,
      resourceType: entry.resource,
      resourceId: entry.resourceId || null,
      details: JSON.stringify(entry.details),
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      createdAt: new Date(entry.timestamp).toISOString()
    });
  }

  // 私有方法：寫入 KV
  private async writeToKV(entry: AuditLogEntry): Promise<void> {
    const key = `audit_log:${entry.level}:${entry.timestamp}`;
    await this.kv.put(key, JSON.stringify(entry), {
      expirationTtl: 30 * 24 * 60 * 60 // 30 天
    });
  }

  // 私有方法：觸發警報
  private async triggerAlert(entry: AuditLogEntry): Promise<void> {
    const alertKey = `alert:${entry.timestamp}`;
    await this.kv.put(alertKey, JSON.stringify({
      type: 'critical_audit_event',
      entry,
      timestamp: entry.timestamp
    }), {
      expirationTtl: 7 * 24 * 60 * 60 // 7 天
    });
  }

  // 私有方法：計算日誌級別
  private calculateLogLevel(action: string, _resource: string): LogLevel {
    const criticalActions = ['delete', 'remove', 'disable', 'ban'];
    const warningActions = ['update', 'modify', 'change'];
    
    if (criticalActions.some(a => action.toLowerCase().includes(a))) {
      return LogLevel.WARN;
    }
    
    if (warningActions.some(a => action.toLowerCase().includes(a))) {
      return LogLevel.INFO;
    }
    
    return LogLevel.DEBUG;
  }
}

// 審計日誌中間件
export function auditLogMiddleware() {
  return async (c: Context<{ Bindings: Bindings }>, next: () => Promise<void>) => {
    const startTime = nowMs();
    const auditLogger = new EnterpriseAuditLogger(c.env.DB, c.env.KV);
    
    try {
      await next();
      
      const duration = Date.now() - startTime;
      
      // 記錄 API 調用
      await auditLogger.logSystemEvent('api_request', {
        duration,
        context: {
          method: c.req.method,
          path: c.req.path,
          status: c.res.status
        }
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // 記錄 API 錯誤
      await auditLogger.logSystemEvent('api_error', {
        duration,
        context: {
          method: c.req.method,
          path: c.req.path,
          error: error instanceof Error ? error.message : 'unknown'
        }
      }, LogLevel.ERROR);
      
      throw error;
    }
  };
}