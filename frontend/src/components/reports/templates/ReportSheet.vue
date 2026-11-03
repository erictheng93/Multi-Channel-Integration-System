<!-- The report as a document: a real sample of what the template produces. Masthead, three headline figures, then
     ONE chart with a labelled scale (a donut that sums to 100% for conversation states, bars on a shared 0-to-max axis
     for agents), and a footer naming the report the figures came from. Every number is read from the latest completed
     JSON report of that type; with no report yet the cells are skeleton lines. Nothing is invented. -->
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
        <b>{{ sheet.period }}</b>
      </p>
    </header>

    <dl class="sh-kpis">
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

    <section
      class="sh-chart"
      :aria-label="chartTitle"
    >
      <h3 class="sh-cap">
        {{ chartTitle }}
      </h3>

      <!-- conversation states: a donut, the whole ring is the period's conversations -->
      <div
        v-if="!sheet.isAgents"
        class="sh-donut"
      >
        <svg
          v-if="sheet.live && sheet.total > 0"
          class="sh-ring"
          viewBox="0 0 120 120"
          role="img"
          :aria-label="`共 ${sheet.total} 個對話：${ringSummary}`"
        >
          <circle
            class="sh-ring-bg"
            cx="60"
            cy="60"
            r="48"
          />
          <circle
            v-for="seg in segments"
            :key="seg.label"
            class="sh-ring-seg"
            :class="seg.tone"
            cx="60"
            cy="60"
            r="48"
            :stroke-dasharray="seg.dash"
            :stroke-dashoffset="seg.offset"
          />
          <text
            class="sh-ring-n"
            x="60"
            y="62"
            text-anchor="middle"
          >{{ sheet.total.toLocaleString('en-US') }}</text>
          <text
            class="sh-ring-u"
            x="60"
            y="82"
            text-anchor="middle"
          >個對話</text>
        </svg>
        <span
          v-else
          class="sh-ring-empty"
          aria-hidden="true"
        />
        <ul class="sh-legend">
          <template v-if="sheet.live">
            <li
              v-for="part in sheet.parts"
              :key="part.label"
            >
              <span class="sh-lg-name"><i
                class="sh-dot"
                :class="part.tone"
              />{{ part.label }}</span>
              <b>{{ part.value.toLocaleString('en-US') }}</b>
              <small>{{ pct(part.value, sheet.total) }}</small>
            </li>
            <li class="sh-lg-sum">
              <span class="sh-lg-name">整圈合計</span>
              <b>{{ sheet.total.toLocaleString('en-US') }}</b>
              <small>100%</small>
            </li>
          </template>
          <template v-else>
            <li
              v-for="n in 3"
              :key="n"
              class="sh-skel"
              aria-hidden="true"
            >
              <i />
            </li>
          </template>
        </ul>
      </div>

      <!-- agents: bars share one 0-to-max axis -->
      <div
        v-else
        class="sh-bars"
      >
        <ul v-if="bars.length">
          <li
            v-for="bar in bars"
            :key="bar.name"
          >
            <span class="sh-bn">{{ bar.name }}</span>
            <span
              class="sh-track"
              aria-hidden="true"
            ><i :style="{ width: bar.width }" /></span>
            <b>{{ bar.value.toLocaleString('en-US') }}</b>
          </li>
        </ul>
        <ul
          v-else
          aria-hidden="true"
        >
          <li
            v-for="n in 4"
            :key="n"
            class="sh-skel"
          >
            <i />
          </li>
        </ul>
        <div
          v-if="bars.length"
          class="sh-axis"
          aria-hidden="true"
        >
          <span class="sh-ticks">
            <em>0</em>
            <em>{{ Math.round(axisMax / 2).toLocaleString('en-US') }}</em>
            <em>{{ axisMax.toLocaleString('en-US') }}</em>
          </span>
        </div>
        <p
          v-if="bars.length"
          class="sh-axis-cap"
        >
          橫軸為訊息數，所有長條共用同一把尺<template v-if="more > 0">
            ・ 另有 {{ more }} 位未列出
          </template>
        </p>
      </div>
    </section>

    <footer class="sh-foot">
      <template v-if="loading">
        正在讀取最近一份報表…
      </template>
      <template v-else-if="state?.failed">
        <span class="is-warn">無法讀取最近一份報表的內容，你仍可直接產生新的報表。</span>
      </template>
      <template v-else-if="!state?.report">
        還沒有產生過。以 JSON 產生第一份後，樣張會填入實際數值。
      </template>
      <template v-else>
        樣張數值取自
        <router-link
          :to="`/reports/${state.report.id}`"
          class="sh-src"
        >
          {{ state.report.title }}
        </router-link>
        <span class="sh-ago"> ・ {{ relativeTime(state.report.completedAt ?? state.report.createdAt) }}</span>
      </template>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ReportTemplate } from '@/types/reports'
