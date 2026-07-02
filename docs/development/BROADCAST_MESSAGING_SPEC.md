# Spec: 標籤精準群發（Broadcast Messaging via Push API）

> **狀態**: Phase 1 待實作 ｜ **撰寫**: Claude（2026-07-02）｜ **實作**: Eric ｜ **驗收**: Claude
> **前置調查結論**: 標籤→客戶→通道身分的資料鏈路已完整；`multicastLineMessage()` 已實作但零呼叫者；缺的是群發編排層（API + 資料表 + UI + 發送追蹤）。

---

## 1. Objective（目標）

讓客服對「被打上特定標籤的客戶」主動推送訊息（精準行銷），而非全體廣播。

**使用者故事**：
- 作為客服主管，我可以選擇標籤（如「製造業」），預覽符合人數，撰寫訊息後一鍵群發給這群 LINE 客戶。
- 作為客服主管，我可以在群發後看到每一位收件人的發送結果（成功／失敗／略過＋原因）。
- 作為系統，我在發送前檢查 LINE 月配額，不足時擋下發送，避免超額計費或發送中斷。

**成功樣貌（Phase 1）**：從 UI 選一個標籤 → 顯示「符合 N 人（LINE x / FB y）」→ 輸入文字訊息 → 送出 → LINE 客戶實際收到推播 → 報表顯示逐人結果。

---

## 2. 全案分期總覽

| Phase | 範圍 | 出貨判準 |
|-------|------|---------|
| **1 (MVP)** | LINE 單標籤群發、同步發送、配額預檢、逐人追蹤、基本 UI | 客服能完成一次真實 LINE 群發並看到逐人結果 |
| **2** | FB 發送（24hr 視窗檢查）、多標籤 AND/OR、Queue 化大量發送、發送報表頁、權限細化 | FB 客戶可發、5000+ 人不逾時、報表完整 |
| **3** | 排程群發、訊息模板、成效統計、（評估）LINE Narrowcast | 可指定未來時間發送；模板可複用 |

**Phase 1 明確不做**（防 scope creep）：FB 發送（標記 skipped）、排程、圖片/Flex 訊息（純文字）、多標籤交集（單標籤）、Queue 非同步（同步 + 人數上限）。

---

## 3. 既有資產（實作時直接複用，勿重寫）

| 資產 | 位置 | 用途 |
|------|------|------|
| `multicastLineMessage(accessToken, userIds, messages, opts)` → `MulticastResult` | `src/utils/line-modules/line-messaging.ts:112` | LINE 批次發送（自動 500/批、去重、指數退避重試）。**目前零呼叫者，本功能是第一個消費者** |
| `MulticastResult`（含 `failedUserIds`） | 同上 `:88` | 逐人結果回填的依據 |
| `getLineMessageQuota(accessToken)` / `getLineMessageUsage(accessToken)` | 同上 `:367` / `:406` | 配額預檢 |
| `createTextMessage(text)` | `src/utils/line`（經 `line-modules/index.ts` re-export） | 組 LINE 文字訊息 |
| `ChannelCredentialService` | `src/modules/integrations/services/channel-credential-service.ts` | 解密 `channelIntegrations.credentials` 取 accessToken |
| 標籤→客戶查詢（含 `platform`, `platform_user_id`，分頁） | `src/modules/tags/services/tag-service.ts` `getTagCustomers`（`GET /tags/:id/customers`） | 受眾解析的參考實作（群發需自己寫不分頁的全量版本） |
| `requireTeamRole(role, teamIdParam)` / JWT `teamRoles{}` | `src/middleware/auth.ts:564` | 權限判斷 |
| `jwtAuth` middleware | `src/middleware/auth.ts` | 所有群發端點必掛 |
| Drizzle client factory | `src/db/drizzle-factory.ts` `createDbClient(env.DB)` | DB 存取 |
| Queue + DLQ（Phase 2 用） | `wrangler.toml:97-110`、`src/modules/queue/handlers/line-message-queue.ts` | 非同步發送的模板 |

**重要現況**：既有 1:1 發送（queue consumer `line-message-queue.ts:105`）使用**全域** `env.LINE_CHANNEL_ACCESS_TOKEN`，而非按團隊憑證。本 spec 的 token 解析策略（§5.3）與此保持相容。

---

