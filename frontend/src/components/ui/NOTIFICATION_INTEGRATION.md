# 通知系統整合指南

## 概述

通知系統包含以下組件：

- `NotificationBadge.vue` - 未讀數量徽章
- `NotificationCenter.vue` - 通知中心下拉面板
- `NotificationItem.vue` - 單個通知項目
- `useNotifications.ts` - Composable (整合 WebSocket)

## 在 AppLayout 中整合

### 方法 1: 替換現有通知按鈕

在 `AppLayout.vue` 的 `top-bar-actions` 區域，將現有的通知按鈕替換為 `NotificationCenter`：

```vue
<template>
  <!-- ... -->
  <div class="top-bar-actions">
    <!-- 使用新的通知中心組件 -->
    <NotificationCenter @notification-click="handleNotificationClick" />

    <!-- Status Indicator -->
    <div class="status-indicator">
      <div class="status-dot online" />
      <span class="status-text">線上</span>
    </div>
  </div>
  <!-- ... -->
</template>

<script setup lang="ts">
import { NotificationCenter } from '@/components/ui'
import type { Notification } from '@/stores/notifications'

const handleNotificationClick = (notification: Notification) => {
  // 根據通知類型導航到相應頁面
  if (notification.type === 'new_message' && notification.data?.conversationId) {
    router.push(`/conversations/${notification.data.conversationId}`)
  } else if (notification.type === 'conversation_assigned') {
    router.push(`/conversations/${notification.data?.conversationId}`)
  }
}
</script>
```

### 方法 2: 使用 Composable

如果需要更多控制，可以使用 `useNotifications` composable：

```vue
<script setup lang="ts">
import { useNotifications } from '@/composables/useNotifications'

const {
  notifications,
  unreadCount,
  hasUnread,
  markAsRead,
  markAllAsRead,
  requestDesktopPermission
} = useNotifications({
  autoConnect: true,
  enablePolling: true,
  pollingInterval: 30000,
  enableDesktopNotifications: true,
  enableSound: true
})

// 請求桌面通知權限
const enableDesktopNotifications = async () => {
  const permission = await requestDesktopPermission()
  if (permission === 'granted') {
    console.log('桌面通知已啟用')
  }
}
</script>
```

## 獨立使用 NotificationBadge

```vue
<template>
  <button class="my-button">
    <BellIcon />
    <NotificationBadge
      :count="unreadCount"
      :max="99"
      size="sm"
      variant="danger"
      :pulse="hasUrgent"
    />
  </button>
</template>

<script setup lang="ts">
import { NotificationBadge } from '@/components/ui'
import { useNotificationsStore } from '@/stores/notifications'

const store = useNotificationsStore()
const unreadCount = computed(() => store.unreadCount)
const hasUrgent = computed(() => store.urgentNotifications.length > 0)
</script>
```

## WebSocket 整合

通知系統已與 `WebSocketManager` 整合。當 WebSocket 收到 `notification` 類型的訊息時，會自動：

1. 添加到通知列表
2. 更新未讀數量
3. 觸發桌面通知（如果已啟用）
4. 播放音效（如果已啟用）

### WebSocket 訊息格式

```typescript
interface WebSocketNotificationMessage {
  type: 'notification'
  data: {
    id: string
    userId: number
    type: NotificationType
    title: string
    content: string
    priority: NotificationPriority
    data?: Record<string, unknown>
    createdAt: string
  }
  timestamp: string
}
```

## API 端點

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/notifications` | GET | 獲取通知列表 |
| `/api/notifications` | POST | 創建通知 |
| `/api/notifications/:id` | GET | 獲取單個通知 |
| `/api/notifications/:id/read` | PUT | 標記已讀 |
| `/api/notifications/mark-all-read` | PUT | 全部標記已讀 |
| `/api/notifications/:id` | DELETE | 刪除通知 |
| `/api/notifications/stats` | GET | 獲取統計 |
| `/api/notifications/unread-count` | GET | 獲取未讀數量 |
| `/api/notifications/recent` | GET | 獲取最近通知 |

## 通知類型

- `new_message` - 新訊息
- `conversation_assigned` - 對話指派
- `conversation_transferred` - 對話轉移
- `mention` - 提及
- `system` - 系統通知
- `priority_changed` - 優先級變更
- `customer_responded` - 客戶回覆
- `task_reminder` - 任務提醒

## 優先級

- `low` - 低
- `normal` - 一般
- `high` - 高
- `urgent` - 緊急
