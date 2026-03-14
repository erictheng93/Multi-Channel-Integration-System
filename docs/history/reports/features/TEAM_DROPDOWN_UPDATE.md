#  人員管理 - 群組下拉式選單更新

##  (Core Concept Overview)

### 更新目標
將人員管理中的「群組」欄位從**文字輸入框**改為**下拉式選單**,讓管理員可以直接選擇現有的團隊,而不需要手動輸入。

### 視覺化變更
```
Before (舊版): After (新版):
┌─────────────────────┐ ┌─────────────────────┐
│ 群組 (可選) │          │ 群組 (可選) ▼ │
│ ┌─────────────────┐ │ │ ┌─────────────────┐ │
│ │ 請輸入群組名稱  │ │ →     │ │ 未指派群組 │ │
│ └─────────────────┘ │ │ │ 業務團隊 │ │
│ [手動輸入] │          │ │ 客服團隊 │ │
└─────────────────────┘ │ └─────────────────┘ │
                                 │ [點選選擇] │
                                 └─────────────────────┘
```

---

## / (Solution/Concept Details)

### 修改的文件

#### 1️ **TeamMemberCard.vue** (編輯成員模態框)
 位置: `frontend/src/components/team/TeamMemberCard.vue`

**新增功能:**
-  導入 `teamApi` 從 `@/api/team`
-  添加 `teams` ref 來存儲團隊列表
-  實現 `loadTeams()` 函數獲取活躍團隊
-  在模態框打開時自動載入團隊列表
-  將群組輸入框改為 `<select>` 下拉式選單

**程式碼變更:**
```typescript
// 新增團隊列表狀態
const teams = ref<Array<{
  id: number;
  name: string;
  isActive: boolean;
}>>([])

// 載入團隊列表函數
const loadTeams = async () => {
  try {
    const response = await teamApi.getTeams(false) // 只獲取活躍的團隊
    if (response.success && response.data) {
      teams.value = response.data.filter(team => team.isActive)
    }
  } catch (error) {
    console.error('獲取團隊列表失敗:', error)
  }
}

// 模態框打開時自動載入
watch(() => showEditModal.value, async (newVal) => {
  if (newVal) {
    // ... 其他初始化邏輯
    await loadTeams() //  新增
  }
})
```

**HTML 模板變更:**
```vue
<!-- Before: 文字輸入框 -->
<input
  id="editGroup"
  v-model="editForm.group"
  type="text"
  placeholder="請輸入群組名稱"
>

<!-- After: 下拉式選單 -->
<select
  id="editGroup"
  v-model="editForm.group"
>
  <option value="">未指派群組</option>
  <option
    v-for="team in teams"
    :key="team.id"
    :value="team.name"
  >
    {{ team.name }}
  </option>
</select>
```

---

#### 2️ **TeamManagement.vue** (新增成員模態框)
 位置: `frontend/src/views/TeamManagement.vue`

**修改內容:**
-  將新增成員模態框中的群組輸入框改為下拉式選單
-  使用現有的 `teams` 狀態 (頁面已有團隊列表)

**HTML 模板變更:**
```vue
<!-- Before: 文字輸入框 -->
<input
  id="group"
  v-model="addMemberForm.group"
  type="text"
  placeholder="請輸入群組名稱"
>

<!-- After: 下拉式選單 -->
<select
  id="group"
  v-model="addMemberForm.group"
>
  <option value="">未指派群組</option>
  <option
    v-for="team in teams"
    :key="team.id"
    :value="team.name"
  >
    {{ team.name }}
  </option>
</select>
```

---

## (Specific Examples)

### 使用場景 1: 編輯現有成員
```
操作流程:
1. 管理員進入「團隊管理」頁面
2. 點擊任一成員卡片開啟編輯模態框
3. 在「群組」下拉式選單中:
   - 看到「未指派群組」選項
   - 看到所有活躍團隊的列表
   - 點選任一團隊名稱進行指派
4. 點擊「更新」按鈕儲存變更

視覺化:
┌──────────────────────────────────┐
│  編輯成員資訊 │
├──────────────────────────────────┤
│  姓名: [張三 ]     │
│  電子郵件: [zhang@example.com]  │
│  角色: [客服 ▼] │
│  群組: [業務團隊 ▼]  ← │
│ ├ 未指派群組 │
│ ├  業務團隊 │
│ └─ 客服團隊 │
│ 帳戶啟用狀態 │
├──────────────────────────────────┤
│ [取消] [更新] │
└──────────────────────────────────┘
```

### 使用場景 2: 新增成員
```
操作流程:
1. 管理員點擊「新增成員」按鈕
2. 填寫基本資訊(電子郵件、姓名、密碼、角色)
3. 在「群組」下拉式選單中選擇要指派的團隊
4. 點擊「新增成員」按鈕完成新增

視覺化:
┌──────────────────────────────────┐
│  新增系統人員 │
├──────────────────────────────────┤
│  電子郵件*: [user@example.com]  │
│  姓名: [李四 ]     │
│  密碼*: [•••••• ]  │
│  角色*: [客服 ▼] │
│  群組: [客服團隊 ▼]  ← │
│ ├ 未指派群組 │
│ ├ 業務團隊 │
│ └─  客服團隊 │
│ 立即啟用帳戶 │
├──────────────────────────────────┤
│ [取消] [新增成員] │
└──────────────────────────────────┘
```