## 4. 已拍板的架構決策

| # | 決策 | 內容 |
|---|------|------|
| D1 | **Token 解析** | `customers.sourceTeamId` → `channelIntegrations`（`platform='line'`, `isActive=1`）解密取 token；解不到時 fallback 到 `env.LINE_CHANNEL_ACCESS_TOKEN`；兩者皆無 → 該收件人標 `skipped: no_channel_credentials` |
| D2 | **寫回對話** | 發送成功的收件人，若已有對話（最近一筆未軟刪），插入一筆 message（`senderType='agent'`、`metadata` 含 `broadcastId`）；無對話者不建新對話（僅記錄在 recipients 表） |
| D3 | **權限** | Phase 1: 系統 `admin`，或任一團隊角色為 `lead`/`supervisor` 者可群發；Phase 2 細化 |
| D4 | **受眾快照** | 建立群發時即展開受眾寫入 `broadcast_recipients`（快照 `platform_user_id`），發送以快照為準，不受後續標籤變動影響 |
| D5 | **Phase 1 同步發送上限** | 單次群發 LINE 可發人數上限 **5,000**（10 次 multicast API 呼叫內），超過回 `422` 要求等 Phase 2 |
| D6 | **create 與 send 分離** | `POST /api/broadcasts`（建立+快照）與 `POST /api/broadcasts/:id/send`（執行）分開，為排程與審核預留 |

---

## 5. Phase 1 詳細設計

### 5.1 資料模型（`src/db/schema.ts` 新增兩張表）

遵循現有慣例：snake_case 欄位、`text` 時間戳 + `CURRENT_TIMESTAMP`、軟刪除 `deletedAt`。

```typescript
// Broadcasts table - 群發活動
export const broadcasts = sqliteTable('broadcasts', {
  id: text('id').primaryKey(),                    // crypto.randomUUID()
  title: text('title').notNull(),                 // 活動名稱（內部辨識用）
  contentType: text('content_type').notNull().default('text'), // Phase 1 僅 'text'
  content: text('content').notNull(),             // 純文字訊息內容
  tagIds: text('tag_ids').notNull(),              // JSON array，Phase 1 僅單元素
  matchMode: text('match_mode').notNull().default('any'), // 'any' | 'all'（Phase 1 固定 any）
  status: text('status').notNull().default('draft'),
  // 'draft' | 'sending' | 'completed' | 'partial_failed' | 'failed'
  totalRecipients: integer('total_recipients').default(0),
  sentCount: integer('sent_count').default(0),
  failedCount: integer('failed_count').default(0),
  skippedCount: integer('skipped_count').default(0),
  createdBy: text('created_by').notNull().references(() => agents.id, { onDelete: 'restrict' }),
  sentAt: text('sent_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text('deleted_at'),
});

// Broadcast recipients table - 群發收件人明細（受眾快照 + 逐人結果）
export const broadcastRecipients = sqliteTable('broadcast_recipients', {
  id: integer('id').primaryKey(),
  broadcastId: text('broadcast_id').notNull().references(() => broadcasts.id, { onDelete: 'cascade' }),
  customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  platform: text('platform').notNull(),           // 快照
  platformUserId: text('platform_user_id').notNull(), // 快照
  resolvedTeamId: integer('resolved_team_id'),    // D1 決策解析出的憑證團隊，可為 null（fallback token）
  status: text('status').notNull().default('pending'),
  // 'pending' | 'sent' | 'failed' | 'skipped'
  errorReason: text('error_reason'),
  // 'platform_not_supported_phase1' | 'no_channel_credentials' | 'line_api_failed' | 'quota_insufficient'
  sentAt: text('sent_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  broadcastCustomerUnique: unique().on(table.broadcastId, table.customerId),
}));
```

Migration：`bun run db:generate` 產生 → 檢視 SQL → `bun run db:migrate`（remote）→ `bun run db:sync:local`。

### 5.2 API 設計（新模組 `src/modules/broadcast/`）

模組結構仿照 tags 模組：

```
src/modules/broadcast/
├── handlers/
│   ├── index.ts            → export broadcastRouter
│   └── broadcast-main.ts   → Hono router（掛 jwtAuth + 權限檢查）
├── services/
│   ├── broadcast-service.ts        → CRUD + 狀態機
│   ├── audience-service.ts         → 標籤→受眾解析（快照展開）
│   └── broadcast-sender-service.ts → token 解析 + multicast 發送 + 結果回填
└── types/
    └── index.ts
```

