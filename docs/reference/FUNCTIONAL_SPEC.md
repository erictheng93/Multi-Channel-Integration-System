# Multi-Channel Integration System Functional Specification

**Canonical status:** This document is the functional truth source for product capabilities.  
**Created:** 2026-05-21  
**Scope:** User-facing features, module responsibilities, primary UI entry points, API surfaces, realtime behavior, and known implementation/documentation gaps.

## 1. How To Use This Document

Use this file before README, legacy guides, or generated reports when answering "what does the system support?".

The source hierarchy is:

1. This file: canonical functional scope and current caveats.
2. `src/core/route-config.ts`, `src/index.ts`, and `src/modules/**/handlers`: route truth.
3. `frontend/src/router/index.ts`, `frontend/src/components/ui/SidebarNav.vue`, and `frontend/src/api/*`: UI/API client truth.
4. `docs/modules/*.md`: module manuals and design context.
5. Legacy guides under `docs/guides`, `docs/reference/standards`, and `docs/history`: background only unless validated against code.

`docs/reference/api/API_REFERENCE.md` is a navigation-level API index. It is not a complete endpoint specification by itself.

## 2. Product Summary

The system is a multi-channel customer support platform for centralized conversation handling across LINE OA, Facebook Messenger, web/customer chat, and future channels. It supports team-scoped customer service, realtime collaboration, message operations, tagging, auto-reply rules, reporting, monitoring, and data export.

The current role model is dual-layer:

- System role: `admin` or `agent`.
- Team role: `member`, `lead`, or `supervisor`, stored per team.
- JWT embeds `primaryTeamId`, `allowedTeamIds[]`, and `teamRoles{}`.
- Conversation assignment is team-only in v4. Individual-agent assignment has been removed from the main workflow.

## 3. Feature Coverage Map

| Area | Status | Canonical Modules |
|---|---|---|
| Authentication and sessions | Implemented | Auth, Session |
| Team management and multi-team membership | Implemented with documentation gaps | Teams, Agents, Auth |
| Conversation management, assignment, transfer | Implemented | Conversations, Realtime, WebSocket |
| Messaging, attachments, search, recall, forward | Implemented | Messaging, File Management |
| Delayed messages | Implemented | Delayed Message, Queue |
| Customer profiles and tags | Implemented | Customer, Tags |
| Auto-reply rules, schedules, logs | Implemented with UI doc drift | Auto-Reply, Integrations |
| Realtime collaboration and notifications | Implemented | WebSocket, Realtime, Collaboration, Notifications |
| Channel integrations and LIFF QR binding | Implemented | Integrations, LIFF, Teams |
| Analytics and reports | Implemented with export caveats | Analytics, Reports |
| Data management and conversation export | Implemented in UI for message export; documentation fragmented | Messaging, Data Management UI |
| Activity audit logs | Implemented; export route mismatch exists | Activities |
| Monitoring, health, queues | Implemented | Monitoring, System, Queue |

## 4. User-Facing Navigation

The main frontend feature entry points are:

| UI Route | Feature |
|---|---|
| `/conversations` | Conversation list, filters, bulk actions, export entry |
| `/conversations/:id` | Conversation detail, messages, attachments, assignment state, export dialog |
| `/customers/tags` | Customer and tag management |
| `/data/export` | Data management: conversation record export |
| `/reports/*` | Report dashboard, templates, generation, report library |
| `/team` | Team, member, QR, and password management |
| `/auto-reply` | Auto-reply rules, business schedules, trigger logs |
| `/settings/*` | System, integration, webhook, health, and advanced settings |

## 5. Core Functional Specification

### 5.1 Authentication

Auth handles login, token refresh, logout, profile retrieval, admin account creation, credential storage, password policies, and session tracking.

Capabilities:

