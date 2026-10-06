# 群發圖文（Broadcast Images）設計

- 日期：2026-10-06
- 狀態：設計已核准，待實作計畫
- 範圍：`src/modules/broadcast/`、`frontend/src/components/broadcast/`、migration 0063

## 1. 目標

行銷團隊需要在群發中發送圖片。現況群發只能發純文字（`BroadcastContentType = 'text'`，
送出時寫死 `[createTextMessage(content)]`）。

**成功標準**：一則群發可包含「文字（選填）+ 最多 4 張圖片」，客戶在 LINE 依序收到
文字、圖1…圖4；客服在對話紀錄中看得到同樣的文字與圖片。

## 2. 已定決策

| 決策 | 內容 | 理由 |
|---|---|---|
| 訊息組成 | `[文字?] + [圖1..圖4]`，一次 multicast | LINE multicast 上限 5 則（`line-messaging.ts:151` 直接拒絕 >5）；拆兩次送有部分失敗與交錯風險（使用者選定方案 X） |
| 內容規則 | 文字或圖片至少一項；圖片 0–4 張 | 允許純圖片群發 |
| 平台 | 僅 LINE；Facebook 沿用 `platform_not_supported_phase1` 略過 | 範圍控制，不變 |
| 額度檢查 | `hasQuota()` **不變**（以收件人數計） | LINE 官方：「The number of messages is counted by the number of people you send a message to」，一次請求多則訊息仍按人計 |
| 圖片 URL | 送出時由 `r2Key` 以 `getSignedFileUrl(env, r2Key, PERSISTENT_ATTACHMENT_URL_TTL_SECONDS)` 重新簽名（10 年） | 與單發 `message-delivery-service.ts:176-184` 一致；與上傳端點產生的 `fileUrl` 格式脫鉤 |
| 預覽圖 | 前端以 canvas 產生 ≤1MB JPEG 預覽圖，原圖與預覽圖各自上傳 | LINE `previewImageUrl` 上限 1MB；超過時 API 照樣回成功，但客戶端顯示破圖（靜默失敗）。系統目前無任何縮圖能力（`FileService.generateThumbnail` 為 stub、無 Images binding），canvas 為原生能力、零新依賴 |

## 3. 資料模型（migration 0063）

新增子表，並同步宣告於 `src/db/schema.ts`（含 unique / index —— 只存在 migration SQL 的約束
曾在 2026-06-17 重建時遺失）：

```
broadcast_attachments
  id                     INTEGER PK
  broadcast_id           TEXT    NOT NULL  FK broadcasts.id        ON DELETE CASCADE
  attachment_id          TEXT    NOT NULL  FK file_attachments.id  ON DELETE RESTRICT
  preview_attachment_id  TEXT    NOT NULL  FK file_attachments.id  ON DELETE RESTRICT
  position               INTEGER NOT NULL  (0..3)
  created_at             TEXT    DEFAULT CURRENT_TIMESTAMP
  UNIQUE(broadcast_id, position)
  UNIQUE(broadcast_id, attachment_id)
```

- `broadcasts.content` 保持 NOT NULL；純圖片群發存 `''`（避免 SQLite 重建表）。
- `BroadcastContentType` 擴為 `'text' | 'mixed'`；有圖片即 `'mixed'`。
- `RESTRICT`：群發歷史引用的圖片不可被檔案管理刪除。
- 套用後執行 `bun run db:doc:schema`，SCHEMA.md 與 migration 同一個 commit。

## 4. API

### 上傳（沿用既有端點）

`POST /api/files/upload`（前端 `filesApi.uploadFile`）——不需 conversationId，
產生 `messageId = NULL`、`uploadedBy = 上傳者` 的 `file_attachments` 列。每張圖上傳兩次：原圖、預覽圖。

### 建立群發 `POST /api/broadcasts`

新增欄位：

```
attachments?: Array<{ attachmentId: string; previewAttachmentId: string }>   // 依陣列順序 = position
```

伺服器端驗證（不信任前端）：

1. `content`（trim 後）長度 0–2000；`content` 為空時 `attachments` 至少 1 筆。
2. `attachments.length <= 4`，所有 id 不重複。
3. 每個原圖與預覽圖：存在、`uploadedBy === 呼叫者`、`messageId IS NULL`、
   `mimeType ∈ {image/jpeg, image/png}`。
4. 原圖 `fileSize <= 10MB`；預覽圖 `fileSize <= 1MB`。
5. 違反時回 422 `INVALID_BROADCAST_INPUT`，附欄位錯誤。