import { relativeTime, type LatestReport } from './latestReport'
import { readSheet, type Tone } from './sheetData'

const props = defineProps<{ template: ReportTemplate; state: LatestReport | null; loading: boolean }>()

interface Kpi { label: string; value: number | null; note?: string; tone?: Tone }

const sheet = computed(() => readSheet(props.template.type, props.state))

const pct = (part: number, total: number): string => (total > 0 ? `${Math.round((part / total) * 100)}%` : '')

const kpis = computed<Kpi[]>(() => {
  const s = sheet.value
  const on = s.live
  if (s.isAgents) {
    const count = s.agents.length
    return [
      { label: '客服人數', value: on ? count : null },
      { label: '訊息總數', value: on ? s.agentSum : null },
      { label: '平均每人', value: on && count > 0 ? Math.round(s.agentSum / count) : null }
    ]
  }
  const active = s.parts[0]?.value ?? 0
  const done = s.parts[1]?.value ?? 0
  return [
    { label: '對話總數', value: on ? s.total : null },
    { label: '進行中', value: on ? active : null, note: on ? `佔 ${pct(active, s.total)}` : '', tone: 'blue' },
    { label: '已結案', value: on ? done : null, note: on ? `佔 ${pct(done, s.total)}` : '', tone: 'green' }
  ]
})

const chartTitle = computed(() => (sheet.value.isAgents ? '各客服訊息數' : '對話狀態分布'))

// donut geometry: r = 48, segments are separated by a 3-unit gap
const CIRC = 2 * Math.PI * 48
const segments = computed(() => {
  const { parts, total } = sheet.value
  const visible = parts.filter(p => p.value > 0)
  const gap = visible.length > 1 ? 3 : 0
  let acc = 0
  return visible.map(p => {
    const len = (p.value / total) * CIRC
    const seg = { label: p.label, tone: p.tone, dash: `${Math.max(1, len - gap)} ${CIRC}`, offset: -acc }
    acc += len
    return seg
  })
})
const ringSummary = computed(() => sheet.value.parts.map(p => `${p.label} ${p.value}`).join('、'))

const SHOWN_AGENTS = 6
const axisMax = computed(() => Math.max(1, ...sheet.value.agents.slice(0, SHOWN_AGENTS).map(a => a.value)))
const bars = computed(() => sheet.value.agents.slice(0, SHOWN_AGENTS).map(a => ({
  ...a,
  width: a.value <= 0 ? '0%' : `${Math.max(2, (a.value / axisMax.value) * 100)}%`
})))
const more = computed(() => sheet.value.agents.length - SHOWN_AGENTS)
</script>

<style scoped>
.sheet {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 28px 32px 22px;
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
  margin: 0;
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

.sh-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 8px;
  border-radius: 50%;
  background: var(--ui-blue);
}

.sh-dot.green {
  background: var(--ui-green);
}

.sh-dot.grey {
  background: var(--ui-fill-strong);
}

.sh-chart {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
}

.sh-cap {
  margin: 0;
  font: 600 16px / 1.3 var(--ui-font-display);
  color: var(--ui-ink);
}

