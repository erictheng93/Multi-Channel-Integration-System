# 企業級多渠道客服整合系統 — 專案總覽

> 本文件取代你過去拿到的 8 段式「核心功能模組」描述，覆蓋現行 v4.0.0 的真實能力範圍。  
> **最後更新**: 2026-05-04 · 對應版本 **v4.0.0 (Enterprise-Ready WebSocket System)**

---

## 主要功能

統一管理來自 **LINE OA、Facebook Messenger** 與未來擴充渠道（Instagram / WhatsApp / Telegram）的客戶訊息，讓客服人員可以在單一介面處理所有平台的對話。底層採 **Cloudflare Workers (Hono) + Vue 3 + TypeScript strict** + **Durable Objects + D1 + KV + R2 + Queues** 全雲端架構，支援 1000+ 併發連線、訊息延遲 P95 < 500ms。

---

## 14 大功能模組

### 1. 多渠道整合
- **LINE OA 完整整合** — Webhook 處理、訊息收發、客戶資料自動收集
- **Facebook Messenger** — API 架構就緒，等待最終整合驗收
- **AES-256-GCM 憑證加密** — 渠道 token 加密儲存，含 timing-safe 簽章驗證
- **JSON 設定欄位** — 加新平台不用改 schema
- **平台能力矩陣** — 每平台支援的功能（文字、圖、檔、Rich Menu、廣播）一覽

### 2. LINE LIFF 團隊綁定
- **QR Code 自動指派** — 客戶掃 QR → 自動進指定客服團隊
- **WebSocket 預通知** — 客戶完成加好友前，客服已看到「準備中」對話（延遲從 2-8s 降到 < 500ms）
- **歡迎訊息自動發** — 完成綁定後系統寄出
- **重新綁定處理** — 已存在客戶掃新 QR 自動 transfer 團隊

### 3. 對話管理系統
- **即時對話處理** — WebSocket 推送
- **完整狀態流轉** — `active` / `pending` / `in-progress` / `waiting` / `assigned`
- **團隊指派** — v4 起為團隊指派（個人指派已退場）
- **跨團隊轉移** — 自動寫入 `conversationTransfers` 表保留歷史
- **批次操作** — ≤ 100 筆 / 次

### 4. 訊息核心引擎
- **完整訊息 CRUD** — 含巢狀回覆（`replyToMessageId` + `threadId`）
- **訊息撤回** — 軟刪除，有 deadline 限制
- **訊息轉發** — 一則訊息可轉到 ≤ 20 個對話
- **全文搜尋** — 跨對話、可篩類型 / 寄件人 / 日期 / 撤回狀態
- **匯出** — JSON / CSV
- **附件** — 上傳到 R2、生 presigned URL

### 5. 延遲訊息系統
- **靈活延遲** — 1-120 秒可調，全域預設可覆蓋
- **真撤回** — DO Alarm 排程，撤回時直接從佇列取消，不是假裝
- **即時取消** — 撤回延遲 < 100ms
- **重新排程** — deadline 前可改延遲
- **企業級日誌** — 操作稽核 + 統計分析

### 6. 多渠道通知系統
- **多通道遞送** — WebSocket / Email / Push 並行
- **多種類型** — `new_message` / `conversation_assigned` / `mention` / `task_reminder` 等
- **三級優先級** — low / normal / high（high 走快速通道）
- **未讀計數** — 每類型獨立 badge
- **批次與系統公告** — 管理員可全站廣播
- **自動過期** — 可設 `expiresAt`

### 7. 認證與權限
- **JWT 雙令牌** — access 2h、refresh 7d，自動刷新
- **多團隊 JWT 編碼** — `primaryTeamId` + `allowedTeamIds[]` + `teamRoles{}` 都在 token
- **2 層系統角色** — `Admin` / `Agent`（v4 簡化，移除 `team` 系統角色）
- **3 層團隊角色** — `Member` → `Lead` → `Supervisor`
- **多種雜湊相容** — bcrypt / PBKDF2 / SHA256（漸進遷移）
- **失敗鎖定** — 5 次失敗鎖 15 分鐘
- **強制改密碼流程** — 含臨時 token

### 8. 即時協作功能
- **WebSocket + Durable Objects** — 1000+ 併發、P95 < 500ms
- **打字狀態廣播** — 自動排除送出者
- **線上狀態管理** — online / away / busy / offline + 自訂 metadata
- **對話房間管理** — 每對話獨立 DO，含 viewers 名單
- **多分頁同步** — 同帳號多分頁不衝突
- **跨設備一致性** — DO 提供強一致狀態

