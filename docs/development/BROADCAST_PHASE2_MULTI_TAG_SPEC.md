# Spec: 群發 Phase 2 — 多標籤受眾（AND / OR）

> **狀態**: Phase 2（多標籤）待實作 ｜ **撰寫**: Claude（2026-07-16）｜ **實作**: Eric ｜ **驗收**: Claude
> **母文件**: [`BROADCAST_MESSAGING_SPEC.md`](./BROADCAST_MESSAGING_SPEC.md)（Phase 1 全案 spec，含決策 D1–D6）
> **前置調查結論**: Phase 1 建表時已預留 `tag_ids`（JSON array）與 `match_mode`（default `'any'`）兩欄（`migrations/0051_add_broadcast_tables.sql`、`src/db/schema.ts:274-275`），**本階段不需任何 schema migration**；`customer_tags(tag_id)` 索引也已存在（`migrations/0018_add_customer_tags_indexes.sql`），**不需新增索引**。缺的只是受眾解析的多標籤查詢、驗證規則鬆綁與前端多選 UI。

---

## 1. Objective（目標）

讓客服主管可以一次選擇**多個標籤**，並指定匹配模式：

- **OR（任一符合，聯集）**：客戶帶有其中任何一個標籤即入選
- **AND（全部符合，交集）**：客戶必須同時帶有所有選定標籤才入選

**使用者故事**：
- 作為客服主管，我可以選「製造業」+「VIP」並切到 AND，只對「同時是製造業且是 VIP」的客戶群發。
- 作為客服主管，我可以選「北區」+「中區」+「南區」用 OR，一次觸及三個地區的所有客戶（自動去重，不會重複發送）。
- 作為客服主管，我在預覽時能看到每個標籤各自的人數與組合後的總人數；AND 模式交集為 0 時會被明確警告並擋下送出。

**成功樣貌**：UI 多選 2 個以上標籤 → 切換 AND/OR 時預覽人數即時變化且與手工 SQL 核數一致 → 送出後收件人快照正確（無重複、交集精確）→ 歷史列表顯示「標籤 A + 標籤 B（全部符合）」。

---

## 2. 範圍定位（在全案分期中的位置）

母文件 §2 將 Phase 2 定為「FB 發送、多標籤 AND/OR、Queue 化、報表頁、權限細化」五件事。**本文件只涵蓋其中「多標籤 AND/OR」**（即母文件 §11.2 的 P2-T3 + P2-T7 前半），因為：

1. 它是唯一**零 migration、零外部 API 依賴**的 Phase 2 項目，可獨立出貨；
2. 發送管線（token 解析、配額、multicast、寫回對話）完全不受影響——多標籤只改變「快照展開前」的受眾集合。

其餘 Phase 2 項目（FB 發送、Queue 化等）維持在母文件 §11 排程，見本文件 §9 Non-goals。

---

## 3. 現況盤點（已驗證的既有資產）

### 3.1 後端

| 資產 | 位置 | 現況 |
|------|------|------|
| `broadcasts.tagIds` / `matchMode` 欄位 | `src/db/schema.ts:274-275`；`migrations/0051_add_broadcast_tables.sql` | 已存在。`tag_ids` 為 JSON array（Phase 1 僅寫入單元素）、`match_mode` default `'any'`（Phase 1 硬編碼 `'any'`，`broadcast-service.ts:44`） |
| `broadcast_recipients` 唯一鍵 | `src/db/schema.ts:304`；`migrations/0052_add_broadcast_identity_indexes.sql` | `UNIQUE(broadcast_id, platform, platform_user_id)` — DB 層天然防止同一客戶因多標籤被快照兩次 |
| 單標籤受眾解析 | `src/modules/broadcast/services/audience-service.ts:10-23`（`resolveSingleTagAudience`） | join `customer_tags` × `customers`，排除軟刪客戶；**本階段改寫為多標籤版本** |
| tag 有效性檢查 | `audience-service.ts:31-40`（`ensureActiveTag`） | 檢查 `isActive=1 AND deletedAt IS NULL`，單一 tag；**擴為批次版** |
| Phase 1 單標籤 guard（preview） | `src/modules/broadcast/handlers/broadcast-main.ts:30-35` | `tagIds.length !== 1` → `422 PHASE1_SINGLE_TAG_ONLY`；**本階段移除** |
| Phase 1 單標籤 guard（create） | `src/modules/broadcast/services/broadcast-service.ts:175-181`（`validateCreateInput`） | 同上；**本階段移除** |
| 錯誤碼型別 | `src/modules/broadcast/types/index.ts:97-105` | 含 `PHASE1_SINGLE_TAG_ONLY`；**本階段自 union 移除** |
| 發送管線 | `src/modules/broadcast/services/broadcast-sender-service.ts` | 只讀 `broadcast_recipients` 快照，對標籤數目**完全無感** — 不需改動 |
| AND/OR 既有參考實作 | `src/modules/customer/services/customer-tags.ts:366-399`（`findCustomersByTags`） | 已有 `GROUP BY + HAVING COUNT(DISTINCT tag_id) = N` 與聯集寫法，但只回 `customerId[]`，不含通道身分——**參考其邏輯，勿直接複用** |
| 單標籤客戶查詢參考 | `src/modules/tags/services/tag-service.ts:836`（`getTagCustomers`） | 分頁版單標籤查詢（preview 核數時的對照組） |
| 路由掛載 | `src/index.ts:320` | `app.route('/api/broadcasts', broadcastRouter)` — 不需改動 |

