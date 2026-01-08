# ç¡¬ç·¨ç¢¼æ?ä½³å¯¦è¸æ???

> ?? ?¬æ?æª”å?ç¾©å?æ¡ˆä¸­ç¡¬ç·¨ç¢¼ç?ä½¿ç”¨è¦ç??Œæ?ä½³å¯¦è¸?

## ?®é?

- [æ¦‚è¿°](#æ¦‚è¿°)
- [ä»€éº¼æ˜¯ç¡¬ç·¨ç¢¼](#ä»€éº¼æ˜¯ç¡¬ç·¨ç¢?
- [ç¡¬ç·¨ç¢¼å?é¡](#ç¡¬ç·¨ç¢¼å?é¡?
- [?€ä½³å¯¦è¸](#?€ä½³å¯¦è¸?
- [å¸¸é?ç®¡ç?ç³»çµ±](#å¸¸é?ç®¡ç?ç³»çµ±)
- [ä»?¢¼å¯©æŸ¥æ¸…å–®](#ä»?¢¼å¯©æŸ¥æ¸…å–®)
- [å¸¸è??é?](#å¸¸è??é?)

---

## æ¦‚è¿°

?¬å?æ¡ˆæ¡??*?´æ ¼ä½†å¯¦?¨ç?ç¡¬ç·¨ç¢¼ç®¡?†ç???*ï¼?
- ??**?è¨±?ˆç??„ç¡¬ç·¨ç¢¼**ï¼šå???API URL?æ¥­?™å¸¸?ç?
- ? ï? **?€å°å?é­”è??¸å?**ï¼šä½¿?¨å‘½?å¸¸?æ??‡å¯è®€??
- ??**ç¦æ­¢?æ?ä¿¡æ¯ç¡¬ç·¨ç¢?*ï¼šç?ä¸å?è¨±æ?è­‰ã€å??°ç?

### ?´é?è©•å?

| ?‡æ? | è©•å? | ?€??|
|------|------|------|
| ?ç½®?¶æ? | 90/100 | ???ªç? |
| å¤–éƒ¨ä¾è³´ç®¡ç? | 100/100 | ???ªç? |
| å¸¸é?ç®¡ç? | 80/100 | ???¯å¥½ |
| ?•æ??ç½®è¦†è???| 85/100 | ???¯å¥½ |
| **ç¸½é?è©•å?** | **89/100** | **???ªç?** |

---

## ä»€éº¼æ˜¯ç¡¬ç·¨ç¢?

**ç¡¬ç·¨ç¢¼ï?Hardcodingï¼?* ?¯æ??´æ¥?¨æ?ä»?¢¼ä¸­å¯«?¥å›ºå®šå€¼ï??Œé??šé??ç½®?‡ä»¶?ç’°å¢ƒè??æ?å¸¸é?å®šç¾©??

### ç¤ºä?

```typescript
// ??ç¡¬ç·¨ç¢?- ä¸æ¨??
if (timeout > 5000) { ... }
const url = 'https://api.example.com';

// ??ä½¿ç”¨å¸¸é? - ?¨è–¦
import { TIMEOUT_CONFIG } from '@/constants/limits';
if (timeout > TIMEOUT_CONFIG.API_REQUEST) { ... }

import { EXTERNAL_API_URL } from '@/config/external-apis';
const url = EXTERNAL_API_URL;
```

---

## ç¡¬ç·¨ç¢¼å?é¡?

### ??é¡åˆ¥ 1: å®Œå…¨?ˆç??„ç¡¬ç·¨ç¢¼ï¼ˆå?è¨±ï?

?™ä?ç¡¬ç·¨ç¢¼æ˜¯?€è¡“ä?å¿…è?ä¸”å??†ç?ï¼?

#### 1.1 å¤–éƒ¨ API ç«¯é?

```typescript
// ??ç¬¬ä??¹æ??™ç?å®˜æ–¹ API URL
export const LINE_API = {
  baseUrl: 'https://api.line.me/v2/bot',
  dataApiUrl: 'https://api-data.line.me/v2/bot',
};

export const FACEBOOK_API = {
  baseUrl: 'https://graph.facebook.com/v18.0',
};
```

**?Ÿå?ï¼?* ç¬¬ä???API URL ?±æ??™æ?ä¾›å??ºå?ï¼Œä??‰é?ç½®å???

#### 1.2 CDN ?Œé??‹è?æº?URL

```typescript
// ???¬é? CDN è³‡æ?
export const LIFF_SDK = {
  sdk: 'https://static.line-scdn.net/liff/edge/2/sdk.js'
};

export const GOOGLE_FONTS = {
  css: 'https://fonts.googleapis.com/css2'
};
```

**?Ÿå?ï¼?* CDN URL ?¯å…¬?‹ç??ºå?è³‡æ?ï¼Œæ?è©²ç¡¬ç·¨ç¢¼ä»¥ç¢ºä¿ç©©å®šæ€§ã€?

#### 1.3 æ¥­å?å¸¸é?

```typescript
// ??æ¥­å?è¦å?å¸¸é?ï¼ˆæ?æ¸…æ™°è¨»é?ï¼?
export const PLATFORM_MESSAGE_LIMITS = {
  LINE: 5000,       // LINE å®˜æ–¹?åˆ¶
  FACEBOOK: 2000,   // Facebook å®˜æ–¹?åˆ¶
  SYSTEM: 10000,    // ç³»çµ±?§éƒ¨æ¶ˆæ¯
};
```

**?Ÿå?ï¼?* ?™ä??¯æ?ç¢ºç?æ¥­å?è¦å?ï¼Œæ??‡æ??¯æ?ï¼Œæ?è©²ä??ºå¸¸?å?ç¾©ã€?

---

### ? ï? é¡åˆ¥ 2: ?¯æ¥?—ä??‰æ”¹?²ï?è¬¹æ?ä½¿ç”¨ï¼?

#### 2.1 ?‹ç™¼?°å? URL

```typescript
// ? ï? ?¯æ¥?—ï?ä½†æ¨?¦ä½¿?¨å??‹é?ç½?
export const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8787',
  'http://127.0.0.1:3000',
];

// ???´å¥½?„æ–¹å¼ï?ä½¿ç”¨?°å?è®Šé?
const backendUrl = env.BACKEND_URL || 'http://localhost:8787';
```

**å»ºè­°ï¼?* ?¡é?ä½¿ç”¨?°å?è®Šé?ï¼Œç¡¬ç·¨ç¢¼?…ä???fallback??

#### 2.2 ?ç½®é»˜è???

```typescript
// ? ï? ?¯æ¥?—ï?ä½†æ?è©²å‘½?ç‚ºå¸¸é?
const timeout = 5000;  // ä¸å¥½
const pageSize = 20;   // ä¸å¥½

// ???¨è–¦?¹å?
import { TIMEOUT_CONFIG, PAGINATION_LIMITS } from '@/constants/limits';
const timeout = TIMEOUT_CONFIG.API_REQUEST;
const pageSize = PAGINATION_LIMITS.DEFAULT_PAGE_SIZE;
```

---

### ??é¡åˆ¥ 3: ä¸å?è¨±ç?ç¡¬ç·¨ç¢¼ï?ç¦æ­¢ï¼?

#### 3.1 ?æ?ä¿¡æ¯

```typescript
// ??çµ•å?ç¦æ­¢ï¼?
const apiKey = 'sk-1234567890abcdef';
const password = 'admin123';
const jwtSecret = 'my-secret-key';

// ??æ­?¢º?¹å?ï¼šä½¿?¨ç’°å¢ƒè???
const apiKey = env.API_KEY;
const jwtSecret = env.JWT_SECRET;
```

#### 3.2 ?°å??¹å??ç½®

```typescript
// ??ä¸æ¨??
if (window.location.hostname === 'example.com') { ... }

// ???¨è–¦?¹å?
import { getEnvironment } from '@/config/runtime';
if (getEnvironment() === 'production') { ... }
```

#### 3.3 ?ªå‘½?ç?é­”è??¸å?

```typescript
// ??é­”è??¸å? - ?¡æ??†è§£?«ç¾©
setTimeout(() => { ... }, 60000);
if (users.length > 100) { ... }

// ??ä½¿ç”¨?½å?å¸¸é?
import { TIME_LIMITS, PAGINATION_LIMITS } from '@/constants/limits';
setTimeout(() => { ... }, TIME_LIMITS.ONE_MINUTE_MS);
if (users.length > PAGINATION_LIMITS.MAX_PAGE_SIZE) { ... }
```

---

## ?€ä½³å¯¦è¸?

### 1. ä½¿ç”¨ 3-Layer ?ç½®?¶æ?

```
Layer 1: ?°å?è®Šé?
  ??(.env, .dev.vars, wrangler.toml)
Layer 2: Runtime ?ç½®
  ??(config/runtime.ts, config/external-apis.ts)
Layer 3: æ¥­å??è¼¯
  ??(handlers, services, components)
```

### 2. å¤–éƒ¨ API ?†ä¸­ç®¡ç?

?€?‰ç¬¬ä¸‰æ–¹ API ?ç½®çµ±ä???`src/config/external-apis.ts`ï¼?

```typescript
export const LINE_API = {
  baseUrl: 'https://api.line.me/v2/bot',
  endpoints: {
    reply: '/message/reply',
    push: '/message/push',
    // ...
  }
};
```

### 3. å¸¸é?çµ±ä?ç®¡ç?

ä½¿ç”¨?°å‰µå»ºç?å¸¸é??‡ä»¶ï¼?

```typescript
// src/constants/limits.ts
export const TIME_LIMITS = {
  ONE_SECOND_MS: 1000,
  ONE_MINUTE_MS: 60 * 1000,
  ONE_HOUR_MS: 60 * 60 * 1000,
  // ...
};

export const TIMEOUT_CONFIG = {
  DATABASE_QUERY: 5000,
  API_REQUEST: 10000,
  // ...
};
```

### 4. Durable Objects è·¯ç”±ç®¡ç?

ä½¿ç”¨ `src/constants/durable-objects.ts`ï¼?

```typescript
import { MESSAGE_BROADCASTER_ROUTES } from '@/constants/durable-objects';

// ??æ¸…æ™°?„è·¯?±å¸¸??
await broadcaster.fetch(MESSAGE_BROADCASTER_ROUTES.BROADCAST, { ... });

// ??ä¸è?ä½¿ç”¨ localhost URL
await broadcaster.fetch('http://localhost/broadcast', { ... });
```

### 5. ?•æ? URL ?ç½®

```typescript
// ??ä½¿ç”¨?ç½®?½æ•¸
import { getBackendUrl, getStoragePublicUrl } from '@/config/runtime';

const apiUrl = getBackendUrl();
const storageUrl = getStoragePublicUrl();

// ??ä¸è?ç¡¬ç·¨ç¢¼å???
const apiUrl = 'https://your-api-domain.example.com';
```

---

## å¸¸é?ç®¡ç?ç³»çµ±

### ?‡ä»¶çµæ?

```
src/constants/
?œâ??€ durable-objects.ts    # Durable Objects è·¯ç”±å¸¸é?
?œâ??€ limits.ts             # ?‚é??å¤§å°ã€æ•¸?é???
?”â??€ (future files...)

src/config/
?œâ??€ runtime.ts            # ?‹è??‚é?ç½®ï??°å?æª¢æ¸¬ï¼?
?œâ??€ external-apis.ts      # å¤–éƒ¨ API ?ç½®
?œâ??€ cors.ts               # CORS ?ç½®
?”â??€ security.ts           # å®‰å…¨?ç½®
```

### ä½¿ç”¨?‡å?

#### ?‚é??¸é?å¸¸é?

```typescript
import { TIME_LIMITS, TIMEOUT_CONFIG } from '@/constants/limits';

// å»¶é²
setTimeout(() => { ... }, TIME_LIMITS.FIVE_SECONDS_MS);

// è¶…æ?
const response = await fetch(url, {
  signal: AbortSignal.timeout(TIMEOUT_CONFIG.API_REQUEST)
});
```

#### å¤§å??åˆ¶

```typescript
import { SIZE_LIMITS, LENGTH_LIMITS } from '@/constants/limits';

if (fileSize > SIZE_LIMITS.FILE_UPLOAD_MAX) {
  throw new Error('?‡ä»¶?å¤§');
}

if (filename.length > LENGTH_LIMITS.FILENAME_MAX) {
  filename = truncate(filename, LENGTH_LIMITS.FILENAME_MAX);
}
```

#### ?†é??ƒæ•¸

```typescript
import { PAGINATION_LIMITS, normalizePagination } from '@/constants/limits';

// æ¨™æ??–å??å???
const { page, pageSize } = normalizePagination(
  req.query.page,
  req.query.pageSize
);
```

---

## ä»?¢¼å¯©æŸ¥æ¸…å–®

?¨æ?äº?PR ä¹‹å?ï¼Œè?æª¢æŸ¥ä»¥ä??…ç›®ï¼?

### ??å¿…é?æª¢æŸ¥

- [ ] **?¡æ??Ÿä¿¡?¯ç¡¬ç·¨ç¢¼**
  - æª¢æŸ¥?¯å¦??API keys, passwords, secrets
  - ä½¿ç”¨?°å?è®Šé?å­˜å„²?€?‰æ?è­?

- [ ] **é­”è??¸å?å·²å‘½??*
  - ?‚é?å¸¸é?ä½¿ç”¨ `TIME_LIMITS` ??`TIMEOUT_CONFIG`
  - å¤§å??åˆ¶ä½¿ç”¨ `SIZE_LIMITS` ??`LENGTH_LIMITS`
  - ?¸é??åˆ¶ä½¿ç”¨ `PAGINATION_LIMITS` ??`QUEUE_LIMITS`

- [ ] **URL ?ç½®æ­?¢º**
  - ä½¿ç”¨ `getBackendUrl()`, `getFrontendUrl()` ç­‰å‡½??
  - ä¸è?ç¡¬ç·¨ç¢¼ç??¢å???
  - Durable Objects ä½¿ç”¨è·¯ç”±å¸¸é?

- [ ] **TypeScript é¡å?æª¢æŸ¥?šé?**
  - `npm run build` (å¾Œç«¯)
  - `npm run type-check` (?ç«¯)

### ? ï? ?¨è–¦æª¢æŸ¥

- [ ] ?°å?å¸¸é??¯å¦æ·»å?äº†è¨»??
- [ ] ?ç½®?‡ä»¶?¯å¦?‰å??´ç? JSDoc ?‡æ?
- [ ] ?¯å¦?ƒæ…®äº†ç’°å¢ƒå??›ç?ä¾¿åˆ©??
- [ ] ?¯å¦?‰å–®?ƒæ¸¬è©¦è??‹æ–°å¢å¸¸?ç?ä½¿ç”¨

---

## å¸¸è??é?

### Q1: ä»€éº¼æ??™æ?è©²ä½¿?¨ç¡¬ç·¨ç¢¼ï¼?

**A:** ?…åœ¨ä»¥ä??…æ?ï¼?
1. ç¬¬ä???API ?„å???URL
2. ?¬é? CDN è³‡æ?
3. æ¥­å?è¦å?å¸¸é?ï¼ˆæ??‡æ??¯æ?ï¼?
4. ?ç½®é»˜è??¼ï?å·²å‘½?ç‚ºå¸¸é?ï¼?

### Q2: å¦‚ä??•ç??°å??¹å??„é?ç½®ï?

**A:** ä½¿ç”¨ 3-layer ?ç½®?¶æ?ï¼?

```typescript
// Layer 1: ?°å?è®Šé?ï¼?env, .dev.varsï¼?
BACKEND_URL=https://api.example.com

// Layer 2: Runtime ?ç½®
export function getBackendUrl(): string {
  return env.BACKEND_URL || 'http://localhost:8787';
}

// Layer 3: æ¥­å??è¼¯
const apiUrl = getBackendUrl();
```

### Q3: Durable Objects ?ºä?éº¼ä½¿?¨ç›¸å°è·¯å¾‘ï?

**A:** Durable Objects ?§éƒ¨?šä¿¡ä¸é?è¦å???URLï¼?

```typescript
// ???¨è–¦ï¼šä½¿?¨è·¯?±å¸¸?ï??¸å?è·¯å?ï¼?
await broadcaster.fetch(MESSAGE_BROADCASTER_ROUTES.BROADCAST, { ... });

// ? ï? ?€è¡“ä??¯è?ä½†ä?æ¸…æ™°
await broadcaster.fetch('http://localhost/broadcast', { ... });
```

`http://localhost` ??Cloudflare Workers ?„å…§?¨é€šä¿¡æ©Ÿåˆ¶ï¼Œä?ä½¿ç”¨?¸å?è·¯å??´æ??°ã€?

### Q4: å¦‚ä??¨ç¾?‰ä»£ç¢¼ä¸­?¾åˆ°ç¡¬ç·¨ç¢¼ï?

**A:** ä½¿ç”¨ä»¥ä??œç´¢æ¨¡å?ï¼?

```bash
# ?œç´¢ URL ç¡¬ç·¨ç¢?
grep -r "https://" src/

# ?œç´¢é­”è??¸å?
grep -r "\s[0-9]{4,}\s" src/

# ?œç´¢ localhost
grep -r "localhost" src/
```

### Q5: ?˜é??°æ??¡å?ä½•å­¸ç¿’é€™ä?è¦ç?ï¼?

**A:**
1. ?±è??¬æ?æª?
2. ?¥ç? `src/constants/` ?®é?ä¸­ç?ç¤ºä?
3. Code Review ?‚å­¸ç¿’æ?ä½³å¯¦è¸?
4. ?ƒè€?`docs/claude/ENVIRONMENT_CONFIG.md` äº†è§£?ç½®?¶æ?

---

## ?¸é??‡æ?

- [?°å??ç½®?‡å?](claude/ENVIRONMENT_CONFIG.md) - è©³ç´°??3-layer ?ç½®?¶æ?èªªæ?
- [Testing Strategy](claude/TESTING.md) - æ¸¬è©¦?€ä½³å¯¦è¸?
- [Route Registration](claude/ROUTE_REGISTRATION.md) - è·¯ç”±è¨»å?è¦ç?

---

## ?´æ–°?¥è?

### 2026-01-05
- ???µå»ºçµ±ä?å¸¸é?ç®¡ç?ç³»çµ±ï¼ˆ`src/constants/`ï¼?
- ??ä¿®æ­£ Durable Objects URL ç¡¬ç·¨ç¢?
- ??ä¿®æ­£?ç«¯ä½”ä?ç¬?URL
- ??ä¿®æ­£ TeamCard S3 ?Ÿå?ç¡¬ç·¨ç¢?
- ???´æ–°?œéµ?‡ä»¶ä½¿ç”¨?°å¸¸??
- ???µå»º?¬æ?ä½³å¯¦è¸æ?æª?

---

**ç¶­è­·?…ï?** Claude Code AI Assistant
**?€å¾Œæ›´?°ï?** 2026-01-05
**?ˆæœ¬ï¼?* 1.0.0
