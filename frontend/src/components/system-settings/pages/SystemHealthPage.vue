<!--
  SystemHealthPage.vue
  Health check page: overall verdict, counts and one row per service with its measured latency.
  Opening the page runs the plain check; 立即檢查 (page head) also runs the on-demand LINE webhook test.
-->

<template>
  <div class="health-stack">
    <article
      class="ui-lead hl"
      aria-label="整體狀態"
    >
      <div class="hl-main">
        <div class="hl-kicker">
          整體狀態
        </div>
        <div
          class="hl-big"
          :class="mixed ? 'mixed' : overallTone"
          :aria-busy="(controller.processing.value && !controller.healthOverall.value) || undefined"
        >
          {{ heroValue ?? '—' }}
        </div>
        <span
          v-if="mixed"
          class="ui-pill ui-pill-orange hl-badge"
        >{{ counts.unchecked }} 項待檢查</span>
        <p
          v-if="!mixed"
          class="hl-meaning"
        >
          {{ heroSubtitle }}
        </p>
        <ul
          v-if="rows.length > 0 && !mixed"
          class="hero-counts"
          aria-label="服務狀態統計"
        >
          <li>
            <span class="dot g" />{{ counts.healthy }} 正常
          </li>
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
      </div>
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
    </article>

    <section aria-label="服務檢查">
      <h2 class="ui-group-label">
        服務檢查
        <span class="label-note">條長為回應時間，滿格 {{ latencyScale }} ms</span>
      </h2>
      <div class="ui-group">
        <UiEmptyState
          v-if="rows.length === 0"
          :title="emptyState.title"
          :description="emptyState.description"
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
        <ul
          v-else
          class="ui-list"
        >
          <li
            class="hscale"
            aria-hidden="true"
          >
            <span class="hscale-ruler">
              <span class="t0">0</span>
              <span class="t1">{{ latencyScale / 2 }}</span>
              <span class="t2">{{ latencyScale }} ms</span>
            </span>
          </li>
          <li
            v-for="row in rows"
            :key="row.key"
            class="ui-row is-flush hrow"
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
            <div class="ui-row-main">
              <div class="ui-row-title">
                {{ row.name }}
              </div>
              <div class="ui-row-sub">
                {{ row.sub }}<span
                  v-if="row.at"
                  class="row-at"
                > · {{ row.at }}</span>
              </div>
            </div>
            <span
              class="lat-bar"
              :class="barTone(row)"
              aria-hidden="true"
            ><i
              v-if="row.latencyMs !== null"
              :style="{ width: barWidth(row.latencyMs) }"
            /><em v-else-if="row.label === '未檢查'">尚未測試</em></span>
            <span
              class="lat-n"
              :class="row.tone"
            >
              <template v-if="row.latencyMs !== null">{{ row.latencyMs.toLocaleString() }}<small>ms</small></template>
            </span>
            <span
              class="ui-pill ui-pill-dot"
              :class="pillClass(row)"
            >{{ row.label }}</span>
          </li>
          <li class="hnote">
            <span
              class="hnote-ico"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              ><circle
                cx="12"
                cy="12"
                r="9"
              /><path d="M12 11v5M12 8h.01" /></svg>
            </span>
            <p>LINE webhook 只在按「立即檢查」時測試；持續失敗請到 LINE Developers 對 Webhook URL 按「Verify」。</p>
          </li>
        </ul>
      </div>
    </section>
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
const checkFailed = computed(() => !controller.processing.value && !!controller.healthCheckError.value)

const emptyState = computed(() => {
  if (controller.processing.value) {
    return { title: '檢查中...', description: '正在逐項檢查服務。' }
  }
  return checkFailed.value
    ? { title: '無法完成檢查', description: '最近一次檢查沒有取得結果，按右上角「立即檢查」重試。' }
    : { title: '尚無檢查結果', description: '按右上角「立即檢查」開始。' }
})

