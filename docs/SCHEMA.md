# D1 資料庫 Schema 文件

> 最後更新：2025-08-19
> 版本：v2.0  
> 專案：multi-channel-platform MVP

## 概述

本文件記錄 Cloudflare D1 (SQLite) 資料庫的完整 schema 結構，包含所有表格、欄位、索引和約束條件。

**17個主要表格的完整結構：**

**核心業務表格：**
- customers - 外部客戶 (平台用戶)
- conversations - 對話會話
- messages - 訊息記錄
- users - 平台用戶資料
- teams - 團隊管理
- agents - 系統內部用戶 (客服人員)
- app_users - 應用程式用戶

**檔案管理表格：**
- file_attachments - 檔案附件
- file_metadata - 檔案元資料
- file_access_logs - 檔案存取記錄

**延遲訊息功能：**
- pending_messages - 延遲訊息
- message_recall_logs - 訊息撤回記錄

**系統管理表格：**
- system_settings - 系統設定
- activities - 活動記錄 (審計日誌)

**系統內建表格：**
- d1_migrations - D1 資料庫遷移記錄
- sqlite_sequence - SQLite 序列表
- _cf_METADATA - Cloudflare 元資料表

每個表格包含：
- 所有欄位名稱、類型、約束條件
- 預設值和說明
- 外鍵關係
- 索引結構：完整的性能優化索引列表
- 版本歷史：記錄 schema 的變更歷程

## 表格結構

### 1. customers - 客戶表 (外部平台用戶)

| 欄位名 | 類型 | 約束 | 預設值 | 說明 |
|--------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 客戶ID |
| platform | TEXT | NOT NULL | - | 平台類型 |
| platform_user_id | TEXT | NOT NULL | - | 平台用戶ID |
| display_name | TEXT | - | - | 顯示名稱 |
| avatar_url | TEXT | - | - | 頭像URL |
| phone | TEXT | - | - | 電話號碼 |
| email | TEXT | - | - | 電子郵件 |
| source_team_id | INTEGER | - | - | 來源團隊ID |
| metadata | TEXT | - | - | 額外資訊 (JSON) |
| created_at | TEXT | NOT NULL | datetime('now') | 建立時間 |
| updated_at | TEXT | NOT NULL | datetime('now') | 更新時間 |

**唯一約束：** UNIQUE(platform, platform_user_id)

### 2. conversations - 對話會話表

| 欄位名 | 類型 | 約束 | 預設值 | 說明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 對話ID |
| user_id | TEXT | NOT NULL FOREIGN KEY (users.id) | - | 用戶ID |
| assigned_to | TEXT | - | - | 分配給的客服ID |
| status | TEXT | NOT NULL | 'open' | 對話狀態 |
| last_message_at | INTEGER | NOT NULL | - | 最後訊息時間 (Unix 時間戳) |
| unread_count | INTEGER | - | 0 | 未讀訊息數量 |
| created_at | INTEGER | NOT NULL | - | 建立時間 (Unix 時間戳) |
| updated_at | INTEGER | NOT NULL | - | 更新時間 (Unix 時間戳) |

### 3. messages - 訊息表

| 欄位名 | 類型 | 約束 | 預設值 | 說明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 訊息ID |
| conversation_id | TEXT | NOT NULL FOREIGN KEY (conversations.id) | - | 對話ID |
| sender_type | TEXT | NOT NULL | - | 發送者類型 |
| sender_id | TEXT | NOT NULL | - | 發送者ID |
| content | TEXT | NOT NULL | - | 訊息內容 |
| media_url | TEXT | - | - | 媒體URL |
| media_type | TEXT | - | - | 媒體類型 |
| platform | TEXT | NOT NULL | - | 平台類型 |
| created_at | INTEGER | NOT NULL | - | 建立時間 (Unix 時間戳) |
| has_attachments | BOOLEAN | - | FALSE | 是否有附件 |

### 4. users - 平台用戶表

| 欄位名 | 類型 | 約束 | 預設值 | 說明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 用戶ID |
| platform | TEXT | NOT NULL | - | 平台類型 |
| platform_user_id | TEXT | NOT NULL | - | 平台用戶ID |
| name | TEXT | NOT NULL | - | 用戶名稱 |
| avatar_url | TEXT | - | - | 頭像URL |
| created_at | INTEGER | NOT NULL | - | 建立時間 (Unix 時間戳) |

**唯一約束：** UNIQUE(platform, platform_user_id)

### 5. teams - 團隊表

