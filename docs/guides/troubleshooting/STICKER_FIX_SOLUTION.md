# LINE 貼圖顯示問題修復方案

## 問題根因

**SafeHtmlRenderer 過濾了 `onload` 和 `onerror` 屬性**

```typescript
// frontend/src/components/ui/SafeHtmlRenderer.vue:19-24
allowedAttributes: () => ({
  img: ['src', 'alt', 'title', 'class', 'style', 'width', 'height'],
  // 缺少 'onload' 和 'onerror'
})
```

**結果：**
- 貼圖 HTML 生成正確
- 但 `onload`/`onerror` 被過濾掉
- 圖片加載失敗時不會顯示 Fallback
- 頁面顯示空白（120px x 120px 透明區域）

---

## 方案 A: 允許內聯事件（快速修復）

### 檔案：`frontend/src/components/ui/SafeHtmlRenderer.vue`

**修改第 19-24 行：**

```typescript
// 修改前：
allowedAttributes: () => ({
  span: ['class', 'title', 'style'],
  img: ['src', 'alt', 'title', 'class', 'style', 'width', 'height'],
  div: ['class', 'style']
})

// 修改後：
allowedAttributes: () => ({
  span: ['class', 'title', 'style'],
  img: [
    'src', 'alt', 'title', 'class', 'style',
    'width', 'height',
    'onload', 'onerror',  // ← 添加這兩個屬性
    'data-sticker-package', 'data-sticker-id', 'data-sticker-type'  // ← 貼圖元數據
  ],
  div: ['class', 'style']
})
```

### 優點
-  快速修復（1 分鐘）
-  無需改動其他代碼
-  貼圖立即可以正常顯示

### 缺點
-  安全風險（內聯事件可能被注入惡意代碼）
-  違反 CSP (Content Security Policy) 最佳實踐

### 測試步驟
1. 修改 `SafeHtmlRenderer.vue`
2. 重啟前端開發伺服器 (`npm run dev`)
3. 刷新瀏覽器
4. 查看貼圖是否顯示 Fallback:  [貼圖] 貼圖暫時無法顯示

---

## 方案 B: 使用 Vue 事件監聽器（推薦）

### 檔案修改清單

#### 1. `frontend/src/components/ui/SafeHtmlRenderer.vue`

**添加圖片加載失敗處理邏輯：**

```vue
<template>
  <div
    ref="containerRef"
    class="safe-html-container"
  />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'

// ... 原有的 Props 定義 ...

const containerRef = ref<HTMLElement>()

// ... 原有的 sanitizeHtml, isValidImageSrc, isValidStyle 函數 ...

/**
 * 為圖片添加加載失敗處理
 */
const setupImageErrorHandlers = () => {
  if (!containerRef.value) return

  // 找到所有圖片元素
  const images = containerRef.value.querySelectorAll('img.sticker-image')

  images.forEach((img) => {
    const imgElement = img as HTMLImageElement

    // 添加 load 事件處理
    imgElement.addEventListener('load', () => {
      // 圖片加載成功，設置透明度
      imgElement.style.opacity = '1'
      console.log(' Sticker loaded:', imgElement.src)
    })

    // 添加 error 事件處理
    imgElement.addEventListener('error', () => {
      console.log(' Sticker failed to load:', imgElement.src)

      // 隱藏圖片
      imgElement.style.display = 'none'

      // 顯示 Fallback
      const fallback = imgElement.nextElementSibling as HTMLElement
      if (fallback && fallback.classList.contains('sticker-fallback')) {
        fallback.style.display = 'block'
      }
    })

    // 如果圖片已經加載完成（從緩存），立即觸發 load 事件
    if (imgElement.complete) {
      if (imgElement.naturalWidth === 0) {
        // 圖片加載失敗
        imgElement.dispatchEvent(new Event('error'))
      } else {
        // 圖片加載成功
        imgElement.dispatchEvent(new Event('load'))
      }
    }
  })
}

/**
 * 渲染安全的HTML內容
 */
const renderSafeHtml = async () => {
  if (containerRef.value && props.html) {
    const safeHtml = sanitizeHtml(props.html)
    containerRef.value.innerHTML = safeHtml

    // 等待 DOM 更新後設置事件處理器
    await nextTick()
    setupImageErrorHandlers()
  } else if (containerRef.value) {
    containerRef.value.innerHTML = ''
  }
}

// 監聽HTML變化
watch(() => props.html, renderSafeHtml)

// 組件掛載後初始渲染
onMounted(renderSafeHtml)
</script>

<!-- ... 原有的 CSS ... -->
```

#### 2. `frontend/src/utils/sticker-renderer.ts`

**移除 HTML 中的內聯事件（第 311-320 行）：**

