# 應用數據庫修復腳本
# PowerShell 腳本：修復 LINE webhook 數據庫 schema 問題

Write-Host "🔧 正在應用數據庫修復..." -ForegroundColor Yellow

# 1. 為 customers 表添加 profile_updated_at 字段
Write-Host "📝 添加 profile_updated_at 字段到 customers 表..."
npx wrangler d1 execute multi-channel-platform --command="ALTER TABLE customers ADD COLUMN profile_updated_at TEXT DEFAULT (datetime('now'));"

# 2. 檢查 conversations 表狀態
Write-Host "🔍 檢查 conversations 表結構..."
npx wrangler d1 execute multi-channel-platform --command="PRAGMA table_info(conversations);"

# 3. 如果需要，重新創建 conversations 表（使用 TEXT id）
Write-Host "🗃️ 重新創建 conversations 表..."

# 備份現有 conversations 數據（如果存在）
npx wrangler d1 execute multi-channel-platform --command="CREATE TABLE IF NOT EXISTS conversations_backup AS SELECT * FROM conversations;"

# 刪除舊表
npx wrangler d1 execute multi-channel-platform --command="DROP TABLE IF EXISTS conversations;"

# 創建新表
npx wrangler d1 execute multi-channel-platform --command="CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    assigned_team_id INTEGER,
    assigned_user_id INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    last_message_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);"

# 重新創建索引
npx wrangler d1 execute multi-channel-platform --command="CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id);"
npx wrangler d1 execute multi-channel-platform --command="CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);"
npx wrangler d1 execute multi-channel-platform --command="CREATE INDEX IF NOT EXISTS idx_conversations_assigned_user ON conversations(assigned_user_id);"
npx wrangler d1 execute multi-channel-platform --command="CREATE INDEX IF NOT EXISTS idx_conversations_assigned_team ON conversations(assigned_team_id);"

# 4. 部署修復後的代碼
Write-Host "🚀 部署修復後的代碼..."
npm run deploy

Write-Host "✅ 數據庫修復完成！請測試 LINE webhook 是否正常工作。" -ForegroundColor Green

# 5. 顯示測試指示
Write-Host ""
Write-Host "📋 測試步驟："
Write-Host "1. 在 LINE 中發送訊息到您的 Bot"
Write-Host "2. 檢查 wrangler tail 日誌，應該不再看到 schema 錯誤"
Write-Host "3. 登入前端查看對話是否正常顯示"
Write-Host ""
Write-Host "🔍 監控日誌：wrangler tail --format pretty"