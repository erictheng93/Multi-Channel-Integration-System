<!--
  SystemHealthPage.vue
  Health check page: overall verdict, counts and one row per service with its measured latency.
  Opening the page runs the plain check; 立即檢查 (page head) also runs the on-demand LINE webhook test.
-->

<template>
  <div class="health-stack">
    <article
      class="ui-card hero"
      :class="`tone-${overallTone}`"
    >
      <div
        class="hero-ico"
        aria-hidden="true"
      >
        <DiscRing
          class="hero-disc"
          :size="116"
          :weight="1.6"
          :tone="discTone"
          fade="strong"
          :grain="false"
          spin
        />
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            v-if="overallTone === 'ok'"
            d="M5 12.5 10 17.5 19 7"
          />
          <path
            v-else-if="overallTone === 'unknown'"
            d="M12 8v5M12 17h.01"
          />
          <template v-else>
            <path d="M12 8v5M12 17h.01" />
            <path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </template>
        </svg>
      </div>
      <div class="hero-main">
        <div class="hero-t">
          {{ heroTitle }}
        </div>
        <div class="hero-s">
          {{ heroSubtitle }}
        </div>
      </div>
      <div
        v-if="rows.length > 0"
        class="hero-stats"
      >
        <div class="hs g">
          <b>{{ counts.healthy }}</b><span>正常</span>
        </div>
        <div class="hs o">
          <b>{{ counts.warning }}</b><span>警告</span>
        </div>
        <div class="hs r">
          <b>{{ counts.critical }}</b><span>異常</span>
        </div>
      </div>
    </article>

    <SettingsGroup title="服務檢查">
      <UiEmptyState
        v-if="rows.length === 0"
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
          v-for="row in rows"
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
              class="lat-n"
              :class="row.tone"
            >
              <template v-if="row.latencyMs !== null">{{ row.latencyMs.toLocaleString() }}<small>ms</small></template>
              <template v-else>—</template>
            </span>
            <span class="lbar">
              <i
                v-if="row.latencyMs !== null"
                :class="row.tone"
                :style="{ width: `${barWidth(row.latencyMs)}%` }"
              />
            </span>
          </div>
          <span
            class="ui-pill ui-pill-dot"
            :class="pillClass(row.tone)"
          >{{ row.label }}</span>
        </li>
      </ul>
      <template #note>
        長條以 0 – {{ BAR_MAX_MS.toLocaleString() }} ms 為滿格。LINE webhook 只在按「立即檢查」時測試；若持續失敗，請到 LINE Developers 主控台對 Webhook URL 按「Verify」。
      </template>
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import DiscRing from '@/components/ui/DiscRing.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import { computed, inject, onMounted } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import SettingsGroup from '@/components/system-settings/SettingsGroup.vue'

type Tone = 'ok' | 'warn' | 'bad' | 'unknown'

interface Row {
  key: string
  name: string
  sub: string
  tone: Tone
  label: string
  latencyMs: number | null
}

const BAR_MAX_MS = 2000

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
  critical: rows.value.filter(row => row.tone === 'bad').length
}))

const discTone = computed(() => ({ ok: 'green', warn: 'orange', bad: 'red', unknown: 'muted' } as const)[overallTone.value])

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

const heroTitle = computed(() => {
  if (!controller.healthOverall.value) {
    return controller.processing.value ? '檢查中' : '尚未檢查'
  }
  if (counts.value.critical > 0) {
    return '系統異常'
  }
  if (counts.value.warning > 0) {
    return '部分降級'
  }
  return overallTone.value === 'ok' ? '系統正常' : '狀態未知'
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

function barWidth(latencyMs: number): number {
  return Math.max(1.5, Math.min(100, (latencyMs / BAR_MAX_MS) * 100))
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

.hero {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  padding: 20px 22px;
  background: var(--ui-surface);
}

.hero.tone-ok {
  background: linear-gradient(180deg, var(--ui-green-soft), transparent 90%), var(--ui-surface);
}

.hero.tone-warn {
  background: linear-gradient(180deg, var(--ui-orange-soft), transparent 90%), var(--ui-surface);
}

.hero.tone-bad {
  background: linear-gradient(180deg, var(--ui-red-soft), transparent 90%), var(--ui-surface);
}

.hero-ico {
  display: grid;
  flex: none;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: var(--ui-muted);
  color: #fff;
}

.tone-ok .hero-ico {
  background: var(--ui-green);
}

.tone-warn .hero-ico {
  background: var(--ui-orange);
}

.tone-bad .hero-ico {
  background: var(--ui-red);
}

.hero-ico > svg:not(.ui-disc) {
  position: relative;
  width: 28px;
  height: 28px;
}

/* Signature disc ring behind the status tile; fades out before the title text */
.hero-disc {
  position: absolute;
  top: 50%;
  left: 50%;
  translate: -50% -50%;
}

.hero-ico {
  position: relative;
}

.hero-main {
  flex: 1;
  min-width: 220px;
}

.hero-t {
  font: 600 22px / 1.2 var(--ui-font-display);
  letter-spacing: -0.02em;
}

.hero-s {
  margin-top: 3px;
  font-size: 13.5px;
  color: var(--ui-muted);
}

.hero-stats {
  display: flex;
  gap: 28px;
}

.hs {
  display: grid;
  gap: 2px;
}

.hs b {
  font: 600 26px / 1 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.hs span {
  font-size: 12px;
  color: var(--ui-muted);
}

.hs.g b {
  color: var(--ui-green-ink);
}

.hs.o b {
  color: var(--ui-orange-ink);
}

.hs.r b {
  color: var(--ui-red-ink);
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
  width: 74px;
  font: 600 14px var(--ui-font-display);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.lat-n small {
  margin-left: 2px;
  font-size: 11px;
  font-weight: 500;
  color: var(--ui-muted);
}

.lat-n.warn {
  color: var(--ui-orange-ink);
}

.lat-n.bad {
  color: var(--ui-red-ink);
}

.lbar {
  width: 120px;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill);
}

.lbar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ui-green);
}

.lbar i.warn {
  background: var(--ui-orange);
}

.lbar i.bad {
  background: var(--ui-red);
}

.hrow .ui-pill {
  justify-content: center;
  width: 62px;
}

.hrow .ui-row-sub {
  white-space: normal;
}

@media (max-width: 768px) {
  .lbar {
    display: none;
  }

  .lat-n {
    width: auto;
  }

  .hero-stats {
    gap: 24px;
    width: 100%;
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
