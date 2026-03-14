# LINE 貼圖修復測試指南

## 修改內容總結

 **已完成修改：**
1. **SafeHtmlRenderer.vue** - 添加 Vue 事件監聽器處理圖片加載失敗
2. **sticker-renderer.ts** - 移除不安全的內聯事件處理器

---

## 測試步驟

### Step 1: 重啟前端開發服務器

```bash
# 在 frontend/ 目錄下
cd frontend

# 停止當前的開發服務器 (Ctrl+C)
# 然後重新啟動
npm run dev
```

**等待輸出：**
```
VITE v5.x.x  ready in xxx ms

  Local: http://localhost:3000/
  Network: use --host to expose
  press h + enter to show help
```

### Step 2: 清除瀏覽器緩存

1. 按 `F12` 打開開發者工具
2. 右鍵點擊瀏覽器刷新按鈕
3. 選擇 **"清除緩存並硬性重新整理"** (Clear cache and hard reload)

或者：

1. 開發者工具 → Network 標籤
2. 勾選 **"Disable cache"**
3. 刷新頁面 (F5)

### Step 3: 打開對話頁面

訪問包含貼圖的對話：
```
http://localhost:3000/conversations/39754c72-ba50-4a35-ba86-56feb46bd710
```

### Step 4: 檢查 Console 輸出

在開發者工具 Console 中，應該看到：

#### 4.1 渲染日誌
```
 [StickerRenderer] processStickerMetadata called
 [StickerRenderer] Parsed metadata: {packageId: "...", stickerId: "..."}
 [EnhancedMessageRenderer] Final HTML: <div class="sticker-container"...
```

#### 4.2 圖片加載日誌

**如果貼圖成功加載（有效的貼圖包）：**
```
 Sticker loaded: https://stickershop.line-scdn.net/...
```

**如果貼圖加載失敗（已下架的貼圖包）：**
```
 Sticker failed to load: https://stickershop.line-scdn.net/...
```

### Step 5: 檢查頁面顯示

#### 預期結果 A: 已下架的貼圖（如貼圖包 35618, 30630475）

**應該看到 Fallback 顯示：**

```
┌─────────────────────────┐
│ │
│ │
│ [LINE 貼圖] │
│  貼圖暫時無法顯示 │
└─────────────────────────┘
```

#### 預期結果 B: 有效的貼圖（新發送的貼圖）

**應該看到貼圖圖片：**
- 圖片正常顯示
- 有淡入動畫效果（opacity 從 0 → 1）

### Step 6: 檢查 DOM 元素

在開發者工具中：

1. 右鍵點擊貼圖區域 → **檢查** (Inspect)
2. 查看 HTML 結構

**應該看到（成功載入）：**
```html
<div class="sticker-container" style="...">
  <img src="https://..."
       class="sticker-image"
       style="opacity: 1; ..."
       data-sticker-package="..."
       data-sticker-id="...">
  <div class="sticker-fallback" style="display: none;">
    ...
  </div>
</div>
```

**應該看到（載入失敗）：**
```html
<div class="sticker-container" style="...">
  <img src="https://..."
       class="sticker-image"
       style="opacity: 0; display: none;">
  <div class="sticker-fallback" style="display: block;">
     [貼圖] 貼圖暫時無法顯示
  </div>
</div>
```

**重要檢查點：**
-  `<img>` 標籤**不應該**有 `onload` 屬性
-  `<img>` 標籤**不應該**有 `onerror` 屬性
-  `<img>` 標籤**應該**有 `data-sticker-*` 屬性

---

## 測試用例

### 測試用例 1: 已下架的貼圖（貼圖包 35618）

**步驟：**
1. 在對話中找到之前 Claire 發送的舊貼圖
2. 查看顯示結果

**預期結果：**
-  顯示 Fallback:  [貼圖] 貼圖暫時無法顯示
-  Console 顯示: ` Sticker failed to load: ...`

### 測試用例 2: 發送新貼圖

**步驟：**
1. 在 LINE 中讓 Claire 發送一個**最新的熱門貼圖**
2. 刷新瀏覽器頁面
3. 查看新貼圖的顯示

**預期結果：**
-  顯示貼圖圖片
-  Console 顯示: ` Sticker loaded: ...`
-  圖片有淡入動畫

### 測試用例 3: 網路錯誤模擬

**步驟：**
1. 開發者工具 → Network 標籤
2. 將網路速度設為 **"Offline"**
3. 刷新頁面

**預期結果：**
-  所有貼圖顯示 Fallback
-  Console 顯示多個: ` Sticker failed to load: ...`

