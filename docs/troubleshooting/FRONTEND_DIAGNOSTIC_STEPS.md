# 前端貼圖診斷步驟

## 步驟 1: 開啟對話頁面

打開瀏覽器,訪問:
```
http://localhost:3000/conversations/39754c72-ba50-4a35-ba86-56feb46bd710
```

## 步驟 2: 打開開發者工具

按 `F12` 或右鍵點擊頁面 → 選擇 "檢查" (Inspect)

## 步驟 3: 查看 Console 標籤

在開發者工具中,切換到 "Console" 標籤

## 步驟 4: 搜尋關鍵日誌

在 Console 的搜尋框中,依序搜尋以下關鍵字:

### 4.1 搜尋 "StickerRenderer"
```
[StickerRenderer]
```

**預期看到的日誌:**
- `🔍 [StickerRenderer] processStickerMetadata called`
- `🔍 [StickerRenderer] Parsed metadata: {packageId, stickerId}`
- `⚠️ [StickerRenderer] Empty or missing sticker file at ...`

### 4.2 搜尋 "MessageBubble"
```
[MessageBubble]
```

**預期看到的日誌:**
- `🔍 [MessageBubble] Processing message: ...`
- `🔍 [MessageBubble] Content processed successfully`

### 4.3 搜尋 "Sticker Debug"
```
[Sticker Debug]
```

**預期看到的日誌:**
- `🔍 [Sticker Debug] Message type: sticker`
- `🔍 [Sticker Debug] Parsed metadata: ...`
- `❌ [Sticker Debug] Sticker failed to load: ...`

## 步驟 5: 執行診斷腳本

1. 打開檔案 `frontend-sticker-test.js`
2. 複製**全部內容**
3. 貼上到 Console 標籤
4. 按 `Enter` 執行

**腳本會自動測試:**
- ✅ Metadata 解析
- ✅ LINE CDN URL 生成
- ✅ HEAD 請求檢查文件大小

## 步驟 6: 檢查頁面顯示

在對話列表中,找到 Claire 發送的貼圖訊息

**應該看到以下其中一種:**

### 情況 A: 顯示 Fallback (正確)
```
┌─────────────────────────┐
│         🎭              │
│                         │
│       [貼圖]            │
│  貼圖暫時無法顯示       │
│                         │
│  📦 35618 · 🏷️ 785142188│
└─────────────────────────┘
```

### 情況 B: 什麼都沒顯示 (需要修復)
```
Claire: [貼圖]
(沒有任何貼圖或 Fallback 圖示)
```

### 情況 C: 顯示載入中 (卡住)
```
┌─────────────────────────┐
│     [Loading...]        │
│   載入貼圖中...         │
└─────────────────────────┘
```

## 步驟 7: 檢查 Network 請求

1. 切換到 "Network" 標籤
2. 在 Filter 中輸入: `sticker.png`
3. 重新整理頁面 (F5)

**查看請求結果:**
- 如果看到請求 → 點擊查看 Response Headers
- 檢查 `Content-Length` 是否為 0
- 檢查 HTTP Status Code

## 診斷結果判斷

| 觀察到的現象 | 原因 | 解決方案 |
|-------------|------|---------|
| 顯示 🎭 Fallback | ✅ 系統正常工作 | LINE 貼圖包已下架,這是預期行為 |
| 什麼都沒顯示 | ❌ 渲染邏輯問題 | 檢查 Console 錯誤,可能需要修復前端代碼 |
| 一直載入中 | ❌ 請求卡住 | 檢查 Network 標籤,可能是 CORS 或網路問題 |
| 顯示破圖圖示 | ⚠️ IMG 標籤載入失敗 | 正常,但應該顯示 Fallback |

## 下一步行動

### 如果顯示 Fallback (情況 A)
✅ **系統正常!** LINE 貼圖包 35618 已下架,前端正確顯示替代內容

**建議:**
- 告知客戶這是 LINE 平台問題,不是系統問題
- 未來新的貼圖應該可以正常顯示

### 如果什麼都沒顯示 (情況 B)
❌ **需要修復前端渲染邏輯**

**請提供以下資訊:**
1. Console 中的完整錯誤訊息
2. "StickerRenderer" 相關日誌的完整內容
3. "MessageBubble" 相關日誌的完整內容
4. 診斷腳本的執行結果

### 如果一直載入中 (情況 C)
⚠️ **請求處理問題**

**請提供以下資訊:**
1. Network 標籤中 sticker.png 的請求狀態
2. Response Headers 的完整內容
3. Console 中是否有 CORS 錯誤

---

## 快速測試命令

如果您想要測試一個**有效的**貼圖,可以嘗試讓 Claire 發送一個新的貼圖到對話中:

1. 在 LINE 中找到 Claire 的對話
2. 發送一個新的貼圖 (選擇任意貼圖)
3. 回到瀏覽器重新整理頁面
4. 查看新貼圖是否正常顯示

**如果新貼圖可以顯示:**
✅ 系統正常,只是舊貼圖包已下架

**如果新貼圖也無法顯示:**
❌ 系統渲染邏輯有問題,需要修復
