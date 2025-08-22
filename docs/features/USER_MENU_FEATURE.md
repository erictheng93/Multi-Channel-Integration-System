# 用戶菜單功能說明

## ✅ 已實現的功能

### 1. 用戶下拉菜單
在 `AppLayout.vue` 的側邊欄底部，用戶配置文件區域現在包含：

- **用戶頭像**：顯示用戶姓名的首字母
- **用戶信息**：顯示用戶姓名和角色
- **下拉箭頭**：點擊可展開/收起菜單

### 2. 菜單選項
下拉菜單包含以下選項：

- **個人資料** 👤：查看和編輯個人信息（待實現）
- **修改密碼** 🔑：修改登入密碼（待實現）
- **分隔線**
- **登出** 🚪：安全登出系統

### 3. 交互功能

#### 菜單展開/收起
- 點擊用戶配置文件區域或箭頭圖標展開菜單
- 點擊外部區域自動收起菜單
- 箭頭圖標會根據菜單狀態旋轉

#### 登出功能
- 點擊登出選項會顯示確認對話框
- 確認後執行以下操作：
  1. 調用後端登出 API
  2. 清除本地存儲的認證信息
  3. 清除認證狀態
  4. 重定向到登入頁面

#### 響應式設計
- 在側邊欄收起狀態下，用戶菜單會隱藏
- 只顯示用戶頭像，保持簡潔

## 🎨 視覺設計

### 樣式特點
- **現代化設計**：圓角、陰影、漸變效果
- **平滑動畫**：菜單展開/收起有滑動動畫
- **懸停效果**：菜單項有懸停高亮效果
- **顏色區分**：登出選項使用紅色主題

### 圖標使用
- **ChevronUpIcon**：下拉箭頭
- **UserIcon**：個人資料
- **KeyIcon**：修改密碼
- **LogoutIcon**：登出

## 🔧 技術實現

### 組件結構
```vue
<div class="user-profile" @click="toggleUserMenu()">
  <div class="user-avatar">{{ userInitials }}</div>
  <div class="user-info">
    <div class="user-name">{{ authStore.currentAgent?.name }}</div>
    <div class="user-role">{{ authStore.currentAgent?.role }}</div>
  </div>
  <button class="user-menu-btn">
    <ChevronUpIcon :class="{ 'rotated': showUserMenu }" />
  </button>
</div>

<div v-if="showUserMenu" class="user-menu">
  <div class="user-menu-item" @click="viewProfile">個人資料</div>
  <div class="user-menu-item" @click="changePassword">修改密碼</div>
  <div class="user-menu-divider"></div>
  <div class="user-menu-item logout" @click="handleLogout">登出</div>
</div>
```

### 狀態管理
```typescript
const showUserMenu = ref(false)

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
}

const handleLogout = async () => {
  if (confirm('確定要登出嗎？')) {
    await authStore.logout()
  }
}
```

### 事件處理
- **點擊外部關閉**：使用 `document.addEventListener('click', handleClickOutside)`
- **防止事件冒泡**：使用 `@click.stop` 防止意外觸發

## 🚀 使用方法

### 登出操作
1. 點擊側邊欄底部的用戶配置文件區域
2. 在下拉菜單中點擊「登出」
3. 在確認對話框中點擊「確定」
4. 系統會自動清除認證信息並跳轉到登入頁面

### 可用憑證測試
- **管理員**：admin@dacit.net / 16011587DaC
- **客服**：dacagent@dacit.net / agent16011587

## 📋 待實現功能

### 1. 個人資料頁面
- 查看用戶基本信息
- 編輯用戶姓名、郵箱等
- 上傳用戶頭像

### 2. 修改密碼功能
- 驗證當前密碼
- 設置新密碼
- 密碼強度檢查

### 3. 更好的確認對話框
- 使用自定義模態框替代 `confirm()`
- 更好的視覺設計和用戶體驗

## 🔒 安全考慮

- 登出時會調用後端 API 使 token 失效
- 清除所有本地存儲的敏感信息
- 確認對話框防止意外登出
- 登出失敗時會顯示錯誤提示

## 📱 響應式支持

- 在移動設備上菜單會適應屏幕大小
- 側邊欄收起時菜單會隱藏
- 觸摸設備上的交互體驗優化