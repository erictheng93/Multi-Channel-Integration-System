<!--
  SystemHealthPage.vue
  Health check page. Signature: one verdict, a status strip with one segment per service (a service never checked
  is a dashed outline, not a colour), and one latency bar per service on a single zoned scale (green up to 100 ms,
  orange up to 300 ms, red past it) so "fast enough" is visible, not just short. LINE webhook has its own card
  because it only runs on demand: the card holds the inline test button and the last result.
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
        <div class="hl-top">
          <div class="hl-verdict">
            <div
              class="hl-big"
              :class="overallTone"
              :aria-busy="(controller.processing.value && !controller.healthOverall.value) || undefined"
            >
              {{ heroValue ?? '—' }}
            </div>
            <p class="hl-meaning">
              {{ heroSubtitle }}
            </p>
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
        </div>
      </template>
    </article>

    <div
      v-if="rows.length > 0"
      class="hgrid"
    >
      <section
        class="ui-card hsvc"
        aria-label="服務檢查"
      >
        <header class="ui-card-head hsvc-head">
          <div>
            <h2 class="ui-card-title">
              回應時間
            </h2>
            <div class="ui-card-sub">
              同一條時間軸，0 到 {{ latencyScale }} ms，越短越快
            </div>
          </div>
          <ul
            class="zones"
            aria-label="色區說明"
          >
            <li><i class="z-ok" />&le; {{ SLOW_MS }} ms</li>
            <li><i class="z-warn" />{{ SLOW_MS }}&ndash;{{ FAULT_MS }} ms</li>
            <li><i class="z-bad" />&gt; {{ FAULT_MS }} ms</li>
          </ul>
        </header>
        <ul
          class="hlist"
          :style="slowLine !== null ? { '--slow': `${slowLine}%` } : undefined"
        >
          <li
            class="haxis"
            aria-hidden="true"
          >
            <span class="haxis-track">
              <span
                v-for="(tick, i) in axisTicks"
                :key="tick"
                class="haxis-t"
                :class="{ 'is-first': i === 0, 'is-last': i === axisTicks.length - 1 }"
                :style="{ left: `${(tick / latencyScale) * 100}%` }"
              >{{ tick }}<template v-if="i === axisTicks.length - 1"> ms</template></span>
            </span>
          </li>
          <li
            v-for="row in rows"
            :key="row.key"
            class="hrow"
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
                {{ row.sub }}
              </div>
            </div>
            <span
              v-if="row.latencyMs !== null"
              class="hbar"
              :class="barTone(row)"
              aria-hidden="true"
            ><i :style="{ width: barWidth(row.latencyMs, latencyScale) }" /></span>
            <span
              v-else
              class="hbar-none"
            >
              <button
                v-if="row.key === 'lineWebhook'"
                type="button"
                class="btn btn-primary btn-sm"
                :aria-busy="controller.processing.value || undefined"
                @click="runWebhookTest"
              >
                {{ controller.processing.value ? '檢查中...' : '測試 webhook' }}
              </button>
              <template v-else>沒有量測值</template>
            </span>
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
        <footer
          v-if="webhookRow"
          class="hfoot"
        >
          <p>
            LINE webhook 只在你按下時才測試，結果只代表剛才那一次。持續失敗請到 LINE Developers，對 Webhook URL 按「Verify」。
          </p>
          <button
            v-if="webhookRow.latencyMs !== null"
            type="button"
            class="btn btn-secondary btn-sm"
            :aria-busy="controller.processing.value || undefined"
            @click="runWebhookTest"
          >
            {{ controller.processing.value ? '檢查中...' : '重新測試' }}
          </button>
        </footer>
      </section>
    </div>
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

/** Latency zones: up to SLOW_MS is fine, up to FAULT_MS is slow, past it is a fault */
const SLOW_MS = 100
const FAULT_MS = 300

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

/** Shared axis: 0 to the slow line, or to the slowest measurement (rounded up to 100) when something is past it, so short bars still differ */
const latencyScale = computed(() => {
  const slowest = Math.max(0, ...rows.value.map(row => row.latencyMs ?? 0))
  return Math.max(SLOW_MS, Math.ceil(slowest / 100) * 100)
})

/** Axis ticks: start, middle, end of the shared scale */
const axisTicks = computed(() => [0, latencyScale.value / 2, latencyScale.value])
/** Where the 100 ms "slow" line falls on the track, as a percent; null when it is the track end (nothing to draw) */
const slowLine = computed(() => (latencyScale.value > SLOW_MS ? (SLOW_MS / latencyScale.value) * 100 : null))

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
    ? { title: '無法完成檢查', description: '最近一次檢查沒有取得結果，按「立即檢查」重試。' }
    : { title: '尚無檢查結果', description: '按「立即檢查」開始。' }
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
    return `${counts.value.healthy} 項服務正常`
  }
  return overallTone.value === 'ok' ? '正常' : null
})

/** Tone is the speed itself: under 100 ms is fine, up to 300 ms is slow, past that is a fault; a failing check is red whatever it measured */
function barTone(row: Row): string {
  if (row.tone === 'bad' || (row.latencyMs ?? 0) > FAULT_MS) { return 'bad' }
  if (row.tone === 'warn' || (row.latencyMs ?? 0) > SLOW_MS) { return 'warn' }
  return row.tone
}

/** Short name: the part in parentheses when a service has one (資料庫 (D1) -> D1) */
const shortName = (name: string): string => /\(([^)]+)\)\s*$/.exec(name)?.[1] ?? name

