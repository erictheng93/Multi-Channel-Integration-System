# LINE Webhook

## 1. LINE OA

### LINE Developers Console
```
Webhook URL: https://your-api-domain.example.com/api/webhook
Use webhook:
Webhook redelivery:
```

### Webhook URL
```bash
# webhook endpoint
curl -X POST https://your-api-domain.example.com/api/webhook \
 -H "Content-Type: application/json" \
 -d '{"test": "ping"}'
```

## 2. Cloudflare Workers


```bash

wrangler tail --format pretty

# LINE
```


- `Received webhook: {...}` -
- ` ... ` -
- `` -
- `` - /
- `` - D1

## 3.

### wrangler.toml
```toml
[vars]
LINE_CHANNEL_SECRET = " channel secret"
LINE_CHANNEL_ACCESS_TOKEN = " access token"
```


```bash

wrangler secret list
```

## 4.

### LINE
 LINE Developers Console Webhook "Verify"


```
Invalid LINE signature
```

## 5. D1


```sql
-- wrangler d1
SELECT * FROM messages ORDER BY created_at DESC LIMIT 10;
```


```sql
SELECT * FROM customers WHERE platform = 'line' ORDER BY created_at DESC LIMIT 10;
```


```sql
SELECT * FROM conversations ORDER BY created_at DESC LIMIT 10;
```

## 6.

### 1: Webhook URL
****: Workers
****: LINE Developers Console Webhook URL

### 2:
****: "Invalid LINE signature"
****:
- LINE_CHANNEL_SECRET
-

### 3:
****: ""
****: schema

### 4:
****: 404
****:

## 7.

 `test-webhook-direct.js`:
```javascript
const crypto = require('crypto');

//
const WEBHOOK_URL = 'https://your-api-domain.example.com/api/webhook';
const CHANNEL_SECRET = ' channel secret'; // LINE Developers Console

//
function generateSignature(body, secret) {
 const hmac = crypto.createHmac('SHA256', secret);
 hmac.update(body);
 return hmac.digest('base64');
}

// webhook
async function testWebhook() {
 const body = JSON.stringify({
 destination: 'Uxxxxxxxxxx',
 events: [{
 type: 'message',
 timestamp: Date.now(),
 source: { type: 'user', userId: 'Utest123' },
 replyToken: 'test-reply-token',
 message: { type: 'text', id: 'msg123', text: '' }
 }]
 });

 const signature = generateSignature(body, CHANNEL_SECRET);

 try {
 const response = await fetch(WEBHOOK_URL, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'X-Line-Signature': signature
 },
 body: body
 });

 console.log('Status:', response.status);
 console.log('Response:', await response.text());
 } catch (error) {
 console.error('Error:', error);
 }
}

testWebhook();
```

## 8.

1. ** webhook **
 ```bash
 wrangler tail --format pretty
 # LINE
 ```

2. ** LINE **
 - LINE Developers Console
 - Webhook URL
 - "Verify"

3. ****
 -
 -
 -

4. ****
 - D1
 -
 -

## 9.


```bash
npm run deploy
```


```bash
wrangler deployments list
```


```bash
wrangler rollback
```

## 10.


1. `wrangler tail`
2. LINE Developers Console Webhook
3. `wrangler.toml`
4. D1 