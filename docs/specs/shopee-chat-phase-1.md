# 蝦皮聊聊接入 MCIS（Phase 1）

目標：比照 LINE OA Webhook，讓客服在 MCIS 內收到蝦皮消費者訊息。Phase 1 只做授權與收訊，並為出站回覆預留介面。發訊要等 Chat API 申請通過後再接（見第 3 節）。

## 1. 呼叫與環境查核（2026-11-26）

| 問題 | 查核結果 |
| --- | --- |
| MCIS 曾呼叫 Shopee 嗎？ | **沒有。** `src/`、`shared/`、`frontend/src/`、`scripts/`、`wrangler.toml` 與 Git 歷史都沒有任何 Shopee 程式碼或提交，shell 歷史也沒有相關指令。正式 D1（唯讀查詢）：`channel_integrations` 為空，`customers` 只有 `line`（661 筆），`platform_message_id` 含 `shopee` 的訊息有 0 筆。Shopee 端的情況見第 2 節。 |
| 有已部署的測試 Worker 嗎？ | 沒有 dev/staging（部署政策只有正式環境）。正式 Worker `mcis-worker` 最近一次部署為 2026-11-10，對外網址是 `https://mcis-backend.daiwandist.com`。`POST /api/webhook/shopee` 目前回 404，符合「尚未實作」。不要把未完成的路由部署上去測試。 |
| 本機有可以交給 Console 的 HTTPS URL 嗎？ | 已安裝 `cloudflared`，但查核時沒有運行中的 tunnel，8787 埠也沒有服務。專案指南中的 ngrok 網址只是範例。 |

**測試決策：** 先完成本機單元與整合測試，再用短期 `cloudflared` tunnel 接 Console 的 Push Test Data。不要把未完成的路由部署到正式 Worker 來測試。

## 2. Shopee Console 現況（App 252641，2026-11-26 查看）

| 項目 | 現況 | 對 Phase 1 的影響 |
| --- | --- | --- |
| App | 名稱 MCIS，類別 Seller In House System，狀態 Developing，Test Partner ID `1255141`。同帳號另有一個 App「Daiwanabrasives SIHS」（240724），同樣是 Developing。 | 開發期只能使用 Test Partner ID 與 Sandbox 主機。 |
| Test Redirect URL Domain | 未設定（`-`）。 | 不會擋住 OAuth：官方說明未設定時不驗證 redirect_uri 的網域。但官方要求所有 App 都要設定 Test 與 Live 兩個網域，設定之後 redirect_uri 必須相符。建議設成正式網域，tunnel 只用來收 Push。 |
| 授權連結 | Seller In House System 類型的 App 可在 App List 按「Authorize」並填入 Redirect URL，由 Console 產生授權連結。 | Phase 1 不必自己產生授權連結，只需實作回跳與換證。 |
| 開發者帳號 | 類型 Registered Business Seller，地區台灣，Identity Verification status 為 Unverified。 | 符合 Chat API「必須是 Shopee Seller、不能是第三方平台」的條件。身分驗證未完成是否影響申請，官方 FAQ 沒有提到，要在工單裡一併確認。 |
| Live Push | OFF，近 6 小時推送數為 `-`。 | 沒有任何正式推送打過來。 |
| Test Call Back URL | 空白。按鈕是「Verify and Save」，清單中每一列 Push Test Data 都顯示「Please verify the Test Call Back URL first」。 | **必須先通過網址驗證，才能送測試資料。** 所以 webhook 路由要先能正確回應 Console 的驗證請求，才能做驗收第 5 步。 |
| Test Push Partner Key | 已產生（不記錄於文件）。 | 這就是 pushPartnerKey，存入渠道的加密 credentials，不要寫進程式碼、`.dev.vars` 範本或測試 fixture。官方指南的範例只寫「partner key」；以 Console 的 Push Partner Key 為準，若 Verify 時驗簽失敗，再改用 App 的 Partner Key 比對。 |
| 可訂閱的推送 | `webchat_push`（Code 10）、`shop_authorization_push`（1）、`shop_authorization_canceled_push`（2），以及訂單、商品、行銷、退貨等類別。 | Phase 1 處理 Code 10。另外處理 Code 2（商店取消授權）與 Code 12（授權將在 7 天後到期）：把渠道標記為需要重新授權或即將到期，否則 Token 失效後客服看不出原因。其他推送碼回 200、空 body 後忽略。 |
| API Access Log | 預設篩選（未選 Partner ID、最近 2 小時）下查無資料。 | **不足以證明從未呼叫過。** 若要確認，需選 Partner ID `1255141` 並把時間範圍拉長後再查一次。 |

