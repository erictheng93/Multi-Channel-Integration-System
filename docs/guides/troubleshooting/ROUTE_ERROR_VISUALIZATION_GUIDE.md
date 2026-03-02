# 🔍 路由錯誤視覺化查看指南
## 快速定位和解決路由問題的完整指南

---

## 📋 目錄

- [1. 錯誤檢測的 4 個入口](#1-錯誤檢測的-4-個入口)
- [2. 開發階段：實時檢測](#2-開發階段實時檢測)
- [3. 運行時錯誤：瀏覽器查看](#3-運行時錯誤瀏覽器查看)
- [4. 生產環境：日誌監控](#4-生產環境日誌監控)
- [5. 錯誤解讀指南](#5-錯誤解讀指南)
- [6. 快速修復流程](#6-快速修復流程)

---

## 1. 錯誤檢測的 4 個入口

### 🎯 檢測入口總覽

```
┌─────────────────────────────────────────────────────┐
│ 入口 1: 開發時靜態檢測 (推薦)                       │
│ 命令: npm run check:routes                          │
│ 時機: 開發過程中隨時運行                            │
│ 優點: ✅ 最快速 ✅ 零成本 ✅ 不需運行應用           │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│ 入口 2: 瀏覽器開發者工具 (運行時)                  │
│ 位置: Chrome DevTools → Network/Console             │
│ 時機: API 請求返回錯誤時                            │
│ 優點: ✅ 視覺化 ✅ 即時反饋 ✅ 完整請求細節         │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│ 入口 3: 終端日誌 (本地開發伺服器)                  │
│ 命令: npm run dev (查看輸出)                        │
│ 時機: 應用啟動或路由註冊時                          │
│ 優點: ✅ 顯示註冊順序 ✅ 系統層級視角               │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│ 入口 4: 生產環境日誌 (Cloudflare Workers)          │
│ 位置: Cloudflare Dashboard → Workers → Logs         │
│ 時機: 生產環境錯誤發生時                            │
│ 優點: ✅ 真實用戶請求 ✅ 完整堆疊追蹤              │
└─────────────────────────────────────────────────────┘
```

---

## 2. 開發階段：實時檢測

### 🚀 方法 1: 命令行檢測（最推薦）

```bash
# 運行路由衝突檢測
npm run check:routes
```

#### 📊 視覺化輸出解讀

**✅ 無衝突狀態（理想情況）**:
```
🔍 Route Conflict Detector

Scanning for route definitions...

Found 97 handler files
Extracted 439 route definitions

═════════════════════════════════════════════════════
📊 CONFLICT DETECTION REPORT
═════════════════════════════════════════════════════

✅ No route conflicts detected!

═════════════════════════════════════════════════════
```

**⚠️ 有衝突狀態（需要修復）**:
```
🔍 Route Conflict Detector

Found 97 handler files
Extracted 439 route definitions

═════════════════════════════════════════════════════
📊 CONFLICT DETECTION REPORT
═════════════════════════════════════════════════════

⚠️  Found 2 potential conflicts:

🔴 HIGH SEVERITY (Duplicate routes):
─────────────────────────────────────────────────────
  ❌ GET /members
     📍 src/modules/teams/handlers/team.ts:310
     📍 src/modules/teams/handlers/members.ts:27
     💡 Remove duplicate definition

🟡 MEDIUM SEVERITY (Parameterized route conflicts):
─────────────────────────────────────────────────────
  ⚠️  "/:id/members" may intercept "/members"
     Priority scores: 11 vs 10
     📍 src/modules/teams/handlers/team.ts:367
     📍 src/modules/teams/handlers/members.ts:27
     💡 Suggestion: Register "/members" before "/:id/members"

═════════════════════════════════════════════════════
```

#### 🎨 顏色和符號說明

| 符號 | 嚴重度 | 含義 | 需要處理 |
|------|--------|------|----------|
| ❌ 🔴 | HIGH | 完全重複的路由定義 | ⚡ 立即修復 |
| ⚠️ 🟡 | MEDIUM | 參數化路由可能攔截具體路由 | 📅 本週修復 |
| ℹ️ 🟢 | LOW | 潛在問題，可能是誤報 | 👀 檢查評估 |

#### 📍 定位代碼位置

檢測報告中的路徑格式：
```
📍 src/modules/teams/handlers/members.ts:27
   │                                      │
   └─ 文件路徑                            └─ 行號
```

**快速跳轉到問題代碼**（VS Code）:
1. 按 `Ctrl+P` (Windows) 或 `Cmd+P` (Mac)
2. 輸入 `members.ts:27`
3. 按 Enter 直接跳到第 27 行

---

### 🔍 方法 2: 監控模式（開發時持續監測）

```bash
# 啟動文件監控模式
npm run check:routes:watch
```

**視覺化輸出**:
```
[1] Watching src/modules/**/*.ts and src/handlers/**/*.ts
[2]
[3] 🔍 Initial scan complete - No conflicts
[4]
[5] ⏱️  Waiting for changes...
[6]
[7] ── File changed: src/modules/teams/handlers/members.ts ──
[8]
[9] 🔄 Re-scanning...
[10]
[11] ⚠️  NEW CONFLICT DETECTED!
[12]
[13] 🟡 MEDIUM: "/:id/members" may intercept "/members"
[14]     📍 src/modules/teams/handlers/team.ts:367
[15]     📍 src/modules/teams/handlers/members.ts:27
```

**使用場景**:
- 📝 重構路由結構時
- 🔨 新增多個路由時
- 🧪 實驗不同路由設計時

---

## 3. 運行時錯誤：瀏覽器查看

### 🌐 Chrome DevTools - Network 標籤

#### 視覺化錯誤識別

**正常請求 (200 OK)**:
```
┌────────────────────────────────────────────────┐
│ Name: members                                  │
│ Status: 200 ✅                                 │
│ Type: xhr                                      │
│ Size: 2.5 KB                                   │
│ Time: 142 ms                                   │
└────────────────────────────────────────────────┘
```

**路由衝突錯誤 (400 Bad Request)**:
```
┌────────────────────────────────────────────────┐
│ Name: members                                  │
│ Status: 400 ❌                                 │  ← 紅色標記
│ Type: xhr                                      │
│ Size: 156 B                                    │
│ Time: 45 ms                                    │
└────────────────────────────────────────────────┘

Response Preview:
{
  "success": false,
  "error": "Invalid team ID"  ← 路由攔截的特徵錯誤
}

Request URL:
https://localhost:8787/api/teams/members
                              ^^^^^^^^
                              被當作 :id 參數解析
```

#### 🔍 快速診斷步驟

```
步驟 1: 打開 Chrome DevTools
┌─────────────────────────────────────┐
│ 快捷鍵: F12 或 Ctrl+Shift+I        │
└─────────────────────────────────────┘

步驟 2: 切換到 Network 標籤
┌─────────────────────────────────────┐
│ 點擊: Network                       │
│ 勾選: Preserve log (保留日誌)      │
└─────────────────────────────────────┘

步驟 3: 重現錯誤
┌─────────────────────────────────────┐
│ 刷新頁面或觸發 API 請求             │
└─────────────────────────────────────┘

步驟 4: 篩選錯誤請求
┌─────────────────────────────────────┐
│ 過濾器輸入: status-code:400        │
│ 或點擊 "4xx" 按鈕                   │
└─────────────────────────────────────┘

步驟 5: 查看詳細信息
┌─────────────────────────────────────┐
│ 點擊錯誤請求 → Preview 標籤        │
│ 查看錯誤消息                        │
└─────────────────────────────────────┘
```

#### 📸 視覺化截圖指南

**如何截圖路由錯誤**:

```
┌──────────────────────────────────────────────────┐
│ Chrome DevTools - Network Tab                   │
├──────────────────────────────────────────────────┤
│ Filter: [status-code:400        ] 🔍            │
├──────────────────────────────────────────────────┤
│ Name        Status  Type   Size    Time          │
│ ----------------------------------------          │
│ members     400❌   xhr    156B    45ms   ← 點擊 │
├──────────────────────────────────────────────────┤
│ Headers | Preview | Response | Timing            │
├──────────────────────────────────────────────────┤
│ Preview:                                          │
│                                                   │
│ {                                                 │
│   "success": false,                               │
│   "error": "Invalid team ID"  ← 關鍵錯誤訊息     │
│ }                                                 │
│                                                   │
│ Request URL:                                      │
│ http://localhost:8787/api/teams/members           │
│                               ^^^^^^^ ← 問題路徑  │
└──────────────────────────────────────────────────┘
```

**截圖時必須包含的信息**:
- ✅ Request URL（請求網址）
- ✅ Status Code（狀態碼：400/404）
- ✅ Response Body（回應內容）
- ✅ Request Headers（可選，用於複雜問題）

---

### 🖥️ Console 標籤 - 錯誤日誌

```javascript
// 典型的路由衝突錯誤日誌

❌ GET http://localhost:8787/api/teams/members 400 (Bad Request)

Error: Failed to load resource
  at fetch (async)
  at loadTeamMembers (TeamManagement.vue:45)
  at mounted (TeamManagement.vue:89)

Response:
{
  "success": false,
  "error": "Invalid team ID"
}
```

**關鍵錯誤訊息模式識別**:

| 錯誤訊息 | 可能原因 | 解決方向 |
|---------|---------|---------|
| "Invalid team ID" | 字符串被當作數字解析 | 檢查路由順序 |
| "Invalid ID format" | 參數類型驗證失敗 | 檢查路由參數 |
| "Team not found" | 錯誤的 ID 值 | 檢查路由攔截 |
| "Insufficient permissions" | 中間件順序問題 | 檢查中間件配置 |

---

## 4. 生產環境：日誌監控

### ☁️ Cloudflare Workers 日誌

#### 📍 查看位置

```
登入 Cloudflare Dashboard
        ↓
選擇你的帳號
        ↓
Workers & Pages
        ↓
選擇 Worker: mcis-worker
        ↓
點擊 "Logs" 標籤
        ↓
實時日誌串流
```

#### 🔍 視覺化日誌篩選

**Cloudflare Logs 界面**:
```
┌─────────────────────────────────────────────────────┐
│ Cloudflare Workers - Real-time Logs                │
├─────────────────────────────────────────────────────┤
│ 🔍 Filter: [400        ] 🔽 Level: All             │
├─────────────────────────────────────────────────────┤
│ Timestamp           Status  Method  Path            │
│ ─────────────────────────────────────────────────── │
│ 2025-01-20 14:23:45  200    GET     /api/health    │
│ 2025-01-20 14:24:01  400❌  GET     /api/teams/... │
│ 2025-01-20 14:24:02  200    POST    /api/auth/...  │
└─────────────────────────────────────────────────────┘
```

**點擊錯誤日誌查看詳情**:
```
┌─────────────────────────────────────────────────────┐
│ Log Entry Details                                   │
├─────────────────────────────────────────────────────┤
│ Timestamp: 2025-01-20 14:24:01.234 UTC             │
│ Status: 400 Bad Request                             │
│ Method: GET                                         │
│ URL: /api/teams/members                             │
│                                                     │
│ Request Headers:                                    │
│   Authorization: Bearer eyJ...                      │
│   User-Agent: Mozilla/5.0...                        │
│                                                     │
│ Response:                                           │
│   {                                                 │
│     "success": false,                               │
│     "error": "Invalid team ID"                      │
│   }                                                 │
│                                                     │
│ Console Output:                                     │
│   [ERROR] Route intercepted: members → /:id         │
│   [INFO] Parsed teamId: NaN                         │
│                                                     │
│ Stack Trace:                                        │
│   at requireTeamAccess (auth.ts:252)                │
│   at handler (team.ts:367)                          │
└─────────────────────────────────────────────────────┘
```

#### 🎯 日誌搜索技巧

**常用篩選器**:
```bash
# 篩選 400 錯誤
status:400

# 篩選特定路徑
path:/api/teams/members

# 篩選特定錯誤訊息
error:"Invalid team ID"

# 組合篩選
status:400 AND path:/api/teams/*

# 時間範圍篩選
timestamp:[2025-01-20T14:00:00 TO 2025-01-20T15:00:00]
```

---

## 5. 錯誤解讀指南

### 🎓 常見路由衝突模式

#### 模式 1: 參數攔截具體路由

**視覺化示意圖**:
```
請求: GET /api/teams/members

❌ 錯誤流程:
┌─────────────────────────────────────┐
│ 1. Hono 路由匹配引擎啟動            │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ 2. 檢查第一個註冊的路由             │
│    路由: /:id/members               │
│    匹配: teams/members → :id=teams  │
│    結果: ✅ 匹配成功                │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ 3. 執行中間件                       │
│    requireTeamAccess('id')          │
│    parseInt("teams") → NaN          │
│    回傳: 400 "Invalid team ID"      │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ 4. 請求結束，錯誤返回               │
│    /members 路由永遠不會被觸發      │
└─────────────────────────────────────┘
```

**檢測報告中的表現**:
```
🟡 MEDIUM SEVERITY:
  ⚠️  "/:id/members" may intercept "/members"
     Priority scores: 11 vs 10
     📍 src/modules/teams/handlers/team.ts:367
     📍 src/modules/teams/handlers/members.ts:27
     💡 Register "/members" before "/:id/members"
```

**修復方法**:
```typescript
// ❌ 錯誤順序
app.route('/', teamHandlers);        // 包含 /:id/members
app.route('/members', membersHandler); // 被攔截

// ✅ 正確順序
app.route('/members', membersHandler); // 先註冊
app.route('/', teamHandlers);          // 後註冊
```

#### 模式 2: 完全重複路由

**視覺化示意圖**:
```
同一路徑註冊兩次:

第一次註冊:
┌────────────────────────────────────┐
│ GET /members                       │
│ 位置: team.ts:310                  │
│ 狀態: ✅ 註冊成功                  │
└────────────────────────────────────┘

第二次註冊:
┌────────────────────────────────────┐
│ GET /members                       │
│ 位置: members.ts:27                │
│ 狀態: ⚠️ 被忽略（後者不生效）     │
└────────────────────────────────────┘

結果:
• 只有第一個定義生效
• 第二個處理器永遠不會被調用
• 可能導致邏輯錯誤
```

**檢測報告中的表現**:
```
🔴 HIGH SEVERITY (Duplicate routes):
  ❌ GET /members
     📍 src/modules/teams/handlers/team.ts:310
     📍 src/modules/teams/handlers/members.ts:27
     💡 Remove duplicate definition
```

**修復方法**:
```typescript
// 選項 1: 移除其中一個定義
// 刪除 team.ts:310 的重複路由

// 選項 2: 合併到同一個處理器
// 將邏輯移到 members.ts

// 選項 3: 重命名其中一個
// 例如: /members → /all-members
```

#### 模式 3: 通配符過早註冊

**視覺化示意圖**:
```
❌ 錯誤流程:

註冊順序:
1. app.route('/*', catchAllHandler)     ← 攔截所有請求
2. app.route('/members', membersHandler) ← 永遠無法觸及
3. app.route('/health', healthHandler)   ← 永遠無法觸及

所有請求都被 /* 處理:
┌──────────────────────────────────────┐
│ GET /members  → /* (catchAll)        │
│ GET /health   → /* (catchAll)        │
│ GET /anything → /* (catchAll)        │
└──────────────────────────────────────┘
```

**修復方法**:
```typescript
// ✅ 正確順序：通配符最後註冊
app.route('/health', healthHandler);
app.route('/members', membersHandler);
app.route('/*', catchAllHandler);      // 最後
```

---

## 6. 快速修復流程

### ⚡ 3 分鐘快速修復指南

```
┌────────────────────────────────────────────────┐
│ 步驟 1: 識別錯誤 (30 秒)                      │
├────────────────────────────────────────────────┤
│ 運行: npm run check:routes                    │
│ 或查看瀏覽器 Network 標籤 400 錯誤            │
└────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────┐
│ 步驟 2: 定位代碼 (30 秒)                      │
├────────────────────────────────────────────────┤
│ 根據檢測報告的文件路徑和行號                  │
│ 跳轉到問題代碼位置                            │
│ VS Code: Ctrl+P → 輸入文件名:行號             │
└────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────┐
│ 步驟 3: 應用修復 (1 分鐘)                     │
├────────────────────────────────────────────────┤
│ 方法 A: 調整路由註冊順序                      │
│   • 具體路由移到前面                          │
│   • 參數化路由移到後面                        │
│                                                │
│ 方法 B: 移除重複定義                          │
│   • 刪除其中一個路由定義                      │
│   • 或合併到同一個處理器                      │
└────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────┐
│ 步驟 4: 驗證修復 (1 分鐘)                     │
├────────────────────────────────────────────────┤
│ 1. 再次運行: npm run check:routes             │
│ 2. 啟動開發伺服器測試                         │
│ 3. 瀏覽器中測試實際請求                       │
└────────────────────────────────────────────────┘
```

### 🔧 修復模板庫

#### 模板 1: 調整註冊順序

```typescript
// BEFORE (有問題)
const app = new Hono();
app.route('/', genericHandlers);    // 包含參數化路由
app.route('/specific', specificHandler); // 被攔截

// AFTER (已修復)
const app = new Hono();
// 1️⃣ 靜態路由先註冊
app.get('/health', healthHandler);

// 2️⃣ 具體路由接著註冊
app.route('/specific', specificHandler);
app.route('/another', anotherHandler);

// 3️⃣ 參數化路由最後註冊
app.route('/', genericHandlers);
```

#### 模板 2: 使用智能註冊器

```typescript
import { createSmartRegistry, RoutePriority } from '@/core/smart-route-registry';

const app = new Hono();
const registry = createSmartRegistry(app);

// 順序不重要！自動排序
registry.addMany([
  {
    path: '/',
    handler: genericHandlers,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Generic routes with :id patterns'
  },
  {
    path: '/specific',
    handler: specificHandler,
    priority: RoutePriority.SPECIFIC,
    description: 'Specific route handler'
  },
  {
    path: '/health',
    handler: healthHandler,
    priority: RoutePriority.STATIC,
    description: 'Health check endpoint'
  }
]);

// 自動按正確順序註冊
registry.register();
```

---

## 📊 附錄：錯誤速查表

### 快速診斷矩陣

| 症狀 | 可能原因 | 檢查位置 | 快速修復 |
|-----|---------|---------|---------|
| 400 "Invalid ID" | 參數路由攔截 | 檢測報告 MEDIUM | 調整順序 |
| 404 Not Found | 路由未註冊 | 檢測報告 | 添加路由 |
| 重複定義警告 | 同一路徑兩次註冊 | 檢測報告 HIGH | 移除重複 |
| 功能不生效 | 後註冊被忽略 | 終端日誌 | 檢查順序 |
| 所有請求 404 | 通配符過早 | 路由註冊代碼 | 移到最後 |

### 檢測命令速查

```bash
# 基礎檢測
npm run check:routes

# 監控模式（開發時）
npm run check:routes:watch

# CI/CD 模式（發現錯誤時失敗）
npm run check:routes:ci

# 完整驗證（配置 + 路由）
npm run precheck:all
```

### 常用文件路徑

| 文件 | 說明 | 路徑 |
|-----|------|------|
| 路由衝突檢測工具 | 靜態分析工具 | `scripts/detect-route-conflicts.ts` |
| 智能路由註冊器 | 自動排序系統 | `src/core/smart-route-registry.ts` |
| 完整使用指南 | 詳細文檔 | `docs/ROUTE_MANAGEMENT_GUIDE.md` |
| 視覺化方案 | 架構說明 | `docs/ROUTE_MANAGEMENT_SOLUTION.md` |

---

## ✅ 總結：視覺化查看路由錯誤的最佳實踐

### 開發流程中的檢查點

```
編寫代碼
   ↓
┌─────────────────────────────────┐
│ ✓ 運行檢測工具                  │
│   npm run check:routes          │
└─────────────────────────────────┘
   ↓
提交代碼
   ↓
┌─────────────────────────────────┐
│ ✓ Pre-commit Hook 自動檢測     │
│   (如已配置)                    │
└─────────────────────────────────┘
   ↓
本地測試
   ↓
┌─────────────────────────────────┐
│ ✓ 瀏覽器 DevTools 檢查          │
│   查看 Network 和 Console       │
└─────────────────────────────────┘
   ↓
部署到生產
   ↓
┌─────────────────────────────────┐
│ ✓ Cloudflare Logs 監控          │
│   查看實時日誌                  │
└─────────────────────────────────┘
```

### 推薦工具組合

| 階段 | 工具 | 使用頻率 | 優先級 |
|------|------|---------|--------|
| 開發 | `npm run check:routes` | 每次修改後 | ⭐⭐⭐⭐⭐ |
| 開發 | Chrome DevTools | 遇到錯誤時 | ⭐⭐⭐⭐ |
| 測試 | 本地終端日誌 | 啟動時檢查 | ⭐⭐⭐ |
| 生產 | Cloudflare Logs | 錯誤發生時 | ⭐⭐⭐⭐ |

---

**文件狀態**: ✅ 已完成
**最後更新**: 2025-01-20
**維護者**: Development Team
**版本**: 1.0.0
