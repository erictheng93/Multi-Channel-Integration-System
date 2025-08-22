# ConversationCard 對話卡片組件

## 概述

`ConversationCard` 組件以卡片格式顯示對話摘要，展示客戶資訊、對話狀態、最後訊息預覽和指派客服詳細資訊。它專為對話清單使用而設計，提供選擇對話的互動介面。

## 功能特色

- **客戶資訊顯示**：顯示客戶姓名、頭像縮寫、平台徽章和平台使用者 ID
- **對話狀態**：帶有徽章的視覺狀態指示器
- **訊息預覽**：顯示最後一則訊息，支援自動截斷
- **時間格式化**：智慧時間顯示（分鐘、小時或日期）
- **未讀指示器**：顯示未讀訊息數量的視覺徽章
- **客服指派**：在有指派客服時顯示客服資訊
- **互動選擇**：點擊選擇對話，提供視覺回饋
- **響應式設計**：適應行動裝置螢幕

## 屬性 (Props)

### `conversation` (必需)
- **類型**: `Conversation`
- **說明**: 包含所有對話資料的對話物件
- **屬性**:
  - `id`: 唯一對話識別碼
  - `user`/`customer`: 客戶資訊（支援兩者以保持向後相容性）
  - `assignedAgent`: 指派的客服詳細資訊
  - `status`: 對話狀態（'open'、'assigned'、'closed'）
  - `platform`: 平台識別碼（'line'、'facebook' 等）
  - `lastMessage`: 對話中的最後一則訊息
  - `unreadCount`: 未讀訊息數量
  - `updatedAt`: 最後更新時間戳

### `selected` (可選)
- **類型**: `boolean`
- **預設值**: `false`
- **說明**: 此對話卡片是否目前被選中

## 事件 (Events)

### `select`
- **載荷**: `Conversation`
- **說明**: 點擊對話卡片時觸發
- **用法**: `@select="handleConversationSelect"`

## 計算屬性

### `customerInitials`
- 從姓名生成客戶縮寫（最多 2 個字元）
- 如果沒有姓名則回退到 'U'
- 處理單一和多個姓名

### `lastMessageText`
- 顯示最後一則訊息內容
- 截斷超過 50 個字元的訊息
- 在沒有訊息時顯示後備文字

## 方法

### `formatTime(date)`
- **參數**: `date` (Date | string | number)
- **回傳**: 格式化的時間字串
- **邏輯**:
  - < 1 小時: "X分鐘前"
  - < 24 小時: "X小時前"
  - 更早: 本地化日期格式

## 視覺狀態

### 預設狀態
- 白色背景，帶有細微邊框
- 滑鼠懸停效果，邊框顏色變化和陰影

### 選中狀態
- 主色調邊框
- 帶有主色調強調的盒陰影

### 未讀狀態
- 左側邊框主色調強調
- 右上角未讀數量徽章

### 行動響應式
- 減少內邊距和頭像尺寸
- 堆疊訊息佈局以提高可讀性

## 依賴項目

- `PlatformBadge`: 顯示平台特定徽章
- `StatusBadge`: 顯示對話狀態
- `UserIcon`: 指派客服顯示的圖示

## 使用範例

### 基本用法
```vue
<ConversationCard
  :conversation="conversation"
  @select="handleSelect"
/>
```

### 帶選擇狀態
```vue
<ConversationCard
  :conversation="conversation"
  :selected="selectedConversationId === conversation.id"
  @select="handleSelect"
/>
```

### 在清單中使用
```vue
<div class="conversation-list">
  <ConversationCard
    v-for="conversation in conversations"
    :key="conversation.id"
    :conversation="conversation"
    :selected="selectedId === conversation.id"
    @select="selectConversation"
  />
</div>
```

## 無障礙功能

- 語義化 HTML 結構，帶有適當標題
- 時間元素使用 `<time>` 標籤
- 透過點擊事件支援鍵盤導航
- 螢幕閱讀器友善的內容結構

## 樣式設定

組件使用 CSS 自訂屬性進行主題設定：
- `--primary-*`: 主色調變體
- `--gray-*`: 灰色色階
- `--space-*`: 間距比例
- `--radius-*`: 邊框圓角值
- `--shadow-*`: 盒陰影變體
- `--transition-*`: 過渡時間

## 瀏覽器支援

- 支援 CSS Grid 和 Flexbox 的現代瀏覽器
- 行動響應式設計
- 觸控友善的互動區域

## 效能考量

- 計算屬性會被快取，只在依賴項目變更時重新計算
- 透過 Vue 的響應式系統進行高效的 DOM 更新
- 透過適當的屬性結構實現最小重新渲染

## 測試

完整的單元測試涵蓋：
- 各種資料狀態的組件渲染
- 事件觸發和處理
- 邊界情況和錯誤狀態
- 無障礙功能
- 響應式行為
- 時間格式化邏輯
- 客戶資訊顯示變化

## 遷移注意事項

### 向後相容性
- 支援 `user` 和 `customer` 屬性
- 處理舊版對話資料結構
- 對缺失資料提供優雅的後備處理

### 類型安全
- 完整的 TypeScript 支援
- 所有屬性和事件的適當類型定義
- 開發模式下的執行時類型檢查