## 3. Chat API（客服回覆）的取得路徑

來源：官方 FAQ 574「Conditions of using the Chat API」，**只適用台灣市場**。目前 Chat API 的文件對本帳號不可見，所以發訊 API 的名稱與參數都要等開通後才能確認。

### 使用規範（會影響 MCIS 的功能設計）

| 官方規範 | MCIS 的對應要求 |
| --- | --- |
| 禁止主動訂單通知、促銷群發與 chatbot 回覆。 | Shopee 對話**不可**觸發自動回覆與群發。現況：自動回覆只由 LINE 處理器呼叫（`line-message-handler.ts`、`line-follow-handler.ts`），群發只篩選 `platform === 'line'`（`broadcast-service.ts:40`）。Shopee 處理器不得呼叫 `auto-reply-engine`，並用測試鎖住這兩點。 |
| 不可把自動訊息偽裝成人工訊息，反之亦然。 | 只送客服親手輸入的訊息。延遲發送（收回視窗）仍是客服撰寫的訊息，可以使用；排程或範本自動送出不可以。 |
| 即時訊息要用 Push Mechanism（Webhook）。 | 就是 Phase 1 的 `webchat_push`，不要輪詢。 |
| 聊天資料只能用於回覆買家。 | Shopee 對話內容不得進入分析報表、匯出或 AI 摘要等用途。Phase 1 已把報表維度排除，日後新增功能時要先檢查這一條。 |
| 遵守 Shopee 資料保護政策。 | 沿用現有加密與存取控制；買家資料不寫進 log。 |

### 申請條件與目前狀態

| 條件 | 目前狀態 |
| --- | --- |
| 開發者帳號必須是 Shopee Seller（第三方平台不能申請） | ✅ Registered Business Seller |
| 要開通的商店必須是 Mall Seller（商城） | ✅ 使用者確認為商城（2026-11-26）。Sandbox 商店 `228029969` 不算 |
| App 在過去 30 天內有對該商店的 API 呼叫紀錄 | ❌ 沒有。必須先讓正式商店授權給 App，並成功呼叫過至少一次商店級 API |
| 不出貨率 < 3%、延遲出貨率 < 3%、平均備貨時間 < 2 天（皆為近 30 天） | ❓ 請到賣家中心確認 |

不符合條件或失去商城資格時，Shopee 可以收回權限。申請多家商店時，只有通過的商店會開通，沒通過的不另行通知。

### 申請流程

1. 使用 Seller In House System 類型的 App（現有的 MCIS 252641 即可），取得**正式商店**授權並呼叫 API。
2. 在 Console 的 Raise Ticket 選「Feature APIs > Chat」，說明用途（客服人員在 MCIS 內人工回覆買家），附上商店 ID（多家用英文逗號分隔）。
3. Shopee 在 5–7 個工作天內審核資格。
4. 通過後會寄出確認表單，填寫並送出。未通過也會收到通知信。
5. 再過 2–3 個工作天開通 Chat API 文件與該商店的使用權限。
6. 登入 Console 後依 Chat API Developer Guide 與 API Reference 開發。

日後新增商店要再開一張工單。

### 對 Phase 1 順序的影響

第 1 步需要 App 能呼叫**正式商店**。官方 App management 指南說明 Developing 狀態的 App「不能被正式商店授權，也不能呼叫正式環境 API」，Go-Live 審核約 24 小時且無法加速。送出申請前要完成：

