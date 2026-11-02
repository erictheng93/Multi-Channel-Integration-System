<!--
  SystemHealthPage.vue
  Health check page. Signature: a latency radar. One axis per service, the distance from the centre is the
  measured response time on one shared scale (rings at 25 / 50 / 75 / 100 % of the scale), so the shape of the
  polygon shows at a glance which service is the slow one. A service that was never checked has no point,
  only a dashed marker. The verdict, three facts and one row per service sit beside it.
  Opening the page runs the plain check; 立即檢查 (page head) also runs the on-demand LINE webhook test.
-->

<template>
  <div class="health-stack">
    <article
      class="ui-lead hl"
      aria-label="整體狀態"
    >
      <UiEmptyState
        v-if="rows.length === 0"
        class="hl-empty"
        :title="controller.processing.value ? '檢查中...' : '尚無檢查結果'"
        :description="controller.processing.value ? '正在逐項檢查服務。' : '按右上角「立即檢查」開始。'"
      >
        <template #icon>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
        </template>
      </UiEmptyState>

      <template v-else>
        <figure
          class="radar"
          :class="radarTone"
          :aria-label="`各服務回應時間雷達圖，外圈 ${latencyScale} ms`"
        >
          <div class="radar-box">
            <svg
              class="radar-svg"
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              <circle
                v-for="ring in RINGS"
                :key="ring"
                class="r-ring"
                cx="50"
                cy="50"
                :r="RADIUS * ring"
              />
              <line
                v-for="spot in spots"
                :key="`ax-${spot.key}`"
                class="r-axis"
                x1="50"
                y1="50"
                :x2="spot.rimX"
                :y2="spot.rimY"
              />
              <polygon
                v-if="shape"
                class="r-shape"
                :points="shape"
              />
            </svg>
            <span
              v-for="spot in spots"
              :key="`dot-${spot.key}`"
              class="r-dot"
              :class="[spot.tone, { 'is-empty': !spot.measured }]"
              :style="{ left: `${spot.x}%`, top: `${spot.y}%` }"
              aria-hidden="true"
            />
            <div
              v-for="spot in spots"
              :key="`lb-${spot.key}`"
              class="r-label"
              :class="spot.side"
              :style="{ left: `${spot.lx}%`, top: `${spot.ly}%` }"
            >
              <span class="r-name">{{ spot.short }}</span>
              <span
                class="r-val"
                :class="spot.tone"
              >{{ spot.value }}</span>
            </div>
          </div>
          <figcaption class="radar-cap">
            離中心越遠越慢，外圈 {{ latencyScale }} ms
          </figcaption>
        </figure>

        <div class="hl-side">
          <header class="hl-top">
            <div
              class="hl-big"
              :class="mixed ? 'mixed' : overallTone"
              :aria-busy="(controller.processing.value && !controller.healthOverall.value) || undefined"
            >
              {{ heroValue ?? '—' }}
            </div>
            <span
              v-if="mixed"
              class="ui-pill ui-pill-orange"
            >{{ counts.unchecked }} 項待檢查</span>
            <ul
              v-else-if="counts.warning + counts.critical + counts.unchecked > 0"
              class="hero-counts"
              aria-label="服務狀態統計"
            >
              <li v-if="counts.warning > 0">
                <span class="dot o" />{{ counts.warning }} 警告
              </li>
              <li v-if="counts.critical > 0">
                <span class="dot r" />{{ counts.critical }} 異常
              </li>
              <li v-if="counts.unchecked > 0">
                <span class="dot u" />{{ counts.unchecked }} 未檢查
              </li>
            </ul>
          </header>
          <p class="hl-meaning">
            {{ heroSubtitle }}
          </p>
          <dl
            v-if="latencyFacts.length > 0"
            class="hl-facts"
          >
            <div
              v-for="fact in latencyFacts"
              :key="fact.label"
              class="hl-fact"
            >
              <dt>{{ fact.label }}</dt>
              <dd class="hl-fact-v">
                {{ fact.value }}<small v-if="fact.unit">{{ fact.unit }}</small>
              </dd>
              <dd class="hl-fact-sub">
                {{ fact.sub }}
              </dd>
            </div>
          </dl>

          <ul
            class="hlist"
            aria-label="服務檢查"
          >
            <li
              v-for="row in rows"
              :key="row.key"
              class="hrow"
              :class="{ 'is-unchecked': row.label === '未檢查' }"
            >
              <span
                class="hstat"
                :class="row.tone"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    v-if="row.tone === 'ok'"
                    d="M5 12.5 10 17.5 19 7"
                  />
                  <template v-else-if="row.tone === 'unknown'">
                    <circle
                      cx="12"
                      cy="12"
                      r="8.5"
                    />
                    <path d="M12 7.5V12l3 2" />
                  </template>
                  <path
                    v-else
                    d="M12 8v5M12 17h.01"
                  />
                </svg>
              </span>
              <div class="hrow-main">
                <div class="hrow-title">
                  {{ row.name }}
                </div>
                <div class="hrow-sub">
                  {{ row.sub }}<span
                    v-if="row.at"
                    class="row-at"
                  > · {{ row.at }}</span>
                </div>
              </div>
              <span
                class="lat-n"
                :class="barTone(row)"
              >
                <template v-if="row.latencyMs !== null">{{ row.latencyMs.toLocaleString() }}<small>ms</small></template>
              </span>
              <span
                class="ui-pill ui-pill-dot"
                :class="pillClass(row)"
              >{{ row.label }}</span>
            </li>
          </ul>
          <p class="hnote">
            LINE webhook 只在按「立即檢查」時測試；持續失敗請到 LINE Developers 對 Webhook URL 按「Verify」。
          </p>
        </div>
      </template>
    </article>
  </div>
