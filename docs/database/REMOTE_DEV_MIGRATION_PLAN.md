# 遠程開發環境數據庫遷移方案

## 概述

本文檔記錄了將遠程開發環境數據庫從舊結構遷移到 Drizzle ORM 兼容結構的完整方案。

## 遷移執行情況

- **執行時間**: 2025-08-28 08:09:43 UTC
- **狀態**: ✅ 成功完成
- **影響範圍**: 遠程開發環境 (multi-channel-platform-dev)

## 遷移前後對比

### 數據庫結構變更

| 項目 | 遷移前 | 遷移後 | 說明 |
|------|--------|--------|------|
| 總表數量 | 11個 | 14個 | 新增 Drizzle 完整表結構 |
| agents 表 | 手動創建，無 UNIQUE 約束 | Drizzle 生成，有 email UNIQUE 約束 | 結構標準化 |
| conversations 表 | INTEGER id，customer_id 引用 | TEXT UUID，user_id 引用 | 符合新架構 |
| 數據遷移 | - | 完整保留 | 3個 agents，1個 conversation，1個 customer |

### 新增表結構

以下為新增的 Drizzle 標準表：
- `delayed_messages` - 延遲消息功能
- `file_attachments` - 文件附件管理
- `invitations` - 邀請系統
- `messages` - 消息記錄
- `teams` - 團隊管理
- `users` - 用戶系統

## 數據保留情況

### ✅ 成功遷移的數據

1. **Agents (3條記錄)**
   - admin@dacit.net (System Administration) - Admin 角色
   - dacagent@dacit.net (dacagent) - Agent 角色  
   - test@dacit.net (Test User) - Agent 角色
   - 保留所有密碼哈希、登入記錄、創建時間

2. **Customers (1條記錄)**
   - 平台數據完整遷移
   - 聯繫資訊和元數據保留

3. **Conversations (1條記錄)**
   - 轉換為新的 UUID 格式
   - 創建對應的 user 記錄
   - 狀態和時間戳保留

## 技術實施細節

### 遷移腳本
- **文件位置**: `scripts/migrate-remote-dev-db.ts`
- **生成 SQL**: `migration_dev_remote.sql`
- **執行方式**: wrangler d1 execute --remote

### 數據轉換邏輯

1. **ID 格式轉換**
   ```typescript
   // 舊格式: integer id
   // 新格式: UUID text id
   const convId = generateUUID();
   ```

2. **外鍵關係重建**
   ```sql
   -- 舊: customer_id -> customers.id
   -- 新: user_id -> users.id  
   ```

3. **時間戳格式標準化**
   ```typescript
   const createdAt = isNaN(Number(agent.created_at)) ? 
     `'${agent.created_at}'` : 
     `datetime(${agent.created_at} / 1000, 'unixepoch')`;
   ```

## 遷移記錄同步

更新了 `d1_migrations` 表，確保與本地開發環境一致：
```sql
INSERT OR REPLACE INTO d1_migrations (name, applied_at) VALUES 
('0000_charming_chimera.sql', datetime('now')),
('0001_perfect_klaw.sql', datetime('now'));
```

## 驗證檢查

### ✅ 結構驗證
- [x] 14個表全部創建成功
- [x] 外鍵約束正確設置
- [x] 唯一索引正確創建
- [x] Drizzle 遷移記錄同步

### ✅ 數據驗證
- [x] Agents: 3條記錄完整遷移
- [x] 密碼哈希格式保留
- [x] 登入記錄和時間戳正確
- [x] 角色和權限設置正確

### ✅ 功能驗證
- [x] 後端 API 健康檢查通過
- [x] 數據庫連接正常
- [x] 查詢操作正常

## 後續維護

### 監控要點
1. **性能監控**: 新表結構的查詢效能
2. **數據一致性**: 外鍵關係完整性
3. **遷移記錄**: 與生產環境同步狀態

### 回滾方案
備份文件已保存：
- `remote_agents_backup.json`
- `remote_conversations_backup.json` 
- `remote_customers_backup.json`

如需回滾，可以使用這些備份文件重新創建舊結構。

## 影響評估

### ✅ 正面影響
- 數據庫結構標準化，符合 Drizzle ORM 規範
- 支持完整的企業級功能（團隊、邀請、消息管理等）
- 與本地開發環境完全同步
- 為生產環境遷移提供參考

### ⚠️ 注意事項
- 所有既存的 API 測試和集成需要重新驗證
- 前端應用需要適應新的數據結構
- 開發團隊需要了解新的表關係

## 結論

遷移成功完成，遠程開發環境數據庫現已與本地開發環境完全同步。所有重要數據均已保留，新結構支援完整的系統功能。建議接下來進行全面的功能測試以確保系統正常運作。