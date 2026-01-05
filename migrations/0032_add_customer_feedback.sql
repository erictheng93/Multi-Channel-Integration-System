-- 0032_add_customer_feedback.sql
-- 客户满意度反馈系统资料表

-- 创建 customer_feedback 表
CREATE TABLE IF NOT EXISTS customer_feedback (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  customer_id INTEGER NOT NULL,
  agent_id TEXT,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  comment TEXT,
  feedback_type TEXT DEFAULT 'satisfaction', -- satisfaction, service_quality, response_time
  metadata TEXT, -- JSON 存储额外信息
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

-- 索引：按对话查询反馈
CREATE INDEX IF NOT EXISTS idx_customer_feedback_conversation
  ON customer_feedback(conversation_id);

-- 索引：按客户查询反馈历史
CREATE INDEX IF NOT EXISTS idx_customer_feedback_customer
  ON customer_feedback(customer_id);

-- 索引：按客服查询服务评分
CREATE INDEX IF NOT EXISTS idx_customer_feedback_agent
  ON customer_feedback(agent_id)
  WHERE agent_id IS NOT NULL;

-- 索引：按时间范围查询反馈（用于统计）
CREATE INDEX IF NOT EXISTS idx_customer_feedback_created_at
  ON customer_feedback(created_at);

-- 索引：按评分查询（用于满意度统计）
CREATE INDEX IF NOT EXISTS idx_customer_feedback_rating
  ON customer_feedback(rating, created_at);

-- 索引：按反馈类型查询
CREATE INDEX IF NOT EXISTS idx_customer_feedback_type
  ON customer_feedback(feedback_type, created_at);
