# Enterprise Role System (v4.0.0)

> 多渠道客服整合系統的角色權限規格  
> **最後更新**: 2026-05-04  
> **取代**：原 3-role 系統（Admin/Manager/Agent），v4 已重新設計

---

## 1. 概覽

本系統使用 **雙層角色（Dual-Role）** 而非單層階層：

```
系統角色（System Role）           團隊角色（Team Role）
─────────────────────             ───────────────────────
Admin                             Supervisor  ┐
  │                               Lead        │  在每個團隊
  │（全域）                       Member      ┘  獨立指定
  │
Agent ───────────────► (受限於團隊角色才能做事)
```

詳細權限矩陣請見 [RBAC_DESIGN.md](./RBAC_DESIGN.md)；本文件聚焦於「企業客服場景下，每個角色實際在做什麼」。

---

## 2. Admin（系統管理員）

**典型人選**：IT 主管 / 專案 owner / 客服中心總監

**核心職責**：
- 接通新渠道（LINE OA、Facebook 粉專）
- 建立 / 解散團隊
- 設定全域延遲訊息預設、自動回覆模板
- 查看跨團隊報表、稽核日誌
- 緊急斷流（斷路器）、系統備份還原
- 管理員工帳號的建立與停權

**典型一天**：
1. 早上看 Dashboard 確認系統 KPI
2. 處理新進員工的帳號建立、加進團隊
3. 設定本月新上線的 Facebook 粉專
4. 月底匯出客服效能報表給高層

**權限上限**：無限制 — 可看可改任何東西。

---

## 3. Agent + Supervisor（督導）

**典型人選**：客服中心副主管、跨組督導

**核心職責**：
- 監看自己被授權的多個團隊
- 處理跨組轉移的協調
- 培訓新進客服（看他們的對話、給回饋）
- 異常情況覆蓋指派（強制改派）

**典型工作場景**：
- 售前組客服都在忙，VIP 客戶來訊 → Supervisor 把對話覆蓋指派給專屬窗口
- 月底審視各組成員效能、與 Lead 討論績效

**權限上限**：被授權團隊內全部可見、可改；無法改系統設定、無法建團隊。

---

## 4. Agent + Lead（團隊主管）

**典型人選**：售前組組長、售後組組長、企業客戶組組長

**核心職責**：
- 組內對話分派（看哪位 Member 較閒就分過去）
- 處理 Member 處理不來的疑難對話
- 組內人員邀請與移除
- 編輯自己團隊的資料（QR Code、團隊描述）
- 看組內統計（每位 Member 處理量、平均回應時間）

**典型工作場景**：
- 早上看 5 個待派對話 → 依專長分給 3 位 Member
- 下午有客戶投訴 → 把對話轉到自己處理
- 看到新人 Member 處理速度慢 → 私下指導

**權限上限**：自己團隊內可改；其他團隊不可見（除非 Supervisor）。

---

## 5. Agent + Member（一般客服）

**典型人選**：第一線客服人員

**核心職責**：
- 處理被指派到的對話
- 接收新訊息、回覆、撤回（在期限內）、貼標籤
- 上傳檔案附件給客戶
- 設定自己的線上狀態（online / busy / away）
- 必要時請主管轉移

**典型工作場景**：
- 一上線就把狀態設 online
- 處理 Lead 派下來的對話
- 客戶問「上次的訂單編號」→ 全文搜訊息找答案
- 下班前把狀態切 offline

**權限上限**：只能看 / 改自己被指派的對話；不能指派給別人。

---

## 6. 多團隊歸屬常見模式

| 模式 | 設定 | 場景 |
|------|------|------|
| 單一團隊客服 | A 組 Member | 新人 / 專責特定產線 |
| 跨團隊資深客服 | A 組 Lead + B 組 Member | 兼任業務組長 + 客服組支援 |
| 跨團隊督導 | A、B、C 組 Supervisor | 三組共用督導 |
| 全公司管理員 | 系統 Admin（不需團隊角色） | 老闆 / IT 主管 |

`primaryTeamId` 用於決定 UI 預設視角（登入後預設展開哪個團隊），不影響權限。

---

## 7. 角色變更場景

### 新人入職
1. Admin 用 `POST /api/auth/register` 建帳號（角色：`agent`）
2. Lead 把新人加進團隊：`POST /api/teams/:id/members`（角色：`member`）
3. 新人首次登入要求改密碼（policy: `must_change`）

### 升任 Lead
1. Admin 或現任 Lead 在團隊內用 `PUT /api/teams/:id/members/:agentId` 改 `roleInTeam` 為 `lead`
2. 該員下次 token refresh 即生效（無需 logout）

### 跨組調動
1. Admin 用 `PUT /api/agents/batch/transfer` 將員工從 A 組移到 B 組
2. 該員失去 A 組所有權限，獲得 B 組權限（依新分配的 `roleInTeam`）

### 離職
1. Admin 軟刪除帳號（設 `deletedAt`）
2. 所有對話指派保留歷史，但該員無法登入

---

## 8. 與 v3 的差異

| 面向 | v3 | v4 |
|------|----|----|
| 系統角色 | Admin / Manager / Agent（3 層） | Admin / Agent（2 層） |
| Manager 角色 | 獨立的中階角色 | **已移除** — 改由「團隊角色 Lead/Supervisor」承擔 |
| 對話指派目標 | 可指派給「個人」或「團隊」 | **僅可指派給團隊** |
| 多團隊支援 | 一人一團隊 | **一人多團隊**，每團獨立角色 |
| 權限傳遞 | 純 DB 查詢 | JWT 內嵌（含 `allowedTeamIds`、`teamRoles`） |

> 升級規劃：原 v3 Manager 自動轉為「在原團隊任 Lead」；原 v3 Team 角色合併為 Agent。

---

## 9. 相關文檔

- [RBAC_DESIGN.md](./RBAC_DESIGN.md) — 完整權限矩陣與 middleware 實作
- [`docs/modules/auth.md`](../../modules/auth.md) — Auth 模組使用者手冊
- [`docs/modules/teams.md`](../../modules/teams.md) — Teams 模組
- [`docs/modules/agents.md`](../../modules/agents.md) — Agents 模組
