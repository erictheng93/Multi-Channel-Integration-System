# EmptyState 空狀態組件文檔

## 概述

`EmptyState` 組件是一個可重用的 Vue 3 組件，用於顯示空狀態，支援載入功能、操作按鈕和可自訂內容。

## 最新變更 (2025-01-08)

### 新增功能

1. **載入狀態支援**
   - 新增 `loading` 屬性，在非同步操作期間顯示載入動畫
   - 新增 `loadingText` 屬性，用於自訂載入訊息
   - 載入狀態會隱藏正常內容並顯示載入動畫

2. **增強操作按鈕**
   - 新增 `actionText` 屬性，快速建立操作按鈕
   - 操作按鈕在載入狀態時自動隱藏
   - 點擊時觸發 `action` 事件

3. **改進靈活性**
   - 將 `title` 和 `description` 屬性設為可選
   - 新增預設插槽用於自訂內容
   - 新增操作插槽用於自訂操作按鈕
   - 新增尺寸變體：`small`、`medium`、`large`

4. **更好的類別綁定**
   - 修復尺寸變體的類別綁定邏輯
   - 使用陣列語法簡化類別應用

## 屬性 (Props)

| 屬性 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| `title` | `string` | `undefined` | 可選標題文字 |
| `description` | `string` | `undefined` | 可選描述文字 |
| `actionText` | `string` | `undefined` | 操作按鈕文字（提供時會建立按鈕） |
| `loading` | `boolean` | `false` | 為 true 時顯示載入動畫 |
| `loadingText` | `string` | `undefined` | 載入期間顯示的文字 |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 尺寸變體 |

## 事件 (Events)

| 事件 | 載荷 | 說明 |
|------|------|------|
| `action` | `[]` | 點擊操作按鈕時觸發 |

## 插槽 (Slots)

| 插槽 | 說明 |
|------|------|
| `default` | 自訂內容區域 |
| `icon` | 自訂圖示（預設為笑臉圖示） |
| `action` | 自訂操作按鈕 |

## 使用範例

### 基本用法
```vue
<template>
  <EmptyState
    title="無可用資料"
    description="目前沒有項目可顯示。"
  />
</template>
```

### 帶操作按鈕
```vue
<template>
  <EmptyState
    title="無對話"
    description="開始新對話以開始使用。"
    actionText="新對話"
    @action="handleNewConversation"
  />
</template>
```

### 載入狀態
```vue
<template>
  <EmptyState
    title="載入對話中"
    :loading="isLoading"
    loadingText="正在取得您的對話..."
  />
</template>
```

### 自訂內容
```vue
<template>
  <EmptyState title="自訂內容">
    <div class="custom-content">
      <p>這是自訂內容</p>
      <button @click="doSomething">自訂操作</button>
    </div>
  </EmptyState>
</template>
```

### 自訂圖示和操作
```vue
<template>
  <EmptyState title="無檔案">
    <template #icon>
      <FileIcon />
    </template>
    
    <template #action>
      <button class="primary-btn" @click="uploadFile">
        上傳檔案
      </button>
      <button class="secondary-btn" @click="createFile">
        建立新檔案
      </button>
    </template>
  </EmptyState>
</template>
```

### 尺寸變體
```vue
<template>
  <!-- 小尺寸變體 -->
  <EmptyState
    size="small"
    title="小型空狀態"
    description="這是緊湊版本"
  />
  
  <!-- 中等尺寸變體（預設） -->
  <EmptyState
    title="中等空狀態"
    description="這是預設尺寸"
  />
  
  <!-- 大尺寸變體 -->
  <EmptyState
    size="large"
    title="大型空狀態"
    description="這是擴展版本"
  />
</template>
```

## 樣式設定

組件使用 CSS 類別進行樣式設定：

- `.empty-state` - 主容器
- `.empty-state.small` - 小尺寸變體
- `.empty-state.medium` - 中等尺寸變體（預設）
- `.empty-state.large` - 大尺寸變體
- `.loading-spinner` - 載入動畫容器
- `.empty-icon` - 圖示容器
- `.empty-content` - 內容容器
- `.empty-title` - 標題文字
- `.empty-description` - 描述文字
- `.empty-custom` - 自訂內容容器
- `.empty-actions` - 操作按鈕容器
- `.empty-action` - 預設操作按鈕
- `.loading-text` - 載入文字

## 無障礙設計

組件遵循無障礙設計最佳實務：

- 使用語義化 HTML 元素
- 在需要的地方提供適當的 ARIA 標籤
- 支援互動元素的鍵盤導航
- 維持適當的色彩對比度

## 測試

組件包含完整的單元測試，涵蓋：

- 不同屬性組合的基本渲染
- 載入狀態行為
- 操作按鈕功能
- 尺寸變體應用
- 自訂內容插槽
- 缺少屬性的錯誤處理

執行測試：
```bash
npm test -- src/components/ui/EmptyState.test.ts
```

## 遷移指南

### 從舊版本升級

如果您使用的是舊版本的 EmptyState：

1. **必需屬性**：`title` 和 `description` 現在是可選的
2. **操作按鈕**：使用 `actionText` 屬性建立簡單按鈕，或使用 `action` 插槽建立自訂按鈕
3. **載入狀態**：使用 `loading` 屬性而非獨立的載入組件
4. **尺寸控制**：使用 `size` 屬性而非自訂 CSS 類別

### 重大變更

- 無 - 所有變更都向後相容
- 現有用法將繼續正常運作，無需修改

## 效能考量

- 組件使用 Vue 3 Composition API 以獲得最佳效能
- 載入狀態有效切換內容可見性
- 狀態變更期間的最小 DOM 更新
- 輕量級 CSS，無外部依賴

## 瀏覽器支援

- 支援 Vue 3 的現代瀏覽器
- IE11+（需要 Vue 3 polyfills）
- 行動瀏覽器（iOS Safari、Chrome Mobile）