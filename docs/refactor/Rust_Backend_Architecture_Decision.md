# Rust 後端架構決策紀錄(ADR)

> **文件類型:** 架構決策紀錄(Architecture Decision Record)
> **姊妹文件:** [`Rust_CRD.md`](./Rust_CRD.md)(clean-room 行為規格,重寫的「做什麼」)。本文件回答的是重寫的「用什麼架構、什麼時候做」。
> **建立日期:** 2026-06-25
> **狀態:** 已決議方向,**尚未啟動**(deferred,非現在)

---

## 1. 背景與現況

現有後端技術棧(Cloudflare 全託管、serverless):

- 運算:Cloudflare Workers(Hono)
- 即時/有狀態協調:**10 個 Durable Objects**(`ConversationRoom`、`UserConnection`、`MessageBroadcaster`、`LockCoordinator`、`RateLimiterDO`、`MetricsCollectorDO` 等)
- 資料庫:D1(SQLite)+ Drizzle ORM
- 快取/儲存/佇列:KV / R2 / Cloudflare Queues
- 前端:Vue 3 + TypeScript,部署於 Cloudflare Pages

目前流量規模小(2026-05~06 Cloudflare 帳單僅 $25/月,且 **100% 來自 Durable Objects Compute Duration**,DO Compute Requests=0)。

## 2. 待決問題

自架(self-hosted / on-prem)是**已承諾的產品路線**(repo 內 `web-installer/` 即為此而生)。問題是:當要脫離 Cloudflare 專有原語、改用 Rust 後端時,目標架構該選什麼;以及現在該不該動。

評估過三個選項:
1. 前端留 Pages + 後端 **Axum + PostgreSQL**
2. 後端 **Axum + Ractor + NATS + PostgreSQL**
3. 不重構,就地優化現有 Cloudflare 棧

## 3. 決議

- **方向:** 當自架真正啟動時,**直接採用 Axum + Ractor + NATS + PostgreSQL**(選項 2)。**不走** Axum + Postgres 的半套(選項 1),因為它漏掉了這個 codebase 最核心的協調層。
- **時機:** **現在不做。** 自架是認真但尚未到時候的路線。近期僅就地優化(見 §7)。

## 4. 決策的關鍵理由:這個 codebase 是「actor 形狀」的

真正綁定 Cloudflare、也最難搬的,**不是** D1/KV/R2/Workers(這些都好換),而是 **Durable Objects 構成的 actor 模型**。DO 免費提供:

- 全域唯一可定址的 **single-writer**(每個 conversation / user 一個 actor,自動放置)
- 每個 ID 的**序列化執行** → 訊息天然有序、強一致
- 交易型本地儲存、alarm、WebSocket hibernation

因為這套程式本來就是「每對話/每用戶一個 actor」的組織方式,所以選項 2 的對映出奇地乾淨——它是 Workers+DO+Queues 的開源等價物:

| 現況(Cloudflare) | 目標(自架) | 角色 |
|---|---|---|
| Durable Object(有狀態 actor) | **Ractor** actor(Erlang/OTP 風格) | 每對話/每用戶一個 actor |
| `MessageBroadcaster` + 跨 DO 廣播 | **NATS** pub/sub | 跨 instance 訊息扇出 |
| Cloudflare Queues | **NATS JetStream** | 佇列/延遲訊息 |
| DO 交易型儲存 | **PostgreSQL** | 持久化狀態 |
| Workers(HTTP/WS 入口) | **Axum**(Tokio) | HTTP + WebSocket 前門 |
| `LockCoordinator`(分散式鎖) | Postgres advisory lock / NATS 協調 | 競態防護 |

**為什麼不選 Axum + Postgres(選項 1):** 它只寫了輕鬆的 60%。Axum + Postgres 無法取代 DO——WebSocket 連線在 Axum 裡綁在單一行程,客戶連 instance A、客服連 instance B 時訊息無法互通,你仍然需要一條訊息匯流排(就是 NATS)+ actor 放置層(就是 Ractor + 分片)。選項 1 等於把這 40% 留給未來自己踩,不如一開始就上完整版。

## 5. 各選項 Pros / Cons

### 選項 2:Axum + Ractor + NATS + PostgreSQL(採用)

