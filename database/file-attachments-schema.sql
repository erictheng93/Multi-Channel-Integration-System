-- 檔案附件資料庫結構
-- 專案名稱：Multi-Channel Support MVP
-- 檔案路徑：/database/file-attachments-schema.sql
-- Created by: Database Designer

-- 檔案附件表
CREATE TABLE IF NOT EXISTS file_attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    file_extension TEXT,
    storage_path TEXT NOT NULL,
    storage_url TEXT,
    upload_status TEXT NOT NULL DEFAULT 'pending', -- pending, uploaded, failed, deleted
    uploaded_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- 檔案元數據表（用於存儲額外的檔案資訊）
CREATE TABLE IF NOT EXISTS file_metadata (
    id TEXT PRIMARY KEY,
    attachment_id TEXT NOT NULL,
    width INTEGER, -- 圖片寬度
    height INTEGER, -- 圖片高度
    duration INTEGER, -- 音視頻時長（秒）
    thumbnail_url TEXT, -- 縮圖URL
    checksum TEXT, -- 檔案校驗和
    virus_scan_status TEXT DEFAULT 'pending', -- pending, clean, infected, error
    virus_scan_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (attachment_id) REFERENCES file_attachments(id) ON DELETE CASCADE
);

-- 檔案存取記錄表（用於追蹤檔案下載）
CREATE TABLE IF NOT EXISTS file_access_logs (
    id TEXT PRIMARY KEY,
    attachment_id TEXT NOT NULL,
    accessed_by TEXT NOT NULL,
    access_type TEXT NOT NULL, -- download, view, thumbnail
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (attachment_id) REFERENCES file_attachments(id) ON DELETE CASCADE
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_file_attachments_message ON file_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_conversation ON file_attachments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_status ON file_attachments(upload_status);
CREATE INDEX IF NOT EXISTS idx_file_attachments_created ON file_attachments(created_at);
CREATE INDEX IF NOT EXISTS idx_file_metadata_attachment ON file_metadata(attachment_id);
CREATE INDEX IF NOT EXISTS idx_file_access_logs_attachment ON file_access_logs(attachment_id);
CREATE INDEX IF NOT EXISTS idx_file_access_logs_created ON file_access_logs(created_at);

-- 更新 messages 表以支援檔案附件
-- 添加 has_attachments 欄位來快速查詢是否有附件
ALTER TABLE messages ADD COLUMN has_attachments BOOLEAN DEFAULT FALSE;

-- 建立觸發器來自動更新 has_attachments 欄位
CREATE TRIGGER IF NOT EXISTS update_message_attachments_insert
    AFTER INSERT ON file_attachments
    FOR EACH ROW
    BEGIN
        UPDATE messages 
        SET has_attachments = TRUE 
        WHERE id = NEW.message_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_message_attachments_delete
    AFTER DELETE ON file_attachments
    FOR EACH ROW
    BEGIN
        UPDATE messages 
        SET has_attachments = (
            SELECT COUNT(*) > 0 
            FROM file_attachments 
            WHERE message_id = OLD.message_id
        )
        WHERE id = OLD.message_id;
    END;