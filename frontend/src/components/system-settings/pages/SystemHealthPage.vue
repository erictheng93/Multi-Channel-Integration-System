<!--
  SystemHealthPage.vue
  Health check page: overall verdict, counts and one row per service with its measured latency.
  Opening the page runs the plain check; 立即檢查 (page head) also runs the on-demand LINE webhook test.
-->

<template>
  <div class="health-stack">
    <RingLead
      kicker="整體狀態"
      :value="heroValue ?? '—'"
      :busy="controller.processing.value && !controller.healthOverall.value"
      :tone="leadToneName"
      :meaning="heroSubtitle"
      summary="服務狀態"
      :rings="healthRings"
      :center-value="`${counts.healthy}/${rows.length}`"
      center-label="服務正常"
      :size="144"
    >
      <ul
        v-if="rows.length > 0"
        class="hero-counts"
        aria-label="服務狀態統計"
      >
        <li :class="{ zero: counts.healthy === 0 }">
          <span class="dot g" />{{ counts.healthy }} 正常
        </li>
        <li :class="{ zero: counts.warning === 0 }">
          <span class="dot o" />{{ counts.warning }} 警告
        </li>
        <li :class="{ zero: counts.critical === 0 }">
          <span class="dot r" />{{ counts.critical }} 異常
        </li>
        <li v-if="counts.unchecked > 0">
          <span class="dot u" />{{ counts.unchecked }} 未檢查
        </li>
      </ul>
    </RingLead>

    <section aria-label="服務檢查">
      <h2 class="ui-group-label">
        服務檢查
      </h2>
      <div class="ui-group">
        <UiEmptyState
          v-if="serviceRows.length === 0"
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
        <ul
          v-else
          class="ui-list"
        >
          <li
            v-for="row in serviceRows"
            :key="row.key"
            class="ui-row is-flush hrow"
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
                <path
                  v-else-if="row.tone === 'unknown'"
                  d="M5 12h14"
                />
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
                {{ row.sub }}
              </div>
            </div>
            <div class="lat">
              <span
                v-if="row.latencyMs !== null"
                class="lat-track"
                aria-hidden="true"
              >
                <span
                  class="lat-bar"
                  :class="row.tone"
                  :style="{ width: `${barPct(row.latencyMs)}%` }"
                />
              </span>
              <span
                class="lat-n"
                :class="row.tone"
              >
                <template v-if="row.latencyMs !== null">{{ row.latencyMs.toLocaleString() }}<small>ms</small></template>
                <template v-else>—</template>
              </span>
            </div>
            <span
              class="ui-pill ui-pill-dot"
              :class="pillClass(row.tone)"
            >{{ row.label }}</span>
          </li>
        </ul>
      </div>
    </section>

    <section
      v-if="webhookRow"
      aria-label="LINE webhook"
    >
      <h2 class="ui-group-label">
        LINE webhook
      </h2>
      <div class="ui-group">
        <div
          class="hrow wh"
          :class="`is-${webhookRow.tone}`"
        >
          <span
            class="hstat"
            :class="webhookRow.tone"
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
                v-if="webhookRow.tone === 'ok'"
                d="M5 12.5 10 17.5 19 7"
              />
              <path
                v-else-if="webhookRow.tone === 'unknown'"
                d="M12 6.5V12l3.5 2"
              />
              <path
                v-else
                d="M12 8v5M12 17h.01"
              />
            </svg>
          </span>
          <div class="ui-row-main">
            <div class="ui-row-title">
              {{ webhookRow.name }}
            </div>
            <div class="ui-row-sub">
              {{ webhookRow.sub }}
            </div>
          </div>
          <span
            v-if="webhookRow.latencyMs !== null"
            class="lat-n"
            :class="webhookRow.tone"
          >{{ webhookRow.latencyMs.toLocaleString() }}<small>ms</small></span>
          <span
            class="ui-pill ui-pill-dot"
            :class="pillClass(webhookRow.tone)"
          >{{ webhookRow.label }}</span>
          <button
            v-if="webhookRow.tone === 'unknown'"
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="controller.processing.value"
            @click="controller.healthCheck(true)"
          >
            立即測試
          </button>
        </div>
      </div>
      <p class="ui-group-foot">
        LINE webhook 只在按「立即檢查」時測試；若持續失敗，請到 LINE Developers 主控台對 Webhook URL 按「Verify」。
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import RingLead from '@/components/lead/RingLead.vue'
import type { ServiceRing } from '@/components/ui/ServiceRings.vue'
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
      sub: '尚未檢查，按「立即檢查」才會測試',
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
      latencyMs: result.latencyMs ?? null
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

/** Bar length inside each row: relative to the slowest measured service, floored at 100 ms so 12 ms vs 64 ms is not exaggerated */
const latencyScale = computed(() =>
  Math.max(100, ...rows.value.map(row => row.latencyMs ?? 0)))
const barPct = (ms: number): number => Math.max(3, Math.round((ms / latencyScale.value) * 100))

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
  return overallTone.value === 'ok' ? '正常' : null
})

const leadToneName = computed(() => ({ ok: 'good', warn: 'warn', bad: 'bad', unknown: 'none' } as const)[overallTone.value])

/** One arc: services healthy of all listed (an unchecked LINE webhook leaves the arc open, which is the honest picture) */
const healthRings = computed<ServiceRing[]>(() => {
  if (rows.value.every(row => row.tone === 'unknown')) { return [] }
  return [{
    label: '服務正常',
    value: counts.value.healthy,
    total: rows.value.length,
    of: '項服務',
    hue: overallTone.value === 'bad' ? 'var(--ui-red)' : (overallTone.value === 'warn' ? 'var(--ui-orange)' : 'var(--ui-green)')
  }]
})

const heroSubtitle = computed(() => {
  if (!controller.healthOverall.value) {
    return '正在取得各項服務的狀態。'
  }
  const attention = rows.value.filter(row => row.tone === 'warn' || row.tone === 'bad')
  const summary = attention.length > 0
    ? `${attention.map(row => row.name).join('、')} 需要注意。`
    : `${counts.value.healthy} 項服務運作正常。`
  const checked = controller.healthCheckedAt.value
  const when = checked ? formatChecked(checked) : ''
  return when ? `${summary}${when} 檢查。` : summary
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

function pillClass(tone: Tone): string {
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

.lat-track {
  display: block;
  width: 140px;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill);
}

.lat-bar {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--ui-green);
}

.lat-bar.warn {
  background: var(--ui-orange);
}

.lat-bar.bad {
  background: var(--ui-red);
}

/* LINE webhook is its own on-demand state, not one more row of the always-on checks */
.wh {
  display: flex;
  align-items: center;
}

.wh .ui-pill {
  width: auto;
  min-width: 62px;
}

.wh.is-unknown .hstat {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
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
  background: var(--ui-accent);
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

.lat {
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
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

.hrow .ui-row-sub {
  white-space: normal;
}

@media (max-width: 768px) {
  .lat-n {
    width: auto;
  }

  /* the number already says it; the bar would squeeze the row's own text on a phone */
  .lat-track {
    display: none;
  }

  .wh {
    flex-wrap: wrap;
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
