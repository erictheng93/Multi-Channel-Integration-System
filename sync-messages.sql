-- Sync messages data from remote to local
DELETE FROM messages;

INSERT OR REPLACE INTO messages (id, conversation_id, sender_type, customer_sender_id, agent_sender_id, content, message_type, platform_message_id, is_recalled, recall_deadline, recalled_at, is_sent, sent_at, delivery_status, reply_to_message_id, thread_id, session_id, session_sequence, metadata, created_at)
VALUES 
('d4eca41d-6955-4c32-9d66-dd7e41ccb4b6', '2f11b76c-672b-461f-9eca-e799cd54f0aa', 'customer', 1, null, '測試測試，測試輸入', 'text', '576487572277297642', 0, null, null, 1, null, 'delivered', null, null, null, 1, null, '2025-08-29 13:20:59'),
('4dfd12b2-9055-4ecd-8c44-953280c83c12', '2f11b76c-672b-461f-9eca-e799cd54f0aa', 'customer', 1, null, 'Boom', 'text', '576490338705736085', 0, null, null, 1, null, 'delivered', null, null, null, 1, null, '2025-08-29 13:45:24'),
('a2ace7fd-3957-4ce3-bbee-9379122e29bf', '2f11b76c-672b-461f-9eca-e799cd54f0aa', 'customer', 1, null, '哈咯哈咯', 'text', '576495480452677685', 0, null, null, 1, null, 'delivered', null, null, null, 1, null, '2025-08-29 14:36:28'),
('94a38b93-e6f7-4b9b-8ac4-74fb3765bd91', '2f11b76c-672b-461f-9eca-e799cd54f0aa', 'customer', 1, null, '測試測試，測試輸入', 'text', '576495569909579896', 0, null, null, 1, null, 'delivered', null, null, null, 1, null, '2025-08-29 14:37:21'),
('0d580ca0-45ca-404c-8530-6413bbee38be', '2f11b76c-672b-461f-9eca-e799cd54f0aa', 'customer', 1, null, '測試測試，測試輸入', 'text', '576501460541112764', 0, null, null, 1, null, 'delivered', null, null, null, 1, null, '2025-08-29 15:47:14'),
('08b8b20d-35e3-4729-a549-50d36635443f', '2f11b76c-672b-461f-9eca-e799cd54f0aa', 'customer', 1, null, 'Try and try', 'text', '576507398097731815', 0, null, null, 1, null, 'delivered', null, null, null, 1, null, '2025-08-29 08:41:56'),
('a8385f45-6555-4443-90a6-d687995b8b51', '2f11b76c-672b-461f-9eca-e799cd54f0aa', 'customer', 1, null, '你好你好', 'text', '576511440265937400', 0, null, null, 1, null, 'delivered', null, null, null, 1, null, '2025-08-29 09:16:03'),
('bc2e129f-0441-40c9-a2a2-7234296716b4', '2f11b76c-672b-461f-9eca-e799cd54f0aa', 'customer', 1, null, '有錢真好', 'text', '576517236106985830', 0, null, null, 1, null, 'delivered', null, null, null, 1, null, '2025-08-29T10:16:43.873Z'),
('63e34ba3-09e3-45bb-8983-352aa0b44dbe', '2f11b76c-672b-461f-9eca-e799cd54f0aa', 'customer', 1, null, '來來', 'text', '576517868977127544', 0, null, null, 1, null, 'delivered', null, null, null, 1, null, '2025-08-29T10:20:56.904Z'),
('434895c9-6ffc-452d-be27-04905a7c9935', '2f11b76c-672b-461f-9eca-e799cd54f0aa', 'customer', 1, null, '哈哈哈', 'text', '576519326917197911', 0, null, null, 1, null, 'delivered', null, null, null, 1, null, '2025-08-29T10:33:21.933Z'),
('d90dd538-85ec-46ca-b581-716ce6feb706', '2f11b76c-672b-461f-9eca-e799cd54f0aa', 'customer', 1, null, '20250901\n第一次測試', 'text', '576908320644792981', 0, null, null, 1, null, 'delivered', null, null, null, 1, null, '2025-09-01T02:57:40.160Z');