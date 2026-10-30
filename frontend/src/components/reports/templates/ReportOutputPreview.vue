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
        <router-link
          :to="`/reports/${latest.id}`"
          class="rop-title"
        >
          {{ latest.title }}
        </router-link>
        <span class="rop-sub">{{ metaLine }}</span>
      </div>

      <div
        v-if="split.length"
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

      <dl
        v-if="metrics.length"
        class="rop-kpis"
      >
        <div
          v-for="metric in metrics"
          :key="metric.label"
          class="rop-kpi"
        >
          <dt>
            <i
              v-if="metric.tone"
              class="rop-dot"
              :class="metric.tone"
            />{{ metric.label }}
          </dt>
          <dd>{{ metric.value.toLocaleString('en-US') }}</dd>
        </div>
      </dl>

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

      <p
        v-if="period"
        class="rop-period"
      >
        統計期間 {{ period }}
      </p>
    </template>

    <section
      v-if="!loading && recent.length"
      class="rop-recent"
      aria-label="此類型最近的報表"
    >
      <h3 class="rop-recent-h">
        此類型最近的報表
      </h3>
      <ul>
        <li
          v-for="item in recent"
          :key="item.id"
        >
          <router-link :to="`/reports/${item.id}`">
            <span class="rr-title">{{ item.title }}</span>
            <span class="rr-meta">{{ statusText(item) }} ・ {{ item.format.toUpperCase() }}</span>
          </router-link>
        </li>
      </ul>
    </section>
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
type Loaded = { report: ReportBase | null; recent: ReportBase[]; content: Record<string, unknown> | null; failed: boolean }

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
  let result: Loaded = { report: null, recent: [], content: null, failed: false }
  try {
    const list = await ReportsAPI.listReports({ type, page: 1, pageSize: 6, sortBy: 'createdAt', sortOrder: 'desc' })
    const recent = list.reports.filter(item => item.type === type)
    const report = recent.find(item => item.status === 'completed' && item.format === 'json') ?? null
    result = { report, recent: recent.slice(0, 4), content: null, failed: false }
    if (report && report.format === 'json') {
      result.content = await ReportsAPI.getReportJsonContent(report.id)
    }
  } catch {
    result = { report: result.report, recent: result.recent, content: null, failed: true }
  }
  if (mine !== token) { return }
  cache.set(type, result)
  state.value = result
  loading.value = false
  emit('resolved', result.report)
}

watch(() => props.type, type => { void load(type) }, { immediate: true })

const latest = computed(() => state.value?.report ?? null)
const recent = computed(() => state.value?.recent ?? [])
const STATUS_TEXT: Record<string, string> = { completed: '已完成', generating: '生成中', pending: '待處理', failed: '失敗', expired: '已過期' }
const statusText = (r: ReportBase) => `${STATUS_TEXT[r.status] ?? r.status} ・ ${relative(r.completedAt ?? r.createdAt)}`
const failed = computed(() => !!state.value?.failed)
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

const rowsHead = computed(() =>
  props.type === 'message_statistics' ? ['訊息類型', '則數'] : ['客服', '對話', '訊息']
)
const rowsCaption = computed(() => (props.type === 'message_statistics' ? '依訊息類型' : '各客服的處理量'))

const rows = computed<Row[]>(() => {
  const d = data.value
  if (props.type === 'agent_performance' && Array.isArray(d.agentMetrics)) {
    return d.agentMetrics.filter(isRecord).slice(0, 5).map(m => ({
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

const metaLine = computed(() => {
  const r = latest.value
  if (!r) { return '' }
  const ago = relative(r.completedAt ?? r.createdAt)
  const size = r.fileSize ? ` ・ ${ReportsAPI.formatFileSize(r.fileSize)}` : ''
  return `最近一份 ・ ${ago}產生 ・ ${r.format.toUpperCase()}${size}`
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

.rop-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
  gap: 8px 24px;
  margin: 0;
}

.rop-split {
  display: flex;
  gap: 3px;
  height: 12px;
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

.rop-split .grey {
  background: var(--ui-fill-strong);
}

.rop-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 50%;
}

.rop-kpi {
  min-width: 0;
}

.rop-recent {
  padding-top: 14px;
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.rop-recent-h {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.rop-recent ul {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rop-recent a {
  display: flex;
  gap: 16px;
  align-items: baseline;
  justify-content: space-between;
  min-height: 44px;
  padding: 10px 0;
  color: var(--ui-ink);
  font-size: 14px;
  text-decoration: none;
}

.rop-recent a:hover .rr-title {
  color: var(--ui-accent);
}

.rr-title {
  min-width: 0;
  overflow: hidden;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rr-meta {
  flex: none;
  font-size: 13px;
  color: var(--ui-muted);
}

.rop-kpi dt {
  font-size: 13px;
  color: var(--ui-ink-2);
}

.rop-kpi dd {
  margin: 2px 0 0;
  font: 600 var(--ui-t-kpi) / 1.05 var(--ui-font-display);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.rop-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.rop-cap {
  padding: 0 0 6px;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.rop-table th,
.rop-table td {
  padding: 10px 0;
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

.rop-period {
  margin: 0;
  font-size: 13px;
  color: var(--ui-muted);
}

@media (max-width: 768px) {
  .rop-kpi dd {
    font-size: 28px;
  }
}
</style>
