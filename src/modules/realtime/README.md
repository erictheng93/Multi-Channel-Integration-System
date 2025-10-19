# Real-time v2.0.0

 SSE


- **** - Cloudflare Queue
- **SSE ** - Server-Sent Events
- **** - (v1/v2/modular)
- **** -
- **** - Real-time
- **** -
- **** -


```
src/modules/realtime/
 handlers/ #
 realtime-main.ts # ()
 sse-handler.ts # SSE
 event-handler.ts #
 index.ts #
 services/ #
 realtime-manager.ts #
 sse-connection-service.ts # SSE
 event-queue-service.ts #
 index.ts #
 middleware/ #
 realtime-auth.ts # Real-time
 connection-validation.ts #
 index.ts #
 types/ #
 realtime-types.ts #
 sse-types.ts # SSE
 event-types.ts #
 index.ts #
 monitoring/ #
 performance-monitor.ts #
 dashboard-handler.ts #
 config/ #
 version-selector.ts #
 index.ts #
 README.md #
```


```typescript
import { realtime } from '@/modules/realtime';

//
await realtime.initialize(env, {
 version: 'auto',
 enableEventDriven: true,
 enableQueueProcessing: true
});

//
await realtime.createEvent(
 'message',
 { content: 'Hello World', conversationId: 123 },
 { conversationId: 123 },
 'high'
);

//
const status = await realtime.getStatus();
```


```typescript
import { realtimeMainHandler, sseHandler, eventHandler } from '@/modules/realtime';

// SSE
app.get('/api/realtime/sse', realtimeMainHandler.sse);

//
app.post('/api/realtime/events/message', eventHandler.sendMessageEvent);

// SSE ()
app.get('/api/realtime/sse/enhanced', sseHandler.connect);
```


```typescript
import { realtimeAuth, sseConnectionValidation } from '@/modules/realtime';

//
app.use('/api/realtime/*', realtimeAuth());

// SSE
app.get('/api/realtime/sse', ...realtimeMiddleware.sse, handler);
```

## API


#### `realtimeMainHandler`
 Real-time

- `sse(context)` - SSE
- `sendTypingStatus(context)` -
- `broadcastToConversation(context)` -
- `getConversationStatus(context)` -
- `updateOnlineStatus(context)` -

#### `eventHandler`


- `sendMessageEvent(context)` -
- `sendTypingEvent(context)` -
- `sendStatusEvent(context)` -
- `sendAssignmentEvent(context)` -
- `sendNotificationEvent(context)` -
- `sendSystemEvent(context)` -


#### `RealtimeManager`
 Real-time

```typescript
const manager = RealtimeManager.getInstance();

//
await manager.initialize(env, config);

//
await manager.createEvent(eventType, data, targets, priority);

//
const health = await manager.getServiceHealth();

//
await manager.createBatchEvents(events);

//
await manager.performMaintenance('cleanup');
```

#### `SSEConnectionPool`
SSE

```typescript
const pool = new SSEConnectionPool(config);

//
const connectionId = await pool.createConnection(authPayload, conversationId, controller);

//
pool.sendToUser(userId, event);

//
pool.sendToConversation(conversationId, event);

//
pool.broadcast(event, filter);

//
pool.cleanupStaleConnections();
```


#### `RealtimePerformanceMonitor`


```typescript
const monitor = RealtimePerformanceMonitor.getInstance();

//
monitor.initialize(env);

//
monitor.startMonitoring(30); // 30

//
const metrics = monitor.getLatestMetrics();

//
const alerts = monitor.getActiveAlerts();

//
const summary = monitor.getPerformanceSummary();
```

#### `dashboardHandler`
 API

- `getOverview(context)` -
- `getMetrics(context)` -
- `getAlerts(context)` -
- `getConnections(context)` -
- `getHealth(context)` -
- `performMaintenance(context)` -


### RealtimeConfig

