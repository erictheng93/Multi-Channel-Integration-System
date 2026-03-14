# 硬編碼�?佳實踐�???

> ?? ?��?檔�?義�?案中硬編碼�?使用規�??��?佳實�?

## ?��?

- [概述](#概述)
- [什麼是硬編碼](#什麼是硬編�?
- [硬編碼�?類](#硬編碼�?�?
- [?�佳實踐](#?�佳實�?
- [常�?管�?系統](#常�?管�?系統)
- [�?��審查清單](#�?��審查清單)
- [常�??��?](#常�??��?)

---

## 概述

?��?案採??*?�格但實?��?硬編碼管?��???*�?
- ??**?�許?��??�硬編碼**：�???API URL?�業?�常?��?
- ?��? **?�小�?魔�??��?**：使?�命?�常?��??�可讀??
- ??**禁止?��?信息硬編�?*：�?不�?許�?證、�??��?

### ?��?評�?

| ?��? | 評�? | ?�??|
|------|------|------|
| ?�置?��? | 90/100 | ???��? |
| 外部依賴管�? | 100/100 | ???��? |
| 常�?管�? | 80/100 | ???�好 |
| ?��??�置覆�???| 85/100 | ???�好 |
| **總�?評�?** | **89/100** | **???��?** |

---

## 什麼是硬編�?

**硬編碼�?Hardcoding�?* ?��??�接?��?�?��中寫?�固定值�??��??��??�置?�件?�環境�??��?常�?定義??

### 示�?

```typescript
// ??硬編�?- 不推??
if (timeout > 5000) { ... }
const url = 'https://api.example.com';

// ??使用常�? - ?�薦
import { TIMEOUT_CONFIG } from '@/constants/limits';
if (timeout > TIMEOUT_CONFIG.API_REQUEST) { ... }

import { EXTERNAL_API_URL } from '@/config/external-apis';
const url = EXTERNAL_API_URL;
```

---

## 硬編碼�?�?

### ??類別 1: 完全?��??�硬編碼（�?許�?

?��?硬編碼是?�術�?必�?且�??��?�?

#### 1.1 外部 API 端�?

```typescript
// ??第�??��??��?官方 API URL
export const LINE_API = {
  baseUrl: 'https://api.line.me/v2/bot',
  dataApiUrl: 'https://api-data.line.me/v2/bot',
};

export const FACEBOOK_API = {
  baseUrl: 'https://graph.facebook.com/v18.0',
};
```

**?��?�?* 第�???API URL ?��??��?供�??��?，�??��?置�???

#### 1.2 CDN ?��??��?�?URL

```typescript
// ???��? CDN 資�?
export const LIFF_SDK = {
  sdk: 'https://static.line-scdn.net/liff/edge/2/sdk.js'
};

export const GOOGLE_FONTS = {
  css: 'https://fonts.googleapis.com/css2'
};
```

**?��?�?* CDN URL ?�公?��??��?資�?，�?該硬編碼以確保穩定性�?

#### 1.3 業�?常�?

```typescript
// ??業�?規�?常�?（�?清晰註�?�?
export const PLATFORM_MESSAGE_LIMITS = {
  LINE: 5000, // LINE 官方?�制
  FACEBOOK: 2000, // Facebook 官方?�制
  SYSTEM: 10000, // 系統?�部消息
};
```

**?��?�?* ?��??��?確�?業�?規�?，�??��??��?，�?該�??�常?��?義�?

---

### ?��? 類別 2: ?�接?��??�改?��?謹�?使用�?

#### 2.1 ?�發?��? URL

```typescript
// ?��? ?�接?��?但推?�使?��??��?�?
export const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8787',
  'http://127.0.0.1:3000',
];

// ???�好?�方式�?使用?��?變�?
const backendUrl = env.BACKEND_URL || 'http://localhost:8787';
```

**建議�?* ?��?使用?��?變�?，硬編碼?��???fallback??

#### 2.2 ?�置默�???

```typescript
// ?��? ?�接?��?但�?該命?�為常�?
const timeout = 5000;  // 不好
const pageSize = 20; // 不好

// ???�薦?��?
import { TIMEOUT_CONFIG, PAGINATION_LIMITS } from '@/constants/limits';
const timeout = TIMEOUT_CONFIG.API_REQUEST;
const pageSize = PAGINATION_LIMITS.DEFAULT_PAGE_SIZE;
```

---

### ??類別 3: 不�?許�?硬編碼�?禁止�?

#### 3.1 ?��?信息

```typescript
// ??絕�?禁止�?
const apiKey = 'sk-1234567890abcdef';
const password = 'admin123';
const jwtSecret = 'my-secret-key';

// ??�?��?��?：使?�環境�???
const apiKey = env.API_KEY;
const jwtSecret = env.JWT_SECRET;
```

#### 3.2 ?��??��??�置

```typescript
// ??不推??
if (window.location.hostname === 'example.com') { ... }

// ???�薦?��?
import { getEnvironment } from '@/config/runtime';
if (getEnvironment() === 'production') { ... }
```

#### 3.3 ?�命?��?魔�??��?

```typescript
// ??魔�??��? - ?��??�解?�義
setTimeout(() => { ... }, 60000);
if (users.length > 100) { ... }

// ??使用?��?常�?
import { TIME_LIMITS, PAGINATION_LIMITS } from '@/constants/limits';
setTimeout(() => { ... }, TIME_LIMITS.ONE_MINUTE_MS);
if (users.length > PAGINATION_LIMITS.MAX_PAGE_SIZE) { ... }
```

---

## ?�佳實�?

### 1. 使用 3-Layer ?�置?��?

```
Layer 1: ?��?變�?
  ??(.env, .dev.vars, wrangler.toml)
Layer 2: Runtime ?�置
  ??(config/runtime.ts, config/external-apis.ts)
Layer 3: 業�??�輯
  ??(handlers, services, components)
```

### 2. 外部 API ?�中管�?

?�?�第三方 API ?�置統�???`src/config/external-apis.ts`�?

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

### 3. 常�?統�?管�?

使用?�創建�?常�??�件�?

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

### 4. Durable Objects 路由管�?

使用 `src/constants/durable-objects.ts`�?

```typescript
import { MESSAGE_BROADCASTER_ROUTES } from '@/constants/durable-objects';

// ??清晰?�路?�常??
await broadcaster.fetch(MESSAGE_BROADCASTER_ROUTES.BROADCAST, { ... });

// ??不�?使用 localhost URL
await broadcaster.fetch('http://localhost/broadcast', { ... });
```

### 5. ?��? URL ?�置

```typescript
// ??使用?�置?�數
import { getBackendUrl, getStoragePublicUrl } from '@/config/runtime';

const apiUrl = getBackendUrl();
const storageUrl = getStoragePublicUrl();

// ??不�?硬編碼�???
const apiUrl = 'https://your-api-domain.example.com';
```

---

## 常�?管�?系統

### ?�件結�?

```
src/constants/
?��??� durable-objects.ts # Durable Objects 路由常�?
?��??� limits.ts # ?��??�大小、數?��???
?��??� (future files...)

src/config/
?��??� runtime.ts # ?��??��?置�??��?檢測�?
?��??� external-apis.ts # 外部 API ?�置
?��??� cors.ts # CORS ?�置
?��??� security.ts # 安全?�置
```

### 使用?��?

#### ?��??��?常�?

```typescript
import { TIME_LIMITS, TIMEOUT_CONFIG } from '@/constants/limits';

// 延遲
setTimeout(() => { ... }, TIME_LIMITS.FIVE_SECONDS_MS);

// 超�?
const response = await fetch(url, {
  signal: AbortSignal.timeout(TIMEOUT_CONFIG.API_REQUEST)
});
```

#### 大�??�制

```typescript
import { SIZE_LIMITS, LENGTH_LIMITS } from '@/constants/limits';

if (fileSize > SIZE_LIMITS.FILE_UPLOAD_MAX) {
  throw new Error('?�件?�大');
}

if (filename.length > LENGTH_LIMITS.FILENAME_MAX) {
  filename = truncate(filename, LENGTH_LIMITS.FILENAME_MAX);
}
```

#### ?��??�數

```typescript
import { PAGINATION_LIMITS, normalizePagination } from '@/constants/limits';

// 標�??��??��???
const { page, pageSize } = normalizePagination(
  req.query.page,
  req.query.pageSize
);
```

---

## �?��審查清單

?��?�?PR 之�?，�?檢查以�??�目�?

### ??必�?檢查

- [ ] **?��??�信?�硬編碼**
  - 檢查?�否??API keys, passwords, secrets
  - 使用?��?變�?存儲?�?��?�?

- [ ] **魔�??��?已命??*
  - ?��?常�?使用 `TIME_LIMITS` ??`TIMEOUT_CONFIG`
  - 大�??�制使用 `SIZE_LIMITS` ??`LENGTH_LIMITS`
  - ?��??�制使用 `PAGINATION_LIMITS` ??`QUEUE_LIMITS`

- [ ] **URL ?�置�?��**
  - 使用 `getBackendUrl()`, `getFrontendUrl()` 等函??
  - 不�?硬編碼�??��???
  - Durable Objects 使用路由常�?

- [ ] **TypeScript 類�?檢查?��?**
  - `npm run build` (後端)
  - `npm run type-check` (?�端)

### ?��? ?�薦檢查

- [ ] ?��?常�??�否添�?了註??
- [ ] ?�置?�件?�否?��??��? JSDoc ?��?
- [ ] ?�否?�慮了環境�??��?便利??
- [ ] ?�否?�單?�測試�??�新增常?��?使用

---

## 常�??��?

### Q1: 什麼�??��?該使?�硬編碼�?

**A:** ?�在以�??��?�?
1. 第�???API ?��???URL
2. ?��? CDN 資�?
3. 業�?規�?常�?（�??��??��?�?
4. ?�置默�??��?已命?�為常�?�?

### Q2: 如�??��??��??��??��?置�?

**A:** 使用 3-layer ?�置?��?�?

```typescript
// Layer 1: ?��?變�?�?env, .dev.vars�?
BACKEND_URL=https://api.example.com

// Layer 2: Runtime ?�置
export function getBackendUrl(): string {
  return env.BACKEND_URL || 'http://localhost:8787';
}

// Layer 3: 業�??�輯
const apiUrl = getBackendUrl();
```

### Q3: Durable Objects ?��?麼使?�相對路徑�?

**A:** Durable Objects ?�部?�信不�?要�???URL�?

```typescript
// ???�薦：使?�路?�常?��??��?路�?�?
await broadcaster.fetch(MESSAGE_BROADCASTER_ROUTES.BROADCAST, { ... });

// ?��? ?�術�??��?但�?清晰
await broadcaster.fetch('http://localhost/broadcast', { ... });
```

`http://localhost` ??Cloudflare Workers ?�內?�通信機制，�?使用?��?路�??��??��?

### Q4: 如�??�現?�代碼中?�到硬編碼�?

**A:** 使用以�??�索模�?�?

```bash
# ?�索 URL 硬編�?
grep -r "https://" src/

# ?�索魔�??��?
grep -r "\s[0-9]{4,}\s" src/

# ?�索 localhost
grep -r "localhost" src/
```

### Q5: ?��??��??��?何學習這�?規�?�?

**A:**
1. ?��??��?�?
2. ?��? `src/constants/` ?��?中�?示�?
3. Code Review ?�學習�?佳實�?
4. ?��?`docs/claude/ENVIRONMENT_CONFIG.md` 了解?�置?��?

---

## ?��??��?

- [?��??�置?��?](claude/ENVIRONMENT_CONFIG.md) - 詳細??3-layer ?�置?��?說�?
- [Testing Strategy](claude/TESTING.md) - 測試?�佳實�?
- [Route Registration](claude/ROUTE_REGISTRATION.md) - 路由註�?規�?

---

## ?�新?��?

### 2026-01-05
- ???�建統�?常�?管�?系統（`src/constants/`�?
- ??修正 Durable Objects URL 硬編�?
- ??修正?�端佔�?�?URL
- ??修正 TeamCard S3 ?��?硬編�?
- ???�新?�鍵?�件使用?�常??
- ???�建?��?佳實踐�?�?

---

**維護?��?** Claude Code AI Assistant
**?�後更?��?** 2026-01-05
**?�本�?* 1.0.0
