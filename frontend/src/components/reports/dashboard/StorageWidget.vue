<!-- 報表檔案: how much downloadable output is stored and in which formats, from the loaded list -->
<template>
  <section
    class="stor"
    aria-label="報表檔案"
  >
    <h3 class="stor-h">
      報表檔案
    </h3>
    <p class="stor-sub">
      可下載的已完成報表
    </p>
    <div class="stor-total">
      <b>{{ files.length }}</b><span>份</span>
      <em>{{ totalSize }}</em>
    </div>
    <ul class="stor-rows">
      <li
        v-for="row in byFormat"
        :key="row.format"
      >
        <span class="stor-fmt">{{ row.format }}</span>
        <span
          class="stor-bar"
          aria-hidden="true"
        ><i :style="{ width: row.pct + '%' }" /></span>
        <span class="stor-n">{{ row.count }} 份</span>
      </li>
    </ul>
    <p
      v-if="soonest"
      class="stor-foot"
    >
      最早到期：{{ soonest }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ReportsAPI from '@/api/reports'
import type { ReportBase } from '@/types/reports'

const props = defineProps<{ reports: ReportBase[] }>()

const files = computed(() => props.reports.filter(r => r.status === 'completed' && !!r.downloadUrl))
const totalSize = computed(() => ReportsAPI.formatFileSize(files.value.reduce((sum, r) => sum + (r.fileSize ?? 0), 0)))
const byFormat = computed(() => {
  const counts = new Map<string, number>()
  for (const r of files.value) { counts.set(r.format.toUpperCase(), (counts.get(r.format.toUpperCase()) ?? 0) + 1) }
  const max = Math.max(1, ...counts.values())
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([format, count]) => ({ format, count, pct: Math.round((count / max) * 100) }))
})
const soonest = computed(() => {
  const times = files.value.map(r => (r.expiresAt ? new Date(r.expiresAt).getTime() : NaN)).filter(t => !Number.isNaN(t))
  if (!times.length) { return '' }
  const d = new Date(Math.min(...times))
  return `${d.getMonth() + 1}/${d.getDate()}`
})
</script>

<style scoped>
.stor {
  padding: 18px 20px 16px;
}

.stor-h {
  margin: 0;
  font: 600 17px / 1.3 var(--ui-font-display);
}

.stor-sub {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--ui-muted);
}

.stor-total {
  display: flex;
  gap: 4px;
  align-items: baseline;
  margin-top: 10px;
}

.stor-total b {
  font: 600 34px / 1.1 var(--ui-font-display);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.stor-total span {
  font-size: 14px;
  color: var(--ui-muted);
}

.stor-total em {
  margin-left: auto;
  font-size: 14px;
  font-style: normal;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.stor-rows {
  display: grid;
  gap: 8px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.stor-rows li {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 48px;
  gap: 12px;
  align-items: center;
  font-size: 13px;
}

.stor-fmt {
  font-weight: 600;
  color: var(--ui-ink-2);
}

.stor-bar {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill);
}

.stor-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ui-accent);
}

.stor-n {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink-2);
}

.stor-foot {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--ui-muted);
}
</style>