1. **Go-Live。** 表單必填：Brief Introduction（500 字內）、客戶端介面截圖（png/jpg，最多 3 張）。選填：產品網址與測試帳密、Test／Live Redirect URL Domain、是否需要買家 PII。建議：兩個網域都填 `mcis-backend.daiwandist.com`；買家 PII 保持關閉，客服回覆不需要姓名、電話與地址，關閉後 API 回傳的這些欄位會遮蔽，符合資料最小化。通過後取得 Live Partner ID 與 Live Key。
2. **授權並呼叫一次 API。** 不必等 Phase 1 部署：從 Console 的「Authorize」產生正式授權連結，redirect_uri 指向上述網域即可。賣家授權後，瀏覽器網址列會帶著 `code` 與 `shop_id`（後端路由尚未實作會顯示 404，不影響取值）。10 分鐘內用本機一次性腳本 `scripts/shopee/shopee-auth-probe.ts`（`token <code> <shop_id>`，接著 `shop-info`）換取 Token 並呼叫 `get_shop_info`。Partner ID／Key 由環境變數 `SHOPEE_ENV`、`SHOPEE_PARTNER_ID`、`SHOPEE_PARTNER_KEY` 提供；Token 寫到 `~/.mcis/shopee-tokens.<env>.json`（權限 600），不進 repo。
3. 在 API Access Log 選 Live Partner ID，確認有該商店的呼叫紀錄，然後開工單。

Chat API 的審核與開通約需 7–10 個工作天，加上 Go-Live 約 1 天，可以和 Phase 1 的收訊開發並行。**整條路徑的前置條件是正式商店具備商城資格。** 如果不是商城，就拿不到發訊權限，MCIS 只能收訊。

## 4. 準備度評估：能否像 LINE 一樣接入？

**結論：架構可以承接收訊，但還不能直接接上。** 收訊鏈路可以直接沿用。多商店憑證、Token 生命週期與 ID 命名需要新做。

### 可直接沿用（已驗證存在）

| 能力 | 現有實作 |
| --- | --- |
| 快速回應、非同步處理 | LINE Webhook 驗簽後 `sendBatch` 入 `LINE_MESSAGE_QUEUE`，入列失敗時回 500 讓平台重送（`src/modules/integrations/handlers/webhook.ts:120-150`），consumer 在 `src/modules/queue/handlers/line-message-queue.ts`。Shopee 可沿用同一模式與 DLQ。 |
| 平台欄位 | D1 沒有任何 CHECK 約束（`docs/architecture/SCHEMA.md`）。`customers.platform`、`channel_integrations.platform` 都是 TEXT，新增 `shopee` 不需要 migration。 |
| 去重 | `messages.platform_message_id` 有部分 UNIQUE 索引，可防止重送時重複寫入。 |
| 渠道與密鑰保存 | `channel_integrations` 有 JSON `config`/`credentials` 欄位，`channel-credential-service.ts` 提供 AES-256-GCM 加解密。 |
| 未支援平台的發送 | 立即發送遇到非 LINE 平台時已回報失敗：「尚未支援發送到此平台（…）」（`message-delivery-service.ts:376`），不會誤報成功。 |

### 缺口（Phase 1 必須補上）

