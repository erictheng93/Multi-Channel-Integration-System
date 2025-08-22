// 創建管理員用戶的腳本
import * as crypto from 'crypto';

// 簡單的密碼哈希函數 (生產環境建議使用 bcrypt)
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// 生成創建管理員用戶的 SQL
const adminPassword: string = 'admin123'; // 請在生產環境中使用強密碼
const hashedPassword: string = hashPassword(adminPassword);
const agentPassword: string = hashPassword('agent123');

const sql: string = `-- 創建管理員用戶
INSERT OR REPLACE INTO users (id, username, email, password_hash, role, is_active, created_at, updated_at) 
VALUES (1, 'admin', 'admin@example.com', '${hashedPassword}', 'admin', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 創建預設團隊
INSERT OR REPLACE INTO teams (id, name, description, is_active, created_at, updated_at) 
VALUES (1, '客服團隊', '預設客服團隊', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 創建測試客服用戶
INSERT OR REPLACE INTO users (id, username, email, password_hash, role, team_id, is_active, created_at, updated_at) 
VALUES (2, 'agent1', 'dacagent@dacit.net', '${agentPassword}', 'agent', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 創建一些預設標籤
INSERT OR REPLACE INTO tags (id, name, color, description, is_system) VALUES 
(1, '新客戶', '#28a745', '首次聯繫的客戶', TRUE),
(2, 'VIP', '#ffc107', '重要客戶', TRUE),
(3, '投訴', '#dc3545', '客戶投訴相關', TRUE),
(4, '諮詢', '#17a2b8', '產品或服務諮詢', TRUE),
(5, '已解決', '#6c757d', '問題已解決', TRUE),
(6, '待跟進', '#fd7e14', '需要後續跟進', TRUE);

-- 創建系統設定
INSERT OR REPLACE INTO system_settings (key, value, description, category, is_public) VALUES 
('recall_time_seconds', '15', '消息撤回猶豫時間(秒)，0-120秒', 'messaging', TRUE),
('max_file_size_mb', '50', '檔案上傳最大大小(MB)', 'files', TRUE),
('session_timeout_hours', '24', '用戶會話超時時間(小時)', 'auth', FALSE),
('max_conversations_per_agent', '50', '每個客服最大同時對話數', 'workload', FALSE),
('auto_assignment_enabled', 'true', '是否啟用自動分配', 'assignment', FALSE),
('notification_enabled', 'true', '是否啟用通知功能', 'notifications', TRUE);`;

console.log(sql);