const heroValue = computed<string | null>(() => {
  if (!controller.healthOverall.value) {
    return checkFailed.value ? '狀態不明' : null
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

/** Bars share one scale: the slowest measured service fills the track, floored at 100 ms so 12 vs 64 ms is not exaggerated */
function barWidth(ms: number): string {
  return `${Math.max(4, Math.round((ms / latencyScale.value) * 100))}%`
}

/** Bar colour is the speed itself: under 100 ms is fine, up to 300 ms is slow, past that is a fault; a failing check is red whatever it measured */
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
    return checkFailed.value
      ? `最近一次檢查失敗：${controller.healthCheckError.value}`
      : '正在取得各項服務的狀態。'
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
  gap: 22px;
  min-width: 0;
}

.hl {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 24px 56px;
  align-items: center;
  padding: 24px 32px;
}

.hl-kicker {
  font-size: 15px;
  font-weight: 600;
  color: var(--section-ink);
}

.hl-big {
  margin-top: 2px;
  font: 600 52px / 1.1 var(--ui-font-display);
  letter-spacing: -0.035em;
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
  font-size: 52px;
  color: var(--ui-ink);
}

.hl-badge {
  margin-top: 8px;
}

.hl-big.unknown {
  color: var(--ui-muted);
}

.hl-meaning {
  margin: 4px 0 0;
  font-size: 15px;
  color: var(--ui-ink-2);
}

/* three facts the list does not say, split by hairlines like the dashboard KPI strip */
.hl-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
}

.hl-fact {
  display: grid;
  gap: 2px;
  align-content: start;
  padding: 4px 20px;
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
  font: 600 40px / 1.15 var(--ui-font-display);
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
  gap: 6px 20px;
  margin: 14px 0 0;
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

/* A zero is not news: quiet it down */
.hero-counts li.zero {
  font-weight: 500;
  color: var(--ui-muted);
}

.hero-counts .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.hero-counts .dot.g {
  background: var(--ui-green);
}

.hero-counts .dot.o {
  background: var(--ui-orange);
}

.hero-counts .dot.r {
  background: var(--ui-red);
}

.hero-counts .dot.u {
  background: var(--ui-orange);
}

.hero-counts li.zero .dot {
  background: var(--ui-fill-strong);
}

.hrow {
  padding: 14px 22px;
  gap: 14px;
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

.lat-bar {
  display: block;
  flex: 1;
  min-width: 0;
  height: 12px;
  overflow: hidden;
  border-radius: 999px;
  /* ruler: faint ticks at each quarter of the scale */
  background:
    linear-gradient(90deg, transparent calc(25% - 0.5px), var(--ui-surface) calc(25% - 0.5px) calc(25% + 0.5px), transparent calc(25% + 0.5px)),
    linear-gradient(90deg, transparent calc(50% - 0.5px), var(--ui-surface) calc(50% - 0.5px) calc(50% + 0.5px), transparent calc(50% + 0.5px)),
    linear-gradient(90deg, transparent calc(75% - 0.5px), var(--ui-surface) calc(75% - 0.5px) calc(75% + 0.5px), transparent calc(75% + 0.5px)),
    var(--ui-fill-strong);
}

.lat-bar:empty {
  background: transparent;
}

.lat-bar em {
  display: block;
  padding: 0 14px;
  font-size: 13px;
  font-style: normal;
  color: var(--ui-muted);
}

.lat-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ui-green);
}

.lat-bar.warn i {
  background: var(--ui-orange);
}

.lat-bar.bad i {
  background: var(--ui-red);
}

.lat-n {
  width: 64px;
  font: 600 14px var(--ui-font-display);
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

.row-at {
  font-variant-numeric: tabular-nums;
}

/* a footnote under the list, not a grey box inside it */
.hnote {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin: 4px 22px 0;
  padding: 14px 0 16px;
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

.hnote p {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  color: var(--ui-ink-2);
}

/* the bars start right after the service name; this row labels their scale */
.hscale {
  display: flex;
  gap: 14px;
  padding: 10px 22px 0;
  font-size: 12px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.hscale::before {
  content: '';
  flex: 0 0 calc(30px + 14px + 230px);
}

.hscale-ruler {
  position: relative;
  flex: 1;
  height: 16px;
  min-width: 0;
}

.hscale-ruler span {
  position: absolute;
  top: 0;
  white-space: nowrap;
}

.hscale-ruler .t0 {
  left: 0;
}

.hscale-ruler .t1 {
  left: 50%;
  transform: translateX(-50%);
}

.hscale-ruler .t2 {
  right: 0;
}

.hscale::after {
  content: '';
  flex: 0 0 calc(64px + 14px + 62px);
}

/* the unchecked service keeps the grid: a dashed empty track and a filled button say "needs a press" */
.hrow.is-unchecked .hstat {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.hrow.is-unchecked .lat-bar {
  height: 28px;
  background: none;
  box-shadow: inset 0 0 0 1.5px var(--ui-fill-strong);
}

.hrow.is-unchecked .lat-bar em {
  line-height: 28px;
}

.hnote-ico {
  display: grid;
  flex: none;
  place-items: center;
  width: 22px;
  height: 22px;
  color: var(--ui-muted);
}

.hnote-ico svg {
  width: 18px;
  height: 18px;
}

.hrow .ui-row-sub {
  white-space: normal;
}

.hrow .ui-row-main {
  flex: 0 0 230px;
}

@media (max-width: 1024px) {
  .hscale {
    display: none;
  }

  .hrow .ui-row-main {
    flex: 1 1 200px;
  }

  .hl {
    grid-template-columns: minmax(0, 1fr);
    padding: 22px 24px;
  }

  .hl-fact {
    padding: 4px 16px;
  }
}

@media (max-width: 768px) {
  .hl {
    padding: 20px;
  }

  .hl-big {
    font-size: 40px;
  }

  .hl-fact-v {
    font-size: 24px;
  }

  .row-at {
    display: none;
  }

  /* the bar sits under the row text, aligned with it (the 30px tile and the gap come first) */
  .lat-bar {
    order: 9;
    flex: 1 0 calc(100% - 44px);
    width: auto;
    height: 8px;
    margin: -4px 0 0 44px;
  }

  .lat-bar:empty {
    display: none;
  }

  .hnote {
    margin: 6px 10px 10px;
    padding: 12px 14px;
  }

  .lat-n {
    width: auto;
  }

  .hrow {
    flex-wrap: wrap;
  }

  .hrow .ui-row-main {
    flex-basis: 150px;
  }

  .hrow {
    gap: 12px;
    padding: 14px 18px;
  }

  .hrow .ui-pill {
    width: auto;
  }
}
</style>
