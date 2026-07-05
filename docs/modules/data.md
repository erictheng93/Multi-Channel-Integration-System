# Data 模組 — 資料備份

> **位置**: `src/modules/data/`
> **角色**: D1 資料庫的手動備份(建立、列表、下載),補足自動化每日備份以外的即時需求。
> **完整維運手冊**: [`docs/operations/BACKUP_AND_RESTORE.md`](../operations/BACKUP_AND_RESTORE.md) — 排程、還原步驟、R2 生命週期規則請看該文件;本文件只涵蓋模組本身的功能與 API。
> **背景**: 因應 2026-06-17 生產環境 D1 遭刪除且無備份的事故而建立。

---

## 1. 這個模組是什麼？

管理員可以在「資料管理 → 資料備份」頁面看到最近一次自動備份的時間,並可一鍵手動觸發全量備份到 R2,或下載過去的備份檔。

## 2. 解決什麼問題？

| 場景 | Data 模組做什麼 |
|---|---|
| 想在重大操作前先手動存一份快照 | 「立即備份到雲端」按鈕 → `POST /run` |
| 想確認自動備份有沒有正常跑 | 頁面顯示 `lastAuto`(最近一次 `daily/` 備份) |
| 想拿一份舊備份做本地檢查 | `GET /download?key=...` 直接下載 `.sql` |
| 想知道目前雲端有哪些備份可用 | `GET /` 列出所有備份物件(依 tier 分類、依時間排序) |

## 3. 主要功能

- **全量 SQL dump**:`dumpDatabase()` 走 `sqlite_master` 抓所有 table 的 schema + 資料,逐表分頁(每頁 1000 列)避免超過 D1 回應限制
- **手動備份**:`POST /run` 產生 dump 並上傳至 R2 `manual/` 前綴,記錄觸發者(`triggeredBy`)與時間戳
- **備份列表**:`GET /` 列出 R2 bucket 內所有物件,依 `key` 前綴分類 tier(`daily`/`monthly`/`manual`/...),依上傳時間新到舊排序,並抓出最近一次自動(`daily`)備份
- **下載**:`GET /download?key=...` 直接串流 R2 物件內容,設定 `Content-Disposition` 觸發瀏覽器下載
- **自動化備份**(不在本模組內,由 GitHub Actions 執行):`.github/workflows/backup.yml` 每日 03:00(Asia/Taipei)跑 `wrangler d1 export`,詳見維運手冊

## 4. 操作介面入口

| 介面 | 用途 |
|---|---|
| `DataBackup.vue`(`components/data-management/`) | 主入口:顯示最近自動備份、「立即備份到雲端」按鈕、可下載的備份列表 |
| `frontend/src/api/backup.ts` | 對應三個後端端點的 API client |

路由:`/data/backup`,僅限 admin。

## 5. 主要 API 端點

全部掛 `jwtAuth` + `requireRole('admin')`(整份備份 = 全庫含 PII,因此不開放給非 admin)。

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET | `/api/data/backup` | 列出最近備份 + 最近一次自動備份 |
| POST | `/api/data/backup/run` | 建立一份手動全量備份到 R2 `manual/` |
| GET | `/api/data/backup/download?key=...` | 下載指定備份物件 |

## 6. 涉及的 Durable Objects

**不使用 DO**。直接讀 D1(`env.DB`)與寫入 R2(`env.R2_BACKUP`)。

## 7. 邊界案例與小細節

- **`R2_BACKUP` binding 缺失時直接回 500**,不會靜默失敗成空列表——這是刻意設計,備份功能失效必須顯性可見
- **PAGE=1000 分頁**是為了避開 D1 單次查詢的回應大小限制,大表也能完整 dump
- **`escapeSqlValue` 手刻跳脫**(非 Blob 型別的 schema,故文字/數字/布林/NULL 涵蓋所有欄位)
- **備份不含 blob**:目前 schema 沒有 blob 欄位,dump 為純文字 SQL,可直接用 `wrangler d1 execute --file` 還原
- **R2 資料備份桶與檔案桶分離**:`mcis-backups`(備份)與 `mcis-files`(使用者上傳媒體)是不同 bucket,不可混用
- **R2 生命週期規則需手動在 dashboard 設定**(備份 CI 的 token 沒有 R2 lifecycle 管理權限),否則備份只會持續累積而不會過期清除(見維運手冊)

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| 頁面顯示「Backup storage not configured」 | 檢查 `wrangler.toml` 是否有綁定 `R2_BACKUP`,以及該 binding 是否真的指向 `mcis-backups` |
| 手動備份按鈕沒反應/報錯 | 檢查目前使用者是否為 admin;檢查 D1 dump 是否因表過大逾時(可從 `wrangler tail` 觀察) |
| 找不到最近自動備份(`lastAuto` 為 null) | 檢查 GitHub Actions `.github/workflows/backup.yml` 是否有失敗;確認 repo secrets `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` 有效 |
| 下載的 `.sql` 匯入失敗 | 確認資料庫已存在(`wrangler d1 create` 後 `database_id` 需同步更新到 `wrangler.toml`),詳見維運手冊「Restore」章節 |

---

**相關模組**:[system](./system.md)、[file-management](./file-management.md)(R2 上傳,不同 bucket)