### 9. 檔案附件系統
- **多格式支援** — 圖 / 影音 / PDF / DOC，依類型不同上限（5-50 MB）
- **R2 雲端儲存** — 自動 3 次重試
- **Presigned URL** — 預設 1 小時，可調
- **自動縮圖** — 圖片產 200×200 80% JPEG
- **EXIF 自動清理** — 隱私保護
- **JWT 存取控制 + 軟刪除**

### 10. 團隊管理模組
- **完整成員 CRUD**
- **多團隊歸屬** — 一人多團隊，可在不同團隊有不同角色
- **Email + QR Code 邀請** — 含 LIFF QR 綁定
- **批次成員操作** — ≤ 50 / 次
- **跨團隊轉移** — admin 可整批搬移
- **密碼策略** — `changeable` / `unchangeable` / `must_change`

### 11. 客戶管理
- **跨平台身分** — `(platform, platformUserId)` 唯一識別
- **完整客戶檔案** — 暱稱 / 頭像 / Email / 電話 / 自訂 metadata
- **客戶標籤系統** — 可貼多個標籤
- **歷史對話聚合** — 客戶詳情頁直接看所有對話
- **多維度篩選** — 平台 / 團隊 / 標籤 / Email/ 電話有無

### 12. 自動回覆系統
- **多種觸發** — 關鍵字 / regex / 訊息類型 / 非營業時間 / welcome
- **AND / OR 條件邏輯** — `matchMode: any | all`
- **動作鏈** — 文字 / 圖 / Flex Message 可串接，依 `sortOrder`
- **營業時間排程** — 每週各日獨立、含時區
- **全域 / 團隊範圍**
- **觸發稽核日誌**

### 13. 報表與分析系統
- **業務分析** (analytics) — 對話 / 訊息 / 使用者 / 效能 4 大指標
- **20+ 報表類型** (reports) — JSON / CSV / Excel / PDF / HTML
- **報表排程** — daily / weekly / monthly + Email 寄送
- **預覽** — 用 SampleDataGenerators 樣本
- **自訂查詢與匯出**
- **時區支援** — 台北 / UTC / 紐約 / 倫敦
- **百分位計算** — P50 / P95 滾動視窗

### 14. 系統管理與營運
- **系統 KPI 儀表板** — 今日訊息、線上客服、回應時間、滿意率
- **API 監控** — 每端點延遲 / 錯誤率 / 5xx 計數
- **斷路器** — 過載時管理員可緊急斷流
- **稽核日誌** — 所有動作完整可追溯（依角色可見性）
- **資料庫管理** — 備份、還原、快取清除
- **Web Installer** — 視覺化自助部署工具

---

## 與舊描述（8 模組）對照

| 你原描述 | 現實對應 |
|---------|---------|
| 1. 多渠道整合模組 | §1 多渠道 + §2 LIFF |
| 2. 對話管理系統 | §3 對話 + §4 訊息 |
| 3. 延遲訊息系統 | §5 延遲訊息 |
| 4. 企業級認證與權限 | §7 認證權限 |
| 5. 即時協作功能 | §8 即時協作 + §6 通知 |
| 6. 檔案附件系統 | §9 檔案 |
| 7. 團隊管理模組 | §10 團隊 + §11 客戶 |
| 8. 系統管理功能 | §13 報表分析 + §14 系統營運 + §12 自動回覆 |

> 你原本 8 段描述大致對齊系統能力**主軸**，但缺少：自動回覆、客戶檔案管理、報表 / 分析雙層、稽核日誌、LIFF QR 預通知、佇列監控、檔案能力細節、會話切分（session）等。本文件補齊。

---

## 程式碼規模

| 項目 | 數值 |
|------|------|
| 後端模組 | 24 個（`src/modules/`） |
| Durable Objects | 10 個（綁定數） |
| 前端 Vue Views | 25 個（`frontend/src/views/`） |
| Pinia Stores | 10 個（`frontend/src/stores/`） |
| 後端測試 | 98 檔、2,466 通過（CI 子集） |
| 前端測試 | 154 檔、3,624 通過 |

---

## 文件導引

- **快速上手** → `docs/guides/QUICK_START.md`
- **使用者完整指南** → `docs/guides/USER_GUIDE.md`
- **模組手冊（24 份）** → `docs/modules/INDEX.md`
- **系統現況快照** → `docs/CURRENT_STATUS.md`
- **架構設計** → `docs/architecture/`
- **API 規格** → `docs/reference/api/`
- **部署** → `docs/guides/deployment/`
- **Claude Code 開發指引** → `CLAUDE.md` + `docs/claude/`
