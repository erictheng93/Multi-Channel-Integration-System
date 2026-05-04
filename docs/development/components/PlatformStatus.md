# PlatformStatus

 Vue 3 LINEFacebook Messenger


PlatformStatus webhook

## (v2.1.0)


**:**
```typescript
interface PlatformMetrics {
 messagesReceived: number;
 messagesSent: number;
 activeUsers: number;
 responseTime: number;
 errorRate: number;
 uptime: number;
}
```

**:**
```typescript
interface PlatformMetrics {
 messagesCount?: number; //
 activeConversations?: number; //
 averageResponseTime?: number; //
 successRate?: number; // (0-1)
}
```

#### Webhook
**:**
```typescript
interface WebhookStatus {
 isHealthy: boolean;
 lastPing: Date | null;
 responseTime: number;
 errorCount: number;
}
```

**:**
```typescript
interface WebhookStatus {
 endpoint: string; // Webhook URL
 isActive: boolean; // Webhook
 lastVerified?: Date; //
 lastError?: string; //
}
```


1. ****:
2. ****:
3. ****: Webhook
4. ****:

## (Props)

| | | | |
|------|------|--------|------|
| `platform` | `'line' \| 'facebook'` | | |
| `status` | `'connected' \| 'disconnected' \| 'error' \| 'connecting'` | | |
| `showMetrics` | `boolean` | `true` | |
| `showHistory` | `boolean` | `false` | |
| `showSettings` | `boolean` | `true` | |
| `metrics` | `PlatformMetrics` | | |
| `webhookStatus` | `WebhookStatus` | | Webhook |

## (Events)

| | | |
|------|------|------|
| `connect` | `void` | |
| `disconnect` | `void` | |
| `test` | `void` | |
| `refresh` | `void` | |
| `settings` | `void` | |
| `status-change` | `string` | |


```vue
<template>
 <PlatformStatus
 platform="line"
 status="connected"
 @connect="handleConnect"
 @test="handleTest"
 @settings="openSettings"
 />
</template>
```


```vue
<template>
 <PlatformStatus
 platform="line"
 status="connected"
 :show-metrics="true"
 :metrics="{
 messagesCount: 150,
 activeConversations: 12,
 averageResponseTime: 2500,
 successRate: 0.95
 }"
 />
</template>
```

### Webhook
```vue
<template>
 <PlatformStatus
 platform="line"
 status="connected"
 :webhook-status="{
 endpoint: 'https://api.example.com/webhook',
 isActive: true,
 lastVerified: new Date(),
 lastError: undefined
 }"
 />
</template>
```


```vue
<template>
 <PlatformStatus
 platform="line"
 status="connected"
 :show-history="true"
 @refresh="handleRefresh"
 />
</template>
```


- ****:
- ****:
- ****: ...
- ****:


- **LINE**: LINE
- **Facebook**: Facebook


- ****:
- ****:
- ****: ms/s
- ****:


- ****:
- ****:
- ****:
- ****:

### Webhook
- ****: webhook
- ****: webhook
- ****:
- ****:


- ****:
- ****: /
- ****:
- ****:


 CSS

```css
.platform-status {
 --primary-color: #3b82f6;
 --success-color: #10b981;
 --warning-color: #f59e0b;
 --error-color: #ef4444;
 --gray-color: #6b7280;
}
```


- **LINE**: `#00C300` (LINE )
- **Facebook**: `#1877F2` (Facebook )


- **ARIA **:
- ****:
- ****: WCAG
- ****:


- **40 **
- **100% **
- ****
- ****ARIA


```bash
bun run test:run -- src/components/platform/PlatformStatus.test.ts
```


 webhook


```typescript
//
const oldMetrics = {
 messagesReceived: 100,
 messagesSent: 50,
 activeUsers: 25,
 responseTime: 1500,
 errorRate: 0.05,
 uptime: 0.99
}

//
const newMetrics = {
 messagesCount: oldMetrics.messagesReceived + oldMetrics.messagesSent,
 activeConversations: oldMetrics.activeUsers,
 averageResponseTime: oldMetrics.responseTime,
 successRate: 1 - oldMetrics.errorRate
}
```

### Webhook
```typescript
//
const oldWebhookStatus = {
 isHealthy: true,
 lastPing: new Date(),
 responseTime: 200,
 errorCount: 0
}

//
const newWebhookStatus = {
 endpoint: 'https://api.example.com/webhook',
 isActive: oldWebhookStatus.isHealthy,
 lastVerified: oldWebhookStatus.lastPing,
 lastError: oldWebhookStatus.errorCount > 0 ? '' : undefined
}
```


- ****: 30
- ****: `showHistory` true
- ****:
- ****:


- ****: Chrome 90+Firefox 88+Safari 14+
- ****: iOS Safari 14+Chrome Mobile 90+
- ****:

---

*202518*
*2.1.0*
*40/40 *