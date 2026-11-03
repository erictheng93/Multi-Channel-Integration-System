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
    <h4
      v-if="biggest.length"
      class="stor-cap"
    >
      佔空間最多
    </h4>
    <ul
      v-if="biggest.length"
      class="stor-files"
    >
      <li
        v-for="file in biggest"
        :key="file.id"
      >
        <span class="stor-fn">{{ file.title }}</span>
        <b>{{ file.size }}</b>
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
const biggest = computed(() => [...files.value]
  .filter(r => (r.fileSize ?? 0) > 0)
  .sort((a, b) => (b.fileSize ?? 0) - (a.fileSize ?? 0))
  .slice(0, 2)
  .map(r => ({ id: r.id, title: r.title, size: ReportsAPI.formatFileSize(r.fileSize ?? 0) })))
const soonest = computed(() => {
  const times = files.value.map(r => (r.expiresAt ? new Date(r.expiresAt).getTime() : NaN)).filter(t => !Number.isNaN(t))
  if (!times.length) { return '' }
  const d = new Date(Math.min(...times))
  return `${d.getMonth() + 1}/${d.getDate()}`
})
</script>

<style scoped>
.stor {
  display: flex;
  flex-direction: column;
  height: 100%;
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

.stor-cap {
  margin: 18px 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.stor-files {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.stor-files li {
  display: flex;
  gap: 12px;
  align-items: baseline;
  justify-content: space-between;
  padding: 7px 0;
  font-size: 14px;
}

.stor-files li + li {
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.stor-fn {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stor-files b {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.stor-foot {
  margin: auto 0 0;
  padding-top: 12px;
  font-size: 13px;
  color: var(--ui-muted);
}

/* the phone page is already long: the per-file ranking is a desktop rail filler */
@media (max-width: 768px) {
  .stor-cap,
  .stor-files {
    display: none;
  }
}
</style>