---

## (Pros/Cons Comparison)

### 優點 (Pros) 

| 功能面向 | 優點說明 |
|---------|---------|
| **使用者體驗** | 不需要記憶團隊名稱,直接從列表選擇 |
| **資料一致性** | 避免輸入錯誤的團隊名稱或拼寫差異 |
| **效率提升** | 減少輸入時間,點選即可完成指派 |
| **視覺清晰** | 清楚看到所有可用的團隊選項 |
| **錯誤預防** | 防止創建不存在的團隊名稱 |

### 注意事項 (Considerations) 

| 項目 | 說明 | 解決方案 |
|------|------|---------|
| **網路延遲** | 編輯模態框打開時需要載入團隊列表 | 使用快取機制,團隊列表通常不會頻繁變動 |
| **空列表** | 如果沒有任何團隊,下拉選單只有「未指派群組」 | 這是正常行為,提示管理員先創建團隊 |
| **大量團隊** | 如果團隊數量很多,下拉選單可能會很長 | 目前團隊數量不多,未來可考慮加入搜尋功能 |

---

## (Implementation Suggestions)

### 測試步驟 

#### 步驟 1: 啟動開發環境
```bash
# Terminal 1 - 啟動後端 (如果尚未啟動)
npm run dev

# Terminal 2 - 啟動前端
cd frontend
npm run dev
```

#### 步驟 2: 瀏覽器測試
```
1. 開啟瀏覽器: http://localhost:3001
2. 登入系統 (使用管理員帳號)
3. 進入「團隊管理」頁面 (/team)
```

#### 步驟 3: 測試編輯成員功能
```
測試清單:
□ 點擊任一成員卡片,開啟編輯模態框
□ 確認「群組」欄位是下拉式選單
□ 確認看到「未指派群組」選項
□ 確認看到所有活躍團隊的列表
□ 選擇一個團隊並儲存
□ 確認更新成功且群組顯示正確
```

#### 步驟 4: 測試新增成員功能
```
測試清單:
□ 點擊「新增成員」按鈕
□ 填寫必要資訊
□ 確認「群組」欄位是下拉式選單
□ 選擇一個團隊
□ 提交表單並確認新增成功
□ 檢查新成員的群組是否正確指派
```

---

### 驗證結果 

#### TypeScript 類型檢查
```bash
 npm run type-check
> vue-tsc --noEmit
# 通過,無錯誤
```

#### ESLint 程式碼檢查
```bash
 npm run lint:check
> eslint . --ext .vue,.js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts
# 通過,無警告
```

#### 前端開發伺服器
```bash
 npm run dev
  VITE v7.1.5  ready in 723 ms
    Local: http://localhost:3001/
# 成功啟動
```

---

##  數據流程圖

```
使用者操作流程:
┌─────────────────┐
│  點擊編輯成員 │
└────────┬────────┘
         ↓
┌─────────────────┐
│ 開啟編輯模態框  │ ← watch() 偵測到 showEditModal = true
└────────┬────────┘
         ↓
┌─────────────────┐
│  調用 loadTeams │
└────────┬────────┘
         ↓
┌─────────────────┐
│ teamApi.getTeams│ → API: GET /teams
└────────┬────────┘
         ↓
┌─────────────────┐
│ 過濾活躍團隊 │ → teams.value = [...活躍團隊]
└────────┬────────┘
         ↓
┌─────────────────┐
│ 渲染下拉選單 │ → v-for="team in teams"
└────────┬────────┘
         ↓
┌─────────────────┐
│ 使用者選擇團隊  │ → v-model="editForm.group"
└────────┬────────┘
         ↓
┌─────────────────┐
│  提交表單更新 │ → teamStore.updateMember()
└─────────────────┘
```

---

##  技術細節

### API 端點
- **獲取團隊列表**: `GET /teams?includeInactive=false`
- **回應格式**:
  ```typescript
  {
    success: true,
    data: [
      {
        id: 1,
        name: "業務團隊",
        isActive: true,
        description: "負責業務相關工作",
        // ...
      },
      // ...
    ]
  }
  ```

### 狀態管理
- **TeamMemberCard.vue**:
  - 本地狀態: `teams` ref
  - 模態框打開時非同步載入

- **TeamManagement.vue**:
  - 使用現有的 `teams` ref (頁面層級)
  - 頁面載入時已經獲取團隊列表

---

##  總結

### 完成項目
 修改 TeamMemberCard.vue 編輯模態框
 修改 TeamManagement.vue 新增成員模態框
 整合團隊 API 獲取下拉選單資料
 TypeScript 類型檢查通過
 ESLint 程式碼檢查通過
 前端開發伺服器成功啟動

### 使用者體驗改善
-  **直覺性**: 點選選擇,不需要手動輸入
-  **效率**: 快速指派團隊,減少錯誤
-  **一致性**: 避免團隊名稱拼寫差異
-  **可見性**: 清楚顯示所有可用團隊

---

 更新日期: 2025-10-23
 實施者: Claude Code
 狀態: 完成並可供測試