### 3.2 相關資料表（`src/db/schema.ts`）

| 表 | 位置 | 與本階段的關係 |
|----|------|----------------|
| `customers` | `:52-67` | 受眾來源；`deletedAt`（軟刪）必須排除；`sourceTeamId` 快照為 `resolvedTeamId` |
| `tags` | `:233-246` | 驗證 `isActive` + `deletedAt`；`name` 用於 preview 逐標籤統計 |
| `customerTags` | `:249-256` | 複合主鍵 `(customer_id, tag_id)` — 同一客戶同一標籤不可能有重複列 |
| `broadcasts` | `:269-288` | `tagIds`、`matchMode` 已預留 |
| `broadcastRecipients` | `:291-306` | 唯一鍵 + `(broadcast_id, status)` 索引已就緒 |

### 3.3 既有索引（已驗證，本階段**不需新增**）

`migrations/0018_add_customer_tags_indexes.sql`（另見 `drizzle/0030_add_critical_performance_indexes.sql` 的重複防護版）：

- `idx_customer_tags_tag_id` ON `customer_tags(tag_id)` ← **OR / AND 查詢的主力索引**
- `idx_customer_tags_tag_assigned` ON `customer_tags(tag_id, assigned_at DESC)`
- `idx_customer_tags_customer_id` ON `customer_tags(customer_id)`

### 3.4 前端

| 資產 | 位置 | 現況 |
|------|------|------|
| API client 型別 | `frontend/src/api/broadcasts.ts:83-91` | `CreateBroadcastRequest` / `BroadcastPreviewRequest` 已有 `tagIds: number[]`，**缺 `matchMode`** |
| Pinia store | `frontend/src/stores/broadcasts.ts:24,35-57` | `previewTagId` 為單一 number（防過期預覽）；**需改為複合 key（tagIds+matchMode）** |
| 撰寫卡 | `frontend/src/components/broadcast/BroadcastComposeCard.vue:30-47,124` | `<select>` 單選（`selectedTagId: ref(0)`）；**改多選 + AND/OR 切換** |
| 歷史列表 | `frontend/src/components/broadcast/BroadcastHistoryList.vue` | 目前不顯示標籤；**需加標籤膠囊 + 匹配模式徽章** |
| 主頁 | `frontend/src/views/BroadcastView.vue` | props 佈線需隨 store 欄位改名微調 |
| 既有測試 | `tests/modules/broadcast/`（audience-service / broadcast-main / broadcast-service / d1-chunks `.test.ts`） | 後端測試落點；前端測試慣例為 `frontend/src/**/__tests__/*.test.ts`（Vitest） |

---

## 4. 架構決策（延續母文件 D1–D6 編號）