| 欄位名 | 類型 | 約束 | 預設值 | 說明 |
|--------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 團隊ID |
| name | TEXT | NOT NULL | - | 團隊名稱 |
| description | TEXT | - | - | 團隊描述 |
| is_active | BOOLEAN | - | TRUE | 是否啟用 |
| created_at | TEXT | NOT NULL | datetime('now') | 建立時間 |
| updated_at | TEXT | NOT NULL | datetime('now') | 更新時間 |

### 6. agents - 客服人員表 (系統內部用戶)

| 欄位名 | 類型 | 約束 | 預設值 | 說明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 客服ID |
| email | TEXT | UNIQUE NOT NULL | - | 電子郵件 |
| password_hash | TEXT | NOT NULL | - | 密碼雜湊 |
| name | TEXT | NOT NULL | - | 客服姓名 |
| role | TEXT | NOT NULL | 'agent' | 用戶角色 |
| is_active | BOOLEAN | - | TRUE | 是否啟用 |
| created_at | INTEGER | NOT NULL | - | 建立時間 (Unix 時間戳) |
| last_active | INTEGER | - | - | 最後活動時間 (Unix 時間戳) |

### 7. app_users - 應用程式用戶表

| 欄位名 | 類型 | 約束 | 預設值 | 說明 |
|--------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 用戶ID |
| username | TEXT | UNIQUE NOT NULL | - | 用戶名 |
| email | TEXT | UNIQUE NOT NULL | - | 電子郵件 |
| password_hash | TEXT | NOT NULL | - | 密碼雜湊 |
| display_name | TEXT | NOT NULL | - | 顯示名稱 |
| role | TEXT | NOT NULL | 'agent' | 用戶角色 |
| team_id | INTEGER | - | - | 所屬團隊ID |
| is_active | BOOLEAN | - | TRUE | 是否啟用 |
| created_at | TEXT | NOT NULL | datetime('now') | 建立時間 |
| updated_at | TEXT | NOT NULL | datetime('now') | 更新時間 |

### 8. file_attachments - 檔案附件表

| 欄位名 | 類型 | 約束 | 預設值 | 說明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 附件ID |
| message_id | TEXT | NOT NULL FOREIGN KEY (messages.id) ON DELETE CASCADE | - | 訊息ID |
| conversation_id | TEXT | NOT NULL FOREIGN KEY (conversations.id) ON DELETE CASCADE | - | 對話ID |
| original_filename | TEXT | NOT NULL | - | 原始檔案名稱 |
| stored_filename | TEXT | NOT NULL | - | 存儲檔案名稱 |
| file_size | INTEGER | NOT NULL | - | 檔案大小 (bytes) |
| mime_type | TEXT | NOT NULL | - | MIME 類型 |
| file_extension | TEXT | - | - | 檔案副檔名 |
| storage_path | TEXT | NOT NULL | - | 存儲路徑 |
| storage_url | TEXT | - | - | 存儲URL |
| upload_status | TEXT | NOT NULL | 'pending' | 上傳狀態 |
| uploaded_by | TEXT | NOT NULL | - | 上傳者ID |
| created_at | INTEGER | NOT NULL | - | 建立時間 (Unix 時間戳) |
| updated_at | INTEGER | NOT NULL | - | 更新時間 (Unix 時間戳) |

### 9. file_metadata - 檔案元資料表

| 欄位名 | 類型 | 約束 | 預設值 | 說明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 元資料ID |
| attachment_id | TEXT | NOT NULL FOREIGN KEY (file_attachments.id) ON DELETE CASCADE | - | 附件ID |
| width | INTEGER | - | - | 圖片寬度 |
| height | INTEGER | - | - | 圖片高度 |
| duration | INTEGER | - | - | 音視頻時長 (秒) |
| thumbnail_url | TEXT | - | - | 縮圖URL |
| checksum | TEXT | - | - | 檔案校驗和 |
| virus_scan_status | TEXT | - | 'pending' | 病毒掃描狀態 |
| virus_scan_at | INTEGER | - | - | 病毒掃描時間 (Unix 時間戳) |
| created_at | INTEGER | NOT NULL | - | 建立時間 (Unix 時間戳) |

### 10. file_access_logs - 檔案存取記錄表

| 欄位名 | 類型 | 約束 | 預設值 | 說明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 記錄ID |
| attachment_id | TEXT | NOT NULL FOREIGN KEY (file_attachments.id) ON DELETE CASCADE | - | 附件ID |
| accessed_by | TEXT | NOT NULL | - | 存取者ID |
| access_type | TEXT | NOT NULL | - | 存取類型 |
| ip_address | TEXT | - | - | IP 地址 |
| user_agent | TEXT | - | - | 用戶代理 |
| created_at | INTEGER | NOT NULL | - | 建立時間 (Unix 時間戳) |

