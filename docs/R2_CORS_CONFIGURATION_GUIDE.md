# R2 Bucket CORS ?ç½®å®Œæ•´?‡å?

## ?? ?®é?
1. [?é?è¨ºæ–·](#?é?è¨ºæ–·)
2. [è§?±º?¹æ?ç¸½è¦½](#è§?±º?¹æ?ç¸½è¦½)
3. [?¹æ? 1: Cloudflare Dashboard ?ç½®ï¼ˆæ¨?¦ï?](#?¹æ?-1-cloudflare-dashboard-?ç½®?¨è–¦)
4. [?¹æ? 2: ä½¿ç”¨ Wrangler CLI](#?¹æ?-2-ä½¿ç”¨-wrangler-cli)
5. [?¹æ? 3: ?é? Worker è¨­ç½® CORS Headers](#?¹æ?-3-?é?-worker-è¨­ç½®-cors-headers)
6. [é©—è??‡æ¸¬è©¦](#é©—è??‡æ¸¬è©?
7. [?…é??’é™¤](#?…é??’é™¤)

---

## ?é?è¨ºæ–·

### ?¶å??€æ³?
- **Bucket Name:** `multi-channel-platform-attachments`
- **Public URL:** `https://your-storage-domain.example.com`
- **?¯èª¤:** `net::ERR_FAILED` - ?¡æ?è¼‰å…¥ QR Code ?–ç?
- **å½±éŸ¿:** QR Code ä¸‹è??Ÿèƒ½?¡æ?ä½¿ç”¨

### ?¹æœ¬?Ÿå?
R2 bucket ç¼ºå?ä»¥ä??ç½®ï¼?
1. ??**CORS Headers** - ?è¦½?¨è·¨?Ÿè?æ±‚è¢«?»æ­¢
2. ??**Public Access** - ?–ç? URL ?¡æ??¬é?è¨ªå?
3. ? ï? **Custom Domain** - ?¯èƒ½?ªæ­£ç¢ºç?å®?

---

## è§?±º?¹æ?ç¸½è¦½

```
?Œâ??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€??
?? ä¿®å¾©æµç?ï¼? ?‹æ­¥é©Ÿï?                                      ??
?œâ??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€??
??                                                        ??
?? Step 1: ?ç½® CORS Policy                               ??
??   ??                                                   ??
?? Step 2: ?Ÿç”¨ Public Access                             ??
??   ??                                                   ??
?? Step 3: é©—è? Custom Domain                             ??
??                                                        ??
?”â??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€??
```

---

## ?¹æ? 1: Cloudflare Dashboard ?ç½®ï¼ˆæ¨?¦ï?

### Step 1: ?ç½® CORS Policy

1. **?»å…¥ Cloudflare Dashboard**
   ```
   https://dash.cloudflare.com/
   ```

2. **å°èˆª??R2**
   ```
   Home ??R2 Object Storage ??Buckets
   ```

3. **?¸æ?ä½ ç? Bucket**
   ```
   multi-channel-platform-attachments
   ```

4. **?ç½® CORS**
   - é»æ? **Settings** æ¨™ç±¤
   - ?¾åˆ° **CORS Policy** ?¨å?
   - é»æ? **Add CORS Policy** ??**Edit**

5. **æ·»å?ä»¥ä? CORS è¦å?**

   ```json
   [
     {
       "AllowedOrigins": [
         "http://localhost:3000",
         "https://your-frontend-domain.example.com",
         "https://your-api-domain.example.com"
       ],
       "AllowedMethods": [
         "GET",
         "HEAD"
       ],
       "AllowedHeaders": [
         "*"
       ],
       "ExposeHeaders": [
         "ETag",
         "Content-Length",
         "Content-Type"
       ],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   **èªªæ?:**
   - `AllowedOrigins`: ?è¨±?„ä?æºå???
   - `AllowedMethods`: ?è¨± GET ??HEAD è«‹æ?
   - `AllowedHeaders`: ?è¨±?€?‰è?æ±‚é ­
   - `ExposeHeaders`: ?´éœ²?„éŸ¿?‰é ­
   - `MaxAgeSeconds`: CORS ?æª¢çµæ?å¿«å??‚é?ï¼?å°æ?ï¼?

6. **ä¿å??ç½®**

---

### Step 2: ?Ÿç”¨ Public Access

1. **?¨å?ä¸€??Bucket Settings ?é¢**
   - ?¾åˆ° **Public Access** ?¨å?

2. **?¸æ? Public Access ?¸é?**

   **?¸é? A: å®Œå…¨?¬é? Bucketï¼ˆæ?ç°¡å–®ï¼?*
   ```
   ?‘ï? Allow public access to all objects
   ```

   **?¸é? B: ä½¿ç”¨ Custom Domainï¼ˆæ¨?¦ï?**
   ```
   1. é»æ? "Connect Custom Domain"
   2. è¼¸å…¥: your-storage-domain.example.com
   3. Cloudflare ?ƒè‡ª?•é?ç½?DNS è¨˜é?
   4. ç­‰å? DNS ?³æ’­ï¼ˆé€šå¸¸ 1-5 ?†é?ï¼?
   ```

3. **ä¿å??ç½®**

---

### Step 3: é©—è? Custom Domain

1. **æª¢æŸ¥ DNS è¨˜é?**
   ```bash
   nslookup your-storage-domain.example.com
   ```

   **?æ?è¼¸å‡º:**
   ```
   Name:    your-storage-domain.example.com
   Address: <Cloudflare R2 IP>
   ```

2. **æ¸¬è©¦?Ÿå?è§??**
   ```bash
   curl -I https://your-storage-domain.example.com
   ```

   **?æ?è¼¸å‡º:**
   ```
   HTTP/2 200
   access-control-allow-origin: *
   ...
   ```

---

## ?¹æ? 2: ä½¿ç”¨ Wrangler CLI

### Step 1: ?µå»º CORS ?ç½®?‡ä»¶

?µå»º?‡ä»¶: `r2-cors-config.json`

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": [
        "http://localhost:3000",
        "https://your-frontend-domain.example.com",
        "https://your-api-domain.example.com"
      ],
      "AllowedMethods": [
        "GET",
        "HEAD"
      ],
      "AllowedHeaders": [
        "*"
      ],
      "ExposeHeaders": [
        "ETag",
        "Content-Length",
        "Content-Type"
      ],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

### Step 2: ä½¿ç”¨ Wrangler è¨­ç½® CORS

**? ï? æ³¨æ?:** Wrangler CLI ?®å?**ä¸ç›´?¥æ”¯??* CORS ?ç½®?½ä»¤??
ä½ é?è¦ä½¿??**Cloudflare API** ??**Dashboard**??

å¦‚æ?è¦ä½¿??APIï¼Œè??ƒè€ƒä?ä¸€æ­¥ã€?

---

### Step 3: ä½¿ç”¨ Cloudflare API è¨­ç½® CORS

```bash
# ?²å? Cloudflare Account ID
wrangler whoami

# ä½¿ç”¨ API è¨­ç½® CORSï¼ˆé?è¦?API Tokenï¼?
curl -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/r2/buckets/multi-channel-platform-attachments/cors" \
  -H "Authorization: Bearer {API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data @r2-cors-config.json
```

**?²å? API Token:**
1. ?å?: https://dash.cloudflare.com/profile/api-tokens
2. ?µå»º Token with **R2 Edit** æ¬Šé?
3. è¤‡è£½ Token

---

## ?¹æ? 3: ?é? Worker è¨­ç½® CORS Headers

**å¦‚æ? R2 ?Ÿç? CORS ?¡æ?ä½¿ç”¨**ï¼Œå¯ä»¥åœ¨ Worker ä¸­æ·»??CORS headers??

### Step 1: ä¿®æ”¹ Worker ä»?¢¼

??`src/index.ts` ä¸­æ·»??R2 ä»??è·¯ç”±:

```typescript
// æ·»å? R2 ?¬å…±è¨ªå?è·¯ç”±ï¼ˆå¸¶ CORSï¼?
app.get('/r2-public/:folder/:filename', async (c) => {
  const { folder, filename } = c.req.param()
  const objectKey = `${folder}/${filename}`

  try {
    const object = await c.env.R2_BUCKET.get(objectKey)

    if (!object) {
      return c.json({ error: 'File not found' }, 404)
    }

    // è¨­ç½® CORS Headers
    const headers = new Headers()
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    headers.set('Access-Control-Allow-Headers', '*')
    headers.set('Access-Control-Expose-Headers', 'ETag, Content-Length, Content-Type')
    headers.set('Access-Control-Max-Age', '3600')
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream')
    headers.set('ETag', object.httpEtag)
    headers.set('Cache-Control', 'public, max-age=31536000')

    return new Response(object.body, { headers })
  } catch (error) {
    console.error('R2 access error:', error)
    return c.json({ error: 'Failed to fetch file' }, 500)
  }
})

// ?•ç? CORS ?æª¢è«‹æ?
app.options('/r2-public/:folder/:filename', async (c) => {
  const headers = new Headers()
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  headers.set('Access-Control-Allow-Headers', '*')
  headers.set('Access-Control-Max-Age', '3600')

  return new Response(null, { status: 204, headers })
})
```

### Step 2: ?´æ–° QR Code URL

ä¿®æ”¹ QR Code ?Ÿæ?ä»?¢¼ï¼Œä½¿??Worker è·¯ç”±?Œé??´æ¥ R2 URL:

```typescript
// ?Šç? URL (?´æ¥ R2)
const oldUrl = `https://your-storage-domain.example.com/qr-codes/${filename}`

// ?°ç? URL (?é? Worker)
const newUrl = `https://your-api-domain.example.com/r2-public/qr-codes/${filename}`
```

### Step 3: ?¨ç½²?´æ–°

```bash
npm run deploy
```

---

## é©—è??‡æ¸¬è©?

### Test 1: CORS Headers æª¢æŸ¥

```bash
curl -I -H "Origin: http://localhost:3000" \
  https://your-storage-domain.example.com/qr-codes/team-14-1767146927377.svg
```

**?æ?è¼¸å‡º:**
```
HTTP/2 200
access-control-allow-origin: *
access-control-allow-methods: GET, HEAD
access-control-expose-headers: ETag, Content-Length, Content-Type
...
```

### Test 2: ?è¦½?¨è¨ª?æ¸¬è©?

?´æ¥?¨ç€è¦½?¨æ???
```
https://your-storage-domain.example.com/qr-codes/team-14-1767146927377.svg
```

**?æ?:** ?‰è©²?½ç???SVG QR Code ?–ç?

### Test 3: E2E ä¸‹è?æ¸¬è©¦

1. ?å??˜é?ç®¡ç??é¢
2. é»æ?ä»»ä??˜é???"QR ç¢? ?‰é?
3. é»æ? "ä¸‹è? QR Code" ?‰é?
4. **?æ?:** ?å?ä¸‹è? PNG ?‡ä»¶

### Test 4: JavaScript Console æ¸¬è©¦

?¨ç€è¦½??Console ?·è?:

```javascript
// æ¸¬è©¦ CORS ?–ç?è¼‰å…¥
const img = new Image()
img.crossOrigin = 'anonymous'
img.onload = () => console.log('??Image loaded successfully')
img.onerror = (e) => console.error('??Image load failed:', e)
img.src = 'https://your-storage-domain.example.com/qr-codes/team-14-1767146927377.svg'
```

**?æ?è¼¸å‡º:** `??Image loaded successfully`

---

## ?…é??’é™¤

### ?é? 1: CORS ?¯èª¤ä»ç„¶å­˜åœ¨

**?‡ç?:**
```
Access to image at '...' from origin '...' has been blocked by CORS policy
```

**è§?±º?¹æ?:**
1. æ¸…é™¤?è¦½?¨å¿«??
2. ç­‰å? CDN å¿«å??æ?ï¼ˆæ?å¤?1 å°æ?ï¼?
3. æª¢æŸ¥ CORS ?ç½®ä¸­ç? `AllowedOrigins` ?¯å¦?…å«ä½ ç??Ÿå?
4. ä½¿ç”¨ `curl` ?½ä»¤é©—è? CORS headers

### ?é? 2: ?–ç??¡æ?è¼‰å…¥

**?‡ç?:**
```
Failed to load resource: net::ERR_FAILED
```

**æª¢æŸ¥æ¸…å–®:**
- [ ] R2 Bucket ?¯å¦å­˜åœ¨
- [ ] ?‡ä»¶?¯å¦å·²ä??³åˆ° R2
- [ ] Custom Domain DNS ?¯å¦æ­?¢º?ç½®
- [ ] Public Access ?¯å¦å·²å???

**è¨ºæ–·?½ä»¤:**
```bash
# æª¢æŸ¥ bucket
wrangler r2 bucket list

# æª¢æŸ¥ DNS
nslookup your-storage-domain.example.com

# æ¸¬è©¦?´æ¥è¨ªå?
curl -I https://your-storage-domain.example.com
```

### ?é? 3: Custom Domain ?¡æ?è¨ªå?

**?‡ç?:**
DNS è§??å¤±æ??–é€?¥è¶…æ?

**è§?±º?¹æ?:**
1. **æª¢æŸ¥ DNS è¨˜é?**
   ```bash
   nslookup your-storage-domain.example.com
   ```

2. **??Cloudflare Dashboard ?æ–°ç¶å? Custom Domain**
   - R2 ??Bucket Settings ??Public Access
   - Remove existing custom domain
   - Add custom domain again: `your-storage-domain.example.com`

3. **ç­‰å? DNS ?³æ’­**
   - ?šå¸¸?€è¦?1-5 ?†é?
   - ?€å¤šå¯?½é?è¦?24 å°æ?

4. **æ¸…é™¤ DNS å¿«å?**
   ```bash
   # Windows
   ipconfig /flushdns

   # macOS/Linux
   sudo dscacheutil -flushcache
   ```

### ?é? 4: ?¨å??‡ä»¶?¯è¨ª?ï??¨å?ä¸å¯è¨ªå?

**?‡ç?:**
?ä? QR Code ?¯ä»¥ä¸‹è?ï¼Œæ?äº›ä?è¡?

**è§?±º?¹æ?:**
1. **æª¢æŸ¥?‡ä»¶æ¬Šé?**
   - ç¢ºä??€?‰æ?ä»¶éƒ½ä½¿ç”¨?¸å??„ä??³æ–¹å¼?
   - é©—è??‡ä»¶ç¢ºå¯¦å­˜åœ¨??R2

2. **æª¢æŸ¥?‡ä»¶?½å?**
   - ?¿å??¹æ?å­—ç¬¦
   - ä½¿ç”¨ä¸€?´ç??½å?è¦ç?

3. **?æ–°ä¸Šå‚³?é??‡ä»¶**

---

## ?¨è–¦?ç½®ç¸½ç?

### ?€ä½³å¯¦è¸é?ç½?

```json
{
  "CORS": {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://your-frontend-domain.example.com",
      "https://your-api-domain.example.com"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3600
  },
  "PublicAccess": "Enabled",
  "CustomDomain": "your-storage-domain.example.com",
  "CacheControl": "public, max-age=31536000"
}
```

### å®‰å…¨å»ºè­°

1. **?åˆ¶ AllowedOrigins**
   - ä¸è?ä½¿ç”¨ `*`ï¼ˆå…¨?¨å?è¨±ï?
   - ?ªå??ºé?è¦è¨ª?ç??Ÿå?

2. **?åˆ¶ AllowedMethods**
   - ?ªå?è¨?`GET` ??`HEAD`
   - ä¸è??è¨± `PUT`?`DELETE` ç­‰ä¿®?¹æ?ä½?

3. **è¨­ç½®?©ç•¶??Cache-Control**
   - QR Code ?¯é??‹è?æºï??¯ä»¥?·æ?å¿«å?
   - å»ºè­°: `public, max-age=31536000` (1å¹?

---

## ä¸‹ä?æ­?

å®Œæ? R2 CORS ?ç½®å¾Œï?

1. ??**æ¸¬è©¦ QR Code ä¸‹è??Ÿèƒ½**
2. ??**é©—è??€?‰å??Šç? QR Code ?½èƒ½ä¸‹è?**
3. ??**æª¢æŸ¥?è¦½??Console ??CORS ?¯èª¤**
4. ??**?´æ–°?‡æ?è¨˜é??ç½®**

---

## ?ƒè€ƒè?æº?

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [CORS è©³è§£](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [R2 Custom Domains](https://developers.cloudflare.com/r2/buckets/public-buckets/#custom-domains)

---

**?€å¾Œæ›´??** 2025-12-31
**ä½œè€?** Claude Code Assistant
**?ˆæœ¬:** 1.0