| # | 決策 | 內容 |
|---|------|------|
| D7 | **matchMode 語意與預設** | `'any'` = OR（聯集）、`'all'` = AND（交集）。請求未帶 `matchMode` 時預設 `'any'` —— 與 DB default 及 Phase 1 既有資料一致，**單標籤舊請求行為 100% 不變**（向後相容）。單標籤 + `'all'` 合法（語意等同 `'any'`）。 |
| D8 | **tagIds 上限 10、伺服器端去重** | `tagIds` 接受 1–10 個正整數（常數 `BROADCAST_MAX_TAGS = 10`，放 `src/modules/broadcast/types/` 或 `d1-chunks.ts` 同層常數檔）。重複的 tagId 由伺服器**靜默去重**（非報錯），AND 的 `HAVING ... = N` 必須以**去重後**數量計。超過 10 個 → `422`（validation error）。上限理由：10 個已遠超實務需求，且確保 `inArray` 綁定參數遠低於 D1 的 100 參數上限。 |
| D9 | **preview 回應擴充（additive）** | preview 回應新增 `matchMode` 與 `tags: [{ tagId, name, count }]`（逐標籤人數，排除軟刪客戶）；`total/byPlatform/sendable/skipped` 語意不變（改為組合後受眾的統計）。只增不改欄位 → 舊前端不炸。 |
| D10 | **零 migration** | 已對 `migrations/0051`（建表含 `tag_ids`/`match_mode`）與 `migrations/0052`（唯一鍵+索引）逐行驗證：欄位與索引皆已在 production。本階段**不產生任何 migration**。 |
| D11 | **快照語意不變（沿用 D4）** | 建立群發當下展開受眾寫入 `broadcast_recipients`，之後標籤異動不影響已建立的群發。多標籤只改變「展開時的集合運算」，快照與發送語意零變動。 |
| D12 | **標籤驗證全有全無** | `tagIds` 中**任一** tag 不存在／`isActive=0`／已軟刪 → 整個請求回 `404 TAG_NOT_FOUND`（訊息列出無效的 tagId），不做部分成功。理由：靜默忽略無效標籤會讓 AND 交集悄悄變大（N 變小），造成誤發。 |

---

## 5. 詳細設計

### 5.1 受眾解析（`audience-service.ts` 改寫）

新的公開介面（取代 `resolveSingleTagAudience` / `previewSingleTagAudience`）：

```typescript
resolveAudience(tagIds: number[], matchMode: BroadcastMatchMode): Promise<BroadcastAudienceMember[]>
previewAudience(tagIds: number[], matchMode: BroadcastMatchMode): Promise<BroadcastAudiencePreview>
```

內部先 `const uniqueTagIds = [...new Set(tagIds)]`，再 `ensureActiveTags(uniqueTagIds)`（批次版：`SELECT id, name FROM tags WHERE id IN (...) AND is_active = 1 AND deleted_at IS NULL`，筆數不符 → `TAG_NOT_FOUND`，D12）。

**目標 SQL**：

```sql
-- OR（matchMode = 'any'）：聯集 + 去重
SELECT c.id, c.platform, c.platform_user_id, c.source_team_id
FROM customer_tags ct
JOIN customers c ON c.id = ct.customer_id
WHERE ct.tag_id IN (?, ?, ...) AND c.deleted_at IS NULL
GROUP BY c.id;                       -- 等價 DISTINCT，客戶命中多標籤只出現一次

-- AND（matchMode = 'all'）：交集
SELECT c.id, c.platform, c.platform_user_id, c.source_team_id
FROM customer_tags ct
JOIN customers c ON c.id = ct.customer_id
WHERE ct.tag_id IN (?, ?, ...) AND c.deleted_at IS NULL
GROUP BY c.id
HAVING COUNT(DISTINCT ct.tag_id) = N;   -- N = 去重後的 tagIds 數量
```

**Drizzle 寫法（示意，通過 `check:sql-raw:ci`——僅 `having` 內用 `sql` 模板，與 `customer-tags.ts:378` 既有寫法一致）**：

```typescript
const rows = this.db
  .select({
    customerId: customers.id,
    platform: customers.platform,
    platformUserId: customers.platformUserId,
    resolvedTeamId: customers.sourceTeamId,
  })
  .from(customerTags)
  .innerJoin(customers, eq(customers.id, customerTags.customerId))
  .where(and(inArray(customerTags.tagId, uniqueTagIds), isNull(customers.deletedAt)))
  .groupBy(customers.id);

return matchMode === 'all'
  ? rows.having(sql`COUNT(DISTINCT ${customerTags.tagId}) = ${uniqueTagIds.length}`)
  : rows;
```

備註：`customer_tags` 的複合主鍵 `(customer_id, tag_id)` 保證無重複列，`COUNT(tag_id)` 與 `COUNT(DISTINCT tag_id)` 實際等值，但保留 `DISTINCT` 作為對 schema 演變的防禦。

