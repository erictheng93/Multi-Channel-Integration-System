// 企業級操作日誌系統實現
import type { Context } from 'hono';
import type { Bindings, DbUser, DatabaseRow, QueryParams } from '../types';
// Removed unused enterprise imports

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
      timestamp: Date.now(),
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
      // 嘗試寫入備用存儲
      await this.writeToBackup(logEntry);
    }
  }
  
  // 記錄用戶操作
  async logUserAction(
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
  
  // 記錄 API 調用
  async logApiCall(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    user?: DbUser,
    context: Record<string, unknown> = {}
  ): Promise<void> {
    const level = statusCode >= 500 ? LogLevel.ERROR : 
                 statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    
    await this.log({
      userId: user?.id ? (typeof user.id === 'string' ? parseInt(user.id, 10) : user.id) : 0,
      userEmail: user?.email || 'unknown',
      action: `api_${method.toLowerCase()}`,
      resource: path,
      details: {
        context: {
          method,
          path,
          statusCode,
          duration
        }
      },
      result: statusCode < 400 ? OperationResult.SUCCESS : OperationResult.FAILURE,
      category: LogCategory.SYSTEM,
      level,
      ...context
    });
  }
  
  // 查詢日誌
  async queryLogs(filters: {
    startDate?: number;
    endDate?: number;
    userId?: number;
    action?: string;
    resource?: string;
    level?: LogLevel;
    category?: LogCategory;
    result?: OperationResult;
    page?: number;
    pageSize?: number;
  }): Promise<{
    logs: AuditLogEntry[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const {
      startDate = Date.now() - 30 * 24 * 60 * 60 * 1000, // 預設30天
      endDate = Date.now(),
      userId,
      action,
      resource,
      level,
      category,
      result,
      page = 1,
      pageSize = 50
    } = filters;
    
    let query = `
      SELECT * FROM audit_logs 
      WHERE timestamp >= ? AND timestamp <= ?
    `;
    const params: QueryParams = [startDate, endDate];
    
    if (userId) {
      query += ` AND user_id = ?`;
      params.push(userId);
    }
    
    if (action) {
      query += ` AND action LIKE ?`;
      params.push(`%${action}%`);
    }
    
    if (resource) {
      query += ` AND resource = ?`;
      params.push(resource);
    }
    
    if (level) {
      query += ` AND level = ?`;
      params.push(level);
    }
    
    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }
    
    if (result) {
      query += ` AND result = ?`;
      params.push(result);
    }
    
    // 計算總數
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await this.db.prepare(countQuery).bind(...params).first();
    const total = countResult?.total || 0;
    
    // 分頁查詢
    query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
    params.push(pageSize, (page - 1) * pageSize);
    
    const result_logs = await this.db.prepare(query).bind(...params).all();
    
    const logs = result_logs.results.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      userId: row.user_id,
      userEmail: row.user_email,
      sessionId: row.session_id,
      action: row.action,
      resource: row.resource,
      resourceId: row.resource_id,
      details: JSON.parse(row.details as string || '{}'),
      result: row.result,
      level: row.level,
      category: row.category,
      errorMessage: row.error_message,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      location: row.location,
      metadata: JSON.parse(row.metadata as string || '{}')
    })) as AuditLogEntry[];
    
    return {
      logs,
      total: total as number,
      page,
      pageSize
    };
  }
  
  // 生成日誌統計
  async generateLogStats(period: { start: number; end: number }): Promise<{
    totalLogs: number;
    logsByCategory: Record<LogCategory, number>;
    logsByLevel: Record<LogLevel, number>;
    logsByResult: Record<OperationResult, number>;
    topUsers: Array<{ userId: number; userEmail: string; count: number }>;
    topActions: Array<{ action: string; count: number }>;
    errorRate: number;
  }> {
    const stats = await this.db.prepare(`
      SELECT 
        COUNT(*) as total_logs,
        category,
        level,
        result,
        COUNT(CASE WHEN result = 'failure' THEN 1 END) as failures
      FROM audit_logs 
      WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY category, level, result
    `).bind(period.start, period.end).all();
    
    const userStats = await this.db.prepare(`
      SELECT 
        user_id,
        user_email,
        COUNT(*) as count
      FROM audit_logs 
      WHERE timestamp >= ? AND timestamp <= ? AND user_id IS NOT NULL
      GROUP BY user_id, user_email
      ORDER BY count DESC
      LIMIT 10
    `).bind(period.start, period.end).all();
    
    const actionStats = await this.db.prepare(`
      SELECT 
        action,
        COUNT(*) as count
      FROM audit_logs 
      WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10
    `).bind(period.start, period.end).all();
    
    // 處理統計數據
    const logsByCategory: Record<LogCategory, number> = {} as Record<LogCategory, number>;
    const logsByLevel: Record<LogLevel, number> = {} as Record<LogLevel, number>;
    const logsByResult: Record<OperationResult, number> = {} as Record<OperationResult, number>;
    
    let totalLogs = 0;
    let totalFailures = 0;
    
    stats.results.forEach((row: DatabaseRow) => {
      const count = row.count || 0;
      totalLogs += count;
      totalFailures += row.failures || 0;
      
      logsByCategory[row.category as LogCategory] = 
        (logsByCategory[row.category as LogCategory] || 0) + count;
      logsByLevel[row.level as LogLevel] = 
        (logsByLevel[row.level as LogLevel] || 0) + count;
      logsByResult[row.result as OperationResult] = 
        (logsByResult[row.result as OperationResult] || 0) + count;
    });
    
    return {
      totalLogs,
      logsByCategory,
      logsByLevel,
      logsByResult,
      topUsers: userStats.results.map((row: DatabaseRow) => ({
        userId: row.user_id,
        userEmail: row.user_email,
        count: row.count
      })),
      topActions: actionStats.results.map((row: DatabaseRow) => ({
        action: row.action,
        count: row.count
      })),
      errorRate: totalLogs > 0 ? (totalFailures / totalLogs) * 100 : 0
    };
  }
  
  // 私有方法：寫入資料庫
  private async writeToDatabase(entry: AuditLogEntry): Promise<void> {
    await this.db.prepare(`
      INSERT INTO audit_logs (
        id, timestamp, user_id, user_email, session_id,
        action, resource, resource_id, details, result,
        level, category, error_message, ip_address, 
        user_agent, location, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      entry.id,
      entry.timestamp,
      entry.userId || null,
      entry.userEmail || null,
      entry.sessionId || null,
      entry.action,
      entry.resource,
      entry.resourceId || null,
      JSON.stringify(entry.details),
      entry.result,
      entry.level,
      entry.category,
      entry.errorMessage || null,
      entry.ipAddress || null,
      entry.userAgent || null,
      entry.location || null,
      JSON.stringify(entry.metadata || {})
    ).run();
  }
  
  // 私有方法：寫入 KV
  private async writeToKV(entry: AuditLogEntry): Promise<void> {
    const key = `critical_log:${entry.id}`;
    await this.kv.put(key, JSON.stringify(entry), {
      expirationTtl: 7 * 24 * 60 * 60 // 7 天
    });
  }
  
  // 私有方法：寫入備用存儲
  private async writeToBackup(entry: AuditLogEntry): Promise<void> {
    const key = `backup_log:${entry.timestamp}:${entry.id}`;
    await this.kv.put(key, JSON.stringify(entry), {
      expirationTtl: 24 * 60 * 60 // 24 小時
    });
  }
  
  // 私有方法：觸發警報
  private async triggerAlert(entry: AuditLogEntry): Promise<void> {
    // 這裡可以整合警報系統，如發送郵件、Slack 通知等
    console.error('CRITICAL AUDIT LOG:', entry);
    
    // 存儲到緊急日誌隊列
    const alertKey = `alert:${entry.timestamp}:${entry.id}`;
    await this.kv.put(alertKey, JSON.stringify({
      ...entry,
      alertTriggered: true,
      alertTimestamp: Date.now()
    }), { expirationTtl: 30 * 24 * 60 * 60 }); // 30 天
  }
  
  // 私有方法：計算日誌級別
  private calculateLogLevel(action: string, resource: string): LogLevel {
    const criticalActions = ['delete', 'transfer', 'export', 'login_failure'];
    const sensitiveResources = ['user', 'system', 'security'];
    
    if (criticalActions.includes(action) && sensitiveResources.includes(resource)) {
      return LogLevel.CRITICAL;
    }
    
    if (criticalActions.includes(action) || sensitiveResources.includes(resource)) {
      return LogLevel.ERROR;
    }
    
    if (action.includes('update') || action.includes('create')) {
      return LogLevel.WARN;
    }
    
    return LogLevel.INFO;
  }
}

// 審計中間件
export function auditMiddleware() {
  return async (c: Context<{ Bindings: Bindings }>, next: () => Promise<void>) => {
    const startTime = Date.now();
    const user = c.get('user') as DbUser;
    const method = c.req.method;
    const path = c.req.path;
    const ipAddress = c.req.header('CF-Connecting-IP');
    const userAgent = c.req.header('User-Agent');
    
    const logger = new EnterpriseAuditLogger(c.env.DB, c.env.KV);
    
    try {
      await next();
      
      // 記錄成功的操作
      if (user && shouldLogAction(method, path)) {
        await logger.logApiCall(
          method,
          path,
          c.res.status,
          Date.now() - startTime,
          user,
          { ipAddress, userAgent }
        );
      }
    } catch (error) {
      // 記錄失敗的操作
      if (user) {
        await logger.logApiCall(
          method,
          path,
          500,
          Date.now() - startTime,
          user,
          { 
            ipAddress, 
            userAgent,
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      }
      
      throw error;
    }
  };
}

// 判斷是否需要記錄操作
function shouldLogAction(method: string, path: string): boolean {
  const loggedMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  const excludedPaths = ['/api/health', '/api/ping', '/api/metrics'];
  
  return loggedMethods.includes(method) && !excludedPaths.some(excluded => path.startsWith(excluded));
}