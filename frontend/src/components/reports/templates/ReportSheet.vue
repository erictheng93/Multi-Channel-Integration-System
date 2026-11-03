<!-- The report as a document: a real sample of what the template produces. Headline figures, then the breakdown as a
     table with bars on one shared scale. Every number is read from the latest completed JSON report of that type;
     with no report yet the cells are skeleton lines and the rail beside it says so. Nothing is invented. -->
<template>
  <article
    class="ui-lead sheet"
    :aria-label="`${template.name}的報表樣張`"
    :aria-busy="loading"
  >
    <header class="sh-mast">
      <div class="sh-title">
        <p class="sh-kind">
          報表樣張
        </p>
        <h2 class="sh-name">
          {{ template.name }}
        </h2>
      </div>
      <p class="sh-period">
        <span>統計期間</span>
        <b>{{ periodText }}</b>
      </p>
    </header>

    <p
      v-if="!isAgents"
      class="sh-hero"
    >
      <b>{{ live ? total.toLocaleString('en-US') : '—' }}</b>
      <span>個對話，統計期間內建立</span>
    </p>

    <dl
      v-else
      class="sh-kpis"
    >
      <div
        v-for="kpi in kpis"
        :key="kpi.label"
        class="sh-kpi"
      >
        <dt>
          <i
            v-if="kpi.tone"
            class="sh-dot"
            :class="kpi.tone"
          />{{ kpi.label }}
        </dt>
        <dd>
          <b>{{ kpi.value === null ? '—' : kpi.value.toLocaleString('en-US') }}</b>
          <small v-if="kpi.note">{{ kpi.note }}</small>
        </dd>
      </div>
    </dl>

    <div
      v-if="split.length"
      class="sh-compose"
    >
      <span
        class="sh-split-bar"
        aria-hidden="true"
      >
        <i
          v-for="part in split"
          :key="part.label"
          :class="part.tone"
          :style="{ flexGrow: part.value }"
        />
      </span>
      <p>{{ total.toLocaleString('en-US') }} 個對話依狀態分段，整條為 100%</p>
    </div>

    <table class="sh-table">
      <caption class="sh-cap">
        {{ tableTitle }}
      </caption>
      <thead>
        <tr>
          <th scope="col">
            {{ headLabel }}
          </th>
          <th
            scope="col"
            class="sh-col-bar"
          >
            {{ barLabel }}
          </th>
          <th
            scope="col"
            class="sh-col-n"
          >
            {{ countLabel }}
          </th>
        </tr>
      </thead>
      <tbody v-if="tableRows.length">
        <tr
          v-for="row in tableRows"
          :key="row.name"
        >
          <th scope="row">
            <i
              v-if="row.tone"
              class="sh-dot"
              :class="row.tone"
            />{{ row.name }}
          </th>
          <td class="sh-col-bar">
            <span
              class="sh-meter"
              aria-hidden="true"
            ><i
              :class="row.tone"
              :style="{ width: row.width }"
            /></span>
          </td>
          <td class="sh-col-n">
            <b>{{ row.value.toLocaleString('en-US') }}</b>
            <small v-if="row.share">{{ row.share }}</small>
          </td>
        </tr>
      </tbody>
      <tbody
        v-else
        aria-hidden="true"
      >
        <tr
          v-for="n in 4"
          :key="n"
          class="sh-skel"
        >
          <th scope="row">
            <i />
          </th>
          <td class="sh-col-bar">
            <i />
          </td>
          <td class="sh-col-n">
            <i />
          </td>
        </tr>
      </tbody>
      <tfoot v-if="foot">
        <tr>
          <th
            scope="row"
            colspan="2"
          >
            {{ foot.label }}
          </th>
          <td class="sh-col-n">
            <b>{{ foot.value }}</b>
          </td>
        </tr>
      </tfoot>
    </table>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ReportTemplate } from '@/types/reports'
import { isRecord, num, type LatestReport } from './latestReport'

const props = defineProps<{ template: ReportTemplate; state: LatestReport | null; loading: boolean }>()

type Tone = 'blue' | 'green' | 'grey'
interface Kpi { label: string; value: number | null; note?: string; tone?: Tone }
interface TableRow { name: string; value: number; width: string; share?: string; tone?: Tone }

const data = computed<Record<string, unknown>>(() => {
  const raw = props.state?.content?.data
  return isRecord(raw) ? raw : {}
})
const live = computed(() => !!props.state?.report && !!props.state?.content)

const dateFmt = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric' })
const periodText = computed(() => {
  const p = data.value.period
  if (isRecord(p) && typeof p.startDate === 'string' && typeof p.endDate === 'string') {
    const a = new Date(p.startDate)
    const b = new Date(p.endDate)
    if (!Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime())) { return `${dateFmt.format(a)} – ${dateFmt.format(b)}` }
  }
  return '近 30 天'
})

