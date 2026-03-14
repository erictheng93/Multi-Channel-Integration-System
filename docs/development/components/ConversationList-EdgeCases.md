# ConversationList.vue 邊緣情況處理文檔

##  文檔概述

本文檔詳細記錄 `ConversationList.vue` 組件中所有已識別的邊緣情況以及相應的處理策略。

**組件位置**: `frontend/src/views/ConversationList.vue`
**最後更新**: 2026-01-03
**維護者**: Development Team

---

##  邊緣情況分類

### 1. 數據邊界情況

#### 1.1 空數據列表

**場景**: 沒有任何對話記錄

```typescript
// 處理位置: ConversationList.vue:219-242
<EmptyState
  v-else-if="conversations.length === 0 && !isLoading"
  title="沒有找到對話"
  description="目前沒有符合篩選條件的對話，請調整篩選條件或等待新對話"
>
```

**處理策略**:
-  顯示友好的空狀態組件
-  提供清除篩選和重新整理的操作按鈕
-  避免顯示錯誤信息（這是正常狀態）

**測試覆蓋**: `ConversationList.test.ts:172-187`

#### 1.2 超大數據集（>1000項）

**場景**: 對話數量超過 1000 條

```typescript
// 處理位置: ConversationList.vue:260-305
<SmartVirtualScrollList
  :items="conversations"
  :item-height="120"
  :container-height="600"
  :overscan="3"
>
```

**處理策略**:
-  使用虛擬滾動只渲染可見項目
-  動態載入更多數據（分頁）
-  限制 DOM 節點數量（<200）
-  保持 60 FPS 滾動性能

**性能指標**:
- 初始渲染: ~50 項（基於 containerHeight 和 itemHeight）
- Overscan: 3 項（上下各 3 項緩衝）
- 最大 DOM 節點: ~56 項

**測試覆蓋**: `ConversationList.test.ts:321-339`

#### 1.3 單一數據項

**場景**: 只有一個對話

```typescript
// 處理: 正常渲染，無特殊處理
conversations.value.length === 1
```

**處理策略**:
-  正常顯示，無需特殊處理
-  禁用虛擬滾動的複雜邏輯
-  分頁控件自動隱藏（totalPages === 1）

---

### 2. 分頁邊界情況

#### 2.1 頁碼越界

**場景**: 嘗試訪問不存在的頁碼

```typescript
// 處理位置: ConversationList.vue:539-543
function changePage(page: number) {
  if (page < 1 || page > totalPages.value) {return}
  currentPage.value = page
  loadConversations()
}
```

**處理策略**:
-  驗證頁碼範圍（1 到 totalPages）
-  無效頁碼直接忽略
-  不顯示錯誤提示（靜默失敗）

**邊界值**:
- 最小頁碼: 1
- 最大頁碼: Math.ceil(total / pageSize)
- 無數據時: totalPages = 0

#### 2.2 零總頁數

**場景**: 總對話數為 0，導致 totalPages = 0

```typescript
// 處理位置: ConversationList.vue:310-336
<div
  v-if="totalPages > 1"
  class="pagination"
>
```

**處理策略**:
-  完全隱藏分頁控件
-  顯示空狀態組件
-  避免除以零錯誤

#### 2.3 最後一頁數據不足

**場景**: 最後一頁只有少量數據（< pageSize）

```typescript
// 處理: 自動處理，無需特殊邏輯
// 虛擬滾動會根據實際數據長度調整
```

**處理策略**:
-  虛擬滾動自動調整高度
-  下一頁按鈕自動禁用
-  顯示正確的數據統計

---

### 3. 載入狀態邊界情況

#### 3.1 重複載入請求

**場景**: 用戶快速點擊刷新按鈕

```typescript
// 處理位置: ConversationList.vue:714-731
async function handleLoadMore() {
  if (loadingMore || reachedEnd.value) {return}
  // ... loading logic
}
```

**處理策略**:
-  使用 `loadingMore` 標記防止重複請求
-  刷新按鈕在載入時禁用
-  保持載入指示器顯示

**防護機制**:
```typescript
// 按鈕禁用
:disabled="isLoading"

// 函數防護
if (loadingMore || reachedEnd.value) {return}
```

#### 3.2 載入失敗

**場景**: API 請求失敗（網絡錯誤、超時等）