### 11. pending_messages - 延遲訊息表

| 欄位名 | 類型 | 約束 | 預設值 | 說明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 訊息ID |
| conversation_id | TEXT | NOT NULL FOREIGN KEY (conversations.id) ON DELETE CASCADE | - | 對話ID |
| sender_id | INTEGER | NOT NULL FOREIGN KEY (agents.id) ON DELETE CASCADE | - | 發送者ID |
| content | TEXT | NOT NULL | - | 訊息內容 |
| message_type | TEXT | NOT NULL | 'text' | 訊息類型 |
| recipient_platform_id | TEXT | NOT NULL | - | 接收者平台ID |
| platform | TEXT | NOT NULL | - | 平台類型 |
| delay_seconds | INTEGER | NOT NULL | 0 | 延遲秒數 |
| scheduled_send_time | TEXT | NOT NULL | - | 預定發送時間 |
| recall_deadline | TEXT | - | - | 撤回截止時間 |
| status | TEXT | NOT NULL | 'pending' | 訊息狀態 |
| metadata | TEXT | - | - | 額外資訊 (JSON) |
| created_at | TEXT | NOT NULL | datetime('now') | 建立時間 |
| updated_at | TEXT | NOT NULL | datetime('now') | 更新時間 |
| sent_at | TEXT | - | - | 發送時間 |
| cancelled_at | TEXT | - | - | 取消時間 |

### 12. message_recall_logs - 訊息撤回記錄表

| 欄位名 | 類型 | 約束 | 預設值 | 說明 |
|--------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 記錄ID |
| message_id | TEXT | NOT NULL FOREIGN KEY (pending_messages.id) ON DELETE CASCADE | - | 訊息ID |
| user_id | INTEGER | NOT NULL FOREIGN KEY (agents.id) ON DELETE CASCADE | - | 用戶ID |
| action | TEXT | NOT NULL | - | 操作動作 |
| reason | TEXT | - | - | 撤回原因 |
| created_at | TEXT | NOT NULL | datetime('now') | 建立時間 |

### 13. system_settings - 系統設置表

| 欄位名 | 類型 | 約束 | 預設值 | 說明 |
|--------|------|------|--------|------|
| key | TEXT | PRIMARY KEY | - | 設定鍵值 |
| value | TEXT | NOT NULL | - | 設定值 |
| created_at | TEXT | NOT NULL | datetime('now') | 建立時間 |
| updated_at | TEXT | NOT NULL | datetime('now') | 更新時間 |

### 14. activities - 活動記錄表 (審計日誌)

| 欄位名 | 類型 | 約束 | 預設值 | 說明 |
|--------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 記錄ID |
| user_id | TEXT | NOT NULL FOREIGN KEY (agents.id) | - | 用戶ID |
| user_name | TEXT | NOT NULL | - | 用戶名稱 |
| user_role | TEXT | NOT NULL | - | 用戶角色 |
| action | TEXT | NOT NULL | - | 操作動作 |
| resource_type | TEXT | NOT NULL | - | 資源類型 |
| resource_id | TEXT | - | - | 資源ID |
| details | TEXT | - | - | 詳細資訊 (JSON) |
| ip_address | TEXT | - | - | IP 地址 |
| user_agent | TEXT | - | - | 用戶代理 |
| created_at | TEXT | NOT NULL | datetime('now') | 建立時間 |

## 索引列表

### 性能優化索引

```sql
-- 對話相關索引
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_assigned ON conversations(assigned_to);
CREATE INDEX idx_conversations_status ON conversations(status);

-- 訊息相關索引
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- 檔案附件索引
CREATE INDEX idx_file_attachments_message ON file_attachments(message_id);
CREATE INDEX idx_file_attachments_conversation ON file_attachments(conversation_id);
CREATE INDEX idx_file_attachments_status ON file_attachments(upload_status);
CREATE INDEX idx_file_attachments_created ON file_attachments(created_at);

-- 檔案元資料索引
CREATE INDEX idx_file_metadata_attachment ON file_metadata(attachment_id);

-- 檔案存取記錄索引
CREATE INDEX idx_file_access_logs_attachment ON file_access_logs(attachment_id);
CREATE INDEX idx_file_access_logs_created ON file_access_logs(created_at);

-- 延遲訊息索引
CREATE INDEX idx_pending_messages_conversation ON pending_messages(conversation_id);
CREATE INDEX idx_pending_messages_sender ON pending_messages(sender_id);
CREATE INDEX idx_pending_messages_status ON pending_messages(status);
CREATE INDEX idx_pending_messages_scheduled ON pending_messages(scheduled_send_time);

-- 撤回記錄索引
CREATE INDEX idx_recall_logs_message ON message_recall_logs(message_id);
CREATE INDEX idx_recall_logs_user ON message_recall_logs(user_id);

-- 活動記錄索引
CREATE INDEX idx_activities_user ON activities(user_id);
CREATE INDEX idx_activities_action ON activities(action);
CREATE INDEX idx_activities_resource ON activities(resource_type, resource_id);
CREATE INDEX idx_activities_created ON activities(created_at);
```

