<!-- The report as a document: the template's contents are the outline (a numbered spine), and each entry is filled with the
     real figure from the latest completed JSON report of that type. Nothing is invented: with no report yet the entries
     are skeleton lines and the note says so. -->
<template>
  <article
    class="ui-lead sheet"
    :aria-label="`${template.name}的報表樣張`"
    :aria-busy="loading"
  >
    <div class="sh-pane">
      <header class="sh-mast">
        <p class="sh-kind">
          報表樣張
        </p>
        <h2 class="sh-name">
          {{ template.name }}
        </h2>
        <dl class="sh-props">
          <div
            v-for="prop in docProps"
            :key="prop.k"
          >
            <dt>{{ prop.k }}</dt>
            <dd>{{ prop.v }}</dd>
          </div>
        </dl>
      </header>

      <p
        class="sh-note"
        :class="{ 'is-warn': failed }"
        :role="failed ? 'alert' : 'status'"
      >
        <template v-if="loading">
          正在讀取最近一份報表…
        </template>
        <template v-else-if="failed">
          無法讀取最近一份報表的內容，你仍可直接產生新的報表。
        </template>
        <template v-else-if="!latest">
          還沒有產生過。以 JSON 產生第一份後，下列欄位會填入實際數值。
        </template>
        <template v-else>
          數值取自
          <router-link
            :to="`/reports/${latest.id}`"
            class="sh-src"
          >
            {{ latest.title }}
          </router-link>
          <span class="sh-ago"> ・ {{ ago }}</span>
        </template>
      </p>
      <div class="sh-side">
        <slot name="side" />
      </div>
    </div>

    <ol class="sh-spine">
      <li
        v-for="(row, index) in rows"
        :key="row.label"
        class="sh-row"
      >
        <span
          class="sh-node"
          aria-hidden="true"
        >{{ index + 1 }}</span>
        <div class="sh-body">
          <div class="sh-head">
            <span class="sh-text">
              <b><i
                v-if="row.stat?.tone"
                class="sh-dot"
                :class="row.stat.tone"
              />{{ row.label }}</b>
              <span>{{ row.hint }}</span>
            </span>
            <span
              v-if="row.stat"
              class="sh-stat"
            >
              <b>{{ row.stat.value === null ? '—' : row.stat.value.toLocaleString('en-US') }}</b>
              <small v-if="row.stat.share">佔 {{ row.stat.share }}</small>
            </span>
            <span
              v-else-if="row.text"
              class="sh-when"
            >{{ row.text }}</span>
          </div>

          <ul
            v-if="row.bars?.length"
            class="sh-bars"
          >
            <li
              v-for="bar in row.bars"
              :key="bar.name"
            >
              <span class="sh-bar-name">{{ bar.name }}</span>
              <span
                class="sh-meter"
                aria-hidden="true"
              ><i :style="{ width: bar.width }" /></span>
              <span class="sh-bar-n">{{ bar.value.toLocaleString('en-US') }}</span>
            </li>
          </ul>

          <div
            v-if="row.split?.length"
            class="sh-split"
          >
            <span
              class="sh-split-bar"
              aria-hidden="true"
            >
              <i
                v-for="part in row.split"
                :key="part.label"
                :class="part.tone"
                :style="{ flexGrow: part.value }"
              />
            </span>
            <ul>
              <li
                v-for="part in row.split"
                :key="part.label"
              >
                <i
                  class="sh-dot"
                  :class="part.tone"
                />{{ part.label }}
                <b>{{ part.value.toLocaleString('en-US') }}</b>
              </li>
            </ul>
          </div>

          <span
            v-if="row.skeleton"
            class="sh-skel"
            aria-hidden="true"
          ><i /><i /><i /></span>
        </div>
      </li>
    </ol>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ReportTemplate } from '@/types/reports'
import { REPORT_CONTENTS, formatEstimatedTime } from './templateHelpers'
import { isRecord, num, relativeTime, type LatestReport } from './latestReport'

const props = defineProps<{ template: ReportTemplate; state: LatestReport | null; loading: boolean }>()

type Tone = 'blue' | 'green' | 'grey'
interface Row {
  label: string
  hint: string
  stat?: { value: number | null; share?: string; tone?: Tone }
  text?: string
  bars?: Array<{ name: string; value: number; width: string }>
  split?: Array<{ label: string; value: number; tone: Tone; plain?: boolean }>
  skeleton?: boolean
}

