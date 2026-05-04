# Documentation Contributing Guide

> 本指南說明如何為本專案文檔做出貢獻。文檔結構於 2026-05 重新整理，舊版分類（api/、enterprise/、components/、features/、implementation/、security/、templates/）已不存在，請以 [INDEX.md](./INDEX.md) 為準。

**最後更新**: 2026-05-04

---

## 目錄結構

實際結構如下（以 [INDEX.md](./INDEX.md) 為單一真相來源）：

```
docs/
├── INDEX.md              # 文檔總索引（請以此為準）
├── PROJECT_OVERVIEW.md   # 專案對外完整描述
├── CURRENT_STATUS.md     # v4.0.0 系統現況快照
├── CONTRIBUTING.md       # 本文件
├── WORKSPACE_BOUNDARIES.md # Bun package 邊界
├── UIUX-Design-System.md # Apple-Native Soft Minimalism 設計系統
├── modules/              # 24 份模組使用者手冊
├── reference/            # API 參考、規格書（BRD/FRS/NFR/SRS）、編碼標準
├── guides/               # 使用者指南、部署、CORS、KV、效能等
├── architecture/         # 系統架構、WebSocket、資料庫、安全、效能
├── development/          # 測試、組件、工具、前端開發指引
├── claude/               # Claude Code 開發指引
└── history/              # 歷史審計、實作報告、遷移記錄、廢棄方案
```

> 「曾經出現但已被刪除」的舊類別（如 `enterprise/`、`features/`）若你看到舊文檔仍提及，請忽略。

---

## 文件命名規範

1. **使用英文 + 大寫底線**
   - 正確：`WEBSOCKET_FINAL_ARCHITECTURE.md`、`API_REFERENCE.md`
   - 錯誤：`websocket guide.md`、`websocket-guide.md`、`WebSocket指南.md`
2. **模組手冊例外**：`docs/modules/` 內檔案使用小寫加連字符（與 `src/modules/` 資料夾名一致），例如 `delayed-message.md`、`auto-reply.md`
3. **歷史快照加日期**：放在 `history/` 內的審計、報告檔名末尾帶日期，如 `TECHNICAL_DEBT_AUDIT_2026-04-21.md`

---

## 內容規範

### 不准用 Emoji
專案規範禁止 emoji 出現在所有原始碼與文檔。已有 emoji 的舊檔可用以下工具批次清除：
```powershell
bun run scripts/remove-emoji.py --root .
```

### 中英文選擇
- 對內文檔：中文（繁體）為主，與專案其他文件一致
- API 參考、規格書（BRD/FRS/NFR/SRS）：英文或雙語
- 不要在同一份文件內混用簡體與繁體

### Markdown 規則
- 統一 UTF-8 編碼
- 使用標準 GFM 語法
- 程式碼區塊指定語言（` ```typescript ` 而非裸 ` ``` `）
- 標題層級從 H1 起，逐級遞進

### 連結規則
- 內部連結使用相對路徑：`[模組索引](./modules/INDEX.md)`
- **每次新增文檔請更新 [INDEX.md](./INDEX.md)** — 否則文檔會被孤立
- 連到原始碼用 `path:line` 格式：`src/index.ts:846`

---

## 何時用哪個目錄

| 你要寫的東西 | 放在哪 |
|---|---|
| 「某模組怎麼用」使用者手冊 | `modules/<module>.md` |
| API 端點規格、欄位定義 | `reference/api/` |
| BRD / FRS / NFR / SRS | `reference/specifications/` |
| 操作步驟、設置流程 | `guides/` |
| 部署相關 | `guides/deployment/` |
| 系統設計、架構決策 | `architecture/` |
| 測試方法、覆蓋率報告 | `development/testing/` |
| 一次性審計、已完成計畫、遷移紀錄 | `history/` |
| Claude Code 專用開發規範 | `claude/` |

**判斷原則**：問自己「這份文檔半年後還有人會讀嗎？」
- 會 → 放在 reference / guides / architecture / modules
- 不會（一次性） → 放在 history

---

## 新增文檔的標準流程

```bash
# 1. 確認目錄正確
# 2. 用相同類別的既有文檔為範本（不要從外部範本複製過時結構）
# 3. 寫完後務必：
#    a. 更新 docs/INDEX.md 加上連結
#    b. 如果是模組手冊，更新 docs/modules/INDEX.md
#    c. 跑 bun run check 確認沒打壞健康檢查
git add docs/
git commit -m "docs: add <topic> guide"
```

---

## 文檔健康檢查

```powershell
# 移除所有 emoji（dry-run 不會修改）
bun run scripts/remove-emoji.py --root . --dry-run

# 文件格式檢查
bun run scripts/check-docs.py --all
```

---

## 提交清單

提交文檔變更前確認：

- [ ] 文件名符合命名規範
- [ ] 沒有 emoji
- [ ] UTF-8 編碼，繁體中文（除規格書類）
- [ ] 放在正確目錄
- [ ] 內部連結指向實際存在的檔案
- [ ] 已更新 [INDEX.md](./INDEX.md)
- [ ] 程式碼範例語法正確、可執行
- [ ] 內容反映現況（特別注意 v4.0.0 是 WebSocket+DO，不是 v3 的 SSE+KV）
- [ ] 跑過 `bun run check` 通過

---

## 文檔常見錯誤

| 錯誤 | 修正 |
|---|---|
| 「使用 SSE 連線」 | 「使用 WebSocket + Durable Objects」（v4 已換） |
| 「3 層系統角色 Admin/Team/Agent」 | 「2 層系統角色 Admin/Agent + 3 層團隊角色 Member/Lead/Supervisor」 |
| `npm run xxx` | `bun run xxx`（本專案 Bun only） |
| 「個人對話指派」 | 「團隊對話指派」（v4 已移除個人指派） |
| 連到 `docs/api/`、`docs/enterprise/` | 改連 `docs/reference/api/`、實際對應位置 |
| 「8 個 Durable Objects」 | 「10 個 Durable Objects」（含 MetricsCollectorDO + LockCoordinator） |