| 缺口 | 說明與要求 |
| --- | --- |
| 型別是寫死的聯集 | `'line' \| 'facebook'` 散落約 30 處後端型別（如 `shared/types/core.ts:7`、`webhook-signature-service.ts:4`、`webhook-customer-service.ts:17`、`webhook-conversation-service.ts:23`、`delayed-message/types.ts:17`），前端約 29 個檔案寫死 `'facebook'`。只需改收訊與顯示路徑實際用到的型別。分析、報表等其他型別不在 Phase 1。 |
| 憑證依商店查找 | LINE 只使用全域環境變數 `LINE_CHANNEL_SECRET`，`channel_integrations` 在鏡像中沒有任何資料。所以「依 shop_id 找渠道、取該渠道 pushPartnerKey」這條路徑在專案中尚未有人用過，需要新做並測試。 |
| Token 生命週期 | 現在沒有任何平台需要刷新 Token。依官方說明：access_token 4 小時過期，刷新後舊的 access_token 仍可用 5 分鐘；refresh_token 效期 30 天，每家商店分開保存；授權本身的效期由賣家選擇（7、30、90、180、365 天或自訂，最長 365 天），到期後只能請賣家重新授權。refresh_token 每次刷新都會輪替。刷新必須以 `LockCoordinator`（`src/services/distributed-lock-service.ts`）序列化，否則兩個並發刷新會讓其中一份 refresh_token 失效，商店需要重新授權。刷新採按需觸發，不使用 DO alarm 定時續期（違反 CLAUDE.md 的 alarm 規則）。 |
| message_id 全域唯一 | `messages_platform_message_id_unique` 只涵蓋 `platform_message_id`，不含 platform。存入時必須加上前綴，例如 `shopee:<shop_id>:<message_id>`，避免和 LINE ID 撞號。 |
| 一位客戶只有一個對話 | `conversations` 對 `customer_id` 設了 UNIQUE，`customers` 對 `(platform, platform_user_id)` 設了 UNIQUE。同一買家聯絡兩家商店時，訊息會合併進同一個對話，日後回覆也分不出要從哪家商店送出。`platform_user_id` 必須使用 `<shop_id>:<buyer_user_id>`。 |
| 延遲／重試發送 | `retry-handler.ts:171` 對未知平台丟出 `Unsupported platform`，然後重試 3 次再寫入 DLQ。Shopee 必須在第一次失敗時就標記為永久失敗，不做重試。 |
| 禁止自動訊息 | 蝦皮禁止 chatbot 回覆與促銷群發（見第 3 節）。目前自動回覆與群發只會處理 LINE，Shopee 處理器不得呼叫它們，並以測試鎖住。 |
| OAuth 回跳路由 | 授權回跳必須是公開路由，依 CLAUDE.md 的 P1 順序登錄在統一路由之前。`state` 參數需綁定發起授權的渠道並驗證，防止回跳被冒用。 |

## 5. 交付範圍

協定細節依目前盤點整理，待 Sandbox 驗收。Sandbox 測試商店為 `228029969`。

| 路徑 | 實作與驗收條件 |
| --- | --- |
| 渠道與客服畫面 | 在收訊路徑的型別、渠道 API（`shared/api-contracts/channels.ts`）與設定介面加入 `shopee`。設定項目：partnerId、partnerKey、pushPartnerKey、shopId、region、sandbox。密鑰加密存在 `credentials`，讀取設定時只回傳「是否已設定」。客服可依 Shopee 篩選對話，並從徽章辨識渠道。 |
| 商店授權 | 依渠道設定切換 Sandbox 或 Live 主機。以 partnerKey 對 `partner_id + path + timestamp` 做 HMAC-SHA256；商店級請求依端點追加 `access_token + shop_id`。授權連結可由 Console 的「Authorize」產生；回跳時驗證 `state` 與 `shop_id`，code 只能用一次且 10 分鐘內有效。若賣家用主帳號授權，回跳帶的是 `main_account_id`，換證後回傳 `shop_id_list`，每家商店各存一組 Token。兩種 Token 都加密保存，刷新時在鎖內同時寫回新的 refresh_token。驗收需涵蓋：錯店、過期、刷新失敗、需要重新授權（畫面要顯示狀態）。 |
| 消費者進線 | `POST /api/webhook/shopee`：解析 shop_id 找到渠道，用該渠道的 pushPartnerKey 對「Console 登記的完整公開 URL + `\|` + 原始 body」做 HMAC-SHA256，以常數時間比對 Authorization 的小寫 hex。驗簽成功且事件已入列後，於 2 秒內回 HTTP 200、空 body。入列失敗回 5xx 讓蝦皮重送。驗簽失敗沿用 `recordWebhookSignatureFailure`。按下 Console 的「Verify」時，蝦皮也會對此網址送一次 POST，必須回 2xx、空 body 才會通過。蝦皮會依成功率處理：6 小時內超過 600 次推送且成功率低於 70% 時寄警告信，低於 30% 時停用推送，停用期間的推送不會補送。所以除了「入列失敗」以外，一律不要回非 2xx。 |
| 非同步寫入 | 處理 Code 10、`data.type === 'message'` 的消費者訊息。依實際 payload 對應 text、image、video、item（商品卡）；未知類型存成文字摘要，不能丟棄。以前綴後的 message_id 去重，重送或並發時只寫入一則。沿用客戶、對話、訊息與 WebSocket 廣播流程，首次建立對話時發出通知。 |
| 客服回覆（預留） | Chat API 權限待申請（第 3 節），開通前看不到文件，Sandbox V2 也沒有可驗證的送出流程。立即發送、延遲發送與重試一律回報「尚未開通 Shopee Chat API 發訊權限」，畫面顯示失敗，且不重試。開通後依官方 API Reference 接上傳送文字與圖片的端點，名稱以文件為準。 |

