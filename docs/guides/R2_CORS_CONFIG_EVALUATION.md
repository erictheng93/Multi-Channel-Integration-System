# R2 CORS ?�置評估?��?

**評估?��?:** 2025-12-31
**Bucket:** mcis-files
**Custom Domain:** your-storage-domain.example.com

---

## ?? 測試結�?總覽

| 測試?�目 | ?�??| 詳�? |
|---------|------|------|
| Custom Domain DNS �?? | ??**PASS** | �?���????Cloudflare IP |
| SSL/TLS 證書 | ??**PASS** | TLS 1.3 �?��?��? |
| R2 ?�件訪�? | ??**PASS** | HTTP 200 OK |
| CORS GET Request | ??**PASS** | �?��返�? CORS headers |
| CORS Preflight (OPTIONS) | ??**PASS** | 204 No Content with CORS headers |
| Access-Control-Allow-Origin | ??**PASS** | �?��返�?請�???Origin |
| Access-Control-Expose-Headers | ??**PASS** | ETag, Content-Length, Content-Type |

---

## ?? 詳細測試記�?

### Test 1: Custom Domain ??��測試

```bash
$ curl -I https://your-storage-domain.example.com/qr-codes/team-14-1767146927377.svg

HTTP/1.1 200 OK ??
Content-Type: image/svg+xml ??
Content-Length: 2871 ??
Server: cloudflare ??
```

**結�?:** Custom Domain 完全�?��?��?

---

### Test 2: CORS GET Request 測試

```bash
$ curl -I -H "Origin: http://localhost:3000" \
  https://your-storage-domain.example.com/qr-codes/team-14-1767146927377.svg

HTTP/1.1 200 OK ??
Access-Control-Allow-Origin: http://localhost:3000 ??
Access-Control-Expose-Headers: ETag,Content-Length,Content-Type ??
Vary: Origin, Accept-Encoding ??
ETag: "7967181b164f6b5935c4c7132fdb6b1c" ??
```

**結�?:** CORS headers �?��返�?，�??�符?��?�?

---

### Test 3: CORS Preflight (OPTIONS) 測試

```bash
$ curl -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: content-type" \
  -I https://your-storage-domain.example.com/qr-codes/team-14-1767146927377.svg

HTTP/1.1 204 No Content ??
Access-Control-Allow-Origin: http://localhost:3000 ??
Access-Control-Allow-Headers: content-type ??
Access-Control-Allow-Methods: GET, PUT, HEAD, DELETE ??
Access-Control-Max-Age: 3600 ??
```

**結�?:** CORS preflight 請�??��?�?��

---

## ?��? ?�現?��??��?

### ?��? 1: AllowedHeaders 不�??�面

**?��??�置:**
```json
"AllowedHeaders": [
  "content-type",
  "content-length",
  "x-amz-content-sha256",
  "x-amz-date",
  "authorization",
  "cache-control",
  "x-requested-with"
]
```

**建議?��?**
```json
"AllowedHeaders": ["*"]
```

**?��?:**
- ?��??�置?�然?�含了常�?headers，�??�能?��?一些瀏覽?�自?�添?��? headers
- 使用 `*` ?�用字符?��?保險，�?不影?��??�性�??��? GET/HEAD 請�?�?

**影響程度:** ?�� 中�?（可?��??��?些瀏覽?��?求被?�止�?

---

### ?��? 2: ExposeHeaders ?�以?��???

**?��??�置:**
```json
"ExposeHeaders": [
  "ETag",
  "Content-Length",
  "Content-Type"
]
```

**建議?��?**
```json
"ExposeHeaders": [
  "ETag",
  "Content-Length",
  "Content-Type",
  "Last-Modified",
  "Cache-Control",
  "Content-Disposition"
]
```

**影響程度:** ?�� 低�?不影?�當?��??��?但�??�於?��??��?�?

---

## ?�� ?�置?��?建議

### ?�薦??CORS ?�置

```json
[
  {
    "AllowedOrigins": [
      "https://your-frontend-domain.example.com",
      "https://your-api-domain.example.com",
      "https://mcis-ey7.pages.dev",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Type",
      "Last-Modified",
      "Cache-Control"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

### 主�??�進�?

1. **AllowedHeaders: `["*"]`**
   - ???��??�用，避?�遺�?
   - ??簡�??�置
   - ??符�? CORS ?�佳實�?

2. **AllowedMethods: `["GET", "HEAD"]`**
   - ?��? 移除 `PUT`, `DELETE` （QR Code 下�??��?�?GET�?
   - ???��?安全??
   - ??符�??�小�??��???

3. **移除不�?要�? Origins**
   - ?��? ?�慮移除 `https://your-storage-domain.example.com`（這是 R2 ?�身?��??��?不�?要�?

