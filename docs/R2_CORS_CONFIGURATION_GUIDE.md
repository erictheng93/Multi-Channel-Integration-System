# R2 Bucket CORS 配置完整指南

## 📋 目錄
1. [問題診斷](#問題診斷)
2. [解決方案總覽](#解決方案總覽)
3. [方法 1: Cloudflare Dashboard 配置（推薦）](#方法-1-cloudflare-dashboard-配置推薦)
4. [方法 2: 使用 Wrangler CLI](#方法-2-使用-wrangler-cli)
5. [方法 3: 透過 Worker 設置 CORS Headers](#方法-3-透過-worker-設置-cors-headers)
6. [驗證與測試](#驗證與測試)
7. [故障排除](#故障排除)

---

## 問題診斷

### 當前狀況
- **Bucket Name:** `multi-channel-platform-attachments`
- **Public URL:** `https://s3.imfinethankyouandyou.com`
- **錯誤:** `net::ERR_FAILED` - 無法載入 QR Code 圖片
- **影響:** QR Code 下載功能無法使用

### 根本原因
R2 bucket 缺少以下配置：
1. ❌ **CORS Headers** - 瀏覽器跨域請求被阻止
2. ❌ **Public Access** - 圖片 URL 無法公開訪問
3. ⚠️ **Custom Domain** - 可能未正確綁定

---

## 解決方案總覽

```
┌─────────────────────────────────────────────────────────┐
│  修復流程（3 個步驟）                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Step 1: 配置 CORS Policy                               │
│    ↓                                                    │
│  Step 2: 啟用 Public Access                             │
│    ↓                                                    │
│  Step 3: 驗證 Custom Domain                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 方法 1: Cloudflare Dashboard 配置（推薦）

### Step 1: 配置 CORS Policy

1. **登入 Cloudflare Dashboard**
   ```
   https://dash.cloudflare.com/
   ```

2. **導航到 R2**
   ```
   Home → R2 Object Storage → Buckets
   ```

3. **選擇你的 Bucket**
   ```
   multi-channel-platform-attachments
   ```

4. **配置 CORS**
   - 點擊 **Settings** 標籤
   - 找到 **CORS Policy** 部分
   - 點擊 **Add CORS Policy** 或 **Edit**

5. **添加以下 CORS 規則**

   ```json
   [
     {
       "AllowedOrigins": [
         "http://localhost:3000",
         "https://mcp.imfinethankyouandyou.com",
         "https://multi-channel.imfinethankyouandyou.com"
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

   **說明:**
   - `AllowedOrigins`: 允許的來源域名
   - `AllowedMethods`: 允許 GET 和 HEAD 請求
   - `AllowedHeaders`: 允許所有請求頭
   - `ExposeHeaders`: 暴露的響應頭
   - `MaxAgeSeconds`: CORS 預檢結果快取時間（1小時）

6. **保存配置**

---

### Step 2: 啟用 Public Access

1. **在同一個 Bucket Settings 頁面**
   - 找到 **Public Access** 部分

2. **選擇 Public Access 選項**

   **選項 A: 完全公開 Bucket（最簡單）**
   ```
   ☑️ Allow public access to all objects
   ```

   **選項 B: 使用 Custom Domain（推薦）**
   ```
   1. 點擊 "Connect Custom Domain"
   2. 輸入: s3.imfinethankyouandyou.com
   3. Cloudflare 會自動配置 DNS 記錄
   4. 等待 DNS 傳播（通常 1-5 分鐘）
   ```

3. **保存配置**

---

### Step 3: 驗證 Custom Domain

1. **檢查 DNS 記錄**
   ```bash
   nslookup s3.imfinethankyouandyou.com
   ```

   **預期輸出:**
   ```
   Name:    s3.imfinethankyouandyou.com
   Address: <Cloudflare R2 IP>
   ```

2. **測試域名解析**
   ```bash
   curl -I https://s3.imfinethankyouandyou.com
   ```

   **預期輸出:**
   ```
   HTTP/2 200
   access-control-allow-origin: *
   ...
   ```

---

## 方法 2: 使用 Wrangler CLI

### Step 1: 創建 CORS 配置文件

創建文件: `r2-cors-config.json`

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": [
        "http://localhost:3000",
        "https://mcp.imfinethankyouandyou.com",
        "https://multi-channel.imfinethankyouandyou.com"
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

**⚠️ 注意:** Wrangler CLI 目前**不直接支持** CORS 配置命令。
你需要使用 **Cloudflare API** 或 **Dashboard**。

如果要使用 API，請參考下一步。

---

### Step 3: 使用 Cloudflare API 設置 CORS

```bash
# 獲取 Cloudflare Account ID
wrangler whoami

# 使用 API 設置 CORS（需要 API Token）
curl -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/r2/buckets/multi-channel-platform-attachments/cors" \
  -H "Authorization: Bearer {API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data @r2-cors-config.json
```

**獲取 API Token:**
1. 前往: https://dash.cloudflare.com/profile/api-tokens
2. 創建 Token with **R2 Edit** 權限
3. 複製 Token

---

## 方法 3: 透過 Worker 設置 CORS Headers

**如果 R2 原生 CORS 無法使用**，可以在 Worker 中添加 CORS headers。

### Step 1: 修改 Worker 代碼

在 `src/index.ts` 中添加 R2 代理路由:

```typescript
// 添加 R2 公共訪問路由（帶 CORS）
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

// 處理 CORS 預檢請求
app.options('/r2-public/:folder/:filename', async (c) => {
  const headers = new Headers()
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  headers.set('Access-Control-Allow-Headers', '*')
  headers.set('Access-Control-Max-Age', '3600')

  return new Response(null, { status: 204, headers })
})
```

### Step 2: 更新 QR Code URL

修改 QR Code 生成代碼，使用 Worker 路由而非直接 R2 URL:

```typescript
// 舊的 URL (直接 R2)
const oldUrl = `https://s3.imfinethankyouandyou.com/qr-codes/${filename}`

// 新的 URL (透過 Worker)
const newUrl = `https://multi-channel.imfinethankyouandyou.com/r2-public/qr-codes/${filename}`
```

### Step 3: 部署更新

```bash
npm run deploy
```

---

## 驗證與測試

### Test 1: CORS Headers 檢查

```bash
curl -I -H "Origin: http://localhost:3000" \
  https://s3.imfinethankyouandyou.com/qr-codes/team-14-1767146927377.svg
```

**預期輸出:**
```
HTTP/2 200
access-control-allow-origin: *
access-control-allow-methods: GET, HEAD
access-control-expose-headers: ETag, Content-Length, Content-Type
...
```

### Test 2: 瀏覽器訪問測試

直接在瀏覽器打開:
```
https://s3.imfinethankyouandyou.com/qr-codes/team-14-1767146927377.svg
```

**預期:** 應該能看到 SVG QR Code 圖片

### Test 3: E2E 下載測試

1. 前往團隊管理頁面
2. 點擊任一團隊的 "QR 碼" 按鈕
3. 點擊 "下載 QR Code" 按鈕
4. **預期:** 成功下載 PNG 文件

### Test 4: JavaScript Console 測試

在瀏覽器 Console 執行:

```javascript
// 測試 CORS 圖片載入
const img = new Image()
img.crossOrigin = 'anonymous'
img.onload = () => console.log('✅ Image loaded successfully')
img.onerror = (e) => console.error('❌ Image load failed:', e)
img.src = 'https://s3.imfinethankyouandyou.com/qr-codes/team-14-1767146927377.svg'
```

**預期輸出:** `✅ Image loaded successfully`

---

## 故障排除

### 問題 1: CORS 錯誤仍然存在

**症狀:**
```
Access to image at '...' from origin '...' has been blocked by CORS policy
```

**解決方案:**
1. 清除瀏覽器快取
2. 等待 CDN 快取過期（最多 1 小時）
3. 檢查 CORS 配置中的 `AllowedOrigins` 是否包含你的域名
4. 使用 `curl` 命令驗證 CORS headers

### 問題 2: 圖片無法載入

**症狀:**
```
Failed to load resource: net::ERR_FAILED
```

**檢查清單:**
- [ ] R2 Bucket 是否存在
- [ ] 文件是否已上傳到 R2
- [ ] Custom Domain DNS 是否正確配置
- [ ] Public Access 是否已啟用

**診斷命令:**
```bash
# 檢查 bucket
wrangler r2 bucket list

# 檢查 DNS
nslookup s3.imfinethankyouandyou.com

# 測試直接訪問
curl -I https://s3.imfinethankyouandyou.com
```

### 問題 3: Custom Domain 無法訪問

**症狀:**
DNS 解析失敗或連接超時

**解決方案:**
1. **檢查 DNS 記錄**
   ```bash
   nslookup s3.imfinethankyouandyou.com
   ```

2. **在 Cloudflare Dashboard 重新綁定 Custom Domain**
   - R2 → Bucket Settings → Public Access
   - Remove existing custom domain
   - Add custom domain again: `s3.imfinethankyouandyou.com`

3. **等待 DNS 傳播**
   - 通常需要 1-5 分鐘
   - 最多可能需要 24 小時

4. **清除 DNS 快取**
   ```bash
   # Windows
   ipconfig /flushdns

   # macOS/Linux
   sudo dscacheutil -flushcache
   ```

### 問題 4: 部分文件可訪問，部分不可訪問

**症狀:**
某些 QR Code 可以下載，某些不行

**解決方案:**
1. **檢查文件權限**
   - 確保所有文件都使用相同的上傳方式
   - 驗證文件確實存在於 R2

2. **檢查文件命名**
   - 避免特殊字符
   - 使用一致的命名規範

3. **重新上傳問題文件**

---

## 推薦配置總結

### 最佳實踐配置

```json
{
  "CORS": {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://mcp.imfinethankyouandyou.com",
      "https://multi-channel.imfinethankyouandyou.com"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3600
  },
  "PublicAccess": "Enabled",
  "CustomDomain": "s3.imfinethankyouandyou.com",
  "CacheControl": "public, max-age=31536000"
}
```

### 安全建議

1. **限制 AllowedOrigins**
   - 不要使用 `*`（全部允許）
   - 只列出需要訪問的域名

2. **限制 AllowedMethods**
   - 只允許 `GET` 和 `HEAD`
   - 不要允許 `PUT`、`DELETE` 等修改操作

3. **設置適當的 Cache-Control**
   - QR Code 是靜態資源，可以長期快取
   - 建議: `public, max-age=31536000` (1年)

---

## 下一步

完成 R2 CORS 配置後：

1. ✅ **測試 QR Code 下載功能**
2. ✅ **驗證所有團隊的 QR Code 都能下載**
3. ✅ **檢查瀏覽器 Console 無 CORS 錯誤**
4. ✅ **更新文檔記錄配置**

---

## 參考資源

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [CORS 詳解](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [R2 Custom Domains](https://developers.cloudflare.com/r2/buckets/public-buckets/#custom-domains)

---

**最後更新:** 2025-12-31
**作者:** Claude Code Assistant
**版本:** 1.0
