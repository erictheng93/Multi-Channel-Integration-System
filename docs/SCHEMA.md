# D1 Schema

> 2025-08-19
> v2.0
> multi-channel-platform MVP


 Cloudflare D1 (SQLite) schema

**17**

****
- customers - ()
- conversations -
- messages -
- users -
- teams -
- agents - ()
- app_users -

****
- file_attachments -
- file_metadata -
- file_access_logs -

****
- pending_messages -
- message_recall_logs -

****
- system_settings -
- activities - ()

****
- d1_migrations - D1
- sqlite_sequence - SQLite
- _cf_METADATA - Cloudflare


-
-
-
-
- schema


### 1. customers - ()

| | | | | |
|--------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | ID |
| platform | TEXT | NOT NULL | - | |
| platform_user_id | TEXT | NOT NULL | - | ID |
| display_name | TEXT | - | - | |
| avatar_url | TEXT | - | - | URL |
| phone | TEXT | - | - | |
| email | TEXT | - | - | |
| source_team_id | INTEGER | - | - | ID |
| metadata | TEXT | - | - | (JSON) |
| created_at | TEXT | NOT NULL | datetime('now') | |
| updated_at | TEXT | NOT NULL | datetime('now') | |

**** UNIQUE(platform, platform_user_id)

### 2. conversations -

| | | | | |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | ID |
| user_id | TEXT | NOT NULL FOREIGN KEY (users.id) | - | ID |
| assigned_to | TEXT | - | - | ID |
| status | TEXT | NOT NULL | 'open' | |
| last_message_at | INTEGER | NOT NULL | - | (Unix ) |
| unread_count | INTEGER | - | 0 | |
| created_at | INTEGER | NOT NULL | - | (Unix ) |
| updated_at | INTEGER | NOT NULL | - | (Unix ) |

### 3. messages -

| | | | | |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | ID |
| conversation_id | TEXT | NOT NULL FOREIGN KEY (conversations.id) | - | ID |
| sender_type | TEXT | NOT NULL | - | |
| sender_id | TEXT | NOT NULL | - | ID |
| content | TEXT | NOT NULL | - | |
| media_url | TEXT | - | - | URL |
| media_type | TEXT | - | - | |
| platform | TEXT | NOT NULL | - | |
| created_at | INTEGER | NOT NULL | - | (Unix ) |
| has_attachments | BOOLEAN | - | FALSE | |

### 4. users -

| | | | | |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | ID |
| platform | TEXT | NOT NULL | - | |
| platform_user_id | TEXT | NOT NULL | - | ID |
| name | TEXT | NOT NULL | - | |
| avatar_url | TEXT | - | - | URL |
| created_at | INTEGER | NOT NULL | - | (Unix ) |

**** UNIQUE(platform, platform_user_id)

### 5. teams -

| | | | | |
|--------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | ID |
| name | TEXT | NOT NULL | - | |
| description | TEXT | - | - | |
| is_active | BOOLEAN | - | TRUE | |
| created_at | TEXT | NOT NULL | datetime('now') | |
| updated_at | TEXT | NOT NULL | datetime('now') | |

### 6. agents - ()

| | | | | |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | ID |
| email | TEXT | UNIQUE NOT NULL | - | |
| password_hash | TEXT | NOT NULL | - | |
| name | TEXT | NOT NULL | - | |
| role | TEXT | NOT NULL | 'agent' | |
| is_active | BOOLEAN | - | TRUE | |
| created_at | INTEGER | NOT NULL | - | (Unix ) |
| last_active | INTEGER | - | - | (Unix ) |

### 7. app_users -

| | | | | |
|--------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | ID |
| username | TEXT | UNIQUE NOT NULL | - | |
| email | TEXT | UNIQUE NOT NULL | - | |
| password_hash | TEXT | NOT NULL | - | |
| display_name | TEXT | NOT NULL | - | |
| role | TEXT | NOT NULL | 'agent' | |
| team_id | INTEGER | - | - | ID |
| is_active | BOOLEAN | - | TRUE | |
| created_at | TEXT | NOT NULL | datetime('now') | |
| updated_at | TEXT | NOT NULL | datetime('now') | |