</template>

<script setup lang="ts">
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import { computed, inject, onMounted } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'

type Tone = 'ok' | 'warn' | 'bad' | 'unknown'

interface Row {
  key: string
  name: string
  sub: string
  tone: Tone
  label: string
  latencyMs: number | null
  /** Wall time of the check that produced this row (HH:mm), when one has run */
  at?: string
}

const controller = inject(SETTINGS_CONTROLLER_KEY)
if (!controller) {
  throw new Error('SystemSettingsController not provided')
}

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  database: '連線檢查（SELECT 1）',
  cache: '工作階段與快取讀寫',
  r2: '附件與媒體 bucket',
  'durable_object': '即時連線與對話房間',
  queue: '訊息收件與延遲發送佇列'
}

function toneOf(status: string): Tone {
  if (status === 'healthy') {
    return 'ok'
  }
  if (status === 'warning') {
    return 'warn'
  }
  if (status === 'critical') {
    return 'bad'
  }
  return 'unknown'
}

const TONE_LABEL: Record<Tone, string> = { ok: '正常', warn: '警告', bad: '異常', unknown: '未知' }

const serviceRows = computed<Row[]>(() =>
  controller.healthCheckResults.value.map((item) => {
    const tone = toneOf(item.status)
    return {
      key: item.key,
      name: item.name,
      sub: tone === 'ok' ? (SERVICE_DESCRIPTIONS[item.key] ?? item.message) : item.message,
      tone,
      label: TONE_LABEL[tone],
      latencyMs: item.responseTime ?? null
    }
  })
)

const webhookRow = computed<Row | null>(() => {
  if (serviceRows.value.length === 0) {
    return null
  }
  const result = controller.healthLineWebhook.value
  if (!result) {
    return {
      key: 'lineWebhook',
      name: 'LINE webhook',
      sub: '簽章驗證與回應時間',
      tone: 'unknown',
      label: '未檢查',
      latencyMs: null
    }
  }
  if (result.status === 'success') {
    return {
      key: 'lineWebhook',
      name: 'LINE webhook',
      sub: '簽章驗證與回應時間',
      tone: 'ok',
      label: '正常',
      latencyMs: result.latencyMs ?? null,
      at: result.testedAt ? formatChecked(result.testedAt).replace('今天 ', '') : undefined
    }
  }
  if (result.status === 'skipped') {
    return {
      key: 'lineWebhook',
      name: 'LINE webhook',
      sub: '尚未設定 LINE 憑證，已略過',
      tone: 'unknown',
      label: '略過',
      latencyMs: null
    }
  }
  return {
    key: 'lineWebhook',
    name: 'LINE webhook',
    sub: result.detail || result.reason || result.message,
    tone: 'bad',
    label: '異常',
    latencyMs: result.latencyMs ?? null
  }
})

const rows = computed<Row[]>(() => (webhookRow.value ? [...serviceRows.value, webhookRow.value] : []))

const counts = computed(() => ({
  healthy: rows.value.filter(row => row.tone === 'ok').length,
  warning: rows.value.filter(row => row.tone === 'warn').length,
  critical: rows.value.filter(row => row.tone === 'bad').length,
  unchecked: rows.value.filter(row => row.tone === 'unknown').length
}))

