# 🚀 路由管理終極指南

一勞永逸解決路由順序問題的完整方案。

## 📋 目錄

- [問題背景](#問題背景)
- [解決方案架構](#解決方案架構)
- [使用方法](#使用方法)
- [最佳實踐](#最佳實踐)
- [故障排除](#故障排除)

---

## 🎯 問題背景

### 為什麼路由順序很重要？

在 Hono 框架中，**路由匹配採用「先註冊先匹配」策略**：

```typescript
// ❌ 錯誤示例
app.route('/', teamHandlers);        // 包含 /:id/members
app.route('/members', membersHandler); // 永遠不會被匹配到！

// 請求 GET /api/teams/members
// → 被 /:id/members 攔截（id = "members"）
// → 返回 "Invalid team ID" 錯誤
```

### 常見路由衝突模式

| 衝突類型 | 示例 | 問題 |
|---------|------|------|
| 參數攔截具體路由 | `/:id` vs `/members` | 具體路由必須先註冊 |
| 嵌套路由衝突 | `/:id/members` vs `/members` | 同上 |
| 通配符過於寬泛 | `/*` vs `/api/*` | 通配符應最後註冊 |
| 重複路由 | 同一路徑註冊兩次 | 後者會被忽略 |

---

## 🛡️ 解決方案架構（5 層防護）

```
┌─────────────────────────────────────────────────┐
│  第 1 層：智能路由註冊器（自動排序）              │
│  src/core/smart-route-registry.ts               │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  第 2 層：路由衝突檢測工具（開發時）              │
│  scripts/detect-route-conflicts.ts              │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  第 3 層：Git Pre-commit Hook（提交前檢查）      │
│  .husky/pre-commit                              │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  第 4 層：CI/CD 自動檢測（部署前驗證）            │
│  .github/workflows/route-check.yml                 │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  第 5 層：運行時監控（生產環境告警）              │
│  src/monitoring/route-monitor.ts                │
└─────────────────────────────────────────────────┘
```

---

## 📖 使用方法

### 方法 1：使用智能路由註冊器（推薦）

```typescript
// src/modules/your-module/handlers/index.ts
import { Hono } from 'hono';
import { createSmartRegistry, RoutePriority } from '@/core/smart-route-registry';

const app = new Hono();
const registry = createSmartRegistry(app);

// ✅ 添加路由定義（順序不重要！）
registry.addMany([
  {
    path: '/members',
    handler: membersHandler,
    priority: RoutePriority.SPECIFIC,
    description: 'Member CRUD operations'
  },
  {
    path: '/invitations',
    handler: invitationsHandler,
    priority: RoutePriority.SPECIFIC,
    description: 'Invitation management'
  },
  {
    path: '/',
    handler: teamHandlers,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Team routes with /:id patterns'
  }
]);

// 自動排序並註冊
const { registered, conflicts } = registry.register();

// 輸出示例：
// 🚀 Smart Route Registry - Starting registration...
//
//   ✅ [P1] /health                        (specificity: 10)
//   ✅ [P2] /members                       (specificity: 10) - Member CRUD
//   ✅ [P2] /invitations                   (specificity: 10) - Invitations
//   ✅ [P3] /                              (specificity: 0) - Team routes
//
// 📊 Smart Route Registry Report
// ═══════════════════════════════════════════════════════════════
// Total routes: 4
// Registered: 4
// Conflicts detected: 0
```

### 方法 2：手動控制（需要嚴格遵守順序）

```typescript
// ⚠️ 必須嚴格按照優先級順序註冊！

const app = new Hono();

// 1️⃣ STATIC - 靜態路由（最高優先級）
app.get('/health', healthHandler);
app.get('/info', infoHandler);

// 2️⃣ SPECIFIC - 具體路由
app.route('/members', membersHandler);
app.route('/invitations', invitationsHandler);

// 3️⃣ PARAMETERIZED - 參數化路由
app.route('/:id', idHandler);

// 4️⃣ WILDCARD - 通配符路由（最低優先級）
app.route('/*', catchAllHandler);
```

### 使用檢測工具

#### 開發時檢測

```bash
# 手動運行檢測
npm run check:routes

# 輸出示例：
# 🔍 Route Conflict Detector
#
# Found 15 handler files
# Extracted 87 route definitions
#
# ═══════════════════════════════════════════════════════════
# 📊 CONFLICT DETECTION REPORT
# ═══════════════════════════════════════════════════════════
#
# 🟡 MEDIUM SEVERITY (Parameterized route conflicts):
# ─────────────────────────────────────────────────────────
#   ⚠️  "/:id/members" may intercept "/members"
#      Priority scores: 11 vs 10
#      📍 src/modules/teams/handlers/team.ts:367
#      📍 src/modules/teams/handlers/members.ts:27
#      💡 Suggestion: Register "/members" before "/:id/members"
```

#### 提交前自動檢測

```bash
# 安裝 husky（如果還沒有）
npm install -D husky
npx husky install

# 添加 pre-commit hook
npx husky add .husky/pre-commit "npm run check:routes"
```

#### CI/CD 自動檢測

```yaml
# .github/workflows/route-check.yml
name: Route Conflict Check

on: [push, pull_request]

jobs:
  check-routes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run check:routes
```

---

## 🎯 最佳實踐

### 1. **使用路由優先級常量**

```typescript
// ✅ 推薦
import { RoutePriority } from '@/core/smart-route-registry';

registry.add({
  path: '/members',
  handler: membersHandler,
  priority: RoutePriority.SPECIFIC
});

// ❌ 不推薦
registry.add({
  path: '/members',
  handler: membersHandler,
  priority: 2  // 魔法數字，難以理解
});
```

### 2. **為每個路由添加描述**

```typescript
registry.add({
  path: '/members',
  handler: membersHandler,
  priority: RoutePriority.SPECIFIC,
  description: 'Member CRUD - GET list, POST create, PUT/:id update, DELETE/:id remove'
});
```

### 3. **模塊化路由定義**

```typescript
// src/modules/teams/routes.config.ts
export const teamRoutes = [
  {
    path: '/members',
    handler: membersHandler,
    priority: RoutePriority.SPECIFIC,
    description: 'Member management'
  },
  {
    path: '/invitations',
    handler: invitationsHandler,
    priority: RoutePriority.SPECIFIC,
    description: 'Invitation management'
  },
  // ... 更多路由
];

// src/modules/teams/handlers/index.ts
import { teamRoutes } from '../routes.config';

const registry = createSmartRegistry(app);
registry.addMany(teamRoutes);
registry.register();
```

### 4. **定期運行檢測**

```json
// package.json
{
  "scripts": {
    "check:routes": "tsx scripts/detect-route-conflicts.ts",
    "check:routes:watch": "nodemon --exec tsx scripts/detect-route-conflicts.ts --watch src",
    "predev": "npm run check:routes",
    "predeploy": "npm run check:routes"
  }
}
```

### 5. **路由命名規範**

```typescript
// ✅ 推薦的路由結構
/api/teams                    // 列表
/api/teams/:id                // 單個資源
/api/teams/:id/members        // 子資源
/api/teams/members            // 跨團隊成員（特殊，需先註冊）
/api/teams/invitations        // 邀請（特殊，需先註冊）

// ❌ 避免的模式
/api/teams/all                // 容易與 /:id 衝突
/api/teams/list               // 不必要，使用 / 即可
/api/teams/:teamId/list       // 冗餘，使用 /:teamId/members
```

---

## 🐛 故障排除

### 問題 1：路由返回 404

**症狀**：
```
GET /api/teams/members → 404 Not Found
```

**可能原因**：
1. 路由未註冊
2. 路由被其他模式攔截
3. 路由路徑拼寫錯誤

**解決方法**：
```bash
# 運行檢測工具
npm run check:routes

# 檢查路由註冊日誌
npm run dev | grep "Registered:"

# 手動測試路由
curl -v http://localhost:8787/api/teams/members
```

### 問題 2：路由返回 400/500 錯誤

**症狀**：
```
GET /api/teams/members → 400 Bad Request
Error: "Invalid team ID"
```

**可能原因**：
參數化路由 `/:id/members` 攔截了 `/members`

**解決方法**：
```typescript
// ❌ 錯誤的順序
app.route('/', teamHandlers);        // 包含 /:id/*
app.route('/members', membersHandler);

// ✅ 正確的順序
app.route('/members', membersHandler); // 先註冊具體路由
app.route('/', teamHandlers);          // 後註冊參數化路由
```

### 問題 3：檢測工具報告衝突

**症狀**：
```
⚠️  "/:id/members" may intercept "/members"
💡 Suggestion: Register "/members" before "/:id/members"
```

**解決方法**：

**選項 A：使用智能註冊器（推薦）**
```typescript
const registry = createSmartRegistry(app);
registry.addMany([...routes]); // 自動排序
registry.register();
```

**選項 B：手動調整順序**
```typescript
// 按照建議調整註冊順序
app.route('/members', membersHandler);     // 1. 先
app.route('/:id/members', idMembersHandler); // 2. 後
```

**選項 C：重構路由結構**
```typescript
// 避免衝突的設計
app.route('/all-members', allMembersHandler);  // 改名
app.route('/:id/members', idMembersHandler);
```

### 問題 4：同一路徑註冊兩次

**症狀**：
```
🔴 HIGH SEVERITY (Duplicate routes):
❌ GET /api/teams/members
   📍 src/modules/teams/handlers/team.ts:310
   📍 src/modules/teams/handlers/members.ts:27
```

**解決方法**：
1. 移除其中一個定義
2. 確保每個路由只在一個地方定義
3. 使用智能註冊器自動去重

---

## 📚 進階主題

### 自定義優先級

```typescript
// 為特殊路由定義自定義優先級
export enum CustomPriority {
  HEALTH_CHECK = 0,      // 最高
  AUTHENTICATION = 1,
  STATIC = 2,
  SPECIFIC = 3,
  PARAMETERIZED = 4,
  WILDCARD = 5          // 最低
}

registry.add({
  path: '/health',
  handler: healthHandler,
  priority: CustomPriority.HEALTH_CHECK
});
```

### 運行時監控

```typescript
// src/monitoring/route-monitor.ts
export function monitorRoutes(app: Hono) {
  app.use('*', async (c, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;

    // 記錄慢路由
    if (duration > 1000) {
      console.warn(`⚠️ Slow route: ${c.req.path} (${duration}ms)`);
    }
  });
}
```

### 路由版本控制

```typescript
// v1 路由
const v1Registry = createSmartRegistry(app);
v1Registry.addMany([...v1Routes]);
app.route('/api/v1', v1Registry.register());

// v2 路由
const v2Registry = createSmartRegistry(app);
v2Registry.addMany([...v2Routes]);
app.route('/api/v2', v2Registry.register());
```

---

## 🔗 相關資源

- [Hono 官方文檔 - Routing](https://hono.dev/api/routing)
- [專案路由配置](../src/core/route-config.ts)
- [智能註冊器源碼](../src/core/smart-route-registry.ts)
- [檢測工具源碼](../scripts/detect-route-conflicts.ts)

---

## 📝 總結

### ✅ 使用智能註冊器的好處

1. **自動排序** - 無需手動管理順序
2. **衝突檢測** - 自動發現潛在問題
3. **詳細報告** - 清晰的註冊日誌
4. **類型安全** - TypeScript 完整支持
5. **易於維護** - 集中管理路由定義

### 📌 關鍵原則

1. **具體路由優先** - 總是在參數化路由之前註冊
2. **使用檢測工具** - 定期運行 `npm run check:routes`
3. **添加 CI 檢查** - 防止錯誤合併到主分支
4. **文檔化路由** - 為每個路由添加描述
5. **定期審查** - 重構時檢查路由結構

---

**最後更新**：2025-10-20
**維護者**：Development Team
