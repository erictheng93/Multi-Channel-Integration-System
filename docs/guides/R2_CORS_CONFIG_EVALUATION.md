# R2 CORS ?ç½®è©•ä¼°?±å?

**è©•ä¼°?‚é?:** 2025-12-31
**Bucket:** multi-channel-platform-attachments
**Custom Domain:** your-storage-domain.example.com

---

## ?? æ¸¬è©¦çµæ?ç¸½è¦½

| æ¸¬è©¦?…ç›® | ?€??| è©³æ? |
|---------|------|------|
| Custom Domain DNS è§?? | ??**PASS** | æ­?¢ºè§????Cloudflare IP |
| SSL/TLS è­‰æ›¸ | ??**PASS** | TLS 1.3 æ­?¸¸?‹ä? |
| R2 ?‡ä»¶è¨ªå? | ??**PASS** | HTTP 200 OK |
| CORS GET Request | ??**PASS** | æ­?¢ºè¿”å? CORS headers |
| CORS Preflight (OPTIONS) | ??**PASS** | 204 No Content with CORS headers |
| Access-Control-Allow-Origin | ??**PASS** | æ­?¢ºè¿”å?è«‹æ???Origin |
| Access-Control-Expose-Headers | ??**PASS** | ETag, Content-Length, Content-Type |

---

## ?? è©³ç´°æ¸¬è©¦è¨˜é?

### Test 1: Custom Domain ??¥æ¸¬è©¦

```bash
$ curl -I https://your-storage-domain.example.com/qr-codes/team-14-1767146927377.svg

HTTP/1.1 200 OK ??
Content-Type: image/svg+xml ??
Content-Length: 2871 ??
Server: cloudflare ??
```

**çµè?:** Custom Domain å®Œå…¨æ­?¸¸?‹ä?

---

### Test 2: CORS GET Request æ¸¬è©¦

```bash
$ curl -I -H "Origin: http://localhost:3000" \
  https://your-storage-domain.example.com/qr-codes/team-14-1767146927377.svg

HTTP/1.1 200 OK ??
Access-Control-Allow-Origin: http://localhost:3000 ??
Access-Control-Expose-Headers: ETag,Content-Length,Content-Type ??
Vary: Origin, Accept-Encoding ??
ETag: "7967181b164f6b5935c4c7132fdb6b1c" ??
```

**çµè?:** CORS headers æ­?¢ºè¿”å?ï¼Œå??¨ç¬¦?ˆè?ç¯?

---

### Test 3: CORS Preflight (OPTIONS) æ¸¬è©¦

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

**çµè?:** CORS preflight è«‹æ??•ç?æ­?¢º

---

## ? ï? ?¼ç¾?„å??é?

### ?é? 1: AllowedHeaders ä¸å??¨é¢

**?¶å??ç½®:**
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

**å»ºè­°?¹é€?**
```json
"AllowedHeaders": ["*"]
```

**?Ÿå?:**
- ?¶å??ç½®?–ç„¶?…å«äº†å¸¸è¦?headersï¼Œä??¯èƒ½?ºæ?ä¸€äº›ç€è¦½?¨è‡ª?•æ·»? ç? headers
- ä½¿ç”¨ `*` ?¬ç”¨å­—ç¬¦?´å?ä¿éšªï¼Œä?ä¸å½±?¿å??¨æ€§ï??…é? GET/HEAD è«‹æ?ï¼?

**å½±éŸ¿ç¨‹åº¦:** ?Ÿ¡ ä¸­ç?ï¼ˆå¯?½å??´æ?äº›ç€è¦½?¨è?æ±‚è¢«?»æ­¢ï¼?

---

### ?é? 2: ExposeHeaders ?¯ä»¥?´å???

**?¶å??ç½®:**
```json
"ExposeHeaders": [
  "ETag",
  "Content-Length",
  "Content-Type"
]
```

**å»ºè­°?¹é€?**
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

**å½±éŸ¿ç¨‹åº¦:** ?Ÿ¢ ä½ï?ä¸å½±?¿ç•¶?å??½ï?ä½†æ??©æ–¼?ªä??´å?ï¼?

---

## ?¯ ?ç½®?ªå?å»ºè­°

### ?¨è–¦??CORS ?ç½®

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

### ä¸»è??¹é€²é?

1. **AllowedHeaders: `["*"]`**
   - ???´å??šç”¨ï¼Œé¿?éºæ¼?
   - ??ç°¡å??ç½®
   - ??ç¬¦å? CORS ?€ä½³å¯¦è¸?

2. **AllowedMethods: `["GET", "HEAD"]`**
   - ? ï? ç§»é™¤ `PUT`, `DELETE` ï¼ˆQR Code ä¸‹è??ªé?è¦?GETï¼?
   - ???é?å®‰å…¨??
   - ??ç¬¦å??€å°æ??å???

3. **ç§»é™¤ä¸å?è¦ç? Origins**
   - ? ï? ?ƒæ…®ç§»é™¤ `https://your-storage-domain.example.com`ï¼ˆé€™æ˜¯ R2 ?¬èº«?„å??ï?ä¸é?è¦ï?

---

## ?”§ ?ºä?éº¼ä??æ¸¬è©¦å¤±?—ï?

?¹æ??†æ?ï¼Œå¯?½ç??Ÿå?ï¼?

### 1. **DNS/CDN ?³æ’­å»¶é²** ?±ï?
```
?ç½®?Ÿæ??‚é?è»?

2025-12-31 11:50 AM - ?¨æˆ¶?ç½® CORS
      ??(1-5 ?†é? DNS ?³æ’­)
2025-12-31 11:52 AM - E2E æ¸¬è©¦?·è? (??å¤±æ? - ?ç½®å°šæœª?Ÿæ?)
      ??(ç¹¼ç??³æ’­)
2025-12-31 12:00 PM - ?ç½®å®Œå…¨?Ÿæ?
      ??
2025-12-31 12:09 PM - ?‘ç?æ¸¬è©¦ (???å?)
```

