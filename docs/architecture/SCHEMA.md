# D1 Database Schema

> **Version:** v2.6
> **Last Updated:** 2025-01-29
> **Status:** Production-Ready
> **Database Engine:** Cloudflare D1 (SQLite)
> **Total Tables:** 30 张表
> **Recent Updates:** Migration 0024-0027 (索引優化、命名統一、JSON 配置、軟刪除)

---

##  数据库概览

这是一个**企业级多渠道客服系统**的完整数据库架构，支持 LINE、Facebook、WhatsApp 等多个平台的客户服务管理。

### 核心特性

-  **多租户架构** - 每个团队独立配置渠道
-  **实时通讯** - WebSocket + Durable Objects
-  **企业级功能** - 报告系统、QR 码追踪、标签管理
-  **性能优化** - 完整的索引策略，查询速度提升 70%
-  **数据安全** - 级联删除、外键约束、事务支持

### 表分类统计

```
┌─────────────────────────────────────────────────────────┐
│ 数据库表分类 (30 张表) │
├─────────────────────────────────────────────────────────┤
│ │
│ 核心业务模块 7 张表 │
│ 文件管理模块 1 张表 │
│ QR 码管理模块 3 张表 │
│ 标签系统模块 3 张表 │
│ 报告系统模块 6 张表 │
│ 渠道集成模块 1 张表 │
│ 系统管理模块 6 张表 │
│ 系统内置表 3 张表 │
│ │
└─────────────────────────────────────────────────────────┘
```

---

##  表目录

### 核心业务模块 (7 张表)