- Email/password login.
- Access token and refresh token lifecycle.
- Refresh re-reads DB team membership so team changes can take effect.
- Multi-team role claims in JWT.
- Password policy support: `changeable`, `unchangeable`, `must_change`.
- Temporary password-change tokens.
- Session storage in KV with `Session-ID` tracking.
- Login failure lockout after repeated failures.
- Backward-compatible password hash migration support.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/profile`, `/api/auth/me` | Current user |
| POST | `/api/auth/register` | Admin creates account |
| POST | `/api/auth/change-password` | User password change |
| POST | `/api/auth/credentials/store`, `/api/auth/credentials/get` | Admin credential storage |

### 5.2 Team Management

Teams organize customer service work. A user may belong to multiple teams with independent roles in each team.

Capabilities:

- Team CRUD and soft deletion.
- Team statistics: member count, active members, conversation count.
- Multi-team membership through `agent_teams`.
- Per-team role assignment and primary-team designation.
- Team-scoped access checks and role hierarchy.
- Team member list, create, edit, status change, role change, delete.
- Bulk member delete, bulk member update, batch edit, and undo.
- Duplicate email/member checking before creation.
- Password reset with password policy.
- Team transfer for members and associated conversations.
- Team QR code generation, LIFF QR code, latest/fast QR lookup, scan stats, and deactivation.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/teams` | List/create teams |
| GET/PUT/DELETE | `/api/teams/:id` | Team detail/update/delete |
| GET | `/api/teams/stats/all` | Admin global team stats |
| GET | `/api/teams/search/:query` | Search teams |
| POST | `/api/teams/transfer` | Admin cross-team transfer |
| GET/POST | `/api/teams/:id/members` | Team members list/add |
| PUT/DELETE | `/api/teams/:id/members/:agentId` | Team membership update/remove |
| POST | `/api/teams/:id/members/batch` | Batch add members |
| POST | `/api/teams/:id/members/bulk-remove` | Batch remove members |
| GET/POST | `/api/teams/members` | Cross-team member list/create |
| GET | `/api/teams/members/check-email` | Duplicate email check |
| PUT | `/api/teams/members/:memberId/status` | Member active status |
| PUT | `/api/teams/members/:memberId/role` | Member role |
| PUT/DELETE | `/api/teams/members/:memberId` | Member update/delete |
| POST | `/api/teams/members/bulk-delete` | Bulk delete members |
| POST | `/api/teams/members/bulk-update` | Bulk update members |
| POST | `/api/teams/members/batch-edit` | Batch edit members |
| POST | `/api/teams/members/batch-edit/undo` | Undo batch edit |
| POST | `/api/teams/members/:memberId/reset` | Reset password |
| GET | `/api/teams/agent-teams/:agentId` | List agent memberships |
| POST | `/api/teams/agent-teams/:agentId/join` | Add agent to team |
| POST | `/api/teams/agent-teams/:agentId/join-multiple` | Add agent to multiple teams |
| DELETE | `/api/teams/agent-teams/:agentId/leave/:teamId` | Remove agent from team |
| PUT | `/api/teams/agent-teams/:agentId/role/:teamId` | Update per-team role |
| PUT | `/api/teams/agent-teams/:agentId/primary/:teamId` | Set primary team |
| GET | `/api/teams/agent-teams/team/:teamId/members` | Members through agent-teams service |
| GET/POST | `/api/teams/:id/qr-code/liff` | LIFF QR code |
| GET | `/api/teams/:id/qr-code/liff/stats` | LIFF QR stats |
| GET | `/api/teams/:id/qr-code/latest` | Latest QR |
| GET | `/api/teams/:id/qr-code/fast` | Fast QR lookup |
| POST | `/api/teams/:id/qr-code` | Generate team QR |
| GET | `/api/teams/:id/qr-codes` | List team QR codes |
| PUT | `/api/teams/:id/qr-codes/:qrCodeId/deactivate` | Deactivate QR |

Current caveats:

- Existing module docs overstate email invitation completeness. Treat email invitation as not canonical unless verified in handler code.
- QR is primarily for customer/team binding through LIFF, not a general staff invitation replacement.

### 5.3 Agents

Agents are customer service users managed directly or through team management.

Capabilities:

- Agent CRUD.
- Batch role/status updates.
- Batch cross-team transfer.
- Advanced search by email, name, status, team.
- Online/away/busy/offline status.
- Status history.
- Skill CRUD and skill statistics.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/agents` | List/create agents |
| GET/PUT/DELETE | `/api/agents/:id` | Agent detail/update/delete |
| PUT | `/api/agents/batch` | Batch update |
| PUT | `/api/agents/batch/transfer` | Batch transfer |
| POST | `/api/agents/search` | Advanced search |
| GET | `/api/agents/status/statistics` | Status statistics |
| GET/POST | `/api/agents/:id/status` | Get/set status |
| GET | `/api/agents/:id/status/history` | Status history |
| GET/POST/PUT/DELETE | `/api/agents/:id/skills` | Skills |
| GET | `/api/agents/:id/skills/statistics` | Skill statistics |

### 5.4 Conversations

Conversations are the main customer service work unit. They track status, priority, team assignment, tags, messages, and transfer history.

Capabilities:

- Conversation list, filter, pagination, and detail.
- Status flow: `active`, `pending`, `in-progress`, `waiting`, `assigned`.
- Team-only assignment.
- Unassignment.
- Cross-team transfer with `conversationTransfers` audit history.
- Conversation tag add/remove/list.
- Bulk operations up to 100 conversations per request.
- Priority: `normal`, `high`, `urgent`.
- Read-state update.
- Conversation messages and attachments route integration.
- Latest message preview and cache coordination.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/conversations` | List/filter/paginate |
| GET | `/api/conversations/:id` | Detail |
| POST | `/api/conversations/bulk` | Bulk operations |
| POST | `/api/conversations/:id/assign` | Assign team |
| POST | `/api/conversations/:id/unassign` | Unassign |
| POST | `/api/conversations/:id/transfer` | Cross-team transfer |
| GET/POST/DELETE | `/api/conversations/:id/tags` | Conversation tags |
| GET/POST | `/api/conversations/:id/messages` | Conversation messages |
| POST | `/api/conversations/:id/attachments` | Conversation attachment |
| PUT | `/api/conversations/:id/read` | Mark read |

Current caveat:

- Individual-agent assignment is not part of v4 workflow. Any old personal assignment behavior must be treated as removed or legacy-only.

### 5.5 Messaging

Messaging owns message content operations, including CRUD, recall, search, forward, attachments, tags, and message export.

Capabilities:

- Message create/read/update/delete.
- Recall using `isRecalled`, `recalledAt`, and permission/deadline checks.
- Search by query and filters.
- Message statistics.
- Conversation message listing.
- Bulk create/delete.
- Forward one message to up to 20 conversations.
- Attachments through R2-backed file handling.
- Message tags.
- Export messages as JSON, CSV, or TXT.
- Frontend can generate PDF exports client-side by fetching JSON export data.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/messages` | Create message |
| GET/PUT/DELETE | `/api/messages/:id` | Message detail/update/recall |
| GET | `/api/messages/conversation/:conversationId` | Conversation messages |
| GET | `/api/messages/search` | Search |
| GET | `/api/messages/stats` | Stats |
| GET | `/api/messages/tags` | Tag summary |
| PUT/DELETE | `/api/messages/:id/tags` | Message tags |
| GET/POST | `/api/messages/:id/attachments` | Attachments |
| POST | `/api/messages/:id/forward` | Forward |
| POST | `/api/messages/bulk-create` | Bulk create |
| POST | `/api/messages/bulk-delete` | Bulk recall/delete |
| GET | `/api/messages/export` | Export messages |
| GET | `/api/messages/export/count` | Export count and truncation estimate |
| GET | `/api/messages/export/agents` | Export filter agents |
| GET | `/api/messages/export/customers` | Export filter customers |

Export behavior:

- Backend accepts `format=json`, `format=csv`, and `format=txt`.
- Frontend accepts `json`, `csv`, `txt`, and `pdf`; PDF is produced client-side after fetching JSON.
- Export filters include conversation, date range, customer, agent, and limit.

Current documentation caveat:

- Some docs still say `POST /api/messages/export`; the implemented export route is `GET /api/messages/export`.

### 5.6 Data Management

Data management is the user-facing export workflow.

Capabilities:

- Sidebar entry under `/data/export`.
- Export conversation records for backup, analysis, and archival.
- Choose JSON, CSV, TXT, or PDF in the frontend.
- Date range and limit controls.
- Uses the messaging export API for actual data retrieval.

Primary frontend files:

- `frontend/src/views/DataManagement.vue`
- `frontend/src/components/data-management/DataExport.vue`
- `frontend/src/components/conversation/ExportDialog.vue`
- `frontend/src/api/export.ts`

Current caveat:

- There is no standalone backend `data-management` module. The feature is composed from frontend UI plus `/api/messages/export`.

### 5.7 Delayed Messages

Delayed Message supports scheduled outbound messages and fast recall.

Capabilities:

- Schedule message send.
- Recall scheduled or recently sent delayed messages.
- Reschedule existing delayed message.
- Pending list.
- Status lookup.
- User statistics.
- Durable Object alarms through `DelayedMessageScheduler`.
- Realtime status feedback.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/delayed-messages/send` | Schedule/send delayed message |
| POST | `/api/delayed-messages/recall/:messageId` | Recall |
| POST | `/api/delayed-messages/reschedule/:messageId` | Reschedule |
| GET | `/api/delayed-messages/pending` | Pending list |
| GET | `/api/delayed-messages/status/:messageId` | Status |
| GET | `/api/delayed-messages/stats/:userId` | Stats |
| GET | `/api/delayed-messages/health` | Health |

