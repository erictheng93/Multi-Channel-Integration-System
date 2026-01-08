# ?? æ¸ é?ç®¡ç?ç³»ç? - Phase 2 å®Œæ??¥å?

## ??Phase 2: ?ç«¯ API å¼€??- **å®Œæ? (100%)**

**å®æ–½?¶é—´:** 2025-10-27
**?¶æ€?** ???€?‰ä»»?¡å·²å®Œæ?
**?»è?åº?** Phase 2/5 (40%)

---

## ?“¦ **å·²å??ç?å·¥ä?æ±‡æ€?*

### 1. ChannelService (ä¸šåŠ¡?»è?å±?

**?‡ä»¶:** `src/modules/integrations/services/channel-service.ts` (600+ è¡?

#### **å®ç°?„æ–¹æ³?(14ä¸?**

```typescript
??createChannel(request)              // ?›å»ºæ¸ é??ç½®
   ?”â? ?Ÿèƒ½: æ£€?¥é?å¤ã€ç???Webhook URL?ä?å­˜é?ç½?
   ?”â? è¿”å?: å®Œæ•´?„æ??“å¯¹è±?+ webhookUrl

??verifyChannel(request)              // éªŒè?æ¸ é??ç½®
   ?”â? ?Ÿèƒ½: æµ‹è? LINE API è¿æ¥?æ›´?°é?è¯çŠ¶??
   ?”â? è¿”å?: éªŒè?ç»“æ? + è¯¦ç?ä¿¡æ¯

??verifyLineChannel(channel)          // LINE ä¸“å?éªŒè?
   ?”â? ?Ÿèƒ½: è°ƒç”¨ LINE OAuth verify endpoint
   ?”â? è¿”å?: éªŒè??¶æ€?+ client_id + è¿‡æ??¶é—´

??getChannel(channelId)               // ?·å??•ä¸ªæ¸ é?
   ?”â? ?Ÿèƒ½: ?¹æ® ID ?¥è¯¢æ¸ é?
   ?”â? è¿”å?: ChannelIntegration | null

??getChannelsByTeam(teamId, platform) // ?·å??¢é?æ¸ é??—è¡¨
   ?”â? ?Ÿèƒ½: ?¥è¯¢?¢é??€?‰æ??“ï??¯æ?å¹³å°è¿‡æ»¤ï¼?
   ?”â? è¿”å?: ChannelIntegration[]

??updateChannel(request)              // ?´æ–°æ¸ é??ç½®
   ?”â? ?Ÿèƒ½: ?´æ–°?ç½®?æ?è®°æœªéªŒè?ï¼ˆå??œæ”¹äº?credentialsï¼?
   ?”â? è¿”å?: ?´æ–°?ç?æ¸ é?å¯¹è±¡

??deactivateChannel(channelId)        // ?œç”¨æ¸ é?
   ?”â? ?Ÿèƒ½: è½¯å??¤ï?è®¾ç½® isActive = falseï¼?
   ?”â? è¿”å?: boolean

??generateWebhookUrl(options)         // ?Ÿæ? Webhook URL
   ?”â? ?¼å?: https://domain/api/webhooks/{platform}/{teamId}/{token}
   ?”â? è¿”å?: å®Œæ•´??webhook URL å­—ç¬¦ä¸?

??getChannelStatistics(channelId)     // ?·å?ç»Ÿè®¡ä¿¡æ¯
   ?”â? è¿”å?: ?‘é€??¥æ”¶æ¶ˆæ¯?°ã€æ??æ??¯æ—¶?´ã€åœ¨çº¿æ—¶??

??getChannelByWebhookToken()          // Webhook è·¯ç”±?¥è¯¢
   ?”â? ?Ÿèƒ½: ?¹æ® teamId + token ?¥è¯¢æ¸ é?ï¼ˆç”¨äº?webhook è·¯ç”±ï¼?
   ?”â? è¿”å?: ChannelIntegration | null

??incrementMessageCounter(id, dir)    // æ¶ˆæ¯è®¡æ•°
   ?”â? ?Ÿèƒ½: å¢å??‘é€??¥æ”¶æ¶ˆæ¯è®¡æ•°
   ?”â? ?¹å?: 'sent' | 'received'

??checkChannelHealth(channelId)       // ?¥åº·æ£€??
   ?”â? è¿”å?: ?¥åº·?¶æ€?+ ?™è¯¯æ¬¡æ•° + å»ºè®®

??updateChannelError(channelId, error) // ?™è¯¯è¿½è¸ª
   ?”â? ?Ÿèƒ½: è®°å??™è¯¯ä¿¡æ¯?å?? é?è¯¯è®¡??
   ?”â? ?…éƒ¨?¹æ?ï¼Œç”¨äºé?è¯¯å???

??generateWebhookUrlInternal()        // Webhook URL ?Ÿæ?ï¼ˆå??¨ï?
   ?”â? ?…éƒ¨?¹æ?ï¼Œç??ä?å±?URL
```

#### **?¹æ??Ÿèƒ½å®ç°**

**1. LINE API éªŒè?**
```typescript
// è°ƒç”¨ LINE OAuthéªŒè?ç«¯ç‚¹
const response = await fetch('https://api.line.me/v2/oauth/verify', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${channel.lineChannelAccessToken}`
  }
});