**逐標籤人數（preview 用，D9）**——一條額外的 GROUP BY 查詢：

```typescript
const perTag = await this.db
  .select({ tagId: customerTags.tagId, count: sql<number>`COUNT(*)` })
  .from(customerTags)
  .innerJoin(customers, eq(customers.id, customerTags.customerId))
  .where(and(inArray(customerTags.tagId, uniqueTagIds), isNull(customers.deletedAt)))
  .groupBy(customerTags.tagId);
// 與 ensureActiveTags 取回的 name 合併成 tags: [{ tagId, name, count }]
```

`summarizeAudience()`（`audience-service.ts:43-65`）不變，繼續負責 `byPlatform/sendable/skipped` 聚合。

**單標籤退化驗證**：`tagIds=[x]` + `'any'` 的查詢結果必須與 Phase 1 `resolveSingleTagAudience(x)` 逐列相同（測試 T1 驗收項）。

### 5.2 API 變更（`broadcast-main.ts` + `broadcast-service.ts` + `types/index.ts`）

端點不增不減，僅請求／回應形狀演進：

| 端點 | 變更 |
|------|------|
| `POST /api/broadcasts/preview` | 請求 `{ tagIds: number[], matchMode?: 'any' \| 'all' }`；**移除 `broadcast-main.ts:30-35` 的 `PHASE1_SINGLE_TAG_ONLY` guard**；回應擴充 `matchMode` + `tags[]`（D9） |
| `POST /api/broadcasts` | 請求增 `matchMode?`（預設 `'any'`）；**移除 `broadcast-service.ts:175-181` 的單標籤檢查**；`create()` 改呼叫 `resolveAudience(uniqueTagIds, matchMode)`，並把**去重後**的 `tagIds` 與實際 `matchMode` 寫入 `broadcasts`（取代現行硬編碼 `matchMode: 'any'`，`broadcast-service.ts:43-44`） |
| 其餘 4 個 GET/send 端點 | 無變更（`BroadcastRecord` 本來就回傳 `tagIds[]` 與 `matchMode`，`types/index.ts:43-44`） |

**驗證規則（preview 與 create 共用）**：

1. `tagIds`：非空陣列、全為正整數（沿用 `parseTagIds`，`broadcast-main.ts:199-210`）
2. 伺服器端去重後 `1 ≤ 長度 ≤ BROADCAST_MAX_TAGS(10)`；超過 → `422` validation error（`field: 'tagIds'`）
3. `matchMode`：缺省 → `'any'`；其他非 `'any'/'all'` 值 → `422` validation error（`field: 'matchMode'`）
4. 全部 tag 必須存在且 `is_active=1 AND deleted_at IS NULL`，否則 `404 TAG_NOT_FOUND`（D12）
5. 組合後受眾 0 人：create 維持 `422 EMPTY_AUDIENCE` 不落庫（不變）；preview 正常回 `total: 0`（由前端警告，見 §5.3）

**型別變更（`types/index.ts`）**：

- `CreateBroadcastInput` 增 `matchMode?: BroadcastMatchMode`
- `BroadcastAudiencePreview` 增 `matchMode: BroadcastMatchMode` 與 `tags: Array<{ tagId: number; name: string; count: number }>`
- `BroadcastServiceErrorCode` union **移除 `'PHASE1_SINGLE_TAG_ONLY'`**（含所有引用點）

**向後相容**：舊請求（單元素 `tagIds`、無 `matchMode`）→ 去重 no-op、預設 `'any'`、查詢退化為 Phase 1 等價 → 行為與回應完全一致。Phase 1 歷史資料（`matchMode='any'`、單元素 `tagIds`）在列表/詳情渲染路徑上無需特殊處理。

### 5.3 前端變更

**`frontend/src/api/broadcasts.ts`**
- `CreateBroadcastRequest` / `BroadcastPreviewRequest` 增 `matchMode?: 'any' | 'all'`
- `BroadcastAudiencePreview` 增 `matchMode` + `tags: Array<{ tagId: number; name: string; count: number }>`

**`frontend/src/stores/broadcasts.ts`**
- `previewTagId: number | null` → `previewKey: string | null`，key 由 `[...tagIds].sort().join(',') + '|' + matchMode` 組成（防過期預覽的競態序號機制 `previewRequestSeq` 保留不動）
- `fetchPreview` 對應改寫；`clearPreview` 同步更新

