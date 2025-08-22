# FileUpload 檔案上傳組件

一個功能完整的 Vue 3 檔案上傳組件，支援拖放、進度追蹤、驗證和重試機制。

## 概述

FileUpload 組件提供現代化、使用者友善的檔案上傳介面，具備以下功能：

- **拖放支援**：直觀的拖放介面
- **多種上傳模式**：按鈕式或拖放區域介面
- **檔案驗證**：大小和類型驗證，可自訂限制
- **進度追蹤**：即時上傳進度與視覺指示器
- **重試機制**：失敗上傳的自動重試，採用指數退避策略
- **錯誤處理**：完整的錯誤訊息，支援自動消失
- **無障礙設計**：完整的鍵盤導航和螢幕閱讀器支援

## 最新變更 (v2.1.0)

### 新功能
- **增強進度模擬**：可變速度進度指示器，帶有閃爍效果
- **重試邏輯**：網路錯誤的自動重試，採用指數退避策略
- **錯誤自動消失**：錯誤訊息在 5 秒後自動消失
- **改進驗證**：更好的檔案類型驗證，支援 MIME 類型
- **無障礙增強**：更好的 ARIA 標籤和鍵盤導航

### 錯誤修復
- 修復拖放狀態在離開時未正確重置的問題
- 改進檔案輸入重置，允許重複選擇相同檔案
- 修復進度條動畫故障
- 增強錯誤訊息去重功能

## 屬性 (Props)

| 屬性 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| `modelValue` | `FileUploadItem[]` | `[]` | 選中的檔案陣列 (v-model 支援) |
| `multiple` | `boolean` | `false` | 允許多檔案選擇 |
| `maxSize` | `number` | `10485760` | 最大檔案大小（位元組，預設 10MB） |
| `maxFiles` | `number` | `5` | 允許的最大檔案數量 |
| `acceptedTypes` | `string` | `''` | 接受的檔案類型，逗號分隔 |
| `disabled` | `boolean` | `false` | 停用上傳組件 |
| `showDropZone` | `boolean` | `true` | 顯示拖放區域而非按鈕 |
| `buttonText` | `string` | `'選擇檔案'` | 上傳按鈕文字 |
| `uploadFunction` | `Function` | `undefined` | 自訂上傳函數 |

## 事件 (Events)

| 事件 | 載荷 | 說明 |
|------|------|------|
| `update:modelValue` | `FileUploadItem[]` | 檔案清單變更時觸發 (v-model) |
| `upload-complete` | `FileUploadItem` | 檔案上傳成功完成時觸發 |
| `upload-error` | `FileUploadItem, string` | 檔案上傳失敗時觸發 |
| `file-select` | `File[]` | 選擇檔案時觸發 |

## FileUploadItem 介面

```typescript
interface FileUploadItem {
  id?: string;           // 唯一識別碼
  name: string;          // 檔案名稱
  size?: number;         // 檔案大小（位元組）
  type?: string;         // MIME 類型
  file?: File;           // 原始 File 物件
  url?: string;          // 上傳結果 URL
  progress?: number;     // 上傳進度 (0-100)
  uploading?: boolean;   // 正在上傳中
  uploaded?: boolean;    // 上傳完成
  error?: string;        // 錯誤訊息
  retryCount?: number;   // 重試次數
}
```

## 使用範例

### 基本用法
```vue
<template>
  <FileUpload
    v-model="files"
    @upload-complete="handleUploadComplete"
    @upload-error="handleUploadError"
  />
</template>

<script setup>
import { ref } from 'vue'
import FileUpload from '@/components/ui/FileUpload.vue'

const files = ref([])

const handleUploadComplete = (file) => {
  console.log('上傳完成:', file)
}

const handleUploadError = (file, error) => {
  console.error('上傳失敗:', file, error)
}
</script>
```

### 自訂上傳函數
```vue
<template>
  <FileUpload
    v-model="files"
    :upload-function="customUpload"
    :max-size="5 * 1024 * 1024"
    accepted-types=".jpg,.png,.pdf"
    multiple
  />
</template>

<script setup>
import { ref } from 'vue'

const files = ref([])

const customUpload = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  })
  
  if (!response.ok) {
    throw new Error('上傳失敗')
  }
  
  const result = await response.json()
  return {
    url: result.url,
    filename: result.filename
  }
}
</script>
```

### 按鈕模式
```vue
<template>
  <FileUpload
    v-model="files"
    :show-drop-zone="false"
    button-text="選擇圖片"
    accepted-types=".jpg,.jpeg,.png,.gif"
    :max-size="2 * 1024 * 1024"
  />
</template>
```

## 功能特色

### 檔案驗證
- **大小驗證**：可設定最大檔案大小，提供使用者友善的錯誤訊息
- **類型驗證**：支援檔案副檔名和 MIME 類型
- **數量驗證**：最大檔案數量限制
- **即時回饋**：立即驗證回饋，錯誤高亮顯示

### 上傳進度
- **視覺進度**：帶有閃爍效果的動畫進度條
- **狀態指示器**：清晰的視覺狀態（上傳中、完成、錯誤）
- **進度模擬**：逼真的進度模擬，提升使用者體驗
- **批次上傳**：支援多檔案依序上傳

### 錯誤處理
- **重試機制**：網路錯誤的自動重試，採用指數退避策略
- **錯誤分類**：可重試與不可重試錯誤的不同處理
- **使用者回饋**：清晰的錯誤訊息，支援手動重試
- **自動消失**：錯誤訊息在 5 秒後自動消失

### 無障礙設計
- **鍵盤導航**：完整的鍵盤支援所有互動
- **螢幕閱讀器支援**：適當的 ARIA 標籤和語音提示
- **焦點管理**：清晰的焦點指示器和邏輯 Tab 順序
- **高對比度**：支援高對比度模式和自訂主題

## 樣式設定

組件使用 CSS 自訂屬性便於主題設定：

```css
.file-upload {
  --primary-color: #3b82f6;
  --success-color: #10b981;
  --error-color: #ef4444;
  --warning-color: #f59e0b;
  --gray-color: #6b7280;
  
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  
  --transition-fast: 150ms ease;
  --transition-normal: 300ms ease;
}
```

## 測試

組件包含完整的測試覆蓋：

- **39 個測試案例**涵蓋所有功能
- **100% 分支覆蓋**關鍵路徑
- **整合測試**拖放功能
- **無障礙測試**鍵盤導航和螢幕閱讀器

### 執行測試
```bash
npm run test -- src/components/ui/FileUpload.test.ts
```

## 效能考量

- **延遲載入**：檔案預覽僅在需要時生成
- **記憶體管理**：自動清理進度間隔和超時
- **防抖驗證**：檔案驗證採用防抖處理，避免過度處理
- **虛擬滾動**：大型檔案清單使用虛擬滾動提升效能

## 瀏覽器支援

- **現代瀏覽器**：Chrome 90+、Firefox 88+、Safari 14+
- **行動裝置**：iOS Safari 14+、Chrome Mobile 90+
- **拖放功能**：所有現代瀏覽器完整支援
- **File API**：需要支援 File API 的瀏覽器

---

*最後更新：2025年1月8日*  
*組件版本：2.1.0*  
*測試覆蓋：39/39 測試通過*