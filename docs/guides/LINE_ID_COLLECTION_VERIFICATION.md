# LINE ID


 LINE ID D1


### 1. LINE ID
```typescript
// handleTextMessageEvent
const lineUserId = event.source.userId;
```
- ****: `src/index.ts:870`
- ****:
- ****: LINE Webhook `event.source.userId`

### 2.
```typescript
//
const customer = await findOrCreateCustomer(c.env.DB, 'line', lineUserId, {
 displayName: userProfile?.displayName,
 avatarUrl: userProfile?.pictureUrl,
 metadata: {
 statusMessage: userProfile?.statusMessage,
 lastProfileUpdate: new Date().toISOString(),
 messageCount: 1
 }
});
```
- ****: `src/index.ts:887`
- ****:
- ****: LINE ID `platform_user_id`

### 3.
```sql
CREATE TABLE customers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 platform TEXT NOT NULL, -- 'line'
 platform_user_id TEXT NOT NULL, -- LINE User ID
 display_name TEXT, --
 avatar_url TEXT, -- URL
 -- ...
 UNIQUE(platform, platform_user_id) --
);
```
- ****:
- ****: LINE ID


```


 LINE Webhook
 ( event.source.userId)
 Cloudflare Worker
 ( lineUserId = event.source.userId)
 LINE Profile API
 ()
 D1
 (platform='line', platform_user_id=lineUserId)

```


 LINE ID

### 1.
```bash
node check-line-id.js
```
- LINE ID
- LINE ID
-

### 2.
```bash
node verify-line-id-collection.js
```
-
-
-

### 3.
```bash
node monitor-line-id.js
```
- LINE ID
-
-

## API


```bash
GET /api/customers
```
 LINE
```json
{
 "id": 1,
 "platform": "line",
 "platform_user_id": "U1234567890abcdef1234567890abcdef1",
 "display_name": "",
 "avatar_url": "https://profile.line-scdn.net/...",
 "created_at": "2025-01-08T10:00:00.000Z",
 "updated_at": "2025-01-08T10:00:00.000Z"
}
```

### LINE
```bash
GET /api/customers/platform/line/{LINE_USER_ID}
```
 LINE ID

## LINE ID

### LINE User ID
- `U`
- 32
- 33
- : `U1234567890abcdef1234567890abcdef1`


```javascript
const isValidLineId = /^U[a-f0-9]{32}$/i.test(lineId);
```


### 1. LINE ID

- [ ] LINE Webhook URL
- [ ] LINE Channel Access Token
- [ ] Worker
- [ ] D1

### 2. LINE ID

- Webhook
-
- LINE API

### 3.

- [ ] LINE Profile API
- [ ]
- [ ] API


1. `node check-line-id.js`
2. Worker
3. D1


1. LINE ID Webhook
2. API
3.


 LINE Bot LINE ID

1. ****: `event.source.userId` LINE ID
2. ****: `customers.platform_user_id`
3. ****: LINE ID
4. ****: API
5. ****:

** LINE ID D1 **


1. `node check-line-id.js`
2. `node verify-line-id-collection.js`
3. `node monitor-line-id.js`
4. 