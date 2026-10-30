<!--
  ActivityInsights.vue
  The rail beside the log (admins): what the period was made of. Two ranked lists from the overview
  endpoint, 操作類型 and 最活躍成員. A row is a filter shortcut: it applies that action or member to the log.
  Nothing here is invented: counts are the overview's actionStats / topUsers.
-->
<template>
  <aside
    v-if="actions.length > 0 || members.length > 0"
    class="insights"
    aria-label="活動分析"
  >
    <section
      v-if="actions.length > 0"
      class="ins-block"
    >
      <h2 class="ui-group-label">
        操作類型
        <span class="label-note">點選即篩選</span>
      </h2>
      <ul class="ui-card ins-list">
        <li
          v-for="row in actions"
          :key="row.key"
        >
          <button
            type="button"
            class="ins-row"
            :class="{ 'is-on': row.key === activeAction }"
            :aria-pressed="row.key === activeAction"
            @click="emit('filter-action', row.key === activeAction ? '' : row.key)"
          >
            <span class="ins-top">
              <span class="ins-name">{{ row.label }}</span>
              <span class="ins-n">{{ row.count.toLocaleString('en-US') }}<small v-if="row.share"> {{ row.share }}</small></span>
            </span>
            <span
              class="ins-bar"
              aria-hidden="true"
            ><i :style="{ width: row.width }" /></span>
          </button>
        </li>
      </ul>
    </section>

    <section
      v-if="members.length > 0"
      class="ins-block"
    >
      <h2 class="ui-group-label">
        最活躍成員
      </h2>
      <ul class="ui-card ins-list">
        <li
          v-for="row in members"
          :key="row.name"
        >
          <div class="ins-row is-static is-member">
            <span class="ins-top">
              <span class="ins-name">{{ row.name }}</span>
              <span class="ins-n">{{ row.count.toLocaleString('en-US') }}</span>
            </span>
            <span
              class="ins-bar"
              aria-hidden="true"
            ><i :style="{ width: row.width }" /></span>
          </div>
        </li>
      </ul>
    </section>
    <section
      v-if="legend && restoreOn"
      class="ins-block"
    >
      <h2 class="ui-group-label">
        還原狀態說明
      </h2>
      <dl class="ui-card ins-legend">
        <div>
          <dt>還原</dt>
          <dd>仍在期限內，可一鍵復原這項操作。</dd>
        </div>
        <div>
          <dt>已過期</dt>
          <dd>超過可還原期限，記錄保留但不能復原。</dd>
        </div>
        <div>
          <dt>不可還原</dt>
          <dd>登入、傳送訊息等操作本質上無法復原。</dd>
        </div>
      </dl>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ActivityOverview } from '@/api/activities'
import { isActivityRestoreEnabled } from '@/config/runtime'
import { getActionLabel } from './utils'

const props = withDefaults(defineProps<{
  overview: ActivityOverview | null
  /** The action currently applied to the log, so its row reads as on */
  activeAction?: string
  /** The status key under the lists */
  legend?: boolean
}>(), { activeAction: '', legend: true })

const emit = defineEmits<{ 'filter-action': [action: string] }>()

const restoreOn = isActivityRestoreEnabled()

const SHOWN = 5

/** Bars in one list share a scale: the biggest row fills the track */
function scaled<T extends { count: number }>(rows: T[]): Array<T & { width: string }> {
  const max = Math.max(1, ...rows.map(r => r.count))
  return rows.map(r => ({ ...r, width: `${Math.max(4, Math.round((r.count / max) * 100))}%` }))
}

/** Share of the whole period, from the overview's own total (blank when it has none) */
function totalOf(count: number): string {
  const total = props.overview?.totalActivities ?? 0
  return total > 0 ? `${Math.round((count / total) * 100)}%` : ''
}

const actions = computed(() => {
  const stats = props.overview?.actionStats ?? {}
  const rows = Object.entries(stats)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, SHOWN)
    .map(([key, count]) => ({ key, label: getActionLabel(key), count, share: totalOf(count) }))
  return scaled(rows)
})

const members = computed(() => {
  const rows = (props.overview?.topUsers ?? [])
    .slice(0, SHOWN)
    .map(u => ({ name: u.user_name, count: u.count }))
  return scaled(rows)
})
</script>

<style scoped>
.insights {
  display: grid;
  gap: 20px;
  align-content: start;
  min-width: 0;
}

.ins-list {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 8px;
  list-style: none;
}

.ins-row {
  display: grid;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: var(--ui-r-inner);
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--ui-dur) var(--ui-ease);
}

.ins-row:hover {
  background: var(--ui-fill);
}

.ins-row:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: -2px;
}

.ins-row.is-on {
  background: var(--section-hue-soft, var(--ui-accent-soft));
}

.ins-row.is-static {
  cursor: default;
}

.ins-row.is-static:hover {
  background: none;
}

.ins-top {
  display: flex;
  gap: 12px;
  align-items: baseline;
  justify-content: space-between;
  min-width: 0;
}

.ins-name {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ins-n {
  flex: none;
  font: 600 14px var(--ui-font-display);
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.ins-bar {
  display: block;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill-strong);
}

.ins-row:hover .ins-bar {
  background: var(--ui-surface);
}

.ins-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--section-hue, var(--ui-accent));
  opacity: 0.85;
}

/* members are people, not categories: their own hue so the two lists never read as one */
.ins-row.is-member .ins-bar i {
  background: var(--ui-indigo);
}

.ins-n small {
  display: inline-block;
  min-width: 2.6em;
  margin-left: 8px;
  font: 500 13px var(--ui-font-ui);
  text-align: right;
  color: var(--ui-muted);
}

.ins-row.is-on .ins-bar i {
  opacity: 1;
}

.ins-legend {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 16px 20px;
}
.ins-legend dt {
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink);
}
.ins-legend dd {
  margin: 2px 0 0;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--ui-ink-2);
}

@media (max-width: 768px) {
  .ins-row {
    padding: 12px;
  }
}
</style>