**不在 Phase 1：** 訂單／物流事件、商品同步、自動回覆、分析報表的 Shopee 維度、多語系商店名稱。

## 5a. 實作狀態（分支 `feat/shopee-chat-phase1`，2026-11-26，尚未提交、尚未部署）

**與上方規格不同的決定：** MCIS 只有一個自有 App，所以 App 層級的密鑰改用 Worker 環境變數，不再逐渠道保存。`channel_integrations` 只存每家商店的 config（shopId、env、shopName、authStatus…）與加密的 Token。

| 環境變數 | 用途 |
| --- | --- |
| `SHOPEE_ENV` | `sandbox` 或 `live`，決定 API 主機與授權網址 |
| `SHOPEE_PARTNER_ID` / `SHOPEE_PARTNER_KEY` | 呼叫 Open API 的簽章 |
| `SHOPEE_PUSH_PARTNER_KEY` | 驗證 Push 的 Authorization |
| `SHOPEE_PUSH_CALLBACK_URL` | Console 登記的完整 Callback URL，是簽章基底的一部分；tunnel 測試時設成 tunnel 網址 |

| 路徑 | 實作位置 |
| --- | --- |
| 收訊 | `POST /api/webhook/shopee`（`webhook.ts`）→ `LINE_MESSAGE_QUEUE`（`shopee_webhook_event`）→ `shopee-event-processor.ts` |
| 授權 | `GET /api/integrations/shopee/authorize-url`（管理員）、`GET /api/integrations/shopee/oauth/callback`（公開）→ `shopee-oauth.ts` |
| Token | `shopee-token-service.ts`：按需刷新，以 `shopee:token:<shopId>` 分散式鎖序列化 |
| 出站預留 | `message-delivery-service.ts`、`delayed-message/retry-handler.ts`：固定錯誤、不重試 |
| 前端 | 渠道頁「連結蝦皮商店」與授權狀態、對話篩選與徽章、失敗原因顯示、Shopee 對話的回覆限制提示 |

**待實測才能確認的假設：**
1. Code 10 聊聊訊息的欄位（`message_id`、`from_id`、`message_type`、`content.*`）是推測的；缺少必要欄位時會重試後進入 DLQ，保留原始內容。
2. ~~Console「Verify and Save」的請求若沒有簽章，會被回 401 而驗證失敗。~~ 已確認有簽章並通過（2026-11-27）。
3. 授權連結不含 sign；Token 失效時的錯誤代碼也是依文件推測。
4. 未授權給 MCIS 的商店，推送會被略過。所以 Push Test Data 要走完一輪，該商店必須先透過 MCIS 的授權流程（不是本機腳本）完成授權。
5. 授權回跳網址是正式後端網域。本機測試 MCIS 授權流程時，要暫時把 Console 的 Test Redirect URL Domain 改成 tunnel 網域，或等部署後再測。

## 6. 驗收步驟（從本機到 Console）

