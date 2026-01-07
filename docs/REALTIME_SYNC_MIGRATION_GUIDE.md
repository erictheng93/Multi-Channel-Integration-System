# 实时同步 API 迁移指南

## 📌 概述

**方案 B 阶段 2** 已完成 - WebSocket 实时同步逻辑已从独立服务整合到 `conversationsStore`。

- ✅ **新实现：** `frontend/src/stores/conversations.ts`
- ⚠️ **已废弃：** `frontend/src/services/conversationSync.ts`
- ⚠️ **已废弃：** `frontend/src/composables/conversation/useConversationSync.ts`

---

## 🔄 迁移对比

### 旧 API (已废弃)

```typescript
// ❌ 旧用法 - 使用 conversationSync 服务
import { conversationSync } from '@/services/conversationSync'
import { useConversationsStore } from '@/stores/conversations'

const store = useConversationsStore()

onMounted(() => {
  // 设置数据更新回调
  conversationSync.onData((updatedConversations) => {
    store.setConversations(updatedConversations)
  })

  // 设置状态回调
  conversationSync.onStatus((status) => {
    console.log('Sync status:', status)
  })

  // 启动服务
  conversationSync.start()
})

onUnmounted(() => {
  conversationSync.stop()
})
```

### 新 API (推荐)

```typescript
// ✅ 新用法 - Store 内部管理 WebSocket
import { useConversationsStore } from '@/stores/conversations'

const store = useConversationsStore()

onMounted(() => {
  // 只需一行代码
  store.initializeRealtime()
})

onUnmounted(() => {
  store.cleanup()
})

// 访问连接状态（响应式）
watch(() => store.syncStatus, (status) => {
  console.log('Sync status:', status)
})

// 对话数据自动更新（无需手动回调）
const conversations = computed(() => store.conversations)
```

---

## 📋 迁移步骤

### 步骤 1: 更新导入

```typescript
// 删除
import { conversationSync } from '@/services/conversationSync'
import { useConversationSync } from '@/composables/conversation/useConversationSync'

// 已经有的保留
import { useConversationsStore } from '@/stores/conversations'
```

### 步骤 2: 移除旧的回调设置

```typescript
// ❌ 删除这些代码
conversationSync.onData((data) => { /* ... */ })
conversationSync.onStatus((status) => { /* ... */ })
```

### 步骤 3: 简化生命周期代码

```typescript
// ✅ 替换为
onMounted(() => {
  conversationsStore.initializeRealtime()
})

onUnmounted(() => {
  conversationsStore.cleanup()
})
```

### 步骤 4: 使用响应式状态

```typescript
// ✅ 直接使用 Store 的响应式状态
const conversations = computed(() => store.conversations)
const syncStatus = computed(() => store.syncStatus)
const isConnected = computed(() =>
  syncStatus.value === 'connected' || syncStatus.value === 'polling'
)
```

---

## 🗂️ 文件迁移清单

需要迁移的文件（按优先级）：

### 🔴 高优先级（核心功能）
- [x] `frontend/src/views/ConversationsTable.vue` - ✅ 已迁移（阶段 1）
- [ ] `frontend/src/views/ConversationList.vue` - 待迁移
- [ ] `frontend/src/components/conversation-list/ConversationHeader.vue` - 待迁移

### 🟡 中优先级（UI 组件）
- [ ] `frontend/src/components/conversation-list/SyncStatusIndicator.vue` - 待迁移

### 🟢 低优先级（诊断工具）
- [ ] `frontend/src/utils/websocket-diagnostic.ts` - 可选迁移

---

## 💡 示例：迁移 ConversationList.vue

### Before (旧代码)

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useConversationSync } from '@/composables/conversation/useConversationSync'
import { useConversationsStore } from '@/stores/conversations'

const store = useConversationsStore()
const { syncStatus, startSync, stopSync } = useConversationSync()

onMounted(async () => {
  await startSync((conversations) => {
    store.setConversations(conversations)
  })
})

onUnmounted(() => {
  stopSync()
})
</script>

<template>
  <div>
    <p>连接状态: {{ syncStatus }}</p>
    <!-- ... -->
  </div>
</template>
```

### After (新代码)

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useConversationsStore } from '@/stores/conversations'

const store = useConversationsStore()

onMounted(() => {
  store.initializeRealtime()
})

onUnmounted(() => {
  store.cleanup()
})

// 响应式状态
const syncStatus = computed(() => store.syncStatus)
const conversations = computed(() => store.conversations)
</script>

<template>
  <div>
    <p>连接状态: {{ syncStatus }}</p>
    <!-- ... -->
  </div>
</template>
```

**代码行数：** 从 ~20 行减少到 ~15 行 (-25%)

---

## 🎯 API 映射表