const pct = (part: number, total: number): string => (total > 0 ? `${Math.round((part / total) * 100)}%` : '')
const barWidth = (value: number, max: number): string => (value <= 0 ? '0%' : `${Math.max(3, Math.round((value / max) * 100))}%`)

const isAgents = computed(() => props.template.type === 'agent_performance')

const total = computed(() => num(data.value.totalConversations))
const split = computed<Array<{ label: string; value: number; tone: Tone }>>(() => {
  if (isAgents.value || !live.value) { return [] }
  const active = num(data.value.activeConversations)
  const done = num(data.value.completedConversations)
  const rest = Math.max(0, total.value - active - done)
  const parts: Array<{ label: string; value: number; tone: Tone }> = [
    { label: '進行中', value: active, tone: 'blue' },
    { label: '已結案', value: done, tone: 'green' },
    { label: '其他', value: rest, tone: 'grey' }
  ]
  return parts.filter(part => part.value > 0)
})

const agents = computed(() => (Array.isArray(data.value.agentMetrics) ? data.value.agentMetrics.filter(isRecord) : []).map(m => ({
  name: typeof m.agentName === 'string' && m.agentName ? m.agentName : '未命名客服',
  value: num(m.messagesHandled)
})))
const agentSum = computed(() => agents.value.reduce((sum, a) => sum + a.value, 0))

const kpis = computed<Kpi[]>(() => {
  const on = live.value
  if (isAgents.value) {
    const count = num(data.value.totalAgents) || agents.value.length
    return [
      { label: '客服人數', value: on ? count : null },
      { label: '訊息總數', value: on ? agentSum.value : null },
      { label: '平均每人', value: on && count > 0 ? Math.round(agentSum.value / count) : null }
    ]
  }
  const active = num(data.value.activeConversations)
  const done = num(data.value.completedConversations)
  return [
    { label: '對話總數', value: on ? total.value : null },
    { label: '進行中', value: on ? active : null, note: on ? `佔 ${pct(active, total.value)}` : '', tone: 'blue' },
    { label: '已結案', value: on ? done : null, note: on ? `佔 ${pct(done, total.value)}` : '', tone: 'green' }
  ]
})

const tableTitle = computed(() => (isAgents.value ? '各客服訊息數' : '對話狀態分布'))
const headLabel = computed(() => (isAgents.value ? '客服' : '狀態'))
const barLabel = computed(() => (isAgents.value ? '相對訊息量（最高者為滿格）' : '佔對話總數（滿格為 100%）'))
const countLabel = computed(() => (isAgents.value ? '訊息數' : '對話數'))

const SHOWN_AGENTS = 6
const tableRows = computed<TableRow[]>(() => {
  if (!live.value) { return [] }
  if (isAgents.value) {
    const max = Math.max(1, ...agents.value.map(a => a.value))
    return agents.value.slice(0, SHOWN_AGENTS).map(a => ({ ...a, width: barWidth(a.value, max) }))
  }
  const active = num(data.value.activeConversations)
  const done = num(data.value.completedConversations)
  const parts: Array<{ name: string; value: number; tone: Tone }> = [
    { name: '進行中', value: active, tone: 'blue' },
    { name: '已結案', value: done, tone: 'green' },
    { name: '其他', value: Math.max(0, total.value - active - done), tone: 'grey' }
  ]
  return parts.map(part => ({ ...part, width: barWidth(part.value, total.value), share: pct(part.value, total.value) }))
})

const foot = computed(() => {
  if (!live.value || !isAgents.value) { return null }
  if (isAgents.value) {
    const more = agents.value.length - SHOWN_AGENTS
    return { label: more > 0 ? `另有 ${more} 位未列出` : `共 ${agents.value.length} 位`, value: agentSum.value.toLocaleString('en-US') }
  }
  return { label: '合計', value: total.value.toLocaleString('en-US') }
})
</script>

<style scoped>
.sheet {
  display: flex;
  flex-direction: column;
  padding: 28px 32px 24px;
}

.sh-mast {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  justify-content: space-between;
}

.sh-title {
  display: grid;
  gap: 6px;
}

.sh-kind {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--section-ink);
}

.sh-name {
  margin: 0;
  font: 700 32px / 1.15 var(--ui-font-display);
  letter-spacing: -0.03em;
}

.sh-period {
  display: grid;
  gap: 2px;
  margin: 0;
  text-align: right;
  font-size: 13px;
  color: var(--ui-muted);
}

.sh-period b {
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-ink);
  font-variant-numeric: tabular-nums;
}

.sh-kpis {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 24px 0 0;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface-2);
}

.sh-kpi {
  display: grid;
  gap: 4px;
  padding: 18px 20px;
}

.sh-kpi + .sh-kpi {
  box-shadow: inset 0.5px 0 0 var(--ui-sep);
}