const latest = computed(() => props.state?.report ?? null)
const failed = computed(() => !!props.state?.failed)
const ago = computed(() => (latest.value ? relativeTime(latest.value.completedAt ?? latest.value.createdAt) : ''))

const docProps = computed(() => {
  const list = [{ k: '時間範圍', v: '近 30 天' }, { k: '輸出格式', v: 'JSON' }]
  const seconds = props.template.estimatedTime
  if (seconds) { list.push({ k: '預估耗時', v: `約 ${formatEstimatedTime(seconds)}` }) }
  return list
})

const data = computed<Record<string, unknown>>(() => {
  const raw = props.state?.content?.data
  return isRecord(raw) ? raw : {}
})
const hasData = computed(() => !!latest.value && !!props.state?.content)

const dateFmt = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric' })
const period = computed(() => {
  const p = data.value.period
  if (!isRecord(p) || typeof p.startDate !== 'string' || typeof p.endDate !== 'string') { return '' }
  const a = new Date(p.startDate)
  const b = new Date(p.endDate)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) { return '' }
  return `${dateFmt.format(a)} – ${dateFmt.format(b)}`
})

const pct = (part: number, total: number): string => (total > 0 ? `${Math.round((part / total) * 100)}%` : '')
const width = (value: number, max: number): string => `${Math.max(4, Math.round((value / max) * 100))}%`

/** One entry per REPORT_CONTENTS item, in order; the value kind is decided by the template's type and the entry's position.
    Only the two templates the backend can generate are drawn; any other type falls back to its plain outline. */
const rows = computed<Row[]>(() => {
  const items = REPORT_CONTENTS[props.template.type] ?? []
  const d = data.value
  const live = hasData.value
  const periodText = period.value || '近 30 天（預設）'

  if (props.template.type === 'conversation_summary') {
    const total = num(d.totalConversations)
    const active = num(d.activeConversations)
    const done = num(d.completedConversations)
    const rest = total - active - done
    const parts: NonNullable<Row['split']> = [
      { label: '進行中', value: active, tone: 'blue', plain: true },
      { label: '已結案', value: done, tone: 'green', plain: true },
      { label: '其他', value: rest, tone: 'grey' }
    ]
    const stat = (value: number, tone?: Tone): Row['stat'] => ({ value: live ? value : null, share: live && tone ? pct(value, total) : '', tone })
    return items.map((item, i): Row => {
      if (i === 0) { return { ...item, stat: stat(total), ...(live ? { split: parts.filter(part => part.value > 0) } : {}) } }
      if (i === 1) { return { ...item, stat: stat(active, 'blue') } }
      if (i === 2) { return { ...item, stat: stat(done, 'green') } }
      return { ...item, text: periodText }
    })
  }

  if (props.template.type === 'agent_performance') {
    const agents = (Array.isArray(d.agentMetrics) ? d.agentMetrics.filter(isRecord) : []).map(m => ({
      name: typeof m.agentName === 'string' && m.agentName ? m.agentName : '未命名客服',
      value: num(m.messagesHandled)
    }))
    const max = Math.max(1, ...agents.map(a => a.value))
    return items.map((item, i): Row => {
      if (i === 0) { return { ...item, stat: { value: live ? num(d.totalAgents) : null } } }
      if (i === 1) {
        return live
          ? { ...item, bars: agents.slice(0, 6).map(a => ({ ...a, width: width(a.value, max) })) }
          : { ...item, skeleton: true }
      }
      if (i === 2) { return { ...item, text: live ? `共 ${agents.length} 列` : '—' } }
      return { ...item, text: periodText }
    })
  }

  return items.map((item): Row => ({ ...item }))
})
</script>

<style scoped>
.sheet {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  min-height: 520px;
  overflow: hidden;
}

/* the document's left margin: title, properties, source and the actions; the outline reads on the right */
.sh-pane {
  display: flex;
  flex-direction: column;
  background: var(--ui-surface-2);
  box-shadow: inset -0.5px 0 0 var(--ui-sep);
}

.sh-side {
  display: grid;
  gap: 16px;
  margin-top: auto;
  padding: 20px 28px 28px;
}

.sh-side:empty {
  display: none;
}