| 旧 API | 新 API | 说明 |
|--------|--------|------|
| `conversationSync.start()` | `store.initializeRealtime()` | 启动实时同步 |
| `conversationSync.stop()` | `store.cleanup()` | 停止同步并清理资源 |
| `conversationSync.onData(callback)` | `computed(() => store.conversations)` | 使用响应式计算属性 |
| `conversationSync.onStatus(callback)` | `watch(() => store.syncStatus, ...)` | 使用 watch 监听状态 |
| `conversationSync.refresh()` | `store.refreshConversations()` | 手动刷新 |
| `conversationSync.status.value` | `store.syncStatus` | 连接状态 |
| `conversationSync.lastUpdate.value` | `store.lastUpdateTime` | 最后更新时间 |
| `conversationSync.errorMessage.value` | `store.error` | 错误信息 |

---

## ✅ 迁移后的优势

### 1. 代码更简洁
- ❌ 旧方式：~20 行代码设置回调
- ✅ 新方式：2 行代码完成集成

### 2. 自动化程度更高
- ❌ 旧方式：需要手动设置数据回调
- ✅ 新方式：Store 自动更新，组件自动响应

### 3. 类型安全
- ❌ 旧方式：回调函数参数类型需要手动标注
- ✅ 新方式：TypeScript 全自动推导

### 4. 性能更好
- ❌ 旧方式：每个组件独立管理 WebSocket
- ✅ 新方式：全局单例 WebSocket，所有组件共享

### 5. 调试更容易
- ❌ 旧方式：同步逻辑分散在多个文件
- ✅ 新方式：所有逻辑集中在 Store，DevTools 可见

---

## 🐛 常见问题

### Q1: 迁移后 WebSocket 不连接？

**A:** 确保在组件 `onMounted` 中调用 `initializeRealtime()`，并且只调用一次。

```typescript
// ✅ 正确
onMounted(() => {
  store.initializeRealtime()
})

// ❌ 错误：重复调用
onMounted(() => {
  store.initializeRealtime()
  store.initializeRealtime() // 会被忽略，但应避免
})
```

### Q2: 如何知道连接状态？

**A:** 使用 `store.syncStatus` 响应式状态：

```typescript
const syncStatus = computed(() => store.syncStatus)

// 可能的值: 'disconnected' | 'connecting' | 'connected' | 'polling' | 'error'
```

### Q3: 迁移后数据不更新？

**A:** 检查是否正确使用了响应式 API：

```typescript
// ❌ 错误：不会响应更新
const conversations = store.conversations

// ✅ 正确：自动响应更新
const conversations = computed(() => store.conversations)
```

### Q4: 旧组件还能用吗？

**A:** 可以！旧 API 已标记为 `@deprecated` 但仍然可用。建议逐步迁移到新 API。

---

## 📊 迁移进度跟踪

创建一个 checklist 跟踪迁移进度：

```markdown
## 迁移进度

### 核心功能
- [x] ConversationsTable.vue (方案 B 阶段 1)
- [ ] ConversationList.vue
- [ ] ConversationHeader.vue

### UI 组件
- [ ] SyncStatusIndicator.vue

### 完成标准
- [ ] 所有组件迁移完成
- [ ] 移除 conversationSync.ts
- [ ] 移除 useConversationSync.ts
- [ ] 更新测试用例
- [ ] 更新文档
```

---

## 🎓 最佳实践

### 1. 只在顶层组件初始化

```typescript
// ✅ 推荐：在 App.vue 或页面级组件初始化
// App.vue
onMounted(() => {
  conversationsStore.initializeRealtime()
})

// ❌ 不推荐：在每个子组件中初始化
// ChildComponent.vue (不需要再次初始化)
```

### 2. 使用 computed 而非 ref

```typescript
// ✅ 推荐：直接使用 Store 的响应式状态
const conversations = computed(() => store.conversations)

// ❌ 不推荐：创建额外的 ref
const conversations = ref([])
watch(() => store.conversations, (newVal) => {
  conversations.value = newVal
})
```

### 3. 条件渲染基于 syncStatus

```vue
<template>
  <div v-if="syncStatus === 'connected'" class="connected-indicator">
    ✅ 实时连接
  </div>
  <div v-else-if="syncStatus === 'polling'" class="polling-indicator">
    🔄 轮询模式
  </div>
  <div v-else-if="syncStatus === 'error'" class="error-indicator">
    ❌ 连接失败
  </div>
</template>

<script setup>
const syncStatus = computed(() => conversationsStore.syncStatus)
</script>
```

---

## 📞 需要帮助？

如果迁移过程中遇到问题：

1. 查看 `docs/REALTIME_SYNC_TEST_PLAN.md` 了解测试方法
2. 参考 `frontend/src/views/ConversationsTable.vue` 的迁移示例
3. 检查浏览器控制台日志（搜索 `[ConversationsStore]`）
4. 查看 Store 源码：`frontend/src/stores/conversations.ts:1217-1507`

---

## 🚀 下一步

完成迁移后，可以：
1. ✅ 运行完整测试套件
2. ✅ 更新 CLAUDE.md 文档
3. ✅ 开始方案 B 阶段 3（全局 WebSocket Store）
