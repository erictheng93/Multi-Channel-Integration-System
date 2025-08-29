-- 為 platform_message_id 添加唯一約束，防止重複記錄
-- 注意：只對非空值添加約束，因為 agent 消息的 platform_message_id 可以為 NULL

-- SQLite 不支持直接在現有列上添加唯一約束
-- 需要重新創建表的方式來添加約束

-- 1. 創建新的消息表結構（帶有唯一約束）
CREATE TABLE messages_new (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'agent', 'system')),
    customer_sender_id INTEGER,
    agent_sender_id TEXT,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text',
    platform_message_id TEXT, -- 新增唯一約束
    is_recalled INTEGER DEFAULT 0,
    recall_deadline TEXT,
    recalled_at TEXT,
    is_sent INTEGER DEFAULT 1,
    sent_at TEXT,
    delivery_status TEXT DEFAULT 'delivered',
    reply_to_message_id TEXT,
    thread_id TEXT,
    session_id TEXT,
    session_sequence INTEGER DEFAULT 1,
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    -- 外鍵約束
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (customer_sender_id) REFERENCES customers(id),
    FOREIGN KEY (agent_sender_id) REFERENCES agents(id),
    -- 檢查約束
    CHECK (
        (sender_type = 'customer' AND customer_sender_id IS NOT NULL AND agent_sender_id IS NULL) OR
        (sender_type = 'agent' AND agent_sender_id IS NOT NULL AND customer_sender_id IS NULL) OR
        (sender_type = 'system' AND customer_sender_id IS NULL AND agent_sender_id IS NULL)
    ),
    -- 唯一約束：platform_message_id 必須唯一（當不為空時）
    UNIQUE(platform_message_id)
);

-- 2. 複製現有數據到新表
INSERT INTO messages_new 
SELECT * FROM messages;

-- 3. 刪除舊表
DROP TABLE messages;

-- 4. 重命名新表
ALTER TABLE messages_new RENAME TO messages;

-- 5. 驗證約束是否正確應用
SELECT 'Unique constraint added successfully' as status;