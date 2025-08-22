# Cloudflare 資源重新命名指南

## 概述

為了讓 Cloudflare 資源命名與專案名稱 `multi-channel-platform` 保持一致，我們需要將現有的 `omni-channel` 命名的資源更新為 `multi-channel-platform` 命名。

## 資源命名對照表

### 更新前 (舊命名)
- **D1 資料庫**: `omni-channel-platform`
- **R2 存儲桶 (開發)**: `omni-channel-attachments-develop`
- **R2 存儲桶 (生產)**: `omni-channel-attachments-production`

### 更新後 (新命名)
- **D1 資料庫**: `multi-channel-platform`
- **R2 存儲桶 (開發)**: `multi-channel-platform-attachments-develop`
- **R2 存儲桶 (生產)**: `multi-channel-platform-attachments-production`

## 自動化遷移腳本

我們提供了兩個自動化腳本來協助資源重新命名：

### 1. 資源重新命名腳本

**Windows (PowerShell)**:
```powershell
.\scripts\rename-cloudflare-resources.ps1
```

**Linux/macOS (Bash)**:
```bash
./scripts/rename-cloudflare-resources.sh
```

### 2. 舊資源清理腳本

在確認新資源工作正常後，使用此腳本清理舊資源：

```powershell
.\scripts\cleanup-old-resources.ps1
```

## 手動遷移步驟

如果你偏好手動執行遷移，請按照以下步驟：

### 步驟 1: 創建新的 D1 資料庫

```bash
# 創建新資料庫
wrangler d1 create multi-channel-platform

# 記錄返回的 database_id，例如:
# database_id = "new-database-id-here"
```

### 步驟 2: 創建新的 R2 存儲桶

```bash
# 創建開發環境存儲桶
wrangler r2 bucket create multi-channel-platform-attachments-develop

# 創建生產環境存儲桶
wrangler r2 bucket create multi-channel-platform-attachments-production
```

### 步驟 3: 更新配置文件

更新 `wrangler.toml` 和 `wrangler-delayed-message.toml` 中的資源 ID：

```toml
# 更新 database_id 為新創建的資料庫 ID
[[d1_databases]]
binding = "DB"
database_name = "multi-channel-platform"
database_id = "new-database-id-here"
```

### 步驟 4: 遷移資料庫資料

```bash
# 導出舊資料庫資料
wrangler d1 export omni-channel-platform --output=migration-backup.sql

# 導入到新資料庫
wrangler d1 execute multi-channel-platform --file=migration-backup.sql
```

### 步驟 5: 遷移 R2 存儲桶資料

R2 存儲桶之間的資料遷移需要使用額外工具，如 `rclone`：

```bash
# 安裝 rclone (如果尚未安裝)
# 配置 Cloudflare R2 作為遠端存儲

# 同步資料
rclone sync cloudflare:omni-channel-attachments-develop cloudflare:multi-channel-platform-attachments-develop
rclone sync cloudflare:omni-channel-attachments-production cloudflare:multi-channel-platform-attachments-production
```

### 步驟 6: 測試新資源

```bash
# 執行資料庫遷移
npm run db:migrate

# 啟動開發伺服器測試
npm run dev

# 部署到生產環境測試
npm run deploy
```

### 步驟 7: 清理舊資源

確認新資源工作正常後，刪除舊資源：

```bash
# 刪除舊資料庫
wrangler d1 delete omni-channel-platform

# 刪除舊存儲桶
wrangler r2 bucket delete omni-channel-attachments-develop
wrangler r2 bucket delete omni-channel-attachments-production
```

## 已更新的文件

以下文件已自動更新為新的資源命名：

### 配置文件
- `wrangler.toml`
- `wrangler-delayed-message.toml`
- `package.json` (npm scripts)

### 程式碼文件
- `src/handlers/system-main.ts`
- `tests/setup-cloudflare-services.ts`
- `tests/package.json`

### 文件更新
- 所有相關文件中的資源名稱引用

## 注意事項

### ⚠️ 重要提醒

1. **備份資料**: 在執行任何遷移操作前，請確保已備份所有重要資料
2. **測試環境**: 建議先在開發環境測試完成後再處理生產環境
3. **資源 ID**: 新創建的資源會有不同的 ID，需要更新配置文件
4. **R2 資料遷移**: R2 存儲桶的資料遷移需要額外工具支援
5. **DNS 快取**: 如果使用自定義域名，可能需要等待 DNS 快取更新

### 🔍 驗證步驟

遷移完成後，請執行以下驗證：

```bash
# 檢查資源列表
wrangler d1 list
wrangler r2 bucket list

# 測試資料庫連接
wrangler d1 execute multi-channel-platform --command="SELECT COUNT(*) FROM users"

# 測試應用程式功能
npm run dev
```

### 🆘 故障排除

如果遇到問題：

1. **資料庫連接失敗**: 檢查 `wrangler.toml` 中的 `database_id` 是否正確
2. **R2 存儲桶錯誤**: 確認存儲桶名稱和權限設置
3. **部署失敗**: 檢查所有配置文件是否已更新
4. **資料遺失**: 使用備份文件恢復資料

## 支援

如果在遷移過程中遇到任何問題，請：

1. 檢查 Cloudflare Dashboard 中的資源狀態
2. 查看 `wrangler tail` 的實時日誌
3. 參考 [故障排除指南](../testing/TROUBLESHOOTING.md)
4. 聯繫技術支援團隊