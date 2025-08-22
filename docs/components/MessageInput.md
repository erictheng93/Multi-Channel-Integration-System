# MessageInput 訊息輸入組件文檔

## 概述

`MessageInput` 組件為多通道支援 MVP 系統提供完整的訊息輸入介面。它支援文字輸入、檔案附件，並與對話系統無縫整合。

## 功能特色

- ✅ 自動調整大小的文字區域，支援鍵盤快捷鍵
- ✅ 檔案附件支援，帶有驗證功能
- ✅ 即時輸入驗證和回饋
- ✅ 載入狀態和錯誤處理
- ✅ 行動裝置和桌面的響應式設計
- ✅ 無障礙設計合規
- ⏳ 表情符號選擇器（佔位符實作）

## 使用方法

### 基本用法

```vue
<template>
  <MessageInput
    :conversation-id="conversationId"
    @message-sent="handleMessageSent"
    @attachment-upload="handleAttachmentUpload"
  />
</template>

<script setup>
import MessageInput from '@/components/conversation/MessageInput.vue'

const conversationId = ref('conv-123')

const handleMessageSent = (data) => {
  console.log('訊息已發送:', data.content)
  console.log('附件:', data.attachments)
}

const handleAttachmentUpload = (attachment) => {
  console.log('附件已上傳:', attachment.name)
}
</script>
```

### 停用狀態

```vue
<MessageInput
  :conversation-id="conversationId"
  :disabled="isConversationClosed"
  @message-sent="handleMessageSent"
/>
```

## 屬性 (Props)

| 屬性 | 類型 | 必需 | 預設值 | 說明 |
|------|------|------|--------|------|
| `conversationId` | `string` | ✅ | - | 目前對話的 ID |
| `disabled` | `boolean` | ❌ | `false` | 為 true 時停用輸入 |

## 事件 (Events)

### `message-sent`

訊息成功發送時觸發。

**載荷:**
```typescript
{
  content: string        // 訊息文字內容
  attachments: Attachment[]  // 附件檔案陣列
}
```

**範例:**
```vue
<MessageInput @message-sent="onMessageSent" />

<script setup>
const onMessageSent = ({ content, attachments }) => {
  console.log(`已發送: "${content}"，包含 ${attachments.length} 個附件`)
}
</script>
```

### `attachment-upload`

選擇檔案作為附件時觸發。

**載荷:**
```typescript
{
  name: string    // 檔案名稱
  size: number    // 檔案大小（位元組）
  file: File      // 檔案物件
}
```

**範例:**
```vue
<MessageInput @attachment-upload="onAttachmentUpload" />

<script setup>
const onAttachmentUpload = (attachment) => {
  console.log(`已選擇檔案: ${attachment.name} (${attachment.size} 位元組)`)
}
</script>
```

## 鍵盤快捷鍵

| 按鍵組合 | 動作 |
|----------|------|
| `Enter` | 發送訊息 |
| `Shift + Enter` | 換行 |

## 檔案附件

### 支援的檔案類型

- **圖片**: `image/*` (JPG、PNG、GIF 等)
- **文件**: `application/pdf`、`.doc`、`.docx`

### 檔案大小限制

- **最大大小**: 每個檔案 10MB
- **多檔案**: 支援
- **驗證**: 客戶端驗證，提供使用者回饋

### 檔案大小顯示

檔案大小會自動格式化以提高可讀性：
- `1024 bytes` → `1 KB`
- `1048576 bytes` → `1 MB`
- `1073741824 bytes` → `1 GB`

## 錯誤處理

組件處理各種錯誤情況：

### 網路錯誤
```
網路錯誤，請稍後再試
```

### 檔案大小錯誤
```
檔案 filename.pdf 超過 10MB 限制
```

### API 錯誤
顯示從 API 回傳的錯誤訊息，或通用失敗訊息。

### 錯誤自動清除
- 使用者開始輸入時錯誤會自動清除
- 表情符號選擇器錯誤在 3 秒後清除

## 樣式設定

### CSS 自訂屬性

組件使用設計系統的 CSS 自訂屬性：

```css
/* 間距 */
--space-1, --space-2, --space-3, --space-4, --space-6

/* 顏色 */
--gray-50, --gray-100, --gray-200, --gray-300, --gray-400, --gray-500, --gray-600, --gray-700, --gray-900
--primary-400, --primary-500, --primary-600
--red-50, --red-100, --red-200, --red-600, --red-700

/* 邊框圓角 */
--radius-sm, --radius-md, --radius-lg, --radius-xl, --radius-full

/* 陰影 */
--shadow-sm

/* 過渡效果 */
--transition-fast
```

### 響應式斷點

```css
/* 行動裝置 */
@media (max-width: 768px) {
  /* 較小的按鈕和內邊距 */
}
```