**`frontend/src/components/broadcast/BroadcastComposeCard.vue`**
- 單選 `<select>` → 多選標籤選擇器：以既有標籤資料（`stores/tags.ts` 的 `fetchTags`）渲染可搜尋的膠囊多選（選中顯示為可移除的 pill；上限 10，達上限時停用未選項並顯示提示）
- 新增 **AND/OR 分段切換**（segmented control 造型，capsule、`#007AFF` 選中態，遵循 Design System；文案「符合任一標籤」/「符合全部標籤」）
- 選擇集或模式變動 → 自動觸發 preview（沿用 `emitPreview` 流程）
- **預覽面板**：逐標籤 chips（`名稱 · n 人`）+ 組合後總數 + LINE 可發/FB 略過（沿用現行文案）；`matchMode='all'` 且 `total === 0` 時顯示醒目警告「所選標籤的交集為 0 人，請改用『符合任一標籤』或調整標籤組合」（`#FF9500` 警示樣式），`canSubmit` 既有的 `sendable > 0` 條件天然擋下送出
- confirm 對話框文案加入匹配模式描述（例：「即將發送給同時符合 2 個標籤的 15 位 LINE 客戶…」）
- **禁止在 `<style scoped>` 重定義 `.btn*`**（CLAUDE.md 按鈕系統規則）

**`frontend/src/components/broadcast/BroadcastHistoryList.vue`**
- 「活動」欄下方新增標籤膠囊列（tag 名稱由 `stores/tags.ts` 查表；查不到的 id 顯示 `標籤 #id`）＋ 匹配模式徽章（僅 `tagIds.length > 1` 時顯示「全部符合」/「任一符合」，單標籤不顯示以免噪音）

**`frontend/src/components/broadcast/BroadcastDetailModal.vue`**
- 標頭補標籤膠囊 + 匹配模式徽章（同上規則）

**`frontend/src/views/BroadcastView.vue`**
- 隨 store `previewTagId → previewKey` 改名調整 props 佈線；其餘不動

### 5.4 效能與索引評估（D1 查詢成本）

- **查詢形狀**：OR/AND 都是「`idx_customer_tags_tag_id` 索引範圍掃描（每個 tagId 一段）→ 以 rowid 回表取 `customer_id` → `customers` 主鍵點查 → GROUP BY 臨時 B-tree」。掃描列數 = 所選標籤的 `customer_tags` 列數**總和**（上限 10 標籤）。
- **量級估算**：以每標籤 5,000 客戶、10 標籤的悲觀情境計，掃描 ≤ 50,000 索引列 + 去重後 ≤ 50,000 次 customers 主鍵點查——對 SQLite/D1 是毫秒~百毫秒級，且 create 是低頻操作、preview 有前端 debounce（選擇變動才觸發），可接受。實際瓶頸仍是 Phase 1 既有的「快照 insert 分塊」（`d1-chunks.ts`，每批 14 列），與本階段無關。
- **綁定參數**：`inArray` 最多 10 個參數 ≪ D1 的 100 參數上限（母文件 §5.3），不需分塊。
- **結論：不新增任何索引。** `idx_customer_tags_tag_id`（`migrations/0018`）已完整覆蓋 `WHERE tag_id IN (...)`；理論上 `(tag_id, customer_id)` 覆蓋索引可省回表，但在上述量級下收益無感，不值得為此加寫入成本——**若未來 preview 實測 > 500ms 再議**。

---

## 6. 檔案異動清單

**後端（4 檔）**

| 檔案 | 異動 |
|------|------|
| `src/modules/broadcast/services/audience-service.ts` | `resolveSingleTagAudience/previewSingleTagAudience` → `resolveAudience/previewAudience`（多標籤 + matchMode）；`ensureActiveTag` → 批次版 `ensureActiveTags`（回傳 id+name 供 preview）；新增逐標籤計數查詢 |
| `src/modules/broadcast/services/broadcast-service.ts` | `preview()`/`create()` 簽名接 `tagIds[]+matchMode`；移除 `validateCreateInput` 的單標籤檢查（`:175-181`）；`create()` 寫入去重後 `tagIds` 與實際 `matchMode`（`:43-44`） |
| `src/modules/broadcast/handlers/broadcast-main.ts` | 移除 preview 的 Phase 1 guard（`:30-35`）；`parseCreateInput`/`parsePreviewInput` 增 `matchMode` 解析與 tagIds 上限/去重驗證 |
| `src/modules/broadcast/types/index.ts` | `CreateBroadcastInput` 增 `matchMode?`；`BroadcastAudiencePreview` 增 `matchMode`+`tags[]`；error code union 移除 `PHASE1_SINGLE_TAG_ONLY`；新增 `BROADCAST_MAX_TAGS` 常數 |