---

## ?�� ?��?麼�??�測試失?��?

?��??��?，可?��??��?�?

### 1. **DNS/CDN ?�播延遲** ?��?
```
?�置?��??��?�?

2025-12-31 11:50 AM - ?�戶?�置 CORS
      ??(1-5 ?��? DNS ?�播)
2025-12-31 11:52 AM - E2E 測試?��? (??失�? - ?�置尚未?��?)
      ??(繼�??�播)
2025-12-31 12:00 PM - ?�置完全?��?
      ??
2025-12-31 12:09 PM - ?��?測試 (???��?)
```

**�??:** CORS ?�置?�要�??�傳?�到 Cloudflare ?�全??CDN 節�?

---

### 2. **?�覽?�緩�?* ?��

?�覽?�可?�緩存�?之�?失�???CORS ?��?�?

```
第�?次�?�?(??CORS) ???�覽?�緩存「失?��?
?�置 CORS
第�?次�?�?(??CORS) ???�覽?�使?�緩存「失?�」�?
```

**�?��?��?:** 清除?�覽?�緩存�?使用?��?模�?

---

### 3. **CORS Preflight 快�?** ??

CORS preflight 結�??�被?�覽?�快?��?

```json
"MaxAgeSeconds": 3600  // 快�? 1 小�?
```

如�??��?置�?已�??�送�? preflight，瀏覽?��?使用?��?（失?��?）�??��?

---

## ??建議?�修復步�?

### Step 1: ?��? CORS ?�置（可?��?

??Cloudflare Dashboard ?�新 CORS ?�置�?

```json
{
  "AllowedHeaders": ["*"],  // ???�為?�用字符
  "AllowedMethods": ["GET", "HEAD"]  // ???��??��?要�??��?
}
```

### Step 2: 清除?�覽?�緩�?

**Chrome/Edge:**
```
1. ??Ctrl+Shift+Delete
2. ?��??��??��??��?
3. ?�選?�快?��??��??��?案�?
4. 點�??��??��??��?
```

**?�使?�無?�模�?**
```
Ctrl+Shift+N
```

### Step 3: ?�新測試

1. ?��?: http://localhost:3000/team
2. 點�??��??��??��?詳�?
3. 點�??��?�?QR Code??
4. ???�該?��?下�?�?

---

## ?�� 驗�??�令

你可以自己執行這�??�令來�?證�?

```bash
# Test 1: 檢查 CORS GET
curl -I -H "Origin: http://localhost:3000" \
  https://your-storage-domain.example.com/qr-codes/team-14-1767146927377.svg

# ?��??�到:
# Access-Control-Allow-Origin: http://localhost:3000 ??

# Test 2: 檢查 CORS OPTIONS
curl -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -I https://your-storage-domain.example.com/qr-codes/team-14-1767146927377.svg

# ?��??�到:
# HTTP/1.1 204 No Content ??
# Access-Control-Allow-Origin: http://localhost:3000 ??
```

---

## ?? ?�終�???

| ?�置?�目 | 評�? | 說�? |
|---------|------|------|
| Custom Domain | �?�?�?| 完�??�置 |
| CORS Origins | �?�?�?| ?�含?�?��?要�??��? |
| CORS Methods | �?�? | ?�以簡�?（移??PUT/DELETE�?|
| CORS Headers | �?�?| 建議?�為 `*` |
| ?��?安全??| �?�? | ?�好 |

**總�?:** **�?�? (8/10)**

---

## ?? 結�?

**你�??�置已�??�本完�?且正常�?作�?**

- ??Custom Domain �?��綁�?
- ??CORS ?�置已�???
- ???�件?�以�?��訪�?
- ??CORS headers �?��返�?

**建議:**
1. 清除?�覽?�緩存�??�新測試
2. （可?��??��? AllowedHeaders ??`*`
3. （可?��?簡�? AllowedMethods ?��???GET/HEAD

**?��?結�?:** QR Code 下�??�能?�該已�??�以�?��使用！�??

---

**下�?�?** ?�新?��? E2E 測試，�?證�??�是?��??�正常�?