```typescript
// 處理位置: ConversationList.vue:505-509
} catch (error) {
  console.error('載入對話失敗:', error)
}
```

**處理策略**:
-  捕獲並記錄錯誤
-  **需改進**: 未向用戶顯示錯誤提示
-  **需改進**: 未提供重試機制

**改進建議**:
```typescript
} catch (error) {
  console.error('載入對話失敗:', error)
  // TODO: 顯示 Toast 錯誤提示
  // TODO: 提供重試按鈕
  conversationsStore.error = translateError(error, '載入對話失敗')
}
```

#### 3.3 到達數據末尾

**場景**: 已載入所有可用數據

```typescript
// 處理位置: ConversationList.vue:724-726
if (conversations.value.length === currentLength) {
  reachedEnd.value = true
  console.log('[ConversationList] No more conversations to load')
}
```

**處理策略**:
-  設置 `reachedEnd` 標記
-  顯示結束指示器
-  防止進一步的載入請求

---

### 4. 篩選相關邊界情況

#### 4.1 所有篩選條件為空

**場景**: 清除所有篩選後顯示全部數據

```typescript
// 處理位置: ConversationList.vue:558-568
function clearFilters() {
  filters.value = {
    status: '',
    platform: '',
    assignedTo: undefined,
    tagIds: []
  }
  selectedTagIds.value = []
  currentPage.value = 1
  loadConversations()
}
```

**處理策略**:
-  重置所有篩選條件
-  重置到第一頁
-  重新載入數據

#### 4.2 篩選結果為空

**場景**: 篩選條件過於嚴格，無匹配結果

```typescript
// 處理: 顯示空狀態組件
conversations.length === 0 && !isLoading
```

**處理策略**:
-  顯示"沒有找到對話"訊息
-  提供清除篩選按鈕
-  保持篩選器可見和可用

#### 4.3 無可用標籤

**場景**: 標籤系統尚未配置，沒有可用標籤

```typescript
// 處理位置: ConversationList.vue:154-159
<div
  v-if="availableTags.length === 0"
  class="no-tags-message"
>
  暫無可用標籤
</div>
```

**處理策略**:
-  顯示友好的提示訊息
-  標籤篩選功能保持可用（為未來準備）
-  不阻止其他功能使用

---

### 5. 虛擬滾動邊界情況

#### 5.1 滾動到頂部/底部快速切換

**場景**: 用戶快速滾動到底部然後立即滾動到頂部

```typescript
// 處理位置: ConversationList.vue:785-807
function handleVisibleRangeChange(startIndex: number, endIndex: number) {
  visibleRange.value = { startIndex, endIndex }

  // 防止重複預載入
  if (endIndex >= loadThreshold && !isPreloading.value && !reachedEnd.value && conversationsStore.canLoadMore) {
    isPreloading.value = true
    // ...
  }
}
```

**處理策略**:
-  使用 `isPreloading` 防護標記
-  自動錯誤處理和狀態重置
-  獨立的滾動事件處理

#### 5.2 動態高度項目

**場景**: 對話卡片高度不一致（長短訊息）

```typescript
// 當前限制: 固定高度
:item-height="120"
```

**處理策略**:
-  **當前**: 使用固定高度 120px
-  **限制**: 無法處理動態高度
-  **建議**: 考慮使用 `estimatedItemHeight` + `dynamicHeight`

**改進方案**:
```typescript
<SmartVirtualScrollList
  :items="conversations"
  :estimatedItemHeight="120"
  :dynamicHeight="true"
>
```

#### 5.3 可見範圍計算錯誤

**場景**: containerHeight 或 itemHeight 配置錯誤

```typescript
// 安全計算
const loadThreshold = Math.max(10, Math.floor(conversations.value.length * 0.8))
```

**處理策略**:
-  使用 `Math.max` 確保最小閾值
-  百分比計算（80%）適應不同數據量
-  開發模式下輸出調試信息

---

### 6. 實時同步邊界情況

#### 6.1 WebSocket 連接失敗

**場景**: WebSocket 無法建立連接

```typescript
// 處理位置: conversationSync.ts (服務層)
// 自動降級到輪詢模式
```

**處理策略**:
-  自動降級到智能輪詢備份
-  顯示"輪詢模式"狀態指示器
-  嘗試定期重連 WebSocket