### 測試用例 4: 緩存測試

**步驟：**
1. 載入包含貼圖的對話
2. 刷新頁面（圖片應該從緩存載入）
3. 查看是否正常顯示

**預期結果：**
-  有效貼圖立即顯示（從緩存）
-  失敗貼圖立即顯示 Fallback
-  Console 日誌正常

---

## 驗證檢查清單

測試完成後，請確認以下項目：

- [ ] 前端開發服務器已重啟
- [ ] 瀏覽器緩存已清除
- [ ] 打開對話頁面無錯誤
- [ ] Console 中看到 ` Sticker loaded` 或 ` Sticker failed to load`
- [ ] 已下架的貼圖顯示 Fallback 
- [ ] DOM 中 `<img>` 標籤沒有 `onload`/`onerror` 屬性
- [ ] 新發送的貼圖可以正常顯示
- [ ] 網路離線時所有貼圖顯示 Fallback

---

## 常見問題排查

### Q1: Console 中沒有看到 ` Sticker loaded` 或 ` Sticker failed to load`

**可能原因：**
- SafeHtmlRenderer.vue 的修改沒有生效
- 前端服務器沒有重啟
- 瀏覽器緩存沒有清除

**解決方法：**
1. 停止前端服務器 (Ctrl+C)
2. 重新啟動 `npm run dev`
3. 清除瀏覽器緩存
4. 刷新頁面

### Q2: 頁面仍然顯示空白

**可能原因：**
- 修改的代碼有語法錯誤
- DOM 結構沒有正確生成

**解決方法：**
1. 檢查 Console 是否有 JavaScript 錯誤
2. 檢查 `SafeHtmlRenderer.vue` 的修改是否正確
3. 檢查 `sticker-renderer.ts` 的修改是否正確

### Q3: Fallback 沒有顯示

**可能原因：**
- `setupImageErrorHandlers()` 沒有正確執行
- DOM 選擇器沒有找到元素

**解決方法：**

在 Console 中執行：
```javascript
// 檢查是否找到貼圖圖片
const images = document.querySelectorAll('img.sticker-image');
console.log('Found sticker images:', images.length);

// 檢查是否找到 Fallback
const fallbacks = document.querySelectorAll('.sticker-fallback');
console.log('Found fallbacks:', fallbacks.length);

// 手動觸發錯誤事件
images.forEach(img => {
  img.dispatchEvent(new Event('error'));
});
```

### Q4: 圖片顯示但沒有淡入動畫

**可能原因：**
- `opacity` 樣式沒有正確設置
- CSS transition 不起作用

**解決方法：**
- 檢查 `<img>` 的 `style` 屬性中是否有 `opacity: 0`
- 確認 `load` 事件處理器中設置了 `opacity: 1`

---

## 成功標準

修復被認為成功，當：

1.  **已下架的貼圖顯示 Fallback**
   - 看到  圖示
   - 看到 "[貼圖]" 文字
   - 看到 "貼圖暫時無法顯示" 提示

2.  **新貼圖正常顯示**
   - 看到貼圖圖片
   - 有淡入動畫效果

3.  **Console 日誌正確**
   - 成功: ` Sticker loaded: ...`
   - 失敗: ` Sticker failed to load: ...`

4.  **安全性提升**
   - DOM 中沒有 `onload`/`onerror` 內聯事件
   - 符合 CSP 最佳實踐

---

## 下一步

測試成功後：

1. **提交代碼變更**
   ```bash
   git add frontend/src/components/ui/SafeHtmlRenderer.vue
   git add frontend/src/utils/sticker-renderer.ts
   git commit -m "fix: implement secure Vue event listeners for sticker fallback display

   - Add setupImageErrorHandlers() in SafeHtmlRenderer.vue
   - Remove unsafe inline onload/onerror event handlers
   - Add data-sticker-* attributes to img whitelist
   - Improve security by following CSP best practices

   Fixes issue where LINE stickers with expired/removed packages
   were showing blank space instead of fallback UI."
   ```

2. **部署到生產環境**
   ```bash
   cd frontend
   npm run build
   npm run deploy:pages
   ```

3. **監控生產環境**
   - 檢查生產環境的 Console 日誌
   - 確認貼圖 Fallback 正常顯示

---

## 需要協助？

如果測試過程中遇到問題，請提供：

1. **Console 的完整輸出** (包括錯誤訊息)
2. **頁面顯示的截圖**
3. **DOM 元素的 HTML** (右鍵檢查元素)
4. **Network 標籤的請求狀態**

這樣我可以更準確地協助您診斷問題！
