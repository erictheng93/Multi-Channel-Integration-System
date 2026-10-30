<!-- The latest generated reports across every type: gives the template page a "what came out of these" shelf.
     Real list from the reports API; renders nothing while loading, on error or when there are none. -->
<template>
  <section
    v-if="items.length"
    class="ro"
    aria-label="最近產出的報表"
  >
    <h2 class="ui-group-label">
      最近產出
      <router-link
        to="/reports/dashboard"
        class="ui-link"
      >
        全部報表
      </router-link>
    </h2>
    <ul class="ui-group ro-list">
      <li
        v-for="item in items"
        :key="item.id"
      >
        <router-link
          :to="`/reports/${item.id}`"
          class="ro-row"
        >
          <span class="ro-main">
            <span class="ro-title">{{ item.title }}</span>
            <span class="ro-type">{{ typeLabel(item.type) }} ・ {{ item.format.toUpperCase() }}</span>
          </span>
          <span
            class="ui-pill ro-pill"
            :class="statusClass(item.status)"
          >{{ statusText[item.status] ?? item.status }}</span>
          <span class="ro-when">{{ relative(item.completedAt ?? item.createdAt) }}</span>
        </router-link>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ReportsAPI from '@/api/reports'
import type { ReportBase } from '@/types/reports'

const items = ref<ReportBase[]>([])
const statusText: Record<string, string> = { completed: '已完成', generating: '生成中', pending: '待處理', failed: '失敗', expired: '已過期' }
const statusClass = (status: string) => ({ completed: 'ui-pill-green', generating: 'ui-pill-blue', pending: 'ui-pill-blue', failed: 'ui-pill-red' }[status] ?? '')
const typeLabel = (type: string) => ReportsAPI.formatReportType(type as ReportBase['type'])

function relative(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return mins < 1 ? '剛剛' : mins < 60 ? `${mins} 分鐘前` : mins < 1440 ? `${Math.floor(mins / 60)} 小時前` : `${Math.floor(mins / 1440)} 天前`
}

onMounted(async () => {
  try {
    const list = await ReportsAPI.listReports({ page: 1, pageSize: 6, sortBy: 'createdAt', sortOrder: 'desc' })
    items.value = list.reports.slice(0, 6)
  } catch {
    items.value = []
  }
})
</script>

<style scoped>
.ro-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 8px;
  margin: 0;
  padding: 4px 8px;
  list-style: none;
}

.ro-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px 96px;
  gap: 16px;
  align-items: center;
  min-height: 60px;
  padding: 8px 12px;
  border-radius: var(--ui-r-inner);
  color: var(--ui-ink);
  font-size: 14px;
  text-decoration: none;
  transition: background var(--ui-dur) var(--ui-ease);
}

.ro-row:hover {
  background: var(--ui-fill);
}

.ro-row:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: -2px;
}

.ro-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.ro-pill {
  justify-self: start;
}

.ro-title {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ro-type {
  font-size: 13px;
  color: var(--ui-muted);
}

.ro-when {
  font-size: 13px;
  color: var(--ui-muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 1024px) {
  .ro-list {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .ro {
    display: none;
  }
}
</style>