.sh-mast {
  display: grid;
  gap: 6px;
  padding: 28px 28px 16px;
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

.sh-props {
  display: grid;
  gap: 4px;
  margin: 6px 0 0;
}

.sh-props div {
  display: flex;
  gap: 8px;
  align-items: baseline;
}

.sh-props dt {
  font-size: 14px;
  color: var(--ui-muted);
}

.sh-props dd {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.sh-note {
  margin: 0;
  padding: 0 28px;
  font-size: 14px;
  color: var(--ui-ink-2);
}

.sh-note.is-warn {
  color: var(--ui-red-ink);
}

.sh-src {
  font-weight: 600;
  color: var(--ui-accent);
  text-decoration: none;
  overflow-wrap: anywhere;
}

.sh-src:hover {
  text-decoration: underline;
}

.sh-ago {
  color: var(--ui-muted);
}

.sh-spine {
  display: grid;
  margin: 0;
  align-content: start;
  padding: 20px 36px 24px;
  list-style: none;
}

.sh-row {
  position: relative;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 16px;
  padding: 20px 0;
}

/* the spine: a hairline joining the numbered nodes */
.sh-row:not(:last-child)::before {
  position: absolute;
  top: 52px;
  bottom: -20px;
  left: 13.5px;
  width: 1.5px;
  background: var(--ui-fill-strong);
  content: '';
}

.sh-node {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  background: var(--section-hue-soft);
  font-size: 14px;
  font-weight: 700;
  color: var(--section-ink);
  font-variant-numeric: tabular-nums;
}

.sh-body {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.sh-head {
  display: flex;
  gap: 16px;
  align-items: baseline;
  justify-content: space-between;
}

.sh-text {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.sh-text b {
  font: 600 16px / 1.3 var(--ui-font-display);
}

.sh-text span {
  font-size: 14px;
  color: var(--ui-ink-2);
}

.sh-stat {
  display: flex;
  flex: none;
  gap: 10px;
  align-items: baseline;
}

.sh-stat b {
  font: 700 28px / 1.1 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.sh-stat small {
  font-size: 13px;
  color: var(--ui-muted);
}

.sh-when {
  flex: none;
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.sh-meter {
  display: block;
  height: 8px;
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

.sh-bars {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sh-bars li {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr) 56px;
  gap: 12px;
  align-items: center;
  font-size: 14px;
}

.sh-bar-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ui-ink-2);
}

.sh-bar-n {
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.sh-split {
  display: grid;
  gap: 10px;
}

.sh-split-bar {
  display: flex;
  gap: 3px;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
}

.sh-split-bar i {
  flex-basis: 0;
  min-width: 6px;
  background: var(--ui-blue);
}

.sh-split-bar i.green,
.sh-dot.green {
  background: var(--ui-green);
}

.sh-split-bar i.grey,
.sh-dot.grey {
  background: var(--ui-fill-strong);
}

.sh-dot.blue {
  background: var(--ui-blue);
}

.sh-split ul {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 24px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
  color: var(--ui-ink-2);
}

.sh-split b {
  margin-left: 6px;
  color: var(--ui-ink);
  font-variant-numeric: tabular-nums;
}

.sh-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 8px;
  border-radius: 50%;
}

.sh-skel {
  display: grid;
  gap: 8px;
}

.sh-skel i {
  display: block;
  height: 8px;
  border-radius: 999px;
  background: var(--ui-fill);
}

.sh-skel i:nth-child(1) {
  width: 92%;
}

.sh-skel i:nth-child(2) {
  width: 64%;
}

.sh-skel i:nth-child(3) {
  width: 38%;
}

@media (max-width: 1024px) {
  .sheet {
    min-height: 0;
    grid-template-columns: minmax(0, 1fr);
  }

  .sh-pane {
    box-shadow: 0 0.5px 0 var(--ui-sep);
  }
}

@media (max-width: 768px) {
  .sh-pane {
    display: contents;
  }

  .sh-mast {
    padding: 22px 20px 12px;
    background: var(--ui-surface-2);
  }

  .sh-side {
    order: 3;
    padding: 4px 20px 20px;
  }

  .sh-text span {
    display: none;
  }

  .sh-name {
    font-size: 26px;
  }

  .sh-note {
    padding: 0 20px 12px;
    background: var(--ui-surface-2);
  }

  .sh-spine {
    padding: 8px 20px 18px;
  }

  .sh-row {
    gap: 12px;
    padding: 12px 0;
  }

  .sh-row:not(:last-child)::before {
    top: 40px;
    bottom: -12px;
  }

  .sh-bars li {
    grid-template-columns: 64px minmax(0, 1fr) 48px;
    gap: 10px;
  }
}
</style>