/** Bar scale: the slowest measured service, floored at 100 ms so 12 ms vs 64 ms is not exaggerated */
const latencyScale = computed(() =>
  Math.max(100, ...rows.value.map(row => row.latencyMs ?? 0)))

const overallTone = computed<'ok' | 'warn' | 'bad' | 'unknown'>(() => {
  if (counts.value.critical > 0) {
    return 'bad'
  }
  if (counts.value.warning > 0) {
    return 'warn'
  }
  const overall = controller.healthOverall.value
  return overall ? toneOf(overall.status) : 'unknown'
})

/** Everything measured is fine but something was never checked: the headline must not read "all normal" */
const mixed = computed(() =>
  Boolean(controller.healthOverall.value) && counts.value.critical === 0 && counts.value.warning === 0 && counts.value.unchecked > 0)

const heroValue = computed<string | null>(() => {
  if (!controller.healthOverall.value) {
    return null
  }
  if (counts.value.critical > 0) {
    return '異常'
  }
  if (counts.value.warning > 0) {
    return '降級'
  }
  if (mixed.value) {
    return `${counts.value.healthy} 項正常`
  }
  return overallTone.value === 'ok' ? '正常' : null
})

/** Tone is the speed itself: under 100 ms is fine, up to 300 ms is slow, past that is a fault; a failing check is red whatever it measured */
function barTone(row: Row): string {
  if (row.tone === 'bad' || (row.latencyMs ?? 0) > 300) { return 'bad' }
  if (row.tone === 'warn' || (row.latencyMs ?? 0) > 100) { return 'warn' }
  return row.tone
}

/** Short name: the part in parentheses when a service has one (資料庫 (D1) -> D1) */
const shortName = (name: string): string => /\(([^)]+)\)\s*$/.exec(name)?.[1] ?? name

/** Three facts the list below does not already say: the mean, the slowest service and when it was checked */
const latencyFacts = computed(() => {
  const measured = serviceRows.value.filter(row => row.latencyMs !== null)
  if (measured.length === 0) { return [] }
  const mean = Math.round(measured.reduce((sum, row) => sum + (row.latencyMs ?? 0), 0) / measured.length)
  const slow = measured.reduce((a, b) => ((b.latencyMs ?? 0) > (a.latencyMs ?? 0) ? b : a))
  const checked = controller.healthCheckedAt.value
  return [
    { label: '平均回應', value: String(mean), unit: ' ms', sub: `${measured.length} 項服務` },
    { label: '最慢服務', value: String(slow.latencyMs), unit: ' ms', sub: shortName(slow.name) },
    ...(checked ? [{ label: '最近檢查', value: formatChecked(checked).replace('今天 ', ''), unit: '', sub: '今天' }] : []),
  ]
})

const heroSubtitle = computed(() => {
  if (!controller.healthOverall.value) {
    return '正在取得各項服務的狀態。'
  }
  const attention = rows.value.filter(row => row.tone === 'warn' || row.tone === 'bad')
  const unchecked = rows.value.filter(row => row.tone === 'unknown')
  const pending = unchecked.length > 0 ? `，${unchecked.map(row => row.name).join('、')} 尚未檢查` : ''
  if (attention.length > 0) {
    return `${attention.map(row => row.name).join('、')} 需要注意。`
  }
  if (unchecked.length > 0) {
    return `${unchecked.map(row => row.name).join('、')} 還沒有測試結果，按「立即檢查」補上。`
  }
  return `${counts.value.healthy} 項服務運作正常${pending}。`
})

function formatChecked(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const time = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
  return `今天 ${time}`
}

function pillClass(row: Row): string {
  const tone = row.tone
  if (row.label === '未檢查') {
    return 'ui-pill-orange'
  }
  if (tone === 'ok') {
    return 'ui-pill-green'
  }
  if (tone === 'warn') {
    return 'ui-pill-orange'
  }
  if (tone === 'bad') {
    return 'ui-pill-red'
  }
  return ''
}

/* ---------- latency radar ---------- */
const RADIUS = 34
const RINGS = [0.25, 0.5, 0.75, 1] as const
const LABEL_RADIUS = 45

const SHORT_NAME: Record<string, string> = {
  database: 'D1',
  cache: 'KV',
  r2: 'R2',
  'durable_object': 'DO',
  queue: 'Queue',
  lineWebhook: 'Webhook'
}

