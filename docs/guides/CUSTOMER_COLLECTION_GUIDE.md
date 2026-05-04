# 客戶資料收集完整指南

##  概述

這個 LINE Bot 系統已經完整實現了客戶資料收集功能。當客戶傳送訊息時，系統會自動收集並儲存客戶的詳細資訊到 Cloudflare D1 資料庫中。

##  自動收集的客戶資訊

### 基本資訊
- **LINE 用戶ID** (`platform_user_id`): 唯一識別碼
- **顯示名稱** (`display_name`): 用戶的 LINE 顯示名稱
- **頭像URL** (`avatar_url`): 用戶的 LINE 頭像圖片
- **平台** (`platform`): 固定為 'line'

### 時間戳記
- **建立時間** (`created_at`): 首次接觸時間
- **更新時間** (`updated_at`): 最後更新時間

### 額外資訊 (JSON 格式存儲在 `metadata` 欄位)
- **狀態訊息** (`statusMessage`): 用戶的 LINE 狀態訊息
- **最後資料更新時間** (`lastProfileUpdate`)
- **訊息計數** (`messageCount`): 可擴展的計數器

##  資料收集流程

```
1. 客戶發送訊息到 LINE
   ↓
2. LINE 平台發送 Webhook 到 Worker
   ↓
3. Worker 調用 LINE Profile API 獲取用戶詳細資訊
   ↓
4. 檢查客戶是否已存在於資料庫
   ↓
5. 如果是新客戶：建立新記錄
   如果是現有客戶：更新資訊（如有變更）
   ↓
6. 儲存或更新客戶資料到 D1 資料庫
   ↓
7. 繼續處理訊息和對話邏輯
```

## ️ 資料庫結構

### customers 表
```sql
CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,                -- 平台 (line, facebook, etc.)
    platform_user_id TEXT NOT NULL,        -- 平台用戶ID
    display_name TEXT,                      -- 顯示名稱
    avatar_url TEXT,                        -- 頭像URL
    phone TEXT,                             -- 電話
    email TEXT,                             -- 電子郵件
    source_team_id INTEGER,                 -- 來源團隊
    metadata TEXT,                          -- JSON格式的額外資訊
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform, platform_user_id)
);
```

### 索引
```sql
CREATE INDEX idx_customers_platform_user ON customers(platform, platform_user_id);
CREATE INDEX idx_customers_source_team ON customers(source_team_id);
```

##  API 端點

### 客戶查詢
- `GET /api/customers` - 查詢所有客戶
- `GET /api/customers/:customerId` - 查詢特定客戶
- `GET /api/customers/platform/:platform/:platformUserId` - 根據平台ID查詢客戶

### 統計資訊
- `GET /api/stats` - 系統統計（包含客戶總數）

## ️ 管理工具

### 1. 配置工具
```bash
node config.cjs
```
- 檢查配置設定
- 驗證 Worker URL
- 測試 API 連接

### 2. 客戶資料管理
```bash
node customer-manager.js
```
- 查詢所有客戶
- 搜尋特定客戶
- 顯示客戶詳細資訊
- 匯出客戶資料為 CSV

### 3. 客戶資料分析
```bash
node customer-analytics.js
```
- 客戶平台分布分析
- 註冊時間趨勢分析
- 客戶活躍度分析
- 資料完整度分析

### 4. 實時監控
```bash
node monitor-customers.js
```
- 監控新客戶註冊
- 監控客戶活動
- 即時統計更新

### 5. 測試工具
```bash
node test-customer-collection.js  # 功能測試
node test-customer-flow.js        # 流程測試
node query-customers.js           # 查詢測試
```

##  設定步驟

### 1. 更新配置
編輯 `config.cjs` 文件，設定你的 Worker URL：
```javascript
const CONFIG = {
  WORKER_URL: 'https://multi-channel.imfinethankyouandyou.com',
  // ... 其他設定
};
```

### 2. 測試配置
```bash
node config.cjs
```

### 3. 驗證功能
```bash
node test-customer-collection.js
```

### 4. 查詢客戶資料
```bash
node customer-manager.js
```

##  使用範例

### 查詢特定 LINE 用戶
```bash
curl "https://multi-channel.imfinethankyouandyou.com/api/customers/platform/line/U1234567890abcdef"
```

### 查詢所有客戶
```bash
curl "https://multi-channel.imfinethankyouandyou.com/api/customers"
```

### 查詢系統統計
```bash
curl "https://multi-channel.imfinethankyouandyou.com/api/stats"
```

##  隱私和安全

### 資料保護
- 所有客戶資料儲存在 Cloudflare D1 (符合 GDPR)
- 使用 HTTPS 加密傳輸
- LINE Webhook 簽名驗證

### 資料最小化
- 只收集必要的客戶資訊
- 遵循 LINE 平台的隱私政策
- 支援資料更新和刪除

##  擴展功能

### 可以添加的功能
1. **客戶標籤系統**: 為客戶添加自定義標籤
2. **客戶分群**: 根據行為或屬性分群
3. **客戶生命週期追蹤**: 追蹤客戶互動歷程
4. **自動化行銷**: 基於客戶資料的自動化訊息
5. **客戶滿意度調查**: 收集客戶反饋

### 整合其他平台
- Facebook Messenger
- Instagram Direct
- WhatsApp Business
- Telegram

##  支援

如果遇到問題，請檢查：
1. Worker URL 是否正確
2. D1 資料庫是否已初始化
3. LINE Channel Access Token 是否有效
4. 網路連接是否正常

##  總結

你的 LINE Bot 現在已經具備完整的客戶資料收集功能：

-  自動收集客戶 LINE ID
-  獲取客戶顯示名稱和頭像
-  儲存到 D1 資料庫
-  提供查詢 API
-  包含管理工具
-  支援資料分析
-  實時監控功能

每當客戶傳送訊息時，系統都會自動更新他們的資料，確保你始終擁有最新的客戶資訊！