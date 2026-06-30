# WebSocket Hibernation 遷移指導文件

> 狀態:**已完成,待部署驗證**(2026-06-30)。三個 DO(CustomerConversationDO / UserConnection / ConversationRoom)、前端心跳、單元測試皆已落地;三大陷阱 A(auto-response 不喚醒)、B(單一 alarm 多工取代 setTimeout)、C(getWebSockets 重建)均處理完成。`tsc --noEmit` 乾淨、`tests/unit/durable-objects/` 35 tests 全過。剩餘僅 Dashboard 上 GB·s 趨勢的線上成效驗證(第 6 節)。本文件是遷移的唯一指導來源(single source of truth)。

## 0. 為什麼要做(帳單依據)

2026-05-07 ~ 06-06 Cloudflare 帳單 `IN-67467570`,$25.00 USD 全部來自**單一**項目:

| 項目 | 用量 | 費用 | 說明 |
|---|---|---|---|
| Durable Objects **Compute Duration** | 1,358,830 GB·s | **$25.00** | DO 被連線釘在記憶體的時間 |
| DO **Compute Requests** | 0 | $0.00 | 在 1M 免費額度內 |
| Workers / D1 / KV / R2 / DO Storage / 其餘所有項目 | — | $0.00 | 全在免費額度內 |

**判讀**:成本不是訊息量造成的(Requests=0),而是 WebSocket 長連線讓 DO 無法被逐出記憶體、duration 時鐘一直在跑。這是 hibernation 唯一要解決的問題,且這條費用會隨連線數線性成長。**遷移 ROI 極高,且是目前帳單上唯一值得優化的項目。**

## 1. Hibernation 模型(它改了什麼)

| | 現況 `server.accept()` | 目標 `ctx.acceptWebSocket()` |
|---|---|---|
| 閒置時 DO | 常駐記憶體,**duration 一直計費** | 可被逐出記憶體,**閒置不計 duration** |
| 訊息處理 | `ws.addEventListener('message', …)` | DO class method `webSocketMessage(ws, msg)` |
| 關閉/錯誤 | `addEventListener('close'/'error')` | class method `webSocketClose(...)` / `webSocketError(...)` |
| 連線清單 | 記憶體 `Map` | `ctx.getWebSockets()`(逐出後仍可取回 socket) |
| 每連線狀態 | `Map` 裡的物件 | `ws.serializeAttachment(obj)` / `ws.deserializeAttachment()` |
| 計時器 | `setTimeout` / `setInterval` | **失效**(逐出即消失)→ 改用 `ctx.storage.setAlarm()` |
| 心跳 | app-level ping 訊息 → 喚醒 DO | `ctx.setWebSocketAutoResponse()`,**不喚醒 DO** |

四個核心 API:`<state>.acceptWebSocket(server[, tags])`、`webSocketMessage/Close/Error` handlers、`<state>.getWebSockets([tag])`、`ws.serializeAttachment/deserializeAttachment`。

### ⚠️ 三個 DO 的「state handle」名稱不一樣——照抄會錯

hibernation API(`acceptWebSocket` / `getWebSockets` / `setWebSocketAutoResponse` / `setAlarm`)都掛在 `DurableObjectState` 上,但三個 DO 取得它的路徑各不相同,**絕對不能統一寫成 `this.ctx`**:

| DO | base class | `DurableObjectState` 取得方式 | hibernation 呼叫寫法 |
|---|---|---|---|
| `CustomerConversationDO` | `extends DurableObject<Bindings>` | `this.ctx`(base class 提供) | `this.ctx.acceptWebSocket(server, ...)` |
| `UserConnection` | `implements DurableObject` | `this.state`(constructor `:54` 存的) | `this.state.acceptWebSocket(server, ...)` |
| `ConversationRoom` | `implements DurableObject` | **`this.roomContext.state`** — 注意 `this.ctx` 在 services 裡是 **RoomContext**(`room-sharding-handler.ts:31`),不是 DO state;DO state 在 `roomContext.state`(`:124`) | `this.roomContext.state.acceptWebSocket(server, ...)` |

下文各節的 `acceptWebSocket` / `getWebSockets` / `setAlarm` 一律按本表替換成該 DO 的正確 handle。

