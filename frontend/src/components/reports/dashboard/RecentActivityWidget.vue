<template>
  <div class="recent-activity-widget">
    <div class="ui-card-head">
      <h3 class="ui-card-title">
        最近活動
      </h3>
      <div
        v-if="activities.length > 0"
        class="ui-card-end"
      >
        <span class="header-subtitle ui-card-sub">最近 {{ activities.length }} 項</span>
      </div>
    </div>

    <div
      v-if="activities.length === 0"
      class="empty-text empty-state"
    >
      暫無活動記錄
    </div>

    <div
      v-else
      class="widget-content"
    >
      <ul class="activity-list">
        <li
          v-for="activity in activities"
          :key="activity.id"
        >
          <button
            type="button"
            class="activity-item"
            @click="$emit('view-report', activity.reportId)"
          >
            <span
              class="activity-icon"
              :class="activity.status"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              ><path :d="iconPath(activity.status)" /></svg>
            </span>
            <span class="activity-content">
              <span class="activity-title">{{ describe(activity) }}</span>
              <span class="activity-time">{{ activity.typeLabel }} · {{ formatRelativeTime(activity.time) }}</span>
            </span>
          </button>
        </li>
      </ul>
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

<script lang="ts">
// Event wording is derived from each report row's real status; nothing is invented.
function describe(activity: { title: string; status: string }): string {
  switch (activity.status) {
    case 'completed':
      return `「${  activity.title  }」已完成`
    case 'failed':
      return `「${  activity.title  }」產生失敗`
    default:
      return `開始產生「${  activity.title  }」`
  }
}

function iconPath(status: string): string {
  switch (status) {
    case 'completed':
      return 'm5 12.5 4.5 4.5L19 7.5'
    case 'failed':
      return 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z'
    default:
      return 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'
  }
}
</script>

<style scoped>
.widget-content {
  max-height: 420px;
  overflow-y: auto;
}

.recent-activity-widget {
  padding-bottom: 12px;
}

.empty-text {
  padding: 8px 22px 12px;
  font-size: 13.5px;
  color: var(--ui-muted);
}

.activity-list {
  margin: 0;
  padding: 0 8px;
  list-style: none;
}

.activity-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 0;
  border-radius: 12px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.activity-item:hover {
  background: color-mix(in srgb, var(--ui-fill) 45%, transparent);
}

.activity-icon {
  display: grid;
  flex: none;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 10px;
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.activity-icon svg {
  width: 16px;
  height: 16px;
}

.activity-icon.completed {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.activity-icon.failed {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

.activity-content {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.activity-title {
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-time {
  font-size: 12px;
  color: var(--ui-muted);
}
</style>
