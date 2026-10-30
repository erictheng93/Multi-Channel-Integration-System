<!-- The real output of the latest completed JSON report of one type. Nothing here is invented:
     every number is read from that report's file; with no report yet it is a proper empty state. -->
<template>
  <div
    class="rop"
    :aria-busy="loading"
  >
    <div
      v-if="loading"
      class="rop-state"
      role="status"
    >
      正在讀取最近一份報表…
    </div>

    <div
      v-else-if="failed"
      class="rop-state"
      role="alert"
    >
      無法讀取最近一份報表的內容，你仍可直接產生新的報表。
    </div>

    <div
      v-else-if="!latest"
      class="rop-empty"
    >
      <b>還沒有可預覽的報表</b>
      <span>以 JSON 產生一份之後，內容會顯示在這裡。報表會包含：</span>
      <ul class="rop-fields">
        <li
          v-for="item in fields"
          :key="item.label"
          class="ui-chip"
        >
          {{ item.label }}
        </li>
      </ul>
    </div>

    <template v-else>
      <div class="rop-meta">
        <span class="rop-from">此模板上次產出 ・ {{ ago }}</span>
        <router-link
          :to="`/reports/${latest.id}`"
          class="rop-title"
        >
          {{ latest.title }}
        </router-link>
        <span class="rop-sub">{{ metaLine }}</span>
      </div>

      <div
        v-if="lead"
        class="rop-lead"
      >
        <div class="rop-big">
          <span class="rop-big-label">{{ lead.label }}</span>
          <b class="rop-big-num">{{ lead.value.toLocaleString('en-US') }}</b>
        </div>
        <div
          v-if="split.length"
          class="rop-shares"
        >
          <div
            class="rop-split"
            role="img"
            :aria-label="split.map(part => `${part.label} ${part.value}`).join('，')"
          >
            <span
              v-for="part in split"
              :key="part.label"
              :class="part.tone"
              :style="{ flexGrow: part.value }"
            />
          </div>
          <ul class="rop-legend">
            <li
              v-for="metric in kpis.slice(1)"
              :key="metric.label"
            >
              <i
                class="rop-dot"
                :class="metric.tone"
              />{{ metric.label }}
              <b>{{ metric.value.toLocaleString('en-US') }}</b>
              <small v-if="share(metric)">{{ share(metric) }}</small>
            </li>
          </ul>
        </div>
      </div>

      <table
        v-if="rows.length"
        class="rop-table"
      >
        <caption class="rop-cap">
          {{ rowsCaption }}
        </caption>
        <thead>
          <tr>
            <th scope="col">
              {{ rowsHead[0] }}
            </th>
            <th
              v-for="head in rowsHead.slice(1)"
              :key="head"
              scope="col"
              class="num"
            >
              {{ head }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.name"
          >
            <th scope="row">
              {{ row.name }}
            </th>
            <td
              v-for="(cell, index) in row.cells"
              :key="index"
              class="num"
            >
              {{ cell.toLocaleString('en-US') }}
            </td>
          </tr>
        </tbody>
      </table>

      <p
        v-if="!metrics.length && !rows.length"
        class="rop-state"
      >
        這份報表目前沒有可顯示的統計值，請開啟完整報表查看。
      </p>

      <section
        v-if="earlier.length"
        class="rop-hist"
        aria-label="更早的產出"
      >
        <h3 class="rop-cap">
          更早的產出
        </h3>
        <ul>
          <li
            v-for="item in earlier"
            :key="item.id"
          >
            <router-link
              :to="`/reports/${item.id}`"
              class="rop-hrow"
            >
              <span class="rop-hname">{{ item.title }}</span>
              <span class="rop-hmeta">{{ item.format.toUpperCase() }} ・ {{ relative(item.completedAt ?? item.createdAt) }}</span>
              <span
                class="ui-pill"
                :class="statusClass(item.status)"
              >{{ statusText[item.status] ?? item.status }}</span>
            </router-link>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ReportsAPI from '@/api/reports'
import type { ReportBase, ReportType } from '@/types/reports'
import { REPORT_CONTENTS } from './templateHelpers'

const props = defineProps<{ type: ReportType }>()
const emit = defineEmits<{ resolved: [report: ReportBase | null] }>()

type Row = { name: string; cells: number[] }
type Loaded = { report: ReportBase | null; content: Record<string, unknown> | null; failed: boolean; recent: ReportBase[] }

const cache = new Map<ReportType, Loaded>()
const state = ref<Loaded | null>(null)
const loading = ref(false)
let token = 0

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

async function load(type: ReportType) {
  const mine = ++token
  const hit = cache.get(type)
  if (hit) {
    state.value = hit
    loading.value = false
    emit('resolved', hit.report)
    return
  }
  loading.value = true
  let result: Loaded = { report: null, content: null, failed: false, recent: [] }
  try {
    const list = await ReportsAPI.listReports({ type, page: 1, pageSize: 6, sortBy: 'createdAt', sortOrder: 'desc' })
    const recent = list.reports.filter(item => item.type === type)
    const report = recent.find(item => item.status === 'completed' && item.format === 'json') ?? null
    result = { report, content: null, failed: false, recent }
    if (report && report.format === 'json') {
      result.content = await ReportsAPI.getReportJsonContent(report.id)
    }
  } catch {
    result = { report: result.report, content: null, failed: true, recent: result.recent }
  }
  if (mine !== token) { return }
  cache.set(type, result)
  state.value = result
  loading.value = false
  emit('resolved', result.report)
}

watch(() => props.type, type => { void load(type) }, { immediate: true })

const latest = computed(() => state.value?.report ?? null)
const failed = computed(() => !!state.value?.failed)
const earlier = computed(() => (state.value?.recent ?? []).filter(item => item.id !== latest.value?.id).slice(0, 3))
const statusText: Record<string, string> = { completed: '已完成', generating: '生成中', pending: '待處理', failed: '失敗', expired: '已過期' }
const statusClass = (status: string) => ({ completed: 'ui-pill-green', generating: 'ui-pill-blue', pending: 'ui-pill-blue', failed: 'ui-pill-red' }[status] ?? '')
const fields = computed(() => REPORT_CONTENTS[props.type] ?? [])

/** The report file is { reportInfo, data }; data's shape depends on the type */
const data = computed<Record<string, unknown>>(() => {
  const raw = state.value?.content?.data
  return isRecord(raw) ? raw : {}
})

type Tone = 'blue' | 'green' | 'grey'
const metrics = computed<Array<{ label: string; value: number; tone?: Tone }>>(() => {
  const d = data.value
  if (props.type === 'conversation_summary') {
    return [
      { label: '對話總數', value: num(d.totalConversations) },
      { label: '進行中', value: num(d.activeConversations), tone: 'blue' },
      { label: '已結案', value: num(d.completedConversations), tone: 'green' }
    ]
  }
  if (props.type === 'agent_performance') {
    return [{ label: '客服人數', value: num(d.totalAgents) }]
  }
  if (props.type === 'message_statistics') {
    const s = isRecord(d.summary) ? d.summary : {}
    return [
      { label: '訊息總數', value: num(s.totalMessages) },
      { label: '客戶訊息', value: num(s.customerMessages), tone: 'blue' },
      { label: '客服訊息', value: num(s.agentMessages), tone: 'green' }
    ]
  }
  return []
})

const lead = computed(() => metrics.value[0] ?? null)

/** The same numbers as the tiles, drawn as shares of the total: the tiles act as the legend */
const split = computed(() => {
  const toned = metrics.value.filter(m => m.tone && m.value > 0)
  const total = metrics.value[0]?.value ?? 0
  if (!toned.length || total <= 0) { return [] }
  const rest = total - toned.reduce((sum, m) => sum + m.value, 0)
  const parts = toned.map(m => ({ label: m.label, value: m.value, tone: m.tone as Tone }))
  if (rest > 0) { parts.push({ label: '其他', value: rest, tone: 'grey' }) }
  return parts
})

/** The tiles double as the legend of the bar: the remainder gets its own grey tile so no segment is unlabelled */
const kpis = computed(() => {
  const rest = split.value.find(part => part.tone === 'grey')
  return rest ? [...metrics.value, { label: '其他', value: rest.value, tone: 'grey' as Tone }] : metrics.value
})

/** Share of the total, shown beside the coloured tiles so the bar has a scale */
const share = (metric: { value: number; tone?: Tone }): string => {
  const total = metrics.value[0]?.value ?? 0
  if (!metric.tone || total <= 0 || metric === metrics.value[0]) { return '' }
  return `${Math.round((metric.value / total) * 100)}%`
}

const rowsHead = computed(() =>
  props.type === 'message_statistics' ? ['訊息類型', '則數'] : ['客服', '對話', '訊息']
)
const rowsCaption = computed(() => (props.type === 'message_statistics' ? '依訊息類型' : '各客服的處理量'))

const rows = computed<Row[]>(() => {
  const d = data.value
  if (props.type === 'agent_performance' && Array.isArray(d.agentMetrics)) {
    return d.agentMetrics.filter(isRecord).slice(0, 4).map(m => ({
      name: typeof m.agentName === 'string' && m.agentName ? m.agentName : '未命名客服',
      cells: [num(m.conversationsHandled), num(m.messagesHandled)]
    }))
  }
  if (props.type === 'message_statistics' && Array.isArray(d.messagesByType)) {
    const totals = new Map<string, number>()
    for (const item of d.messagesByType.filter(isRecord)) {
      const key = typeof item.messageType === 'string' ? item.messageType : 'other'
      totals.set(key, (totals.get(key) ?? 0) + num(item.total))
    }
    const labels: Record<string, string> = { text: '文字', image: '圖片', file: '檔案', sticker: '貼圖', video: '影片', audio: '語音' }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key, total]) => ({ name: labels[key] ?? key, cells: [total] }))
  }
  return []
})