## 2. 三個致命陷阱(沒處理 = 白做)

### 陷阱 A:心跳會喚醒 DO,直接抵銷所有節省 ⚠️ 最重要

現況前端每 15~30s 送一個 **app-level JSON ping**:
```
frontend/src/services/websocketClient.ts:615
this.send({ type: 'ping', timestamp: Date.now() })
```
伺服器在訊息 handler 內回 `{ type: 'pong', timestamp }`(見 `room-connection-manager.ts:80`、`UserConnection.ts:264`)。

**問題**:hibernation 下,任何進到 `webSocketMessage` 的訊息都會把 DO 喚回記憶體。每 15~30s 喚醒一次 → DO 幾乎永遠不會被逐出 → **duration 幾乎不會降,等於沒做**。

**解法**:用 `ctx.setWebSocketAutoResponse()`。它在 runtime 層比對「固定字串」並自動回覆,**完全不喚醒 DO**。但它只支援**完全相等的固定字串**,現在 ping 帶 `timestamp` 會變動,無法比對。

→ **必須同時改前端**:ping 改成不帶 timestamp 的固定字串。建議:
- 前端送固定字串 `ping`(或固定 JSON `{"type":"ping"}`,二選一,全專案統一)。
- DO constructor 註冊:
  ```ts
  this.ctx.setWebSocketAutoResponse(
    new WebSocketRequestResponsePair('ping', 'pong')
  );
  ```
- 前端心跳逾時邏輯(`websocketClient.ts:620` 的 `heartbeatTimeoutTimer`)要能接受固定的 `pong` 回覆。`lastHeartbeat` 仍由收到 pong 時更新——但注意 auto-response 的 pong 是 runtime 直接回的,client 端照常收得到,邏輯不需大改,只要比對字串改掉即可。

> **驗收條件**:改完後用 `wrangler tail` 觀察,心跳期間 DO **不應**出現 log(沒被喚醒)。若每次心跳都有 log,代表 auto-response 沒生效,節省會歸零。

### 陷阱 B:`setTimeout` / `setInterval` 全部失效 → 改 Alarm

逐出記憶體時所有 JS timer 一併消失。需處理的點:

1. **JWT 到期自動斷線(F14)** — `ConversationRoom.ts:273`、`UserConnection.ts:183`
   現用 `setTimeout(() => server.close(4401), ttlMs)`。hibernation 下不可靠。
   → 改:把 `tokenExp` 存進該連線的 `serializeAttachment`;設一個 `ctx.storage.setAlarm(最早到期時間)`;`alarm()` 觸發時遍歷 `getWebSockets()`,關閉所有 `tokenExp <= now` 的連線,並重設下一個 alarm 為剩餘連線中的最早到期。
   > 這是安全機制(防止偷到 token 後無限續用),**不可省略**。

2. **Storage 寫入 debounce** — `ConversationRoom` `writeDebounceTimer` / `STORAGE_WRITE_DEBOUNCE_MS`(`room-storage-service.ts`)
   `setTimeout` 式 debounce 在逐出後不會 fire,資料可能不落地。
   → 改:用 alarm 當 flush 觸發,或在每次 `webSocketMessage` 處理後同步寫(量小可接受),或在 close handler 強制 flush。

3. **Inactivity cleanup / `setupCleanupTasks`** — `ConversationRoom.ts:141`、`UserConnection` constructor `setupPeriodicTasks()`(`:62`)
   多半是 `setInterval`。hibernation 後「閒置連線不再花錢」,這個清理的**經濟動機消失**;但若仍要剔除殭屍連線,改用週期性 alarm,不要用 setInterval。
   > 注意:auto-response(陷阱 A)讓心跳不進 `webSocketMessage`,所以伺服器端的 `lastActivity` / `updateActivity` 不會再被心跳更新。任何「依 lastActivity 判定閒置並踢人」的清理邏輯都會誤判活著的閒置連線 → 連同上面一起移除,或改用 WebSocket 實際 close 事件判定,不要靠 lastActivity。

