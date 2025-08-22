# 企業級操作日誌系統設計

## 日誌記錄策略

### 1. 日誌分類

#### 安全日誌 (Security Logs)
- 用戶登入/登出
- 權限變更
- 密碼重置
- 帳戶鎖定/解鎖
- 異常登入嘗試

#### 業務日誌 (Business Logs)
- 對話分配/轉移
- 訊息發送/編輯/刪除
- 客戶資料變更
- 系統設定修改
- 檔案上傳/下載

#### 系統日誌 (System Logs)
- API 調用記錄
- 錯誤和異常
- 效能監控
- 資料庫操作
- 第三方整合調用

### 2. 日誌資料結構

```typescript
interface AuditLog {
  id: string;                    // 日誌唯一ID
  timestamp: number;             // 時間戳
  userId?: number;               // 操作用戶ID
  userEmail?: string;            // 用戶郵箱
  sessionId?: string;            // 會話ID
  action: string;                // 操作類型
  resource: string;              // 操作資源
  resourceId?: string;           // 資源ID
  details: AuditLogDetails;      // 詳細資訊
  result: 'success' | 'failure'; // 操作結果
  errorMessage?: string;         // 錯誤訊息
  ipAddress?: string;            // IP 地址
  userAgent?: string;            // 用戶代理
  location?: string;             // 地理位置
  severity: 'low' | 'medium' | 'high' | 'critical'; // 嚴重程度
  category: 'security' | 'business' | 'system';     // 日誌分類
  metadata?: Record<string, any>; // 額外元數據
}

interface AuditLogDetails {
  before?: any;      // 變更前的值
  after?: any;       // 變更後的值
  changes?: string[]; // 變更的欄位列表
  reason?: string;   // 操作原因
  context?: any;     // 操作上下文
}
```

### 3. 日誌記錄實現

#### 日誌記錄器
```typescript
class AuditLogger {
  private db: D1Database;
  private kv: KVNamespace;
  
  constructor(db: D1Database, kv: KVNamespace) {
    this.db = db;
    this.kv = kv;
  }
  
  async log(logData: Partial<AuditLog>): Promise<void> {
    const log: AuditLog = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      result: 'success',
      severity: 'low',
      category: 'business',
      ...logData
    };
    
    // 寫入資料庫
    await this.db.prepare(`
      INSERT INTO audit_logs (
        id, timestamp, user_id, user_email, session_id,
        action, resource, resource_id, details, result,
        error_message, ip_address, user_agent, location,
        severity, category, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      log.id, log.timestamp, log.userId, log.userEmail, log.sessionId,
      log.action, log.resource, log.resourceId, JSON.stringify(log.details),
      log.result, log.errorMessage, log.ipAddress, log.userAgent,
      log.location, log.severity, log.category, JSON.stringify(log.metadata)
    ).run();
    
    // 高嚴重程度日誌同時寫入 KV 以便快速查詢
    if (log.severity === 'high' || log.severity === 'critical') {
      await this.kv.put(`critical_log:${log.id}`, JSON.stringify(log), {
        expirationTtl: 30 * 24 * 60 * 60 // 30 天
      });
    }
  }
  
  // 記錄用戶操作
  async logUserAction(
    userId: number,
    action: string,
    resource: string,
    details: AuditLogDetails,
    context: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    }
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource,
      details,
      category: 'business',
      severity: this.calculateSeverity(action, resource),
      ...context
    });
  }
  
  // 記錄安全事件
  async logSecurityEvent(
    event: string,
    details: AuditLogDetails,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    context: any = {}
  ): Promise<void> {
    await this.log({
      action: event,
      resource: 'security',
      details,
      category: 'security',
      severity,
      ...context
    });
  }
  
  private calculateSeverity(action: string, resource: string): 'low' | 'medium' | 'high' | 'critical' {
    // 根據操作類型和資源類型計算嚴重程度
    const criticalActions = ['delete', 'transfer', 'export'];
    const sensitiveResources = ['user', 'conversation', 'system_settings'];
    
    if (criticalActions.includes(action) && sensitiveResources.includes(resource)) {
      return 'critical';
    }
    
    if (criticalActions.includes(action) || sensitiveResources.includes(resource)) {
      return 'high';
    }
    
    return 'medium';
  }
}
```

#### 日誌中間件
```typescript
export function auditMiddleware(logger: AuditLogger) {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    const startTime = Date.now();
    const user = c.get('user');
    const method = c.req.method;
    const path = c.req.path;
    const ipAddress = c.req.header('CF-Connecting-IP');
    const userAgent = c.req.header('User-Agent');
    
    try {
      await next();
      
      // 記錄成功的操作
      if (user && shouldLogAction(method, path)) {
        await logger.logUserAction(
          user.id,
          `${method.toLowerCase()}_${extractResource(path)}`,
          extractResource(path),
          {
            context: {
              path,
              method,
              duration: Date.now() - startTime
            }
          },
          { ipAddress, userAgent }
        );
      }
    } catch (error) {
      // 記錄失敗的操作
      if (user) {
        await logger.logUserAction(
          user.id,
          `${method.toLowerCase()}_${extractResource(path)}`,
          extractResource(path),
          {
            context: {
              path,
              method,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          },
          { ipAddress, userAgent }
        );
      }
      
      throw error;
    }
  };
}