### 5.8 Customers

Customer stores end-user profiles and links them to platform identities, conversations, teams, and tags.

Capabilities:

- Cross-platform identity by `(platform, platformUserId)`.
- Customer profile storage: display name, avatar, email, phone, metadata.
- Platform ID lookup.
- Customer detail with conversations.
- Customer tag list/add/replace/remove.
- Source team tracking.
- Filter by platform, team, tag, email/phone presence, and dates.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/customers` | List/filter |
| GET | `/api/customers/platform/:platform/:platformUserId` | Platform lookup |
| GET | `/api/customers/:customerId` | Detail |
| GET/POST/PUT/DELETE | `/api/customers/:customerId/tags` | Customer tags |
| GET | `/api/customers/tags/available` | Available tags with conversation count |

### 5.9 Tags

Tags classify customers and conversations.

Capabilities:

- Tag CRUD with team scope.
- Global tags through null `team_id`.
- Hex color normalization.
- Multi-tag assignment to customers and conversations.
- Usage statistics.
- Tag customer and conversation listings.
- Bulk assign/unassign.
- Soft delete with audit-friendly behavior.
- Activity logging for CRUD and bulk actions.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/tags` | List/create |
| GET/PUT/DELETE | `/api/tags/:id` | Detail/update/delete |
| GET | `/api/tags/:id/stats` | Usage stats |
| GET | `/api/tags/:id/customers` | Tagged customers |
| GET | `/api/tags/:id/conversations` | Tagged conversations |
| POST | `/api/tags/bulk` | Bulk assign/unassign |
| GET | `/api/tags/health` | Health |

### 5.10 Auto-Reply

Auto-Reply evaluates inbound LINE messages and follow events against rules, schedules, and actions.

Capabilities:

- Rule CRUD.
- Trigger types: keyword, regex, message type, outside business hours, welcome.
- Condition matching with any/all behavior and case sensitivity.
- Action chains: text, image, Flex Message.
- Priority and enabled/disabled state.
- Team-scoped and global rules.
- Business schedule CRUD/upsert by team.
- Trigger logs with filters.
- KV rule/schedule cache invalidation.
- Evaluation on LINE message events.
- Welcome rule evaluation on LINE follow events.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/auto-reply/rules` | List/create rules |
| PUT/DELETE | `/api/auto-reply/rules/:id` | Update/delete rules |
| GET/POST | `/api/auto-reply/schedules` | Get/upsert schedules |
| GET | `/api/auto-reply/logs` | Trigger logs |

Current documentation caveat:

- Some module docs still call schedule/log UI "planned"; the current `/auto-reply` view includes `ScheduleGrid` and `LogTable`.

### 5.11 Customer Conversations

Customer Conversations bridges the end-customer chat surface to the support backend.

Capabilities:

- Customer-side WebSocket entry.
- Session ID based access instead of JWT.
- Customer message send/list.
- Customer upload.
- Durable Objects for customer conversation and message flows.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/customer-ws` | Customer WebSocket |
| POST | `/api/customer-conversations/:id/messages` | Send customer message |
| GET | `/api/customer-conversations/:id/messages` | List customer messages |
| POST | `/api/customer-conversations/:id/upload` | Customer upload |