`BroadcastRecord` 回傳新增 `attachments: Array<{ position, attachmentId, previewUrl, fileUrl }>`
供歷史與詳情顯示。權限沿用 admin / lead / supervisor。

## 5. 送出流程（`BroadcastSenderService`）

1. 讀取 broadcast 與其 `broadcast_attachments`（依 position 排序）。
2. **迴圈外**組一次訊息陣列：`content` 非空則先放 `createTextMessage`，
   再依序放 `createImageMessage(signedOriginal, signedPreview)`。
3. 各 token 群組共用此陣列呼叫 `multicastLineMessage`；其餘（略過、額度、失敗標記）不變。

## 6. 回寫對話紀錄

對齊單發的資料形狀（一則訊息、多個附件；渲染端以 `file_attachments.messageId` JOIN，
見 `CustomerMessageDO.ts:198-226`、`MessageBubble.vue:97-107`）：

- 每位收件人一則 `messages`：`content = 文字`、`messageType = 有圖 ? 'file' : 'text'`、
  `metadata = { broadcastId, attachmentIds }`。
- 每張圖為該訊息新增一列 `file_attachments`：複製原圖列的 `filename / mimeType / fileSize / r2Key`，
  `messageId`、`conversationId` 指向該訊息，`fileUrl` 為 10 年簽名 URL。
- 最多 5,000 人 × 4 張 = 20,000 列，沿用 `chunkItems` 分批寫入。

### 共用 r2Key 的保護（必要修正）

`FileService.deleteFile`（`file-service.ts:285-316`）刪 DB 列時會一併刪除 R2 物件，且不檢查其他列是否共用
同一 `r2Key`。上述複製列會讓「刪一則對話裡的圖」毀掉所有收件人的圖。

修正：`deleteFile` 刪 R2 前查詢 `file_attachments` 中是否仍有其他列使用同一 `r2Key`；有則只刪 DB 列。
此修正獨立成一個 commit，附測試。

## 7. 前端

`BroadcastComposeCard.vue`：

- 文字欄改為選填，提示「文字或圖片至少一項」。
- 圖片區：`<input type="file" accept="image/jpeg,image/png" multiple>`，最多 4 張；
  縮圖格、移除、左右調整順序；前端預檢格式與 10MB。
- 選圖後立即以 canvas 產生預覽圖（長邊 1024px、JPEG，品質由 0.85 起遞減直到 ≤1MB），
  原圖與預覽圖並行上傳，顯示進度；上傳中禁止送出。
- 確認對話框文案帶出「文字 + N 張圖片」。
- `BroadcastDetailModal` / `BroadcastHistoryList`：顯示圖片縮圖（用 previewUrl）。
- 遵循 Apple-Native Soft Minimalism 設計系統；不在 scoped style 重定義 `.btn*`。

## 8. 錯誤處理

| 情境 | 行為 |
|---|---|
| 上傳失敗 | 該格顯示錯誤與重試；不可送出 |
| 建立時附件驗證失敗 | 422 + 欄位錯誤，前端顯示 |
| LINE 抓圖失敗（URL 不可達） | LINE 拒絕整個請求 → 該群組標記 `line_api_failed`（既有邏輯） |
| 回寫對話失敗 | 既有行為：外層 catch 記錄；LINE 已送出，不影響收件人狀態 |

## 9. 測試

後端（Vitest）：
- 建立驗證：純文字、純圖片、文字 + 4 圖、5 圖拒絕、空內容拒絕、他人上傳的附件拒絕、
  已綁訊息的附件拒絕、錯誤 MIME、預覽圖 >1MB 拒絕。
- 送出：訊息陣列順序 `[text, img0..img3]`、純圖片時不含 text、預覽 URL 正確傳入。
- 回寫：每位收件人一則訊息 + N 列附件，`messageId` 正確。
- `deleteFile`：共用 r2Key 時不刪 R2；最後一列時才刪。

前端（Vitest）：預覽圖產生（≤1MB 遞減品質）、最多 4 張、canSubmit 規則。

真機驗收：對測試標籤群發「文字 + 4 張圖（含一張 >1MB 原圖）」，確認 LINE 端順序與預覽圖正常、
客服對話紀錄顯示圖片。

## 10. 不在範圍內

- Facebook 群發。
- 單發訊息 >1MB 圖片的破圖問題（同一個根因：沒有預覽圖）——另開 issue 追蹤。
- 影片、檔案、Flex 圖文卡片、排程群發、多標籤。