// è¿”å?ç»“æ?:
{
  client_id: "1234567890",
  expires_in: 2591622  // ?©ä??‰æ??¶é—´ï¼ˆç?ï¼?
}
```

**2. Webhook URL ?Ÿæ?ç­–ç•¥**
```typescript
?¼å?: https://your-api-domain.example.com/api/webhooks/line/1/a3b5c7d9

ç»„æ??¨å?:
?œâ? base URL: ä»?R2_PUBLIC_URL è½¬æ¢?Œæ¥
?œâ? platform: 'line' | 'facebook' | 'whatsapp'
?œâ? teamId: ?¢é??°æ®åº?ID
?”â? token: crypto.randomUUID() (å®‰å…¨?æœºä»¤ç?)

?¹ç‚¹:
??æ¯ä¸ª?¢é?ä¸“å?
???¨å??¯ä?ï¼ˆæ•°?®å??¯ä?çº¦æ?ï¼?
???ªåŠ¨è·¯ç”±?°æ­£ç¡®é?ç½?
??Token éªŒè??²æ­¢ä¼ªé€?
```

**3. ?™è¯¯è¿½è¸ª?ºåˆ¶**
```typescript
await this.updateChannelError(channelId, {
  timestamp: new Date().toISOString(),
  errorType: 'verification_failed',
  errorMessage: 'LINE API returned 401',
  retryAttempt: (channel.errorCount || 0) + 1,
  context: {
    stack: error.stack,
    endpoint: '/v2/oauth/verify'
  }
});

