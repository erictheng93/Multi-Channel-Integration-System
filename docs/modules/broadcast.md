# Broadcast 模組 — 標籤精準群發

> **位置**: `src/modules/broadcast/`
> **角色**: 對「被打上特定標籤的客戶」主動推送 LINE 訊息(精準行銷群發),而非全體廣播。
> **完整規格**: [`docs/development/BROADCAST_MESSAGING_SPEC.md`](../development/BROADCAST_MESSAGING_SPEC.md) — 本文件是使用者導向摘要,設計決策與 Phase 2/3 規劃請看該文件。
> **目前實作範圍**: Phase 1(MVP)已完成;Phase 2(Facebook 發送、多標籤 AND/OR、Queue 化、報表頁)尚未實作。

---

## 1. 這個模組是什麼？

客服主管可以選一個標籤(如「製造業」),系統列出目前帶這個標籤的 LINE 客戶,輸入訊息內容後一鍵群發,並在完成後看到每一位收件人的發送結果。

## 2. 解決什麼問題？

| 場景 | Broadcast 模組做什麼 |
|---|---|
| 想對「VIP」標籤的客戶推播促銷訊息 | 選標籤 → 預覽人數 → 撰寫內容 → 送出 |
| 想知道群發前有多少人符合資格 | `POST /preview` 即時顯示可發 / 略過人數 |
| 想確認每個人是否真的收到 | `GET /:id/recipients` 逐人查看 sent/failed/skipped 與原因 |
| 想避免超過 LINE 月配額而中斷發送 | 發送前自動查配額,不足時整批擋下(不會部分發送) |
| 群發訊息要留存在客戶對話紀錄裡 | 發送成功者會寫回既有對話(`metadata.broadcastId`) |

## 3. 主要功能(Phase 1)

- **受眾預覽**:僅需 `tagIds`,不需先填標題/內容即可即時看到符合人數
- **單標籤群發**:Phase 1 僅接受 1 個 `tagId`(多個回 `422 PHASE1_SINGLE_TAG_ONLY`)
- **受眾快照**:建立時展開受眾寫入 `broadcast_recipients`,發送以快照為準,不受後續標籤異動影響
- **Token 解析**:依客戶所屬團隊的 LINE 憑證解密取得 access token;找不到則 fallback 全域 `env.LINE_CHANNEL_ACCESS_TOKEN`;皆無則該收件人標 `skipped: no_channel_credentials`
- **配額預檢**:發送前查 LINE 月配額,不足時整組標 `skipped: quota_insufficient`,不會部分發送
- **逐人結果回填**:呼叫 `multicastLineMessage()` 後用 `failedUserIds` 回填每位收件人的 `sent` / `failed`
- **寫回對話**:發送成功者若已有(未軟刪)對話,插入一則 agent 訊息(含 `metadata.broadcastId`);無對話者不建新對話
- **人數上限**:單次群發 LINE 可發人數上限 5,000(超過回 `422`)
- **冪等防重**:`draft → sending` 為條件式 UPDATE,雙擊送出只會真的發一次

**Phase 1 明確不做**(尚未實作,見 spec §2):Facebook 發送(FB 客戶一律標 `skipped: platform_not_supported_phase1`)、排程群發、圖片/Flex 訊息、多標籤交集/聯集、Queue 非同步發送。

## 4. 操作介面入口

| 介面 | 用途 |
|---|---|
| `BroadcastView.vue`(路由 `/broadcasts`) | 主入口頁 |
| `BroadcastComposeCard.vue` | 選標籤 → 預覽人數 → 輸入內容 → 發送 |
| `BroadcastHistoryList.vue` | 群發歷史列表(狀態、統計) |
| `BroadcastDetailModal.vue` | 收件人明細(依 status 過濾) |
| `stores/broadcasts.ts`(Pinia) | 狀態管理:`fetchPreview`、`createAndSend`、`fetchList`、`fetchDetail`、`fetchRecipients`,以及 `loading`/`previewLoading`/`sending`/`error` 旗標 |
| `api/broadcasts.ts` | 對應六個後端端點的 API client |

側邊欄「群發訊息」入口對權限不足者隱藏(見下方權限規則)。

## 5. 主要 API 端點

全部掛 `jwtAuth`,路由前綴 `/api/broadcasts`(`src/index.ts:320`)。

| 方法 | 路徑 | 用途 |
|---|---|---|
| POST | `/api/broadcasts/preview` | 受眾預覽(不落庫),請求體僅需 `tagIds` |
| POST | `/api/broadcasts` | 建立群發 + 展開受眾快照(狀態 `draft`) |
| POST | `/api/broadcasts/:id/send` | 執行發送(同步);非 `draft` 回 `409`,超過 5000 人回 `422` |
| GET | `/api/broadcasts` | 歷史列表(分頁) |
| GET | `/api/broadcasts/:id` | 單筆詳情 |
| GET | `/api/broadcasts/:id/recipients` | 收件人明細(分頁,可 `?status=` 過濾) |

**權限**:`user.role === 'admin'` 或任一團隊角色為 `lead`/`supervisor`,否則所有端點回 `403`(`requireBroadcastPermission`,`handlers/broadcast-main.ts`)。

## 6. 涉及的 Durable Objects

**不使用 DO**。發送為 Worker 內同步流程,直接呼叫 `multicastLineMessage()`(`src/utils/line-modules/line-messaging.ts`)。

## 7. 邊界案例與小細節

- **受眾快照 vs 即時查詢**:建立群發當下就把符合標籤的客戶展開存進 `broadcast_recipients`;之後就算客戶標籤被改掉,已建立的群發仍以快照為準
- **FB 客戶不會被呼叫任何 API**:Phase 1 直接在受眾分類階段標記 `skipped`,不會誤發
- **配額不足是全有全無**:同一批(同一 token)配額不足時整組跳過,不會發一半
- **例外中斷保護**:發送流程中若拋出例外,尚未處理的收件人標 `failed`,broadcast 狀態標 `partial_failed`,不會卡在 `sending`
- **禁止呼叫 `broadcastLineMessage()`**(全好友廣播):本功能明確只用 `multicastLineMessage()`(指定收件人),誤用會對所有 LINE 好友發送並可能超額計費

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| Preview 顯示人數與預期不符 | 確認標籤 `is_active=1` 且客戶未被軟刪;快照時間點與查詢時間點可能有落差 |
| 收件人一直是 `skipped: no_channel_credentials` | 檢查該客戶所屬團隊是否有啟用中的 LINE `channelIntegrations`,或確認 `env.LINE_CHANNEL_ACCESS_TOKEN` fallback 是否設定 |
| 送出後對話沒看到訊息 | 確認該客戶本來就有(未軟刪的)對話——無對話者不會建立新對話,只會記錄在 `broadcast_recipients` |
| 401/403 存不到群發頁 | 確認使用者是 `admin` 或在至少一個團隊有 `lead`/`supervisor` 角色 |

---

**相關模組**:[tags](./tags.md)(受眾來源)、[integrations](./integrations.md)(LINE 憑證)、[customer](./customer.md)
