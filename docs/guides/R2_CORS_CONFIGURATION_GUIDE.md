# R2 Bucket CORS ?�置完整?��?

## ?? ?��?
1. [?��?診斷](#?��?診斷)
2. [�?��?��?總覽](#�?��?��?總覽)
3. [?��? 1: Cloudflare Dashboard ?�置（推?��?](#?��?-1-cloudflare-dashboard-?�置?�薦)
4. [?��? 2: 使用 Wrangler CLI](#?��?-2-使用-wrangler-cli)
5. [?��? 3: ?��? Worker 設置 CORS Headers](#?��?-3-?��?-worker-設置-cors-headers)
6. [驗�??�測試](#驗�??�測�?
7. [?��??�除](#?��??�除)

---

## ?��?診斷

### ?��??��?
- **Bucket Name:** `mcis-files`
- **Public URL:** `https://your-storage-domain.example.com`
- **?�誤:** `net::ERR_FAILED` - ?��?載入 QR Code ?��?
- **影響:** QR Code 下�??�能?��?使用

### ?�本?��?
R2 bucket 缺�?以�??�置�?
1. ??**CORS Headers** - ?�覽?�跨?��?求被?�止
2. ??**Public Access** - ?��? URL ?��??��?訪�?
3. ?��? **Custom Domain** - ?�能?�正確�?�?

---

## �?��?��?總覽

```
?��??�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�??
?? 修復流�?�? ?�步驟�? ??
?��??�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�??
?? ??
?? Step 1: ?�置 CORS Policy ??
?? ?? ??
?? Step 2: ?�用 Public Access ??
?? ?? ??
?? Step 3: 驗�? Custom Domain ??
?? ??
?��??�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�??
```

---

## ?��? 1: Cloudflare Dashboard ?�置（推?��?

### Step 1: ?�置 CORS Policy

1. **?�入 Cloudflare Dashboard**
   ```
   https://dash.cloudflare.com/
   ```

2. **導航??R2**
   ```
   Home ??R2 Object Storage ??Buckets
   ```

3. **?��?你�? Bucket**
   ```
   mcis-files
   ```

4. **?�置 CORS**
   - 點�? **Settings** 標籤
   - ?�到 **CORS Policy** ?��?
   - 點�? **Add CORS Policy** ??**Edit**

5. **添�?以�? CORS 規�?**

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

   **說�?:**
   - `AllowedOrigins`: ?�許?��?源�???
   - `AllowedMethods`: ?�許 GET ??HEAD 請�?
   - `AllowedHeaders`: ?�許?�?��?求頭
   - `ExposeHeaders`: ?�露?�響?�頭
   - `MaxAgeSeconds`: CORS ?�檢結�?快�??��?�?小�?�?

6. **保�??�置**

---

### Step 2: ?�用 Public Access

1. **?��?一??Bucket Settings ?�面**
   - ?�到 **Public Access** ?��?

2. **?��? Public Access ?��?**

   **?��? A: 完全?��? Bucket（�?簡單�?*
   ```
   ?��? Allow public access to all objects
   ```

   **?��? B: 使用 Custom Domain（推?��?**
   ```
   1. 點�? "Connect Custom Domain"
   2. 輸入: your-storage-domain.example.com
   3. Cloudflare ?�自?��?�?DNS 記�?
   4. 等�? DNS ?�播（通常 1-5 ?��?�?
   ```

3. **保�??�置**

---

### Step 3: 驗�? Custom Domain

1. **檢查 DNS 記�?**
   ```bash
   nslookup your-storage-domain.example.com
   ```

   **?��?輸出:**
   ```
   Name: your-storage-domain.example.com
   Address: <Cloudflare R2 IP>
   ```

2. **測試?��?�??**
   ```bash
   curl -I https://your-storage-domain.example.com
   ```

   **?��?輸出:**
   ```
   HTTP/2 200
   access-control-allow-origin: *
   ...
   ```

---

## ?��? 2: 使用 Wrangler CLI

### Step 1: ?�建 CORS ?�置?�件

?�建?�件: `r2-cors-config.json`

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

### Step 2: 使用 Wrangler 設置 CORS

**?��? 注�?:** Wrangler CLI ?��?**不直?�支??* CORS ?�置?�令??
你�?要使??**Cloudflare API** ??**Dashboard**??

如�?要使??API，�??�考�?一步�?

---

### Step 3: 使用 Cloudflare API 設置 CORS

```bash
# ?��? Cloudflare Account ID
wrangler whoami

# 使用 API 設置 CORS（�?�?API Token�?
curl -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/r2/buckets/mcis-files/cors" \
  -H "Authorization: Bearer {API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data @r2-cors-config.json
```

**?��? API Token:**
1. ?��?: https://dash.cloudflare.com/profile/api-tokens
2. ?�建 Token with **R2 Edit** 權�?
3. 複製 Token

---

## ?��? 3: ?��? Worker 設置 CORS Headers

**如�? R2 ?��? CORS ?��?使用**，可以在 Worker 中添??CORS headers??

### Step 1: 修改 Worker �?��

??`src/index.ts` 中添??R2 �??路由:

```typescript
// 添�? R2 ?�共訪�?路由（帶 CORS�?
app.get('/r2-public/:folder/:filename', async (c) => {
  const { folder, filename } = c.req.param()
  const objectKey = `${folder}/${filename}`

  try {
    const object = await c.env.R2_BUCKET.get(objectKey)

    if (!object) {
      return c.json({ error: 'File not found' }, 404)
    }

    // 設置 CORS Headers
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

// ?��? CORS ?�檢請�?
app.options('/r2-public/:folder/:filename', async (c) => {
  const headers = new Headers()
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  headers.set('Access-Control-Allow-Headers', '*')
  headers.set('Access-Control-Max-Age', '3600')

  return new Response(null, { status: 204, headers })
})
```

### Step 2: ?�新 QR Code URL

修改 QR Code ?��?�?��，使??Worker 路由?��??�接 R2 URL:

```typescript
// ?��? URL (?�接 R2)
const oldUrl = `https://your-storage-domain.example.com/qr-codes/${filename}`

// ?��? URL (?��? Worker)
const newUrl = `https://your-api-domain.example.com/r2-public/qr-codes/${filename}`
```

### Step 3: ?�署?�新

```bash
npm run deploy
```

---

## 驗�??�測�?

### Test 1: CORS Headers 檢查

```bash
curl -I -H "Origin: http://localhost:3000" \
  https://your-storage-domain.example.com/qr-codes/team-14-1767146927377.svg
```

**?��?輸出:**
```
HTTP/2 200
access-control-allow-origin: *
access-control-allow-methods: GET, HEAD
access-control-expose-headers: ETag, Content-Length, Content-Type
...
```

### Test 2: ?�覽?�訪?�測�?

?�接?�瀏覽?��???
```
https://your-storage-domain.example.com/qr-codes/team-14-1767146927377.svg
```

**?��?:** ?�該?��???SVG QR Code ?��?

### Test 3: E2E 下�?測試

1. ?��??��?管�??�面
2. 點�?任�??��???"QR �? ?��?
3. 點�? "下�? QR Code" ?��?
4. **?��?:** ?��?下�? PNG ?�件

### Test 4: JavaScript Console 測試

?�瀏覽??Console ?��?:

```javascript
// 測試 CORS ?��?載入
const img = new Image()
img.crossOrigin = 'anonymous'
img.onload = () => console.log('??Image loaded successfully')
img.onerror = (e) => console.error('??Image load failed:', e)
img.src = 'https://your-storage-domain.example.com/qr-codes/team-14-1767146927377.svg'
```

**?��?輸出:** `??Image loaded successfully`

---

## ?��??�除

### ?��? 1: CORS ?�誤仍然存在

**?��?:**
```
Access to image at '...' from origin '...' has been blocked by CORS policy
```

**�?��?��?:**
1. 清除?�覽?�快??
2. 等�? CDN 快�??��?（�?�?1 小�?�?
3. 檢查 CORS ?�置中�? `AllowedOrigins` ?�否?�含你�??��?
4. 使用 `curl` ?�令驗�? CORS headers

### ?��? 2: ?��??��?載入

**?��?:**
```
Failed to load resource: net::ERR_FAILED
```

**檢查清單:**
- [ ] R2 Bucket ?�否存在
- [ ] ?�件?�否已�??�到 R2
- [ ] Custom Domain DNS ?�否�?��?�置
- [ ] Public Access ?�否已�???

**診斷?�令:**
```bash
# 檢查 bucket
wrangler r2 bucket list

# 檢查 DNS
nslookup your-storage-domain.example.com

# 測試?�接訪�?
curl -I https://your-storage-domain.example.com
```

### ?��? 3: Custom Domain ?��?訪�?

**?��?:**
DNS �??失�??��?��超�?

**�?��?��?:**
1. **檢查 DNS 記�?**
   ```bash
   nslookup your-storage-domain.example.com
   ```

2. **??Cloudflare Dashboard ?�新綁�? Custom Domain**
   - R2 ??Bucket Settings ??Public Access
   - Remove existing custom domain
   - Add custom domain again: `your-storage-domain.example.com`

3. **等�? DNS ?�播**
   - ?�常?��?1-5 ?��?
   - ?�多可?��?�?24 小�?

4. **清除 DNS 快�?**
   ```bash
   # Windows
   ipconfig /flushdns

   # macOS/Linux
   sudo dscacheutil -flushcache
   ```

### ?��? 4: ?��??�件?�訪?��??��?不可訪�?

**?��?:**
?��? QR Code ?�以下�?，�?些�?�?

**�?��?��?:**
1. **檢查?�件權�?**
   - 確�??�?��?件都使用?��??��??�方�?
   - 驗�??�件確實存在??R2

2. **檢查?�件?��?**
   - ?��??��?字符
   - 使用一?��??��?規�?

3. **?�新上傳?��??�件**

---

## ?�薦?�置總�?

### ?�佳實踐�?�?

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

### 安全建議

1. **?�制 AllowedOrigins**
   - 不�?使用 `*`（全?��?許�?
   - ?��??��?要訪?��??��?

2. **?�制 AllowedMethods**
   - ?��?�?`GET` ??`HEAD`
   - 不�??�許 `PUT`?�`DELETE` 等修?��?�?

3. **設置?�當??Cache-Control**
   - QR Code ?��??��?源�??�以?��?快�?
   - 建議: `public, max-age=31536000` (1�?

---

## 下�?�?

完�? R2 CORS ?�置後�?

1. ??**測試 QR Code 下�??�能**
2. ??**驗�??�?��??��? QR Code ?�能下�?**
3. ??**檢查?�覽??Console ??CORS ?�誤**
4. ??**?�新?��?記�??�置**

---

## ?�考�?�?

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [CORS 詳解](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [R2 Custom Domains](https://developers.cloudflare.com/r2/buckets/public-buckets/#custom-domains)

---

**?�後更??** 2025-12-31
**作�?** Claude Code Assistant
**?�本:** 1.0