路由註冊：在 `src/index.ts` 與其他顯式模組路由並列處加 `app.route('/api/broadcasts', broadcastRouter)`，完成後跑 `bun run check:routes:ci` 確認無衝突（CLAUDE.md 路由優先序規則）。

| 方法 | 路徑 | 用途 | 成功回應要點 |
|------|------|------|-------------|
| `POST` | `/api/broadcasts/preview` | 受眾預覽（不落庫） | `{ total, byPlatform: {line, facebook}, sendable, skipped: [{reason, count}] }` |
| `POST` | `/api/broadcasts` | 建立群發 + 展開受眾快照 | `201` + broadcast 物件（status=`draft`） |
| `POST` | `/api/broadcasts/:id/send` | 執行發送（同步） | `200` + 最終 stats；配額不足 `409`；超過 5000 人 `422`；非 draft `409` |
| `GET` | `/api/broadcasts` | 歷史列表（分頁，含 stats） | 仿 tags list 的分頁格式（`page`, `pageSize` ≤ 100） |
| `GET` | `/api/broadcasts/:id` | 單筆詳情 | broadcast + stats |
| `GET` | `/api/broadcasts/:id/recipients` | 收件人明細（分頁，可 `?status=` 過濾） | 含 customer displayName（join customers） |

**請求驗證（`POST /api/broadcasts`）**：
- `title`: 1–100 字必填
- `content`: 1–2000 字必填（Phase 1 純文字）
- `tagIds`: 非空陣列；Phase 1 僅接受 **1 個** tagId（多個回 `422 PHASE1_SINGLE_TAG_ONLY`）
- tag 必須存在且 `is_active=1 AND deleted_at IS NULL`，否則 `404`
- 展開後受眾為 0 人 → `422 EMPTY_AUDIENCE`（不建立紀錄）

**權限（D3）**：所有端點掛 `jwtAuth`；handler 內檢查 `user.role === 'admin' || Object.values(user.teamRoles ?? {}).some(r => r === 'lead' || r === 'supervisor')`，不通過回 `403`。抽成 `requireBroadcastPermission` helper 放在 handler 檔內即可（勿改動 `src/middleware/auth.ts`）。

### 5.3 發送流程（`broadcast-sender-service.ts`）

```
send(broadcastId)
│
├─ 1. 載入 broadcast，檢查 status === 'draft'（否則 409）→ 置為 'sending'
├─ 2. 載入全部 recipients（pending）
│     ├─ platform !== 'line' → 標 skipped: platform_not_supported_phase1
│     └─ platform === 'line' → 進入發送池；若 > 5000 → 回滾 status，422
├─ 3. Token 解析（D1）：依 resolvedTeamId 分組
│     team 有 active LINE integration → 解密 token
│     否則 → env.LINE_CHANNEL_ACCESS_TOKEN（fallback 組，resolvedTeamId=null）
│     兩者皆無 → 該組全標 skipped: no_channel_credentials
├─ 4. 配額預檢（每個 token 各查一次）：
│     getLineMessageQuota + getLineMessageUsage
│     type==='limited' 且 (value - totalUsage) < 該組人數
│       → 該組全標 skipped: quota_insufficient，不呼叫 multicast
│       →（若所有組都被擋）status='failed'，回 409 QUOTA_INSUFFICIENT
├─ 5. 逐 token 組呼叫 multicastLineMessage(token, userIds, [createTextMessage(content)])
│     用回傳的 failedUserIds 回填：
│     在 failedUserIds 內 → status='failed', errorReason='line_api_failed'
│     不在 → status='sent', sentAt=now
├─ 6. D2 寫回對話：對 sent 的收件人，查其最近一筆未軟刪 conversation，
│     存在 → 插入 message（senderType='agent', agentSenderId=操作者,
│     senderName=操作者名快照, content=群發內容, isSent=true,
│     deliveryStatus='delivered', metadata=JSON {broadcastId}）
│     （批次 insert；無對話者跳過，不建新對話）
├─ 7. 統計回寫 broadcasts：sentCount/failedCount/skippedCount/totalRecipients
│     status = failed=0&&skipped不計 ? 'completed'
│            : sent>0 ? 'partial_failed' : 'failed'
│     sentAt = now
└─ 8. 回傳最終 stats
```

