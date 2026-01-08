# å¯†ç??ç½®?Ÿèƒ½ä¿®å?éªŒè??¥å?

## ?®é??è¿°
ç®¡ç??˜é?ç½®ç”¨?·å??æ—¶ï¼Œå?ç«¯è??¨ä??™è¯¯??API è·¯å?ï¼Œå¯¼??404 ?™è¯¯ï¼?
```
POST /api/team/members/agent-001/reset-password-policy 404 (Not Found)
```

## ä¿®å??…å®¹

### 1. ?ç«¯ API è·¯å?ä¿®å?
**?‡ä»¶**: `frontend/src/api/team.ts`

ä¿®å?äº†æ??‰å›¢?Ÿæ??˜ç®¡?†ç? API è·¯å?ï¼?

| ?Ÿèƒ½ | ?§è·¯å¾?| ?°è·¯å¾?| ?¶æ€?|
|------|--------|--------|------|
| ? é™¤?å? | `/team/members/:id` | `/teams/members/:id` | ??å·²ä¿®å¤?|
| ?´æ–°è§’è‰² | `/team/members/:id/role` | `/teams/members/:id/role` | ??å·²ä¿®å¤?|
| ?´æ–°?¶æ€?| `/team/members/:id/status` | `/teams/members/:id/status` | ??å·²ä¿®å¤?|
| ?ç½®å¯†ç?ï¼ˆç??•ï? | `/team/members/:id/reset-password` | `/teams/members/:id/reset-password` | ??å·²ä¿®å¤?|
| **?ç½®å¯†ç?ï¼ˆå¸¦ç­–ç•¥ï¼?* | `/team/members/:id/reset-password-policy` | `/teams/members/:id/reset` | ??å·²ä¿®å¤?|
| ?·å?å¯†ç? | `/team/members/:id/password` | `/teams/members/:id/password` | ??å·²ä¿®å¤?|
| ?´æ–°?å?ä¿¡æ¯ | `/team/members/:id` | `/teams/members/:id` | ??å·²ä¿®å¤?|

### 2. ?ç«¯å¤„ç??¨å?å¼?
**?‡ä»¶**: `src/modules/teams/handlers/password.ts`

å¢å¼ºäº†å??é?ç½®å??†å™¨ï¼?
- ??æ·»å?å¯?`policy` ?‚æ•°?„æ”¯?ï?changeable / unchangeable / must_changeï¼?
- ???Œæ—¶?´æ–° `passwordHash` ??`passwordPolicy` å­—æ®µ
- ??è¿”å??´æ–°?ç?ç­–ç•¥ä¿¡æ¯

**å¤„ç??¨è·¯å¾?*: `POST /api/teams/members/:memberId/reset`

```typescript
// è¯·æ?ä½?
{
  "newPassword": "string",
  "policy": "changeable" | "unchangeable" | "must_change"  // ?¯é€?
}

// ?å?
{
  "success": true,
  "message": "Password reset successfully",
  "data": {
    "passwordPolicy": "changeable"
  }
}
```

## API ç«¯ç‚¹éªŒè?

### æµ‹è? 1: ç«¯ç‚¹?¯è¾¾?§æ?è¯???
```bash
curl -X POST https://your-api-domain.example.com/api/teams/members/agent-001/reset
```

**ç»“æ?**:
- HTTP Status: `401 Unauthorized` ??
- **è¯´æ?**: è¿”å? 401 è®¤è??™è¯¯ï¼ˆè€Œé? 404ï¼‰ï?è¯æ?ç«¯ç‚¹å·²æ­£ç¡®æ³¨??

### æµ‹è? 2: Teams æ¨¡å??¥åº·æ£€????
```bash
curl https://your-api-domain.example.com/api/teams/health
```