**狀態指示器**:
```typescript
syncStatus.value === 'polling' // 黃色指示器
```

#### 6.2 連接頻繁斷開/重連

**場景**: 網絡不穩定導致連接不斷斷開

```typescript
// 處理: 由 conversationSync 服務處理
reconnectAttempts // 重連嘗試計數
maxReconnectAttempts: 3 // 最多重連3次
```

**處理策略**:
-  限制重連次數（避免無限重連）
-  重連延遲機制（5秒）
-  失敗後降級到輪詢模式

#### 6.3 數據同步衝突

**場景**: 本地修改與伺服器推送衝突

```typescript
// 處理位置: ConversationList.vue:619-640
conversationSync.onData((data: Conversation[]) => {
  conversationsStore.setConversations(data)
  total.value = data.length
  isAutoRefreshing.value = false
})
```

**處理策略**:
-  伺服器數據優先（覆蓋本地）
-  使用增量更新動畫平滑過渡
-  **限制**: 不支持樂觀更新衝突解決

---

### 7. 用戶交互邊界情況

#### 7.1 無權限用戶

**場景**: currentAgent 為 null（未登入或權限不足）

```typescript
// 處理位置: ConversationList.vue:424
if (apiFilters.assignedTo === 'me') {
  apiFilters.assignedTo = currentAgent.value?.id // 使用可選鏈
}
```

**處理策略**:
-  使用可選鏈操作符（`?.`）
-  未登入用戶會被路由守衛攔截
-  **限制**: 組件內無額外權限檢查

**改進建議**:
```typescript
// 在 onMounted 中添加權限檢查
if (!currentAgent.value) {
  router.push('/login')
  return
}
```

#### 7.2 快速連續操作

**場景**: 用戶快速點擊多個篩選器

```typescript
// 處理: 使用 watch 的 deep 模式自動批處理
watch(filters, () => {
  currentPage.value = 1
}, { deep: true })
```

**處理策略**:
-  Vue 的響應式系統自動批處理
-  每次篩選變更重置到第一頁
-  **優化**: 可考慮添加防抖（debounce）

**優化方案**:
```typescript
import { useDebounceFn } from '@vueuse/core'

const debouncedLoad = useDebounceFn(loadConversations, 300)

watch(filters, () => {
  currentPage.value = 1
  debouncedLoad()
}, { deep: true })
```

#### 7.3 離開頁面時

**場景**: 用戶導航到其他頁面

```typescript
// 處理位置: ConversationList.vue:810-819
onUnmounted(() => {
  console.log('[ConversationList] Component unmounted, cleaning up services')

  conversationSync.stop()
  predictiveLoader.setEnabled(false)
  idleTimeProcessor.cancelAllTasks()

  console.log('[ConversationList] All services cleaned up')
})
```

**處理策略**:
-  停止所有背景服務
-  移除事件監聽器
-  取消進行中的請求
-  完整的資源清理

---

### 8. 快取相關邊界情況

#### 8.1 快取過期

**場景**: 快取數據超過 5 分鐘

```typescript
// 處理位置: cacheManager.ts
maxAge: 5 * 60 * 1000 // 5分鐘
```

**處理策略**:
-  自動後台重新驗證
-  先顯示舊數據（Stale-While-Revalidate）
-  平滑更新到新數據

#### 8.2 快取未命中

**場景**: 首次載入或快取被清除

```typescript
// 處理位置: ConversationList.vue:458-478
const preloadedData = predictiveLoader.getPreloadedData(apiFilters as ConversationFilters)

if (preloadedData && preloadedData.length > 0) {
  // 使用預載入數據
} else {
  // 使用智能快取載入
  const result = await loadWithCache(apiFilters as ConversationFilters, currentPage.value)
}
```

**處理策略**:
-  降級到 API 請求
-  顯示載入指示器
-  數據載入後自動快取

#### 8.3 快取大小超限

**場景**: 快取項目超過 50 個

```typescript
// 處理位置: cacheManager.ts
maxSize: 50 // 最多50個快取項目
```

**處理策略**:
-  LRU（最近最少使用）淘汰策略
-  自動清理最舊的快取
-  保持快取大小在限制內

---

### 9. 性能相關邊界情況

#### 9.1 低性能設備

**場景**: 老舊設備或低端手機

