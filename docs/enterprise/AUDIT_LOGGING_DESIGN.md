

### 1.

#### (Security Logs)
- /
-
-
- /
-

#### (Business Logs)
- /
- //
-
-
- /

#### (System Logs)
- API
-
-
-
-

### 2.

```typescript
interface AuditLog {
 id: string; // ID
 timestamp: number; //
 userId?: number; // ID
 userEmail?: string; //
 sessionId?: string; // ID
 action: string; //
 resource: string; //
 resourceId?: string; // ID
 details: AuditLogDetails; //
 result: 'success' | 'failure'; //
 errorMessage?: string; //
 ipAddress?: string; // IP
 userAgent?: string; //
 location?: string; //
 severity: 'low' | 'medium' | 'high' | 'critical'; //
 category: 'security' | 'business' | 'system'; //
 metadata?: Record<string, any>; //
}

interface AuditLogDetails {
 before?: any; //
 after?: any; //
 changes?: string[]; //
 reason?: string; //
 context?: any; //
}
```

### 3.


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

 //
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

 // KV
 if (log.severity === 'high' || log.severity === 'critical') {
 await this.kv.put(`critical_log:${log.id}`, JSON.stringify(log), {
 expirationTtl: 30 * 24 * 60 * 60 // 30
 });
 }
 }

 //
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

 //
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
 //
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

 //
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
 //
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
 //
 const loggedMethods = ['POST', 'PUT', 'DELETE'];
 const excludedPaths = ['/api/health', '/api/ping'];

 return loggedMethods.includes(method) && !excludedPaths.includes(path);
}

function extractResource(path: string): string {
 //
 const parts = path.split('/');
 return parts[2] || 'unknown'; // /api/conversations -> conversations
}
```

### 4.

#### API
```typescript
export const auditLogHandler = {
 //
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

 //
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

### 5.

```sql
--
CREATE TABLE IF NOT EXISTS audit_logs (
 id TEXT PRIMARY KEY,
 timestamp INTEGER NOT NULL,
 user_id INTEGER,
 user_email TEXT,
 session_id TEXT,
 action TEXT NOT NULL,
 resource TEXT NOT NULL,
 resource_id TEXT,
 details TEXT, -- JSON
 result TEXT NOT NULL DEFAULT 'success',
 error_message TEXT,
 ip_address TEXT,
 user_agent TEXT,
 location TEXT,
 severity TEXT NOT NULL DEFAULT 'low',
 category TEXT NOT NULL DEFAULT 'business',
 metadata TEXT -- JSON
);

--
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
```

### 6.

```typescript
//
export async function cleanupAuditLogs(db: D1Database): Promise<void> {
 const retentionPeriods = {
 low: 90 * 24 * 60 * 60 * 1000, // 90
 medium: 180 * 24 * 60 * 60 * 1000, // 180
 high: 365 * 24 * 60 * 60 * 1000, // 1
 critical: 7 * 365 * 24 * 60 * 60 * 1000 // 7
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