### 5.12 File Management

File Management stores, retrieves, and manages uploaded files using R2.

Capabilities:

- Multipart upload.
- R2 storage.
- File metadata persistence.
- Public/download URL behavior.
- File statistics.
- MIME and size validation.
- Optional thumbnail/preview behavior.
- Soft delete.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/files/health` | R2 and DB health |
| GET | `/api/files/info` | Feature info |
| GET | `/api/files/stats/summary` | 30-day stats |
| POST | `/api/files` | Upload |
| GET | `/api/files/:fileId` | Retrieve |
| DELETE | `/api/files/:fileId` | Delete |

### 5.13 Integrations

Integrations manage external messaging channels and webhook credentials.

Capabilities:

- Channel CRUD for LINE and Facebook.
- Extensible channel schema for WhatsApp, Telegram, Instagram, WeChat.
- Credential encryption.
- Channel health check.
- Channel verification.
- Channel statistics.
- Webhook validation.
- Per-team channel settings.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/channels` | List/create channels |
| GET/PUT/DELETE | `/api/channels/:id` | Detail/update/delete |
| GET | `/api/channels/:id/stats` | Stats |
| GET | `/api/channels/:id/health` | Health |
| POST | `/api/channels/:id/verify` | Verify |
| GET/POST | `/api/webhook` | LINE webhook verification/events |

### 5.14 LIFF

LIFF supports LINE QR team binding and customer onboarding.

Capabilities:

- LIFF config endpoint.
- Team lookup for LIFF UI.
- Customer-team assignment.
- Welcome message flow.
- Scan tracking and QR attribution.
- Reassignment/transfer when customer scans a new team QR.
- WebSocket broadcast for team assignment/transfer.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/liff/config` | LIFF config |
| GET | `/api/liff/health` | Health |
| GET | `/api/liff/teams/:teamId` | Team lookup |
| POST | `/api/liff/assign-team` | Bind customer to team |
| POST | `/api/liff/welcome` | Welcome + broadcast |

### 5.15 WebSocket

WebSocket is the realtime transport for support users.

Capabilities:

- HTTP upgrade for WebSocket connection.
- Multi-tab synchronization.
- User connection tracking.
- Conversation room membership.
- Heartbeat/reconnect behavior.
- Per-user and global connection limits.
- Health checks.
- Batched event delivery.
- Graceful disconnect.
- Migration status from v3 to v4.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/websocket/connect` | WebSocket upgrade |
| POST | `/api/websocket/disconnect` | Disconnect |
| GET | `/api/websocket/health` | Health |
| GET | `/api/websocket/migration-status` | Migration status |
| GET | `/api/websocket/test-connection` | Test endpoint |
| GET | `/api/websocket/dashboard/*` | Admin monitoring dashboard |
| GET | `/api/websocket/analytics/*` | WebSocket analytics |

Durable Objects:

- `UserConnection`
- `ConversationRoom`
- `MessageBroadcaster`

### 5.16 Realtime Events

Realtime is the typed event layer over WebSocket and related broadcasters.

Capabilities:

- Typing start/stop.
- Presence update.
- Assignment change event.
- Message/status/notification/system event families.
- Conversation-scoped broadcast.
- System announcement.
- Event priority routing.
- Event statistics.
- Admin event configuration.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/realtime/typing` | Typing status |
| POST | `/api/realtime/presence` | Presence |
| POST | `/api/realtime/broadcast-to-conversation` | Custom conversation event |
| POST | `/api/realtime/send-*-event` | Typed event family |
| GET | `/api/realtime/stats` | Stats |
| GET/POST | `/api/realtime/config` | Config |

### 5.17 Collaboration

Collaboration tracks viewers, typing, and presence for shared conversation work.

Capabilities:

- Current viewers.
- Typing indicators with user identity.
- Join/leave events.
- Online state with current conversation.
- Room state snapshot.
- Expired state cleanup.
- WebSocket-backed or HTTP fallback behavior.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/collaboration/conversations/:id/state` | Room state |
| GET | `/api/collaboration/conversations/:id/viewers` | Viewers |
| POST | `/api/collaboration/conversations/:id/join` | Join room |
| POST | `/api/collaboration/conversations/:id/leave` | Leave room |
| POST | `/api/collaboration/typing` | Typing |
| POST | `/api/collaboration/presence` | Presence |
| GET | `/api/collaboration/stats` | Stats |
| POST | `/api/collaboration/cleanup` | Cleanup |