## 無障礙設計

### ARIA 支援
- 適當的按鈕類型和標籤
- 工具提示的標題屬性
- 語義化 HTML 結構

### 鍵盤導航
- 完整的鍵盤支援
- 透過互動元素的 Tab 導航
- Enter/Shift+Enter 快捷鍵

### 螢幕閱讀器支援
- 描述性按鈕標籤
- 錯誤訊息公告
- 檔案輸入接受屬性

## API 整合

### 訊息發送

組件與 `messageApi` 整合：

```typescript
import { messageApi } from '@/api/message'

// 透過 API 發送訊息
const response = await messageApi.send(conversationId, {
  content: messageText,
  messageType: 'text',
  platform: 'line'
})
```

### 預期的 API 回應

```typescript
// 成功
{
  success: true,
  data: {
    id: 'msg-123',
    content: '訊息內容',
    // ... 其他訊息屬性
  }
}

// 錯誤
{
  success: false,
  error: {
    message: '錯誤描述'
  }
}
```

## 組件狀態

### 內部狀態

```typescript
const messageText = ref('')        // 目前訊息文字
const attachments = ref([])        // 選中的附件
const sending = ref(false)         // 載入狀態
const error = ref('')             // 錯誤訊息
```

### 計算屬性

```typescript
const canSend = computed(() => {
  return (messageText.value.trim().length > 0 || attachments.value.length > 0) && !props.disabled
})
```

## 效能考量

### 自動調整大小最佳化
- 防抖的調整大小計算
- 最大高度限制（120px）
- 高效的 DOM 更新

### 記憶體管理
- 組件卸載時適當清理
- 處理後清理檔案物件
- 事件監聽器清理

### 響應式更新
- 使用計算屬性實現最小重新渲染
- 高效的狀態更新
- 最佳化的事件處理

## 測試

### 測試覆蓋

組件包含完整的單元測試：

- ✅ 基本渲染和屬性
- ✅ 文字輸入功能
- ✅ 訊息發送流程
- ✅ 檔案附件處理
- ✅ 錯誤情況
- ✅ 鍵盤互動
- ✅ 無障礙功能

### 執行測試

```bash
# 執行組件測試
npm run test -- MessageInput.test.ts

# 執行覆蓋率測試
npm run test:coverage -- MessageInput.test.ts
```

## 疑難排解

### 常見問題

#### 訊息無法發送
1. 檢查是否提供了 `conversationId` 屬性
2. 驗證 API 端點是否可存取
3. 檢查網路連線
4. 確保訊息內容不為空

#### 檔案上傳問題
1. 驗證檔案大小是否小於 10MB
2. 檢查檔案類型是否支援
3. 確保檔案輸入未被停用
4. 檢查瀏覽器檔案 API 支援

#### 樣式問題
1. 驗證 CSS 自訂屬性是否已定義
2. 檢查響應式斷點
3. 確保設計系統已匯入

### 除錯模式

在開發環境中啟用除錯記錄：

```javascript
// 在瀏覽器控制台中
localStorage.setItem('debug', 'MessageInput')
```

## 遷移指南

### 從舊版本遷移

如果從較舊的訊息輸入實作遷移：

1. **更新屬性**: 確保提供 `conversationId`
2. **更新事件**: 使用新的事件名稱（`message-sent`、`attachment-upload`）
3. **更新樣式**: 使用新的 CSS 自訂屬性
4. **更新 API**: 確保 messageApi 相容性

### 重大變更

- 事件名稱從 `send` 變更為 `message-sent`
- 檔案附件結構已更新
- CSS 類別重新命名以保持一致性

## 貢獻

### 開發設定

1. 安裝依賴項目: `npm install`
2. 啟動開發伺服器: `npm run dev`
3. 執行測試: `npm run test`
4. 檢查類型: `npm run type-check`

### 程式碼風格

- 使用 Vue 3 Composition API
- 遵循 TypeScript 嚴格模式
- 使用 CSS 自訂屬性
- 包含完整測試
- 為複雜函數新增 JSDoc 註解

### Pull Request 檢查清單

- [ ] 測試通過
- [ ] TypeScript 編譯無錯誤
- [ ] 符合無障礙要求
- [ ] 響應式設計已測試
- [ ] 文檔已更新
- [ ] 錯誤處理已實作

## 相關組件

- `MessageBubble` - 顯示個別訊息
- `ConversationDetail` - 使用 MessageInput 的父組件
- `FileIcon`、`SendIcon` 等 - UI 中使用的圖示組件

## 外部依賴項目

- `@/api/message` - 訊息 API 客戶端
- `@/components/icons` - 圖示組件庫
- `vue` - Vue 3 框架
- File API - 瀏覽器檔案處理