```typescript
interface RealtimeConfig {
 version: 'v1' | 'v2' | 'auto'; //
 enableEventDriven: boolean; //
 enableQueueProcessing: boolean; //
 heartbeatInterval: number; // (ms)
 connectionTimeout: number; // (ms)
 maxRetries: number; //
 eventStorageTtl: number; // TTL ()
}
```

### SSEConfig

```typescript
interface SSEConfig {
 heartbeatInterval: number; //
 connectionTimeout: number; //
 maxConnectionsPerUser: number; //
 enableCompression: boolean; //
 retryInterval: number; //
 maxRetryAttempts: number; //
}
```


### v1 (Legacy)
-
-
-

### v2 (Event-Driven)
-
- Cloudflare Queue
-

### Modular (Advanced)
-
-
-


```typescript
import { RealtimeVersionSelector } from '@/modules/realtime';

const selector = RealtimeVersionSelector.getInstance();

//
const selection = await selector.selectBestVersion(env, context);

//
selector.setVersion('v2');

//
const compatibility = selector.validateVersionCompatibility('modular', capabilities);
```


- ****:
- ****:
- **SSE **:
- ****:
- ****: KV


- > 5%
- > 1
- > 2%
- > 1000
- < 95%

### API

 REST API

```bash

GET /api/realtime/dashboard/overview


GET /api/realtime/dashboard/metrics?limit=50


GET /api/realtime/dashboard/alerts?active=true


GET /api/realtime/dashboard/connections


GET /api/realtime/dashboard/health


POST /api/realtime/dashboard/maintenance
{
 "operation": "cleanup",
 "target": "sse"
}
```


- ****: Header token Query token
- ****: Admin, Team, Agent
- ****:
- **JWT **: JWT token


- ****:
- ****:
- **Origin **:
- **User-Agent **:


```bash
# Real-time
npm run test -- src/modules/realtime


npm run test -- src/modules/realtime/handlers
npm run test -- src/modules/realtime/services
```


```bash
# SSE
npm run test -- tests/integration/realtime-sse.test.ts


npm run test -- tests/integration/realtime-events.test.ts


npm run test -- tests/performance/realtime-load.test.ts
```


1. **SSE **
 - token
 -
 -

2. ****
 - Cloudflare Queue
 -
 -

3. ****
 - : `pool.cleanupStaleConnections()`
 - : `eventStats.reset()`
 -


```typescript
//
const diagnostics = {
 service: await manager.getServiceHealth(),
 connections: await enhancedSSEManager.getStats(),
 performance: monitor.getPerformanceSummary(),
 version: selector.getCurrentCapabilities()
};

console.log(':', diagnostics);
```


1. ****
 -
 -
 -

2. ****
 -
 -
 -

3. ****
 -
 -
 -


```typescript
//
const highPerformanceConfig = {
 version: 'modular',
 enableEventDriven: true,
 enableQueueProcessing: true,
 heartbeatInterval: 5000, //
 connectionTimeout: 180000, //
 maxRetries: 2, //
 eventStorageTtl: 180 //
};

//
const highReliabilityConfig = {
 version: 'v2',
 enableEventDriven: true,
 enableQueueProcessing: true,
 heartbeatInterval: 10000, //
 connectionTimeout: 600000, //
 maxRetries: 5, //
 eventStorageTtl: 600 //
};
```


1. ** realtime.ts **:
 ```typescript
 //
 import { realtimeHandler } from '@/handlers/realtime';

 //
 import { realtimeMainHandler } from '@/modules/realtime';
 ```

2. ** realtime-v2.ts **:
 ```typescript
 //
 import { realtimeHandlerV2 } from '@/handlers/realtime-v2';

 //
 import { realtime } from '@/modules/realtime';
 //
 ```

3. ****:
 ```typescript
 //
 await realtime.initialize(env, {
 version: 'auto', //
 enableEventDriven: true,
 enableQueueProcessing: true
 });
 ```


### v2.0.0 ()
-
-
-
- SSE
-
- API
-
-

### v1.x ()
- SSE
-
-

---


 issue

****: Real-time Module Team
****: 2024-12-26
****: 2.0.0