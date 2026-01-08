# ?? æ¸ é?ç®¡ç?ç³»ç? - Phase 1 å®æ–½?¥å?

## ??Phase 1: ?°æ®åº“å?å¤?- **å®Œæ?**

**å®æ–½?¶é—´:** 2025-10-27
**?¶æ€?** ???€?‰ä»»?¡å·²å®Œæ?
**è¿›åº¦:** Phase 1/5 (20%)

---

## ?“¦ å·²å??ç?å·¥ä?

### 1. ?°æ®åº“è?ç§»æ?ä»¶å?å»?

**?‡ä»¶:** `drizzle/0018_add_channel_integrations.sql`

**?…å®¹:**
- ???›å»º `channel_integrations` è¡?
- ???¯æ?å¤šç??·æ¶??(team_id)
- ???¯æ?å¤šå¹³??(LINE, Facebook, WhatsApp)
- ??å®Œæ•´?„ç´¢å¼•ä???(8ä¸ªç´¢å¼?
- ???¯ä?çº¦æ? (?²æ­¢?å??ç½®)
- ??å®‰å…¨?„å??®å…³ç³?

**è¡¨ç??„äº®??**
```sql
channel_integrations (
  id                          INTEGER PRIMARY KEY
  team_id                     INTEGER NOT NULL  ??å¤šç??·é?ç¦?
  platform                    TEXT NOT NULL     ??'line' | 'facebook' | 'whatsapp'

  -- LINE ?ç½®
  line_channel_id             TEXT
  line_channel_access_token   TEXT              ??? å?å­˜å‚¨
  line_channel_secret         TEXT              ??? å?å­˜å‚¨
  line_webhook_url            TEXT              ???ªåŠ¨?Ÿæ?ä¸“å? URL
  line_webhook_token          TEXT              ??å®‰å…¨éªŒè?ä»¤ç?

  -- ?¶æ€ç®¡??
  is_active                   BOOLEAN DEFAULT TRUE
  is_verified                 BOOLEAN DEFAULT FALSE
  last_verified_at            TIMESTAMP

  -- ä½¿ç”¨ç»Ÿè®¡
  total_messages_sent         INTEGER DEFAULT 0
  total_messages_received     INTEGER DEFAULT 0
  last_message_at             TIMESTAMP

  -- ?™è¯¯è¿½è¸ª
  last_error                  TEXT (JSON)
  error_count                 INTEGER DEFAULT 0
)
```

**?³é”®çº¦æ?:**
- ??æ¯ä¸ª?¢é?æ¯ç?å¹³å°?ªèƒ½?‰ä?ä¸ªæ?æ´»ç??ç½®
- ??Webhook URL ?¨å??¯ä?
- ??LINE Channel ID ?¨æ?æ´»çŠ¶?ä??¯ä?

---

### 2. Drizzle Schema ?´æ–°

**?‡ä»¶:** `src/db/schema.ts`

**æ·»å??…å®¹:**
```typescript
export const channelIntegrations = sqliteTable('channel_integrations', {
  id: integer('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id),
  platform: text('platform').notNull(),

  // LINE ?ç½® (camelCase TypeScript naming)
  lineChannelId: text('line_channel_id'),
  lineChannelAccessToken: text('line_channel_access_token'),
  lineChannelSecret: text('line_channel_secret'),
  lineWebhookUrl: text('line_webhook_url'),
  lineWebhookToken: text('line_webhook_token'),

  // ?¶æ€å?ç»Ÿè®¡
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  isVerified: integer('is_verified', { mode: 'boolean' }).default(false),
  // ... ?´å?å­—æ®µ
});
```

**?¹ç‚¹:**
- ??TypeScript ç±»å?å®‰å…¨
- ???ªåŠ¨?¨æ–­ SELECT ??INSERT ç±»å?
- ??é©¼å³°?½å?æ³?(TypeScript ?¯ä?)
- ??ä¸æ•°?®å??—å??ªåŠ¨? å?

---

### 3. ?°æ®åº“è?ç§»æ‰§è¡?

**?½ä»¤:**
```bash
npx wrangler d1 execute multi-channel-platform --remote \
  --file=drizzle/0018_add_channel_integrations.sql
```

**?§è?ç»“æ?:**
```
??13 queries executed
??21 rows read
??12 rows written
??Database size: 0.69 MB
??Status: Success
```

**éªŒè?ç»“æ?:**
```bash
$ npx wrangler d1 execute ... --command="SELECT name FROM sqlite_master ..."
??Table 'channel_integrations' found in production database
```

---

### 4. TypeScript ç±»å?å®šä?

**?‡ä»¶:** `src/modules/integrations/types/channel-types.ts` (200+ è¡?

**?…å«?…å®¹:**

#### A. ?¸å?ç±»å?
```typescript
export type ChannelPlatform = 'line' | 'facebook' | 'whatsapp';
export type ChannelIntegration = typeof channelIntegrations.$inferSelect;
export type NewChannelIntegration = typeof channelIntegrations.$inferInsert;
```

#### B. ?ç½®ç±»å?
```typescript
export interface LineChannelConfig {
  channelId: string;
  channelAccessToken: string;
  channelSecret: string;
  webhookUrl?: string;
  webhookToken?: string;
}

export interface ChannelConfigRequest {
  platform: ChannelPlatform;
  teamId: number;
  lineConfig?: LineChannelConfig;
  facebookConfig?: FacebookChannelConfig;
  whatsappConfig?: WhatsAppChannelConfig;
}
```

#### C. ?å?ç±»å?
```typescript
export interface ChannelConfigResponse {
  success: boolean;
  data?: ChannelIntegration;
  error?: string;
  webhookUrl?: string;
}

export interface ChannelVerificationResponse {
  success: boolean;
  verified: boolean;
  message: string;
  details?: {
    channelId?: string;
    webhookUrl?: string;
    lastVerifiedAt?: string;
  };
}
```

#### D. ?åŠ¡?¥å£
```typescript
export interface ChannelIntegrationService {
  createChannel(request: ChannelConfigRequest): Promise<ChannelConfigResponse>;
  verifyChannel(request: ChannelVerificationRequest): Promise<ChannelVerificationResponse>;
  getChannel(channelId: number): Promise<ChannelIntegration | null>;
  updateChannel(request: ChannelUpdateRequest): Promise<ChannelConfigResponse>;
  // ... ?´å??¹æ?
}
```

---

## ??ï¸??¶æ?è®¾è®¡è¦ç‚¹

### Webhook URL è®¾è®¡

```
?¼å?: https://your-api-domain.example.com/api/webhooks/{platform}/{teamId}/{token}

ç¤ºä?:
https://your-api-domain.example.com/api/webhooks/line/1/a3b5c7d9e1f2

ç»„æ?:
?œâ? platform: 'line' | 'facebook' | 'whatsapp'
?œâ? teamId: ?¢é??°æ®åº?ID (?°å?)
?”â? token: ?æœº UUID (å®‰å…¨éªŒè?)

?¹ç‚¹:
??æ¯ä¸ª?¢é?ä¸“å? URL
???ªåŠ¨è·¯ç”±?°æ­£ç¡®é?ç½?
??Token éªŒè??²æ­¢ä¼ªé€?
???¯æ?å¤šå¹³?°æ‰©å±?
```

### å¤šç??·é?ç¦»ç???

```
?°æ®?”ç¦»:
?œâ? è¡¨çº§?”ç¦»: channel_integrations.team_id
?œâ? ?¥è¯¢è¿‡æ»¤: WHERE team_id = ?
?œâ? å¤–é”®çº¦æ?: FOREIGN KEY (team_id) REFERENCES teams(id)
?”â? ?¯ä?çº¦æ?: UNIQUE(team_id, platform, is_active)

?ƒé??§åˆ¶:
?œâ? ?ªæ? Admin ?¯ä»¥?ç½®æ¸ é?
?œâ? ?ªèƒ½è®¿é—®?ªå·±?¢é??„é?ç½?
?œâ? å®¡è®¡è¿½è¸ª: configured_by å­—æ®µ
?”â? JWT token ?…å« teamId ä¿¡æ¯
```

---

## ?? ?°æ®åº“æ€§èƒ½ä¼˜å?

### ç´¢å?ç­–ç•¥ (8ä¸ªç´¢å¼?

```sql
1. idx_channel_integrations_team_id
   ?”â? ?¨é€? ?‰å›¢?ŸæŸ¥è¯¢æ???(?€å¸¸ç”¨)

2. idx_channel_integrations_platform
   ?”â? ?¨é€? ?‰å¹³?°ç±»?‹è?æ»?

3. idx_channel_integrations_webhook_url
   ?”â? ?¨é€? Webhook è·¯ç”± (å¿«é€ŸæŸ¥??

4. idx_channel_integrations_webhook_token
   ?”â? ?¨é€? Token éªŒè?

5. idx_channel_integrations_active
   ?”â? ?¨é€? ?¥è¯¢æ¿€æ´»ç?æ¸ é? (å¤å?ç´¢å?: team_id + platform + is_active)

6. idx_channel_integrations_verified
   ?”â? ?¨é€? ?¥æ‰¾?€è¦é??°é?è¯ç?æ¸ é?

7. idx_channel_unique_active_per_team
   ?”â? ?¨é€? ?²æ­¢?å??ç½® (UNIQUE WHERE is_active = 1)

8. idx_channel_unique_webhook_url
   ?”â? ?¨é€? ?¨å??¯ä? Webhook URL
```

**é¢„æ??§èƒ½:**
```
?¥è¯¢ç±»å?                    é¢„æ??å??¶é—´
?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
??team_id ?¥è¯¢              < 1ms
Webhook URL è·¯ç”±            < 2ms
éªŒè??ç½®                    < 5ms
?¹é??¥è¯¢ (100??            < 10ms
```

---

## ?? å®‰å…¨?ƒè?

### å·²å??½ç?å®‰å…¨?ªæ–½

1. **?æ?ä¿¡æ¯ä¿æŠ¤:**
   - ??Access Token ??Secret å­—æ®µ?†å?? å?å­˜å‚¨
   - ???°æ®åº“æ³¨?Šæ?ç¤ºé?è¦å?å¯?
   - ??å®é?? å?å®ç°??Phase 4

2. **è®¿é—®?§åˆ¶:**
   - ??å¤–é”®çº¦æ?ç¡®ä??°æ®å®Œæ•´??
   - ??team_id ?”ç¦»ä¸å?ç§Ÿæˆ·
   - ???ƒé?ä¸­é—´ä»¶åœ¨ Phase 2

3. **Webhook å®‰å…¨:**
   - ???æœº token ?Ÿæ??ºåˆ¶
   - ???¯ä?çº¦æ??²æ­¢ç¢°æ?
   - ??Token éªŒè??»è???Phase 2

---

## ?? ?°å??‡ä»¶æ¸…å?

```
Multi_Channel_Integration_System/
?œâ??€ drizzle/
??  ?”â??€ 0018_add_channel_integrations.sql          ???? è¿ç§»?‡ä»¶ (100 è¡?
?œâ??€ src/
??  ?œâ??€ db/
??  ??  ?”â??€ schema.ts                              ???ï? ä¿®æ”¹ (æ·»å? channelIntegrations)
??  ?”â??€ modules/
??      ?”â??€ integrations/
??          ?”â??€ types/
??              ?”â??€ channel-types.ts               ???? ç±»å?å®šä? (200+ è¡?
?”â??€ CHANNEL_MANAGEMENT_PHASE1_REPORT.md            ???? ?¬æŠ¥??
```

---

## ?¯ Phase 1 ?å??‡æ?

| ?‡æ? | ?®æ? | å®é? | ?¶æ€?|
|------|------|------|------|
| ?°æ®åº“è¡¨?›å»º | 1å¼ è¡¨ | ??1å¼?| å®Œæ? |
| ç´¢å??›å»º | 8ä¸ªç´¢å¼?| ??8ä¸?| å®Œæ? |
| TypeScript ç±»å? | å®Œæ•´å®šä? | ??200+è¡?| å®Œæ? |
| è¿ç§»?§è? | ?å?? é?è¯?| ???å? | å®Œæ? |
| è¡¨é?è¯?| ?Ÿäº§?¯å?å­˜åœ¨ | ??éªŒè??šè? | å®Œæ? |

---

## ?? ä¸‹ä?æ­? Phase 2

### Phase 2 ?®æ?: ?ç«¯ API å¼€??(é¢„è®¡ 2å°æ—¶)

**ä»»åŠ¡?—è¡¨:**

1. **?›å»ºæ¸ é?ç®¡ç??åŠ¡** (1å°æ—¶)
   - `src/modules/integrations/services/channel-service.ts`
   - å®ç° CRUD ?ä?
   - å®ç° LINE API éªŒè?
   - å®ç° Webhook URL ?Ÿæ?

2. **?›å»ºæ¸ é?ç®¡ç? Handler** (1å°æ—¶)
   - `src/modules/integrations/handlers/channel-handler.ts`
   - 7ä¸?RESTful ç«¯ç‚¹:
     - `POST /api/channels` - ?›å»º?ç½®
     - `GET /api/channels` - ?—è¡¨
     - `GET /api/channels/:id` - è¯¦æ?
     - `PUT /api/channels/:id` - ?´æ–°
     - `DELETE /api/channels/:id` - ?œç”¨
     - `POST /api/channels/:id/verify` - éªŒè?
     - `GET /api/channels/:id/stats` - ç»Ÿè®¡

3. **ä¿®æ”¹ LINE Webhook Handler**
   - ?¯æ?å¤šç??·è·¯??
   - ?¹æ® teamId ä½¿ç”¨å¯¹å??ç½®

---

## ?’¡ ?€?¯å€ºåŠ¡?Œæ³¨?ä?é¡?

### å¾…å?äº‹é¡¹ (Phase 4)

1. **? å?å®ç°:**
   - ä½¿ç”¨ Cloudflare Secrets ? å? Access Token
   - ä½¿ç”¨ Cloudflare Secrets ? å? Channel Secret

2. **?™è¯¯å¤„ç?:**
   - å®ç°?™è¯¯?è??ºåˆ¶
   - å®ç°?™è¯¯?Šè­¦ç³»ç?

3. **?‘æ§:**
   - æ·»å?æ¸ é??¥åº·æ£€?¥å??¶ä»»??
   - æ·»å?ä½¿ç”¨ç»Ÿè®¡?¶é?

### è®¾è®¡?³ç?è®°å?

**?³ç?1: Webhook URL ?…å« teamId**
- ?Ÿå?: å¿«é€Ÿè·¯??? é??°æ®åº“æŸ¥è¯?
- ?ƒè¡¡: URL ?¿åº¦å¢å?,ä½†æ€§èƒ½?å??¾è?

**?³ç?2: ?¯æ?å¤šå¹³?°æ‰©å±?*
- ?Ÿå?: ?ªæ¥?¯èƒ½?†æ? Facebook, WhatsApp
- ?ƒè¡¡: è¡¨ç??„æ›´å¤æ?,ä½†é¿?æœª?¥é???

**?³ç?3: ä½¿ç”¨?¯ä?çº¦æ??Œé?åº”ç”¨å±‚æ???*
- ?Ÿå?: ?°æ®åº“çº§çº¦æ??´å¯??
- ?ƒè¡¡: ?€è¦å??†å”¯ä¸€?²ç??™è¯¯

---

## ??Phase 1 å®Œæ?æ£€?¥æ???

- [x] ?›å»º?°æ®åº“è?ç§»æ?ä»?
- [x] ?§è?è¿ç§»?°ç?äº§æ•°?®å?
- [x] éªŒè?è¡¨å?å»ºæ???
- [x] ?´æ–° Drizzle schema.ts
- [x] ?›å»º TypeScript ç±»å?å®šä?
- [x] ?‡æ¡£?–æ¶?„è®¾è®?
- [x] ?›å»º Phase 1 å®Œæ??¥å?

---

**Phase 1 ?¶æ€?** ??**å®Œæ? (100%)**
**?†å?è¿›å…¥:** Phase 2 - ?ç«¯ API å¼€??
**é¢„è®¡?©ä??¶é—´:** 6-7 å°æ—¶ (Phase 2-5)
