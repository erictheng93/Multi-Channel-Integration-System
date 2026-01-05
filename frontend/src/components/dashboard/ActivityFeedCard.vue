<template>
  <div class="side-card activity-card">
    <div class="card-header">
      <div class="card-title-group">
        <h2 class="card-title">
          {{ title }}
        </h2>
        <p class="card-subtitle">
          <span :class="['connection-status', isConnected ? 'connected' : 'disconnected']">
            {{ isConnected ? '● 已連線' : '○ 未連線' }}
          </span>
          {{ connectionMode }}
        </p>
      </div>
      <div class="activity-actions">
        <router-link
          v-if="showViewAllLink"
          to="/activities"
          class="view-all-link"
        >
          查看全部
        </router-link>
      </div>
    </div>
    <div class="card-body">
      <HamsterLoader
        v-if="loading"
        :message="loadingMessage"
      />
      <EmptyState
        v-else-if="activities.length === 0"
        :title="emptyTitle"
        :description="emptyDescription"
      />
      <div
        v-else
        class="activity-list"
      >
        <div
          v-for="activity in activities"
          :key="activity.id"
          class="activity-item"
          :class="activity.priority"
        >
          <div
            class="activity-icon"
            :class="activity.type"
          >
            <component :is="getActivityIcon(activity.type)" />
          </div>
          <div class="activity-content">
            <div class="activity-header">
              <div class="activity-title">
                {{ activity.title }}
              </div>
              <div
                v-if="activity.priority === 'high'"
                class="activity-priority"
              >
                🔴
              </div>
            </div>
            <div class="activity-description">
              {{ activity.description }}
            </div>
            <div class="activity-time">
              {{ formatTime(activity.createdAt) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import type { Component } from 'vue'

export interface Activity {
  id: string
  type: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  createdAt: Date
}

export interface ActivityFeedCardProps {
  /**
   * 卡片标题
   * @default '活動動態'
   */
  title?: string

  /**
   * 连接模式文本
   * @default 'WebSocket 模式'
   */
  connectionMode?: string

  /**
   * WebSocket 连接状态
   */
  isConnected: boolean

  /**
   * 活动列表
   */
  activities: Activity[]

  /**
   * 获取活动图标的函数
   */
  getActivityIcon: (_type: string) => Component

  /**
   * 格式化时间的函数
   */
  formatTime: (_date: Date) => string

  /**
   * 加载状态
   */
  loading?: boolean

  /**
   * 加载消息
   * @default '載入中...'
   */
  loadingMessage?: string

  /**
   * 空状态标题
   * @default '暫無重要活動'
   */
  emptyTitle?: string

  /**
   * 空状态描述
   * @default '當有重要的系統活動時，會顯示在這裡'
   */
  emptyDescription?: string

  /**
   * 是否显示"查看全部"链接
   * @default true
   */
  showViewAllLink?: boolean
}

withDefaults(defineProps<ActivityFeedCardProps>(), {
  title: '活動動態',
  connectionMode: 'WebSocket 模式',
  loading: false,
  loadingMessage: '載入中...',
  emptyTitle: '暫無重要活動',
  emptyDescription: '當有重要的系統活動時，會顯示在這裡',
  showViewAllLink: true
})
</script>

<style scoped>
.side-card {
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
  overflow: hidden;
}

.card-header {
  padding: var(--space-6) var(--space-8);
  border-bottom: 1px solid var(--gray-100);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title-group {
  flex: 1;
}

.card-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--gray-900);
  margin-bottom: var(--space-1);
}

.card-subtitle {
  font-size: 0.875rem;
  color: var(--gray-600);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.connection-status {
  font-size: 0.8125rem;
  font-weight: 500;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
}

.connection-status.connected {
  color: var(--green-700);
  background: var(--green-50);
}

.connection-status.disconnected {
  color: var(--gray-700);
  background: var(--gray-100);
}

.activity-actions {
  display: flex;
  gap: var(--space-3);
}

.view-all-link {
  color: var(--primary-600);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  transition: color var(--transition-fast);
}

.view-all-link:hover {
  color: var(--primary-700);
  text-decoration: underline;
}

.card-body {
  padding: var(--space-6);
  min-height: 200px;
  max-height: 600px;
  overflow-y: auto;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.activity-item {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--gray-100);
  transition: all var(--transition-fast);
}

.activity-item:hover {
  background: var(--gray-50);
  border-color: var(--gray-200);
}

.activity-item.high {
  border-left: 3px solid var(--red-500);
}

.activity-item.medium {
  border-left: 3px solid var(--yellow-500);
}

.activity-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--gray-100);
  color: var(--gray-600);
}

.activity-content {
  flex: 1;
  min-width: 0;
}

.activity-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.activity-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--gray-900);
}

.activity-priority {
  font-size: 0.875rem;
  flex-shrink: 0;
}

.activity-description {
  font-size: 0.875rem;
  color: var(--gray-600);
  margin-bottom: var(--space-1);
  line-height: 1.5;
}

.activity-time {
  font-size: 0.8125rem;
  color: var(--gray-500);
}
</style>
