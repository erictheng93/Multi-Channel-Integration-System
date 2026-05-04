# RBAC Design (Role-Based Access Control)

> v4.0.0 角色權限設計規格  
> **最後更新**: 2026-05-04

---

## 1. 設計原則

本系統採用 **雙層角色（Dual-Role）** 模型：
- **系統角色（System Role）**：定義一個帳號在「全系統」的最高權限上限
- **團隊角色（Team Role）**：定義一個帳號在「特定團隊」內的職責

兩層角色合併判定一個操作是否被允許。系統角色與團隊角色**互不替代**：一個 Admin 不需要團隊角色就能存取所有團隊；一個 Agent 必須透過團隊角色才能存取對話。

> 歷史註：v3 曾使用 3 層系統角色（Admin / Team / Agent）+ 6 種細分角色（Super Admin / Senior Agent / Viewer 等）。v4 簡化為以下方案。

---

## 2. 系統角色（System Role）

```
Admin   — 全權管理員
Agent   — 客服人員
```

| 角色 | 範圍 | 說明 |
|------|------|------|
| `admin` | 全系統 | 可建立 / 修改 / 刪除任何資源；可跨團隊存取所有對話；可管理渠道憑證、系統設定、備份還原 |
| `agent` | 受團隊範圍限制 | 必須透過團隊角色存取對話；不可改系統設定；不可建立渠道 |

**儲存位置**：`agents.role` 欄位（`'admin' | 'agent'`）

---

## 3. 團隊角色（Team Role）

```
Member       — 一般成員
Lead         — 團隊主管
Supervisor   — 督導
```

| 角色 | 範圍 | 主要能力 |
|------|------|----------|
| `member` | 自己被指派的對話 | 處理對話、發送 / 撤回訊息、貼標籤 |
| `lead` | 整個團隊的對話 | + 指派 / 取消指派團隊內成員、轉移對話、看團隊統計 |
| `supervisor` | 整個團隊 + 跨團隊監看 | + 跨團隊查看（不一定能修改）、覆蓋指派 |

**儲存位置**：`agent_teams.role_in_team` 欄位（`'member' | 'lead' | 'supervisor'`）

**重要設計**：同一個 `agent` 可在不同團隊扮演不同角色（A 團隊是 lead、B 團隊是 member），這是設計上的常態而非例外。

---

## 4. JWT Payload 設計

登入時系統會將以下資料編入 JWT，避免每次請求都查 DB：

```typescript
interface JwtPayload {
  userId: number;
  email: string;
  role: 'admin' | 'agent';                     // 系統角色
  primaryTeamId: number | null;                // 主要團隊（UI 預設視角）
  allowedTeamIds: number[];                    // 所有可存取的團隊 ID
  teamRoles: Record<number, 'member' | 'lead' | 'supervisor'>;  // {teamId: roleInTeam}
  iat: number;
  exp: number;
}
```

`refresh` 端點會**重新查 DB**，因此團隊歸屬異動可在下次刷新時生效。

---

## 5. 權限矩陣（核心場景）

### 對話權限

| 操作 | Admin | Agent + Lead/Supervisor | Agent + Member | 訪客 |
|------|:-----:|:-----------------------:|:--------------:|:----:|
| 看所有對話 | ✓ | – | – | – |
| 看團隊對話 | ✓ | ✓（自己的團隊） | – | – |
| 看自己被指派的對話 | ✓ | ✓ | ✓ | – |
| 指派對話給團隊成員 | ✓ | ✓ | – | – |
| 跨團隊轉移對話 | ✓ | – | – | – |
| 撤回訊息 | ✓ | ✓ | ✓（限自己發的） | – |
| 匯出對話 | ✓ | ✓ | – | – |

> **注意**：v4 移除「個人對話指派」，所有對話只能指派給「團隊」（`assignedTeamId`），由團隊內成員自行領取或由 Lead/Supervisor 分配。

### 團隊管理權限

| 操作 | Admin | Lead/Supervisor | Member |
|------|:-----:|:---------------:|:------:|
| 建立團隊 | ✓ | – | – |
| 刪除團隊 | ✓ | – | – |
| 編輯自己的團隊資訊 | ✓ | ✓ | – |
| 邀請成員 | ✓ | ✓ | – |
| 移除成員 | ✓ | ✓（移自己團隊） | – |
| 跨團隊轉移成員 | ✓ | – | – |
| 看團隊統計 | ✓ | ✓ | – |

### 系統管理權限

| 操作 | Admin | Agent |
|------|:-----:|:-----:|
| 改系統設定（延遲訊息預設等） | ✓ | – |
| 渠道整合 CRUD | ✓ | – |
| 看 / 操作斷路器 | ✓ | – |
| 系統公告 | ✓ | – |
| 看活動日誌（全部） | ✓ | – |
| 看活動日誌（自己） | ✓ | ✓ |
| 備份 / 還原 | ✓ | – |

---

## 6. Middleware 實作模式

```typescript
// src/middleware/auth.ts

// 系統角色檢查
export const requireAdmin = createMiddleware(async (c, next) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: 'Admin only' }, 403);
  await next();
});

// 團隊角色檢查（含階層）
export const requireTeamRole = (minRole: 'member' | 'lead' | 'supervisor') =>
  createMiddleware(async (c, next) => {
    const user = c.get('user');
    if (user.role === 'admin') return next();  // admin 直接過
    const teamId = Number(c.req.param('teamId'));
    const role = user.teamRoles[teamId];
    if (!role) return c.json({ error: 'Not a team member' }, 403);
    const order = { member: 1, lead: 2, supervisor: 3 };
    if (order[role] < order[minRole]) return c.json({ error: 'Insufficient team role' }, 403);
    await next();
  });

// 對話存取檢查
export async function canAccessConversation(user: JwtPayload, conversation: Conversation) {
  if (user.role === 'admin') return true;
  if (!conversation.assignedTeamId) return false;
  return user.allowedTeamIds.includes(conversation.assignedTeamId);
}
```

---

## 7. 邊界案例

| 情境 | 行為 |
|------|------|
| Agent 被踢出唯一所屬團隊 | `allowedTeamIds=[]`，能登入但看不到任何對話；token refresh 後生效 |
| Admin 被加進某團隊 | 不影響 admin 全域權限；`teamRoles[teamId]` 仍會被填入 |
| 同一 Agent 在 A 是 Lead、在 B 是 Member | 兩個獨立判定，互不影響 |
| 對話 `assignedTeamId` 為 null | 視為「未指派」，只有 admin 能看；典型情境是新訊息進來但尚未路由 |
| Lead 試圖修改其他團隊 | 被 `requireTeamRole` 阻擋，回 403 |

---

## 8. 與舊版（v3）差異速查

| 面向 | v3 | v4 |
|------|----|----|
| 系統角色數量 | 3（Admin / Team / Agent） | 2（Admin / Agent） |
| 細分角色 | 6 種（Super Admin / Senior Agent / Viewer 等） | 移除細分，由團隊角色承擔 |
| 對話指派 | 可指派給「個人」或「團隊」 | 僅可指派給「團隊」 |
| 權限載體 | DB 查詢為主 | JWT 內嵌 + refresh 重查 |
| 多團隊歸屬 | 受限 | 完整支援，每團隊獨立角色 |

---

## 9. 相關檔案

- `src/middleware/auth.ts` — Middleware 實作
- `src/utils/auth.ts` — JWT 簽發 / 驗證
- `src/services/permission-service.ts` — 高階權限判定
- `src/db/schema.ts:42` — `roleInTeam` 欄位
- `docs/modules/auth.md` — Auth 模組使用者手冊