**冪等防重**：步驟 1 的 draft→sending 轉換必須是**條件式 UPDATE**（`UPDATE broadcasts SET status='sending' WHERE id=? AND status='draft'`，檢查受影響列數），防止雙擊/併發重送。

**錯誤中斷**：步驟 5 若拋出例外，catch 後把該組仍為 pending 的收件人標 failed，broadcast 標 `partial_failed`，不讓例外把狀態卡死在 `sending`。

### 5.4 受眾解析（`audience-service.ts`）

單一 SQL（Drizzle）：

```
SELECT c.id, c.platform, c.platform_user_id, c.source_team_id
FROM customer_tags ct
JOIN customers c ON c.id = ct.customer_id
WHERE ct.tag_id = ? AND c.deleted_at IS NULL
```

不分頁（快照全量），但 preview 與 create 共用此查詢。`resolvedTeamId` 在快照時一併寫入（= `source_team_id`，不在此時解密憑證）。

### 5.5 前端（Phase 1 最小可用）

```
frontend/src/
├── views/BroadcastView.vue        → 新頁（路由 /broadcasts，需登入）
├── stores/broadcasts.ts           → Pinia store
├── api/broadcasts.ts              → API client（仿 api/tags.ts 模式）
└── components/broadcast/
    ├── BroadcastComposeCard.vue   → 選標籤 → 預覽人數 → 訊息輸入 → 發送
    ├── BroadcastHistoryList.vue   → 歷史列表（狀態、統計）
    └── BroadcastDetailModal.vue   → 收件人明細（status 過濾）
```

**UI 流程**：選標籤（下拉，來源 `stores/tags.ts` 的 `fetchTags`）→ 即時呼叫 preview 顯示「LINE 可發 x 人；FB y 人本期不支援將略過」→ 輸入 title + content（字數計數）→ 按「發送」→ **confirm 對話框**（顯示人數，不可逆警告）→ create + send → 成功後跳轉/展開詳情。

**設計規範**：遵循 `docs/UIUX-Design-System.md`（Bento 卡片、rounded-2xl、無 1px 硬邊框、`#F2F2F7` 背景、按鈕用全域 `.btn` 系統——**禁止在元件 `<style>` 重定義 `.btn*`**）。發送中狀態顯示 loading；失敗顯示 `#FF3B30` 紅。導覽入口：側邊欄新增「群發訊息」項（權限不足者隱藏）。

---

## 6. Commands（實作時使用）

```bash
# 型別檢查（後端 / 前端 — 工具不可混用，見 CLAUDE.md）
bun run build                      # 後端 tsc --noEmit
cd frontend && bun run type-check  # 前端 vue-tsc

bash scripts/check.sh              # 全案健檢（前+後端）
bun run check:routes:ci            # 路由衝突檢查（改 index.ts 後必跑）
bun run db:generate                # 產 migration
bun run db:migrate                 # 套用到 REMOTE D1
bun run db:sync:local              # 同步本地鏡像
cd frontend && bun run test        # 前端 Vitest
cd frontend && bun run lint        # ESLint
```

## 7. Code Style 對齊

- TypeScript strict、**禁 `any`**（測試檔除外）
- 日誌用 `createContextLogger('Broadcast...')`（勿用裸 console.log）
- DB 用 Drizzle（禁 raw SQL —— `check:sql-raw:ci` 會擋）
- 時間戳沿用 `src/utils/timestamp` 的 `nowMs` / ISO 慣例（與鄰近程式碼一致）
- 路徑別名 `@/`；勿深層相對匯入（pre-commit `check-import-paths.ts` 會擋）
- Vue 3 Composition API + `<script setup lang="ts">`

## 8. Boundaries

- **Always**：受眾查詢排除 `deleted_at`；發送前條件式狀態轉換（§5.3 冪等）；所有端點掛 `jwtAuth`；改 `src/index.ts` 後跑 `check:routes:ci`
- **Ask first**（實作中遇到先停下來問）：更動既有表結構、更動 `multicastLineMessage` 本體、新增依賴套件、更動 `wrangler.toml`
- **Never**：呼叫 `broadcastLineMessage()`（全好友廣播——本功能明確不用，誤用會炸配額）；hard-code URL/token；在元件內重定義 `.btn*`；用 `package-lock.json`