const dateFmt = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric' })
const period = computed(() => {
  const p = data.value.period
  if (!isRecord(p) || typeof p.startDate !== 'string' || typeof p.endDate !== 'string') { return '' }
  const a = new Date(p.startDate)
  const b = new Date(p.endDate)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) { return '' }
  return `${dateFmt.format(a)} – ${dateFmt.format(b)}`
})

function relative(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return mins < 1 ? '剛剛' : mins < 60 ? `${mins} 分鐘前` : mins < 1440 ? `${Math.floor(mins / 60)} 小時前` : `${Math.floor(mins / 1440)} 天前`
}

const ago = computed(() => (latest.value ? relative(latest.value.completedAt ?? latest.value.createdAt) : ''))
const metaLine = computed(() => {
  const r = latest.value
  if (!r) { return '' }
  const size = r.fileSize ? ` ・ ${ReportsAPI.formatFileSize(r.fileSize)}` : ''
  const span = period.value ? ` ・ 統計 ${period.value}` : ''
  return `${r.format.toUpperCase()}${size}${span}`
})
</script>

<style scoped>
.rop {
  display: grid;
  gap: 18px;
  align-content: start;
  min-width: 0;
}

.rop-state {
  margin: 0;
  padding: 28px 0;
  font-size: 14px;
  color: var(--ui-muted);
}

