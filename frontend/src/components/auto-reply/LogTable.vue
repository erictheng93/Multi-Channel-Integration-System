<template>
  <div class="log-table">
    <div class="log-toolbar">
      <select
        class="form-input filter-select"
        :value="filterRuleId"
        @change="emit('update:filterRuleId', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">
          所有規則
        </option>
        <option
          v-for="rule in rules"
          :key="rule.id"
          :value="String(rule.id)"
        >
          {{ rule.name }}
        </option>
      </select>

      <select
        class="form-input filter-select"
        :value="filterPlatform"
        @change="emit('update:filterPlatform', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">
          所有平台
        </option>
        <option value="line">
          LINE
        </option>
        <option value="facebook">
          Facebook
        </option>
      </select>
    </div>

    <div
      v-if="logs.length > 0"
      class="log-list"
    >
      <div
        v-for="log in logs"
        :key="log.id"
        class="log-card"
      >
        <div class="log-card-header">
          <span
            class="trigger-badge"
            :class="triggerBadgeClass(log)"
          >
            {{ triggerLabel(log) }}
          </span>
          <span class="rule-name">{{ log.rule_name }}</span>
          <span class="log-card-meta">
            <span class="meta-divider" />
            <span class="platform-indicator">
              <span
                class="platform-dot"
                :class="'platform-dot--' + log.platform"
              />
              {{ platformLabel(log.platform) }}
            </span>
            <span class="meta-divider" />
            <span
              class="method-badge"
              :class="methodBadgeClass(log.reply_method)"
            >
              {{ methodLabel(log.reply_method) }}
            </span>
            <span class="meta-divider" />
            <span class="time-text">{{ formatTime(log.created_at) }}</span>
          </span>
        </div>
        <div class="log-card-body">
          <div class="log-card-line">
            <span class="log-card-label">觸發</span>
            <span class="log-card-text log-card-text--trigger">{{ log.trigger_content }}</span>
          </div>
          <div class="log-card-line">
            <span class="log-card-label">回覆</span>
            <span class="log-card-text">{{ log.response_content }}</span>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else
      class="empty-state"
    >
      <div class="empty-icon">
        --
      </div>
      <p class="empty-title">
        尚無回覆記錄
      </p>
      <p class="empty-desc">
        當自動回覆觸發時，記錄將會顯示在這裡
      </p>
    </div>

    <div
      v-if="logs.length > 0"
      class="pagination-footer"
    >
      <span class="pagination-info">
        顯示 {{ rangeStart }}-{{ rangeEnd }} / 共 {{ pagination.total }} 筆
      </span>
      <div class="pagination-buttons">
        <button
          class="btn btn-secondary page-btn"
          :disabled="pagination.page <= 1"
          @click="emit('page-change', pagination.page - 1)"
        >
          上一頁
        </button>
        <button
          v-for="p in visiblePages"
          :key="p"
          class="btn page-btn"
          :class="p === pagination.page ? 'btn-primary' : 'btn-secondary'"
          @click="emit('page-change', p)"
        >
          {{ p }}
        </button>
        <button
          class="btn btn-secondary page-btn"
          :disabled="pagination.page >= totalPages"
          @click="emit('page-change', pagination.page + 1)"
        >
          下一頁
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AutoReplyLog, AutoReplyRule } from '@/api/autoReply'

const props = defineProps<{
  logs: AutoReplyLog[]
  rules: AutoReplyRule[]
  pagination: { page: number; limit: number; total: number }
  filterRuleId: string
  filterPlatform: string
}>()

const emit = defineEmits<{
  'update:filterRuleId': [value: string]
  'update:filterPlatform': [value: string]
  'page-change': [page: number]
}>()

const totalPages = computed(() =>
  Math.max(1, Math.ceil(props.pagination.total / props.pagination.limit))
)

const rangeStart = computed(() =>
  props.pagination.total === 0
    ? 0
    : (props.pagination.page - 1) * props.pagination.limit + 1
)

const rangeEnd = computed(() =>
  Math.min(props.pagination.page * props.pagination.limit, props.pagination.total)
)

