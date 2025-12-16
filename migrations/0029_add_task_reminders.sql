-- 0029_add_task_reminders.sql
-- 任務提醒系統資料表

-- 創建 task_reminders 表
CREATE TABLE IF NOT EXISTS task_reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  remind_at TEXT NOT NULL,
  conversation_id TEXT,
  repeat_type TEXT DEFAULT 'none', -- none, daily, weekly, monthly
  repeat_interval INTEGER DEFAULT 0,
  is_completed INTEGER DEFAULT 0,
  is_sent INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  sent_at TEXT,
  FOREIGN KEY (user_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- 索引：按用戶和提醒時間查詢待發送的提醒
CREATE INDEX IF NOT EXISTS idx_task_reminders_user_remind
  ON task_reminders(user_id, remind_at)
  WHERE is_completed = 0 AND is_sent = 0;

-- 索引：按提醒時間查詢所有待發送的提醒 (用於 Cron Job)
CREATE INDEX IF NOT EXISTS idx_task_reminders_pending
  ON task_reminders(remind_at)
  WHERE is_completed = 0 AND is_sent = 0;

-- 索引：按對話關聯查詢
CREATE INDEX IF NOT EXISTS idx_task_reminders_conversation
  ON task_reminders(conversation_id)
  WHERE conversation_id IS NOT NULL;
