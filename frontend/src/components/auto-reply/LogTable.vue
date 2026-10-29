<template>
  <div class="ui-card log-table">
    <div class="log-toolbar">
      <select
        class="ui-select filter-select"
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
        class="ui-select filter-select"
        :value="filterPlatform"
        @change="emit('update:filterPlatform', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">
          所有平台
        </option>
        <option value="line">
          LINE
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
            {{ triggerText(log) }}
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

    <UiEmptyState
      v-else
      class="empty-state"
      title="尚無回覆記錄"
      description="當自動回覆觸發時，記錄將會顯示在這裡"
    >
      <template #icon>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        ><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
      </template>
    </UiEmptyState>

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
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import { computed } from 'vue'
import { TRIGGER_TYPE_LABELS, type AutoReplyLog, type AutoReplyRule } from '@/api/autoReply'

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

function triggerText(log: AutoReplyLog): string {
  const type = triggerLabel(log)
  return TRIGGER_TYPE_LABELS[type] ?? type
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
  overflow: hidden;
}

.log-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 14px 22px;
}

.filter-select {
  width: auto;
  min-width: 150px;
  height: 38px;
  border-radius: 999px;
}

.log-list {
  display: flex;
  flex-direction: column;
}

.log-card {
  position: relative;
  padding: 14px 22px;
}

.log-card + .log-card::before {
  content: '';
  position: absolute;
  top: 0;
  right: 22px;
  left: 22px;
  height: 0.5px;
  background: var(--ui-sep);
}

.log-card-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}

.trigger-badge,
.method-badge {
  padding: 0 9px;
  border-radius: 999px;
  background: var(--ui-fill);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 22px;
  color: var(--ui-ink-2);
  white-space: nowrap;
}

.trigger-badge--welcome {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.trigger-badge--keyword {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.trigger-badge--off_hours {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.method-badge--reply {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.method-badge--push {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.rule-name {
  font-size: 14px;
  font-weight: 600;
}

.log-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  font-size: 13px;
  color: var(--ui-muted);
}

.meta-divider {
  flex: none;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--ui-faint);
}

.platform-indicator {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.platform-dot {
  display: inline-block;
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ui-faint);
}

.platform-dot--line {
  background: var(--ui-line);
}

.platform-dot--facebook {
  background: var(--ui-messenger);
}

.time-text {
  font-variant-numeric: tabular-nums;
}

.log-card-body {
  display: grid;
  gap: 4px;
  margin-top: 8px;
}

.log-card-line {
  display: flex;
  gap: 10px;
  font-size: 13.5px;
}

.log-card-label {
  flex: none;
  width: 28px;
  color: var(--ui-muted);
}

.log-card-text {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--ui-ink-2);
}

.log-card-text--trigger {
  color: var(--ui-ink);
}

.empty-icon {
  display: grid;
  width: 56px;
  height: 56px;
  place-items: center;
  border-radius: 18px;
  background: var(--ui-surface-2);
  color: var(--ui-muted);
}

.empty-icon svg {
  width: 26px;
  height: 26px;
}

.empty-title {
  margin: 0;
  font: 600 16px var(--ui-font-display);
}

.empty-desc {
  margin: 0;
  font-size: 13.5px;
  color: var(--ui-muted);
}

.pagination-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 22px 16px;
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.pagination-info {
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.pagination-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.page-btn {
  min-width: 36px;
}

@media (max-width: 768px) {
  .log-card,
  .log-toolbar,
  .pagination-footer {
    padding-right: 16px;
    padding-left: 16px;
  }

  .log-card-meta {
    width: 100%;
    margin-left: 0;
  }

  .log-card-meta > .meta-divider:first-child {
    display: none;
  }

  .filter-select {
    flex: 1 1 100%;
  }

  .page-btn {
    min-height: 44px;
  }
}
</style>