/** The inline button runs the full check: the plain services plus the on-demand webhook probe */
function runWebhookTest(): void {
  if (!controller?.processing.value) {
    void controller?.healthCheck(true)
  }
}

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
  if (attention.length > 0) {
    return `${attention.map(row => row.name).join('、')} 需要注意。`
  }
  if (unchecked.length > 0) {
    return `${unchecked.map(row => row.name).join('、')} 尚未測試，不計入上面的結果；在列表中按「測試 webhook」補上。`
  }
  return `${counts.value.healthy} 項服務運作正常。`
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
function barWidth(ms: number | null, scale: number): string {
  if (ms === null) { return '0%' }
  return `${Math.max(3, Math.min(100, Math.round((ms / scale) * 100)))}%`
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
  gap: 16px;
  min-width: 0;
}

.hl {
  display: grid;
  gap: 22px;
  padding: 28px 32px;
}

.hl-empty {
  grid-column: 1 / -1;
}

/* ---------- verdict ---------- */
.hl-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 460px);
  gap: 0 40px;
  align-items: center;
  min-width: 0;
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
  margin: 0;
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

/* ---------- cards ---------- */
.hgrid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
}

.hsvc-head {
  align-items: flex-start;
  justify-content: space-between;
  padding: 22px 28px 8px;
}

.zones {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  color: var(--ui-ink-2);
}

.zones li {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  font-variant-numeric: tabular-nums;
}

.zones i {
  border-radius: 999px;
}

.zones i {
  width: 18px;
  height: 8px;
}

.z-ok {
  background: var(--ui-green);
}

.z-warn {
  background: var(--ui-orange);
}

.z-bad {
  background: var(--ui-red);
}

.hlist {
  --cols: 30px clamp(180px, 26%, 280px) minmax(160px, 1fr) 76px 62px;

  display: grid;
  margin: 0;
  padding: 0 28px 8px;
  list-style: none;
}

.hrow,
.haxis {
  display: grid;
  grid-template-columns: var(--cols);
  gap: 0 14px;
  align-items: center;
}

.hrow {
  padding: 13px 0;
}

/* axis: labels sit over the track column, so every bar below reads against the same ruler */
.haxis {
  padding: 4px 0 12px;
}

.haxis-track {
  position: relative;
  display: block;
  grid-column: 3;
  height: 20px;
  font-size: 13px;
  color: var(--ui-ink-2);
  font-variant-numeric: tabular-nums;
}

.haxis-t {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  white-space: nowrap;
}

.haxis-t::after {
  content: '';
  position: absolute;
  top: 20px;
  left: 50%;
  width: 1px;
  height: 6px;
  background: var(--ui-ink-2);
}

.haxis-t.is-first::after {
  left: 0;
}

.haxis-t.is-last::after {
  left: 100%;
}

.haxis-t.is-first {
  transform: none;
}

.haxis-t.is-last {
  transform: translateX(-100%);
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

.hstat.unknown {
  background: var(--ui-fill);
  color: var(--ui-ink-2);
}

.hrow-main {
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

/* the track is the legend: soft green to 100 ms, soft orange to 300 ms, soft red beyond; the fill is the measurement */
.hbar {
  position: relative;
  height: 14px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill-strong);
}

/* the thin line is the 100 ms "slow" mark, drawn only when the axis runs past it */
.hlist[style*='--slow'] .hbar {
  background-image: linear-gradient(90deg, transparent calc(var(--slow) - 0.5px), var(--ui-ink-2) calc(var(--slow) - 0.5px) calc(var(--slow) + 0.5px), transparent calc(var(--slow) + 0.5px));
}

.hbar-none {
  display: flex;
  min-width: 0;
  font-size: 13px;
  color: var(--ui-ink-2);
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
  min-width: 0;
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

/* ---------- webhook footnote: why it is manual (a plain note under the list, the test button lives in the row) ---------- */
.hfoot {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin: 0 28px;
  padding: 14px 0 22px;
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

.hfoot p {
  max-width: 78ch;
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--ui-ink-2);
}

.hfoot .btn {
  flex: none;
}

@media (max-width: 1024px) {
  .hl {
    padding: 24px;
  }

  .hl-top {
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
  }

  .hgrid {
    grid-template-columns: minmax(0, 1fr);
  }

  .hlist {
    --cols: 30px minmax(130px, 24%) minmax(100px, 1fr) 70px 62px;
  }
}

/* phone: verdict, strip, then rows with their bars under the name; the webhook card follows */
@media (max-width: 768px) {
  .hl {
    gap: 18px;
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

  .hsvc-head {
    padding: 18px 18px 6px;
  }

  .hlist {
    padding: 0 18px 10px;
  }

  .haxis {
    display: none;
  }

  .hrow {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
  }

  .hrow .ui-pill {
    width: auto;
  }

  .hrow-main {
    flex: 1;
  }

  .hrow .hbar {
    order: 5;
    flex: none;
    width: calc(100% - 42px);
    margin-left: 42px;
  }

  .hfoot {
    flex-direction: column;
    align-items: stretch;
    margin: 0 18px;
    padding: 14px 0 18px;
  }

  /* the webhook row: the test button sits full width under the name, where the bar would be */
  .hrow .hbar-none {
    flex: none;
    order: 5;
    width: calc(100% - 42px);
    margin-left: 42px;
  }

  .hrow .hbar-none .btn {
    width: 100%;
  }
}
</style>
