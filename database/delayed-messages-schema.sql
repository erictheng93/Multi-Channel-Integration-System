-- 延遲發送訊息功能資料庫結構
-- Delayed Message Feature Database Schema

-- 待發送訊息表
CREATE TABLE IF NOT EXISTS pending_messages (
    id TEXT PRIMARY KEY,                    -- 訊息 UUID
    conversation_id TEXT NOT NULL,          -- 對話 ID (修復類型不一致)
    sender_id TEXT NOT NULL,                -- 發送者 ID (agent, 修復類型不一致)
    content TEXT NOT NULL,                  -- 訊息內容
    message_type TEXT DEFAULT 'text',       -- 訊息類型 (text, image, video, audio, file)
    recipient_platform_id TEXT NOT NULL,   -- 接收者平台 ID
    platform TEXT NOT NULL,                -- 平台 (line, facebook)
    delay_seconds INTEGER NOT NULL,         -- 延遲秒數 (1-120)
    scheduled_send_time DATETIME NOT NULL,  -- 預定發送時間
    recall_deadline DATETIME NOT NULL,      -- 撤回截止時間
    status TEXT DEFAULT 'pending',          -- 狀態 (pending, sent, cancelled, failed)
    sent_at DATETIME,                       -- 實際發送時間
    cancelled_at DATETIME,                  -- 撤回時間
    metadata TEXT,                          -- JSON 格式的額外資訊
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (sender_id) REFERENCES agents(id)
);

-- 訊息撤回日誌表
CREATE TABLE IF NOT EXISTS message_recall_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,               -- 訊息 ID
    user_id TEXT NOT NULL,                  -- 操作用戶 ID (修復類型不一致)
    action TEXT NOT NULL,                   -- 操作類型 (recalled, sent, failed)
    reason TEXT,                            -- 操作原因
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (message_id) REFERENCES pending_messages(id),
    FOREIGN KEY (user_id) REFERENCES agents(id)
);

-- 索引優化
CREATE INDEX IF NOT EXISTS idx_pending_messages_conversation ON pending_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_pending_messages_sender ON pending_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_pending_messages_status ON pending_messages(status);
CREATE INDEX IF NOT EXISTS idx_pending_messages_scheduled_time ON pending_messages(scheduled_send_time);
CREATE INDEX IF NOT EXISTS idx_pending_messages_platform ON pending_messages(platform);

CREATE INDEX IF NOT EXISTS idx_recall_logs_message ON message_recall_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_recall_logs_user ON message_recall_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_recall_logs_created ON message_recall_logs(created_at);

-- 觸發器：自動更新 updated_at
CREATE TRIGGER IF NOT EXISTS update_pending_messages_timestamp 
    AFTER UPDATE ON pending_messages
    FOR EACH ROW
BEGIN
    UPDATE pending_messages 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

-- 視圖：待發送訊息詳情
CREATE VIEW IF NOT EXISTS pending_messages_detail AS
SELECT 
    pm.*,
    c.customer_id,
    cu.display_name as customer_name,
    cu.avatar_url as customer_avatar,
    u.username as sender_name,
    u.display_name as sender_display_name,
    CASE 
        WHEN pm.status = 'pending' AND datetime('now') < pm.recall_deadline THEN 1
        ELSE 0
    END as can_recall,
    CASE 
        WHEN pm.status = 'pending' THEN 
            CAST((julianday(pm.scheduled_send_time) - julianday('now')) * 86400 AS INTEGER)
        ELSE 0
    END as seconds_remaining
FROM pending_messages pm
JOIN conversations c ON pm.conversation_id = c.id
JOIN customers cu ON c.customer_id = cu.id
JOIN users u ON pm.sender_id = u.id;

-- 清理過期的已處理訊息 (保留 7 天)
-- 這個可以通過定期任務執行
-- DELETE FROM pending_messages 
-- WHERE status IN ('sent', 'cancelled', 'failed') 
-- AND updated_at < datetime('now', '-7 days');

-- 清理過期的撤回日誌 (保留 30 天)
-- DELETE FROM message_recall_logs 
-- WHERE created_at < datetime('now', '-30 days');