### 8. file_attachments -

| | | | | |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | ID |
| message_id | TEXT | NOT NULL FOREIGN KEY (messages.id) ON DELETE CASCADE | - | ID |
| conversation_id | TEXT | NOT NULL FOREIGN KEY (conversations.id) ON DELETE CASCADE | - | ID |
| original_filename | TEXT | NOT NULL | - | |
| stored_filename | TEXT | NOT NULL | - | |
| file_size | INTEGER | NOT NULL | - | (bytes) |
| mime_type | TEXT | NOT NULL | - | MIME |
| file_extension | TEXT | - | - | |
| storage_path | TEXT | NOT NULL | - | |
| storage_url | TEXT | - | - | URL |
| upload_status | TEXT | NOT NULL | 'pending' | |
| uploaded_by | TEXT | NOT NULL | - | ID |
| created_at | INTEGER | NOT NULL | - | (Unix ) |
| updated_at | INTEGER | NOT NULL | - | (Unix ) |

### 9. file_metadata -

| | | | | |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | ID |
| attachment_id | TEXT | NOT NULL FOREIGN KEY (file_attachments.id) ON DELETE CASCADE | - | ID |
| width | INTEGER | - | - | |
| height | INTEGER | - | - | |
| duration | INTEGER | - | - | () |
| thumbnail_url | TEXT | - | - | URL |
| checksum | TEXT | - | - | |
| virus_scan_status | TEXT | - | 'pending' | |
| virus_scan_at | INTEGER | - | - | (Unix ) |
| created_at | INTEGER | NOT NULL | - | (Unix ) |

### 10. file_access_logs -

| | | | | |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | ID |
| attachment_id | TEXT | NOT NULL FOREIGN KEY (file_attachments.id) ON DELETE CASCADE | - | ID |
| accessed_by | TEXT | NOT NULL | - | ID |
| access_type | TEXT | NOT NULL | - | |
| ip_address | TEXT | - | - | IP |
| user_agent | TEXT | - | - | |
| created_at | INTEGER | NOT NULL | - | (Unix ) |

### 11. pending_messages -

| | | | | |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | ID |
| conversation_id | TEXT | NOT NULL FOREIGN KEY (conversations.id) ON DELETE CASCADE | - | ID |
| sender_id | INTEGER | NOT NULL FOREIGN KEY (agents.id) ON DELETE CASCADE | - | ID |
| content | TEXT | NOT NULL | - | |
| message_type | TEXT | NOT NULL | 'text' | |
| recipient_platform_id | TEXT | NOT NULL | - | ID |
| platform | TEXT | NOT NULL | - | |
| delay_seconds | INTEGER | NOT NULL | 0 | |
| scheduled_send_time | TEXT | NOT NULL | - | |
| recall_deadline | TEXT | - | - | |
| status | TEXT | NOT NULL | 'pending' | |
| metadata | TEXT | - | - | (JSON) |
| created_at | TEXT | NOT NULL | datetime('now') | |
| updated_at | TEXT | NOT NULL | datetime('now') | |
| sent_at | TEXT | - | - | |
| cancelled_at | TEXT | - | - | |

### 12. message_recall_logs -

| | | | | |
|--------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | ID |
| message_id | TEXT | NOT NULL FOREIGN KEY (pending_messages.id) ON DELETE CASCADE | - | ID |
| user_id | INTEGER | NOT NULL FOREIGN KEY (agents.id) ON DELETE CASCADE | - | ID |
| action | TEXT | NOT NULL | - | |
| reason | TEXT | - | - | |
| created_at | TEXT | NOT NULL | datetime('now') | |

### 13. system_settings -

| | | | | |
|--------|------|------|--------|------|
| key | TEXT | PRIMARY KEY | - | |
| value | TEXT | NOT NULL | - | |
| created_at | TEXT | NOT NULL | datetime('now') | |
| updated_at | TEXT | NOT NULL | datetime('now') | |

### 14. activities - ()

