PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO d1_migrations VALUES(7,'0000_charming_chimera.sql','2025-08-28 09:29:28');
INSERT INTO d1_migrations VALUES(8,'0001_perfect_klaw.sql','2025-08-28 09:29:28');
INSERT INTO d1_migrations VALUES(9,'0005_change_conversation_id_to_string.sql','2025-08-29 04:33:00');
INSERT INTO d1_migrations VALUES(10,'0005_safe_conversation_id_migration.sql','2025-08-29 04:33:00');
INSERT INTO d1_migrations VALUES(11,'0006_fix_customers_schema.sql','2025-08-29 04:33:01');
INSERT INTO d1_migrations VALUES(12,'0006_sync_local_to_remote.sql','2025-08-29 04:33:01');
INSERT INTO d1_migrations VALUES(13,'0008_final_schema_optimization.sql','2025-08-29 08:24:58');
INSERT INTO d1_migrations VALUES(14,'0009_timezone_unification_asia_taipei.sql','2025-08-29 08:25:41');
CREATE TABLE `teams` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `qr_code` text,
  `is_active` integer DEFAULT 1,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE `agents` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `password_hash` text NOT NULL,
  `display_name` text NOT NULL,
  `role` text DEFAULT 'agent' NOT NULL,
  `team_id` integer,
  `is_active` integer DEFAULT 1,
  `password_policy` text DEFAULT 'changeable',
  `last_login_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
INSERT INTO agents VALUES('admin-001','admin@dacit.net','$2a$12$Vq82F1W2Ci4BmT/84yllnuW6xqS8BaklBzy34Ld4yX2JN2cP3aCm.','System Administration','admin',NULL,1,'changeable','2025-09-03T01:08:54.694Z','2024-01-01 14:00:00','2025-08-28 13:18:55');
INSERT INTO agents VALUES('agent-001','dacagent@dacit.net','$2a$10$PaXU0LpRHUbrs33zdox7XeVJIf.uIiVwCkqzRfMhjKHLOASn7D3U2','dacagent','agent',NULL,1,'changeable',NULL,'2024-01-01 14:00:00','2025-08-28 14:17:15');
INSERT INTO agents VALUES('test-user-001','testuser@dacit.net','\a\0\.NAf6anhhER3C4GQGuaOAIIAc1HZbIUd.HIyOvAkEoNA2sZWf9K','Test User For API','admin',NULL,1,'changeable',NULL,'2025-09-02 11:25:00','2025-09-02 11:25:00');
CREATE TABLE `file_attachments` (
  `id` text PRIMARY KEY NOT NULL,
  `message_id` text NOT NULL,
  `file_name` text NOT NULL,
  `file_type` text NOT NULL,
  `file_size` integer,
  `r2_key` text NOT NULL,
  `url` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `customers` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `platform` TEXT NOT NULL,
  `platform_user_id` TEXT NOT NULL,
  `display_name` TEXT,
  `avatar_url` TEXT,
  `phone` TEXT,
  `email` TEXT,
  `source_team_id` INTEGER,
  `metadata` TEXT,
  `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, profile_updated_at DATETIME DEFAULT NULL, profile_data TEXT DEFAULT NULL,
  UNIQUE(`platform`, `platform_user_id`)
);
INSERT INTO customers VALUES(1,'line','U7aed23323b315b35ed5dfc7226ff0522','Eric Vrataski 十方','https://sprofile.line-scdn.net/0hO6-FzyvCEBkAPwJbh4duZnBvE3MjTkkLfAtdfDM8SX46X1YbLlEPKmE_SSg6DF4YeA1cemZtSXwMLGd_HmnsLQcPTSg8CV5LKVlb-g',NULL,NULL,NULL,NULL,'2025-08-25 17:06:32','2025-09-03T01:19:06.593Z','2025-08-29 04:33:01',NULL);
INSERT INTO customers VALUES(3,'line','U892236cb4e4d92ba5bb50bb422c9fba7','PJ','https://sprofile.line-scdn.net/0hshBebZnILEdvHDK4s95SeR9MLy1MbXVVRXozcVMcJXVbLDsVRnljIV8ac3RaJGgYQXxnIFlIdnNNTQtxFywidVNcLjIUcnd3QXIidwlVCicCZyBiRhkhVA1kIj8EZw5hQAc2fSIABSkEeGlUIC8WehhnOQwofyBNQktAEWouQsQAHlsSQntlKF4ZcnPX',NULL,NULL,NULL,NULL,'2025-09-03T01:33:27.186Z','2025-09-03T01:33:27.186Z',NULL,NULL);
CREATE TABLE `system_settings` (
  `key` TEXT PRIMARY KEY,
  `value` TEXT NOT NULL,
  `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO system_settings VALUES('general.systemName','Multi-Channel Support','2025-08-19 10:45:37','2025-08-19 10:45:37');
INSERT INTO system_settings VALUES('general.contactEmail','admin@example.com','2025-08-19 10:45:37','2025-08-19 10:45:37');
INSERT INTO system_settings VALUES('general.timezone','Asia/Taipei','2025-08-19 10:45:37','2025-08-19 10:45:37');
INSERT INTO system_settings VALUES('general.language','zh-TW','2025-08-19 10:45:37','2025-08-19 10:45:37');
INSERT INTO system_settings VALUES('advanced.messageQueueSize','1000','2025-08-19 10:45:37','2025-08-19 10:45:37');
INSERT INTO system_settings VALUES('advanced.messageTimeout','30','2025-08-19 10:45:37','2025-08-19 10:45:37');
INSERT INTO system_settings VALUES('advanced.cacheExpiry','60','2025-08-19 10:45:37','2025-08-19 10:45:37');
INSERT INTO system_settings VALUES('advanced.sessionExpiry','24','2025-08-19 10:45:37','2025-08-19 10:45:37');
INSERT INTO system_settings VALUES('advanced.enableRateLimit','true','2025-08-19 10:45:37','2025-08-19 10:45:37');
INSERT INTO system_settings VALUES('advanced.enableLogging','true','2025-08-19 10:45:37','2025-08-19 10:45:37');
INSERT INTO system_settings VALUES('advanced.enableMetrics','true','2025-08-19 10:45:37','2025-08-19 10:45:37');
INSERT INTO system_settings VALUES('integrations.line.status','disconnected','2025-08-19 10:45:37','2025-08-19 10:45:37');
INSERT INTO system_settings VALUES('integrations.facebook.status','disconnected','2025-08-19 10:45:37','2025-08-19 10:45:37');
INSERT INTO system_settings VALUES('timezone_test','Asia/Taipei','2025-08-29 08:25:41','2025-08-29 08:25:41');
CREATE TABLE `activities` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `user_id` TEXT NOT NULL,
  `user_name` TEXT NOT NULL,
  `user_role` TEXT NOT NULL,
  `action` TEXT NOT NULL,
  `resource_type` TEXT NOT NULL,
  `resource_id` TEXT,
  `details` TEXT,
  `ip_address` TEXT,
  `user_agent` TEXT,
  `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO activities VALUES(15,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"HdqPAkKowIrVLW6sulwSsZe4ToIBEmSf"}',NULL,'curl/8.14.1','2025-08-28 11:39:46');
INSERT INTO activities VALUES(16,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"FSSc2cvwVVhWL7UfpJA8m0TmnZCV1Tl1"}',NULL,'curl/8.14.1','2025-08-28 11:53:34');
INSERT INTO activities VALUES(17,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"RO6c9Cu602yaowYoF7L3RuC8PLh11052"}',NULL,'node','2025-08-28 13:20:33');
INSERT INTO activities VALUES(18,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"qbbTxBGQ6a66kH7LqzLKEBXbdkBxQL8F"}',NULL,'node','2025-08-28 13:41:00');
INSERT INTO activities VALUES(19,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"jPDYkaU8NmhFQZDW1JPt5sZ6jkrsMkrZ"}',NULL,'node','2025-08-28 13:45:28');
INSERT INTO activities VALUES(20,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"YeZNJmPKSpcv3IWqRLUbQeJDk2JlLMpY"}',NULL,'node','2025-08-28 13:47:43');
INSERT INTO activities VALUES(21,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"z08rTKh8m5tN5myXGpRyr6wLaNm2VnRf"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-28 13:50:00');
INSERT INTO activities VALUES(22,'admin-001','Admin','admin','team_member_update','team','test-agent-001','{"memberName":"Test User","memberEmail":"test@dacit.net","roleChange":{"from":"admin","to":"agent"}}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-28 13:51:02');
INSERT INTO activities VALUES(23,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"69fNYgZKXSrrtSAAw0E4dfwECOCPHACM"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-28 13:54:45');
INSERT INTO activities VALUES(24,'admin-001','Admin','admin','team_member_update','team','test-agent-001','{"memberName":"Test User","memberEmail":"test@dacit.net","roleChange":{"from":"agent","to":"admin"}}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-28 13:54:59');
INSERT INTO activities VALUES(25,'admin-001','Admin','admin','team_member_update','team','agent-001','{"memberName":"dacagent","memberEmail":"dacagent@dacit.net","roleChange":{"from":"agent","to":"admin"}}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-28 13:55:01');
INSERT INTO activities VALUES(26,'admin-001','Admin','admin','team_member_update','team','test-agent-001','{"memberName":"Test User","memberEmail":"test@dacit.net","roleChange":{"from":"admin","to":"agent"}}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-28 13:56:13');
INSERT INTO activities VALUES(27,'admin-001','Admin','admin','team_member_update','team','agent-001','{"memberName":"dacagent","memberEmail":"dacagent@dacit.net","roleChange":{"from":"admin","to":"agent"}}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-28 13:56:16');
INSERT INTO activities VALUES(28,'admin-001','Admin','admin','team_member_update','team','test-agent-001','{"memberName":"Test User","memberEmail":"test@dacit.net","roleChange":{"from":"agent","to":"admin"}}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-28 14:16:49');
INSERT INTO activities VALUES(29,'admin-001','Admin','admin','team_member_update','team','agent-001','{"memberName":"dacagent","memberEmail":"dacagent@dacit.net","roleChange":{"from":"agent","to":"admin"}}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-28 14:16:51');
INSERT INTO activities VALUES(30,'admin-001','Admin','admin','team_member_update','team','test-agent-001','{"memberName":"Test User","memberEmail":"test@dacit.net","memberRole":"admin","action":"password_reset_with_policy","policy":"changeable"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-28 14:17:04');
INSERT INTO activities VALUES(31,'admin-001','Admin','admin','team_member_update','team','agent-001','{"memberName":"dacagent","memberEmail":"dacagent@dacit.net","memberRole":"admin","action":"password_reset_with_policy","policy":"changeable"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-28 14:17:15');
INSERT INTO activities VALUES(32,'admin-001','Admin','admin','team_member_update','team','test-agent-001','{"memberName":"Test User","memberEmail":"test@dacit.net","roleChange":{"from":"admin","to":"agent"}}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-28 14:17:27');
INSERT INTO activities VALUES(33,'admin-001','Admin','admin','team_member_update','team','agent-001','{"memberName":"dacagent","memberEmail":"dacagent@dacit.net","roleChange":{"from":"admin","to":"agent"}}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-28 14:17:29');
INSERT INTO activities VALUES(34,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"TOxIWhab7sgPa6D31q7sBpfwBnCtCC8E"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-28 21:08:29');
INSERT INTO activities VALUES(35,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"bWGZuNPxZzGOrCLHY890ge1KGzeEzHgf"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-28 21:13:01');
INSERT INTO activities VALUES(36,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"PGA5A8yw7573WcyihAcHkQ7EP9O3Nku0"}','223.138.139.232','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-28 21:14:04');
INSERT INTO activities VALUES(37,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"UNe5kJbZipew8GeO4QqQd0mPiIPXknmv"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-29 08:56:23');
INSERT INTO activities VALUES(38,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"f7xQg4X4Kfv2sjZrQ9s1Et3E6pcWj6c3"}','59.125.7.7','curl/8.14.1','2025-08-29 11:04:20');
INSERT INTO activities VALUES(39,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"wiOBZhC3UkqZYkx5Xqx2jLPVz53LRLwR"}','59.125.7.7','curl/8.14.1','2025-08-29 11:19:16');
INSERT INTO activities VALUES(40,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"UNHi3OwJ9pNMzEH5ZVHLyAylSZ0msU6D"}','59.125.7.7','curl/8.14.1','2025-08-29 11:33:19');
INSERT INTO activities VALUES(41,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"o7n69GS86xQhUURvpSmb4NztPwU3CwT4"}','59.125.7.7','curl/8.14.1','2025-08-29 11:34:43');
INSERT INTO activities VALUES(42,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"6C7QeDjClYUDAqx40yP1rwkzxZZtwcuk"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-29 11:40:52');
INSERT INTO activities VALUES(43,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"5xUOoZILxWOeq8u5smGL6DO9TD3YhqNO"}','59.125.7.7','curl/8.14.1','2025-08-29 11:47:32');
INSERT INTO activities VALUES(44,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"sonJY4nDyxcHPqPg3Eu0j4UGYBfCEKAN"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-29 12:08:05');
INSERT INTO activities VALUES(45,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"d4eca41d-6955-4c32-9d66-dd7e41ccb4b6","content":"測試測試，測試輸入"}',NULL,NULL,'2025-08-29 13:20:59');
INSERT INTO activities VALUES(46,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"055cff9c-e271-4cbb-9b91-cfd4038981c4","content":"測試測試，測試輸入"}',NULL,NULL,'2025-08-29 13:21:46');
INSERT INTO activities VALUES(47,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"4dfd12b2-9055-4ecd-8c44-953280c83c12","content":"Boom"}',NULL,NULL,'2025-08-29 13:45:24');
INSERT INTO activities VALUES(48,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"FzEDN36hJ83ha9CNKcYohjJFZ6vs9DRF"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-29 13:55:09');
INSERT INTO activities VALUES(49,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"SvlZukaj9oopS7dBccTqDtyuiJts50BN"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-29 14:02:49');
INSERT INTO activities VALUES(50,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"Gy1WZsS6epMDY15z0GqS8gTRtByTsCM2"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-29 14:13:23');
INSERT INTO activities VALUES(51,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"a2ace7fd-3957-4ce3-bbee-9379122e29bf","content":"哈咯哈咯"}',NULL,NULL,'2025-08-29 14:36:28');
INSERT INTO activities VALUES(52,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"94a38b93-e6f7-4b9b-8ac4-74fb3765bd91","content":"測試測試，測試輸入"}',NULL,NULL,'2025-08-29 14:37:21');
INSERT INTO activities VALUES(53,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"FJlup63h7nhOibOvM1gP23lR8wIIFyBI"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-29 14:45:50');
INSERT INTO activities VALUES(54,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"be517abc-2962-4f05-b890-35a8c1d3ee27","content":"測試測試，測試輸入"}',NULL,NULL,'2025-08-29 15:35:52');
INSERT INTO activities VALUES(55,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"cd6e5d68-17f2-4b2f-9555-5425133e7402","content":"測試測試，測試輸入"}',NULL,NULL,'2025-08-29 15:36:54');
INSERT INTO activities VALUES(56,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"64a28f24-9a54-4989-a37b-019e09762fb7","content":"測試測試，測試輸入"}',NULL,NULL,'2025-08-29 15:37:56');
INSERT INTO activities VALUES(57,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"3249e7ba-0317-408a-94ad-232da1fa1172","content":"測試測試，測試輸入"}',NULL,NULL,'2025-08-29 15:38:59');
INSERT INTO activities VALUES(58,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"d9176cbf-5294-46ed-b1fe-80f414b6195b","content":"測試測試，測試輸入"}',NULL,NULL,'2025-08-29 15:40:01');
INSERT INTO activities VALUES(59,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"3d58d07c-2b8b-4b55-b7a9-fab7e476a510","content":"測試測試，測試輸入"}',NULL,NULL,'2025-08-29 15:41:03');
INSERT INTO activities VALUES(60,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"30f0b46e-d3b4-4ef5-b298-bf0475e70a1c","content":"測試測試，測試輸入"}',NULL,NULL,'2025-08-29 15:42:05');
INSERT INTO activities VALUES(61,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"5be4e45a-580b-4514-a060-b3708a57801e","content":"測試測試，測試輸入"}',NULL,NULL,'2025-08-29 15:43:07');
INSERT INTO activities VALUES(62,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"98a11ddb-8742-4341-a9c5-32c184d9d0ce","content":"測試測試，測試輸入"}',NULL,NULL,'2025-08-29 15:44:09');
INSERT INTO activities VALUES(63,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"d2f14b87-d78f-489a-8759-30ed1d3f97a4","content":"測試測試，測試輸入"}',NULL,NULL,'2025-08-29 15:45:11');
INSERT INTO activities VALUES(64,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"161005f7-8922-4c42-af8f-3f439cb0857f","content":"測試測試，測試輸入"}',NULL,NULL,'2025-08-29 15:46:13');
INSERT INTO activities VALUES(65,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"0d580ca0-45ca-404c-8530-6413bbee38be","content":"測試測試，測試輸入"}',NULL,NULL,'2025-08-29 15:47:15');
INSERT INTO activities VALUES(66,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"08b8b20d-35e3-4729-a549-50d36635443f","content":"Try and try"}',NULL,NULL,'2025-08-29 08:41:56');
INSERT INTO activities VALUES(67,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"609c773c-202b-4463-a6ed-d6ba68ecb471","content":"你好你好"}',NULL,NULL,'2025-08-29 09:15:01');
INSERT INTO activities VALUES(68,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"a8385f45-6555-4443-90a6-d687995b8b51","content":"你好你好"}',NULL,NULL,'2025-08-29 09:16:03');
INSERT INTO activities VALUES(69,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"7fdeb770-4c81-48d6-b3ef-a5b7b8a2f205","content":"有錢真好"}',NULL,NULL,'2025-08-29 10:12:35');
INSERT INTO activities VALUES(70,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"74e4a564-155b-417d-a1ef-aee0d0826fd0","content":"有錢真好"}',NULL,NULL,'2025-08-29 10:13:38');
INSERT INTO activities VALUES(71,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"57c528eb-4e68-498c-b0fb-9282cee9aa09","content":"有錢真好"}',NULL,NULL,'2025-08-29T10:14:40.462Z');
INSERT INTO activities VALUES(72,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"f5048d31-54c2-4c25-be63-a3c6594b0477","content":"有錢真好"}',NULL,NULL,'2025-08-29T10:15:42.070Z');
INSERT INTO activities VALUES(73,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"bc2e129f-0441-40c9-a2a2-7234296716b4","content":"有錢真好"}',NULL,NULL,'2025-08-29T10:16:43.984Z');
INSERT INTO activities VALUES(74,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"aae13c82-55cd-4b7d-826b-113f9b4f9b73","content":"來來"}',NULL,NULL,'2025-08-29T10:18:53.167Z');
INSERT INTO activities VALUES(75,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"ea2a35dc-3912-4dc4-92e7-5885d27c12ee","content":"來來"}',NULL,NULL,'2025-08-29T10:19:55.075Z');
INSERT INTO activities VALUES(76,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"63e34ba3-09e3-45bb-8983-352aa0b44dbe","content":"來來"}',NULL,NULL,'2025-08-29T10:20:57.005Z');
INSERT INTO activities VALUES(77,'test-agent-001','Test User','agent','user_login','user','test-agent-001','{"loginMethod":"email","sessionId":"WrFkAJYexgFRETVC5mqhQVUGSqFf6WV5"}','59.125.7.7','curl/8.14.1','2025-08-29T10:31:29.227Z');
INSERT INTO activities VALUES(78,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"434895c9-6ffc-452d-be27-04905a7c9935","content":"哈哈哈"}',NULL,NULL,'2025-08-29T10:33:22.057Z');
INSERT INTO activities VALUES(79,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"tk1xOa1Aw03Kx8NZP7fhQnZkojTNTg5G"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-01T01:20:40.375Z');
INSERT INTO activities VALUES(80,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"uN7OElY2XBRmF6ZekylZPjYhSctv2Hve"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-01T01:45:10.321Z');
INSERT INTO activities VALUES(81,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"I1uNZrFUupQNAazNZq9ADRLSZhQexuc8"}','59.125.7.7','curl/8.14.1','2025-09-01T01:56:50.817Z');
INSERT INTO activities VALUES(82,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"voyaReFflPkSBQM16MXdMald4FSSKpJF"}','59.125.7.7','curl/8.14.1','2025-09-01T02:03:59.088Z');
INSERT INTO activities VALUES(83,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"81WHHuX0AtuvhKX5beggEia2zCfEe1Xg"}','59.125.7.7','curl/8.14.1','2025-09-01T02:05:58.550Z');
INSERT INTO activities VALUES(84,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"cDxQR8L3GqKhGL3A8seULCNsGBBLkWYE"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-01T02:06:31.206Z');
INSERT INTO activities VALUES(85,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"uJVK6FwwPTfiPVgGHq3UMwmnWkcHIFPj"}','59.125.7.7','curl/8.14.1','2025-09-01T02:07:33.231Z');
INSERT INTO activities VALUES(86,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"0gdPOufyYdKjytHnYauUyltcXBNBjm2x"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-01T02:09:05.665Z');
INSERT INTO activities VALUES(87,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"vQxUEpJGK5qtp5XZBbESUQMPUGHP5zWq"}','59.125.7.7','curl/8.14.1','2025-09-01T02:09:49.209Z');
INSERT INTO activities VALUES(88,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"81SWnB4KCK0SxpgrbZLxzQT7g4FVLsVT"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-01T02:11:36.929Z');
INSERT INTO activities VALUES(89,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"BFt73RpAkhuEWs1SSbKDCpiAsazYFry2"}','59.125.7.7','Mozilla/5.0 (Windows NT; Windows NT 10.0; zh-TW) WindowsPowerShell/5.1.26100.5074','2025-09-01T02:24:53.639Z');
INSERT INTO activities VALUES(90,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"R9eifCGvHPAQtNsZiD7wtSvRqy6AAHEd"}','59.125.7.7','Mozilla/5.0 (Windows NT; Windows NT 10.0; zh-TW) WindowsPowerShell/5.1.26100.5074','2025-09-01T02:26:13.531Z');
INSERT INTO activities VALUES(91,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"x8bbJQ8rFeLXaB6ugV2BVEZYXUW3Tc1h"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-01T02:30:15.203Z');
INSERT INTO activities VALUES(92,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"d90dd538-85ec-46ca-b581-716ce6feb706","content":"20250901\n第一次測試"}',NULL,NULL,'2025-09-01T02:57:40.274Z');
INSERT INTO activities VALUES(93,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"VmIMkaNlFNVKaZtxaCJbpx9LL5pub14c"}','59.125.7.7','curl/8.14.1','2025-09-01T03:09:33.510Z');
INSERT INTO activities VALUES(94,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"Stq2ovmaMTL7p5FqnkHnqStL2tdZ3SgQ"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-01T03:12:32.571Z');
INSERT INTO activities VALUES(95,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"uHXUhqHkncPSP67JpiVWZspryt6385HY"}','59.125.7.7','curl/8.14.1','2025-09-01T03:22:12.256Z');
INSERT INTO activities VALUES(96,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"5K9cnMZfdQrLIwJ2jEkIx92R5RPf53tL"}','59.125.7.7','curl/8.14.1','2025-09-01T03:24:34.832Z');
INSERT INTO activities VALUES(97,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"e3NTBZ8yZX7y0AQt8Op4A5QuwaESn1Hq"}','59.125.7.7','curl/8.14.1','2025-09-01T03:25:12.021Z');
INSERT INTO activities VALUES(98,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"JJH3GIIiJgAa9nJgWAbEdx9fTEdri5Sf"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-01T03:25:29.753Z');
INSERT INTO activities VALUES(99,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"DYVD7KeuKSVimiY8u8BAwJk94Pip67v4"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-01T03:26:29.015Z');
INSERT INTO activities VALUES(100,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"nczaxsifD95bZ2kT6MWxZ8d8MWJfIgku"}','59.125.7.7','curl/8.14.1','2025-09-01T04:05:16.971Z');
INSERT INTO activities VALUES(101,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"nF7RcLnMPcYM7UR67OM4VTY7Os4ObOe7"}','59.125.7.7','curl/8.14.1','2025-09-01T04:06:49.901Z');
INSERT INTO activities VALUES(102,'admin-001','System Administration','admin','user_logout','user','admin-001','{"logoutMethod":"httpOnly_cookies"}','59.125.7.7','curl/8.14.1','2025-09-01T04:08:08.419Z');
INSERT INTO activities VALUES(103,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"zvrQQFCNsVnxoTKDBDfA9WZkOZfcZRBR"}',NULL,'curl/8.14.1','2025-09-01T05:36:17.412Z');
INSERT INTO activities VALUES(104,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"yEA6ibxnsKEt58ilEekyIcf1rA7eGOHO"}',NULL,'curl/8.14.1','2025-09-01T05:37:02.367Z');
INSERT INTO activities VALUES(105,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"Z8VPZ4WGIfO9neC7OfFYLYM26I4gUhit"}',NULL,'curl/8.14.1','2025-09-01T05:37:57.459Z');
INSERT INTO activities VALUES(106,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"a9qjxkq6vP7aPcNFANQivxd0kLWrohjG"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-01T08:03:55.051Z');
INSERT INTO activities VALUES(107,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"3kP5envHLzWL0kMjuUX5MdwFAj1DT037"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-01T08:11:45.548Z');
INSERT INTO activities VALUES(108,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"AdbAGkE4vxohG1FTpAGmmhJE7p5Xj7ro"}','59.125.7.7','curl/8.14.1','2025-09-01T08:26:51.532Z');
INSERT INTO activities VALUES(109,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"oNnoVGlNaW2RpbuwoHxdjh1IjRfLmM38"}','59.125.7.7','curl/8.14.1','2025-09-01T08:35:42.842Z');
INSERT INTO activities VALUES(110,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"tJeWIna3nhoTKDMw3W7uES8A9M7gq4Nh"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-01T08:47:22.539Z');
INSERT INTO activities VALUES(111,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"MkrUcm9MMjJ6AELcvQs4TsKL84JaJJqH"}','59.125.7.7','curl/8.14.1','2025-09-01T09:13:46.347Z');
INSERT INTO activities VALUES(112,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"YUPW4JaMtgYusgYpWFn0JUeZdxiu3msI"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-01T11:01:00.911Z');
INSERT INTO activities VALUES(113,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"q0Js8s6is0YLZwIcHX6dhNXtxHGqEndX"}','220.132.197.165','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-01T11:06:28.567Z');
INSERT INTO activities VALUES(114,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"yQ1Yyz9nnRLRZcK2JQW3kgU2D7wBuGno"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-01T12:40:10.046Z');
INSERT INTO activities VALUES(115,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"xqPitaUxM3IzcEMMCUUJG4r0EJCs5fhR"}','111.82.44.244','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-02T00:42:43.073Z');
INSERT INTO activities VALUES(116,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"nUgAVbQzEfrwPqeAXrcNfbU1aSPWXMfX"}','111.82.44.244','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-02T01:00:29.443Z');
INSERT INTO activities VALUES(117,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"myYC0Tui6j0TYy7Z4eLo7eccDvNs3zFV"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-02T01:42:31.911Z');
INSERT INTO activities VALUES(118,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"TfKhHLFT9t7Y40XdJPt84f8iy2udwjp3"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-02T01:44:33.025Z');
INSERT INTO activities VALUES(119,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"8Bhz8ze7SukzoZlSNHjbWjI89iemIhTB"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-02T02:01:05.647Z');
INSERT INTO activities VALUES(120,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"QWTasc0sqHVzlw245Xns6lweOMmdlTIc"}','111.82.44.244','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-02T02:14:32.302Z');
INSERT INTO activities VALUES(121,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"lokXiGIeVMvVkQOePE49TaF28m6FV8l3"}','111.82.44.244','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-02T02:19:19.055Z');
INSERT INTO activities VALUES(122,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"aOHijBH5MzZpvKDqs9ewXbCNWz9BrQxw"}','111.82.44.244','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-02T02:19:39.551Z');
INSERT INTO activities VALUES(123,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"8yF5KMYCKnOMDHJVi15sdgUKrY4VoQ4z"}','59.126.203.136','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-02T08:29:28.471Z');
INSERT INTO activities VALUES(124,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"xEwya1LRv1GcIUh1w3BF5Lm5B82KwLZ9"}','120.108.85.154','curl/8.11.0','2025-09-02T11:26:23.012Z');
INSERT INTO activities VALUES(125,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"eKxvZSXVUJOkX2dPVRb6KQy44WSFMpOe"}','120.108.85.154','curl/8.11.0','2025-09-02T11:33:32.605Z');
INSERT INTO activities VALUES(126,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"8uaArO9I2wGxIzhYmBKK4Era4tfwydJx"}','120.108.85.154','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-02T11:35:43.821Z');
INSERT INTO activities VALUES(127,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"fwcg0nzhkuWtyKOfQQU597uWJKG6pIwW"}','120.108.85.154','curl/8.11.0','2025-09-02T11:43:54.174Z');
INSERT INTO activities VALUES(128,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"Zi5AFhyrcGrjTOn3Fao2KIzpjY03KF0t"}','120.108.85.154','curl/8.11.0','2025-09-02T11:51:30.350Z');
INSERT INTO activities VALUES(129,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"fJ37z8iqP0r1ibtwevqSR4albL8wWaKp"}','120.108.85.154','curl/8.11.0','2025-09-02T11:58:55.604Z');
INSERT INTO activities VALUES(130,'admin-001','System Administration','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"UnJWkFFGdvVDo55rRwU7rGG10TVr95uc"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-03T01:08:55.304Z');
INSERT INTO activities VALUES(131,'system','Webhook Handler','system','message_received','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","customerId":1,"platform":"line","messageType":"text","messageId":"cfa75670-d254-44e6-bddc-5c289915df75","content":"Wow wow wow"}',NULL,NULL,'2025-09-03T01:19:06.749Z');
INSERT INTO activities VALUES(132,'admin-001','System Administration','admin','message_send','conversation','2f11b76c-672b-461f-9eca-e799cd54f0aa','{"conversationId":"2f11b76c-672b-461f-9eca-e799cd54f0aa","messageId":"0a3f6f59-a303-4d1e-91a7-5f0d5d355232","platform":"line","messageType":"text","contentLength":4,"sendResult":true}',NULL,NULL,'2025-09-03T01:21:19.339Z');
INSERT INTO activities VALUES(133,'admin-001','Admin','admin','team_member_update','team','test-user-001','{"memberName":"Test User For API","memberEmail":"testuser@dacit.net","memberRole":"admin","action":"password_reset_with_policy","policy":"changeable"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-03T01:28:48.023Z');
INSERT INTO activities VALUES(134,'admin-001','Admin','admin','team_member_update','team','agent-001','{"memberName":"dacagent","memberEmail":"dacagent@dacit.net","memberRole":"agent","action":"password_reset_with_policy","policy":"changeable"}','59.125.7.7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-09-03T01:29:22.993Z');
CREATE TABLE delayed_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "conversations" (
    id TEXT PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    assigned_team_id INTEGER,
    assigned_user_id TEXT,  
    status TEXT NOT NULL DEFAULT 'active',
    last_message_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (status IN ('active', 'pending', 'closed'))
);
INSERT INTO conversations VALUES('2f11b76c-672b-461f-9eca-e799cd54f0aa',1,NULL,NULL,'active','2025-09-03T01:21:19.339Z','2025-08-29 13:20:59','2025-09-03T01:21:19.339Z');
CREATE TABLE IF NOT EXISTS "messages" (
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
INSERT INTO messages VALUES('d4eca41d-6955-4c32-9d66-dd7e41ccb4b6','2f11b76c-672b-461f-9eca-e799cd54f0aa','customer',1,NULL,'測試測試，測試輸入','text','576487572277297642',0,NULL,NULL,1,NULL,'delivered',NULL,NULL,NULL,1,NULL,'2025-08-29 13:20:59');
INSERT INTO messages VALUES('4dfd12b2-9055-4ecd-8c44-953280c83c12','2f11b76c-672b-461f-9eca-e799cd54f0aa','customer',1,NULL,'Boom','text','576490338705736085',0,NULL,NULL,1,NULL,'delivered',NULL,NULL,NULL,1,NULL,'2025-08-29 13:45:24');
INSERT INTO messages VALUES('a2ace7fd-3957-4ce3-bbee-9379122e29bf','2f11b76c-672b-461f-9eca-e799cd54f0aa','customer',1,NULL,'哈咯哈咯','text','576495480452677685',0,NULL,NULL,1,NULL,'delivered',NULL,NULL,NULL,1,NULL,'2025-08-29 14:36:28');
INSERT INTO messages VALUES('94a38b93-e6f7-4b9b-8ac4-74fb3765bd91','2f11b76c-672b-461f-9eca-e799cd54f0aa','customer',1,NULL,'測試測試，測試輸入','text','576495569909579896',0,NULL,NULL,1,NULL,'delivered',NULL,NULL,NULL,1,NULL,'2025-08-29 14:37:21');
INSERT INTO messages VALUES('0d580ca0-45ca-404c-8530-6413bbee38be','2f11b76c-672b-461f-9eca-e799cd54f0aa','customer',1,NULL,'測試測試，測試輸入','text','576501460541112764',0,NULL,NULL,1,NULL,'delivered',NULL,NULL,NULL,1,NULL,'2025-08-29 15:47:14');
INSERT INTO messages VALUES('08b8b20d-35e3-4729-a549-50d36635443f','2f11b76c-672b-461f-9eca-e799cd54f0aa','customer',1,NULL,'Try and try','text','576507398097731815',0,NULL,NULL,1,NULL,'delivered',NULL,NULL,NULL,1,NULL,'2025-08-29 08:41:56');
INSERT INTO messages VALUES('a8385f45-6555-4443-90a6-d687995b8b51','2f11b76c-672b-461f-9eca-e799cd54f0aa','customer',1,NULL,'你好你好','text','576511440265937400',0,NULL,NULL,1,NULL,'delivered',NULL,NULL,NULL,1,NULL,'2025-08-29 09:16:03');
INSERT INTO messages VALUES('bc2e129f-0441-40c9-a2a2-7234296716b4','2f11b76c-672b-461f-9eca-e799cd54f0aa','customer',1,NULL,'有錢真好','text','576517236106985830',0,NULL,NULL,1,NULL,'delivered',NULL,NULL,NULL,1,NULL,'2025-08-29T10:16:43.873Z');
INSERT INTO messages VALUES('63e34ba3-09e3-45bb-8983-352aa0b44dbe','2f11b76c-672b-461f-9eca-e799cd54f0aa','customer',1,NULL,'來來','text','576517868977127544',0,NULL,NULL,1,NULL,'delivered',NULL,NULL,NULL,1,NULL,'2025-08-29T10:20:56.904Z');
INSERT INTO messages VALUES('434895c9-6ffc-452d-be27-04905a7c9935','2f11b76c-672b-461f-9eca-e799cd54f0aa','customer',1,NULL,'哈哈哈','text','576519326917197911',0,NULL,NULL,1,NULL,'delivered',NULL,NULL,NULL,1,NULL,'2025-08-29T10:33:21.933Z');
INSERT INTO messages VALUES('d90dd538-85ec-46ca-b581-716ce6feb706','2f11b76c-672b-461f-9eca-e799cd54f0aa','customer',1,NULL,replace('20250901\n第一次測試','\n',char(10)),'text','576908320644792981',0,NULL,NULL,1,NULL,'delivered',NULL,NULL,NULL,1,NULL,'2025-09-01T02:57:40.160Z');
INSERT INTO messages VALUES('cfa75670-d254-44e6-bddc-5c289915df75','2f11b76c-672b-461f-9eca-e799cd54f0aa','customer',1,NULL,'Wow wow wow','text','577188309882110090',0,NULL,NULL,1,NULL,'delivered',NULL,NULL,NULL,1,NULL,'2025-09-03T01:19:06.608Z');
INSERT INTO messages VALUES('0a3f6f59-a303-4d1e-91a7-5f0d5d355232','2f11b76c-672b-461f-9eca-e799cd54f0aa','agent',NULL,'admin-001','回复回复','text',NULL,0,NULL,NULL,1,'2025-09-03T01:21:19.339Z','sent',NULL,NULL,NULL,1,NULL,'2025-09-03T01:21:18.044Z');
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('d1_migrations',14);
INSERT INTO sqlite_sequence VALUES('customers',3);
INSERT INTO sqlite_sequence VALUES('activities',134);
CREATE UNIQUE INDEX `agents_email_unique` ON `agents` (`email`);
CREATE INDEX idx_customers_platform ON customers(platform, platform_user_id);
CREATE INDEX idx_delayed_messages_scheduled_at ON delayed_messages(scheduled_at);
CREATE INDEX idx_delayed_messages_status ON delayed_messages(status);
CREATE INDEX idx_customers_profile_updated 
ON customers(profile_updated_at);
CREATE INDEX idx_customers_platform_user 
ON customers(platform, platform_user_id);
CREATE INDEX idx_delayed_messages_agent ON delayed_messages(agent_id);
CREATE INDEX idx_delayed_messages_conversation ON delayed_messages(conversation_id);
CREATE INDEX idx_activities_user ON activities(user_id);
CREATE INDEX idx_activities_created_at ON activities(created_at);
CREATE INDEX idx_activities_action ON activities(action);
CREATE INDEX idx_activities_resource ON activities(resource_type, resource_id);
CREATE INDEX idx_file_attachments_message ON file_attachments(message_id);
CREATE INDEX idx_file_attachments_type ON file_attachments(file_type);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at);