> **⚠️ 一個 DO 只有一個 alarm**:上面 B-1(token 過期)、B-2(storage flush)、B-3(cleanup)若都用 alarm,會互相覆蓋(`setAlarm` 後設的蓋掉先設的)。必須**單一 `alarm()` handler 多工**:每次需要排程時,比較「目前 `getAlarm()` 的時間」與「新需求時間」,只保留**最早**的 deadline;`alarm()` 觸發時把三類到期工作一次全做完,再依剩餘工作重設下一個最早 deadline。專案已有此模式可直接參照:`src/durable-objects/delayed-message/schedule-manager.ts:42`(`setAlarm(earliestTime)`)與 `:219`(`getAlarm()` 比較)。**不要**為三件事分別 `setAlarm`。

### 陷阱 C:記憶體 `Map` 逐出後是空的 → 從 `getWebSockets()` 重建

被逐出再喚醒後,constructor 會重跑,`connections = new Map()` 會是**空的**,但實際 socket 還在 `ctx.getWebSockets()` 裡。

→ 原則:**不要再信任 constructor 建好的 Map 是連線真相**。連線清單一律以 `ctx.getWebSockets()` 為準,每個 socket 的中繼資料用 `ws.deserializeAttachment()` 取回。

兩種落地策略(擇一,建議第 2 種改動小):
1. 完全移除記憶體 Map,所有 `connections.values()` 改成 `getWebSockets().map(deserializeAttachment)`。
2. **Lazy 重建**:保留 Map 介面,但在 handler 入口處,若 Map 為空而 `getWebSockets()` 非空,就用 attachment 重建 Map。改動面最小,適合 `ConversationRoom` 這種有厚 facade 的。

attachment 內容(每連線需序列化的最小集合):
```ts
ws.serializeAttachment({
  connectionId, userId, role, conversationId,
  tokenExp,            // 陷阱 B 的 alarm 用
  connectedAt,
  // 不要塞大物件;attachment 上限 2KB/連線
});
```
> 也可用 `acceptWebSocket(server, [userId, conversationId])` 的 **tags**(每連線最多 10 個、每個 ≤256 字元),之後用 `getWebSockets(tag)` 篩選,省去自己掃 Map。

## 3. 逐 DO 遷移步驟

三個 DO 各自獨立,**逐一遷移、逐一部署驗證**,不要一次全改。

### 3.1 `CustomerConversationDO`(建議第一個做)
最單純:`webSocketMessage` 已是 stub(`:390`),訊息走 HTTP broadcast,沒有 app-level ping 要處理 inbound。
- [ ] state handle = `this.ctx`(base class `extends DurableObject<Bindings>` 已提供,不需自己存)。
- [ ] `clientConnected` + `clientConnectedValidated` 兩處(`:267`、`:339`):
      `server.accept()` → `this.ctx.acceptWebSocket(server, [userId])`。
- [ ] 移除兩處的 `addEventListener('message'/'close'/'error')`(`:284-308`、`:356-380`)。
- [ ] 把 `{ socket, userId, displayName, role, connectedAt }` 改成 `server.serializeAttachment({...})`。
- [ ] 新增 class methods:`webSocketClose` / `webSocketError`——做原本 close/error handler 的事(刪 connection、`broadcastUserPresence(offline)`)。連線清單改從 `getWebSockets()` 推導(陷阱 C)。
- [ ] `connections.size`、`isUserConnected`、`getUniqueUserCount`、`broadcastUserPresence` 等改成走 `getWebSockets()` + `deserializeAttachment()`。
- [ ] 無 setTimeout token 過期邏輯於此?確認後跳過陷阱 B-1(若有 session 驗證的時效需求再補 alarm)。

### 3.2 `UserConnection`
- [ ] state handle = `this.state`(constructor `:54`)。所有 hibernation 呼叫一律 `this.state.xxx`。
- [ ] `server.accept()`(`:174`)→ `this.state.acceptWebSocket(server, [this.userId])`。
- [ ] `setupWebSocketHandlers`(`:202`)的三個 addEventListener → class methods。`handleWebSocketMessage` 的 dispatch(ping/typing 等,`:264`)搬進 `webSocketMessage`。
- [ ] **ping case(`:264`)移除**,改由 auto-response 處理(陷阱 A)。
- [ ] F14 `setTimeout`(`:183`)→ alarm(陷阱 B-1)。
- [ ] `stateManager` 的記憶體連線狀態 → `getWebSockets()` + attachment(陷阱 C)。`isAtConnectionLimit` 改用 `getWebSockets().length`。