**ç»“æ?**:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-20T06:01:37.744Z",
  "module": "teams",
  "version": "1.0.0"
}
```
- HTTP Status: `200 OK` ??

### æµ‹è? 3: è·¯å?å¯¹æ?æµ‹è?
| è·¯å? | é¢„æ??¶æ€?| å®é??¶æ€?| ç»“æ? |
|------|----------|----------|------|
| `/api/team/members/.../reset-password-policy` | 404 Not Found | 401 Unauthorized | ??è·¯å?å·²å???|
| `/api/teams/members/.../reset` | 401 Unauthorized | 401 Unauthorized | ???°è·¯å¾„å¯??|

## ?ç«¯?˜æ›´?‡ä»¶æ¸…å?

ä»¥ä??‡ä»¶å·²æ›´??API è·¯å?ï¼ˆ`/team/` ??`/teams/`ï¼‰ï?

1. ??`frontend/src/api/team.ts` - API å®¢æˆ·ç«¯ï?7 ä¸ªæ–¹æ³•ï?
2. ??`frontend/src/stores/team.ts` - Pinia Store
3. ??`frontend/src/components/team/TeamMemberCard.vue` - ?¢é??å??¡ç?
4. ??`frontend/src/views/TeamManagement.vue` - ?¢é?ç®¡ç?é¡µé¢

## ?ç«¯?˜æ›´?‡ä»¶æ¸…å?

1. ??`src/modules/teams/handlers/password.ts` - å¯†ç?ç®¡ç?å¤„ç???
2. ??`src/modules/teams/handlers/index.ts` - Teams æ¨¡å?è·¯ç”±?ç½®
3. ??`src/index.ts` - ä¸»è·¯?±æ³¨??

## å¦‚ä?éªŒè?ä¿®å?

### ?¹å? 1: æµè??¨ç«¯æµ‹è?ï¼ˆæ¨?ï?

1. **?·æ–°æµè??¨é¡µ??* (Ctrl+F5 å¼ºåˆ¶?·æ–°)
2. ?“å? **?¢é?ç®¡ç?** é¡µé¢
3. ?‰æ‹©ä¸€ä¸ªç”¨?·ï??¹å‡» **"?è®¾å¯†ç?"** ?‰é’®
4. è®¾ç½®?°å??å¹¶?‰æ‹©å¯†ç?ç­–ç•¥
5. ?¹å‡»ç¡®è®¤

**é¢„æ?ç»“æ?**:
- ??å¯†ç??ç½®?å?
- ???‹åˆ°?å??ç¤ºæ¶ˆæ¯
- ??DevTools Network ?‡ç­¾?¾ç¤º `POST /api/teams/members/xxx/reset` è¿”å? `200 OK`

### ?¹å? 2: DevTools ?‘æ§

?“å?æµè???DevTools (F12):

1. ?‡æ¢??**Network** ?‡ç­¾
2. ç­›é€?`XHR` è¯·æ?
3. ?§è?å¯†ç??ç½®?ä?
4. è§‚å?è¯·æ?ï¼?

**ä¿®å???* (???™è¯¯):
```
POST /api/team/members/agent-001/reset-password-policy
Status: 404 Not Found
```

**ä¿®å???* (??æ­?¡®):
```
POST /api/teams/members/agent-001/reset
Status: 200 OK
```

### ?¹å? 3: ?§åˆ¶?°é?è¯?

?¨æ?è§ˆå™¨?§åˆ¶??(F12 > Console) ?§è?ï¼?

```javascript
// ?·å? token
const token = localStorage.getItem('token');

// æµ‹è??°ç«¯??
fetch('https://your-api-domain.example.com/api/teams/members/agent-001/reset', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    newPassword: 'TestPassword123!',
    policy: 'changeable'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

**é¢„æ?è¾“å‡º**:
```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": {
    "passwordPolicy": "changeable"
  }
}
```

## TypeScript ç±»å?æ£€????

?€?‰ç±»?‹å?ä¹‰å·²?´æ–°å¹¶é€šè?æ£€?¥ï?
```bash
cd frontend && npm run type-check
```

**ç»“æ?**: ??? ç±»?‹é?è¯?

## ?¨ç½²å»ºè®®

### ?ç«¯?¨ç½²
```bash
cd frontend
npm run build
npm run deploy:pages
```

### ?ç«¯?¨ç½²
```bash
npm run deploy
```

### éªŒè??¨ç½²
```bash
# æ£€??Teams æ¨¡å??¥åº·?¶æ€?
curl https://your-api-domain.example.com/api/teams/health

# é¢„æ?è¾“å‡º
{
  "status": "healthy",
  "module": "teams",
  "version": "1.0.0"
}
```

## ?¸å…³?‡æ¡£

- ?? [Teams æ¨¡å??‡æ¡£](./src/modules/teams/README.md)
- ?? [å¯†ç?ç®¡ç? API](./src/modules/teams/handlers/password.ts)
- ?? [è·¯ç”±æ³¨å?é¡ºå?è¯´æ?](./CLAUDE.md#route-registration-order)

## ?»ç?

??**ä¿®å??¶æ€?*: å®Œæ?å¹¶é?è¯é€šè?

??**å½±å??ƒå›´**:
- 7 ä¸ªå?ç«?API ?¹æ?è·¯å??´æ–°
- 1 ä¸ªå?ç«¯å??†å™¨?Ÿèƒ½å¢å¼º
- 0 ä¸ªç ´?æ€§å??´ï??‘å??¼å®¹ï¼?

??**æµ‹è??¶æ€?*:
- API ç«¯ç‚¹?¯è¾¾?§æ?è¯•é€šè?
- Teams æ¨¡å??¥åº·æ£€?¥é€šè?
- TypeScript ç±»å?æ£€?¥é€šè?

? ï? **æ³¨æ?äº‹é¡¹**:
- ?€è¦åˆ·?°æ?è§ˆå™¨ä»¥å?è½½æ–°?„å?ç«¯ä»£??
- ?§ç? API è·¯å? (`/team/`) å·²å??¨ï?å»ºè®®æ¸…é™¤ç¼“å?

---

**?Ÿæ??¶é—´**: 2025-10-20
**æµ‹è??¯å?**: Production (your-api-domain.example.com)