const visiblePages = computed(() => {
  const pages: number[] = []
  const current = props.pagination.page
  const total = totalPages.value
  const maxVisible = 5
  let start = Math.max(1, current - Math.floor(maxVisible / 2))
  const end = Math.min(total, start + maxVisible - 1)
  start = Math.max(1, end - maxVisible + 1)
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  return pages
})

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (isToday) {
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function triggerLabel(log: AutoReplyLog): string {
  const ruleMatch = props.rules.find((r) => r.id === log.rule_id)
  if (ruleMatch) { return ruleMatch.triggerType }
  return 'keyword'
}

function triggerBadgeClass(log: AutoReplyLog): string {
  const type = triggerLabel(log)
  return `trigger-badge--${type}`
}

function platformLabel(platform: string): string {
  if (platform === 'line') { return 'LINE' }
  if (platform === 'facebook') { return 'Facebook' }
  return platform
}

function methodLabel(method: string): string {
  if (method === 'reply_api') { return 'Reply API' }
  if (method === 'push_api') { return 'Push API' }
  return method
}

function methodBadgeClass(method: string): string {
  if (method === 'reply_api') { return 'method-badge--reply' }
  if (method === 'push_api') { return 'method-badge--push' }
  return ''
}
</script>

<style scoped>
.log-table {
  background: white;
  border-radius: var(--radius-xl, 16px);
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.06);
  overflow: hidden;
}

.log-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--gray-100);
  flex-wrap: wrap;
}

.filter-select {
  min-width: 150px;
  font-size: 0.875rem;
}

/* Card list */
.log-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
}

.log-card {
  background: var(--gray-50, #f9fafb);
  border-radius: 14px;
  padding: 14px 18px;
  transition: box-shadow 0.2s ease-out;
  cursor: default;
}

.log-card:hover {
  box-shadow: 0 2px 12px rgb(0 0 0 / 0.06);
}

/* Card header: badge + rule name + inline meta */
.log-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.log-card-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: 4px;
}

.meta-divider {
  display: inline-block;
  width: 1px;
  height: 12px;
  background: var(--gray-200, #e5e7eb);
  flex-shrink: 0;
}

/* Card body: trigger / response with labels */
.log-card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.log-card-line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.log-card-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--gray-400, #9ca3af);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  width: 38px;
  flex-shrink: 0;
  padding-top: 2px;
}

.log-card-text {
  font-size: 0.8125rem;
  color: var(--gray-600, #4b5563);
  line-height: 1.45;
}

.log-card-text--trigger {
  font-weight: 500;
  color: var(--gray-900, #1C1C1E);
}

/* Time */
.time-text {
  color: var(--gray-400, #9ca3af);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* Trigger badges — pastel style */
.trigger-badge {
  display: inline-block;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.trigger-badge--keyword {
  background: #dbeafe;
  color: #1d4ed8;
}

.trigger-badge--welcome {
  background: #d1fae5;
  color: #047857;
}

.trigger-badge--off_hours {
  background: #fef3c7;
  color: #b45309;
}

.trigger-badge--fallback {
  background: #ede9fe;
  color: #6d28d9;
}

.rule-name {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--gray-900, #1C1C1E);
}

/* Platform */
.platform-indicator {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  color: var(--gray-500, #6b7280);
  white-space: nowrap;
}

.platform-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.platform-dot--line {
  background: #00c300;
}

.platform-dot--facebook {
  background: #1877f2;
}

/* Method badges */
.method-badge {
  display: inline-block;
  font-size: 0.625rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  white-space: nowrap;
}

.method-badge--reply {
  background: #dcfce7;
  color: #166534;
}

.method-badge--push {
  background: #fef3c7;
  color: #92400e;
}

/* Empty state */
.empty-state {
  padding: var(--space-8) var(--space-4);
  text-align: center;
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: var(--space-3);
  opacity: 0.5;
}

.empty-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 var(--space-1);
}

.empty-desc {
  font-size: 0.875rem;
  color: var(--gray-600);
  margin: 0;
}

/* Pagination */
.pagination-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--gray-100);
  flex-wrap: wrap;
  gap: var(--space-3);
}

.pagination-info {
  font-size: 0.8125rem;
  color: var(--gray-600);
  font-variant-numeric: tabular-nums;
}

.pagination-buttons {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.page-btn {
  min-width: 36px;
  height: 36px;
  padding: 0 var(--space-2);
  font-size: 0.8125rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 768px) {
  .log-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-select {
    width: 100%;
  }

  .log-list {
    padding: 12px;
    gap: 10px;
  }

  .log-card {
    padding: 12px 14px;
  }

  .log-card-meta {
    margin-left: 0;
    margin-top: 4px;
    width: 100%;
  }

  .pagination-footer {
    flex-direction: column;
    align-items: center;
  }
}
</style>