```typescript
// 修改前：
const content = `
  <img src="${url}" alt="${alt}" class="sticker-image" ${dataAttrs}
       style="object-fit: contain; border-radius: 8px; opacity: 0; transition: opacity 0.3s ease;"
       onload="this.style.opacity=1; console.log(' Sticker loaded:', '${url}')"
       onerror="console.log(' Sticker failed to load:', '${url}'); this.style.display='none'; this.nextElementSibling.style.display='block';" />
  <div class="sticker-fallback" style="display: none; ...">
    ...
  </div>
`.trim();

// 修改後：
const content = `
  <img src="${url}" alt="${alt}" class="sticker-image" ${dataAttrs}
       style="object-fit: contain; border-radius: 8px; opacity: 0; transition: opacity 0.3s ease;" />
  <div class="sticker-fallback" style="display: none; text-align: center; padding: 12px 16px; background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%); border: 2px solid #d4dbe3; border-radius: 12px; font-size: 13px; color: #5a6c7d; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
    <span style="font-size: 32px; margin-bottom: 8px; opacity: 0.7;"></span><br>
    <span style="font-weight: 500;">[${alt}]</span><br>
    <span style="font-size: 11px; color: #8b96a3; margin-top: 4px;">貼圖暫時無法顯示</span>
  </div>
`.trim();
```

### 優點
-  安全（符合 CSP 最佳實踐）
-  優雅（事件處理在 Vue 組件中）
-  可維護（邏輯清晰分離）
-  可擴展（未來可以添加更多處理邏輯）

### 缺點
-  需要修改 2 個檔案
-  稍微複雜一點

### 測試步驟
1. 修改 `SafeHtmlRenderer.vue`（添加事件處理邏輯）
2. 修改 `sticker-renderer.ts`（移除內聯事件）
3. 重啟前端開發伺服器
4. 刷新瀏覽器
5. 查看貼圖是否顯示 Fallback

---

## 方案 C: 完全移除空文件檢測（不推薦）

### 檔案：`frontend/src/utils/sticker-renderer.ts`

**修改第 293-304 行（移除 HEAD 請求檢測）：**

```typescript
// 修改前：
private async createImageResult(...) {
  // 检测空文件：发送 HEAD 请求检查 Content-Length
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentLength = response.headers.get('content-length');

    if (contentLength === '0' || contentLength === null) {
      return this.createFallbackResult(alt, size);
    }
  } catch (error) {
    return this.createFallbackResult(alt, size);
  }

  // ... 生成 HTML ...
}

// 修改後：
private async createImageResult(...) {
  // 直接生成 HTML，不檢測空文件
  // 讓瀏覽器自然加載圖片，依賴 onerror 事件

  // ... 生成 HTML ...
}
```

### 優點
-  減少 HEAD 請求（節省網路流量）
-  更快的渲染速度

### 缺點
-  如果方案 A 或 B 沒實施，Fallback 依然無法顯示
-  空文件的圖片會先嘗試加載（浪費資源）

---

## 推薦實施順序

### 階段 1: 快速修復（方案 A）

**立即執行，5 分鐘內修復：**

1. 修改 `SafeHtmlRenderer.vue`
2. 添加 `onload`, `onerror` 到白名單
3. 重啟前端服務
4. 測試驗證

**這可以立即讓貼圖 Fallback 正常顯示**

### 階段 2: 安全優化（方案 B）

**未來優化，30 分鐘：**

1. 實施方案 B 的 Vue 事件監聽器
2. 移除內聯事件處理器
3. 全面測試
4. 部署到生產環境

---

## 測試驗證

### 測試用例 1: 已下架的貼圖

**步驟：**
1. 打開對話：`http://localhost:3000/conversations/39754c72-ba50-4a35-ba86-56feb46bd710`
2. 找到 Claire 發送的貼圖

**預期結果：**
```

[貼圖]
貼圖暫時無法顯示
```

### 測試用例 2: 新的有效貼圖

**步驟：**
1. 在 LINE 中讓 Claire 發送一個新的熱門貼圖
2. 刷新瀏覽器

**預期結果：**
- 顯示貼圖圖片
- Console 顯示: ` Sticker loaded: https://...`

### 測試用例 3: 網路錯誤

**步驟：**
1. 在開發者工具 Network 標籤中
2. 將網路速度設為 "Offline"
3. 刷新頁面

**預期結果：**
- 所有貼圖顯示 Fallback
- Console 顯示: ` Sticker failed to load: ...`

---

## 完成檢查清單

- [ ] 選擇並實施方案（A 或 B）
- [ ] 修改對應的檔案
- [ ] 重啟前端開發伺服器
- [ ] 刷新瀏覽器
- [ ] 執行測試用例 1（已下架貼圖）
- [ ] 執行測試用例 2（新貼圖）
- [ ] 檢查 Console 日誌
- [ ] 確認頁面顯示正確
- [ ] 提交代碼變更
- [ ] 部署到生產環境

---

## 需要協助？

如果在實施過程中遇到問題，請提供：
1. 選擇的方案（A 或 B）
2. 修改後的代碼
3. Console 錯誤訊息
4. 頁面顯示結果