---

## 9. Phase 1 任務拆解（依依賴排序）

> 每項 ≤ 5 檔案、可獨立驗證。建議每完成一項做一次 atomic commit。

- [ ] **T1. DB schema + migration**
  - 內容：§5.1 兩張表加入 `src/db/schema.ts`，產生並套用 migration
  - 驗收：`bun run db:generate` 產出的 SQL 與 §5.1 一致；`db:migrate` 成功；`db:sync:local` 後本地可見兩表
  - 驗證：`bun run build` 通過；Drizzle Studio 或 sqlite 查詢確認表結構
  - 檔案：`src/db/schema.ts`、`drizzle/`（自動產生）

- [ ] **T2. 受眾解析服務**
  - 內容：`audience-service.ts` 實作 §5.4 查詢 + preview 統計聚合（byPlatform/sendable/skipped 預估）
  - 驗收：給定 tagId 回傳含 `platform_user_id` 的全量清單；軟刪客戶被排除；不存在的 tag 回明確錯誤
  - 驗證：`bun run build`；用本地鏡像 DB 對一個實際 tag 手動核數（與 `GET /tags/:id/stats` 的數字一致）
  - 檔案：`src/modules/broadcast/services/audience-service.ts`、`types/index.ts`

- [ ] **T3. Broadcast CRUD 服務 + handlers（不含發送）**
  - 內容：create（含快照展開，事務性：broadcast + recipients 一起成功）、list、get、recipients 查詢；§5.2 驗證規則與權限 helper；路由掛載
  - 驗收：curl 走通 create→list→get→recipients；空受眾回 422；多 tagId 回 422；非 lead/admin 回 403
  - 驗證：`bun run check:routes:ci` 無衝突；`bash scripts/check.sh backend`
  - 檔案：`handlers/broadcast-main.ts`、`handlers/index.ts`、`services/broadcast-service.ts`、`src/index.ts`

- [ ] **T4. Token 解析 + 配額預檢**
  - 內容：`broadcast-sender-service.ts` 前半——D1 決策的 token 解析（分組 + `ChannelCredentialService` 解密 + env fallback）、每 token 配額檢查
  - 驗收：有 integration 的團隊解出正確 token；無 integration 落到 env fallback；皆無 → 該組標 skipped；quota limited 且不足 → 該組標 skipped: quota_insufficient
  - 驗證：`bun run build`；單元層面可先以 dry-run 端點或臨時 log 驗證分組結果（不實際發送）
  - 檔案：`services/broadcast-sender-service.ts`

- [ ] **T5. 發送執行 + 結果回填**
  - 內容：§5.3 步驟 1–5、7、8——條件式狀態轉換、multicast 呼叫、`failedUserIds` 回填、統計回寫、`POST /:id/send` 端點
  - 驗收：對含 2–3 個測試帳號的標籤實際發送，LINE 收到訊息；recipients 逐人狀態正確；重複呼叫 send 回 409；FB 客戶標 skipped
  - 驗證：真機收訊 + DB 查 recipients/broadcasts 狀態；`bash scripts/check.sh backend`
  - 檔案：`services/broadcast-sender-service.ts`、`handlers/broadcast-main.ts`

- [ ] **T6. 寫回對話（D2）**
  - 內容：§5.3 步驟 6——sent 收件人回寫 message 至既有對話
  - 驗收：有對話的測試客戶，對話串出現該群發訊息（含 `metadata.broadcastId`）；無對話客戶不產生新對話；訊息在前端對話視窗可見
  - 驗證：前端開啟該對話目視確認；DB 查 messages.metadata
  - 檔案：`services/broadcast-sender-service.ts`

- [ ] **T7. 前端 API client + store**
  - 內容：`api/broadcasts.ts`（六個端點）+ `stores/broadcasts.ts`
  - 驗收：型別完整（後端回應形狀對齊）；store 具 preview/create/send/list/detail 動作與 loading/error 狀態
  - 驗證：`cd frontend && bun run type-check && bun run lint`
  - 檔案：`frontend/src/api/broadcasts.ts`、`frontend/src/stores/broadcasts.ts`

