# Auth 模組 — 認證與工作階段

> **位置**: `src/modules/auth/`  
> **角色**: 系統的「大門」 — 誰能進來、能存取什麼，全靠它把關。

---

## 1. 這個模組是什麼？

Auth 模組處理 Email + 密碼登入、JWT 簽發與更新、工作階段（session）管理。它支援多團隊歸屬、密碼策略、登入失敗鎖定，並把使用者的角色與所屬團隊資訊塞到 JWT 裡，讓後續所有 API 不必再查 DB。

## 2. 解決什麼問題？

| 場景 | Auth 模組做什麼 |
|---|---|
| 客服早上開電腦登入 | `POST /login` → 拿到 access + refresh token |
| 在使用中 token 快過期 | 前端 interceptor 自動 `POST /refresh` 換新 |
| 主管要新增同事帳號 | `POST /register`（管理員專用） |
| 同事一直猜密碼 | 5 次失敗鎖 15 分鐘，記 IP 與 User-Agent |
| 設定 LINE 渠道憑證 | `POST /credentials/store` 加密後存 DB |

## 3. 主要功能

- **JWT 雙令牌**：access token 2 小時、refresh token 7 天滾動更新
- **多團隊 JWT 編碼**：`primaryTeamId`、`allowedTeamIds[]`、`teamRoles{}` 都在 token 裡
- **Refresh 重查 DB**：刷新時重新讀團隊歸屬，能感應團隊異動
- **密碼策略**：`changeable` / `unchangeable` / `must_change` 三種策略
- **臨時密碼變更 token**：強制改密碼用，30 分鐘有效
- **多種雜湊相容**：bcrypt（新）/ PBKDF2（過渡）/ SHA256（舊）— 漸進遷移
- **session 管理**：KV 儲存，24 小時 TTL，靠 `Session-ID` header 追蹤
- **失敗鎖定**：5 次失敗鎖 15 分鐘，含 IP / UA log

## 4. 操作介面入口

| 介面 | 用途 |
|---|---|
| `Login.vue` | 登入畫面 |
| 受保護頁面（全部） | 載入時呼叫 `/auth/me` 取使用者上下文 |
| `frontend/src/api/auth.ts` interceptor | 自動換 token |

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| POST | `/api/auth/login` | Email + 密碼登入 |
| POST | `/api/auth/refresh` | 換新 access token |
| POST | `/api/auth/logout` | 登出（毀 server session） |
| GET | `/api/auth/profile` `/me` | 取自己的資料 |
| POST | `/api/auth/register` | （管理員）建立新帳號 |
| POST | `/api/auth/credentials/store` `get` | （管理員）加密存放渠道憑證 |

## 6. 涉及的 Durable Objects

**不直接使用 DO**。session 純用 KV，JWT 為無狀態設計。

## 7. 邊界案例與小細節

- **角色系統 2 + 3 雙層**：
  - 系統角色（`role`）：`admin` / `agent`（v4 簡化，移除 `team`）
  - 團隊角色（`roleInTeam`）：`member` / `lead` / `supervisor`
- **JWT refresh 不只是換時效**：會重新查 `agent_teams` 表把最新團隊資訊重編
- **dual `verifyPassword`**：`src/utils/auth.ts`（登入用）與 `src/modules/auth/services/auth.ts`（密碼變更用）兩支函式必須同步維護
- **臨時 token 用 `type='temp_password_change'`**：別跟一般 access token 混用
- **多分頁 session 同步**：靠前端事件，不在後端做

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| 登入卡住 | 看是否觸發鎖定（5 次失敗）；查 IP 是否被防火牆擋 |
| token 一直 401 | 確認 refresh interceptor 有抓到 401 並換 token |
| 改完團隊歸屬還是看不到對話 | refresh 一次 token，舊 JWT 快取了舊清單 |

---

**相關模組**：[teams](./teams.md)（角色與成員）、[session](./session.md)（注意：session 模組是對話會話不是登入會話）
