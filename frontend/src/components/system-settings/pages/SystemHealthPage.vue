<!--
  SystemHealthPage.vue
  Health check page. Signature: the verdict, three facts, and one row per service that carries its own latency
  bar on one shared scale (full track = the slowest scale shown in the caption), so the slow service reads at
  a glance. A service that was never checked has an empty track and says so in its pill.
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

      <template v-else>
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

          <p class="hscale">
            回應時間，各服務同一比例，滿格 = {{ latencyScale }} ms
          </p>
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
                class="hbar"
                :class="barTone(row)"
                aria-hidden="true"
              ><i :style="{ width: barWidth(row) }" /></span>
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

/** Bar fill on the shared scale; a service with no measurement has an empty track */
function barWidth(row: Row): string {
  if (row.latencyMs === null) { return '0%' }
  return `${Math.max(3, Math.min(100, Math.round((row.latencyMs / latencyScale.value) * 100)))}%`
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
  min-width: 0;
}

.hl {
  display: grid;
  padding: 28px 32px;
}

.hl-empty {
  grid-column: 1 / -1;
}

/* ---------- verdict ---------- */
.hl-side {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 460px);
  gap: 0 40px;
  align-items: start;
  min-width: 0;
}

.hl-side > .hlist,
.hl-side > .hnote,
.hl-side > .hscale {
  grid-column: 1 / -1;
}

.hl-side > .hl-facts {
  grid-column: 2;
  grid-row: 1 / span 3;
  margin: 0;
}

.hscale {
  margin: 22px 0 2px;
  font-size: 13px;
  color: var(--ui-muted);
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

.hbar {
  flex: none;
  width: clamp(120px, 30%, 320px);
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill);
}

.hbar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ui-green);
}

.hbar.warn i {
  background: var(--ui-orange);
}

.hbar.bad i {
  background: var(--ui-red);
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
    padding: 24px;
  }

  .hl-side {
    grid-template-columns: minmax(0, 1fr);
  }

  .hl-side > .hl-facts {
    grid-column: 1;
    grid-row: auto;
    margin: 18px 0 6px;
  }
}

/* phone: the verdict, the three facts, then the rows with their bars under the name */
@media (max-width: 768px) {
  .hl {
    padding: 20px 18px;
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
    row-gap: 6px;
  }

  .hrow .ui-pill {
    width: auto;
  }

  .hbar {
    order: 5;
    flex: none;
    width: calc(100% - 42px);
    margin-left: 42px;
  }

  .lat-n {
    min-width: 0;
  }
}
</style>
