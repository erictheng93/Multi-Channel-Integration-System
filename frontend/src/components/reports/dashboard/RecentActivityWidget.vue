<template>
  <div class="recent-activity-widget">
    <div class="widget-header">
      <h3 class="widget-title">
        📝 最近活動
      </h3>
      <span
        v-if="activities.length > 0"
        class="header-subtitle"
      >
        最近 {{ activities.length }} 項
      </span>
    </div>

    <div class="widget-content">
      <!-- 空狀態 -->
      <div
        v-if="activities.length === 0"
        class="empty-state"
      >
        <div class="empty-icon">
          📝
        </div>
        <p class="empty-text">
          暫無活動記錄
        </p>
      </div>

      <!-- 活動列表 -->
      <div
        v-else
        class="activity-list"
      >
        <div
          v-for="activity in activities"
          :key="activity.id"
          class="activity-item"
          @click="$emit('view-report', activity.reportId)"
        >
          <div
            class="activity-icon"
            :class="activity.status"
          >
            {{ getStatusIcon(activity.status) }}
          </div>
          <div class="activity-content">
            <div class="activity-title">
              {{ activity.title }}
            </div>
            <div class="activity-meta">
              <span class="activity-type">{{ activity.typeLabel }}</span>
              <span class="activity-separator">•</span>
              <span class="activity-time">{{ formatRelativeTime(activity.time) }}</span>
            </div>
          </div>
          <div class="activity-arrow">
            →
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * RecentActivityWidget Component
 *
 * 最近活动小部件，显示报表生成和状态变更的活动记录
 *
 * @emits view-report - 查看报表详情
 */

export interface RecentActivity {
  /**
   * 活动唯一标识
   */
  id: string

  /**
   * 关联的报表ID
   */
  reportId: string

  /**
   * 活动标题
   */
  title: string

  /**
   * 报表类型标签
   */
  typeLabel: string

  /**
   * 活动状态
   */
  status: 'completed' | 'generating' | 'failed' | 'pending'

  /**
   * 活动时间（ISO 8601格式）
   */
  time: string
}

export interface RecentActivityWidgetProps {
  /**
   * 最近活动列表（已按时间排序）
   */
  activities: RecentActivity[]

  /**
   * 获取状态图标
   */
  getStatusIcon: (_status: string) => string

  /**
   * 格式化相对时间
   */
  formatRelativeTime: (_time: string) => string
}

defineProps<RecentActivityWidgetProps>()

defineEmits<{
  'view-report': [reportId: string]
}>()
</script>

<style scoped>
.recent-activity-widget {
  display: flex;
  flex-direction: column;
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.widget-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.header-subtitle {
  font-size: 0.8rem;
  color: #6b7280;
  font-weight: 500;
}

.widget-content {
  padding: 1rem;
  max-height: 400px;
  overflow-y: auto;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  text-align: center;
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  opacity: 0.5;
}

.empty-text {
  color: #6b7280;
  font-size: 0.9rem;
  margin: 0;
}

/* Activity List */
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.activity-item:hover {
  background: #f9fafb;
  border-color: #3b82f6;
  transform: translateX(2px);
}

.activity-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.activity-icon.completed {
  background: #dcfce7;
}

.activity-icon.generating {
  background: #dbeafe;
}

.activity-icon.failed {
  background: #fee2e2;
}

.activity-icon.pending {
  background: #fef3c7;
}

.activity-content {
  flex: 1;
  min-width: 0;
}

.activity-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #6b7280;
}

.activity-type {
  font-weight: 500;
}

.activity-separator {
  color: #d1d5db;
}

.activity-time {
  white-space: nowrap;
}

.activity-arrow {
  color: #9ca3af;
  font-size: 1.1rem;
  flex-shrink: 0;
  transition: transform 0.2s;
}

.activity-item:hover .activity-arrow {
  transform: translateX(4px);
  color: #3b82f6;
}

/* Scrollbar Styling */
.widget-content::-webkit-scrollbar {
  width: 6px;
}

.widget-content::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 3px;
}

.widget-content::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.widget-content::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Responsive */
@media (max-width: 768px) {
  .widget-content {
    padding: 0.75rem;
    max-height: 300px;
  }

  .activity-list {
    gap: 0.5rem;
  }

  .activity-item {
    padding: 0.5rem;
  }

  .activity-icon {
    width: 32px;
    height: 32px;
    font-size: 1rem;
  }

  .activity-title {
    font-size: 0.85rem;
  }

  .activity-meta {
    font-size: 0.75rem;
  }
}
</style>