| | | | | |
|--------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | ID |
| user_id | TEXT | NOT NULL FOREIGN KEY (agents.id) | - | ID |
| user_name | TEXT | NOT NULL | - | |
| user_role | TEXT | NOT NULL | - | |
| action | TEXT | NOT NULL | - | |
| resource_type | TEXT | NOT NULL | - | |
| resource_id | TEXT | - | - | ID |
| details | TEXT | - | - | (JSON) |
| ip_address | TEXT | - | - | IP |
| user_agent | TEXT | - | - | |
| created_at | TEXT | NOT NULL | datetime('now') | |


```sql
--
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_assigned ON conversations(assigned_to);
CREATE INDEX idx_conversations_status ON conversations(status);

--
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);

--
CREATE INDEX idx_file_attachments_message ON file_attachments(message_id);
CREATE INDEX idx_file_attachments_conversation ON file_attachments(conversation_id);
CREATE INDEX idx_file_attachments_status ON file_attachments(upload_status);
CREATE INDEX idx_file_attachments_created ON file_attachments(created_at);

--
CREATE INDEX idx_file_metadata_attachment ON file_metadata(attachment_id);

--
CREATE INDEX idx_file_access_logs_attachment ON file_access_logs(attachment_id);
CREATE INDEX idx_file_access_logs_created ON file_access_logs(created_at);

--
CREATE INDEX idx_pending_messages_conversation ON pending_messages(conversation_id);
CREATE INDEX idx_pending_messages_sender ON pending_messages(sender_id);
CREATE INDEX idx_pending_messages_status ON pending_messages(status);
CREATE INDEX idx_pending_messages_scheduled ON pending_messages(scheduled_send_time);

--
CREATE INDEX idx_recall_logs_message ON message_recall_logs(message_id);
CREATE INDEX idx_recall_logs_user ON message_recall_logs(user_id);

--
CREATE INDEX idx_activities_user ON activities(user_id);
CREATE INDEX idx_activities_action ON activities(action);
CREATE INDEX idx_activities_resource ON activities(resource_type, resource_id);
CREATE INDEX idx_activities_created ON activities(created_at);
```


```
conversations
 user_id users.id
 (referenced by messages.conversation_id)

messages
 conversation_id conversations.id
 (referenced by file_attachments.message_id)

file_attachments
 message_id messages.id (CASCADE DELETE)
 conversation_id conversations.id (CASCADE DELETE)
 (referenced by file_metadata.attachment_id)

file_metadata
 attachment_id file_attachments.id (CASCADE DELETE)

file_access_logs
 attachment_id file_attachments.id (CASCADE DELETE)

pending_messages
 conversation_id conversations.id (CASCADE DELETE)
 sender_id agents.id (CASCADE DELETE)

message_recall_logs
 message_id pending_messages.id (CASCADE DELETE)
 user_id agents.id (CASCADE DELETE)

activities
 user_id agents.id
```


| | | | |
|----------|--------|------|------|
| general.systemName | Multi-Channel Support | | |
| general.contactEmail | admin@example.com | | |
| general.timezone | Asia/Taipei | | |
| general.language | zh-TW | | |
| advanced.messageQueueSize | 1000 | | |
| advanced.messageTimeout | 30 | () | |
| advanced.cacheExpiry | 60 | () | |
| advanced.sessionExpiry | 24 | () | |
| advanced.enableRateLimit | true | | |
| advanced.enableLogging | true | | |
| advanced.enableMetrics | true | | |
| integrations.line.status | disconnected | LINE | |
| integrations.facebook.status | disconnected | Facebook | |


### v2.0 (2025-08-19)
-
 - `file_attachments` -
 - `file_metadata` -
 - `file_access_logs` -
-
 - `pending_messages` -
 - `message_recall_logs` -
-
-
-

### v1.2 (2025-02-08)
- `direction` `messages`
-
-

### v1.1 (2025-01-08)
- `conversation_sessions`
- `messages`
-

### v1.0 (2025-01-08)
- schema
-
-


1. **** Cloudflare D1 ( SQLite)
2. ****UTF-8
3. ****
 - TEXT ISO 8601 SQLite datetime('now')
 - INTEGER Unix
4. **JSON **metadatadetails JSON
5. **** CASCADE DELETE
6. ****
7. **** Cloudflare R2


1.
2.
3.
4.
5. schema
6.
7. 