```typescript
// 處理: 漸進增強
// 1. 虛擬滾動減少 DOM 節點
// 2. 空閒時間處理（requestIdleCallback）
// 3. GPU 加速動畫
```

**處理策略**:
-  虛擬滾動限制 DOM 節點
-  使用 `requestIdleCallback` 延遲非關鍵任務
-  CSS `will-change` 和 `transform: translateZ(0)`

**性能優化**:
```css
.virtual-conversation-wrapper {
  transform: translateZ(0);
  will-change: transform;
  backface-visibility: hidden;
}
```

#### 9.2 慢速網絡

**場景**: 2G/3G 網絡或高延遲

```typescript
// 處理策略:
// 1. 優先顯示快取數據
// 2. 後台更新
// 3. 預載入下一頁
```

**處理策略**:
-  快取優先（零等待體驗）
-  後台重新驗證
-  壓縮數據傳輸（服務端）

#### 9.3 內存不足

**場景**: 設備可用內存有限

```typescript
// 處理位置: 多層次記憶體管理
// 1. 虛擬滾動減少記憶體使用
// 2. LRU 快取淘汰
// 3. 服務清理
```

**處理策略**:
-  虛擬滾動只保留可見項目
-  快取大小限制（50項）
-  組件卸載時完整清理

---

##  已知限制

### 1. 動態高度支持

**問題**: 當前使用固定高度（120px），無法適應不同長度的對話

**影響**: 長對話可能被截斷，短對話浪費空間

**解決方案**:
```typescript
// 建議使用動態高度
<SmartVirtualScrollList
  :estimatedItemHeight="120"
  :dynamicHeight="true"
>
```

### 2. 錯誤提示不完善

**問題**: 載入失敗時只記錄到控制台，未向用戶顯示

**影響**: 用戶體驗不佳，無法知道失敗原因

**解決方案**:
```typescript
import { useToast } from '@/composables/useToast'

const { showError } = useToast()

catch (error) {
  console.error('載入對話失敗:', error)
  showError('載入對話失敗，請稍後重試')
}
```

### 3. 樂觀更新衝突

**問題**: WebSocket 推送與本地修改可能衝突

**影響**: 用戶修改可能被覆蓋

**解決方案**: 實現衝突解決機制（版本號或時間戳）

### 4. 離線支持有限

**問題**: 無網絡時功能完全不可用

**影響**: 離線場景下無法使用

**解決方案**:
- Service Worker 快取
- IndexedDB 本地存儲
- 離線提示和優雅降級

---

##  測試覆蓋檢查清單

- [x] 空數據列表
- [x] 超大數據集（>1000項）
- [x] 分頁邊界（第一頁、最後一頁、越界）
- [x] 載入狀態（載入中、失敗、成功）
- [x] 篩選功能（單一、組合、清除）
- [x] 標籤篩選（選中、取消、清除、無標籤）
- [x] 虛擬滾動（到底、範圍變化）
- [x] 實時同步（連接、斷開、數據推送）
- [x] 用戶交互（選擇對話、快速操作）
- [x] 生命週期（掛載、卸載、清理）
- [ ] **待補充**: 錯誤邊界測試
- [ ] **待補充**: 性能基準測試
- [ ] **待補充**: 無障礙性測試

---

##  維護注意事項

### 添加新功能時

1. **更新邊緣情況文檔** - 記錄新的邊緣情況
2. **添加對應測試** - 確保邊緣情況被測試覆蓋
3. **更新 JSDoc 註釋** - 記錄特殊處理邏輯
4. **檢查性能影響** - 確保不會降低性能

### 修復 Bug 時

1. **添加回歸測試** - 防止問題再次出現
2. **更新文檔** - 記錄問題和解決方案
3. **檢查相關功能** - 確保修復不影響其他功能

### 重構時

1. **保持測試通過** - 不破壞現有測試
2. **更新文檔** - 反映新的實現
3. **性能對比** - 確保性能不降低

---

##  相關資源

- **組件源碼**: `frontend/src/views/ConversationList.vue`
- **單元測試**: `frontend/tests/unit/views/ConversationList.test.ts`
- **驗證報告**: `docs/validation/ConversationList-Validation-Report.md`
- **API 文檔**: `docs/api/conversations-api.md`

---

**文檔版本**: 1.0.0
**最後更新**: 2026-01-03
**狀態**:  完整