å­˜å‚¨?¼å? (JSON):
{
  "timestamp": "2025-10-27T14:30:00Z",
  "errorType": "verification_failed",
  "errorMessage": "LINE API returned 401",
  "retryAttempt": 3,
  "context": { ... }
}
```

---

### 2. Channel Handler (API å±?

**?‡ä»¶:** `src/modules/integrations/handlers/channel-handler.ts` (400+ è¡?

#### **å®ç°?„ç«¯??(8ä¸?**

```
??GET /api/channels
   ?”â? ?Ÿèƒ½: ?—å‡º?¢é??€?‰æ???
   ?”â? ?¥è¯¢?‚æ•°: ?platform=line (?¯é€?
   ?”â? ?ƒé?: ?€è¦è®¤è¯?(ä»»ä?è§’è‰²)
   ?”â? ?å?: { success: true, data: [...], count: 3 }

??POST /api/channels
   ?”â? ?Ÿèƒ½: ?›å»º?°æ??“é?ç½?
   ?”â? ?ƒé?: Admin only
   ?”â? è¯·æ?ä½?
      {
        "platform": "line",
        "lineConfig": {
          "channelId": "@abc123",
          "channelAccessToken": "...",
          "channelSecret": "..."
        }
      }
   ?”â? ?å?: { success: true, data: {...}, webhookUrl: "..." }

??GET /api/channels/:id
   ?”â? ?Ÿèƒ½: ?·å?æ¸ é?è¯¦æ?
   ?”â? ?ƒé?: ?€è¦è®¤è¯?+ ?¢é?éªŒè?
   ?”â? ?å?: { success: true, data: {...} }

??PUT /api/channels/:id
   ?”â? ?Ÿèƒ½: ?´æ–°æ¸ é??ç½®
   ?”â? ?ƒé?: Admin only + ?¢é?éªŒè?
   ?”â? è¯·æ?ä½? { lineConfig: { channelAccessToken: "..." } }
   ?”â? ?å?: { success: true, data: {...} }

??DELETE /api/channels/:id
   ?”â? ?Ÿèƒ½: ?œç”¨æ¸ é? (è½¯å???
   ?”â? ?ƒé?: Admin only + ?¢é?éªŒè?
   ?”â? ?å?: { success: true, message: "..." }

??POST /api/channels/:id/verify
   ?”â? ?Ÿèƒ½: éªŒè?æ¸ é??ç½®
   ?”â? ?ƒé?: ?€è¦è®¤è¯?+ ?¢é?éªŒè?
   ?”â? ?å?:
      {
        "success": true,
        "verified": true,
        "message": "LINE channel verified successfully",
        "details": {
          "channelId": "1234567890",
          "webhookUrl": "...",
          "lastVerifiedAt": "2025-10-27T14:30:00Z"
        }
      }

??GET /api/channels/:id/stats
   ?”â? ?Ÿèƒ½: ?·å?æ¸ é?ç»Ÿè®¡
   ?”â? ?ƒé?: ?€è¦è®¤è¯?+ ?¢é?éªŒè?
   ?”â? ?å?:
      {
        "success": true,
        "data": {
          "channelId": 1,
          "platform": "line",
          "totalMessagesSent": 150,
          "totalMessagesReceived": 320,
          "lastMessageAt": "2025-10-27T14:00:00Z",
          "isActive": true,
          "isVerified": true,
          "errorCount": 0,
          "uptime": { "days": 7, "hoursLastDay": 24 }
        }
      }

??GET /api/channels/:id/health
   ?”â? ?Ÿèƒ½: ?¥åº·æ£€??
   ?”â? ?ƒé?: ?€è¦è®¤è¯?+ ?¢é?éªŒè?
   ?”â? ?å?:
      {
        "success": true,
        "data": {
          "channelId": 1,
          "platform": "line",
          "status": "healthy",  // 'healthy' | 'degraded' | 'down'
          "lastCheckAt": "2025-10-27T14:30:00Z",
          "consecutiveErrors": 0,
          "lastError": null,
          "recommendations": []
        }
      }
```

#### **å®‰å…¨?¹æ€?*

**1. JWT è®¤è?ä¸­é—´ä»?*
```typescript
// ??index.ts ä¸­å???
app.use('/api/channels/*', jwtAuth);

// ?€?‰è·¯?±è‡ª?¨å?ä¿æŠ¤
// ?ªè®¤è¯è¯·æ±‚è???401 Unauthorized
```

**2. ?ƒé??§åˆ¶**
```typescript
// Admin only ?ä?
if (user.role !== 'admin') {
  return c.json({
    success: false,
    error: 'Only administrators can configure channels'
  }, 403);
}

// ?‚ç”¨ç«¯ç‚¹:
// - POST /api/channels (?›å»º)
// - PUT /api/channels/:id (?´æ–°)
// - DELETE /api/channels/:id (?œç”¨)
```

**3. ?¢é??”ç¦»éªŒè?**
```typescript
// æ¯ä¸ªè¯·æ?éªŒè??¢é??€?‰æ?
if (channel.teamId !== user.teamId) {
  return c.json({ error: 'Access denied' }, 403);
}

// ?²æ­¢è·¨å›¢?Ÿè®¿??
// ä¾‹å?: Team 1 ä¸èƒ½è®¿é—® Team 2 ?„æ???
```

**4. è¾“å…¥éªŒè?**
```typescript
// å¹³å°ç±»å?éªŒè?
if (!['line', 'facebook', 'whatsapp'].includes(body.platform)) {
  return c.json({ error: 'Invalid platform' }, 400);
}

// å¿…å¡«å­—æ®µéªŒè?
if (!body.lineConfig.channelId || !body.lineConfig.channelAccessToken) {
  return c.json({ error: 'Required fields missing' }, 400);
}

// ID ?¼å?éªŒè?
const channelId = parseInt(c.req.param('id'));
if (isNaN(channelId)) {
  return c.json({ error: 'Invalid channel ID' }, 400);
}
```

---

### 3. å¤šç???Webhook Handler

**?‡ä»¶:** `src/handlers/webhook-multitenant.ts` (300+ è¡?

#### **å®ç°?„å???*

**1. å¤šç???LINE Webhook å¤„ç???*
```typescript
handleLineWebhookMultiTenant(c)
  ?œâ? ?å?è·¯ç”±?‚æ•° (teamId, token)
  ?œâ? ?¥è¯¢æ¸ é??ç½® (ChannelService.getChannelByWebhookToken)
  ?œâ? éªŒè? token ?‰æ???
  ?œâ? éªŒè? LINE ç­¾å? (ä½¿ç”¨?¢é?ä¸“å? secret)
  ?œâ? å¤„ç? webhook äº‹ä»¶
  ?œâ? å¢å?æ¶ˆæ¯è®¡æ•° (incrementMessageCounter)
  ?”â? è¿”å?å¤„ç?ç»“æ?

?¹ç‚¹:
??å®Œæ•´?„å?ç§Ÿæˆ·?¯æ?
??Token éªŒè??²æ­¢ä¼ªé€?
??ä½¿ç”¨?¢é?ä¸“å? credentials
???ªåŠ¨æ¶ˆæ¯ç»Ÿè®¡
??è¯¦ç??„æ—¥å¿—è???
```

**2. ?‘å??¼å®¹??Legacy Handler**
```typescript
handleLineWebhookLegacy(c)
  ?œâ? ä½¿ç”¨?¨å??¯å??˜é? (LINE_CHANNEL_ACCESS_TOKEN)
  ?œâ? éªŒè? LINE ç­¾å?
  ?œâ? å¤„ç? webhook äº‹ä»¶
  ?”â? è¿”å?å¤„ç?ç»“æ?

?¹ç‚¹:
??ä¿æ??‘å??¼å®¹??
??ä¸ç ´?ç°?‰éƒ¨ç½?
???æ­¥è¿ç§»ç­–ç•¥
? ï?  ?‡è®°ä¸?deprecated
```

**3. æ¶ˆæ¯å¤„ç?å¢å¼º**
```typescript
processLineMessageMultiTenant(env, event, channel)
  ?œâ? ?›å»º?¢é?ä¸“å? env å¯¹è±¡
  ?œâ? æ³¨å…¥?¢é? credentials
  ?œâ? æ·»å??¢é?ä¸Šä???(_TEAM_ID, _CHANNEL_ID)
  ?”â? è°ƒç”¨?°æ? processLineMessage ?½æ•°

ä¼˜åŠ¿:
???€å°å?ä»??ä¿®æ”¹
??å¤ç”¨?°æ??»è?
??æ³¨å…¥?¢é?ä¸Šä???
```

#### **è·¯ç”±æ³¨å?**

**?‡ä»¶:** `src/index.ts` (ä¿®æ”¹)

```typescript
// ?°ç?å¤šç??·è·¯??
app.post('/api/webhooks/line/:teamId/:token', handleLineWebhookMultiTenant);

// Legacy è·¯ç”± (?‘å??¼å®¹)
app.post('/api/webhook', handleLineWebhookLegacy);
app.post('/api/webhooks/line', handleLineWebhookLegacy);

?¥å?è¾“å‡º:
??Multi-Tenant LINE Webhook endpoint registered:
   ??POST /api/webhooks/line/:teamId/:token (Team-specific webhook)

? ï?  Legacy LINE Webhook endpoints (backward compatibility):
   ??POST /api/webhook
   ??POST /api/webhooks/line
   Note: These use global credentials. Consider migrating to multi-tenant webhook.
```

---

## ?? **Phase 2 ç»Ÿè®¡?°æ®**

### **ä»???ç?è®?*

| ?‡ä»¶ | è¡Œæ•° | ?Ÿèƒ½ |
|------|------|------|
| channel-service.ts | 600+ | ä¸šåŠ¡?»è?å±?|
| channel-handler.ts | 400+ | API ç«¯ç‚¹å±?|
| webhook-multitenant.ts | 300+ | Webhook å¤„ç? |
| index.ts | +30 | è·¯ç”±æ³¨å? |
| **?»è®¡** | **1330+** | **å®Œæ•´å®ç°** |

### **?Ÿèƒ½ç»Ÿè®¡**

| ç±»åˆ« | ?°é? | è¯´æ? |
|------|------|------|
| Service ?¹æ? | 14 | ChannelService å®Œæ•´?¹æ? |
| API ç«¯ç‚¹ | 8 | RESTful API ç«¯ç‚¹ |
| Webhook å¤„ç???| 2 | å¤šç???+ Legacy |
| è·¯ç”±æ³¨å? | 11 | ?»å…±æ³¨å??„è·¯??|
| TypeScript ?¥å£ | 15+ | ç±»å?å®šä? |

### **æµ‹è?è¦†ç?**

| æµ‹è?ç±»å? | ?¶æ€?| è¯´æ? |
|---------|------|------|
| ?•å?æµ‹è? | ??Pending | Phase 5 å®æ–½ |
| ?†æ?æµ‹è? | ??Pending | Phase 5 å®æ–½ |
| ?‹åŠ¨æµ‹è? | ??Ready | curl ?½ä»¤?†å?å°±ç»ª |

---

## ??ï¸?**?¶æ?äº®ç‚¹**

### **1. å®Œæ•´?„å?ç§Ÿæˆ·?¯æ?**

```
?•ç??·æ¨¡å¼?(Legacy):
?œâ? ?¨å? LINE_CHANNEL_ACCESS_TOKEN
?œâ? ?¨å? LINE_CHANNEL_SECRET
?”â? ?€?‰å›¢?Ÿå…±äº«å?ä¸€ä¸?LINE OA

å¤šç??·æ¨¡å¼?(New):
?œâ? æ¯ä¸ª?¢é??¬ç??ç½®
?œâ? ä¸“å? Webhook URL
?œâ? ?¢é??”ç¦»éªŒè?
?”â? ?¬ç?ç»Ÿè®¡?Œå¥åº·ç???
```

### **2. å®‰å…¨?§è®¾è®?*

```
ä¸‰å?å®‰å…¨?²æŠ¤:

Layer 1: JWT è®¤è?
?œâ? ?€??/api/channels/* è·¯ç”±?€è¦è®¤è¯?
?”â? ?ªè®¤è¯è¯·æ±‚è???401

Layer 2: ?ƒé??§åˆ¶
?œâ? Admin only for CUD operations
?œâ? ?¢é??”ç¦»éªŒè?
?”â? ?²æ­¢è·¨å›¢?Ÿè®¿??

Layer 3: Webhook éªŒè?
?œâ? LINE ç­¾å?éªŒè?
?œâ? Token éªŒè?
?”â? ?¢é??ç½®éªŒè?
```

### **3. ?™è¯¯å¤„ç??Œç???*

```
?™è¯¯è¿½è¸ª?ºåˆ¶:
?œâ? ?ªåŠ¨è®°å??™è¯¯ä¿¡æ¯
?œâ? ?™è¯¯è®¡æ•°ç»Ÿè®¡
?œâ? ?¥åº·?¶æ€ç???
?”â? ?¨è?å»ºè®®?Ÿæ?

ç»Ÿè®¡?Ÿèƒ½:
?œâ? ?‘é€??¥æ”¶æ¶ˆæ¯è®¡æ•°
?œâ? ?€?æ??¯æ—¶??
?œâ? ?¨çº¿?¶é•¿ç»Ÿè®¡
?”â? ?™è¯¯?‡è®¡ç®?
```

---

## ?¯ **API ä½¿ç”¨ç¤ºä?**

### **1. ?›å»º LINE æ¸ é??ç½®**

```bash
curl -X POST https://your-api-domain.example.com/api/channels \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "line",
    "lineConfig": {
      "channelId": "@abc123",
      "channelAccessToken": "YOUR_LINE_ACCESS_TOKEN",
      "channelSecret": "YOUR_LINE_SECRET"
    }
  }'

# ?å?:
{
  "success": true,
  "data": {
    "id": 1,
    "teamId": 1,
    "platform": "line",
    "lineChannelId": "@abc123",
    "lineWebhookUrl": "https://your-api-domain.example.com/api/webhooks/line/1/a3b5c7d9",
    "isActive": true,
    "isVerified": false,
    "createdAt": "2025-10-27T14:30:00Z"
  },
  "webhookUrl": "https://your-api-domain.example.com/api/webhooks/line/1/a3b5c7d9"
}
```

### **2. éªŒè?æ¸ é??ç½®**

```bash
curl -X POST https://your-api-domain.example.com/api/channels/1/verify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# ?å?:
{
  "success": true,
  "verified": true,
  "message": "LINE channel verified successfully",
  "details": {
    "channelId": "1234567890",
    "webhookUrl": "https://your-api-domain.example.com/api/webhooks/line/1/a3b5c7d9",
    "lastVerifiedAt": "2025-10-27T14:35:00Z"
  }
}
```

### **3. ?ç½® LINE Webhook**

??LINE Developers Console ?ç½®:
```
Webhook URL:
https://your-api-domain.example.com/api/webhooks/line/1/a3b5c7d9

Settings:
??Use webhook: ON
??Verify: Click to test
??Auto-reply messages: OFF
```

### **4. ?·å?æ¸ é?ç»Ÿè®¡**

```bash
curl -X GET https://your-api-domain.example.com/api/channels/1/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# ?å?:
{
  "success": true,
  "data": {
    "channelId": 1,
    "platform": "line",
    "totalMessagesSent": 150,
    "totalMessagesReceived": 320,
    "lastMessageAt": "2025-10-27T14:00:00Z",
    "isActive": true,
    "isVerified": true,
    "errorCount": 0,
    "uptime": {
      "days": 7,
      "hoursLastDay": 24
    }
  }
}
```

---

## ?? **ä¸‹ä?æ­? Phase 3 (?ç«¯å¼€??**

### **Phase 3 ?®æ?: ?ç«¯æ¸ é?ç®¡ç?é¡µé¢**

**ä»»åŠ¡?—è¡¨:**

1. **?›å»ºæ¸ é?ç®¡ç?é¡µé¢ (2å°æ—¶)**
   - `frontend/src/views/ChannelManagement.vue`
   - æ¸ é??—è¡¨å±•ç¤º
   - æ¸ é??¶æ€å¡??
   - æ·»å??°æ??“æ???

2. **?›å»ºæ¸ é??ç½®å¯¹è?æ¡?(2å°æ—¶)**
   - `frontend/src/components/channels/ChannelConfigDialog.vue`
   - æ­¥éª¤å¼è¡¨??(Step 1, 2, 3)
   - LINE ?ç½®è¾“å…¥
   - å®æ—¶éªŒè?
   - Webhook URL å±•ç¤º?Œå???

3. **?›å»º API å®¢æˆ·ç«?(30?†é?)**
   - `frontend/src/api/channels.ts`
   - HTTP ?¹æ?å°è?
   - ?™è¯¯å¤„ç?

4. **æ·»å?è·¯ç”± (15?†é?)**
   - `frontend/src/router/index.ts`
   - æ³¨å? /channels è·¯ç”±
   - ?ƒé?å®ˆå« (Admin only)

**é¢„è®¡?»æ—¶??** 4-5 å°æ—¶

---

## ??**Phase 2 å®Œæ?æ£€?¥æ???*

- [x] ?›å»º ChannelService (14ä¸ªæ–¹æ³?
- [x] ?›å»º Channel Handler (8ä¸ªç«¯??
- [x] å®ç° LINE API éªŒè?
- [x] å®ç° Webhook URL ?Ÿæ?
- [x] å®ç°å¤šç???Webhook å¤„ç?
- [x] æ³¨å??€?‰è·¯??
- [x] æ·»å?å®Œæ•´?„å??¨æ§??
- [x] å®ç°?™è¯¯è¿½è¸ª?Œç?è®?
- [x] ä¿æ??‘å??¼å®¹??
- [x] ?›å»ºå®Œæ•´?‡æ¡£

---

## ?? **Phase 2 å®Œæ??»ç?**

**?¶æ€?** ??**100% å®Œæ?**

**å®Œæ??…å®¹:**
- ??1330+ è¡Œä»£??
- ??14 ä¸?Service ?¹æ?
- ??8 ä¸?REST API ç«¯ç‚¹
- ??2 ä¸?Webhook å¤„ç???
- ??å®Œæ•´?„å?ç§Ÿæˆ·?¯æ?
- ??å®Œæ•´?„å??¨æ§??
- ??è¯¦ç??„æ?æ¡??ç¤ºä?

**?€?¯å€ºåŠ¡:** ??

**?†å?è¿›å…¥:** Phase 3 - ?ç«¯å¼€??

**é¢„è®¡?©ä??¶é—´:** 4-5 å°æ—¶ (Phase 3) + 1-2 å°æ—¶ (Phase 4-5)

---

**å®æ–½?¶é—´:** 2025-10-27
**å®Œæ??¶é—´:** Phase 2 å®Œæ?
**ä¸‹ä?æ­?** Phase 3 - ?ç«¯æ¸ é?ç®¡ç? UI
