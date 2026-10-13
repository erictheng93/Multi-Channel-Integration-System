# 備份機制與原理 (Backup Mechanism)

> 文件日期：2026-10-13。內容依 2026-10-12 的實際線上狀態逐項驗證寫成。
> 操作步驟（如何還原、指令）請看 [`BACKUP_AND_RESTORE.md`](./BACKUP_AND_RESTORE.md)；
> 本文件說明「備份了什麼、為什麼這樣設計、哪裡有缺口」。

## 目錄

1. [一頁總覽](#1-一頁總覽)
2. [設計背景與原則](#2-設計背景與原則)
3. [備份範圍：備了什麼、沒備什麼](#3-備份範圍備了什麼沒備什麼)
4. [機制一：每日自動備份](#4-機制一每日自動備份)
5. [機制二：後台手動備份](#5-機制二後台手動備份)
6. [保留策略與到期清理](#6-保留策略與到期清理)
7. [還原原理](#7-還原原理)
8. [安全性與資料機密](#8-安全性與資料機密)
9. [已知缺口與風險](#9-已知缺口與風險)
10. [驗證指令](#10-驗證指令)
11. [變更歷史](#11-變更歷史)
12. [後續建議](#12-後續建議)

---

## 1. 一頁總覽

```
                    生產環境 (Cloudflare 帳號)
 ┌──────────────────────────────────────────────────────────┐
 │  D1 mcis-db  ◄── 即時讀寫 ── Worker (Hono)                 │
 │     │                                                     │
 │     │ (A) 每日 03:00 台北，GitHub Actions 呼叫 wrangler     │
 │     │     d1 export → gzip → r2 object put                │
 │     │ (B) 管理員在後台按「立即備份」，Worker 自己串流寫 R2    │
 │     ▼                                                     │
 │  R2 mcis-backups                                          │
 │     daily/  monthly/  members/  tags/  assignments/       │
 │     manual/                                               │
 │                                                           │
 │  R2 mcis-files  (客戶媒體，無備份)                          │
 └──────────────────────────────────────────────────────────┘
        離線 / 外部副本：目前不存在
```

| 問題 | 答案 |
|---|---|
| 備份型態 | 每次都是**完整備份**，不是增量或差異 |
| 頻率 | 每日一次，另有管理員手動觸發 |
| 資料遺失上限 (RPO) | 最多約 24 小時 |
| 壓縮 | 自動備份有（gzip -9，`.sql.gz`）；手動備份沒有（純 `.sql`） |
| 存放位置 | 只有 R2 `mcis-backups`（與生產同一個 Cloudflare 帳號） |
| 保留 | `daily/` 30 天；`monthly/`、`members/`、`tags/`、`assignments/` 365 天；`manual/` 90 天 |
| 媒體檔 (`mcis-files`) | **沒有備份**，也沒有到期規則（永久保留） |
| 離線副本 | **沒有**（GitHub artifact 已於 2026-10-12 移除，原因見第 8 節） |

---

## 2. 設計背景與原則

### 為什麼有這套機制

2026-06-17，生產 D1 `mcis-db` 被整個刪除，當時沒有任何備份，客戶資料只能靠 LINE 後台 API 重建。
刪除 D1 是**永久且不可逆**的：Time Travel 的歷史會隨資料庫一起消失，Cloudflare 也不提供
自助還原已刪除資料庫。這套備份就是為了讓這種事件之後有路可走。

### 設計原則

| 原則 | 具體做法 |
|---|---|
| 備份不能依賴被保護的系統 | 排程跑在 GitHub Actions，不在生產 Worker 上，Worker 掛了或被改壞也照常備份 |
| 備份要能獨立還原 | 每份都是完整 SQL（schema + 資料），不需要先還原其他檔案才能用 |
| 還原步驟要少 | 選擇完整備份而非增量：DB 目前只有十幾 MB，完整備份最簡單、最不容易在還原當下出錯 |
| 失敗要大聲 | 匯出後檢查有無 `INSERT INTO`，沒有就讓 job 失敗，避免默默存下空備份 |
| 保留期依「偵測窗口」決定 | 容量成本很低，保留長度取決於多久後才會發現問題 |
| 備份與資料分離 | 備份放獨立的 `mcis-backups` bucket，不放資料 bucket `mcis-files` |

### 為什麼選完整備份

```
              完整（現行）          增量 / 差異
還原步驟       1 步，匯入即可        需串接多份，缺一份就失敗
單份大小       全量（約 1.2 MB 壓縮後） 小
資料庫規模     十幾 MB，無壓力        數 GB 以上才有明顯價值
D1 原生支援    wrangler d1 export    無原生增量匯出
```

結論：DB 規模遠未到需要增量的程度。若要縮短 RPO 低於 24 小時，更直接的做法是提高完整備份頻率。

---

## 3. 備份範圍：備了什麼、沒備什麼

| 資料 | 儲存位置 | 是否備份 | 說明 |
|---|---|---|---|
| 業務資料（對話、訊息、客戶、人員、團隊、標籤、設定） | D1 `mcis-db` | 是 | 每日完整匯出 |
| 檔案索引 `file_attachments` | D1 | 是 | 在 D1 內，隨整庫匯出 |
| 客戶上傳媒體 | R2 `mcis-files`（254 MB / 536 物件） | **否** | 目前最大的缺口 |
| 頻道憑證（LINE 等） | KV `credentials:line:*`（以 `JWT_SECRET` 加密） | **否** | 不在 D1，匯出不含 |
| 工作階段、快取、限流 | KV | 否 | 可再生，不需備份 |
| Durable Object 儲存 | DO | 否 | 見下方說明 |
| 程式碼 | Git | 是 | Git 本身 |
| Worker secrets（`JWT_SECRET` 等） | Cloudflare secrets | **否** | 備份不含；遺失需另行保管 |

Durable Object 說明：訊息廣播等 DO 的儲存是執行期狀態，不是系統的事實來源。
`DelayedMessageScheduler` 等會在 DO 儲存內持有待處理工作，這部分不在 D1 備份內；
本文件未逐一驗證各 DO 儲存了哪些資料，若要依賴備份還原此類狀態，需先個別確認。

### 自動備份產出的 4 份檔案

| R2 前綴 | 內容 | 用途 |
|---|---|---|
| `daily/` | 整個資料庫（schema + 全部資料） | 一般還原；每月 1 日另存一份到 `monthly/` |
| `monthly/` | 每月 1 日的全庫快照 | 長期還原點 |
| `members/` | `agents`、`teams`、`agent_teams` | 只還原人員與團隊 |
| `tags/` | `tags`、`customer_tags`、`conversation_tags` | 只還原標籤 |
| `assignments/` | `conversations`、`customer_team_assignments`、`conversation_transfers` | 只還原對話與客戶的團隊指派 |

後三者的內容也都在全庫備份內。獨立保存是為了在「只有一小塊設定被改壞」時能快速、局部還原，
不必整庫覆蓋。

---

## 4. 機制一：每日自動備份

實作檔案：`.github/workflows/backup.yml`

### 流程

```
  cron 0 19 * * *  (UTC 19:00 = 台北 03:00)
          │   也可由 workflow_dispatch 手動觸發
          ▼
  ┌─ 1. checkout + setup bun + bun install ──────────────────┐
  │                                                           │
  │  2. 匯出（共 4 次 wrangler d1 export --remote）            │
  │       全庫 / members / tags / assignments                 │
  │                                                           │
  │  3. 完整性檢查                                             │
  │       全庫、members 必須含 INSERT INTO，否則 job 失敗       │
  │       tags、assignments 為空只警告（可能尚無資料）          │
  │                                                           │
  │  4. gzip -9 壓縮四個檔，再逐一 gzip -t 驗證                 │
  │                                                           │
  │  5. wrangler r2 object put 上傳至 mcis-backups             │
  │       daily/  (每月 1 日加 monthly/)                       │
  │       members/  tags/  assignments/                        │
  └───────────────────────────────────────────────────────────┘
```

### 各步驟的原理

**排程與並行控制**：`concurrency: group: d1-backup`、`cancel-in-progress: false`。
同時只會有一個備份在跑，後到的排隊，不會中斷進行中的備份。

**匯出**：使用 `wrangler d1 export mcis-db --remote`。這是 Cloudflare 官方工具，
輸出包含 schema（資料表、索引、觸發器、檢視）與全部資料的 SQL。`--table` 參數可限定資料表，
用來產生三份局部備份。

**完整性檢查**：只檢查「有沒有 INSERT 陳述式」。它能擋掉「匯出成功但是空的」這類情況，
但不能證明資料完整或可還原（見第 9 節）。

**壓縮與驗證**：`gzip -9 -f` 之後以 `gzip -t` 測試壓縮檔結構。實測今日（2026-10-12）的全庫檔
壓縮後約 1.25 MB，對照 10 月 1 日月度快照原始檔約 14.8 MB，壓縮比約 12 倍。SQL 是重複性高的文字，
壓縮效果好。

**上傳**：`wrangler r2 object put ... --content-type=application/gzip --remote`。
每個物件的 key 含日期戳（UTC），所以同一天重跑會覆蓋同名物件，不會累積重複。

### 認證與權限

| 項目 | 說明 |
|---|---|
| 憑證 | repo secrets `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` |
| Token 需要的權限 | D1 讀取（匯出）、R2 寫入（上傳） |
| 沒有的權限 | R2 lifecycle 管理，需以互動式 `wrangler` 登入設定 |

---

## 5. 機制二：後台手動備份

實作檔案：`src/modules/data/handlers/backup.ts`，掛載於 `/api/data/backup`。

| 路由 | 功能 |
|---|---|
| `GET /api/data/backup` | 列出最近備份與「最近一次自動備份」（取 `daily/` 最新者） |
| `POST /api/data/backup/run` | 立即做一份全庫備份，寫入 R2 `manual/` |
| `GET /api/data/backup/download?key=...` | 串流下載指定備份 |

全部端點限**管理員**（`jwtAuth` + `requireRole('admin')`），因為備份等同整個資料庫，含個資。

### 運作原理

手動備份不經過 GitHub Actions，由 Worker 自己從 D1 讀資料並寫入 R2：

```
  管理員按鈕 ──► POST /run
                    │
                    ▼
        dumpStatements(db)  非同步產生器，一次一條 SQL
          1. 讀 sqlite_master 取得所有資料表與其 CREATE 語句
          2. 先輸出 PRAGMA defer_foreign_keys=TRUE
          3. 每張表：輸出 CREATE，再以 LIMIT 1000 / OFFSET 分頁讀資料
             並逐列轉成 INSERT 語句
                    │
                    ▼
        putDump()  R2 multipart upload
          累積到 5 MiB 就上傳一個 part，最後 complete；
          發生錯誤則 abort，不留下殘缺物件
```

為什麼用串流加分段：整庫一次放進記憶體可能超過 Worker 的記憶體限制。
R2 multipart 每個 part 至少 5 MiB（最後一個除外），這同時決定了記憶體上限。

### 與自動備份的差異（重要）

| 項目 | 自動備份 | 手動備份 |
|---|---|---|
| 產生者 | `wrangler d1 export` | Worker 內的 `dumpStatements` |
| 壓縮 | gzip | 無 |
| 索引、觸發器、檢視 | 包含 | **不包含**（只匯出 `type='table'` 的資料表） |
| 一致性 | 匯出工具提供的單一匯出 | 每張表分頁讀取，頁與頁之間**沒有交易保護** |
| 儲存位置 | `daily/` 等 | `manual/`，90 天到期 |

兩個後果：
1. 手動備份還原後資料表與資料都在，但**索引需要另外重建**（可由 `src/db/schema.ts` 或遷移產生）。
2. 在寫入頻繁的時間點做手動備份，分頁讀取期間若有新增或刪除，可能出現漏列或重複列。
   適合「操作前先留一份」的用途，不適合當作唯一的災難還原依據。

---

## 6. 保留策略與到期清理

### 祖父-父親-兒子 (GFS) 分層

| 層級 | 前綴 | 保留 | 還原粒度 |
|---|---|---|---|
| 兒子 | `daily/` | 30 天 | 最近一個月內任一天 |
| 父親 | `monthly/` | 365 天 | 一年內任一個月初 |
| 局部快照 | `members/`、`tags/`、`assignments/` | 365 天 | 一年內的設定快照 |
| 手動 | `manual/` | 90 天 | 管理員留的操作前檢查點 |

選 30 天的依據：只要問題在一個月內被發現，就能回到單日；超過一個月，退而使用月度快照。
`daily/` 同時被其他層級覆蓋，所以刪除 30 天前的日備份不會讓長期還原點消失。

### R2 lifecycle 規則（線上現況，2026-10-13 驗證）

```
mcis-backups
  Default Multipart Abort Rule  全部前綴  未完成分段上傳 7 天後中止
  daily-30d                     daily/        30 天後刪除
  monthly-365d                  monthly/     365 天後刪除
  members-365d                  members/     365 天後刪除
  tags-365d                     tags/        365 天後刪除
  assignments-365d              assignments/ 365 天後刪除
  manual-90d                    manual/       90 天後刪除

mcis-files
  Default Multipart Abort Rule  全部前綴  未完成分段上傳 7 天後中止
  （無到期規則，媒體檔永久保留）
```

### 運作原理與注意事項

- 規則按**物件年齡**（自寫入起算）判斷，由 R2 在背景非同步執行，不需要任何程式。
- 規則必須**逐前綴**設定。若設一條覆蓋整個 bucket 的 30 天規則，`monthly/` 也會在 30 天後被刪。
- 新增規則會對**已存在**的物件生效。2026-10-12 新增 `daily-30d` 後，約 12 小時內物件數由 456 降到 373、
  容量由 1.07 GB 降到 443 MB；抽樣確認邊界落在 30 天，`monthly/` 未受影響。
- 到期刪除不可逆。需要保存超過期限的備份，要在到期前自行複製出去，或使用 R2 bucket lock
  （設定保留期內禁止刪除與覆寫；上線前請先閱讀官方文件的限制與費用）。

---

## 7. 還原原理

詳細指令見 [`BACKUP_AND_RESTORE.md`](./BACKUP_AND_RESTORE.md)，這裡說明原理與要注意的點。

### 基本流程

```
  選備份 ──► 從 R2 取回 ──► (gunzip) ──► 若 DB 已不存在：d1 create + 改 wrangler.toml
                                                    │
                                                    ▼
                                   d1 execute --file 匯入 ──► 驗證登入 / 對話 / 團隊 / 標籤
```

### 為什麼還原可行

備份是完整 SQL（含 `CREATE TABLE` 與 `INSERT`），對一個空的 D1 執行即可重現結構與資料，
不依賴任何其他檔案或遷移紀錄。

### 還原時需要注意

| 項目 | 說明 |
|---|---|
| 格式 | `.sql.gz` 需先 `gunzip`；`manual/` 與 2026-10-12 之前的物件是純 `.sql` |
| 新資料庫 ID | 新建的 D1 會有新的 `database_id`，要改 `wrangler.toml` 並重新部署 Worker |
| 局部還原 | 只還原 `members`、`tags` 或 `assignments` 時，匯入對應的局部備份即可 |
| 不在備份內的東西 | KV 內的 LINE 憑證、Worker secrets 需另外還原或重新設定 |
| 媒體連結 | 檔案索引在 D1 內，隨備份還原；實際檔案在 R2 `mcis-files`，兩者要同時存在才能顯示 |
| 約束與索引 | 生產庫在 2026-06-17 重建時遺失了多數索引與全部 CHECK 約束；備份是「當下實際狀態」，不會自動補回這些，需另以 `bun run check:migrations` 檢查 |

### 尚未驗證的部分

目前**沒有定期還原演練**。備份能否在新環境順利匯入，目前只有 2026-06-17 當天重建那一次的實際經驗。
建議納入第 12 節的路線圖。

---

## 8. 安全性與資料機密

### 備份內容是什麼等級

全庫備份包含客戶對話內容、顯示名稱、員工帳號與 bcrypt 密碼雜湊。
依 2026-10-12 對資料庫的欄位掃描（對象為本機鏡像，同步日 2026-09-09，只看型態不看值）：

- 沒有明文的第三方憑證或 token：`channel_integrations` 表為空，`system_settings` 只有開關與名稱。
- 敏感資料集中在客戶個資與員工密碼雜湊。

### 存取控制

| 位置 | 控制 |
|---|---|
| R2 `mcis-backups` | 私有 bucket；後台存取限管理員（`requireRole('admin')`） |
| GitHub secrets | 僅 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` |
| 本機 `backups/` | `.gitignore` 排除，內含個資，需自行管理 |

### 為什麼不使用 GitHub artifact

本 repo 是 **public**。公開 repo 的 workflow artifact 可被任何 GitHub 使用者下載。
備份 artifact 曾於 2026-07 至 2026-10 之間公開存在，含完整客戶資料。已於 2026-10-12：

- 刪除全部 89 份既有備份 artifact。
- 從 `backup.yml` 移除 `actions/upload-artifact` 步驟，並在檔內加註警告。

規則：**備份檔不得上傳為公開 repo 的 artifact，也不得提交進 git。**
若日後需要在 GitHub 側保留副本，必須先以公鑰加密（如 `age`），私鑰離線保管。

---

## 9. 已知缺口與風險

| # | 缺口 | 影響 | 嚴重度 |
|---|---|---|---|
| 1 | 沒有離線或外部副本 | Cloudflare 帳號層級事件（如 6/17 的帳號端操作）會讓 D1、`mcis-backups`、`mcis-files` 一併消失 | 高 |
| 2 | `mcis-files` 媒體無備份 | 誤刪或損毀後無法還原；D1 備份只有索引 | 高 |
| 3 | 沒有定期還原演練 | 備份損毀或不可匯入要到真正需要時才會發現 | 中 |
| 4 | 備份失敗沒有主動通知 | 只在 GitHub Actions 頁面可見，依賴人工查看 | 中 |
| 5 | 完整性檢查只驗證有 INSERT | 不能保證資料完整、不能證明可還原 | 中 |
| 6 | 手動備份缺索引、非一致快照 | 不應當作唯一災難還原來源 | 低 |
| 7 | KV 憑證與 Worker secrets 不在備份內 | 還原後要重新設定頻道憑證；`JWT_SECRET` 遺失會讓 KV 內加密憑證無法解開 | 中 |
| 8 | 匯出期間對生產 DB 的影響未在本文件驗證 | 目前 DB 小、在低流量時段，尚未觀察到問題；DB 成長後需重新評估 | 低 |

### 關於 Time Travel

D1 內建 Time Travel（時間點還原），適合「誤改資料」的回溯，是獨立於本備份機制的另一層保護。
但它的歷史綁在資料庫上，資料庫被刪就一併消失，因此不能取代外部備份。
其保留天數依方案而異，本文件沒有驗證，使用前請以 Cloudflare 官方文件為準。

---

## 10. 驗證指令

Windows 上的 wrangler 請用 `node node_modules/wrangler/bin/wrangler.js ...`，避免 `.cmd` 轉接層吃掉引號。

```bash
# 近期排程是否成功
gh run list --workflow=backup.yml --limit 7

# R2 規則與容量
node node_modules/wrangler/bin/wrangler.js r2 bucket lifecycle list mcis-backups
node node_modules/wrangler/bin/wrangler.js r2 bucket info mcis-backups
node node_modules/wrangler/bin/wrangler.js r2 bucket info mcis-files

# 確認今天的備份存在且可解壓
node node_modules/wrangler/bin/wrangler.js r2 object get \
  "mcis-backups/daily/mcis-db-$(date -u +%F).sql.gz" --file=./chk.gz --remote
gzip -t ./chk.gz && echo ok

# 確認沒有備份 artifact（應為 0）
gh api --paginate "repos/<owner>/<repo>/actions/artifacts?per_page=100" \
  --jq '.artifacts[]|select(.name|startswith("mcis-db-backup-"))|.name' | wc -l
```

wrangler 沒有「列出物件」的指令，要看某個 key 是否存在只能用 `r2 object get`。
要列舉全部物件需使用 R2 API 或後台 `GET /api/data/backup`（上限 1000 筆）。

---

## 11. 變更歷史

| 日期 | 事件 |
|---|---|
| 2026-06-17 | 生產 D1 被刪除；以 LINE 後台 API 重建資料；建立 `mcis-backups` bucket 與每日備份 workflow（備份存 R2，另有 90 天 GitHub artifact） |
| 2026-06-17 之後 | 新增 `members/`、`tags/`、`assignments/` 局部備份；新增後台手動備份頁（`/data/backup`，寫入 `manual/`） |
| 2026-10-12 | 發現公開 repo 的 artifact 暴露備份資料；刪除 89 份 artifact、移除上傳步驟；備份改為 gzip；套用 6 條 R2 lifecycle 規則（PR #85） |
| 2026-10-13 | 到期清理生效，物件 456 → 373、容量 1.07 GB → 443 MB；本文件建立 |

---

## 12. 後續建議

```
優先序
 P1  離線副本：夜間 rclone 把 mcis-backups 與 mcis-files 複製到帳號外的私有 S3 相容儲存
     - 用 copy 而非 sync，避免來源刪除時連備份一併刪除
     - 媒體要保留 object metadata（重建 D1 時靠 custom_metadata.messageId 對回訊息）
     - 使用唯讀 token，並與備份寫入用的 token 分開
 P2  定期還原演練：每季把最新 daily/ 匯入暫時 D1，檢查筆數、索引與主要頁面
 P3  失敗通知：workflow 失敗時推送（Email / Slack / LINE Notify 類管道）
 P4  強化完整性檢查：比對各主要資料表的筆數與線上差異，不只檢查有無 INSERT
 P5  手動備份補上索引與壓縮，或改為呼叫與自動備份一致的匯出方式
```

P1 與 P2 完成之後，本機制才算同時覆蓋「資料庫被刪」與「帳號層級事件」兩種失敗域。
