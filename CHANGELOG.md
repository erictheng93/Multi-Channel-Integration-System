# 變更日誌 (Changelog)

所有值得注意的專案變更都將記錄在此文件中。

格式基於 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)，
並且本專案遵守 [語義化版本](https://semver.org/lang/zh-TW/)。

## [未發布] - 2025-10-20

### 重大變更 (Breaking Changes)

#### 角色系統簡化
- **簡化角色層級**：從 3 層（Admin/Team/Agent）簡化為 2 層（Admin/Agent）
  - 移除了 `team` 角色類型
  - 保留團隊功能（agents 仍可分配到團隊）
  - 資料庫遷移：`drizzle/0017_remove_team_role.sql`
  - 影響範圍：
    - 權限服務 (`src/services/permission-service.ts`)
    - 資料庫架構 (`src/db/schema.ts`)
    - 所有認證中介層
    - 前端權限檢查
    - 類型定義

### 修復 (Fixed)

#### 團隊管理 API 路徑修復
- **修正前端 API 路徑**：統一 `/team/` 改為 `/teams/`
  - 修復了 7 個團隊管理 API 端點路徑
  - 特別修復密碼重置端點：`/team/members/:id/reset-password-policy` → `/teams/members/:id/reset`
  - 受影響文件：
    - `frontend/src/api/team.ts`
    - `frontend/src/stores/team.ts`
    - `frontend/src/components/team/TeamMemberCard.vue`
    - `frontend/src/views/TeamManagement.vue`

#### 密碼管理處理器增強
- **新增 policy 參數支持**：`src/modules/teams/handlers/password.ts`
  - 支持密碼策略：`changeable` | `unchangeable` | `must_change`
  - 統一密碼重置端點：`POST /api/teams/members/:memberId/reset`
  - 返回更新後的策略信息

### 重構 (Refactored)

#### 團隊處理器模組化
- **拆分團隊處理器**：將 `src/handlers/team.ts` 重構為模組化結構
  - 新增 `src/modules/teams/handlers/invitations.ts` - 邀請管理
  - 新增 `src/modules/teams/handlers/members.ts` - 成員管理
  - 新增 `src/modules/teams/handlers/password.ts` - 密碼管理
  - 新增 `src/modules/teams/services/member-service.ts` - 成員服務層
  - 新增對應的類型定義文件

#### 路由系統改進
- **新增智能路由註冊系統**：`src/core/smart-route-registry.ts`
  - 改進路由衝突檢測
  - 更好的路由優先級管理
  - 新增路由衝突分析工具：`scripts/detect-route-conflicts.ts`

### 新增 (Added)

#### 文檔更新
- 新增 `VERIFICATION_REPORT.md` - 密碼重置功能修復驗證報告
- 新增 `docs/ROUTE_MANAGEMENT_GUIDE.md` - 路由管理指南
- 新增 `docs/ROUTE_MANAGEMENT_SOLUTION.md` - 路由管理解決方案
- 新增 `docs/ROUTE_ERROR_VISUALIZATION_GUIDE.md` - 路由錯誤可視化指南
- 新增 `scripts/route-conflict-analysis.md` - 路由衝突分析
- 新增 `scripts/route-conflict-fix-summary.md` - 路由衝突修復總結
- 新增 `scripts/team-handler-migration-plan.md` - 團隊處理器遷移計劃
- 新增 `scripts/team-handler-migration-summary.md` - 團隊處理器遷移總結

#### 工具腳本
- 新增 `scripts/route-conflict-detector.cjs` - 路由衝突檢測器
- 新增 `verify-fix.js` - 修復驗證腳本

### 移除 (Removed)

#### 清理舊文件
- 刪除 `frontend/CONTRAST_FIX_GUIDE.md` - 已過時的對比度修復指南
- 刪除 `src/handlers/team.ts` - 已重構為模組化結構

### 更新的文檔

#### 主要文檔更新
- **README.md**：更新所有角色系統描述（3 層 → 2 層）
  - 第 113 行：角色層級說明
  - 第 121 行：認證系統說明
  - 第 173 行：後端架構說明
  - 第 336 行：核心功能說明
  - 第 429 行：權限系統說明

- **CLAUDE.md**：更新專案指南
  - 更新角色系統說明為 2 層架構
  - 更新團隊管理章節
  - 新增路由註冊順序說明
  - 更新企業文檔章節

### 技術債務 (Technical Debt)

#### 待處理項目
- 需要更新舊的報告文檔中的角色系統描述
- 需要檢查測試覆蓋率是否包含新的模組化處理器
- 需要驗證生產環境部署後的功能完整性

### 遷移指南

#### 從 3 層角色系統遷移到 2 層

**資料庫遷移**：
```bash
npm run db:migrate
# 或針對生產環境
npm run db:migrate:prod
```

**程式碼更新**：
- 移除所有 `role === 'team'` 的檢查
- 更新角色類型定義：`'admin' | 'team' | 'agent'` → `'admin' | 'agent'`
- 團隊功能保持不變，只是角色層級簡化

**API 更新**：
- 前端需要更新所有使用 `/api/team/` 的端點為 `/api/teams/`
- 密碼重置 API 更改：使用 `/api/teams/members/:id/reset` 並傳入 `policy` 參數

### 相關連結

- [密碼重置功能修復驗證報告](./VERIFICATION_REPORT.md)
- [路由管理指南](./docs/ROUTE_MANAGEMENT_GUIDE.md)
- [團隊處理器遷移總結](./scripts/team-handler-migration-summary.md)

---

## [4.0.0] - 2025-10-19

### 新增
- WebSocket + Durable Objects 完整實現
- 100% WebSocket 即時通訊架構
- 生產級 Durable Objects 支持

### 改進
- 性能優化：P95 < 500ms
- 支持 1000+ 並發連接
- 完整的錯誤處理和重連機制

---

**注意**：本變更日誌遵循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/) 格式，
並從 2025-10-20 開始記錄。之前的版本歷史可在 git commit 記錄中查看。