**前端（6 檔）**

| 檔案 | 異動 |
|------|------|
| `frontend/src/api/broadcasts.ts` | 請求/回應型別增 `matchMode`、`tags[]` |
| `frontend/src/stores/broadcasts.ts` | `previewTagId` → `previewKey`（tagIds+matchMode 複合 key） |
| `frontend/src/components/broadcast/BroadcastComposeCard.vue` | 多選標籤 + AND/OR 切換 + 逐標籤預覽 + 交集 0 人警告 |
| `frontend/src/components/broadcast/BroadcastHistoryList.vue` | 標籤膠囊 + 匹配模式徽章 |
| `frontend/src/components/broadcast/BroadcastDetailModal.vue` | 標頭標籤膠囊 + 徽章 |
| `frontend/src/views/BroadcastView.vue` | props 佈線隨 store 改名調整 |

**測試（既有 + 新增）**

| 檔案 | 異動 |
|------|------|
| `tests/modules/broadcast/audience-service.test.ts` | 擴充 AND/OR/去重/空交集案例 |
| `tests/modules/broadcast/broadcast-main.test.ts` | 擴充 matchMode/上限/去重驗證案例 |
| `tests/modules/broadcast/broadcast-service.test.ts` | 擴充 create 寫入 matchMode/去重 tagIds 案例 |
| `frontend/src/components/broadcast/__tests__/BroadcastComposeCard.test.ts` | 新增（元件測試，Vitest + Testing Library 慣例） |

**不動**：`broadcast-sender-service.ts`、`d1-chunks.ts`、`src/db/schema.ts`、`src/index.ts`、`migrations/`。

---

## 7. 測試計畫

**單元測試 — 受眾解析（`tests/modules/broadcast/audience-service.test.ts`）**
- OR：客戶同時命中 2 個標籤只出現一次（去重）；聯集人數 = |A ∪ B|
- AND：只回同時帶齊全部標籤的客戶；|A ∩ B| 與手工 SQL 一致
- 輸入含重複 tagId（如 `[3,3,5]`）：靜默去重，AND 的 N 以去重後計（N=2）
- AND 交集為空：回空陣列（不拋錯）
- 軟刪客戶被排除（OR/AND 各一案例）
- 任一 tag 不存在/停用/軟刪 → `TAG_NOT_FOUND`（D12）
- 單標籤 + `'any'` 結果與 Phase 1 行為等價（回歸保護）

**單元測試 — handler 驗證（`tests/modules/broadcast/broadcast-main.test.ts`）**
- `matchMode: 'bogus'` → 422（field: matchMode）
- 去重後 11 個 tagIds → 422；恰 10 個 → 通過
- 無 `matchMode` → 以 `'any'` 進 service（向後相容）
- 多元素 `tagIds` 的 preview/create 不再回 `PHASE1_SINGLE_TAG_ONLY`

**單元測試 — service（`tests/modules/broadcast/broadcast-service.test.ts`）**
- create 持久化去重後 `tagIds` JSON 與傳入的 `matchMode`
- AND 交集 0 人 → `EMPTY_AUDIENCE` 422 不落庫

**前端元件測試（`frontend/src/components/broadcast/__tests__/BroadcastComposeCard.test.ts`）**
- 多選/移除標籤觸發 preview 事件且 payload 含正確 `tagIds`+`matchMode`
- 切換 AND/OR 重新觸發 preview
- 達 10 個上限後不可再選
- `matchMode='all'` 且 preview total=0：警告可見、送出鈕 disabled
- 逐標籤 chips 渲染 `tags[]` 的名稱與人數

**手動驗收**：對 production 鏡像（`bun run db:sync:local` + `bun run dev:local`）以已知標籤組合核數——preview 數字與手工 SQL（§5.1 兩式）一致；實發一次 2 標籤 OR 群發確認快照無重複收件人。