### 3.3 `ConversationRoom`(最複雜,最後做)
facade + 5 個 service,改動面最大。
- [ ] state handle = **`this.roomContext.state`**(不是 `this.ctx`——`ctx` 在此是 RoomContext)。所有 hibernation 呼叫 `this.roomContext.state.xxx`。
- [ ] `server.accept()`(`:262`)→ `this.roomContext.state.acceptWebSocket(server, [userId, conversationId])`。
- [ ] `RoomConnectionManager.setupWebSocketHandlers` → DO class methods,facade 把 `webSocketMessage/Close/Error` 轉發給 connectionManager。
- [ ] **ping case(`room-connection-manager.ts:80`)移除** → auto-response。
- [ ] F14 `setTimeout`(`:273`)→ alarm(陷阱 B-1)。
- [ ] `writeDebounceTimer` debounce(`room-storage-service.ts`)→ alarm flush(陷阱 B-2)。
- [ ] `setupCleanupTasks`(`:141`)→ 移除或改 alarm(陷阱 B-3)。
- [ ] `roomContext.connections` / `participants` Map → lazy 重建 from `getWebSockets()`(陷阱 C,建議用策略 2 保留介面)。
- [ ] `challenges` Map(challenge-response auth)若依賴跨請求存活,逐出後會消失——challenge TTL 只有 30s 且僅用於建線當下,風險低,但需確認 challenge 與後續連線在**同一次喚醒**內完成;若不是,challenge 要落 storage。

## 4. wrangler / 設定

- hibernation 不需改 `wrangler.toml` 綁定;DO class 名稱與 migrations 不變。
- 確認 compatibility date 夠新(hibernation API 早已 GA,現有專案應已滿足;若 build 報 `acceptWebSocket is not a function`,檢查 `@cloudflare/workers-types` 版本與 compatibility date)。

## 5. 測試計畫

每個 DO 改完都要過:
- [ ] **單元**:`getWebSockets()`/attachment mock,驗證逐出→喚醒後連線清單能重建。沿用既有 vitest pattern(注意專案的 `vi.clearAllMocks` 慣例,見記憶體筆記)。
- [ ] **本機**:`bun run dev`(remote 綁定),前端實連,送訊息、斷線重連、多分頁(多連線/同 user)。
- [ ] **心跳不喚醒(關鍵)**:`wrangler tail` 開著,靜置 2 分鐘只有心跳。**DO 不該有任何 log**。有 = 陷阱 A 沒做對。
- [ ] **token 過期**:連線後等到 `tokenExp`,確認 alarm 有觸發 4401 close(陷阱 B-1)。
- [ ] **型別**:後端 `bunx tsc --noEmit`;前端 `bun run type-check`(改了 websocketClient 心跳)。

## 6. 上線與成效驗證

- 逐 DO 部署(`bun run deploy`),不要三個一起上。
- 部署後在 Cloudflare Dashboard → Durable Objects metrics 觀察 **GB·s / duration** 趨勢。
- 預期:閒置連線占多數的客服場景,duration 應下降 **70~95%**(視閒置比例)。對照下一期帳單的 Compute Duration 那一行。
- 若某 DO 改完 duration 沒明顯降 → 幾乎一定是陷阱 A(心跳仍在喚醒),回去查 auto-response。

## 7. Rollback

每個 DO 是獨立 commit + 獨立部署。任一個出問題,`git revert` 該 DO 的 commit 並 redeploy 即可,其餘已遷移的 DO 不受影響。前端 ping 格式改動需與後端 auto-response 配對:**回滾後端時務必同時回滾前端心跳格式**,否則固定字串 ping 會打到舊的 app-level handler(舊 handler 仍認得 `{type:'ping'}` 但不認得純字串 `ping`,會造成心跳逾時斷線)。

---

### 附:實作前必讀
- 官方範例:https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/
- 遷移順序硬性建議:`CustomerConversationDO` → `UserConnection` → `ConversationRoom`(由簡入繁)。
- 每改一個 symbol 前,依專案規定先跑 `gitnexus_impact`,HIGH/CRITICAL 風險先回報。