### 5.18 Notifications

Notifications deliver system and workflow events to users.

Capabilities:

- Notification list and detail.
- Create single or bulk notifications.
- Mark read and mark all read.
- Delete notification.
- Stats and unread count.
- Recent notifications.
- Channel testing.
- System broadcast.
- Cleanup expired notifications.
- Notification types: new message, assignment, transfer, mention, system, priority, customer response, task reminder.
- WebSocket delivery and optional Email/Push channel behavior.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/notifications` | List |
| POST | `/api/notifications` | Create |
| POST | `/api/notifications/bulk` | Bulk create |
| PUT | `/api/notifications/:id/read` | Mark read |
| PUT | `/api/notifications/read-all` | Mark all read |
| DELETE | `/api/notifications/:id` | Delete |
| GET | `/api/notifications/stats` | Stats |
| GET | `/api/notifications/unread-count` | Unread count |
| GET | `/api/notifications/recent` | Recent |
| POST | `/api/notifications/test-channel/:channelType` | Test delivery channel |
| POST | `/api/notifications/system-broadcast` | Admin broadcast |
| POST | `/api/notifications/cleanup` | Cleanup |

### 5.19 Sessions

Sessions split long conversations into analytical segments.

Capabilities:

- Session create/list/update lifecycle.
- Close and reopen.
- Get-or-create workflow.
- Boundary detection.
- Session message list.
- Health analysis.
- Topic extraction and suggestions.
- Full-text search.
- Batch close/reopen/delete.
- Activity trends.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/sessions` | Create |
| GET | `/api/sessions` | List |
| POST | `/api/sessions/:id/close` | Close |
| POST | `/api/sessions/:id/reopen` | Reopen |
| GET | `/api/sessions/:id/messages` | Session messages |
| GET | `/api/sessions/:id/health` | Health |
| POST | `/api/sessions/detect-boundary` | Boundary detection |
| POST | `/api/sessions/get-or-create` | Get/create |
| GET | `/api/sessions/search` | Search |
| POST | `/api/sessions/topics/analyze` | Analyze topics |
| POST | `/api/sessions/topics/suggest` | Suggest topics |
| POST | `/api/sessions/batch` | Batch operations |

### 5.20 Analytics

Analytics provides operational metrics and dashboards.

Capabilities:

