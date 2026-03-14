# Team Handler 遷移計劃

**目標**: 將所有舊版 team handler 函數遷移到模組化結構

**當前狀態**: 65% 已遷移 (13/20 功能)

> **注意**: 邀請系統已移除，改用直接添加成員的方式。

---

##  遷移清單

###  已遷移到模組化 handler

| 功能 | 舊版路由 | 新版路由 | 狀態 |
|------|---------|---------|------|
| 列出團隊 | - | GET /api/teams |  |
| 獲取團隊詳情 | - | GET /api/teams/:id |  |
| 創建團隊 | - | POST /api/teams |  |
| 更新團隊 | - | PUT /api/teams/:id |  |
| 刪除團隊 | - | DELETE /api/teams/:id |  |
| 獲取團隊成員 | - | GET /api/teams/:id/members |  |
| 添加團隊成員 | - | POST /api/teams/:id/members |  |
| QR Code 管理 | - | POST /api/teams/:id/qr-code |  |
| 團隊統計 | - | GET /api/teams/:id/stats |  |
| 獲取所有成員 | GET /api/teams/members | GET /api/teams/members |  (重複) |

###  待遷移函數

| # | 函數名 | 當前路由 | 功能描述 | 檔案位置 |
|---|--------|----------|----------|----------|
| 1 | `getTeamMembers` | GET /api/teams/members | 獲取所有團隊成員 | src/handlers/team.ts:48 |
| 2 | `addTeamMember` | POST /api/team/members | 添加成員到團隊 | src/handlers/team.ts:91 |
| 3 | `updateMemberStatus` | PUT /api/team/members/:id/status | 更新成員狀態 | src/handlers/team.ts:212 |
| 4 | `updateMemberRole` | PUT /api/team/members/:id/role | 更新成員角色 | src/handlers/team.ts:273 |
| 5 | `resetMemberPassword` | POST /api/team/members/:id/reset-password | 重置成員密碼 | src/handlers/team.ts:333 |
| 6 | `resetPasswordWithPolicy` | POST /api/team/members/:id/reset-password-policy | 帶策略重置密碼 | src/handlers/team.ts:360 |
| 7 | `changePassword` | POST /api/auth/change-password | 更改密碼 | src/handlers/team.ts:461 |
| 8 | `getMemberPassword` | GET /api/team/members/:id/password | 獲取成員密碼 | src/handlers/team.ts:570 |
| 9 | `updateMember` | PUT /api/team/members/:id | 更新成員信息 | src/handlers/team.ts:609 |
| 10 | `migratePasswords` | POST /api/team/migrate-passwords | 遷移密碼 (臨時) | src/handlers/team.ts:760 |
| 11 | `deleteMember` | DELETE /api/team/members/:id | 刪除成員 | src/handlers/team.ts:786 |

---

##  遷移策略

### 階段1: 成員管理端點 (Functions #2, #3, #4, #9, #11)

**目標文件**: `src/modules/teams/handlers/members.ts` (新建)

**遷移內容**:
- `addTeamMember` → 添加到特定團隊
- `updateMemberStatus` → 更新成員狀態 (active/inactive)
- `updateMemberRole` → 更新成員角色 (admin/team/agent)
- `updateMember` → 更新成員完整信息
- `deleteMember` → 刪除成員

**路由映射**:
```typescript
POST /api/teams/:teamId/members/:memberId/add // 從 addTeamMember
PUT /api/teams/:teamId/members/:memberId/status // 從 updateMemberStatus
PUT /api/teams/:teamId/members/:memberId/role // 從 updateMemberRole
PUT /api/teams/:teamId/members/:memberId // 從 updateMember
DELETE /api/teams/:teamId/members/:memberId // 從 deleteMember
```

---

### 階段2: 密碼管理端點 (Functions #5, #6, #7, #8)

**目標文件**: `src/modules/teams/handlers/password.ts` (新建)

**遷移內容**:
- `resetMemberPassword` → 管理員重置成員密碼
- `resetPasswordWithPolicy` → 帶策略的密碼重置
- `changePassword` → 用戶自行更改密碼
- `getMemberPassword` → 獲取成員密碼 ( 安全性檢查)

**路由映射**:
```typescript
POST /api/teams/members/:memberId/password/reset // resetMemberPassword
POST /api/teams/members/:memberId/password/reset-policy // resetPasswordWithPolicy
POST /api/auth/change-password // changePassword (保留)
GET  /api/teams/members/:memberId/password // getMemberPassword ()
```

