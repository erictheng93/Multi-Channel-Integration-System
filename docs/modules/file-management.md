# File-Management 模組 — 檔案上傳與儲存

> **位置**: `src/modules/file-management/`  
> **角色**: 訊息附件、客戶上傳、管理員上傳的統一進出口（背後是 R2）。

---

## 1. 這個模組是什麼？

所有檔案進系統都走這裡：上傳、驗證、儲存到 Cloudflare R2、產生下載連結（含過期）、提取 metadata、產縮圖。它確保檔案安全（加密傳輸、MIME 白名單、隱私 EXIF 清理）也確保高效（自動重試、chunk 上傳）。

## 2. 解決什麼問題？

| 場景 | File-Management 模組做什麼 |
|---|---|
| 客戶傳照片進對話 | 5MB 內 → R2 → 產縮圖 → 連到訊息 |
| 客服寄 PDF 報價 | 10MB 內 → R2 → 1 小時短連結給客戶 |
| 管理員上傳系統檔 | 上限放寬到 50MB |
| 想知道本月用了多少儲存 | `GET /stats/summary` 30 天視窗 |

## 3. 主要功能

- **多格式上傳**：圖片 / 影音 / PDF / DOC，依類型套不同上限
- **R2 儲存**：自動 3 次重試，1 秒間距
- **Presigned URL**：預設 1 小時過期，可調
- **自動縮圖**：圖片產 200×200 80% JPEG 縮圖
- **Metadata 抽取**：尺寸 / 時長 / MIME / 副檔名
- **回應模式**：streaming / buffer / urlOnly 三種
- **軟刪除**：標記不刪實體
- **統計**：按平台分類儲存使用

## 4. 操作介面入口

| 介面 | 用途 |
|---|---|
| `ConversationDetail.vue` 內附件按鈕 | 對話內上傳 |
| FileUpload.vue / FileViewer.vue / FileList.vue（規劃中） | 獨立檔案 UI |

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET | `/api/files/health` | R2 + DB 健康 |
| GET | `/api/files/info` | 功能與限制清單 |
| GET | `/api/files/stats/summary` | 30 天統計 |
| POST | `/api/files` | 上傳（multipart / form-data） |
| GET | `/api/files/:fileId` | 下載（responseType / urlOnly / urlExpiresIn） |
| DELETE | `/api/files/:fileId` | 軟刪 |

## 6. 涉及的 Durable Objects

**不直接使用 DO**。訊息相關更新可能間接觸發 `CustomerMessageDO` / `CustomerConversationDO`。

## 7. 邊界案例與小細節

- **大小依類型不同**：圖片 5MB / 影音 20MB / 文件 10MB / 管理員 50MB
- **EXIF 自動清理**：保護隱私
- **R2 路徑分類**：`attachments/` / `media/` / `documents/` / `thumbnails/` / `temp/`
- **平台能力矩陣**：LINE 支援縮圖 + preview；Facebook 加 metadata；System 加 virus_scan；Admin 加 batch_operations
- **驗證鏈**：min 1 byte → max size → MIME 白名單 → 副檔名映射
- **狀態流轉**：`pending → processing → completed / failed`
- **Presigned URL TTL 預設 3600s**

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| 上傳被拒 | 看是否超出該類型上限或 MIME 不符 |
| 下載連結過期 | 預設 1 小時；要久請帶 `urlExpiresIn` |
| 縮圖沒出現 | 確認檔案類型是圖片；非圖檔不產縮圖 |

---

**相關模組**：[messaging](./messaging.md)、[customer-conversations](./customer-conversations.md)