- [ ] **T8. 群發撰寫 UI**
  - 內容：`BroadcastView.vue` + `BroadcastComposeCard.vue` + 路由 + 側邊欄入口（權限隱藏）
  - 驗收：完整走通「選標籤→預覽人數→輸入→confirm→發送→顯示結果」；FB 略過提示可見；設計符合 Design System 檢查表（§15）
  - 驗證：`bun run type-check`；瀏覽器實際操作一次端到端
  - 檔案：`views/BroadcastView.vue`、`components/broadcast/BroadcastComposeCard.vue`、`router/index.ts`、側邊欄元件

- [ ] **T9. 歷史列表 + 收件人明細 UI**
  - 內容：`BroadcastHistoryList.vue` + `BroadcastDetailModal.vue`（status 過濾、分頁）
  - 驗收：列表顯示狀態徽章與統計；明細可按 sent/failed/skipped 過濾並顯示 errorReason
  - 驗證：`bun run type-check`；瀏覽器目視
  - 檔案：`components/broadcast/BroadcastHistoryList.vue`、`BroadcastDetailModal.vue`、`views/BroadcastView.vue`

- [ ] **T10. 端到端驗收演練**
  - 內容：完整走一次真實流程 + 邊界案例（空受眾、雙擊發送、無憑證團隊、FB-only 標籤）
  - 驗收：§10 驗收清單全數通過
  - 驗證：`bash scripts/check.sh`；逐項勾 §10

---

## 10. Phase 1 驗收清單（Claude 審查時逐項檢核）

**功能**
- [ ] 選標籤後 preview 人數與 `GET /tags/:id/stats` 一致
- [ ] LINE 測試帳號實際收到群發訊息
- [ ] recipients 逐人狀態正確（sent/failed/skipped + errorReason）
- [ ] FB 客戶標 `skipped: platform_not_supported_phase1`，不呼叫任何 FB API
- [ ] 發送成功者訊息寫回既有對話（含 `metadata.broadcastId`）；無對話者不建新對話
- [ ] broadcasts 統計（total/sent/failed/skipped）與 recipients 實際加總一致

**防護**
- [ ] 重複呼叫 send（雙擊模擬）只發送一次，第二次回 409
- [ ] 空受眾 create 回 422 且不落庫
- [ ] >5000 人回 422 且不改變狀態
- [ ] 非 admin/lead/supervisor 存取任一端點回 403
- [ ] 配額不足時整組 skipped，不部分發送
- [ ] 發送中拋例外不會讓 broadcast 卡死在 `sending`

**工程**
- [ ] `bash scripts/check.sh` 全綠（backend tsc + frontend vue-tsc + eslint）
- [ ] `bun run check:routes:ci`、`check:sql-raw:ci`、`check-import-paths` 通過
- [ ] 無 `any`、無裸 console.log（用 contextLogger）、無 `.btn*` 重定義
- [ ] UI 符合 Apple-Native Soft Minimalism 檢查表
- [ ] 未呼叫 `broadcastLineMessage()`

---

## 11. Phase 2 Spec（完整化）

**範圍**：FB 發送、多標籤 AND/OR、Queue 化、報表頁、權限細化。

### 11.1 設計要點

- **FB 發送**：逐一呼叫 Graph API `/me/messages`（參考 `src/durable-objects/delayed-message/retry-handler.ts:130` 的既有實作）。必帶 `messaging_type`：24 小時互動視窗內用 `RESPONSE`；視窗外**不發**（標 `skipped: fb_outside_24h_window`）——行銷內容不符 `MESSAGE_TAG` 資格，硬性平台政策。視窗判定：客戶最近一則 inbound message 的 `createdAt` 距今 < 24h（查 messages 表該客戶對話的最新 customer 訊息）。
- **多標籤**：受眾查詢擴充 AND（`GROUP BY customer_id HAVING COUNT(DISTINCT tag_id) = N`）/ OR（`DISTINCT`）。參考 `CustomerTagService.findCustomersByTags`（`src/modules/customer/services/customer-tags.ts:366`）的既有 AND/OR 邏輯，但需回傳通道身分。移除 Phase 1 的單標籤限制。
- **Queue 化**：新增 payload type `broadcast_batch`（掛在既有 `line-message-queue` 上，仿 `media_processing` 的 type 路由模式）。send 端點改為：切批（LINE 500/批一則 queue 訊息；FB 20 人/批一則）→ enqueue → 立即回 202。Consumer 處理批次並回填 recipients；最後一批完成時回寫 broadcast 終態（用「pending 數歸零」判定，避免競態）。移除 5000 人上限。DLQ 沿用 `line-message-dlq`。
- **報表頁**：獨立 view，含發送趨勢、各標籤使用次數、失敗原因分佈。
- **權限細化**：群發權限改為可設定（systemSettings key `broadcast.allowed_roles`），預設維持 D3。