**Pros**
- **真正替換 DO 協調層**,架構對映乾淨,貼合既有 actor 形狀的程式組織。
- **PostgreSQL ≫ D1**:真並發、JSONB(現有 channel integration 全是 JSON 欄位,JSONB + partial index 是實質升級)、advisory lock、`LISTEN/NOTIFY`、全文檢索、messages 大表分區、成熟備份/複寫。
- **去 vendor lock-in、可自架/可攜**:直接服務 `web-installer/` 的 on-prem 產品方向——這是整個重構最強、也是唯一站得住的理由。
- **Rust 效能/成本可預測**:不再有 DO duration 那種計費意外。
- 端到端型別安全(Rust strict + TS strict)。

**Cons / 深坑(DO 免費給、Ractor 不給,最容易被低估)**
- **Actor 放置層要自己做。** Ractor actor 活在單一行程內;為了 HA 跑多 instance 時,必須自己保證「一個對話的 actor 只被一個 instance 擁有」(NATS 一致性雜湊,或每分片一個 stateful node)。DO 自動處理放置與 single-writer,這層是最大的隱藏工程量。(`ConversationRoom` 已有 sharding handler——代表碰過這題,但那是 DO 扛著的版本。)
- **狀態持久化要自己做。** Ractor actor 是純記憶體,crash/重啟須從 Postgres rehydrate;要自行實作 event sourcing / snapshot。
- **NATS 本身是一套要運維的分散式系統**(叢集、JetStream 持久化、監控)。
- **運維負擔整體暴增**:從「deploy 一個 Worker」變成要自己跑/擴 Axum、Postgres HA、NATS 叢集、物件儲存。
- **失去邊緣部署**:Workers 跑 300+ PoP;Axum 跑你開的區域。但本系統以台灣為主,單區域(東京/新加坡)足夠,此 con 偏輕。
- 團隊現況是 TS/Vue/Cloudflare;Rust + async + actor(Ractor)學習曲線陡。

### 選項 1:Axum + PostgreSQL(否決)

作為「通用後端」是黃金組合,但對 realtime、actor 形狀的本專案**不完整**——少了協調層(NATS)與 actor 放置(Ractor),WebSocket 跨 instance、分散式鎖、每對話排序都得另外補。最終會被迫長成選項 2,不如一開始就上完整版。

### 選項 3:不重構,就地優化(近期採用,見 §7)

**Pros**:零改寫風險;保留 serverless 與近乎零運維;現況 $25/月。
**Cons**:仍受 Cloudflare 專有原語綁定,無法滿足 on-prem 自架目標。

## 6. 重要澄清:目前的瓶頸不是「架構選錯」

帳單與痛點的根因是可就地解決的,不需要為它們重寫後端:

- **DO duration 計費** → 用 WebSocket **Hibernation** 解(見 [`docs/claude/WEBSOCKET_HIBERNATION_MIGRATION.md`](./claude/WEBSOCKET_HIBERNATION_MIGRATION.md))。它直接消滅唯一的計費項。
- **D1 資料能力不足** → 可用 Cloudflare **Hyperdrive + 外部 PostgreSQL**,把 D1 換成 Postgres、其餘留在 Cloudflare,拿到 80% 好處、僅 20% 風險。

> 為了省 $25/月去做數月的 Rust 改寫,ROI 是負的。重構的唯一正當理由是**自架/可攜**,不是成本、也不是資料庫能力。

## 7. 近期行動(不啟動重構)

1. 做 WebSocket Hibernation 遷移(已有 spec)——解決計費。
2. 視資料需求,評估 Hyperdrive + 外部 Postgres——解決 D1 能力上限。
3. 持續維護 [`Rust_CRD.md`](./Rust_CRD.md) 的行為契約,使其在重寫啟動時即可用。

## 8. 何時啟動選項 2(觸發條件)

當以下成立時,重新評估並啟動遷移:

- 自架/on-prem 從「方向」變成**已承諾、有客戶或合約驅動的交付項**;或
- Cloudflare 專有原語成為自架交付的硬阻塞;或
- 流量/成本規模大到 Cloudflare 託管費用顯著高於自架的「運算 + 運維」總成本(以目前 $25/月,離此甚遠)。

啟動時:以 `Rust_CRD.md` 為行為契約,按選項 2 架構實作,並優先設計**最被低估的兩塊**——actor 放置/分片層,與 actor 狀態的持久化/rehydration。

---

> **一句話總結:** 現在的瓶頸是「DO 計費 + D1 能力」,用 hibernation 與 Hyperdrive 就地解,不必動後端。整碗重構成 Rust 只在「自架成為認真的交付項」時才划算——屆時直接上 **Axum + Ractor + NATS + PostgreSQL**,別走半套。
