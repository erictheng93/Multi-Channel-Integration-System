-- 清理重複的 platform_message_id 消息
-- 保留每個 platform_message_id 的最新消息（基於 created_at）

-- 創建臨時表來保存需要保留的消息 ID
CREATE TEMP TABLE messages_to_keep AS
SELECT 
    m1.id
FROM messages m1
INNER JOIN (
    SELECT 
        platform_message_id,
        MAX(created_at) as max_created_at
    FROM messages 
    WHERE platform_message_id IS NOT NULL
    GROUP BY platform_message_id
) m2 ON m1.platform_message_id = m2.platform_message_id 
    AND m1.created_at = m2.max_created_at
WHERE m1.platform_message_id IS NOT NULL;

-- 刪除重複的消息（保留最新的）
DELETE FROM messages 
WHERE platform_message_id IS NOT NULL 
AND id NOT IN (SELECT id FROM messages_to_keep);

-- 清理臨時表
DROP TABLE messages_to_keep;

-- 顯示清理後的統計
SELECT 
    'Cleanup completed' as status,
    COUNT(*) as total_messages,
    COUNT(DISTINCT platform_message_id) as unique_platform_messages,
    (COUNT(*) - COUNT(DISTINCT platform_message_id)) as remaining_duplicates
FROM messages 
WHERE platform_message_id IS NOT NULL;