-- 同步本地D1資料庫結構到遠端
-- 移除廢棄的表和備份表，添加缺失的索引
-- Created: 2025-08-29

-- Step 1: 移除廢棄的 users 表
DROP TABLE IF EXISTS users;

-- Step 2: 移除備份表（遷移完成後不再需要）
DROP TABLE IF EXISTS conversations_backup;
DROP TABLE IF EXISTS messages_backup;
DROP TABLE IF EXISTS delayed_messages_backup;

-- Step 3: 添加缺失的索引 (只有表存在時才創建索引)
-- CREATE INDEX IF NOT EXISTS idx_customers_platform ON customers(platform, platform_user_id);

-- Step 4: 確保其他索引存在（防止遺漏）
CREATE UNIQUE INDEX IF NOT EXISTS agents_email_unique ON agents(email);
CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_delayed_messages_scheduled_at ON delayed_messages(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_delayed_messages_status ON delayed_messages(status);
CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_unique ON invitations(token);

-- Step 5: 確保 activities 表結構正確 (如果需要調整)
-- 目前看來結構一致，不需要修改

-- Step 6: 確保 teams 表的 is_active 欄位使用布林值
-- 目前看來結構一致，不需要修改

-- Step 7: 確保 system_settings 表結構正確
-- 目前看來結構一致，不需要修改

-- 完成同步