- Conversation analytics.
- Message analytics.
- User analytics.
- Performance analytics.
- Custom analytics queries.
- Metrics write/read.
- Export analytics results.
- Dashboard configuration, widgets, templates, optimized layouts.
- Realtime dashboard update/broadcast.
- Period comparison presets and cache stats.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/analytics/conversations` | Conversation metrics |
| GET | `/api/analytics/messages` | Message metrics |
| GET | `/api/analytics/users` | User metrics |
| GET | `/api/analytics/performance` | Performance metrics |
| POST | `/api/analytics/custom` | Custom query |
| POST | `/api/analytics/export` | Export analytics |
| GET | `/api/analytics/health` | Health |
| POST | `/api/analytics/metrics` | Write metric |
| GET | `/api/analytics/metrics/:name` | Read metric |
| GET/POST/PUT | `/api/analytics/dashboard/*` | Dashboard configuration/data/widgets/templates |
| GET/POST | `/api/analytics/realtime/*` | Realtime dashboard |
| GET | `/api/analytics/comparison/*` | Period comparison |

Current caveat:

- `POST /api/analytics/export` exists, but `generateExportFile()` currently returns a stub URL. Treat analytics export as not production-complete until file generation/storage is verified.

### 5.21 Reports

Reports generate persistent report artifacts from analytics and other data.

Capabilities:

- 20+ report types.
- Format support by type: JSON, CSV, Excel, PDF, HTML.
- Templates.
- Preview with sample data.
- Report library.
- Download URL.
- Scheduled reports: daily, weekly, monthly, email.
- Batch operations.
- Report statistics.
- Access control: admin all, agent own.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/reports/health`, `/api/reports/info` | Health/info |
| POST | `/api/reports` | Generate |
| GET | `/api/reports` | List |
| GET | `/api/reports/:id` | Detail |
| GET | `/api/reports/:id/download` | Download URL |
| DELETE | `/api/reports/:id` | Delete |
| GET | `/api/reports/stats` | Stats |
| POST | `/api/reports/batch` | Batch |
| GET | `/api/reports/templates/:type` | Templates |
| POST | `/api/reports/preview` | Preview |
| GET/POST/PUT/DELETE | `/api/reports/scheduled` | Scheduled reports |

### 5.22 Activities

Activities are immutable audit logs for system actions.

Capabilities:

- Activity list/detail.
- User stats.
- Admin overview.
- Resource, role, and custom stats.
- Trends.
- Heatmap.
- Metrics.
- Cleanup old records.
- Role visibility: admin sees all, agent sees own.
- Fail-open activity writing so main operations are not blocked by log failure.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/activities` | List/filter/paginate |
| GET | `/api/activities/:id` | Detail |
| GET | `/api/activities/user/:userId/stats` | User stats |
| GET | `/api/activities/overview` | Overview |
| GET | `/api/activities/trends` | Trends |
| GET | `/api/activities/heatmap` | Heatmap |
| GET | `/api/activities/metrics` | Metrics |
| GET | `/api/activities/stats/resources` | Resource stats |
| GET | `/api/activities/stats/roles` | Role stats |
| GET | `/api/activities/stats/custom` | Custom stats |
| POST | `/api/activities/cleanup` | Cleanup |

Current caveat:

- Frontend `activitiesApi.export()` calls `/api/activities/export`, but the registered activities router does not currently expose that route. Treat activity export as a known gap until backend route support is added or frontend is changed.

### 5.23 Monitoring

Monitoring provides operational health, metrics, circuit breaker, alert, instance, CORS, security, KV, and API-monitoring surfaces.

Capabilities:

- Public and admin health.
- Metrics and response-time tracking.
- Alert list/history.
- Manual health checks.
- Circuit breaker status/open/reset.
- Durable Object instance inspection.
- CORS event/stats monitoring.
- Security monitoring/dashboard.
- KV optimization monitoring and savings.
- API monitor dashboard/history/config.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/monitoring/health` | Health |
| GET | `/api/monitoring/metrics` | Metrics |
| GET | `/api/monitoring/alerts` | Alerts |
| GET | `/api/monitoring/alerts/history` | Alert history |
| POST | `/api/monitoring/health-check` | Manual health check |
| GET | `/api/monitoring/circuit-breaker/status` | Circuit breaker status |
| POST | `/api/monitoring/circuit-breaker/reset` | Reset breaker |
| POST | `/api/monitoring/circuit-breaker/open` | Open breaker |
| GET | `/api/monitoring/instances/:type` | DO instances |
| GET | `/api/monitoring/kv/*` | KV optimization monitoring |
| GET | `/api/cors/*` | CORS monitoring |
| GET | `/api/security/*` | Security monitoring/dashboard |

### 5.24 Queue

Queue handles asynchronous outbound and media processing work.

Capabilities:

- Cloudflare Queue for LINE messages/media payloads.
- Fast HTTP response before slow channel operations complete.
- Retry and backoff.
- Batch delivery.
- Idempotency through platform message identifiers.
- WebSocket status updates.
- Queue monitoring stats, health, and metrics.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/queue/monitor/stats` | Queue stats |
| GET | `/api/queue/monitor/health` | Queue health |
| GET | `/api/queue/monitor/metrics` | Queue metrics |
| GET | `/api/queues/*` | Queue monitor router |

### 5.25 System

System provides infrastructure-level health, status, settings, config, credentials, feedback, and API index behavior.

Capabilities:

- Public health check.
- Detailed status.
- Dashboard KPIs.
- API index.
- System settings read/update.
- Runtime config export/import.
- Integration test endpoints.
- System logs.
- System metrics/stats.
- Maintenance mode.
- Credentials storage.
- Feedback collection and stats.
- Message tree and replies.
- Conversation sessions.

Primary API surface:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Public health |
| GET | `/api/system/status` | Detailed status |
| GET | `/api/stats` | KPIs |
| GET | `/api/api` | API index |
| GET/PUT | `/api/system/settings` | Settings |
| GET | `/api/system/config/export` | Config export |
| POST | `/api/system/config/import` | Config import |
| GET | `/api/system/logs` | Logs |
| GET | `/api/system/metrics` | Metrics |
| GET/POST | `/api/system/maintenance` | Maintenance |
| POST/GET/DELETE | `/api/credentials` | Credentials |
| POST/GET | `/api/feedback` | Feedback |
| GET | `/api/conversations/:id/message-tree` | Message tree |
| GET | `/api/messages/:id/replies` | Replies |
| GET | `/api/conversations/:id/sessions` | Conversation sessions |

## 6. Cross-Cutting Rules

### Permissions

- Most API routes require JWT.
- Admin bypasses team-level restrictions.
- Agents are constrained by `allowedTeamIds` and `teamRoles`.
- Lead/supervisor permissions are evaluated within a specific team.
- Team-scoped resources must validate team membership.

### Data Lifecycle

- Soft deletion is preferred for teams, agents, customers, conversations, messages, and tags.
- Activity logs are immutable.
- Some logs and reports have cleanup/retention endpoints.
- Message export and report export are separate features.

### Realtime Delivery

- v4 uses WebSocket only; SSE is removed.
- Durable Objects coordinate user connections, conversation rooms, broadcasting, rate limiting, and metrics.
- Low-priority events can be batched; urgent events are expected to bypass batching.

### Exports

Export-like functions exist in several places and must not be conflated:

| Feature | Entry | Current State |
|---|---|---|
| Conversation/message export | `/data/export`, conversation export dialog, `/api/messages/export` | Implemented; JSON/CSV/TXT backend, PDF frontend |
| Analytics export | `/api/analytics/export` | Route exists; file generator currently stubbed |
| Reports download/export | `/api/reports/:id/download`, `/api/reports/batch` | Report-module feature |
| Activity export | Frontend calls `/api/activities/export` | Backend route gap |
| System config export | `/api/system/config/export` | Configuration export, not data export |

## 7. Known Gaps And Required Follow-Up

These are part of the canonical truth source until fixed:

1. `docs/guides/USER_GUIDE.md` is not reliable for v4 product behavior. It appears incomplete/legacy and should not be used as the canonical user manual.
2. `docs/reference/DOCUMENTATION_INDEX.md` is a partial index and does not enumerate all current functional modules.
3. `docs/reference/api/MESSAGING_API_REFERENCE.md` is useful for message export but is not complete:
   - It omits `txt`.
   - It omits `/api/messages/export/count`, `/api/messages/export/agents`, and `/api/messages/export/customers`.
   - It should be checked against `src/modules/messaging/handlers/messaging/routes/export.ts`.
4. `docs/modules/messaging.md` states `POST /api/messages/export`; implementation uses `GET /api/messages/export`.
5. `docs/modules/teams.md` misses several actual endpoints under `/api/teams/members/*` and `/api/teams/agent-teams/*`.
6. `docs/modules/teams.md` describes email invitation as if complete; treat it as unverified.
7. `docs/modules/auto-reply.md` says schedules/logs UI is planned, but current frontend integrates schedule and log tabs.
8. `docs/modules/analytics.md` says export supports JSON/CSV/PDF; current backend export file generation is stubbed and must be verified before claiming production-ready exports.
9. `docs/modules/activities.md` says activity export exists in `ActivityLog.vue`, and frontend calls `/api/activities/export`, but backend route registration does not expose that endpoint.

## 8. Maintenance Rules For This Spec

When adding or changing a feature:

1. Update this file in the same PR.
2. Update the matching `docs/modules/*.md` manual.
3. If a route changes, update this file and route-facing API reference docs.
4. If the feature has a UI entry, update the UI route table.
5. If implementation and docs disagree, this file must name the disagreement explicitly until fixed.
6. Do not describe planned work as implemented. Use "planned", "stubbed", or "known gap".

