# Teams 模組 — 團隊管理與成員邀請

> **位置**: `src/modules/teams/`  
> **角色**: 把客服分組、設角色、邀人入組。

---

## 1. 這個模組是什麼？

把客服組織成「團隊」（teams），每個團隊獨立管理對話、QR Code、成員。一個客服可同時屬於多個團隊，每個團隊裡的角色（member / lead / supervisor）可獨立設定。

## 2. 解決什麼問題？

| 場景 | Teams 模組做什麼 |
|---|---|
| 公司分成「售前」「售後」兩組 | 建兩個 team，各自獨立工作流 |
| 新人入職 | 寄 Email 邀請或產生 QR Code 給他掃 |
| 業務希望客戶從 LINE QR 自動進「業務組」 | 用 LIFF QR Code 綁定團隊 |
| 主管要重置某成員密碼 | `POST /members/:id/reset` 含密碼策略 |
| 部門重組要把人移到新團隊 | `POST /transfer`（管理員） |

## 3. 主要功能

- **團隊 CRUD**：建立 / 列表 / 編輯 / 軟刪除
- **多團隊歸屬**：一人多團隊，首個團隊設 `isPrimary=true`
- **角色獨立**：同一人在 A 組是 lead、B 組是 member 完全 OK
- **批次成員管理**：一次新增、批次移除（≤ 50）
- **Email 邀請**：寄信附自動建立 agent
- **QR Code 邀請**：LIFF / 一般 QR，可掃描後綁團隊
- **密碼重置**：含策略（changeable / unchangeable / must_change）
- **團隊轉移**：管理員可整批搬移成員與對話
- **團隊統計**：成員數、活躍成員、對話數

## 4. 操作介面入口

| 介面 | 用途 |
|---|---|
| `TeamManagement.vue` | 主入口（admin） |
| `TeamListSection.vue` / `TeamCard.vue` | 列表 |
| `AddTeamModal.vue` / `EditTeamModal.vue` | 建立 / 編輯 |
| `TeamMemberSection.vue` / `TeamMemberCard.vue` | 成員管理 |
| `MultiTeamSelector.vue` | 用戶切換目前所在團隊 |
| `SelectMemberToTeamModal.vue` | 把 agent 加進團隊 |

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET / POST | `/api/teams` | 列表 / 建立 |
| GET / PUT / DELETE | `/api/teams/:id` | CRUD |
| GET | `/api/teams/stats/all` | （管理員）全域統計 |
| POST | `/api/teams/transfer` | （管理員）跨團隊轉移 |
| GET | `/api/teams/search/:query` | 名稱搜尋 |
| GET / POST | `/api/teams/:id/members` | 成員列表 / 新增 |
| PUT / DELETE | `/api/teams/:id/members/:agentId` | 成員修改 / 移除 |
| POST | `/api/teams/:id/members/batch` | 批次新增 |
| POST | `/api/teams/:id/members/bulk-remove` | 批次移除（≤ 50） |
| POST | `/api/teams/members/:id/reset` | 重置密碼 + 策略 |
| GET / POST | `/api/teams/:id/qr-codes` `/qr-code/liff` | QR / LIFF |

## 6. 涉及的 Durable Objects

- **`ConversationRoom`** — 成員異動時透過 `triggerTeamMemberChangeEvent()` 通知更新對話指派追蹤

## 7. 邊界案例與小細節

- **軟刪除以 join 條件實現**：`agents.deletedAt IS NULL` 在 join 時自動排除
- **isPrimary 邏輯**：第一個加入的團隊預設為主，當 JWT 的 `primaryTeamId` 過時時做 fallback
- **團隊轉移帶走對話**：team transfer 不只搬人，連他們經手的對話也一起搬
- **roleInTeam 完全獨立**：同人不同團不同角色是設計的常態
- **QR Code 去重**：建立時防止重複 QR；掃描記錄入 `qrCodeScans` 表

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| 成員數對不上 | 確認是否有 `deletedAt IS NULL` 過濾 |
| QR 掃描沒反應 | 看 LIFF 設定（`/api/liff/config`）與 `LINE_BOT_ID` env |
| 團隊轉移後對話消失 | 接收方權限要確認 |

---

**相關模組**：[auth](./auth.md)（角色簽發）、[agents](./agents.md)（成員本體）、[liff](./liff.md)（QR 綁定）