**工程檢查**：`bash scripts/check.sh`、`bun run check:routes:ci`（雖未動路由，慣例仍跑）、`bun run test:modules`、`cd frontend && bun run test && bun run lint`。

---

## 8. Rollout（部署與回滾）

- **零 migration**（D10，已對 `migrations/0051`/`0052` 與 `src/db/schema.ts:269-306` 驗證）：`tag_ids`、`match_mode` 欄位與所有需要的索引皆已在 production。
- **純增量、無 feature flag**：API 變更全為放寬（guard 移除）與 additive 欄位；舊前端打新後端、新前端打新後端皆相容。唯一的「開關」就是驗證規則本身。
- **部署順序**：後端先（`bun run deploy`）、前端後（`bun run deploy:pages`）。順序反了也安全——舊後端會對多標籤請求回 `422 PHASE1_SINGLE_TAG_ONLY`，前端既有 error 顯示路徑可承接。
- **回滾**：revert + 重新部署即可，無資料形狀變更；期間建立的多標籤群發紀錄在舊版列表仍可正常顯示（`tagIds[]` 本來就是陣列渲染）。

---

## 9. Non-goals（本階段明確不做）

| 項目 | 一行理由 | 歸屬 |
|------|---------|------|
| Facebook 發送 | 需 24hr 視窗判定 + Graph API 逐一發送，與受眾解析正交，獨立出貨風險更低 | 母文件 §11.2 P2-T1/T2 |
| Queue 化非同步發送 | 移除 5000 人上限需 queue consumer + 終態競態處理，是獨立的工程題 | 母文件 §11.2 P2-T4/T5 |
| 排程群發（scheduledAt） | 需 Cron Trigger + 取消流程，依賴 Queue 化先行 | 母文件 §12 Phase 3 |
| 訊息模板 | 新表 + CRUD + UI，與受眾定位無關 | 母文件 §12 Phase 3 |
| 圖片 / Flex 訊息 | `contentType` 演進牽動發送管線與 UI 編輯器，維持純文字 | 母文件 §12 Phase 3（廣義） |
| 標籤排除（NOT）/ 巢狀條件 | `matchMode` 二值設計刻意保持簡單；有真實需求再擴充 schema | 未排program |
| 群發權限的團隊範圍過濾（只准選自己團隊的標籤） | 沿用 Phase 1 行為（admin/lead/supervisor 可選所有標籤），權限細化屬母文件 P2-T9 | 母文件 §11.2 P2-T9 |
| 報表頁 | 與本階段無耦合 | 母文件 §11.2 P2-T8 |

---

## 10. 任務拆解（依依賴排序，每項 ≤ 半天）

- [ ] **P2M-T1. 受眾解析多標籤化（後端核心）**
  - 內容：§5.1 —— `resolveAudience`/`previewAudience`/`ensureActiveTags` + 逐標籤計數；`types/index.ts` 的 preview/input 型別與 `BROADCAST_MAX_TAGS` 常數
  - 驗收：§7 受眾解析全部單元測試綠；單標籤 `'any'` 與 Phase 1 結果逐列相同；本地鏡像手工 SQL 核數一致
  - 驗證：`bun run build`；`bunx vitest run tests/modules/broadcast/audience-service.test.ts`
  - 檔案：`audience-service.ts`、`types/index.ts`、`tests/modules/broadcast/audience-service.test.ts`

- [ ] **P2M-T2. Service 層鬆綁 + 持久化**
  - 內容：`broadcast-service.ts` 的 `preview()`/`create()` 接新簽名、移除單標籤檢查、寫入去重 `tagIds` + `matchMode`；error code union 移除 `PHASE1_SINGLE_TAG_ONLY`
  - 驗收：create 落庫的 `tag_ids`/`match_mode` 正確；AND 空交集回 `EMPTY_AUDIENCE`；全案 grep 無 `PHASE1_SINGLE_TAG_ONLY` 殘留（前端 error reason 型別除外，若有）
  - 驗證：`bunx vitest run tests/modules/broadcast/broadcast-service.test.ts`；`bun run build`
  - 檔案：`broadcast-service.ts`、`types/index.ts`、對應測試

