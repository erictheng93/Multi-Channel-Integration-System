# 模組手冊索引 (Module Manuals Index)

> 26 個後端模組的使用者導向手冊。每份手冊以「這個模組做什麼」「解決什麼問題」「主要功能」「UI 入口」「API 端點」「DO 觸點」「邊界案例」「常見疑難」八節撰寫。

**最後更新**: 2026-07-05

---

## 一、對話與訊息核心

| 模組 | 一句話定位 |
|------|------------|
| [conversations](./conversations.md) | 對話總調度（指派、狀態、轉移、批次） |
| [messaging](./messaging.md) | 訊息核心引擎（CRUD、撤回、轉發、搜尋、匯出） |
| [delayed-message](./delayed-message.md) | 延遲發送與即時撤回（DO Alarm） |
| [customer-conversations](./customer-conversations.md) | 客戶端聊天 WebSocket 橋接 |
| [session](./session.md) | 對話會話切分（注意：非登入會話） |

## 二、客戶與標籤

| 模組 | 一句話定位 |
|------|------------|
| [customer](./customer.md) | 客戶身分整合（跨平台聚合） |
| [tags](./tags.md) | 對話與客戶分類標籤 |
| [auto-reply](./auto-reply.md) | 規則型自動回覆（含營業時間） |
| [broadcast](./broadcast.md) | 標籤精準群發（LINE，Phase 1） |

## 三、認證與團隊

| 模組 | 一句話定位 |
|------|------------|
| [auth](./auth.md) | JWT 認證、密碼策略、多團隊編碼 |
| [teams](./teams.md) | 團隊 / 成員 / QR Code / 邀請 |
| [agents](./agents.md) | 客服個體管理（狀態、技能、批次） |

## 四、渠道整合

| 模組 | 一句話定位 |
|------|------------|
| [integrations](./integrations.md) | LINE / FB 等多渠道憑證與健康 |
| [liff](./liff.md) | LINE LIFF QR 團隊綁定 |

## 五、即時通訊

| 模組 | 一句話定位 |
|------|------------|
| [websocket](./websocket.md) | WebSocket 連線基石 |
| [realtime](./realtime.md) | 即時事件總匯（打字、指派、狀態） |
| [collaboration](./collaboration.md) | 協作狀態與在場感 |
| [notifications](./notifications.md) | 多渠道通知中心 |

## 六、系統與營運

| 模組 | 一句話定位 |
|------|------------|
| [system](./system.md) | 健康檢查與 KPI 索引 |
| [monitoring](./monitoring.md) | 細粒度可觀測性與斷路器 |
| [analytics](./analytics.md) | 業務指標彙整 |
| [reports](./reports.md) | 報表引擎（20+ 類型、排程） |
| [activities](./activities.md) | 全系統稽核日誌 |
| [queue](./queue.md) | 非同步訊息傳遞與重試 |
| [file-management](./file-management.md) | R2 檔案上傳與下載 |
| [data](./data.md) | D1 手動備份與下載（admin-only） |

---

## 與其他文檔的關係

```
modules/      ← 你在這裡（使用者手冊）
architecture/ ← 系統設計、效能優化、資料庫
reference/api/ ← 機讀 API 規格
guides/       ← 部署、CORS、KV 最佳實踐
claude/       ← Claude Code 開發指引
```

- 想知道**某模組怎麼用** → modules/
- 想知道**模組之間怎麼連** → architecture/MODULE_DEPENDENCY_DIAGRAM.md
- 想知道**API 規格細節** → reference/api/
- 想**部署 / 維運** → guides/

---

## Durable Objects 速查表

| DO | 主要服務模組 |
|----|--------------|
| `ConversationRoom` | conversations, messaging, realtime, collaboration |
| `UserConnection` | websocket, realtime, collaboration |
| `MessageBroadcaster` | messaging, notifications, liff, queue |
| `DelayedMessageBuffer` *(alias for `DelayedMessageScheduler`)* | delayed-message |
| `LockCoordinator` *(在 services/ 不在 durable-objects/)* | 分散式鎖（跨模組） |
| `LatestMessageCacheCoordinator` | conversations |
| `CustomerConversationDO` | customer-conversations |
| `CustomerMessageDO` | customer-conversations, file-management |
| `RateLimiterDO` | monitoring (middleware) |
| `MetricsCollectorDO` | monitoring, analytics |

> 完整 DO 對應與綁定名 ↔ 實作檔差異說明見 `docs/CURRENT_STATUS.md` §2。