.sh-kpi dt {
  font-size: 14px;
  color: var(--ui-ink-2);
}

.sh-kpi dd {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin: 0;
}

.sh-kpi b {
  font: 700 36px / 1.1 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.sh-kpi small {
  font-size: 13px;
  color: var(--ui-muted);
}

.sh-hero {
  display: flex;
  gap: 12px;
  align-items: baseline;
  margin: 20px 0 0;
}

.sh-hero b {
  font: 700 56px / 1 var(--ui-font-display);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.sh-hero span {
  font-size: 15px;
  color: var(--ui-ink-2);
}

.sh-compose {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.sh-compose p {
  margin: 0;
  font-size: 13px;
  color: var(--ui-ink-2);
}

.sh-split-bar {
  display: flex;
  gap: 3px;
  height: 16px;
  overflow: hidden;
  border-radius: 999px;
}

.sh-split-bar i {
  flex-basis: 0;
  min-width: 6px;
  background: var(--ui-blue);
}

.sh-split-bar i.green,
.sh-dot.green,
.sh-meter i.green {
  background: var(--ui-green);
}

.sh-split-bar i.grey,
.sh-dot.grey,
.sh-meter i.grey {
  background: var(--ui-fill-strong);
}

.sh-dot.blue {
  background: var(--ui-blue);
}

.sh-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 8px;
  border-radius: 50%;
}

.sh-table {
  flex: 1;
  width: 100%;
  margin-top: 24px;
  border-collapse: collapse;
  table-layout: fixed;
}

.sh-cap {
  padding-bottom: 6px;
  text-align: left;
  font: 600 16px / 1.3 var(--ui-font-display);
  color: var(--ui-ink);
}

.sh-table thead th {
  padding: 8px 0;
  text-align: left;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
  border-bottom: 1px solid var(--ui-sep);
}

.sh-table thead .sh-col-n {
  text-align: right;
}

.sh-table tbody th,
.sh-table tbody td {
  padding: 12px 0;
  vertical-align: middle;
  border-bottom: 1px solid var(--ui-sep);
}

.sh-table tbody th {
  width: 112px;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
}

.sh-table .sh-col-bar {
  padding-right: 20px;
  padding-left: 20px;
}

.sh-col-n {
  width: 112px;
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.sh-col-n b {
  font-size: 16px;
  font-weight: 700;
}

.sh-col-n small {
  display: inline-block;
  min-width: 40px;
  margin-left: 8px;
  font-size: 13px;
  color: var(--ui-muted);
}

.sh-meter {
  display: block;
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill);
}

.sh-meter i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--ui-blue);
}

.sh-table tfoot th,
.sh-table tfoot td {
  padding: 14px 0 0;
  text-align: left;
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-ink-2);
}

.sh-table tfoot td {
  text-align: right;
}

.sh-skel i {
  display: block;
  height: 10px;
  border-radius: 999px;
  background: var(--ui-fill);
}

.sh-skel th i {
  width: 64px;
}

.sh-skel .sh-col-n i {
  width: 40px;
  margin-left: auto;
}

@media (max-width: 1024px) {
  .sheet {
    padding: 24px 24px 20px;
  }
}

@media (max-width: 768px) {
  .sheet {
    padding: 20px 18px 16px;
  }

  .sh-mast {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .sh-name {
    font-size: 26px;
  }

  .sh-period {
    display: flex;
    gap: 8px;
    align-items: baseline;
    text-align: left;
  }

  .sh-period b {
    font-size: 15px;
  }

  .sh-kpis {
    margin-top: 16px;
  }

  .sh-hero b {
    font-size: 44px;
  }

  .sh-kpi {
    padding: 12px;
  }

  .sh-kpi dt {
    font-size: 13px;
  }

  .sh-kpi dd {
    flex-direction: column;
    gap: 0;
  }

  .sh-kpi b {
    font-size: 26px;
  }

  .sh-table {
    margin-top: 20px;
  }

  /* the bar drops under the name so neither is truncated: name + count on one line, bar beneath */
  .sh-cap {
    display: block;
    width: 100%;
  }

  .sh-table thead {
    display: none;
  }

  .sh-table,
  .sh-table tbody,
  .sh-table tfoot {
    display: block;
  }

  .sh-table tbody tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px 12px;
    padding: 12px 0;
    box-shadow: 0 0.5px 0 var(--ui-sep);
  }

  .sh-table tbody th,
  .sh-table tbody td {
    width: auto;
    padding: 0;
    border: 0;
  }

  .sh-table tbody .sh-col-bar {
    grid-column: 1 / -1;
    grid-row: 2;
    padding: 0;
  }

  .sh-table tfoot tr {
    display: flex;
    justify-content: space-between;
  }

  .sh-table tfoot th,
  .sh-table tfoot td {
    width: auto;
  }
}
</style>
