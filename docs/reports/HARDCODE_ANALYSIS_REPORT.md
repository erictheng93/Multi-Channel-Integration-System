# ç¡¬ç·¨ç¢¼å?é¡Œå??è??ªå??±å?

**?Ÿæ??¥æ?**: 2025-12-31
**å°ˆæ?**: Multi-Channel Customer Support System
**?†æ?ç¯„å?**: å®Œæ•´ä»?¢¼åº?(Backend + Frontend)

---

## ?? ?·è??˜è?

?¬å ±?Šç³»çµ±æ€§åœ°æª¢æ¸¬äº†æ•´?‹å?æ¡ˆä¸­?„ç¡¬ç·¨ç¢¼?é?ï¼Œç™¼?¾ä»¥ä¸‹ä¸»è¦å?é¡Œé??¥ï?

| é¡åˆ¥ | ?¼ç¾?¸é? | ?ªå?ç´?| ?€??|
|------|---------|--------|------|
| ç¡¬ç·¨ç¢?URLs ??API ç«¯é? | 80+ | ?”´ é«?| ?€?ªå? |
| é­”è??¸å??Œé??¶å€?| 75+ | ?Ÿ¡ ä¸?| ?¨å?å·²å„ª??|
| ?ç½®??(è§’è‰²?ç??‹ç?) | 150+ | ?”´ é«?| ?€?ªå? |
| ?¯èª¤è¨Šæ¯ | 60+ (å¾Œç«¯) + 19+ (?ç«¯) | ?Ÿ¢ ä½?| ?¯æ¥??|
| **ç¸½è?** | **384+** | - | **60% ?€?ªå?** |

---

## ?”´ é«˜å„ª?ˆç??é?

### 1. ç¡¬ç·¨ç¢?URLs ??API ç«¯é?

#### ?é??´é???
- **å½±éŸ¿ç¯„å?**: 80+ ?‹ç¡¬ç·¨ç¢¼ URL
- **é¢¨éšª**: ?°å??‡æ??°é›£?éƒ¨ç½²é?ç½®éŒ¯èª¤ã€å??¨æ€§å?é¡?
- **ç¶­è­·?æœ¬**: é«?- æ¯æ¬¡?°å?è®Šæ›´?€ä¿®æ”¹å¤šè?

#### è©³ç´°?†é?

##### A. ?Ÿç”¢?Ÿå? (3?‹ä¸»è¦å??ï?24+ å¼•ç”¨ä½ç½®)

**ä¸»è??Ÿå?**: `https://your-api-domain.example.com`
- ?ºç¾ä½ç½®: 24+ ?‹æ?ä»?
- å½±éŸ¿æ¨¡ç?: CORS?å??¨é?ç½®ã€APIå®¢æˆ¶ç«¯ã€WebSocket??¥
- ?œéµ?‡ä»¶:
  ```
  src/config/cors.ts:12
  src/config/security.ts:45
  frontend/src/api/base.ts:328
  frontend/src/services/websocketClient.ts:347
  ```

**æ¬¡è??Ÿå?**:
- `https://multi-channel-platform-frontend.pages.dev` (Cloudflare Pages)
- `https://your-frontend-domain.example.com` (MCP Frontend)

##### B. ?‹ç™¼?°å? Localhost (12+ ?ç½®)

**Frontend Development (Port 3000)**:
```
http://localhost:3000      - 10+ å¼•ç”¨
https://localhost:3000     - 6 å¼•ç”¨
http://127.0.0.1:3000      - 4 å¼•ç”¨
```

**Backend Development (Port 8787)**:
```
http://localhost:8787      - 15+ å¼•ç”¨
```

?ºç¾ä½ç½®:
```typescript
// ??ç¡¬ç·¨ç¢¼ç¤ºä¾?
src/config/cors.ts:17-24
frontend/vite.config.ts:16
frontend/vitest.setup.ts:15
```

##### C. å¤–éƒ¨ API ç«¯é? (30+ ??

