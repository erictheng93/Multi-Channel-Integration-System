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

    <div class="table-wrapper">
      <table
        v-if="logs.length > 0"
        class="data-table"
      >
        <thead>
          <tr>
            <th class="col-time">
              時間
            </th>
            <th class="col-rule">
              規則
            </th>
            <th class="col-trigger">
              觸發內容
            </th>
            <th class="col-response">
              回覆內容
            </th>
            <th class="col-platform">
              平台
            </th>
            <th class="col-method">
              方式
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="log in logs"
            :key="log.id"
          >
            <td class="col-time">
              <span class="time-text">{{ formatTime(log.created_at) }}</span>
            </td>
            <td class="col-rule">
              <span
                class="trigger-badge"
                :class="triggerBadgeClass(log)"
              >
                {{ triggerLabel(log) }}
              </span>
              <span class="rule-name">{{ log.rule_name }}</span>
            </td>
            <td class="col-trigger">
              <span
                class="truncated-text"
                :title="log.trigger_content"
              >
                {{ log.trigger_content }}
              </span>
            </td>
            <td class="col-response">
              <span
                class="truncated-text"
                :title="log.response_content"
              >
                {{ log.response_content }}
              </span>
            </td>
            <td class="col-platform">
              <span class="platform-indicator">
                <span
                  class="platform-dot"
                  :class="'platform-dot--' + log.platform"
                />
                {{ platformLabel(log.platform) }}
              </span>
            </td>
            <td class="col-method">
              <span
                class="method-badge"
                :class="methodBadgeClass(log.reply_method)"
              >
                {{ methodLabel(log.reply_method) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

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
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function triggerLabel(log: AutoReplyLog): string {
  const ruleMatch = props.rules.find((r) => r.id === log.rule_id)
  if (ruleMatch) {return ruleMatch.triggerType}
  return 'keyword'
}

function triggerBadgeClass(log: AutoReplyLog): string {
  const type = triggerLabel(log)
  return`trigger-badge--${type}`
}

function platformLabel(platform: string): string {
  if (platform === 'line') {return 'LINE'}
  if (platform === 'facebook') {return 'Facebook'}
  return platform
}

function methodLabel(method: string): string {
  if (method === 'reply_api') {return 'Reply API'}
  if (method === 'push_api') {return 'Push API'}
  return method
}

function methodBadgeClass(method: string): string {
  if (method === 'reply_api') {return 'method-badge--reply'}
  if (method === 'push_api') {return 'method-badge--push'}
  return ''
}
</script>

<style scoped>
.log-table {
  background: white;
  border-radius: var(--radius-lg);
  border: 1px solid var(--gray-100);
  box-shadow: var(--shadow-sm);
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

.table-wrapper {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table thead {
  background: var(--gray-50, #f9fafb);
}

.data-table th {
  padding: var(--space-3) var(--space-4);
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--gray-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--gray-100);
  white-space: nowrap;
}

.data-table td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--gray-100);
  font-size: 0.875rem;
  color: var(--gray-900);
  vertical-align: middle;
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.data-table tbody tr:hover {
  background: var(--primary-50);
}

/* Column widths */
.col-time {
  width: 120px;
  white-space: nowrap;
}

.col-rule {
  width: 180px;
}

.col-trigger,
.col-response {
  max-width: 200px;
}

.col-platform {
  width: 110px;
  white-space: nowrap;
}

.col-method {
  width: 100px;
  white-space: nowrap;
}

/* Time */
.time-text {
  color: var(--gray-600);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

/* Trigger badges */
.trigger-badge {
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 2px var(--space-2);
  border-radius: var(--radius-md);
  margin-right: var(--space-2);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  vertical-align: middle;
}

.trigger-badge--welcome {
  background: #164e3f;
  color: #34d399;
}

.trigger-badge--keyword {
  background: #1e3a5f;
  color: #60a5fa;
}

.trigger-badge--off_hours {
  background: #4a3728;
  color: #fbbf24;
}

.trigger-badge--fallback {
  background: #3b1f4a;
  color: #c084fc;
}

.rule-name {
  font-size: 0.8125rem;
  color: var(--gray-900);
  vertical-align: middle;
}

/* Truncated text */
.truncated-text {
  display: block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8125rem;
  color: var(--gray-600);
}

/* Platform */
.platform-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.8125rem;
  color: var(--gray-900);
}

.platform-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
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
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 2px var(--space-2);
  border-radius: var(--radius-md);
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

  .col-trigger,
  .col-response {
    display: none;
  }

  .pagination-footer {
    flex-direction: column;
    align-items: center;
  }
}
</style>