.rop-empty {
  display: grid;
  gap: 8px;
  justify-items: start;
  padding: 24px 0 8px;
}

.rop-empty b {
  font: 600 20px / 1.3 var(--ui-font-display);
  letter-spacing: -0.01em;
}

.rop-empty > span {
  font-size: 14px;
  color: var(--ui-ink-2);
}

.rop-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
}

.rop-meta {
  display: grid;
  gap: 2px;
}

.rop-from {
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-muted);
}

.rop-title {
  font: 600 17px / 1.3 var(--ui-font-display);
  color: var(--ui-ink);
  text-decoration: none;
  overflow-wrap: anywhere;
}

.rop-title:hover {
  color: var(--ui-accent);
}

.rop-sub {
  font-size: 13px;
  color: var(--ui-muted);
}

.rop-lead {
  display: grid;
  gap: 18px;
}

.rop-big {
  display: grid;
  gap: 2px;
}

.rop-big-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.rop-big-num {
  font: 700 72px / 1 var(--ui-font-display);
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}

.rop-shares {
  display: grid;
  gap: 12px;
}

.rop-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 28px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
  color: var(--ui-ink-2);
}

.rop-legend b {
  margin-left: 4px;
  font: 600 18px / 1 var(--ui-font-display);
  color: var(--ui-ink);
  font-variant-numeric: tabular-nums;
}

.rop-legend small {
  margin-left: 4px;
  font-size: 13px;
  color: var(--ui-muted);
}

.rop-hist {
  display: grid;
  gap: 4px;
}

.rop-hist ul {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rop-hist li + li {
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.rop-hrow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 14px;
  align-items: center;
  min-height: 48px;
  color: var(--ui-ink);
  font-size: 14px;
  text-decoration: none;
}

.rop-hname {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rop-hrow:hover .rop-hname {
  color: var(--ui-accent);
}

.rop-hmeta {
  color: var(--ui-ink-2);
  font-variant-numeric: tabular-nums;
}

.rop-split {
  display: flex;
  gap: 3px;
  height: 14px;
  overflow: hidden;
  border-radius: 999px;
}

.rop-split span {
  flex-basis: 0;
  min-width: 6px;
}

.rop-split .blue,
.rop-dot.blue {
  background: var(--ui-blue);
}

.rop-split .green,
.rop-dot.green {
  background: var(--ui-green);
}

.rop-split .grey,
.rop-dot.grey {
  background: var(--ui-fill-strong);
}

.rop-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  border-radius: 50%;
}

.rop-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.rop-cap {
  margin: 0;
  padding: 0 0 6px;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.rop-table th,
.rop-table td {
  padding: 8px 0;
  text-align: left;
  font-weight: 400;
  box-shadow: 0 0.5px 0 var(--ui-sep);
}

.rop-table thead th {
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}

.rop-table tbody th {
  font-weight: 600;
  color: var(--ui-ink);
}

.rop-table .num {
  width: 90px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 768px) {
  .rop-big-num {
    font-size: 56px;
  }

  .rop-hrow {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .rop-hmeta {
    display: none;
  }
}
</style>