interface Spot {
  key: string
  short: string
  tone: 'ok' | 'warn' | 'bad'
  measured: boolean
  value: string
  x: number
  y: number
  rimX: number
  rimY: number
  lx: number
  ly: number
  side: 'top' | 'bottom' | 'left' | 'right'
}

const spots = computed<Spot[]>(() => {
  const count = rows.value.length
  return rows.value.map((row, index) => {
    const angle = (-90 + (360 / count) * index) * (Math.PI / 180)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const measured = row.latencyMs !== null
    // a failed check with no measurement sits on the rim; a never-checked service sits at the half ring
    const ratio = measured ? Math.min((row.latencyMs ?? 0) / latencyScale.value, 1) : row.tone === 'bad' ? 1 : 0.5
    const tone = barTone(row)
    const side = Math.abs(cos) < 0.2 ? (sin < 0 ? 'top' : 'bottom') : cos > 0 ? 'right' : 'left'
    // top and bottom labels sit centred on the axis; side labels start beside the rim
    const lr = side === 'top' || side === 'bottom' ? LABEL_RADIUS : LABEL_RADIUS - 7
    return {
      key: row.key,
      short: SHORT_NAME[row.key] ?? shortName(row.name),
      tone: tone === 'warn' || tone === 'bad' ? tone : 'ok',
      measured,
      value: measured ? `${row.latencyMs?.toLocaleString()} ms` : row.tone === 'bad' ? '異常' : '未檢查',
      x: 50 + RADIUS * ratio * cos,
      y: 50 + RADIUS * ratio * sin,
      rimX: 50 + RADIUS * cos,
      rimY: 50 + RADIUS * sin,
      lx: 50 + lr * cos,
      ly: 50 + lr * sin,
      side
    }
  })
})

/** The polygon joins the measured services only, in axis order */
const shape = computed(() => {
  const measured = spots.value.filter(spot => spot.measured)
  return measured.length >= 3 ? measured.map(spot => `${spot.x.toFixed(2)},${spot.y.toFixed(2)}`).join(' ') : ''
})

const radarTone = computed(() => {
  if (counts.value.critical > 0) { return 'bad' }
  return counts.value.warning > 0 ? 'warn' : 'ok'
})

// Plain check on open; the webhook test stays on-demand.
onMounted(() => {
  if (controller.healthCheckResults.value.length === 0) {
    void controller.healthCheck(false, false)
  }
})
</script>

<style scoped>
.health-stack {
  display: grid;
  min-width: 0;
}

/* radar left, verdict + services right */
.hl {
  display: grid;
  grid-template-columns: minmax(320px, 440px) minmax(0, 1fr);
  gap: 20px 40px;
  align-items: center;
  padding: 28px 32px;
}

.hl-empty {
  grid-column: 1 / -1;
}

/* ---------- radar ---------- */
.radar {
  --tone: var(--ui-green);
  --tone-soft: var(--ui-green-soft);

  display: grid;
  gap: 10px;
  margin: 0;
  min-width: 0;
}

.radar.warn {
  --tone: var(--ui-orange);
  --tone-soft: var(--ui-orange-soft);
}

.radar.bad {
  --tone: var(--ui-red);
  --tone-soft: var(--ui-red-soft);
}

.radar-box {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
}

.radar-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.r-ring {
  fill: none;
  stroke: var(--ui-sep);
  stroke-width: 0.4;
}

.r-ring:last-of-type {
  stroke-width: 0.6;
}

.r-axis {
  stroke: var(--ui-sep);
  stroke-width: 0.4;
}

.r-shape {
  fill: var(--tone-soft);
  stroke: var(--tone);
  stroke-linejoin: round;
  stroke-width: 0.9;
}

.r-dot {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--ui-green);
  box-shadow: 0 0 0 3px var(--ui-surface);
  transform: translate(-50%, -50%);
}

.r-dot.warn {
  background: var(--ui-orange);
}

.r-dot.bad {
  background: var(--ui-red);
}

.r-dot.is-empty {
  background: var(--ui-surface);
  box-shadow: inset 0 0 0 2px var(--ui-faint);
}

.r-label {
  position: absolute;
  display: grid;
  gap: 1px;
  line-height: 1.2;
  white-space: nowrap;
}

.r-label.top,
.r-label.bottom {
  justify-items: center;
  text-align: center;
  transform: translate(-50%, -50%);
}

.r-label.right {
  transform: translate(0, -50%);
}

.r-label.left {
  justify-items: end;
  text-align: right;
  transform: translate(-100%, -50%);
}

.r-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-muted);
}

