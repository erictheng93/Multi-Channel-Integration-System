# Notifications 模組 — 多渠道通知中心

> **位置**: `src/modules/notifications/`  
> **角色**: 把「值得用戶知道的事」打包成通知，透過 WebSocket / Email / Push 多管道送達。

---

## 1. 這個模組是什麼？

當系統發生事件（新訊息、對話被指派、被 @mention、系統公告），通知模組決定：要通知誰、用什麼管道、優先級多高、有沒有過期時間。它讓客服不需要一直盯著對話列表也能知道「該處理新事情了」。

## 2. 解決什麼問題？

| 場景 | 通知模組做什麼 |
|---|---|
| 客戶傳新訊息給某客服 | 該客服收到 `new_message` 通知（WebSocket 即時 + Email 摘要） |
| 主管把對話指派給小李 | 小李即刻收到 `conversation_assigned` |
| 系統明天凌晨要維護 | 管理員觸發 `system_broadcast`，全員收到（高優先級） |
| 客服漏看通知 | 未讀紅點顯示在系統右上角，可一鍵全部標記已讀 |

## 3. 主要功能

- **多渠道遞送**：WebSocket（即時）+ Email + Push 通知（行動裝置）
- **通知類型**：`new_message` / `conversation_assigned` / `conversation_transferred` / `mention` / `system` / `customer_responded` / `task_reminder` / `agent_removed_from_team` / `customer_followed` / `new_conversation`
  - 註：`priority_changed` 已於 2026-08-04 移除——其觸發器沒有任何呼叫點，生產環境也沒有任何一筆該類型的資料
- **優先級**：low / normal / high — high 在 WebSocket 通道會優先處理
- **未讀計數**：每種類型獨立計數，紅點 badge 直接綁定
- **批次操作**：一次建立多筆、一次標記同類全已讀
- **自動過期**：可設 `expiresAt`，過期後由清理任務刪除
- **系統公告**：管理員工具，廣播給所有在線客服

## 4. 操作介面入口

| 介面 | 看到什麼 |
|---|---|
| `NotificationList.vue` | 完整通知列表，可篩選類型、已讀狀態 |
| AppLayout 右上角鈴鐺 | 未讀計數紅點 + 下拉最近 N 筆 |
| `SystemSettings.vue` | 管理員觸發系統公告 |

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET | `/api/notifications` | 列表（含篩選、分頁） |
| POST | `/api/notifications` | 建立單筆 |
| POST | `/api/notifications/bulk` | 批次建立 |
| PUT | `/api/notifications/:id/read` | 標記已讀 |
| PUT | `/api/notifications/read-all` | 全部已讀（可指定類型） |
| DELETE | `/api/notifications/:id` | 刪除 |
| GET | `/api/notifications/stats` | 未讀計數、類型分布 |
| GET | `/api/notifications/unread-count` | 快速計數（有快取） |
| GET | `/api/notifications/recent?limit=10` | 最近 N 筆 |
| POST | `/api/notifications/test-channel/:channelType` | 測試 Email/Push 遞送 |
| POST | `/api/notifications/system-broadcast` | （管理員）全站廣播 |
| POST | `/api/notifications/cleanup` | （管理員）清理過期通知 |

## 6. 涉及的 Durable Objects

- **`MessageBroadcaster`**（透過 websocket-adapter）— 系統公告廣播給所有在線用戶
- **`UserConnection`**（如啟用 WebSocket 通道）— 用戶範圍通知遞送

## 7. 邊界案例與小細節

- **批次建立非全有全無**：部分失敗時，回傳成功 ID 與失敗錯誤分開列出
- **未讀計數有 5 分鐘 KV 快取**：個別通知標記已讀**不會**立即更新計數，須等快取失效
- **Email/Push 是非同步**：API 立即回 ID，遞送結果另外記錄
- **過期預設不啟用**：須管理員明確設定 `expiresAt` 才會被清理任務處理
- **系統公告失敗不抛錯**：找不到收件人會優雅退出，不會中斷請求

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| 鈴鐺紅點數字不準 | KV 快取 5 分鐘窗口；可手動呼叫 `/unread-count` 強制刷新 |
| Email 沒收到 | 用 `/test-channel/email` 測試；看 channel-stats |
| 通知一直累積很多 | 設定 `expiresAt` + 排程跑 `/cleanup` |

---

**相關模組**：[realtime](./realtime.md)（事件來源）、[activities](./activities.md)（操作日誌）
