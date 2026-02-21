<template>
  <div class="tag-stats-overview">
    <!-- Stats Overview Cards -->
    <div
      class="stats-grid"
      :class="{ 'single-column': !enableConversationTags }"
    >
      <!-- Tagged Customers Card -->
      <div class="stat-card">
        <div class="stat-icon customers">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
        <div class="stat-content">
          <div class="stat-value">
            {{ stats.customers.total }}
          </div>
          <div class="stat-label">
            已標記客戶
          </div>
        </div>
      </div>

      <!-- Tagged Conversations Card (hidden, reserved for future) -->
      <div
        v-if="enableConversationTags"
        class="stat-card"
      >
        <div class="stat-icon conversations">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </div>
        <div class="stat-content">
          <div class="stat-value">
            {{ stats.conversations.total }}
          </div>
          <div class="stat-label">
            已標記對話
          </div>
        </div>
      </div>
    </div>

    <!-- Platform Distribution -->
    <div
      v-if="stats.customers.total > 0"
      class="section"
    >
      <h3 class="section-title">
        客戶平台分布
      </h3>
      <div class="platform-stats">
        <div class="platform-item">
          <div class="platform-info">
            <svg
              class="platform-icon line"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.771.039 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
            </svg>
            <span class="platform-name">LINE OA</span>
          </div>
          <div class="platform-count">
            {{ stats.customers.byPlatform.line }} 位
            <span class="platform-percentage">({{ calculatePercentage(stats.customers.byPlatform.line, stats.customers.total) }}%)</span>
          </div>
        </div>
        <div class="platform-item">
          <div class="platform-info">
            <svg
              class="platform-icon facebook"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <span class="platform-name">Facebook</span>
          </div>
          <div class="platform-count">
            {{ stats.customers.byPlatform.facebook }} 位
            <span class="platform-percentage">({{ calculatePercentage(stats.customers.byPlatform.facebook, stats.customers.total) }}%)</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Conversation Status (hidden, reserved for future) -->
    <div
      v-if="enableConversationTags && stats.conversations.total > 0"
      class="section"
    >
      <h3 class="section-title">
        對話狀態分布
      </h3>
      <div class="conversation-stats">
        <div class="conversation-item active">
          <div class="conversation-label">
            進行中
          </div>
          <div class="conversation-count">
            {{ stats.conversations.active }} 則
          </div>
        </div>
        <div class="conversation-item closed">
          <div class="conversation-label">
            已關閉
          </div>
          <div class="conversation-count">
            {{ stats.conversations.closed }} 則
          </div>
        </div>
      </div>
    </div>

    <!-- Usage Trend & Top Assigners -->
    <TagStatsActivity
      :usage-trend="stats.usageTrend"
      :top-assigners="stats.topAssigners"
    />

    <!-- Empty State -->
    <div
      v-if="stats.customers.total === 0 && stats.conversations.total === 0"
      class="empty-stats"
    >
      <svg
        class="empty-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
      <p class="empty-message">
        此標籤尚未被使用
      </p>
      <p class="empty-description">
        開始為客戶或對話添加此標籤來追蹤使用情況
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TagUsageStats } from '@/api/tags'
import TagStatsActivity from '@/components/customer/TagStatsActivity.vue'

defineProps<{
  stats: TagUsageStats
  enableConversationTags: boolean
}>()

const calculatePercentage = (value: number, total: number): string => {
  if (total === 0) {return '0'}
  return ((value / total) * 100).toFixed(1)
}
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.stats-grid.single-column {
  grid-template-columns: 1fr;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--gray-50);
  border-radius: var(--radius-xl);
  border: 1px solid var(--gray-200);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon.customers {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
}

.stat-icon.conversations {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
}

.stat-icon svg {
  width: 24px;
  height: 24px;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--gray-900);
  line-height: 1;
  margin-bottom: var(--space-1);
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--gray-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section {
  margin-bottom: var(--space-6);
}

.section-title {
  margin: 0 0 var(--space-3) 0;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--gray-900);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.platform-stats,
.conversation-stats {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.platform-item,
.conversation-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
}

.platform-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.platform-icon {
  width: 20px;
  height: 20px;
}

.platform-icon.line {
  color: #06C755;
}

.platform-icon.facebook {
  color: #1877F2;
}

.platform-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--gray-700);
}

.platform-count {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--gray-900);
}

.platform-percentage {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--gray-500);
  margin-left: var(--space-1);
}

.conversation-item.active {
  border-left: 3px solid #10b981;
}

.conversation-item.closed {
  border-left: 3px solid var(--gray-400);
}

.conversation-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--gray-700);
}

.conversation-count {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--gray-900);
}

.empty-stats {
  text-align: center;
  padding: var(--space-12) var(--space-6);
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto var(--space-4);
  color: var(--gray-300);
}

.empty-message {
  margin: 0 0 var(--space-2) 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-700);
}

.empty-description {
  margin: 0;
  font-size: 0.875rem;
  color: var(--gray-500);
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