**LINE Messaging API** (14 ?‹ç«¯é»?:
```
https://api.line.me/v2/bot/message/reply
https://api.line.me/v2/bot/message/push
https://api.line.me/v2/bot/message/multicast
https://api.line.me/v2/bot/profile/{userId}
... ç­?10+ ?‹ç«¯é»?
```
ä½ç½®: `src/utils/line.ts` (22-1046è¡?

**Facebook Graph API** (6 ?‹ç«¯é»?:
```
https://graph.facebook.com/v18.0/me/messages
https://graph.facebook.com/v18.0/{pageId}
... ç­?
```
ä½ç½®: `src/durable-objects/DelayedMessageScheduler.ts:1217`

**?¶ä?å¤–éƒ¨?å?**:
- QR Code ?Ÿæ?: `https://api.qrserver.com/v1/create-qr-code/`
- Unicode Emoji: `https://unicode.org/Public/emoji/15.1/emoji-test.txt`
- Google Fonts: `https://fonts.googleapis.com/css2?family=...`
- LINE LIFF SDK: `https://static.line-scdn.net/liff/edge/2/sdk.js`

##### D. Cloudflare API ç«¯é? (Web Installer)

```
https://dash.cloudflare.com/oauth2/auth
https://dash.cloudflare.com/oauth2/token
https://api.cloudflare.com/client/v4
https://api.resend.com/emails
```
ä½ç½®: `web-installer/backend/src/routes/oauth.ts`

#### ?? çµ±è??¸æ?

| URL é¡å? | ?¸é? | å½±éŸ¿?‡ä»¶??|
|---------|------|-----------|
| ?Ÿç”¢?Ÿå? | 3 | 24+ |
| ?‹ç™¼?°å? | 4 | 18+ |
| LINE API | 14 | 8 |
| Facebook API | 6 | 5 |
| å¤–éƒ¨?å? | 8+ | 10+ |
| Cloudflare API | 4 | 4 |
| **ç¸½è?** | **39+** | **69+ ?‡ä»¶** |

---

### 2. ç¡¬ç·¨ç¢¼é?ç½®å€?(è§’è‰²?ç??‹ã€é???

#### A. è§’è‰²?ç¨± (Role Names)

**ç¡¬ç·¨ç¢¼å€?*: `'admin'`, `'agent'`, `'team'`
**?ºç¾æ¬¡æ•¸**: 150+ æ¬?
**å½±éŸ¿?‡ä»¶**: 25+ ??

**å¾Œç«¯?œéµä½ç½®**:
```typescript
// ??ç¡¬ç·¨ç¢¼ç¤ºä¾?
src/db/schema.ts:23              // è³‡æ?åº?schema
src/enterprise/rbac.ts:80-232    // 40+ æ¬¡ç¡¬ç·¨ç¢¼
src/middleware/auth.ts           // èªè?ä¸­é?ä»?
src/handlers/message.ts          // è¨Šæ¯?•ç?
src/utils/auth.ts:368,394,406    // èªè?å·¥å…·
```

**?ç«¯?œéµä½ç½®**:
```typescript
// ??ç¡¬ç·¨ç¢¼ç¤ºä¾?
frontend/src/views/TeamManagement.vue:1082-1385  // 10+ æ¬?
frontend/src/views/ActivityLog.vue:345
frontend/src/components/team/TeamMemberCard.vue:154,166
```

#### B. è¨Šæ¯?€?‹å€?(Message Status)

**ç¡¬ç·¨ç¢¼å€?*: `'pending'`, `'sent'`, `'delivered'`, `'failed'`
**?ºç¾æ¬¡æ•¸**: 50+ æ¬?
**å½±éŸ¿?‡ä»¶**: 12+ ??

**?œéµä½ç½®**:
```typescript
// ??ç¡¬ç·¨ç¢¼ç¤ºä¾?
src/utils/drizzle-converters.ts:73,232
src/handlers/attachment.ts:39
src/handlers/delayed-message-drizzle.ts:190,267,309,333,385...
```

#### C. å°è©±?€?‹å€?(Conversation Status)

**ç¡¬ç·¨ç¢¼å€?*: `'active'`, `'closed'`, `'pending'`, `'in-progress'`
**?ºç¾æ¬¡æ•¸**: 40+ æ¬?
**å½±éŸ¿?‡ä»¶**: 10+ ??

**?œéµä½ç½®**:
```typescript
// ??ç¡¬ç·¨ç¢¼ç¤ºä¾?
src/handlers/conversation.ts:255,271,303,1098,1173
src/utils/team.ts:321
src/handlers/customer.ts:29,109,259
```

#### D. ?¼é€è€…é???(Sender Types)

**ç¡¬ç·¨ç¢¼å€?*: `'customer'`, `'agent'`, `'system'`
**?ºç¾æ¬¡æ•¸**: 30+ æ¬?
**å½±éŸ¿?‡ä»¶**: 8+ ??

**?œéµä½ç½®**:
```typescript
// ??ç¡¬ç·¨ç¢¼ç¤ºä¾?
src/db/schema.ts:132
src/durable-objects/CustomerMessageDO.ts:20
src/utils/drizzle-converters.ts:68
```

#### E. å¹³å°?ç¨± (Platform Names)

**ç¡¬ç·¨ç¢¼å€?*: `'LINE'`, `'FACEBOOK'`, `'SYSTEM'`, `'ADMIN'`
**?ºç¾æ¬¡æ•¸**: 20+ æ¬?

**?œéµä½ç½®**:
```typescript
// ??ç¡¬ç·¨ç¢¼ç¤ºä¾?
src/modules/file-management/constants/file-config.ts:116-152
```

#### ?? ?ç½®?¼çµ±è¨?

| ?ç½®é¡å? | ?¨ç‰¹?¼æ•¸??| ç¸½å‡º?¾æ¬¡??| å½±éŸ¿?‡ä»¶??|
|---------|-----------|-----------|-----------|
| è§’è‰²?ç¨± | 3 | 150+ | 25+ |
| è¨Šæ¯?€??| 4 | 50+ | 12+ |
| å°è©±?€??| 4 | 40+ | 10+ |
| ?¼é€è€…é???| 3 | 30+ | 8+ |
| å¹³å°?ç¨± | 4 | 20+ | 5+ |
| **ç¸½è?** | **18** | **290+** | **60+ ?‡ä»¶** |

---

## ?Ÿ¡ ä¸­å„ª?ˆç??é?

### 3. é­”è??¸å??Œç¡¬ç·¨ç¢¼?åˆ¶??

#### å·²å„ª?–ç??¨å? ??

ä»¥ä??ç½®å·²ç??¯å¥½?†ä¸­?–ï?

**A. KV ?ç½®** - `src/config/kv-config.ts`
```typescript
??TTL ?? 24 ?‹å·²?ç½® (SESSION, MESSAGE_PENDING, CACHE_*)
???¹æ¬¡?ä?: 5 ?‹å·²?ç½® (MAX_BATCH_SIZE, MAX_PARALLEL_OPS...)
??å£“ç¸®è¨­å?: 3 ?‹å·²?ç½®
```

**B. ?‡ä»¶?ç½®** - `src/modules/file-management/constants/file-config.ts`
```typescript
???‡ä»¶å¤§å??åˆ¶: 7 ?‹å·²?ç½® (10MB, 5MB, 20MB...)
???•ç??¸é?: 4 ?‹å·²?ç½® (ç¸®å?å°ºå¯¸, è³ªé?...)
??ä¸Šå‚³?åˆ¶: 5 ?‹å·²?ç½® (20/min, 100/hour, 100MB/hour)
```

**C. CORS ?ç½®** - `src/config/cors.ts`
```typescript
??ALLOWED_ORIGINS ?—è¡¨
??CORS_HEADERS ?ç½®
??è¼”åŠ©?½æ•¸
```

**D. ?Ÿèƒ½?‹é?** - `frontend/src/config/features.ts`
```typescript
??QR_BACKGROUND_PRELOAD ?‡æ¨?ºç™¾?†æ?
??ç¶²è·¯æ¢ä»¶?§åˆ¶
???ªå?ç´šæ??é?ç½?
```

#### ä»é??ªå??„éƒ¨??? ï?

**A. è¶…æ??¼å???* (8+ ?‹ä?ç½?
```typescript
// ???†æ•£?¨å??‹æ?ä»?
frontend/src/services/globalWebSocket.ts:17    // retryDelay = 5000
frontend/src/stores/notifications.ts:98        // setTimeout(..., 5000)
frontend/src/composables/usePerformanceMonitor.ts:204  // setInterval(..., 5000)
frontend/src/composables/useMessageDebounce.ts:51      // delay = 500
```

**B. ?ˆèƒ½?¾å€?* (5+ ?‹ä?ç½?
```typescript
// ??ç¡¬ç·¨ç¢¼åœ¨çµ„ä»¶ä¸?
frontend/src/composables/usePerformanceMonitor.ts:161  // delta > 33.33
frontend/src/composables/usePerformanceMonitor.ts:314  // metrics.value.lcp > 2500
frontend/src/composables/usePerformanceMonitor.ts:318  // metrics.value.fid > 100
```

**C. ?†é??åˆ¶** (4+ ?‹ä?ç½?
```typescript
// ???†æ•£??handlers
src/handlers/message.ts:30                    // pageSize = 50
frontend/src/stores/notifications.ts:35       // pageSize: 20
frontend/src/api/notifications.ts:170         // limit = 10
```

**D. LINE API ?åˆ¶** (5+ ?‹ä?ç½?
```typescript
// ??ç¡¬ç·¨ç¢¼åœ¨ line.ts
src/utils/line.ts:151    // messages.length > 5
src/utils/line.ts:167    // BATCH_SIZE = 500
src/utils/line.ts:735    // maxLength = 30
```

#### ?? é­”è??¸å?çµ±è?

| é¡åˆ¥ | å·²å„ª????| ?€?ªå? ? ï? | ç¸½è? |
|------|----------|----------|------|
| Timeout/Delay | 0 | 8 | 8 |
| ?‡ä»¶å¤§å??åˆ¶ | 7 | 0 | 7 |
| ?†é??åˆ¶ | 0 | 4 | 4 |
| KV TTL | 24 | 0 | 24 |
| ?¹æ¬¡?ä? | 5 | 0 | 5 |
| å£“ç¸®è¨­å? | 3 | 0 | 3 |
| ä¸Šå‚³?åˆ¶ | 5 | 0 | 5 |
| å¿«å??ç½® | 4 | 0 | 4 |
| ?ˆèƒ½?¾å€?| 0 | 5 | 5 |
| API ?åˆ¶ | 0 | 5 | 5 |
| **ç¸½è?** | **48 (64%)** | **22 (36%)** | **70** |

---

## ?Ÿ¢ ä½å„ª?ˆç??é?

### 4. HTTP ?€?‹ç¢¼

**?€??*: ?¯æ¥??- æ¨™æ? HTTP ?€?‹ç¢¼?šå¸¸?´æ¥ä½¿ç”¨

**?ºç¾ä½ç½®**: 30+ ?‹æ?ä»?
```typescript
// ?¶å?å¯¦è? (?¯æ¥??
return c.json({ error: 'Unauthorized' }, 401)
return c.json({ success: true }, 200)
```

**?¯é¸?ªå?**: å¦‚æ?è¿½æ?æ¥µè‡´ä¸€?´æ€§ï??¯ä»¥?µå»ºå¸¸é?

### 5. ?¯èª¤è¨Šæ¯

**?€??*: ?¯æ¥??- ?¯èª¤è¨Šæ¯?šå¸¸?€è¦å…·é«”ç?ä¸Šä???

**?¼ç¾?¸é?**:
- å¾Œç«¯: 60+ ?‹æ?ä»¶ä½¿??`throw new Error("...")`
- ?ç«¯: 19+ ?‹æ?ä»¶ä½¿??`throw new Error("...")`

**?¶å?å¯¦è?**:
```typescript
// ä¸Šä??‡ç‰¹å®šç??¯èª¤è¨Šæ¯ (?¯æ¥??
throw new Error(`User ${userId} not found`)
throw new Error('Invalid conversation ID')
```

**?¯é¸?ªå?**: å°æ–¼å¸¸è??¯èª¤è¨Šæ¯ï¼Œå¯ä»¥è€ƒæ…®?µå»º?¯èª¤å­—å…¸

---

## ??å·²å„ª?–è‰¯å¥½ç??¨å?

### 1. KV ?ç½®ç³»çµ±
- **?‡ä»¶**: `src/config/kv-config.ts`
- **è¦†è?ç¯„å?**: å®Œæ•´??KV ?½å?ç©ºé??TTL?æ‰¹æ¬¡æ?ä½œé?ç½?
- **è©•å?**: â­â?â­â?â­?(5/5)

### 2. ?‡ä»¶ç®¡ç??ç½®
- **?‡ä»¶**: `src/modules/file-management/constants/file-config.ts`
- **è¦†è?ç¯„å?**: ?‡ä»¶å¤§å??é??‹ã€ä??³é??¶ã€è??†é¸??
- **è©•å?**: â­â?â­â?â­?(5/5)

### 3. CORS ?ç½®
- **?‡ä»¶**: `src/config/cors.ts`
- **è¦†è?ç¯„å?**: ?è¨±ä¾†æ??æ??­ã€è??©å‡½??
- **è©•å?**: â­â?â­â?â­?(5/5)

### 4. å®‰å…¨?ç½®
- **?‡ä»¶**: `src/config/security.ts`
- **è¦†è?ç¯„å?**: CSP?å??¨æ??­ã€ä¿¡ä»»ä?æº?
- **è©•å?**: â­â?â­â???(4/5)

### 5. ?Ÿèƒ½?‹é?
- **?‡ä»¶**: `frontend/src/config/features.ts`
- **è¦†è?ç¯„å?**: ?Ÿèƒ½æ¨™è??æ¨?ºç™¾?†æ??å„ª?ˆç?
- **è©•å?**: â­â?â­â?â­?(5/5)

---

## ?¯ ?ªå?å»ºè­°

### ?ªå?ç´?1: ç«‹å³?·è?

#### 1.1 å»ºç?å¸¸é?å®šç¾©?‡ä»¶

**?µå»ºä»¥ä??°æ?ä»?*:

```typescript
// src/constants/roles.ts
export const ROLES = {
  ADMIN: 'admin',
  AGENT: 'agent',
  TEAM: 'team'
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];
```

```typescript
// src/constants/message-status.ts
export const MESSAGE_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed'
} as const;

export type MessageStatus = typeof MESSAGE_STATUS[keyof typeof MESSAGE_STATUS];
```

```typescript
// src/constants/conversation-status.ts
export const CONVERSATION_STATUS = {
  ACTIVE: 'active',
  CLOSED: 'closed',
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress'
} as const;

export type ConversationStatus = typeof CONVERSATION_STATUS[keyof typeof CONVERSATION_STATUS];
```

```typescript
// src/constants/sender-types.ts
export const SENDER_TYPES = {
  CUSTOMER: 'customer',
  AGENT: 'agent',
  SYSTEM: 'system'
} as const;

export type SenderType = typeof SENDER_TYPES[keyof typeof SENDER_TYPES];
```

```typescript
// src/constants/platforms.ts
export const PLATFORMS = {
  LINE: 'LINE',
  FACEBOOK: 'FACEBOOK',
  SYSTEM: 'SYSTEM',
  ADMIN: 'ADMIN'
} as const;

export type Platform = typeof PLATFORMS[keyof typeof PLATFORMS];
```

#### 1.2 ?°å??ç½®?´å?

**?µå»ºçµ±ä??„ç’°å¢ƒé?ç½?*:

```typescript
// src/config/environment.ts
export const ENV_CONFIG = {
  development: {
    frontend: {
      url: process.env.DEV_FRONTEND_URL || 'http://localhost:3000',
      port: 3000
    },
    backend: {
      url: process.env.DEV_BACKEND_URL || 'http://localhost:8787',
      port: 8787
    }
  },
  production: {
    frontend: {
      url: process.env.PROD_FRONTEND_URL || 'https://your-api-domain.example.com'
    },
    backend: {
      url: process.env.PROD_BACKEND_URL || 'https://your-api-domain.example.com'
    }
  }
};

export const getCurrentEnv = () => {
  return process.env.NODE_ENV === 'production' ? ENV_CONFIG.production : ENV_CONFIG.development;
};
```

#### 1.3 å¤–éƒ¨ API ?ç½®?†ä¸­??

```typescript
// src/config/external-apis.ts
export const EXTERNAL_APIS = {
  LINE: {
    baseUrl: 'https://api.line.me/v2/bot',
    endpoints: {
      reply: '/message/reply',
      push: '/message/push',
      multicast: '/message/multicast',
      broadcast: '/message/broadcast',
      quota: '/message/quota',
      quotaConsumption: '/message/quota/consumption',
      profile: '/profile/{userId}',
      groupMember: '/group/{groupId}/member/{userId}',
      info: '/info',
      webhook: '/channel/webhook/endpoint'
    }
  },
  FACEBOOK: {
    baseUrl: 'https://graph.facebook.com/v18.0',
    endpoints: {
      sendMessage: '/me/messages',
      userInfo: '/{userId}',
      pageInfo: '/{pageId}',
      tokenRefresh: '/oauth/access_token'
    }
  },
  QR_CODE: {
    baseUrl: 'https://api.qrserver.com/v1',
    endpoints: {
      create: '/create-qr-code/'
    }
  },
  CLOUDFLARE: {
    dashboardUrl: 'https://dash.cloudflare.com',
    apiUrl: 'https://api.cloudflare.com/client/v4'
  }
};
```

### ?ªå?ç´?2: ?­æ??·è? (1-2??

#### 2.1 ?†ä¸­?–è??‚é?ç½?

```typescript
// src/config/timeouts.ts
export const TIMEOUTS = {
  WEBSOCKET: {
    RETRY_DELAY: 5000,
    RECONNECT_DELAY: 1000,
    INIT_DELAY: 500
  },
  NOTIFICATION: {
    ERROR_DISPLAY_DURATION: 5000,
    POLLING_INTERVAL: 30000
  },
  PERFORMANCE: {
    MEMORY_MONITOR_INTERVAL: 5000,
    TTI_MEASUREMENT: 0
  },
  DEBOUNCE: {
    MESSAGE_SEND: 500
  }
} as const;
```

#### 2.2 ?†ä¸­?–å??é?ç½?

```typescript
// src/config/pagination.ts
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  NOTIFICATIONS_PAGE_SIZE: 20,
  RECENT_NOTIFICATIONS_LIMIT: 10,
  MAX_PAGE_SIZE: 100
} as const;
```

#### 2.3 ?†ä¸­?–æ??½é–¾??

```typescript
// src/config/performance-thresholds.ts
export const PERFORMANCE_THRESHOLDS = {
  FPS: {
    FRAME_DROP_MS: 33.33,  // ~30 FPS
    MEASUREMENT_WINDOW_MS: 1000,
    MIN_ACCEPTABLE_FPS: 50
  },
  CORE_WEB_VITALS: {
    LCP_MS: 2500,
    FID_MS: 100,
    CLS: 0.1
  },
  MEMORY: {
    WARNING_PERCENT: 70
  }
} as const;
```

### ?ªå?ç´?3: ä¸­æ??·è? (1-2?‹æ?)

#### 3.1 å¤§è?æ¨¡é?æ§?- ?¿æ?ç¡¬ç·¨ç¢?

**å½±éŸ¿?€å¤§ç??‡ä»¶?€è¦é?æ§?*:

1. **`src/enterprise/rbac.ts`** (40+ ?‹ç¡¬ç·¨ç¢¼è§’è‰²å¼•ç”¨)
   - ?¿æ???`ROLES` å¸¸é?
   - ?è?å½±éŸ¿: 40+ è¡Œç?å¼ç¢¼

2. **`src/handlers/conversation.ts`** (15+ ?‹ç¡¬ç·¨ç¢¼?€?‹å€?
   - ?¿æ???`CONVERSATION_STATUS` å¸¸é?
   - ?è?å½±éŸ¿: 15+ è¡Œç?å¼ç¢¼

3. **`frontend/src/views/TeamManagement.vue`** (10+ ?‹ç¡¬ç·¨ç¢¼è§’è‰²æª¢æŸ¥)
   - ?¿æ??ºå?ç«¯è??²å¸¸??
   - ?è?å½±éŸ¿: 10+ è¡Œç?å¼ç¢¼

4. **`src/handlers/delayed-message-drizzle.ts`** (12+ ?‹ç¡¬ç·¨ç¢¼?€?‹å€?
   - ?¿æ???`MESSAGE_STATUS` å¸¸é?
   - ?è?å½±éŸ¿: 12+ è¡Œç?å¼ç¢¼

#### 3.2 å»ºç??·ç§»?‡å?

?µå»º `docs/guides/HARDCODE_MIGRATION_GUIDE.md` ?…å«:
- æ­¥é??‡å?
- ç¯„ä?ç¨‹å?ç¢?
- æ¸¬è©¦ç­–ç•¥
- ?æ»¾è¨ˆå?

---

## ?? ?ªå??ˆç?è©•ä¼°

### ?å??‡æ?

| ?‡æ? | ?ªå???| ?ªå?å¾?| ?¹å? |
|------|--------|--------|------|
| ç¡¬ç·¨ç¢¼é?ç½®å€?| 290+ | 0 | 100% |
| ?€ä¿®æ”¹?‡ä»¶??(?°å??‡æ?) | 69+ | 3 | 95.7% |
| ç¶­è­·è¤‡é?åº?| é«?| ä½?| - |
| ?ç½®?¯èª¤é¢¨éšª | é«?| ä½?| - |
| æ¸¬è©¦è¦†è???| ?¨å? | å®Œæ•´ | - |

### è³ªå??ˆç?

#### ?‹ç™¼?ˆç?
- ???°é??¼è€…å¯ä»¥å¿«?Ÿæ‰¾?°é?ç½®ä?ç½?
- ??æ¸›å??ç½®?¸é???bug
- ???é?ä»?¢¼?¯è???

#### ç¶­è­·??
- ???°å??‡æ??ªé?ä¿®æ”¹ 3 ?‹é?ç½®æ?ä»?
- ??çµ±ä??„é?ç½®ç®¡??
- ???´å®¹?“é€²è??ç½®é©—è?

#### ?¯æ“´å±•æ€?
- ??æ·»å??°ç’°å¢ƒæ›´å®¹æ?
- ???¯æ??´å?å¤–éƒ¨å¹³å°
- ???Ÿèƒ½?‹é??´é?æ´?

---

## ??ï¸?å¯¦æ–½è¨ˆå?

### ?æ®µ 1: ?ºç?è¨­æ–½ (Week 1-2)

- [ ] ?µå»º?€?‰å¸¸?å?ç¾©æ?ä»?
- [ ] ?µå»ºçµ±ä??„ç’°å¢ƒé?ç½?
- [ ] ?µå»ºå¤–éƒ¨ API ?ç½®
- [ ] å»ºç??®å?æ¸¬è©¦

**?è?å·¥æ?**: 16 å°æ?
**é¢¨éšª**: ä½?

### ?æ®µ 2: ?¹é??¿æ? (Week 3-4)

- [ ] å¾Œç«¯è§’è‰²å¸¸é??¿æ? (25+ ?‡ä»¶)
- [ ] å¾Œç«¯?€?‹å¸¸?æ›¿??(20+ ?‡ä»¶)
- [ ] ?ç«¯å¸¸é??¿æ? (15+ ?‡ä»¶)
- [ ] ?´æ–°?€?‰æ¸¬è©?

**?è?å·¥æ?**: 32 å°æ?
**é¢¨éšª**: ä¸?

### ?æ®µ 3: é©—è??‡å„ª??(Week 5-6)

- [ ] å®Œæ•´?æ­¸æ¸¬è©¦
- [ ] ?ˆèƒ½æ¸¬è©¦
- [ ] ?‡æ??´æ–°
- [ ] Code Review

**?è?å·¥æ?**: 16 å°æ?
**é¢¨éšª**: ä½?

### ç¸½è?

- **ç¸½å·¥??*: 64 å°æ? (ç´?8 ?‹å·¥ä½œæ—¥)
- **ç¸½é¢¨??*: ä¸­ä?
- **?æ?å®Œæ?**: 6 ??

---

## ?? æª¢æŸ¥æ¸…å–®

### ?ªå?ç´?1 (å¿…é??·è?)

- [ ] ?µå»º `src/constants/roles.ts`
- [ ] ?µå»º `src/constants/message-status.ts`
- [ ] ?µå»º `src/constants/conversation-status.ts`
- [ ] ?µå»º `src/constants/sender-types.ts`
- [ ] ?µå»º `src/constants/platforms.ts`
- [ ] ?µå»º `src/config/environment.ts`
- [ ] ?µå»º `src/config/external-apis.ts`
- [ ] ?´æ–° `src/enterprise/rbac.ts` (40+ å¼•ç”¨)
- [ ] ?´æ–° `frontend/src/views/TeamManagement.vue` (10+ å¼•ç”¨)
- [ ] ?µå»º?ç«¯å°æ?å¸¸é??‡ä»¶

### ?ªå?ç´?2 (å»ºè­°?·è?)

- [ ] ?µå»º `src/config/timeouts.ts`
- [ ] ?µå»º `src/config/pagination.ts`
- [ ] ?µå»º `src/config/performance-thresholds.ts`
- [ ] ?µå»º `src/config/line-api-limits.ts`
- [ ] ?´æ–°?€?‰ä½¿?¨ç¡¬ç·¨ç¢¼è¶…æ??„æ?ä»?(8+ ??
- [ ] ?´æ–°?€?‰ä½¿?¨ç¡¬ç·¨ç¢¼?†é??„æ?ä»?(4+ ??

### ?ªå?ç´?3 (?¯é¸?·è?)

- [ ] ?µå»º `src/constants/http-status.ts`
- [ ] ?µå»º?¯èª¤è¨Šæ¯å­—å…¸ (å¦‚é?è¦?
- [ ] å»ºç??ç½®é©—è?ç³»çµ±
- [ ] å»ºç??ç½®?‡æ??Ÿæ???

---

## ?? ?€ä½³å¯¦è¸å»ºè­?

### 1. ?ç½®ç®¡ç??Ÿå?

```typescript
// ??å¥½ç?å¯¦è?
import { ROLES } from '@/constants/roles';
if (user.role === ROLES.ADMIN) { ... }

// ???¿å??„å¯¦è¸?
if (user.role === 'admin') { ... }
```

### 2. ?°å??ç½®?Ÿå?

```typescript
// ??å¥½ç?å¯¦è?
import { getCurrentEnv } from '@/config/environment';
const apiUrl = getCurrentEnv().backend.url;

// ???¿å??„å¯¦è¸?
const apiUrl = 'http://localhost:8787';
```

### 3. é¡å?å®‰å…¨?Ÿå?

```typescript
// ??å¥½ç?å¯¦è? - ä½¿ç”¨ const assertion ?Œé??‹æ¨å°?
export const ROLES = {
  ADMIN: 'admin',
  AGENT: 'agent'
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// ???¿å??„å¯¦è¸?- ç´”å?ç¬¦ä¸²
export type Role = 'admin' | 'agent';
```

### 4. ?ç½®?‡ä»¶çµ„ç?

```
src/
?œâ??€ constants/          # æ¥­å?å¸¸é? (è§’è‰²?ç??‹ç?)
??  ?œâ??€ roles.ts
??  ?œâ??€ message-status.ts
??  ?”â??€ ...
?œâ??€ config/            # ç³»çµ±?ç½®
??  ?œâ??€ environment.ts
??  ?œâ??€ external-apis.ts
??  ?œâ??€ kv-config.ts
??  ?”â??€ ...
?”â??€ modules/
    ?”â??€ [module]/
        ?”â??€ constants/  # æ¨¡ç??¹å?å¸¸é?
```

---

## ?? ?ƒè€ƒè?æº?

### ?¸é??‡æ?
- `CLAUDE.md` - å°ˆæ?ç¸½é??‡æ?
- `docs/CORS_CONFIGURATION_GUIDE.md` - CORS ?ç½®ç¯„ä?
- `src/config/kv-config.ts` - KV ?ç½®ç¯„ä?
- `src/modules/file-management/constants/file-config.ts` - ?‡ä»¶?ç½®ç¯„ä?

### å¤–éƒ¨?ƒè€?
- [TypeScript const assertions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions)
- [12-Factor App Config](https://12factor.net/config)
- [Environment Variables Best Practices](https://blog.bitsrc.io/a-gentle-introduction-to-environment-variables-9ad4fcca5c)

---

## ?? ?„é?: å®Œæ•´çµ±è?è¡?

### A. ç¡¬ç·¨ç¢¼å?é¡Œå?å¸?

| ?é?é¡å? | å¾Œç«¯ | ?ç«¯ | Web Installer | ç¸½è? |
|---------|------|------|---------------|------|
| URLs/Endpoints | 45+ | 20+ | 4 | 69+ |
| ?ç½®??| 180+ | 110+ | - | 290+ |
| é­”è??¸å? | 40+ | 30+ | - | 70+ |
| ?¯èª¤è¨Šæ¯ | 60+ | 19+ | - | 79+ |
| **ç¸½è?** | **325+** | **179+** | **4** | **508+** |

### B. ?‡ä»¶å½±éŸ¿ç¯„å?

| æ¨¡ç? | ?€ä¿®æ”¹?‡ä»¶??| ?è?å·¥æ? |
|------|-------------|---------|
| èªè??‡æ?æ¬?| 15+ | 8h |
| å°è©±ç®¡ç? | 12+ | 6h |
| è¨Šæ¯?•ç? | 18+ | 10h |
| ?˜é?ç®¡ç? | 10+ | 5h |
| ?ç«¯è¦–å? | 15+ | 8h |
| ?ç½®?‡ä»¶ | 8+ | 4h |
| æ¸¬è©¦?‡ä»¶ | 20+ | 10h |
| **ç¸½è?** | **98+ ?‡ä»¶** | **51 å°æ?** |

---

**?±å?çµæ?**

*å¦‚é??´è©³ç´°ç?å¯¦æ–½?‡å??–ç‰¹å®šå?é¡Œç?è§?±º?¹æ?ï¼Œè??ƒè€ƒæœ¬?±å??„ç›¸?œç?ç¯€?–è¯ç¹«é??¼å??Šã€?
