

### 1. **Durable Objects **
- Durable Objects
-
- SSE + HTTP API

### 2. **SSE (Server-Sent Events) **


```typescript
// SSE
const headers = {
 'Content-Type': 'text/event-stream',
 'Cache-Control': 'no-cache, no-store, must-revalidate',
 'Connection': 'keep-alive',
 'X-Accel-Buffering': 'no', // Nginx
};
```


- ****: 30 25
- ****: 10 3
- ****: 5
- ****: 30


```sql
--
SELECT * FROM notifications WHERE user_id = ? AND is_read = FALSE

--
SELECT * FROM notifications
WHERE user_id = ? AND is_read = FALSE
AND created_at > datetime('now', '-30 seconds')
ORDER BY priority DESC, created_at DESC
LIMIT 5
```

### 3. **HTTP API **


```typescript
//
app.use('/api/conversations', cacheMiddleware(60)); // 1
app.use('/api/customers/stats', cacheMiddleware(300)); // 5
app.use('/api/system/info', cacheMiddleware(600)); // 10
```


- ****:
- ****:
- ****: WHERE ORDER BY


```typescript
class CacheManager {
 //
 private generateKey(prefix: string, identifier: string, params?: Record<string, any>): string {
 const paramString = params ? `:${JSON.stringify(params)}` : '';
 return `cache:${prefix}:${identifier}${paramString}`;
 }

 //
 async get<T>(prefix: string, identifier: string): Promise<T | null> {
 const cached = await this.env.SESSIONS.get(key);
 if (cached) {
 const data = JSON.parse(cached);
 if (data.expiresAt && Date.now() > data.expiresAt) {
 await this.env.SESSIONS.delete(key);
 return null;
 }
 return data.value as T;
 }
 return null;
 }
}
```

### 4. ****


```sql
--
SELECT * FROM conversations WHERE id = ?;
SELECT * FROM customers WHERE id = ?;
SELECT COUNT(*) FROM messages WHERE conversation_id = ?;

-- JOIN
SELECT
 c.*,
 cu.display_name as customer_name,
 cu.platform,
 (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND is_read = FALSE) as unread_count
FROM conversations c
JOIN customers cu ON c.customer_id = cu.id
WHERE c.id = ?;
```


```sql
--
SELECT
 COUNT(*) as total,
 SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) as unread,
 SUM(CASE WHEN type = 'new_message' THEN 1 ELSE 0 END) as messages,
 SUM(CASE WHEN priority = 'urgent' AND is_read = FALSE THEN 1 ELSE 0 END) as urgent_unread
FROM notifications
WHERE user_id = ?;
```

### 5. ****


- ****: KV 30
- ****: 5
- ****: 60


```typescript
class ConnectionManager {
 // 5
 checkConnectionLimit(userId: string): boolean {
 const current = this.activeConnections.get(userId) || 0;
 return current < 5;
 }

 //
 cleanupIdleConnections(): void {
 //
 }
}
```

### 6. ****


```typescript
// API
app.use('*', performanceMiddleware());

//
if (duration > 1000) {
 console.warn(`Slow response: ${path} took ${duration}ms`);
}
```


- ****:
- ****:
- ****:
- ****: SSE


- **API **: 60%
- ****: 70%
- ****: 85%+


- **CPU **: 40%
- ****: 30%
- ****: 50%


- **SSE **: 1000+
- **API **: 3x
- ****:


### 1. ****
```sql
--
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_status_updated ON conversations(status, updated_at);
```

### 2. **CDN **
```typescript
//
c.header('Cache-Control', 'public, max-age=300, s-maxage=600');
c.header('Vary', 'Accept-Encoding, Authorization');
```

### 3. ****
```typescript
//
const insertPromises = notifications.map(notification =>
 db.prepare(insertQuery).bind(...params).run()
);
await Promise.all(insertPromises);
```

### 4. ****
- Gzip
- JSON
- WebP


- **P95 **: < 200ms
- ****: < 0.1%
- ****: > 80%
- **SSE **: > 99%


- Cloudflare Analytics
-
-
-


### 1. ****
- (10+ )
- (1-5 )
-
-

### 2. ****
- N+1
-
-
-

### 3. ****
-
-
-
-

### 4. ****
-
-
-
-

---

****: Durable Objects 