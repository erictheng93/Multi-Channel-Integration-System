# 資料庫管理

Multi-Channel Support MVP 的資料庫管理工具和腳本。

## 檔案說明

- `schema.sql` - 完整的資料庫 schema 定義
- `cleanup.sql` - 清理舊表格的腳本
- `init.sql` - 完整的初始化腳本（包含清理 + 建立 + 測試資料）
- `init-database.ps1` - PowerShell 初始化腳本
- `verify-schema.js` - Node.js 驗證腳本

## 資料庫結構

### 表格

1. **users** - 使用者表
   - 儲存來自各平台的使用者資訊
   - 支援多平台（LINE、Facebook、Instagram、WhatsApp）

2. **conversations** - 對話表
   - 管理使用者與客服的對話會話
   - 包含狀態、分配、未讀數等資訊

3. **messages** - 訊息表
   - 儲存所有對話訊息
   - 支援文字、媒體等多種訊息類型

4. **agents** - 客服人員表
   - 管理客服人員帳號
   - 包含角色權限管理

### 索引

- `idx_conversations_user` - 對話的使用者索引
- `idx_conversations_status` - 對話狀態索引
- `idx_conversations_assigned` - 對話分配索引
- `idx_messages_conversation` - 訊息的對話索引
- `idx_messages_created` - 訊息建立時間索引

## 使用方法

### 1. 完整初始化資料庫（推薦）

使用 PowerShell 腳本：
```powershell
.\database\init-database.ps1
```

這個腳本會：
- 清理本地和遠端的舊表格
- 建立新的資料庫結構
- 插入測試資料
- 執行驗證檢查

### 2. 檢查資料庫狀態

```powershell
.\database\status.ps1
```

### 3. 驗證資料庫結構

```bash
node database/verify-schema.js
```

### 4. 手動執行步驟

清理舊表格：
```bash
# 本地
wrangler d1 execute omni-channel-platform --local --file=database/cleanup-remote.sql
# 遠端
wrangler d1 execute omni-channel-platform --remote --file=database/cleanup-remote.sql
```

建立新結構：
```bash
# 本地
wrangler d1 execute omni-channel-platform --local --file=database/schema.sql
# 遠端
wrangler d1 execute omni-channel-platform --remote --file=database/schema.sql
```

## 測試資料

初始化後會自動建立以下測試帳號：

- **Admin**: admin@dacit.net (admin-001)
- **Agent 1**: dacagent@dacit.net (agent-001)

密碼雜湊需要在實際使用前更新。

## 注意事項

1. 執行初始化前會自動清理所有舊表格
2. 使用 `IF NOT EXISTS` 確保重複執行的安全性
3. 所有時間戳使用 Unix timestamp (INTEGER)
4. 支援外鍵約束以確保資料完整性
5. 建議在生產環境部署前先在本地測試