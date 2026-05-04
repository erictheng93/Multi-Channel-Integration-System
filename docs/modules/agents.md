# Agents 模組 — 客服人員管理

> **位置**: `src/modules/agents/`  
> **角色**: 管理「客服個體」 — 建立、停權、查狀態、設技能。

---

## 1. 這個模組是什麼？

每位客服在系統裡都是一個 `agent` 紀錄。Agents 模組提供 agent 的完整管理：建檔、批次更新、跨團隊轉移、即時狀態（在線 / 忙碌 / 離開）、技能標籤。

> 注意：「指派客服進團隊」的邏輯在 [teams 模組](./teams.md)，本模組關注 agent 自身屬性。

## 2. 解決什麼問題？

| 場景 | Agents 模組做什麼 |
|---|---|
| 新進客服建檔 | `POST /agents` 設 Email、暫時密碼、角色 |
| 一次升級 30 個 agent 為 lead | `PUT /batch` 批次操作 |
| 想看「目前在線的客服」 | `GET /status/statistics` 即時統計 |
| 客服切到「離開」狀態 | `POST /:id/status` 同步到 KV |
| 主管想找會「英文 + 退貨處理」的客服 | 技能查找 |

## 3. 主要功能

- **完整 CRUD**：建立 / 列表 / 詳情 / 編輯 / 軟刪除
- **批次更新**：一次更動 ≤ 50 位 agent 的角色與啟用狀態
- **批次轉移**：跨團隊搬移，逐筆錯誤回報
- **進階搜尋**：依 Email / 名字 / 狀態 / 團隊
- **即時狀態**：online / away / busy / offline，KV 儲存
- **狀態歷史**：可查最近 N 筆狀態變更（預設 20）
- **技能管理**：CRUD 加上每位 agent 技能熟練度統計

## 4. 操作介面入口

目前主要由其他頁面間接操作（如 `TeamManagement.vue` 的成員卡），無單獨 agent 管理頁面。技能與狀態統計常出現在儀表板。

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET / POST | `/api/agents` | 列表 / 建立 |
| GET / PUT / DELETE | `/api/agents/:id` | CRUD |
| PUT | `/api/agents/batch` | 批次更新 |
| PUT | `/api/agents/batch/transfer` | 批次跨團隊轉移 |
| POST | `/api/agents/search` | 進階搜尋 |
| GET | `/api/agents/status/statistics` | 全域狀態統計（lead+） |
| GET / POST | `/api/agents/:id/status` | 取 / 設狀態 |
| GET | `/api/agents/:id/status/history` | 狀態變更歷史 |
| GET / POST / PUT / DELETE | `/api/agents/:id/skills` | 技能 CRUD |
| GET | `/api/agents/:id/skills/statistics` | 技能熟練度統計 |

## 6. 涉及的 Durable Objects

**不直接使用 DO**。技能與狀態都存 KV（即時、非持久）。

## 7. 邊界案例與小細節

- **agent 軟刪除**：標記 `deletedAt`，不真的刪除（保歷史完整）
- **isPrimary 規則**：被分到多個團隊時，首個保持 isPrimary
- **技能存 KV**：刻意非持久化，適合「短期能力標記」場景
- **狀態歷史無自動清理**：靠查詢 `limit` 控制；長期未清會累積
- **批次部分成功**：回 `failed[]` 與 `skipped[]` 兩個陣列，單筆失敗不中斷整批

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| 線上狀態一直顯示離線 | KV 是否寫入成功；確認 heartbeat 機制 |
| 技能列表突然空了 | KV 沒持久化，重啟可能丟失（這是設計） |
| 批次轉移後人數不對 | 看 `failed[]`，多半是 agent 已經在目標團隊 |

---

**相關模組**：[teams](./teams.md)、[auth](./auth.md)