---

### 階段3: 遷移工具端點 (Function #10)

**目標文件**: `src/modules/teams/handlers/migration.ts` (新建)

**遷移內容**:
- `migratePasswords` → 臨時密碼遷移工具

**路由映射**:
```typescript
POST /api/teams/admin/migrate-passwords  // migratePasswords
```

**注意**: 這是臨時端點，應該考慮在遷移完成後移除

---

### 階段4: 重複函數處理 (Function #1)

**處理方式**:
- `getTeamMembers` 已在模組化 handler 中實現
- 當前在 src/index.ts:300 使用舊版函數
- **解決方案**: 更新 index.ts 改用新版函數，刪除舊版

---

##  新文件結構

```
src/modules/teams/
├── handlers/
│ ├── team.ts 已存在 - 團隊CRUD + QR Code
│ ├── members.ts 已存在 - 成員管理
│ ├── password.ts 已存在 - 密碼管理
│ ├── migration.ts 新建 - 遷移工具 (臨時)
│ └── index.ts 已存在 - 導出所有 handlers
├── services/
│ ├── member-service.ts 已存在 - 成員業務邏輯
│ └── password-service.ts 新建 - 密碼業務邏輯
└── types/
    ├── member-types.ts 已存在 - 成員類型定義
    └── password-types.ts 新建 - 密碼類型定義
```

---

##  遷移步驟

### Step 1: 準備階段
- [x] 創建遷移計劃文檔
- [ ] 備份舊版 handler 文件
- [ ] 創建新的模組文件結構

### Step 2: 實施階段1 - 成員管理
- [ ] 創建 `src/modules/teams/handlers/members.ts`
- [ ] 創建 `src/modules/teams/services/member-service.ts`
- [ ] 創建 `src/modules/teams/types/member-types.ts`
- [ ] 遷移 5 個成員管理函數
- [ ] 更新 `src/modules/teams/handlers/index.ts`
- [ ] 更新 `src/index.ts` 路由註冊
- [ ] 測試所有成員管理端點

### Step 3: 實施階段2 - 密碼管理
- [ ] 創建 `src/modules/teams/handlers/password.ts`
- [ ] 創建 `src/modules/teams/services/password-service.ts`
- [ ] 創建 `src/modules/teams/types/password-types.ts`
- [ ] 遷移 4 個密碼管理函數
- [ ] 安全性審查 (getMemberPassword)
- [ ] 更新路由註冊
- [ ] 測試所有密碼管理端點

### Step 4: 清理階段
- [ ] 更新 src/index.ts:300 使用新版 getTeamMembers
- [ ] 從 src/handlers/team.ts 刪除已遷移函數
- [ ] 更新所有導入引用
- [ ] 運行完整測試套件
- [ ] 部署並驗證

---

##  注意事項

### 1. 向後兼容性
- **保持舊路由可用** 直到完全測試通過
- 可考慮添加路由別名實現平滑遷移

### 2. 安全性審查
- **getMemberPassword** - 需要仔細審查誰可以訪問密碼
- **密碼重置功能** - 確保適當的權限檢查
- **邀請系統** - 防止邀請濫用

### 3. 數據庫兼容性
- 確保所有 Drizzle ORM 查詢正確
- 驗證 Activity Service 記錄功能
- 檢查 WebSocket 廣播集成

### 4. 測試覆蓋
- 為每個新 handler 編寫單元測試
- 更新集成測試
- E2E 測試所有遷移的端點

---

##  預估時間

```
階段1 (成員管理): 4-6 小時
階段2 (密碼管理): 3-4 小時
階段3 (遷移工具): 1-2 小時
階段4 (清理): 2-3 小時
測試 & 部署: 3-4 小時
─────────────────────────────
總計: 13-19 小時 (2 個工作日)
```

---

##  成功標準

- [ ] 所有 11 個舊函數已遷移
- [ ] src/handlers/team.ts 僅保留臨時兼容代碼
- [ ] 所有路由測試通過
- [ ] 無回歸錯誤
- [ ] 文檔已更新
- [ ] 代碼審查通過
- [ ] 生產環境部署成功

---

**準備開始遷移？**

請確認優先執行哪個階段，我會立即開始實施！