function shouldLogAction(method: string, path: string): boolean {
  // 定義需要記錄的操作
  const loggedMethods = ['POST', 'PUT', 'DELETE'];
  const excludedPaths = ['/api/health', '/api/ping'];
  
  return loggedMethods.includes(method) && !excludedPaths.includes(path);
}

function extractResource(path: string): string {
  // 從路徑中提取資源名稱
  const parts = path.split('/');
  return parts[2] || 'unknown'; // /api/conversations -> conversations
}
```

### 4. 日誌查詢和分析

#### 日誌查詢 API
```typescript
export const auditLogHandler = {
  // 查詢日誌
  search: async (c: Context<{ Bindings: Bindings }>) => {
    const {
      startDate,
      endDate,
      userId,
      action,
      resource,
      severity,
      category,
      page = 1,
      pageSize = 50
    } = c.req.query();
    
    let query = `
      SELECT * FROM audit_logs 
      WHERE timestamp >= ? AND timestamp <= ?
    `;
    const params = [
      startDate ? new Date(startDate).getTime() : Date.now() - 30 * 24 * 60 * 60 * 1000,
      endDate ? new Date(endDate).getTime() : Date.now()
    ];
    
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
    
    if (severity) {
      query += ` AND severity = ?`;
      params.push(severity);
    }
    
    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }
    
    query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
    params.push(pageSize, (page - 1) * pageSize);
    
    const logs = await c.env.DB.prepare(query).bind(...params).all();
    
    return c.json({
      success: true,
      data: logs.results,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: logs.results.length
      }
    });
  },
  
  // 日誌統計
  stats: async (c: Context<{ Bindings: Bindings }>) => {
    const { startDate, endDate } = c.req.query();
    
    const stats = await c.env.DB.prepare(`
      SELECT 
        category,
        severity,
        COUNT(*) as count,
        COUNT(CASE WHEN result = 'failure' THEN 1 END) as failures
      FROM audit_logs 
      WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY category, severity
    `).bind(
      startDate ? new Date(startDate).getTime() : Date.now() - 7 * 24 * 60 * 60 * 1000,
      endDate ? new Date(endDate).getTime() : Date.now()
    ).all();
    
    return c.json({
      success: true,
      data: stats.results
    });
  }
};
```

### 5. 資料庫結構

```sql
-- 操作日誌表
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    user_id INTEGER,
    user_email TEXT,
    session_id TEXT,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    details TEXT, -- JSON 格式
    result TEXT NOT NULL DEFAULT 'success',
    error_message TEXT,
    ip_address TEXT,
    user_agent TEXT,
    location TEXT,
    severity TEXT NOT NULL DEFAULT 'low',
    category TEXT NOT NULL DEFAULT 'business',
    metadata TEXT -- JSON 格式
);

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
```

### 6. 日誌保留和歸檔策略

```typescript
// 日誌清理任務
export async function cleanupAuditLogs(db: D1Database): Promise<void> {
  const retentionPeriods = {
    low: 90 * 24 * 60 * 60 * 1000,      // 90 天
    medium: 180 * 24 * 60 * 60 * 1000,  // 180 天
    high: 365 * 24 * 60 * 60 * 1000,    // 1 年
    critical: 7 * 365 * 24 * 60 * 60 * 1000 // 7 年
  };
  
  for (const [severity, retention] of Object.entries(retentionPeriods)) {
    const cutoffTime = Date.now() - retention;
    
    await db.prepare(`
      DELETE FROM audit_logs 
      WHERE severity = ? AND timestamp < ?
    `).bind(severity, cutoffTime).run();
  }
}
```