- [ ] **P2M-T3. Handler 驗證規則**
  - 內容：`broadcast-main.ts` 移除 preview guard、`matchMode` 解析、上限/去重驗證（§5.2 規則 1–4）
  - 驗收：§7 handler 測試全綠；curl 多標籤 preview/create 走通；`matchMode` 缺省行為與 Phase 1 相同
  - 驗證：`bunx vitest run tests/modules/broadcast/broadcast-main.test.ts`；`bash scripts/check.sh backend`
  - 檔案：`broadcast-main.ts`、對應測試

- [ ] **P2M-T4. 前端 API client + store**
  - 內容：`api/broadcasts.ts` 型別擴充；`stores/broadcasts.ts` `previewTagId → previewKey`
  - 驗收：型別對齊後端回應（含 `tags[]`）；快速連續切換標籤/模式時舊回應不覆蓋新回應（序號機制沿用）
  - 驗證：`cd frontend && bun run type-check && bun run lint`
  - 檔案：`frontend/src/api/broadcasts.ts`、`frontend/src/stores/broadcasts.ts`、`frontend/src/views/BroadcastView.vue`（佈線）

- [ ] **P2M-T5. 撰寫卡多選 UI + AND/OR 切換 + 預覽**
  - 內容：§5.3 的 `BroadcastComposeCard.vue` 全部——多選膠囊、segmented 切換、逐標籤 chips、交集 0 人警告、confirm 文案
  - 驗收：瀏覽器實走「多選→切模式→預覽變化→送出」；0 交集擋送出；上限 10 生效；設計符合 Design System §15 檢查表；無 `.btn*` 重定義（`bun run lint:scoped-btn`）
  - 驗證：`bun run type-check`；元件測試（§7）綠；目視
  - 檔案：`BroadcastComposeCard.vue`、`frontend/src/components/broadcast/__tests__/BroadcastComposeCard.test.ts`

- [ ] **P2M-T6. 歷史列表 / 明細的多標籤顯示**
  - 內容：`BroadcastHistoryList.vue` + `BroadcastDetailModal.vue` 標籤膠囊與匹配模式徽章（含已刪標籤 fallback `標籤 #id`）
  - 驗收：Phase 1 舊紀錄（單標籤）顯示正常無徽章；新多標籤紀錄顯示全部標籤 + 正確徽章
  - 驗證：`bun run type-check`；瀏覽器目視新舊紀錄各一筆
  - 檔案：`BroadcastHistoryList.vue`、`BroadcastDetailModal.vue`

- [ ] **P2M-T7. 端到端驗收演練 + 文件收尾**
  - 內容：真實 2 標籤 OR 與 2 標籤 AND 各發一次（測試帳號）；§11 驗收清單逐項勾；更新 `docs/modules/broadcast.md` 的 Phase 範圍描述
  - 驗收：§11 全數通過
  - 驗證：`bash scripts/check.sh`；`bun run test:modules`；`cd frontend && bun run test`

---

## 11. 驗收清單（Claude 審查時逐項檢核）

**功能**
- [ ] OR：2 標籤聯集人數 = 手工 SQL 核數；同客戶命中雙標籤僅收到一則訊息、快照僅一列
- [ ] AND：交集人數精確；只帶其中一個標籤的客戶不在快照內
- [ ] preview 逐標籤人數與 `GET /tags/:id/customers` 各自的 total 一致
- [ ] AND 交集 0 人：preview 顯示警告、送出被擋；create 直接打 API 回 `422 EMPTY_AUDIENCE`
- [ ] 單標籤 + 無 `matchMode` 的舊式請求行為與 Phase 1 完全一致（回歸）
- [ ] 歷史列表/明細正確顯示多標籤與匹配模式；Phase 1 舊紀錄顯示正常

**防護**
- [ ] 重複 tagIds 被靜默去重且 AND 的 N 正確
- [ ] 去重後 > 10 個標籤 → 422；含不存在/停用/軟刪 tag → 404（整包拒絕）
- [ ] `matchMode` 非法值 → 422
- [ ] 快照/發送/寫回對話等 Phase 1 防護（冪等、配額、5000 上限、例外回復）全部不回歸

**工程**
- [ ] 零 migration：`migrations/` 與 `src/db/schema.ts` 無任何變更
- [ ] `bash scripts/check.sh` 全綠；`check:routes:ci`、`check:sql-raw:ci`、`check-import-paths` 通過
- [ ] `bun run test:modules` 與前端 Vitest 全綠；無 `any`、無 `.btn*` 重定義
- [ ] `PHASE1_SINGLE_TAG_ONLY` 自程式碼庫移除乾淨
