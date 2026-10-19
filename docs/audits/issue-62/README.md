# Issue #62 修復稽核

基準：`fbfb9805a093eedda582c33ccb2d1d6f973bd78b`。修復日期：2026-10-13。
依據：[issue #62](https://github.com/erictheng93/Multi-Channel-Integration-System/issues/62)、[審視留言](https://github.com/erictheng93/Multi-Channel-Integration-System/issues/62#issuecomment-6136186924)。
所有變更以 atomic commits 直接推送至 main（`a6f2ba97` 至 `3dea85b8` 已於 2026-10-13 推上 origin/main），未開 PR；未部署、未修改正式資料。其中 `43224121`（單發圖片改存 `image`）與 `3dea85b8`（#61 的 warn log）不屬於 #62，前者部署前須完成真實單發路徑驗證。

## 11 項對照

| Issue 項目 | Commit | 實作與驗證 |
| --- | --- | --- |
| 驗證錯誤顯示 A1 | `a6f2ba97` | base client 保留失敗回應的 data/code；共用 errorResponse 輸出 code；handler 欄位訊息中文化；附件細分錯誤碼與前端中文 map。`frontend/src/api/base.test.ts`、`broadcasts.test.ts` 走真實 base client 的 fetch 回應，後端 `broadcast-main.test.ts` 驗證 code 透傳。 |
| 純圖片對話預覽 A2 | `e94be035` | sender 寫回 `image`，純文字仍為 `text`。`broadcast-sender.test.ts` 驗證原始資料、附件綁定、`getDisplayContent('', 'image') === '[圖片]'`，混合內容保留。瀏覽器證據見下節。 |
| 無障礙 A3 | `02cb8b2b` | picker 的 focus-within shadow 使用既有 `--ring` token；集中 polite status 宣告上傳與提示，alert 宣告錯誤；前後移與移除後恢復焦點。元件測試與 Chromium Tab 實測。 |
| 提示文字被覆蓋 A4 | `02cb8b2b` | 同次選取累積格式／大小及超量兩種提示；元件測試同時斷言兩段文字。 |
| Sender 送出流程測試 B1 | `e94be035` | 真實 async Drizzle/SQLite；R2 原圖／預覽缺失或附件列缺失不 multicast；pending 轉 failed 並 finalize；multicast 收到完整 LINE payload；寫回注入失敗會 log 並完成統計。 |
| Create 附件測試 B2 | `093dd95d` | `broadcast-create.test.ts`：他人上傳拒絕、純圖片／圖文皆為 mixed、附件 INSERT trigger 注入失敗後回滾。實際遷移 FK cascade 清除 recipients／links，保留上傳檔供重試。 |
| 附件驗證測試 B3 | `a6f2ba97` | 原圖缺失、預覽歸屬／已綁訊息／MIME、原圖剛好 10MB／+1 byte、預覽剛好 1MB／+1 byte；同時驗證錯誤碼。 |
| Compose 元件測試 B4 | `02cb8b2b`、`625f6144` | 圖片測試集中在 `frontend/src/components/broadcast/BroadcastComposeCard.test.ts`；另一份 unit/components 檔保留標籤預覽測試。涵蓋移除、順序／送出 payload、焦點、錯誤阻擋、格式文字及清理競態。 |
| Recipients 輕量存在檢查 C1 | `c3b4e45f` | select id + deletedAt + limit 1，停止每頁 hydrate/sign 圖片 URL。route 測試確認不用 getById；SQLite 測試移除 attachments 表後 exists 仍可執行，missing／soft delete 回 false。 |
| 孤兒附件清理 C2 | `625f6144` | 前端 best-effort：allSettled 等待一對上傳，回收成功伙伴；移除完成／上傳中圖片及卸載後才完成的上傳會清理；刪除失敗不覆蓋原始上傳錯誤。API 與元件測試涵蓋晚完成、兩個方向的一敗一成、刪除失敗。 |
| Preview 資源與尺寸 C3 | `069d5cb5` | bitmap.close 在 finally，context／draw／encode 失敗及成功均覆蓋；極端長寬比至少 1px。 |

## 瀏覽器驗證與界線

使用 Playwright CLI + 本機 Chromium，在既有無 API proxy 的 pixel harness Vite 設定（127.0.0.1:5219）載入真實 `MessageBubble.vue`、其 composables、`ImagePreviewModal.vue` 與 `BroadcastComposeCard.vue`，使用固定 agent 與訊息 fixture。
這驗證的是客服視窗實際使用的元件與渲染分支；**沒有執行登入後的完整客服頁或正式 CustomerMessageDO 端到端流程，也沒有實際 multicast 到 LINE**。Sender 的寫回流程另由 SQLite 測試覆蓋。

- 純圖片與混合訊息的 image attachment 均 `complete === true`、`naturalWidth === 240`；混合文字「群發文字不可消失」仍存在。
- 點「檢視大圖」開啟真實 modal，點 `+` 後顯示 120%。[放大截圖](zoom.png)。
- modal「下载」產生 `broadcast.png`，Playwright 回報下載完成。
- 由訊息內容 textarea 按 Tab 到「加入圖片」，snapshot 顯示 file input active；computed box-shadow 為 `rgba(37, 99, 235, 0.3) 0px 0px 0px 3px`。[訊息與焦點截圖](messages-focus.png)。
- Console 唯一 error 是 harness 沒有 favicon 的 404，沒有元件例外。

保留 [browser fixture](browser-fixture.txt)、[HTML entry](browser-index.txt)、[verification function](browser-verification.txt)。重現時將它們分別複製為 `frontend/output/playwright/main.ts`、`index.html`、`verify.js`；在 frontend 執行 `bunx vite --config tests/visual-regression/pixel/vite.harness.config.ts`，再開啟 `/output/playwright/index.html`。這些暫存腳本應在驗證後移出 frontend，以免納入 production lint 掃描。

## 資料與範圍決策

- 既有 `message_type='file'` 的群發歷史不回填；本次只修正往後寫入。舊訊息的列表預覽可能仍為「[檔案]」。
- 不新增 cron 或後端孤兒檔清理；未另開 GitHub issue。前端清理無法保證處理瀏覽器關閉、網路中斷或伺服器已存檔但客戶端未取得 id 的情形，後端統一回收需另案處理。
- 已被訊息／其他群發引用的檔案仍由既有後端引用與 FK 規則保護；不變更 deleteFile 或同圖多群發的合法使用規則。
- 沒有 migration、env、Wrangler configuration 或 DO alarm 變更。
- base 失敗回應保留 data 的呼叫端檢查：未找到以 `response.data === undefined/null` 判斷失敗的呼叫端；既有成功／失敗 guard 與完整 API/store 測試通過。原本無 data/code 的失敗回應不新增這兩個 key。

## 檢查紀錄

- 後端 `bun run test:backend:ci`：188 files、2,862 tests 通過。
- 前端 `bun run test:run`：230 files、4,288 tests 通過、4 skipped。
- 最終 broadcast + migration 定向測試：9 files、65 tests 通過。
- `bun run validate:all`、`bun run build`（後端）通過。
- `lint:scoped-btn`、`lint:breakpoints` 通過；每個 commit 的 pre-commit 七項檢查均通過。
- 最終 `bun run check`：10 checks 通過、0 failed、0 errors（包含 backend tsc、frontend vue-tsc、ESLint、production lint、encoding 與 scoped button guard）。
- 前端 `bun run build`：vue-tsc 與 Vite production build 通過。

最初 health check 因 Vue 格式 warnings 失敗，已以 scoped ESLint 修正；後續一次因臨時 browser verification JS 的 lint 失敗，驗證產物已保存並移出 frontend，最終重跑結果以上述最後結果為準。

## Codebase graph

本機對應 repository 的現有索引是 `D-Code-Multi_Channel_Integration_System`，狀態 ready；AGENTS.md 指定的 `Users-eric-Documents-Code-Multi-Channel-Integration-System` 不存在於本機列表，因此使用對應此工作目錄的索引。先用 graph search/snippet/trace 理解目標，再做修改；commit 前皆呼叫 MCP detect_changes。共用 errorResponse 影響範圍較廣，因此執行完整 backend/frontend suites。

`bash scripts/check-codebase-memory.sh` 的 5 項失敗來自硬編碼 `/Users/eric/.local/bin/codebase-memory-mcp`，本 Windows 環境沒有該 binary；**MCP transport 可用，不需要使用 CLI fallback**。Coverage 對新 sender test 的 mock import 型別標記了 parse_partial，已直接讀取 source 並由 Vitest 驗證；graph coverage 為 best-effort，沒有將它視為完整性證明。