/* donut + legend */
.sh-donut {
  display: grid;
  flex: 1;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 32px;
  align-items: center;
}

.sh-ring {
  width: 200px;
  height: 200px;
  transform: rotate(-90deg);
}

.sh-ring circle {
  fill: none;
  stroke-width: 15;
}

.sh-ring-bg {
  stroke: var(--ui-fill);
}

.sh-ring-seg {
  stroke: var(--ui-blue);
  stroke-linecap: butt;
}

.sh-ring-seg.green {
  stroke: var(--ui-green);
}

.sh-ring-seg.grey {
  stroke: var(--ui-fill-strong);
}

.sh-ring text {
  fill: var(--ui-ink);
  transform: rotate(90deg);
  transform-origin: 60px 60px;
}

.sh-ring-n {
  font: 700 26px var(--ui-font-display);
  font-variant-numeric: tabular-nums;
}

.sh-ring .sh-ring-u {
  font: 500 12px var(--ui-font-ui);
  fill: var(--ui-muted);
}

.sh-ring-empty {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 15px var(--ui-fill);
}

.sh-legend {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sh-legend li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 52px;
  gap: 12px;
  align-items: baseline;
  padding: 14px 0;
  font-variant-numeric: tabular-nums;
}

.sh-legend li + li {
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.sh-lg-name {
  font-size: 15px;
  font-weight: 600;
}

.sh-legend b {
  font-size: 18px;
  font-weight: 700;
}

.sh-legend small {
  text-align: right;
  font-size: 14px;
  color: var(--ui-muted);
}

.sh-lg-sum .sh-lg-name,
.sh-lg-sum small {
  font-weight: 500;
  color: var(--ui-ink-2);
}

/* agent bars on one shared axis */
.sh-bars {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
}

.sh-bars ul {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sh-bars li {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr) 64px;
  gap: 16px;
  align-items: center;
}

.sh-bn {
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sh-track {
  display: block;
  height: 14px;
  border-radius: 999px;
  background: var(--ui-fill);
}

.sh-track i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--ui-blue);
}

.sh-bars li b {
  text-align: right;
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.sh-axis {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr) 64px;
  gap: 16px;
  margin-top: 10px;
}

.sh-ticks {
  display: flex;
  grid-column: 2;
  justify-content: space-between;
  padding-top: 6px;
  box-shadow: 0 -0.5px 0 var(--ui-field-edge);
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.sh-ticks em {
  font-style: normal;
}

.sh-axis-cap {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--ui-muted);
}

.sh-skel i {
  display: block;
  height: 14px;
  border-radius: 999px;
  background: var(--ui-fill);
}

.sh-foot {
  padding-top: 14px;
  box-shadow: 0 -0.5px 0 var(--ui-sep);
  font-size: 14px;
  color: var(--ui-ink-2);
}

.sh-foot .is-warn {
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

@media (max-width: 1024px) {
  .sheet {
    padding: 24px 24px 20px;
  }
}

@media (max-width: 768px) {
  .sheet {
    gap: 18px;
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

  .sh-donut {
    grid-template-columns: 132px minmax(0, 1fr);
    gap: 16px;
  }

  .sh-ring,
  .sh-ring-empty {
    width: 132px;
    height: 132px;
  }

  .sh-legend li {
    grid-template-columns: minmax(0, 1fr) auto 40px;
    gap: 8px;
    padding: 10px 0;
  }

  .sh-lg-name {
    font-size: 14px;
  }

  .sh-legend b {
    font-size: 16px;
  }

  /* name + count on one line, the bar beneath, so neither is truncated */
  .sh-bars li {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px 12px;
  }

  .sh-bars .sh-track {
    grid-column: 1 / -1;
    grid-row: 2;
    height: 10px;
  }

  .sh-axis {
    grid-template-columns: minmax(0, 1fr);
  }

  .sh-ticks {
    grid-column: 1;
  }
}
</style>