1. **單元測試。** 用測試金鑰與去識別化 payload 固定簽章測例，涵蓋：正確簽章、錯誤金鑰、body 多一個空白、公開 URL 不同、未知 shop_id、重複 message_id、同一買家聯絡兩家商店。Token 測例涵蓋：並發刷新只呼叫一次、刷新失敗後標示需要重新授權。延遲發送測例：Shopee 首次失敗即進入永久失敗，重試次數為 0。
2. **前端測試。** 同一組資料驗證列表、篩選、徽章與發送失敗提示，axe-core 0 違規。
3. **本機整合。** 用隔離測試資料與本機 bindings 執行 `bun run dev:local`（預設的 `bun run dev` 連正式資源，不要用）。確認接收、入列、consumer 寫入可以在本機跑完一輪。
4. **接 Console。** 執行 `cloudflared tunnel --url http://127.0.0.1:8787`，把它印出的 HTTPS 網址加上 `/api/webhook/shopee`，同時填入 Console 的 Test Call Back URL 與驗簽用的公開 URL，按「Verify and Save」。驗證通過後，Push Test Data 按鈕才會啟用。驗證請求的實際格式要以這一步的 Worker 紀錄為準（遮蔽簽章後補進第 7 節）。tunnel 重開後兩處都要更新。
5. **Push Test Data。** 在 Console（App 252641）的 Push Mechanism 送出測試資料。記錄時間、商店、事件識別碼、HTTP 狀態、空 body 與耗時（必須 < 2 秒），再對照 Worker 入列、D1 訊息與客服畫面。重送一次後，確認仍然只有一則訊息。測完關閉 tunnel，並把 Console 的 URL 改回正式網址或清空。
6. **授權。** 在 App 的 Edit 設定 Test Redirect URL Domain（建議），再從 App List 按「Authorize」產生連結，用 Sandbox 商店 `228029969` 跑完整 OAuth。確認 Token 加密存入、手動觸發一次刷新，並確認刷新後 5 分鐘內新舊 access_token 都可用。
7. **Chat API 申請前置。** App Go-Live 後，用正式商城授權並呼叫一次商店級 API，在 API Access Log 確認有紀錄，再依第 3 節開工單。

## 7. 驗收紀錄

| 日期 | 項目 | 結果 | 請求識別碼（已遮蔽憑證） |
| --- | --- | --- | --- |
| 2026-11-27 | Sandbox 換證與商店級 API（本機腳本，商店 `228029969`） | ✅ `token/get` 與 `shop/get_shop_info` 皆 HTTP 200、無 error；商店 region TW、status NORMAL。確認簽章與 Sandbox 主機正確 | `e3e3e7f3613ceb501bfdbd624e4ef200`、`e3e3e7f3613ceb5385417424bb625100` |
| — | OAuth（MCIS 授權流程） | 待執行 | — |
| 2026-11-27 | Console Verify and Save（tunnel → 本機 Worker） | ✅ 通過。驗證請求**有簽章**，body 為 `{"code":0,"data":{"verify_info":"This is a Verification message.Please respond in the certain format."}}`；回 200 空 body 即通過 | — |
| 2026-11-27 | 路由與簽章（自行打 tunnel） | ✅ 未簽章 → 401；正確簽章 → 200、0 bytes；路由為公開 | — |
| 2026-11-27 | webchat_push Test Data | ✅ 200 空 body、入列、處理器略過。**測試資料不是買家訊息**：`data.type = "notification"`（`mark_as_replied`），`data.content` 含 `user_id`、`conversation_id`、`type`、`timestamp`、`msg_id`、`from_id`；shop_id 為虛構的 399917162、region ID。兩份樣本已加入處理器測試 | — |
| — | 真實買家訊息（`data.type = "message"`）解析 | 待執行：Console 無法產生，需正式商城上線後由真實聊聊觸發，或請蝦皮提供樣本 | — |
| — | 客服回覆（預留失敗訊息） | 待執行 | — |
| 2026-11-26 | Go-Live 申請 | 已送出，審核中（24 小時內寄信通知） | — |
| — | 正式商城授權 + 商店級 API 呼叫 | 待 Go-Live 通過；授權效期選 365 天（最長），到期前 7 天會收到 Code 12 推送 | — |
| — | Chat API 工單 | 待送出 | — |

## 參考文件

- [Chat API 使用條件與申請（FAQ 574，台灣）](https://open.shopee.com/faq/574)
- [Push Mechanism notifications](https://open.shopee.com/developer-guide/18)
- [Authorization and Authentication](https://open.shopee.com/developer-guide/20)
- [Developer Guide 簡介](https://open.shopee.com/developer-guide/4)
