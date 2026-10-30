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
              <span class="ins-n">{{ row.count.toLocaleString('en-US') }}</span>
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
          <div
            class="ins-row is-static"
          >
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
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ActivityOverview } from '@/api/activities'
import { getActionLabel } from './utils'

const props = defineProps<{
  overview: ActivityOverview | null
  /** The action currently applied to the log, so its row reads as on */
  activeAction?: string
}>()

const emit = defineEmits<{ 'filter-action': [action: string] }>()

const SHOWN = 5

/** Bars in one list share a scale: the biggest row fills the track */
function scaled<T extends { count: number }>(rows: T[]): Array<T & { width: string }> {
  const max = Math.max(1, ...rows.map(r => r.count))
  return rows.map(r => ({ ...r, width: `${Math.max(4, Math.round((r.count / max) * 100))}%` }))
}

const actions = computed(() => {
  const stats = props.overview?.actionStats ?? {}
  const rows = Object.entries(stats)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, SHOWN)
    .map(([key, count]) => ({ key, label: getActionLabel(key), count }))
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
  background: var(--ui-accent-soft);
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
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill);
}

.ins-row:hover .ins-bar {
  background: var(--ui-surface);
}

.ins-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ui-accent);
  opacity: 0.55;
}

.ins-row.is-on .ins-bar i {
  opacity: 1;
}

@media (max-width: 768px) {
  .ins-row {
    padding: 12px;
  }
}
</style>