## 表格關聯關係

### 主要外鍵關係

```
conversations
├── user_id → users.id
└── (referenced by messages.conversation_id)

messages
├── conversation_id → conversations.id
└── (referenced by file_attachments.message_id)

file_attachments
├── message_id → messages.id (CASCADE DELETE)
├── conversation_id → conversations.id (CASCADE DELETE)
└── (referenced by file_metadata.attachment_id)

file_metadata
└── attachment_id → file_attachments.id (CASCADE DELETE)

file_access_logs
└── attachment_id → file_attachments.id (CASCADE DELETE)

pending_messages
├── conversation_id → conversations.id (CASCADE DELETE)
└── sender_id → agents.id (CASCADE DELETE)

message_recall_logs
├── message_id → pending_messages.id (CASCADE DELETE)
└── user_id → agents.id (CASCADE DELETE)

activities
└── user_id → agents.id
```

## 系統設定預設值

當前系統設定項目：

| 設定鍵值 | 預設值 | 說明 | 分類 |
|----------|--------|------|------|
| general.systemName | Multi-Channel Support | 系統名稱 | 一般設定 |
| general.contactEmail | admin@example.com | 聯絡信箱 | 一般設定 |
| general.timezone | Asia/Taipei | 系統時區 | 一般設定 |
| general.language | zh-TW | 系統語言 | 一般設定 |
| advanced.messageQueueSize | 1000 | 訊息佇列大小 | 進階設定 |
| advanced.messageTimeout | 30 | 訊息逾時時間(秒) | 進階設定 |
| advanced.cacheExpiry | 60 | 快取過期時間(分鐘) | 進階設定 |
| advanced.sessionExpiry | 24 | 會話過期時間(小時) | 進階設定 |
| advanced.enableRateLimit | true | 啟用速率限制 | 進階設定 |
| advanced.enableLogging | true | 啟用日誌記錄 | 進階設定 |
| advanced.enableMetrics | true | 啟用效能指標 | 進階設定 |
| integrations.line.status | disconnected | LINE 整合狀態 | 平台整合 |
| integrations.facebook.status | disconnected | Facebook 整合狀態 | 平台整合 |

## 版本歷史

### v2.0 (2025-08-19)
- 新增檔案附件管理功能表格群組
  - `file_attachments` - 檔案附件
  - `file_metadata` - 檔案元資料  
  - `file_access_logs` - 檔案存取記錄
- 新增延遲訊息功能表格群組
  - `pending_messages` - 延遲訊息
  - `message_recall_logs` - 訊息撤回記錄
- 修正表格結構描述以符合實際部署狀況
- 更新索引結構和外鍵關係
- 重新整理表格分類和說明

### v1.2 (2025-02-08)
- 新增 `direction` 欄位到 `messages` 表格
- 完善會話管理功能相關欄位
- 更新索引結構

### v1.1 (2025-01-08)
- 新增 `conversation_sessions` 表格
- 新增會話管理相關欄位到 `messages` 表格
- 新增會話相關索引

### v1.0 (2025-01-08)
- 初始 schema 設計
- 建立基本表格結構
- 建立基本索引和約束

## 注意事項

1. **資料庫類型**：使用 Cloudflare D1 (基於 SQLite)
2. **字符編碼**：UTF-8
3. **時間格式**：
   - TEXT 欄位使用 ISO 8601 格式或 SQLite datetime('now') 函數
   - INTEGER 欄位使用 Unix 時間戳
4. **JSON 欄位**：metadata、details 等欄位使用 JSON 格式存儲
5. **外鍵約束**：已啟用外鍵約束檢查，部分表格使用 CASCADE DELETE
6. **索引策略**：針對常用查詢建立複合索引
7. **檔案存儲**：檔案實際存儲在 Cloudflare R2，資料庫僅存儲檔案元資料

## 維護建議

1. 定期檢查索引使用情況和查詢性能
2. 監控檔案附件存儲空間使用量
3. 定期清理過期的活動記錄和存取記錄
4. 備份重要資料和檔案附件
5. 更新此文件當 schema 變更時
6. 定期檢查病毒掃描狀態和檔案完整性
7. 監控延遲訊息的執行狀況和撤回記錄