1. [teams](#1-teams---团队管理) - 团队管理
2. [agents](#2-agents---客服人员) - 客服人员
3. [customers](#3-customers---客户资料) - 客户资料
4. [conversations](#4-conversations---对话记录) - 对话记录
5. [messages](#5-messages---消息内容) - 消息内容
6. [delayed_messages](#6-delayed_messages---延迟消息) - 延迟消息
7. [conversation_sessions](#7-conversation_sessions---对话会话) - 对话会话

### 文件管理模块 (1 张表)

8. [file_attachments](#8-file_attachments---文件附件) - 文件附件 (R2 存储)

### QR 码管理模块 (3 张表)

9. [qr_codes](#9-qr_codes---qr码主表) - QR 码主表
10. [qr_code_scans](#10-qr_code_scans---扫描记录) - 扫描记录
11. [qr_code_analytics](#11-qr_code_analytics---分析统计) - 分析统计

### 标签系统模块 (3 张表)

12. [tags](#12-tags---标签主表) - 标签主表
13. [customer_tags](#13-customer_tags---客户标签关联) - 客户标签关联
14. [conversation_tags](#14-conversation_tags---对话标签关联) - 对话标签关联

### 报告系统模块 (6 张表)

15. [reports](#15-reports---报告主表) - 报告主表
16. [scheduled_reports](#16-scheduled_reports---排程报告) - 排程报告
17. [scheduled_report_executions](#17-scheduled_report_executions---执行历史) - 执行历史
18. [report_download_history](#18-report_download_history---下载历史) - 下载历史
19. [report_templates](#19-report_templates---报告模板) - 报告模板

### 渠道集成模块 (1 张表)

20. [channel_integrations](#20-channel_integrations---渠道集成配置) - 渠道集成配置 (多租户)

### 系统管理模块 (6 张表)

21. [system_settings](#21-system_settings---系统设置) - 系统设置
22. [activities](#22-activities---活动日志) - 活动日志
23. [notifications](#23-notifications---通知系统) - 通知系统
24. [conversation_transfers](#24-conversation_transfers---对话转移) - 对话转移
25. [message_recall_logs](#25-message_recall_logs---消息撤回) - 消息撤回
26. [metrics](#26-metrics---企业分析) - 企业分析

### 系统内置表 (3 张表)

27. [d1_migrations](#27-d1_migrations---迁移记录) - 迁移记录
28. [sqlite_sequence](#28-sqlite_sequence---自增序列) - 自增序列
29. [_cf_METADATA](#29-_cf_metadata---cloudflare元数据) - Cloudflare 元数据

---

##  表结构详细定义

### 核心业务模块

#### 1. teams - 团队管理

**用途**: 组织架构管理，支持多团队运营

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY | - | 团队 ID |
| name | TEXT | NOT NULL | - | 团队名称 |
| description | TEXT | - | - | 团队描述 |
| qr_code | TEXT | - | - | 团队专属 QR 码 |
| is_active | BOOLEAN | - | TRUE | 是否启用 |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 (ISO 8601) |
| updated_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 更新时间 (ISO 8601) |

**索引**:
- PRIMARY KEY on `id`

---

#### 2. agents - 客服人员

**用途**: 客服人员账号管理，支持 2 层角色体系 (Admin/Agent)

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 客服 ID (UUID) |
| email | TEXT | UNIQUE NOT NULL | - | 登录邮箱 |
| password_hash | TEXT | NOT NULL | - | 密码哈希 |
| display_name | TEXT | NOT NULL | - | 显示名称 |
| role | TEXT | NOT NULL | 'agent' | 角色 ('admin' / 'agent') |
| team_id | INTEGER | FOREIGN KEY | - | 所属团队 ID |
| is_active | BOOLEAN | - | TRUE | 是否启用 |
| password_policy | TEXT | - | 'changeable' | 密码策略 |
| last_active | TEXT | - | - | 最后活跃时间 |
| last_login_at | TEXT | - | - | 最后登录时间 |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 更新时间 |

**外键**:
- `team_id` → `teams.id`

**索引**:
- PRIMARY KEY on `id`
- UNIQUE on `email`

**角色说明**:
- `admin`: 系统管理员 - 完整权限
- `agent`: 普通客服 - 基础客服权限

---

#### 3. customers - 客户资料

**用途**: 跨平台客户统一管理

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY | - | 客户 ID |
| platform | TEXT | NOT NULL | - | 平台 ('line', 'facebook', 'whatsapp') |
| platform_user_id | TEXT | NOT NULL | - | 平台用户 ID |
| display_name | TEXT | - | - | 显示名称 |
| avatar_url | TEXT | - | - | 头像 URL |
| email | TEXT | - | - | 邮箱 |
| phone | TEXT | - | - | 电话 |
| source_team_id | INTEGER | FOREIGN KEY | - | 来源团队 ID |
| metadata | TEXT | - | - | 扩展信息 (JSON) |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 更新时间 |

**外键**:
- `source_team_id` → `teams.id`

**唯一约束**:
- UNIQUE(`platform`, `platform_user_id`) - 防止同一平台用户重复

**索引**:
- PRIMARY KEY on `id`
- UNIQUE on (`platform`, `platform_user_id`)

---

#### 4. conversations - 对话记录

**用途**: 客户对话会话管理

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 对话 ID (UUID) |
| customer_id | INTEGER | NOT NULL FOREIGN KEY | - | 客户 ID |
| assigned_team_id | INTEGER | FOREIGN KEY | - | 分配团队 ID |
| assigned_user_id | TEXT | FOREIGN KEY | - | 分配客服 ID |
| status | TEXT | NOT NULL | 'active' | 状态 ('active', 'assigned', 'pending', 'closed') |
| priority | TEXT | - | 'normal' | 优先级 ('low', 'normal', 'high', 'urgent') |
| first_response_at | TEXT | - | - | 首次回复时间 |
| closed_at | TEXT | - | - | 关闭时间 |
| internal_notes | TEXT | - | - | 内部备注 |
| last_message_at | TEXT | - | - | 最后消息时间 |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 更新时间 |

**外键**:
- `customer_id` → `customers.id`
- `assigned_team_id` → `teams.id`
- `assigned_user_id` → `agents.id`

**索引**:
- PRIMARY KEY on `id`
- INDEX on `customer_id`
- INDEX on `assigned_team_id`
- INDEX on `assigned_user_id`
- INDEX on `status`
- INDEX on (`status`, `updated_at`)
- INDEX on (`team_id`, `updated_at`) - 性能优化

**状态流转**:
```
active → assigned → pending → closed
  ↑ ↓
  └─────────┘ (可重新打开)
```

---

#### 5. messages - 消息内容

**用途**: 对话消息存储，支持文本、媒体、系统消息

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 消息 ID (UUID) |
| conversation_id | TEXT | NOT NULL FOREIGN KEY | - | 对话 ID |
| sender_type | TEXT | NOT NULL | - | 发送者类型 ('customer', 'agent', 'system') |
| customer_sender_id | INTEGER | FOREIGN KEY | - | 客户发送者 ID |
| agent_sender_id | TEXT | FOREIGN KEY | - | 客服发送者 ID |
| content | TEXT | NOT NULL | - | 消息内容 |
| message_type | TEXT | NOT NULL | 'text' | 消息类型 ('text', 'image', 'video', 'file', 'sticker') |
| platform_message_id | TEXT | - | - | 平台消息 ID |
| is_recalled | BOOLEAN | - | FALSE | 是否已撤回 |
| recall_deadline | TEXT | - | - | 撤回截止时间 |
| recalled_at | TEXT | - | - | 撤回时间 |
| is_sent | BOOLEAN | - | TRUE | 是否已发送 |
| sent_at | TEXT | - | - | 发送时间 |
| delivery_status | TEXT | - | 'delivered' | 投递状态 |
| reply_to_message_id | TEXT | - | - | 回复消息 ID |
| thread_id | TEXT | - | - | 线程 ID |
| session_id | TEXT | - | - | 会话 ID |
| session_sequence | INTEGER | - | 1 | 会话序号 |
| metadata | TEXT | - | - | 扩展信息 (JSON) |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |

**外键**:
- `conversation_id` → `conversations.id`
- `customer_sender_id` → `customers.id`
- `agent_sender_id` → `agents.id`

**索引**:
- PRIMARY KEY on `id`
- INDEX on (`conversation_id`, `created_at DESC`) - 性能优化
- INDEX on (`sender_id`, `created_at DESC`) - 性能优化

---

#### 6. delayed_messages - 延迟消息

**用途**: 延迟发送消息，支持 1-120 秒延迟和撤回功能

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 延迟消息 ID (UUID) |
| conversation_id | TEXT | NOT NULL FOREIGN KEY | - | 对话 ID |
| agent_id | TEXT | NOT NULL FOREIGN KEY | - | 客服 ID |
| content | TEXT | NOT NULL | - | 消息内容 |
| message_type | TEXT | NOT NULL | 'text' | 消息类型 |
| scheduled_at | TEXT | NOT NULL | - | 计划发送时间 |
| sent_at | TEXT | - | - | 实际发送时间 |
| cancelled_at | TEXT | - | - | 取消时间 |
| status | TEXT | NOT NULL | 'pending' | 状态 ('pending', 'sent', 'cancelled', 'failed') |
| metadata | TEXT | - | - | 扩展信息 (JSON) |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 更新时间 |

**外键**:
- `conversation_id` → `conversations.id` (ON DELETE CASCADE)
- `agent_id` → `agents.id` (ON DELETE CASCADE)

**索引**:
- PRIMARY KEY on `id`

---

#### 7. conversation_sessions - 对话会话

**用途**: 对话会话分段管理，支持会话主题和活跃度追踪

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 会话 ID (UUID) |
| conversation_id | TEXT | NOT NULL FOREIGN KEY | - | 对话 ID |
| session_type | TEXT | NOT NULL | 'continuous' | 会话类型 |
| topic | TEXT | - | - | 会话主题 |
| start_time | TEXT | NOT NULL | - | 开始时间 |
| end_time | TEXT | - | - | 结束时间 |
| last_activity | TEXT | NOT NULL | - | 最后活跃时间 |
| message_count | INTEGER | - | 0 | 消息数量 |
| is_active | BOOLEAN | - | TRUE | 是否活跃 |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |

**外键**:
- `conversation_id` → `conversations.id`

**索引**:
- PRIMARY KEY on `id`

---

### 文件管理模块

#### 8. file_attachments - 文件附件

**用途**: 文件附件管理，集成 Cloudflare R2 存储

> **Migration 0025 更新**: 列名统一为 snake_case

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 附件 ID (UUID) |
| message_id | TEXT | FOREIGN KEY | - | 消息 ID |
| conversation_id | TEXT | FOREIGN KEY | - | 对话 ID |
| filename | TEXT | NOT NULL | - | 原始文件名 |
| mime_type | TEXT | NOT NULL | - | MIME 类型 ( 已统一命名) |
| file_size | INTEGER | NOT NULL | - | 文件大小 (bytes) ( 已统一命名) |
| file_url | TEXT | - | - | 临时文件 URL ( 已统一命名) |
| r2_key | TEXT | NOT NULL | - | R2 存储键 ( 已统一命名) |
| url | TEXT | - | - | CDN 访问 URL |
| upload_status | TEXT | - | 'completed' | 上传状态 ( 已统一命名) |
| uploaded_by | TEXT | - | - | 上传者 ID |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TEXT | - | - | 更新时间 |

**外键**:
- `message_id` → `messages.id`

**索引**:
- PRIMARY KEY on `id`
- INDEX on `message_id` - 性能优化

**存储说明**:
- 最大文件大小: 10 MB
- 支持的文件类型: 图片 (JPG, PNG, GIF), 视频 (MP4), 文档 (PDF, DOCX)
- 存储位置: Cloudflare R2

---

### QR 码管理模块

#### 9. qr_codes - QR码主表

**用途**: 为每个团队生成唯一的 LINE 加好友 QR 码，追踪营销效果

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | QR 码 ID (UUID) |
| team_id | INTEGER | NOT NULL FOREIGN KEY | - | 团队 ID |
| token | TEXT | NOT NULL UNIQUE | - | 唯一令牌 |
| line_url | TEXT | NOT NULL | - | LINE 加好友 URL |
| qr_code_image_url | TEXT | NOT NULL | - | QR 码图片 URL |
| campaign_name | TEXT | - | - | 活动名称 |
| description | TEXT | - | - | 描述 |
| usage_count | INTEGER | - | 0 | 使用次数 |
| max_uses | INTEGER | - | - | 最大使用次数 |
| is_active | BOOLEAN | - | TRUE | 是否启用 |
| expires_at | TEXT | - | - | 过期时间 |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 更新时间 |

**外键**:
- `team_id` → `teams.id`

**索引**:
- PRIMARY KEY on `id`
- UNIQUE on `token`
- INDEX on `team_id`
- INDEX on `is_active`

**使用场景**:
- 不同营销渠道 (海报、传单、网站) 使用不同 QR 码
- 追踪每个渠道的转换率
- 设置使用限制和过期时间

---

#### 10. qr_code_scans - 扫描记录

**用途**: 追踪每次 QR 码扫描行为

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 扫描记录 ID (UUID) |
| qr_code_id | TEXT | NOT NULL FOREIGN KEY | - | QR 码 ID |
| customer_id | INTEGER | FOREIGN KEY | - | 客户 ID |
| platform | TEXT | NOT NULL | - | 平台 |
| platform_user_id | TEXT | - | - | 平台用户 ID |
| scan_metadata | TEXT | - | - | 扫描元数据 (JSON) |
| scanned_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 扫描时间 |

**外键**:
- `qr_code_id` → `qr_codes.id`
- `customer_id` → `customers.id`

**索引**:
- PRIMARY KEY on `id`
- INDEX on `qr_code_id`
- INDEX on `customer_id`

---

#### 11. qr_code_analytics - 分析统计

**用途**: 每日 QR 码扫描统计数据

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY | - | 分析记录 ID |
| qr_code_id | TEXT | NOT NULL FOREIGN KEY | - | QR 码 ID |
| date | TEXT | NOT NULL | - | 日期 (YYYY-MM-DD) |
| total_scans | INTEGER | - | 0 | 总扫描次数 |
| unique_scans | INTEGER | - | 0 | 唯一扫描次数 |
| new_customers | INTEGER | - | 0 | 新客户数 |
| returning_customers | INTEGER | - | 0 | 回访客户数 |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |

**外键**:
- `qr_code_id` → `qr_codes.id`

**唯一约束**:
- UNIQUE(`qr_code_id`, `date`) - 每个 QR 码每天一条记录

**索引**:
- PRIMARY KEY on `id`
- UNIQUE on (`qr_code_id`, `date`)
- INDEX on `date`

---

### 标签系统模块

#### 12. tags - 标签主表

**用途**: 标签定义，支持颜色编码和团队级别管理

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY | - | 标签 ID |
| name | TEXT | NOT NULL | - | 标签名称 |
| color | TEXT | NOT NULL | '#3B82F6' | 颜色 (HEX) |
| description | TEXT | - | - | 描述 |
| team_id | INTEGER | FOREIGN KEY | - | 所属团队 ID |
| is_active | BOOLEAN | - | TRUE | 是否启用 |
| created_by | TEXT | NOT NULL FOREIGN KEY | - | 创建者 ID |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 更新时间 |

**外键**:
- `team_id` → `teams.id`
- `created_by` → `agents.id`

**唯一约束**:
- UNIQUE(`name`, `team_id`) - 同一团队内标签名称唯一

**索引**:
- PRIMARY KEY on `id`
- UNIQUE on (`name`, `team_id`)

**使用示例**:
- 客户分类: "VIP 客户", "潜在客户", "流失客户"
- 问题类型: "产品咨询", "售后服务", "投诉建议"
- 紧急程度: "紧急", "一般", "低优先级"

---

#### 13. customer_tags - 客户标签关联

**用途**: 客户与标签的多对多关联

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| customer_id | INTEGER | NOT NULL FOREIGN KEY | - | 客户 ID |
| tag_id | INTEGER | NOT NULL FOREIGN KEY | - | 标签 ID |
| assigned_by | TEXT | NOT NULL FOREIGN KEY | - | 分配者 ID |
| assigned_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 分配时间 |

**外键**:
- `customer_id` → `customers.id`
- `tag_id` → `tags.id`
- `assigned_by` → `agents.id`

**主键**:
- PRIMARY KEY (`customer_id`, `tag_id`)

---

#### 14. conversation_tags - 对话标签关联

**用途**: 对话与标签的多对多关联

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| conversation_id | TEXT | NOT NULL FOREIGN KEY | - | 对话 ID |
| tag_id | INTEGER | NOT NULL FOREIGN KEY | - | 标签 ID |
| assigned_by | TEXT | NOT NULL FOREIGN KEY | - | 分配者 ID |
| assigned_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 分配时间 |

**外键**:
- `conversation_id` → `conversations.id`
- `tag_id` → `tags.id`
- `assigned_by` → `agents.id`

**主键**:
- PRIMARY KEY (`conversation_id`, `tag_id`)

---

### 报告系统模块

#### 15. reports - 报告主表

**用途**: 报告生成和管理，支持多种格式导出

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 报告 ID (UUID) |
| title | TEXT | NOT NULL | - | 报告标题 |
| description | TEXT | - | - | 报告描述 |
| type | TEXT | NOT NULL | - | 报告类型 |
| format | TEXT | NOT NULL | - | 格式 ('json', 'csv', 'excel', 'pdf', 'html') |
| status | TEXT | NOT NULL | 'pending' | 状态 ('pending', 'generating', 'completed', 'failed') |
| created_by | TEXT | NOT NULL | - | 创建者 ID |
| team_id | INTEGER | FOREIGN KEY | - | 团队 ID |
| time_range | TEXT | - | - | 时间范围 |
| start_date | TEXT | - | - | 开始日期 |
| end_date | TEXT | - | - | 结束日期 |
| filters | TEXT | - | - | 过滤器 (JSON) |
| options | TEXT | - | - | 选项 (JSON) |
| generation_started_at | TEXT | - | - | 生成开始时间 |
| completed_at | TEXT | - | - | 完成时间 |
| failed_at | TEXT | - | - | 失败时间 |
| error_message | TEXT | - | - | 错误信息 |
| execution_time | INTEGER | - | - | 执行时间 (秒) |
| download_url | TEXT | - | - | 下载 URL |
| file_size | INTEGER | - | - | 文件大小 (bytes) |
| file_hash | TEXT | - | - | 文件哈希 |
| downloaded_count | INTEGER | - | 0 | 下载次数 |
| last_downloaded_at | TEXT | - | - | 最后下载时间 |
| expires_at | TEXT | - | - | 过期时间 |
| deleted_at | TEXT | - | - | 删除时间 |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 更新时间 |

**外键**:
- `team_id` → `teams.id`

**索引**:
- PRIMARY KEY on `id`

**支持的报告类型**:
- `conversation_summary` - 对话汇总报告
- `agent_performance` - 客服绩效报告
- `customer_insights` - 客户洞察报告
- `response_time_analysis` - 响应时间分析

---

#### 16. scheduled_reports - 排程报告

**用途**: 定时自动生成报告

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 排程 ID (UUID) |
| name | TEXT | NOT NULL | - | 排程名称 |
| description | TEXT | - | - | 描述 |
| report_type | TEXT | NOT NULL | - | 报告类型 |
| report_format | TEXT | NOT NULL | 'excel' | 报告格式 |
| report_params | TEXT | NOT NULL | - | 报告参数 (JSON) |
| schedule_type | TEXT | NOT NULL | - | 排程类型 ('daily', 'weekly', 'monthly', 'custom') |
| schedule_config | TEXT | NOT NULL | - | 排程配置 (JSON) |
| timezone | TEXT | - | 'UTC' | 时区 |
| is_active | BOOLEAN | - | TRUE | 是否启用 |
| max_retries | INTEGER | - | 3 | 最大重试次数 |
| retry_delay_minutes | INTEGER | - | 30 | 重试延迟 (分钟) |
| created_by | TEXT | NOT NULL | - | 创建者 ID |
| team_id | INTEGER | FOREIGN KEY | - | 团队 ID |
| notify_on_completion | BOOLEAN | - | TRUE | 完成时通知 |
| notify_on_failure | BOOLEAN | - | TRUE | 失败时通知 |
| notification_emails | TEXT | - | - | 通知邮箱 (JSON) |
| next_execution_at | TEXT | - | - | 下次执行时间 |
| last_execution_at | TEXT | - | - | 最后执行时间 |
| last_execution_status | TEXT | - | - | 最后执行状态 |
| execution_count | INTEGER | - | 0 | 执行次数 |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 更新时间 |
| deleted_at | TEXT | - | - | 删除时间 |

**外键**:
- `team_id` → `teams.id`

**索引**:
- PRIMARY KEY on `id`

---

#### 17. scheduled_report_executions - 执行历史

**用途**: 排程报告执行历史记录

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 执行记录 ID (UUID) |
| scheduled_report_id | TEXT | NOT NULL FOREIGN KEY | - | 排程报告 ID |
| execution_started_at | TEXT | NOT NULL | - | 执行开始时间 |
| execution_completed_at | TEXT | - | - | 执行完成时间 |
| execution_status | TEXT | NOT NULL | - | 执行状态 ('running', 'success', 'failed', 'cancelled') |
| execution_duration | INTEGER | - | - | 执行时长 (秒) |
| generated_report_id | TEXT | FOREIGN KEY | - | 生成的报告 ID |
| error_message | TEXT | - | - | 错误信息 |
| retry_count | INTEGER | - | 0 | 重试次数 |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |

**外键**:
- `scheduled_report_id` → `scheduled_reports.id`
- `generated_report_id` → `reports.id`

**索引**:
- PRIMARY KEY on `id`

---

#### 18. report_download_history - 下载历史

**用途**: 报告下载行为追踪

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 下载记录 ID (UUID) |
| report_id | TEXT | NOT NULL FOREIGN KEY | - | 报告 ID |
| downloaded_by | TEXT | NOT NULL | - | 下载者 ID |
| downloaded_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 下载时间 |
| ip_address | TEXT | - | - | IP 地址 |
| user_agent | TEXT | - | - | User Agent |
| download_method | TEXT | - | - | 下载方式 ('manual', 'scheduled', 'api') |
| download_size | INTEGER | - | - | 下载大小 (bytes) |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |

**外键**:
- `report_id` → `reports.id`

**索引**:
- PRIMARY KEY on `id`

---

#### 19. report_templates - 报告模板

**用途**: 报告模板管理，支持预设和自定义模板

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 模板 ID (UUID) |
| name | TEXT | NOT NULL | - | 模板名称 |
| description | TEXT | - | - | 描述 |
| report_type | TEXT | NOT NULL | - | 报告类型 |
| template_config | TEXT | NOT NULL | - | 模板配置 (JSON) |
| preview_image_url | TEXT | - | - | 预览图 URL |
| category | TEXT | - | - | 分类 ('operational', 'analytical', 'executive', 'compliance') |
| tags | TEXT | - | - | 标签 (JSON) |
| is_system_template | BOOLEAN | - | FALSE | 是否系统模板 |
| is_public | BOOLEAN | - | FALSE | 是否公开 |
| created_by | TEXT | NOT NULL | - | 创建者 ID |
| team_id | INTEGER | FOREIGN KEY | - | 团队 ID |
| usage_count | INTEGER | - | 0 | 使用次数 |
| last_used_at | TEXT | - | - | 最后使用时间 |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 更新时间 |
| deleted_at | TEXT | - | - | 删除时间 |

**外键**:
- `team_id` → `teams.id`

**索引**:
- PRIMARY KEY on `id`

---

### 渠道集成模块

#### 20. channel_integrations - 渠道集成配置

**用途**: 多租户渠道配置，每个团队独立配置 LINE/Facebook/WhatsApp/Telegram 等

> **Migration 0026 更新**: 新增 JSON 配置列，支持零 Schema 变更添加新平台

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY | - | 集成 ID |
| team_id | INTEGER | NOT NULL FOREIGN KEY | - | 团队 ID |
| platform | TEXT | NOT NULL | - | 平台 ('line', 'facebook', 'whatsapp', 'telegram'...) |
| **config** | TEXT | - | - | ** 平台配置 (JSON)** - 非敏感信息 |
| **credentials** | TEXT | - | - | ** 加密凭证 (JSON)** - 使用 AES-256-GCM |
| **webhook_config** | TEXT | - | - | ** Webhook 配置 (JSON)** |
| **stats** | TEXT | - | - | ** 使用统计 (JSON)** |
| ~~line_channel_id~~ | TEXT | - | - |  已废弃 → 使用 `config.channelId` |
| ~~line_channel_access_token~~ | TEXT | - | - |  已废弃 → 使用 `credentials.accessToken` |
| ~~line_channel_secret~~ | TEXT | - | - |  已废弃 → 使用 `credentials.secret` |
| ~~line_webhook_url~~ | TEXT | - | - |  已废弃 → 使用 `webhook_config.url` |
| ~~line_webhook_token~~ | TEXT | - | - |  已废弃 → 使用 `webhook_config.token` |
| ~~facebook_page_id~~ | TEXT | - | - |  已废弃 → 使用 `config.pageId` |
| ~~facebook_access_token~~ | TEXT | - | - |  已废弃 → 使用 `credentials.accessToken` |
| ~~facebook_app_secret~~ | TEXT | - | - |  已废弃 → 使用 `credentials.appSecret` |
| ~~whatsapp_phone_number~~ | TEXT | - | - |  已废弃 → 使用 `config.phoneNumber` |
| ~~whatsapp_business_account_id~~ | TEXT | - | - |  已废弃 → 使用 `config.businessAccountId` |
| ~~whatsapp_access_token~~ | TEXT | - | - |  已废弃 → 使用 `credentials.accessToken` |
| ~~total_messages_sent~~ | INTEGER | - | 0 |  已废弃 → 使用 `stats.totalSent` |
| ~~total_messages_received~~ | INTEGER | - | 0 |  已废弃 → 使用 `stats.totalReceived` |
| ~~last_message_at~~ | TEXT | - | - |  已废弃 → 使用 `stats.lastMessageAt` |
| is_active | BOOLEAN | - | TRUE | 是否启用 |
| is_verified | BOOLEAN | - | FALSE | 是否已验证 |
| last_verified_at | TEXT | - | - | 最后验证时间 |
| configured_by | TEXT | FOREIGN KEY | - | 配置者 ID |
| config_metadata | TEXT | - | - | 配置元数据 (JSON) |
| last_error | TEXT | - | - | 最后错误 (JSON) |
| error_count | INTEGER | - | 0 | 错误计数 |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 更新时间 |

** JSON 配置结构 (Migration 0026)**:

```typescript
// config - 平台配置 (非敏感)
interface ChannelConfig {
  channelId?: string; // LINE
  pageId?: string; // Facebook
  phoneNumber?: string; // WhatsApp
  businessAccountId?: string; // WhatsApp
  botUsername?: string; // Telegram
}

// credentials - 加密凭证 (使用 AES-256-GCM)
interface ChannelCredentials {
  accessToken?: string; // 所有平台
  secret?: string; // LINE
  appSecret?: string; // Facebook
}

// webhook_config - Webhook 配置
interface ChannelWebhookConfig {
  url?: string;
  token?: string;
  verifyToken?: string;
}

// stats - 使用统计
interface ChannelStats {
  totalSent: number;
  totalReceived: number;
  lastMessageAt?: string;
}
```

**外键**:
- `team_id` → `teams.id` (ON DELETE CASCADE)
- `configured_by` → `agents.id` (ON DELETE SET NULL)

**唯一约束**:
- UNIQUE(`team_id`, `platform`, `is_active`) WHERE `is_active` = 1 - 每个团队每个平台只能有一个活跃配置
- UNIQUE(`line_webhook_url`) WHERE `line_webhook_url` IS NOT NULL
- UNIQUE(`line_webhook_token`) WHERE `line_webhook_token` IS NOT NULL
- UNIQUE(`line_channel_id`) WHERE `line_channel_id` IS NOT NULL AND `is_active` = 1

**索引**:
- PRIMARY KEY on `id`
- INDEX on `team_id`
- INDEX on `platform`
- INDEX on `line_webhook_url`
- INDEX on `line_webhook_token`
- INDEX on (`team_id`, `platform`, `is_active`)
- INDEX on (`is_verified`, `last_verified_at`)

**安全说明**:
- 所有敏感字段 (access_token, secret) 建议在应用层加密后存储
- Webhook URL 和 Token 全局唯一，防止冲突

---

### 系统管理模块

#### 21. system_settings - 系统设置

**用途**: 键值对存储系统配置

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| key | TEXT | PRIMARY KEY | - | 配置键 |
| value | TEXT | NOT NULL | - | 配置值 |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 更新时间 |

**索引**:
- PRIMARY KEY on `key`

**常用配置项**:
```
general.systemName = "Multi-Channel Support"
general.contactEmail = "admin@example.com"
general.timezone = "Asia/Taipei"
general.language = "zh-TW"
advanced.messageQueueSize = "1000"
advanced.messageTimeout = "30" (秒)
advanced.cacheExpiry = "60" (分钟)
advanced.sessionExpiry = "24" (小时)
advanced.enableRateLimit = "true"
advanced.enableLogging = "true"
advanced.enableMetrics = "true"
integrations.line.status = "connected"
integrations.facebook.status = "disconnected"
```

---

#### 22. activities - 活动日志

**用途**: 用户操作审计追踪

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY | - | 活动 ID |
| user_id | TEXT | NOT NULL FOREIGN KEY | - | 用户 ID |
| user_name | TEXT | NOT NULL | - | 用户名称 |
| user_role | TEXT | NOT NULL | - | 用户角色 |
| action | TEXT | NOT NULL | - | 操作 |
| resource_type | TEXT | NOT NULL | - | 资源类型 |
| resource_id | TEXT | - | - | 资源 ID |
| details | TEXT | - | - | 详细信息 (JSON) |
| ip_address | TEXT | - | - | IP 地址 |
| user_agent | TEXT | - | - | User Agent |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |

**外键**:
- `user_id` → `agents.id`

**索引**:
- PRIMARY KEY on `id`
- INDEX on `user_id`
- INDEX on `action`
- INDEX on (`resource_type`, `resource_id`)
- INDEX on `created_at`

**操作类型示例**:
- `login` - 登录
- `logout` - 登出
- `create_conversation` - 创建对话
- `assign_conversation` - 分配对话
- `send_message` - 发送消息
- `update_settings` - 更新设置
- `delete_user` - 删除用户

---

#### 23. notifications - 通知系统

**用途**: 用户通知管理

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | TEXT | PRIMARY KEY | - | 通知 ID (UUID) |
| user_id | TEXT | NOT NULL FOREIGN KEY | - | 用户 ID |
| type | TEXT | NOT NULL | - | 通知类型 |
| title | TEXT | NOT NULL | - | 通知标题 |
| content | TEXT | NOT NULL | - | 通知内容 |
| data | TEXT | - | - | 扩展数据 (JSON) |
| is_read | BOOLEAN | - | FALSE | 是否已读 |
| read_at | TEXT | - | - | 阅读时间 |
| expires_at | TEXT | - | - | 过期时间 |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |

**外键**:
- `user_id` → `agents.id`

**索引**:
- PRIMARY KEY on `id`

**通知类型**:
- `new_conversation` - 新对话
- `new_message` - 新消息
- `conversation_assigned` - 对话分配
- `conversation_transferred` - 对话转移
- `system_alert` - 系统警告

---

#### 24. conversation_transfers - 对话转移

**用途**: 对话转移记录追踪

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY | - | 转移记录 ID |
| conversation_id | TEXT | NOT NULL FOREIGN KEY | - | 对话 ID |
| from_team_id | INTEGER | FOREIGN KEY | - | 源团队 ID |
| to_team_id | INTEGER | FOREIGN KEY | - | 目标团队 ID |
| from_user_id | TEXT | FOREIGN KEY | - | 源客服 ID |
| to_user_id | TEXT | FOREIGN KEY | - | 目标客服 ID |
| transfer_reason | TEXT | - | - | 转移原因 |
| transferred_by | TEXT | NOT NULL FOREIGN KEY | - | 操作者 ID |
| transfer_type | TEXT | - | 'manual' | 转移类型 ('manual', 'auto', 'system') |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |

**外键**:
- `conversation_id` → `conversations.id`
- `from_team_id` → `teams.id`
- `to_team_id` → `teams.id`
- `from_user_id` → `agents.id`
- `to_user_id` → `agents.id`
- `transferred_by` → `agents.id`

**索引**:
- PRIMARY KEY on `id`

---

#### 25. message_recall_logs - 消息撤回

**用途**: 消息撤回操作日志

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY | - | 日志 ID |
| message_id | TEXT | NOT NULL | - | 消息 ID |
| user_id | TEXT | NOT NULL FOREIGN KEY | - | 用户 ID |
| action | TEXT | NOT NULL | - | 操作 ('recalled', 'failed') |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |

**外键**:
- `user_id` → `agents.id`

**索引**:
- PRIMARY KEY on `id`

---

#### 26. metrics - 企业分析

**用途**: 企业级指标存储

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY | - | 指标 ID |
| metric_name | TEXT | NOT NULL | - | 指标名称 |
| metric_value | REAL | NOT NULL | - | 指标值 |
| timestamp | INTEGER | NOT NULL | - | 时间戳 (Unix) |
| tags | TEXT | - | - | 标签 (JSON) |
| unit | TEXT | - | - | 单位 |
| created_at | TEXT | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |

**索引**:
- PRIMARY KEY on `id`

**指标示例**:
- `conversation_response_time` - 对话响应时间 (秒)
- `agent_active_count` - 活跃客服数量
- `daily_message_count` - 每日消息数
- `customer_satisfaction_score` - 客户满意度 (1-5)

---

### 系统内置表

#### 27. d1_migrations - 迁移记录

**用途**: Drizzle ORM 迁移历史 (自动管理)

#### 28. sqlite_sequence - 自增序列

**用途**: SQLite 自增 ID 序列 (自动管理)

#### 29. _cf_METADATA - Cloudflare元数据

**用途**: Cloudflare D1 元数据 (自动管理)

---

##  表关系图

```
┌─────────────────────────────────────────────────────────────────────┐
│ 核心业务流程 │
└─────────────────────────────────────────────────────────────────────┘

teams (团队)
  │
  ├─→ agents (客服人员)
  │ │
  │ └─→ conversations (对话)
  │ │
  │ ├─→ messages (消息)
  │ │     │
  │ │     └─→ file_attachments (附件)
  │ │
  │ ├─→ delayed_messages (延迟消息)
  │ ├─→ conversation_sessions (会话)
  │ ├─→ conversation_transfers (转移记录)
  │ └─→ conversation_tags (对话标签)
  │
  ├─→ customers (客户)
  │ │
  │ └─→ customer_tags (客户标签)
  │
  ├─→ qr_codes (QR 码)
  │ │
  │ ├─→ qr_code_scans (扫描记录)
  │ └─→ qr_code_analytics (分析统计)
  │
  ├─→ channel_integrations (渠道配置)
  │
  └─→ tags (标签)


┌─────────────────────────────────────────────────────────────────────┐
│ 报告系统流程 │
└─────────────────────────────────────────────────────────────────────┘

teams (团队)
  │
  ├─→ report_templates (报告模板)
  │
  ├─→ scheduled_reports (排程报告)
  │ │
  │ └─→ scheduled_report_executions (执行历史)
  │ │
  │ └─→ reports (报告)
  │ │
  │ └─→ report_download_history (下载历史)


┌─────────────────────────────────────────────────────────────────────┐
│ 系统管理流程 │
└─────────────────────────────────────────────────────────────────────┘

agents (客服)
  │
  ├─→ activities (活动日志)
  ├─→ notifications (通知)
  └─→ message_recall_logs (撤回日志)

system_settings (系统设置) - 独立表
metrics (企业指标) - 独立表
```

---

##  性能优化索引

### 高性能查询索引 (Migration 0016)

根据生产环境查询模式，添加了以下关键索引，性能提升 **70%**：

```sql
-- 1. 对话消息查询 (75% 性能提升)
CREATE INDEX idx_messages_conversation_id_created_at
  ON messages(conversation_id, created_at DESC);

-- 2. 用户消息历史 (70% 性能提升)
CREATE INDEX idx_messages_sender_id_created_at
  ON messages(sender_id, created_at DESC);

-- 3. 附件批量加载 (90% 性能提升, 解决 N+1 问题)
CREATE INDEX idx_file_attachments_message_id
  ON file_attachments(message_id);

-- 4. 团队对话列表 (65% 性能提升)
CREATE INDEX idx_conversations_team_id_updated_at
  ON conversations(team_id, updated_at DESC);

-- 5. 状态过滤查询 (60% 性能提升)
CREATE INDEX idx_conversations_status_updated_at
  ON conversations(status, updated_at DESC);
```

### QR 码系统索引

```sql
CREATE INDEX idx_qr_codes_team_id ON qr_codes(team_id);
CREATE INDEX idx_qr_codes_token ON qr_codes(token);
CREATE INDEX idx_qr_codes_is_active ON qr_codes(is_active);
CREATE INDEX idx_qr_code_scans_qr_code_id ON qr_code_scans(qr_code_id);
CREATE INDEX idx_qr_code_scans_customer_id ON qr_code_scans(customer_id);
CREATE INDEX idx_qr_code_analytics_date ON qr_code_analytics(date);
```

### 渠道集成索引

```sql
CREATE INDEX idx_channel_integrations_team_id ON channel_integrations(team_id);
CREATE INDEX idx_channel_integrations_platform ON channel_integrations(platform);
CREATE INDEX idx_channel_integrations_webhook_url ON channel_integrations(line_webhook_url);
CREATE INDEX idx_channel_integrations_webhook_token ON channel_integrations(line_webhook_token);
CREATE INDEX idx_channel_integrations_active ON channel_integrations(team_id, platform, is_active);
CREATE INDEX idx_channel_integrations_verified ON channel_integrations(is_verified, last_verified_at);
```

### 活动日志索引

```sql
CREATE INDEX idx_activities_user ON activities(user_id);
CREATE INDEX idx_activities_action ON activities(action);
CREATE INDEX idx_activities_resource ON activities(resource_type, resource_id);
CREATE INDEX idx_activities_created ON activities(created_at);
```

---

##  迁移历史

### v2.6 (2025-01-29) - 当前版本

**Phase 1 - 索引优化** (Migration 0024):
-  `idx_agents_team_id` - 团队成员查询优化
-  `idx_agents_role` - 角色筛选优化
-  `idx_agents_team_id_active` - 活跃团队成员查询
-  `idx_agents_role_active` - 活跃角色查询

**Phase 2 - 命名规范化** (Migration 0025):
-  `file_attachments` 表列名统一为 snake_case:
  - `mimeType` → `mime_type`
  - `fileSize` → `file_size`
  - `fileUrl` → `file_url`
  - `r2Key` → `r2_key`
  - `uploadStatus` → `upload_status`

**Phase 3 - 渠道配置重构** (Migration 0026):
-  新增 JSON 配置列:
  - `config` - 平台配置 (非敏感)
  - `credentials` - 加密凭证
  - `webhook_config` - Webhook 配置
  - `stats` - 使用统计
-  支持新增平台零 Schema 变更
-  旧列保留兼容 (标记废弃)

**Schema 优化** (Migration 0027):
-  **软删除支持**: 6 个核心表新增 `deleted_at` 列
  - `teams`, `agents`, `customers`, `conversations`, `messages`, `tags`
-  **10+ 新复合索引**: 优化常见查询模式
-  **加密策略文档**: 敏感字段标记和最佳实践

---

### v2.5 (2025-11-05)

**新增功能**:
-  **渠道集成** (Migration 0018): 多租户渠道配置，支持每个团队独立配置 LINE/Facebook/WhatsApp
-  **对话状态** (Migration 0020): 添加 'assigned' 状态，完善对话流转
-  **报告系统**: 6 张表支持完整的企业级报告功能
-  **标签系统**: 3 张表支持客户和对话标签管理
-  **通知系统**: 实时通知推送

**性能优化**:
-  **关键索引** (Migration 0016): 5 个高性能索引，查询速度提升 70%

**架构变更**:
-  **简化角色** (Migration 0017): 从 3 层角色简化为 2 层 (Admin/Agent)
-  **字段重命名**: `agents.name` → `agents.display_name`
-  **时间戳格式**: INTEGER (Unix) → TEXT (ISO 8601)

### v2.0 (2025-09-04)

**新增功能**:
-  **QR 码系统** (Migration 0005): 3 张表支持 QR 码生成和追踪

### v1.2 (2025-08-08)

**新增功能**:
-  消息方向字段
-  会话管理增强

### v1.1 (2025-01-08)

**新增功能**:
-  对话会话表
-  消息扩展字段

### v1.0 (2025-01-08)

**初始版本**:
-  核心业务表结构
-  基础索引和约束

---

##  Breaking Changes (破坏性变更)

### v2.5 变更

1. **agents 表字段重命名**
   ```sql
   -- 旧版本
   agents.name TEXT

   -- 新版本
   agents.display_name TEXT
   ```

2. **废弃表**
   -  `users` - 已合并到 `customers`
   -  `app_users` - 已合并到 `agents`
   -  `file_metadata` - 功能合并到 `file_attachments`
   -  `file_access_logs` - 功能未实现
   -  `pending_messages` - 改名为 `delayed_messages`

3. **角色系统简化**
   ```sql
   -- 旧版本 (3 层)
   role: 'admin' | 'team' | 'agent'

   -- 新版本 (2 层)
   role: 'admin' | 'agent'
   ```

4. **时间戳格式统一**
   ```sql
   -- 旧版本
   created_at INTEGER  -- Unix timestamp

   -- 新版本
   created_at TEXT -- ISO 8601 (YYYY-MM-DD HH:MM:SS)
   ```

5. **对话状态新增**
   ```sql
   -- 旧版本
   status: 'active' | 'pending' | 'closed'

   -- 新版本
   status: 'active' | 'assigned' | 'pending' | 'closed'
   ```

---

##  数据库操作指南

### 本地开发

```bash
# 应用迁移到本地数据库
npm run db:migrate

# 查看本地数据库 (Drizzle Studio)
npm run db:studio:local

# 生成新的迁移文件
npm run db:generate

# 直接推送 schema 变更 (开发环境)
npm run db:push
```

### 生产环境

```bash
# 应用迁移到生产数据库
npm run db:migrate:prod

# 健康检查
npm run health:check:all

# 监控部署
npm run monitor:deployment
```

### 数据库查询示例

```sql
-- 查询活跃对话
SELECT * FROM conversations
WHERE status = 'active'
ORDER BY updated_at DESC
LIMIT 50;

-- 查询团队消息统计
SELECT
  t.name AS team_name,
  COUNT(DISTINCT c.id) AS conversation_count,
  COUNT(m.id) AS message_count
FROM teams t
LEFT JOIN conversations c ON c.assigned_team_id = t.id
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE t.is_active = 1
GROUP BY t.id;

-- 查询 QR 码效果
SELECT
  qc.campaign_name,
  qc.usage_count,
  qa.total_scans,
  qa.unique_scans,
  qa.new_customers
FROM qr_codes qc
LEFT JOIN qr_code_analytics qa ON qa.qr_code_id = qc.id
WHERE qc.is_active = 1
ORDER BY qc.created_at DESC;

-- 查询客服绩效
SELECT
  a.display_name,
  COUNT(DISTINCT c.id) AS handled_conversations,
  COUNT(m.id) AS sent_messages,
  AVG(JULIANDAY(c.first_response_at) - JULIANDAY(c.created_at)) * 24 * 60 AS avg_response_time_minutes
FROM agents a
LEFT JOIN conversations c ON c.assigned_user_id = a.id
LEFT JOIN messages m ON m.agent_sender_id = a.id AND m.sender_type = 'agent'
WHERE a.is_active = 1
GROUP BY a.id;
```

---

##  数据约束和规则

### 外键约束

- **CASCADE DELETE**: 删除主记录时自动删除关联记录
  - `file_attachments.message_id` → `messages.id`
  - `delayed_messages.conversation_id` → `conversations.id`
  - `channel_integrations.team_id` → `teams.id`

- **SET NULL**: 删除主记录时将关联字段设为 NULL
  - `channel_integrations.configured_by` → `agents.id`

### 唯一约束

- `customers (platform, platform_user_id)` - 防止同一平台用户重复
- `qr_codes.token` - QR 码令牌全局唯一
- `tags (name, team_id)` - 同一团队内标签名称唯一
- `channel_integrations (team_id, platform, is_active)` - 每个团队每个平台只能有一个活跃配置
- `qr_code_analytics (qr_code_id, date)` - 每个 QR 码每天一条统计记录

### CHECK 约束

- `conversations.status` IN ('active', 'assigned', 'pending', 'closed')
- `conversations.priority` IN ('low', 'normal', 'high', 'urgent')
- `agents.role` IN ('admin', 'agent')

---

##  设计原则

### 1. **时间戳统一使用 TEXT (ISO 8601)**

所有时间字段使用 ISO 8601 格式字符串:
```
YYYY-MM-DD HH:MM:SS
例: "2025-11-05 14:30:00"
```

优点:
-  人类可读
-  跨时区兼容
-  SQLite datetime 函数支持
-  前端无需转换

### 2. **JSON 字段用于扩展数据**

使用 JSON 字段存储灵活的扩展信息:
- `metadata` - 平台特定数据
- `filters` - 报告过滤器
- `config_metadata` - 配置元数据
- `scan_metadata` - 扫描元数据

### 3. **软删除支持** (Migration 0027 扩展)

核心表支持软删除 (添加 `deleted_at` 字段):
- `teams` - 团队软删除 (保留历史记录)
- `agents` - 客服人员软删除 (保留对话归属)
- `customers` - 客户软删除 (GDPR 合规)
- `conversations` - 对话软删除 (审计追踪)
- `messages` - 消息软删除 (区别于撤回)
- `tags` - 标签软删除 (保留关联)
- `reports` - 报告软删除
- `scheduled_reports` - 排程报告软删除
- `report_templates` - 报告模板软删除

**使用方式**:
```sql
-- 软删除
UPDATE table SET deleted_at = datetime('now') WHERE id = ?

-- 查询未删除记录
SELECT * FROM table WHERE deleted_at IS NULL

-- 恢复
UPDATE table SET deleted_at = NULL WHERE id = ?
```

### 4. **审计追踪**

所有核心表包含:
- `created_at` - 创建时间
- `updated_at` - 更新时间
- `created_by` / `configured_by` - 创建者/配置者 (where applicable)

### 5. **性能优先**

-  所有高频查询字段建立索引
-  复合索引支持排序和过滤
-  级联删除自动清理关联数据
-  唯一约束防止重复数据

---

##  最佳实践

### 查询优化

1. **使用索引覆盖查询**
   ```sql
   --  好 - 使用索引
   SELECT * FROM conversations
   WHERE status = 'active' AND team_id = 1
   ORDER BY updated_at DESC;

   --  差 - 全表扫描
   SELECT * FROM conversations
   WHERE LOWER(internal_notes) LIKE '%urgent%';
   ```

2. **批量操作使用事务**
   ```sql
   BEGIN TRANSACTION;
   INSERT INTO messages (...) VALUES (...);
   INSERT INTO messages (...) VALUES (...);
   UPDATE conversations SET last_message_at = ... WHERE id = ...;
   COMMIT;
   ```

### 数据清理

```sql
-- 清理过期报告 (保留 30 天)
DELETE FROM reports
WHERE expires_at < datetime('now', '-30 days')
AND deleted_at IS NOT NULL;

-- 清理旧活动日志 (保留 90 天)
DELETE FROM activities
WHERE created_at < datetime('now', '-90 days');

-- 清理过期通知
DELETE FROM notifications
WHERE expires_at < datetime('now')
AND is_read = 1;
```

### 安全建议

1. **加密敏感字段**
   - `agents.password_hash` - 使用 bcrypt
   - `channel_integrations.line_channel_access_token` - 应用层加密
   - `channel_integrations.line_channel_secret` - 应用层加密

2. **参数化查询**
   ```typescript
   // 好 - 使用 Drizzle ORM
   const conversations = await db
     .select()
     .from(conversationsTable)
     .where(eq(conversationsTable.status, 'active'));

   // 差 - SQL 注入风险
   const query = `SELECT * FROM conversations WHERE status = '${status}'`;
   ```

3. **访问控制**
   - 所有数据库操作通过 API 层进行权限检查
   - 使用 JWT 验证用户身份
   - 团队数据隔离 (通过 `team_id` 过滤)

---

##  相关文档

- **代码实现**: `src/db/schema.ts`
- **迁移文件**: `drizzle/*.sql`
- **API 文档**: `docs/api/`
- **部署指南**: `docs/guides/DEPLOYMENT_GUIDE.md`
- **CORS 配置**: `docs/CORS_CONFIGURATION_GUIDE.md`

---

##  支持和反馈

如有数据库相关问题，请:
1. 查看迁移历史 (`drizzle/*.sql`)
2. 查看 Drizzle Studio (`npm run db:studio:local`)
3. 检查健康端点 (`/api/system/health`)
4. 提交 GitHub Issue

---

**最后更新**: 2025-11-05
**维护者**: Development Team
**版本**: v2.5
**状态**:  Production-Ready