### 11.2 任務拆解

- [ ] **P2-T1. FB 24h 視窗判定服務**（查詢最近 inbound 時間，批次版）— 驗證：對已知對話手動核對
- [ ] **P2-T2. FB 發送器**（token 解析復用 §5.3 D1 邏輯改 platform='facebook'；逐一發送 + `messaging_type: RESPONSE`）— 驗證：FB 測試帳號收訊；視窗外標 skipped
- [ ] **P2-T3. 多標籤 AND/OR 受眾查詢** + preview/create 解除單標籤限制 — 驗證：交集/聯集人數與手工 SQL 一致
- [ ] **P2-T4. Queue payload + consumer 分支**（`broadcast_batch` 型別、批次處理、recipients 回填）— 驗證：本地 `wrangler dev` 觀察 queue 消費
- [ ] **P2-T5. send 端點改 202 + 終態判定**（pending 歸零→completed/partial_failed）— 驗證：大量測試（>500 人或壓縮批量參數）不逾時、終態正確
- [ ] **P2-T6. 前端：發送進度輪詢**（sending 狀態下輪詢 detail，進度條）— 驗證：目視進度更新
- [ ] **P2-T7. 前端：多標籤選擇器（AND/OR 切換）+ FB 視窗提示** — 驗證：preview 數字隨模式變化
- [ ] **P2-T8. 報表頁** — 驗證：數字與 DB 聚合一致
- [ ] **P2-T9. 權限設定化** — 驗證：改 setting 後即時生效

**Phase 2 驗收要點**：FB 視窗內客戶收到訊息、視窗外零 API 呼叫；6000+ 人群發不逾時且終態正確；AND/OR 人數精確；DLQ 有失敗批次時可觀察到。

---

## 12. Phase 3 Spec（進階，方向性）

> 實作前需回來細化，此處先定邊界。

- **排程群發**：`broadcasts` 加 `scheduledAt` + status `scheduled`。觸發器**不要**復用 `DelayedMessageScheduler`（其為 120 秒級、per-conversation 設計）；改用 Cron Trigger（`wrangler.toml` `[triggers]` crons，每分鐘掃 `scheduled AND scheduledAt <= now`）→ 走 Phase 2 的 enqueue 路徑。含取消端點（`scheduled → draft`）。
- **訊息模板**：`broadcast_templates` 表（title/content/建立者），compose UI 可套用/儲存。
- **成效統計**：LINE 無逐則已讀回執；可統計「群發後 N 天內回覆率」（messages 表 inbound 對照）作為 proxy 指標。
- **LINE Narrowcast 評估**：僅在單次受眾 > 數萬且 multicast 成本/延遲成為瓶頸時才引入（需受眾上傳管理，複雜度高，預設不做）。

**任務拆解**（粗粒度）：P3-T1 排程 schema+cron 掃描器；P3-T2 排程 UI（時間選擇器+取消）；P3-T3 模板 CRUD+UI；P3-T4 回覆率統計。

---

## 13. Open Questions（實作中遇到再決）

1. Fallback 全域 token（`env.LINE_CHANNEL_ACCESS_TOKEN`）對應的是哪個 LINE OA？若多團隊各有 OA，fallback 發送的來源帳號可能不符預期——Phase 1 接受此行為（與既有 1:1 發送一致），Phase 2 可考慮改為「無法解析憑證一律 skipped」。
2. 群發訊息寫回對話後是否觸發 WebSocket 即時更新？Phase 1 不做（重新整理可見），若客服反映困惑再於 Phase 2 補 `WebSocketBroadcastService` 通知。
3. `title` 是否需要對客戶隱藏確認——title 僅存內部，不會發送給客戶（content 才是訊息本體）。UI 需明確標示。