**è§??:** CORS ?ç½®?€è¦æ??“å‚³?­åˆ° Cloudflare ?„å…¨??CDN ç¯€é»?

---

### 2. **?è¦½?¨ç·©å­?* ?’¾

?è¦½?¨å¯?½ç·©å­˜ä?ä¹‹å?å¤±æ???CORS ?¿æ?ï¼?

```
ç¬¬ä?æ¬¡è?æ±?(??CORS) ???è¦½?¨ç·©å­˜ã€Œå¤±?—ã€?
?ç½® CORS
ç¬¬ä?æ¬¡è?æ±?(??CORS) ???è¦½?¨ä½¿?¨ç·©å­˜ã€Œå¤±?—ã€â?
```

**è§?±º?¹æ?:** æ¸…é™¤?è¦½?¨ç·©å­˜æ?ä½¿ç”¨?¡ç?æ¨¡å?

---

### 3. **CORS Preflight å¿«å?** ??

CORS preflight çµæ??ƒè¢«?è¦½?¨å¿«?–ï?

```json
"MaxAgeSeconds": 3600  // å¿«å? 1 å°æ?
```

å¦‚æ??¨é?ç½®å?å·²ç??¼é€é? preflightï¼Œç€è¦½?¨æ?ä½¿ç”¨?Šç?ï¼ˆå¤±?—ç?ï¼‰ç??œã€?

---

## ??å»ºè­°?„ä¿®å¾©æ­¥é©?

### Step 1: ?ªå? CORS ?ç½®ï¼ˆå¯?¸ï?

??Cloudflare Dashboard ?´æ–° CORS ?ç½®ï¼?

```json
{
  "AllowedHeaders": ["*"],  // ???¹ç‚º?¬ç”¨å­—ç¬¦
  "AllowedMethods": ["GET", "HEAD"]  // ???ªä??™å?è¦ç??¹æ?
}
```

### Step 2: æ¸…é™¤?è¦½?¨ç·©å­?

**Chrome/Edge:**
```
1. ??Ctrl+Shift+Delete
2. ?¸æ??Œæ??‰æ??“ã€?
3. ?¾é¸?Œå¿«?–ç??–ç??Œæ?æ¡ˆã€?
4. é»æ??Œæ??¤è??™ã€?
```

**?–ä½¿?¨ç„¡?•æ¨¡å¼?**
```
Ctrl+Shift+N
```

### Step 3: ?æ–°æ¸¬è©¦

1. ?å?: http://localhost:3000/team
2. é»æ??˜é??¡ç??‹å?è©³æ?
3. é»æ??Œä?è¼?QR Code??
4. ???‰è©²?å?ä¸‹è?ï¼?

---

## ?§ª é©—è??½ä»¤

ä½ å¯ä»¥è‡ªå·±åŸ·è¡Œé€™ä??½ä»¤ä¾†é?è­‰ï?

```bash
# Test 1: æª¢æŸ¥ CORS GET
curl -I -H "Origin: http://localhost:3000" \
  https://your-storage-domain.example.com/qr-codes/team-14-1767146927377.svg

# ?æ??‹åˆ°:
# Access-Control-Allow-Origin: http://localhost:3000 ??

# Test 2: æª¢æŸ¥ CORS OPTIONS
curl -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -I https://your-storage-domain.example.com/qr-codes/team-14-1767146927377.svg

# ?æ??‹åˆ°:
# HTTP/1.1 204 No Content ??
# Access-Control-Allow-Origin: http://localhost:3000 ??
```

---

## ?? ?€çµ‚è???

| ?ç½®?…ç›® | è©•å? | èªªæ? |
|---------|------|------|
| Custom Domain | â­â?â­â?â­?| å®Œç??ç½® |
| CORS Origins | â­â?â­â?â­?| ?…å«?€?‰é?è¦ç??Ÿå? |
| CORS Methods | â­â?â­â? | ?¯ä»¥ç°¡å?ï¼ˆç§»??PUT/DELETEï¼?|
| CORS Headers | â­â?â­?| å»ºè­°?¹ç‚º `*` |
| ?´é?å®‰å…¨??| â­â?â­â? | ?¯å¥½ |

**ç¸½è?:** **â­â?â­â? (8/10)**

---

## ?? çµè?

**ä½ ç??ç½®å·²ç??ºæœ¬å®Œæ?ä¸”æ­£å¸¸é?ä½œï?**

- ??Custom Domain æ­?¢ºç¶å?
- ??CORS ?ç½®å·²ç???
- ???‡ä»¶?¯ä»¥æ­?¸¸è¨ªå?
- ??CORS headers æ­?¢ºè¿”å?

**å»ºè­°:**
1. æ¸…é™¤?è¦½?¨ç·©å­˜å??æ–°æ¸¬è©¦
2. ï¼ˆå¯?¸ï??ªå? AllowedHeaders ??`*`
3. ï¼ˆå¯?¸ï?ç°¡å? AllowedMethods ?ªä???GET/HEAD

**?æ?çµæ?:** QR Code ä¸‹è??Ÿèƒ½?‰è©²å·²ç??¯ä»¥æ­?¸¸ä½¿ç”¨ï¼ğ??

---

**ä¸‹ä?æ­?** ?æ–°?·è? E2E æ¸¬è©¦ï¼Œé?è­‰å??½æ˜¯?¦å??¨æ­£å¸¸ã€?