.r-val {
  font: 600 15px var(--ui-font-display);
  font-variant-numeric: tabular-nums;
}

.r-val.warn {
  color: var(--ui-orange-ink);
}

.r-val.bad {
  color: var(--ui-red-ink);
}

.radar-cap {
  font-size: 13px;
  text-align: center;
  color: var(--ui-muted);
}

/* ---------- verdict ---------- */
.hl-side {
  display: grid;
  min-width: 0;
}

.hl-top {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  align-items: center;
}

.hl-big {
  font: 600 38px / 1.15 var(--ui-font-display);
  letter-spacing: -0.03em;
  color: var(--ui-ink);
}

.hl-big.ok {
  color: var(--ui-green-ink);
}

.hl-big.warn {
  color: var(--ui-orange-ink);
}

.hl-big.bad {
  color: var(--ui-red-ink);
}

.hl-big.mixed {
  color: var(--ui-ink);
}

.hl-big.unknown {
  color: var(--ui-muted);
}

.hl-meaning {
  margin: 4px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-ink-2);
}

/* three facts the list does not say, split by hairlines like the dashboard KPI strip */
.hl-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 18px 0 6px;
  padding: 14px 0;
  box-shadow: inset 0 0.5px 0 var(--ui-sep), inset 0 -0.5px 0 var(--ui-sep);
}

.hl-fact {
  display: grid;
  gap: 1px;
  align-content: start;
  padding: 0 16px;
  box-shadow: inset 0.5px 0 0 var(--ui-sep);
}

.hl-fact:first-child {
  padding-left: 0;
  box-shadow: none;
}

.hl-fact dt {
  font-size: 13px;
  color: var(--ui-muted);
}

.hl-fact-v {
  margin: 0;
  font: 600 26px / 1.2 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.hl-fact-v small {
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-muted);
}

.hl-fact-sub {
  margin: 0;
  font-size: 13px;
  color: var(--ui-muted);
}

.hero-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--ui-t-meta);
  font-weight: 600;
  color: var(--ui-ink-2);
  font-variant-numeric: tabular-nums;
}

.hero-counts li {
  display: inline-flex;
  gap: 7px;
  align-items: center;
}

.hero-counts .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.hero-counts .dot.o,
.hero-counts .dot.u {
  background: var(--ui-orange);
}

.hero-counts .dot.r {
  background: var(--ui-red);
}

/* ---------- service rows ---------- */
.hlist {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.hrow {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 11px 0;
}

.hrow + .hrow {
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

.hstat {
  display: grid;
  flex: none;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: var(--ui-fill);
  color: var(--ui-muted);
}

.hstat svg {
  width: 16px;
  height: 16px;
}

.hstat.ok {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.hstat.warn {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.hstat.bad {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

.hrow.is-unchecked .hstat {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.hrow-main {
  flex: 1;
  min-width: 0;
}

.hrow-title {
  font: 600 15px / 1.3 var(--ui-font-ui);
}

.hrow-sub {
  font-size: 13px;
  line-height: 1.4;
  color: var(--ui-muted);
}

.row-at {
  font-variant-numeric: tabular-nums;
}

.lat-n {
  min-width: 56px;
  font: 600 15px var(--ui-font-display);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.lat-n small {
  margin-left: 2px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}

.lat-n.warn {
  color: var(--ui-orange-ink);
}

.lat-n.bad {
  color: var(--ui-red-ink);
}

.hrow .ui-pill {
  justify-content: center;
  width: 62px;
}

.hnote {
  margin: 4px 0 0;
  padding-top: 12px;
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
  font-size: 13px;
  line-height: 1.55;
  color: var(--ui-muted);
}

@media (max-width: 1024px) {
  .hl {
    grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
    gap: 20px 28px;
    padding: 24px;
  }
}

/* phone: the radar first, then the verdict, then the rows */
@media (max-width: 768px) {
  .hl {
    grid-template-columns: minmax(0, 1fr);
    padding: 20px 18px;
  }

  .radar {
    width: min(100%, 340px);
    margin: 0 auto;
  }

  .hl-big {
    font-size: 32px;
  }

  .hl-fact {
    padding: 0 10px;
  }

  .hl-fact-v {
    font-size: 22px;
  }

  .row-at {
    display: none;
  }

  .hrow {
    flex-wrap: wrap;
    row-gap: 4px;
  }

  .hrow .ui-pill {
    width: auto;
  }

  .lat-n {
    min-width: 0;
  }
}
</style>
