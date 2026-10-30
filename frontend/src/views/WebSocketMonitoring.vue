<template>
  <AppLayout>
    <div class="ui-page rl-page websocket-monitoring">
      <UiPageHead
        title="即時連線監控"
        :subtitle="subtitle"
      >
        <template #actions>
          <span class="live">
            自動更新
            <button
              type="button"
              class="ui-switch"
              role="switch"
              :aria-checked="autoRefresh"
              :title="`每 ${POLL_SECONDS} 秒更新一次`"
              aria-label="自動更新"
              @click="autoRefresh = !autoRefresh"
            />
          </span>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="isRefreshing"
            @click="refreshData"
          >
            <svg
              class="ico"
              :class="{ spinning: isRefreshing }"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            ><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M3 21v-5h5" /></svg>
            重新整理
          </button>
        </template>
      </UiPageHead>

      <!-- 錯誤訊息 -->
      <div
        v-if="error"
        class="error-message"
        role="alert"
      >
        {{ error }}
      </div>

      <!-- Lead: the registered connections now, and the trend that explains them, in one object -->
      <section class="bento">
        <article class="ui-lead board s12">
          <div class="board-main">
            <div class="board-kicker">
              已註冊連線
            </div>
            <div
              class="board-num"
              :class="{ 'is-none': !metrics }"
            >
              {{ metrics ? metrics.registeredConnections : '—' }}<small v-if="metrics">條</small>
            </div>
            <p
              v-if="metrics"
              class="board-meaning"
            >
              {{ metrics.onlineAgents }} 位在線客服，多分頁與裝置各算一條
            </p>
            <div
              v-if="metrics"
              class="lead-chips"
            >
              <span
                v-if="service"
                class="ui-pill ui-pill-dot"
                :class="service.pill"
              >{{ service.label }}</span>
              <span
                v-if="connectionDelta !== null"
                class="ui-delta"
                :class="connectionDelta >= 0 ? 'ui-delta-up' : 'ui-delta-down'"
              >{{ connectionDelta > 0 ? '+' : '' }}{{ connectionDelta }} 比上次刷新</span>
            </div>
          </div>
          <div class="board-chart">
            <div class="card-head">
              <p class="range-facts">
                <span class="rf-title">連線趨勢</span>
                <span v-if="stats.peakConnections !== null">近 {{ rangeLabel }}峰值 <b>{{ stats.peakConnections }}</b></span>
                <span v-if="stats.avgConnections !== null">平均 <b>{{ stats.avgConnections }}</b></span>
              </p>
              <div
                class="ui-seg"
                role="group"
                aria-label="時間範圍"
              >
                <button
                  v-for="option in RANGE_OPTIONS"
                  :key="option.value"
                  type="button"
                  :aria-pressed="period === option.value"
                  @click="changePeriod(option.value)"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
            <div class="chart-wrap">
              <WsLineChart
                v-if="hasHistory"
                :points="history"
                :from="histWindow.from"
                :to="histWindow.to"
                :range="period"
                :series="CONN_SERIES"
                :geom="connGeom"
                :x-count="phone ? 4 : 5"
                :chart-label="`${rangeLabel}已註冊連線趨勢`"
              />
              <div
                v-else
                class="ui-empty"
              >
                <h3>{{ historyLoading ? '載入中...' : historyError ? '無法載入歷史資料' : '這段時間還沒有取樣資料' }}</h3>
                <p>{{ historyError || '系統每 5 分鐘記錄一次連線快照，累積後會顯示在這裡。' }}</p>
              </div>
            </div>
          </div>
        </article>

        <!-- 即時指標 -->
        <section
          aria-label="即時指標"
          class="s12 rates"
        >
          <h2 class="ui-group-label">
            即時指標
            <span class="label-note">每 {{ POLL_SECONDS }} 秒更新</span>
          </h2>
          <div class="ui-group rates-card">
            <div class="ui-row is-flush kpi-row">
              <span
                class="ui-kpi-ico green"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" /></svg>
              </span>
              <div class="kpi-main">
                <div class="kpi-label">
                  事件 / 秒
                </div>
                <div class="ui-kpi-foot">
                  <template v-if="eventsTotal === null">
                    {{ metrics ? RESAMPLE_HINT : '' }}
                  </template>
                  <template v-else>
                    入 <b>{{ fmt(eventsIn, 2) }}</b> / 出 <b>{{ fmt(eventsOut, 2) }}</b>
                  </template>
                </div>
              </div>
              <div class="kpi-value">
                {{ eventsTotal === null ? '—' : fmt(eventsTotal, 2) }}
              </div>
            </div>

            <div class="ui-row is-flush kpi-row">
              <span
                class="ui-kpi-ico orange"
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
                /><path d="M12 7v5l3 2" /></svg>
              </span>
              <div class="kpi-main">
                <div class="kpi-label">
                  平均處理延遲
                </div>
                <div class="ui-kpi-foot">
                  <template v-if="metrics && !latencyKnown">
                    {{ RESAMPLE_HINT }}
                  </template>
                  <template v-else-if="metrics">
                    <span
                      class="ui-pill ui-pill-dot"
                      :class="latency.pill"
                    >{{ latency.label }}</span><span class="foot-hint">{{ latency.hint }}</span>
                  </template>
                </div>
              </div>
              <div class="kpi-value">
                {{ latencyKnown ? fmt(metrics?.averageLatency, 0) : '—' }}<small v-if="latencyKnown">ms</small>
              </div>
            </div>

            <div class="ui-row is-flush kpi-row">
              <span
                class="ui-kpi-ico red"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ><path d="M12 3 2 20h20Z" /><path d="M12 10v4M12 17h.01" /></svg>
              </span>
              <div class="kpi-main">
                <div class="kpi-label">
                  錯誤率
                </div>
                <div class="ui-kpi-foot">
                  <template v-if="errorRate === null">
                    {{ metrics ? RESAMPLE_HINT : '' }}
                  </template>
                  <template v-else>
                    <span
                      class="ui-pill ui-pill-dot"
                      :class="errorStatus.pill"
                    >{{ errorStatus.label }}</span><span class="foot-hint">{{ errorStatus.hint }}</span>
                  </template>
                </div>
              </div>
              <div class="kpi-value">
                {{ errorRate === null ? '—' : (errorRate * 100).toFixed(2) }}<small v-if="errorRate !== null">%</small>
              </div>
            </div>
          </div>
        </section>

        <!-- 事件量 -->
        <section class="s6">
          <h2 class="ui-group-label">
            事件量
            <span class="label-note">每秒收發事件數</span>
          </h2>
          <div class="ui-group chart-card">
            <div class="card-head">
              <p class="legend">
                <span><i
                  class="sw"
                  style="--c: var(--ui-indigo)"
                />入<b>{{ chart.lastIn === null ? '—' : fmt(chart.lastIn, 2) }}</b></span>
                <span><i
                  class="sw"
                  style="--c: var(--ui-teal)"
                />出<b>{{ chart.lastOut === null ? '—' : fmt(chart.lastOut, 2) }}</b></span>
                <span
                  v-if="stats.peakEvents !== null"
                  class="peak"
                >峰值 <b>{{ fmt(stats.peakEvents, 2) }}</b> / 秒</span>
              </p>
            </div>
            <div class="chart-wrap">
              <WsLineChart
                v-if="hasEvents"
                :points="history"
                :from="histWindow.from"
                :to="histWindow.to"
                :range="period"
                :series="EVENT_SERIES"
                :geom="halfGeom"
                :x-count="phone ? 4 : 5"
                :chart-label="`${rangeLabel}每秒事件趨勢`"
              />
              <div
                v-else
                class="ui-empty"
              >
                <h3>這段時間沒有事件取樣</h3>
                <p>服務重啟後的第一次取樣沒有事件數，下一次取樣會補上。</p>
              </div>
              <p
                v-if="hasEvents"
                class="axis-note"
              >
                缺漏的取樣不連線，也不畫成 0。
              </p>
            </div>
          </div>
        </section>

        <!-- 處理延遲 -->
        <section class="s6">
          <h2 class="ui-group-label">
            處理延遲
            <span class="label-note">平均處理時間（毫秒）</span>
          </h2>
          <div class="ui-group chart-card">
            <div class="card-head">
              <p class="cur">
                <b>{{ chart.lastLatency === null ? '—' : fmt(chart.lastLatency, 0) }}</b>
                <span>ms · 最新取樣</span>
                <span
                  v-if="stats.peakLatency !== null"
                  class="peak"
                >峰值 <b>{{ fmt(stats.peakLatency, 0) }}</b> ms</span>
              </p>
            </div>
            <div class="chart-wrap">
              <WsLineChart
                v-if="hasLatency"
                :points="history"
                :from="histWindow.from"
                :to="histWindow.to"
                :range="period"
                :series="LATENCY_SERIES"
                :geom="halfGeom"
                :refs="LATENCY_REFS"
                :x-count="phone ? 4 : 5"
                :chart-label="`${rangeLabel}平均處理延遲趨勢`"
              />
              <div
                v-else
                class="ui-empty"
              >
                <h3>這段時間沒有延遲取樣</h3>
                <p>有事件經過後才會有處理時間。</p>
              </div>
              <p
                v-if="hasLatency"
                class="axis-note"
              >
                虛線為門檻：100 ms 優秀、500 ms 需改進。
              </p>
            </div>
          </div>
        </section>

        <!-- 告警 -->
        <section
          v-if="alerts.length > 0"
          class="s12"
        >
          <h2 class="ui-group-label">
            系統告警
            <span class="label-note">{{ alerts.length }} 則待處理</span>
          </h2>
          <div class="ui-group alerts">
            <div
              v-for="alert in alerts"
              :key="alert.id"
              class="al"
            >
              <span
                class="ic"
                :class="alert.severity"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ><path d="M12 3 2 20h20Z" /><path d="M12 10v4M12 17h.01" /></svg>
              </span>
              <div>
                <h4>{{ alert.title }}</h4>
                <p>{{ alert.message }}</p>
                <time>{{ formatTime(alert.timestamp) }}</time>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm alert-dismiss"
                aria-label="關閉告警"
                @click="dismissAlert(alert.id)"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  aria-hidden="true"
                ><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
          </div>
        </section>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import UiPageHead from '@/components/ui/UiPageHead.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { apiClient } from '@/api'
import { presenceApi, type WsMetricsPointDto, type WsMetricsRange } from '@/api/presence'
import AppLayout from '@/components/ui/AppLayout.vue'
import WsLineChart, { type WsChartSeries } from '@/components/websocket/WsLineChart.vue'
import { RANGE_MS } from '@/utils/ws-metrics-chart'
import type { ChartGeometry } from '@/utils/ws-metrics-chart'

interface Metrics {
  totalConnections: number
  activeConnections: number
  registeredConnections: number
  onlineAgents: number
  averageLatency: number
  messagesThroughput: {
    inbound: number
    outbound: number
  }
  /** Seconds the rates were measured over; 0 = no reference sample yet, so the rates are unknown */
  windowSeconds: number
  errorRate: number
  lastUpdated: number
}

interface Alert {
  id: string
  severity: 'info' | 'warning' | 'error'
  title: string
  message: string
  timestamp: number
}

/** Polling floor: the broadcaster computes rates over a window and history is sampled every 5 minutes. */
const POLL_SECONDS = 15
const POLL_MS = POLL_SECONDS * 1000
const HISTORY_EVERY_N_POLLS = 4
const RESAMPLE_HINT = '需再取樣一次'

const RANGE_OPTIONS: Array<{ value: WsMetricsRange; label: string }> = [
  { value: '1h', label: '1 小時' },
  { value: '6h', label: '6 小時' },
  { value: '24h', label: '24 小時' },
  { value: '7d', label: '7 天' }
]

const metrics = ref<Metrics | null>(null)
const connectionDelta = ref<number | null>(null)
const alerts = ref<Alert[]>([])
const error = ref<string | null>(null)
const isRefreshing = ref(false)
const autoRefresh = ref(true)
const period = ref<WsMetricsRange>('1h')
const history = ref<WsMetricsPointDto[]>([])
const historyLoading = ref(false)
const historyError = ref<string | null>(null)
/** Window end for the chart; moves with each history load */
const historyNow = ref(Date.now())

/** Chart geometry: the wide trend card, the two half-width cards, and one phone size for all three */
const CONN_WIDE: ChartGeometry = { width: 800, height: 236, left: 40, right: 786, top: 14, bottom: 194 }
const HALF_WIDE: ChartGeometry = { width: 520, height: 230, left: 40, right: 508, top: 14, bottom: 188 }
const PHONE_GEOM: ChartGeometry = { width: 330, height: 190, left: 32, right: 322, top: 12, bottom: 152 }
const PHONE_QUERY = '(max-width: 768px)'
const phone = ref(typeof window !== 'undefined' && window.matchMedia?.(PHONE_QUERY).matches === true)
let phoneQuery: ReturnType<typeof window.matchMedia> | null = null
function onPhoneChange(event: { matches: boolean }) {
  phone.value = event.matches
}
const connGeom = computed(() => (phone.value ? PHONE_GEOM : CONN_WIDE))
const halfGeom = computed(() => (phone.value ? PHONE_GEOM : HALF_WIDE))

const eventsOf = (p: WsMetricsPointDto): number | null =>
  p.eventsInPerS === null || p.eventsOutPerS === null ? null : p.eventsInPerS + p.eventsOutPerS

const CONN_SERIES: WsChartSeries[] = [
  { key: 'conn', color: 'var(--ui-accent)', pick: p => p.activeConnections, area: true, label: '連線', unit: '條' }
]
const EVENT_SERIES: WsChartSeries[] = [
  { key: 'in', color: 'var(--ui-indigo)', pick: p => p.eventsInPerS, area: true, label: '入', digits: 2, unit: '/秒' },
  { key: 'out', color: 'var(--ui-teal)', pick: p => p.eventsOutPerS, area: true, label: '出', digits: 2, unit: '/秒' }
]
const LATENCY_SERIES: WsChartSeries[] = [
  { key: 'lat', color: 'var(--ui-accent)', pick: p => p.avgProcessingMs, area: true, label: '延遲', unit: 'ms' }
]
/** The same thresholds the live row uses (under 100 ms is excellent, over 500 ms needs work) */
const LATENCY_REFS = [{ value: 100, label: '優秀 100 ms' }, { value: 500, label: '需改進 500 ms' }]

let refreshInterval: ReturnType<typeof setInterval> | null = null
let pollCount = 0

const sampled = computed(() => (metrics.value?.windowSeconds ?? 0) > 0)
const eventsIn = computed(() => (sampled.value ? metrics.value?.messagesThroughput.inbound ?? 0 : null))
const eventsOut = computed(() => (sampled.value ? metrics.value?.messagesThroughput.outbound ?? 0 : null))
const eventsTotal = computed(() =>
  eventsIn.value === null || eventsOut.value === null ? null : eventsIn.value + eventsOut.value
)
const errorRate = computed(() => (sampled.value ? metrics.value?.errorRate ?? 0 : null))

const subtitle = computed(() => {
  if (!metrics.value) {
    return isRefreshing.value ? '載入中...' : '目前沒有可顯示的連線資料。'
  }
  const base = `連線數、事件量與處理延遲，每 ${POLL_SECONDS} 秒更新。`
  return alerts.value.length > 0 ? `${base}有 ${alerts.value.length} 則告警待處理。` : base
})

/** 0 ms with no sampled events is "nothing measured", not a perfect latency. */
const latencyKnown = computed(() => !!metrics.value && (sampled.value || metrics.value.averageLatency > 0))

const latency = computed(() => {
  const ms = metrics.value?.averageLatency ?? 0
  if (ms < 100) {
    return { label: '優秀', pill: 'ui-pill-green', hint: '低於 100 ms' }
  }
  if (ms < 500) {
    return { label: '良好', pill: 'ui-pill-orange', hint: '低於 500 ms' }
  }
  return { label: '需改進', pill: 'ui-pill-red', hint: '超過 500 ms' }
})

const errorStatus = computed(() => {
  const rate = errorRate.value ?? 0
  if (rate < 0.01) {
    return { label: '正常', pill: 'ui-pill-green', hint: '低於 1%' }
  }
  if (rate < 0.05) {
    return { label: '注意', pill: 'ui-pill-orange', hint: '1% 以上' }
  }
  return { label: '警告', pill: 'ui-pill-red', hint: '5% 以上' }
})

const rangeLabel = computed(() => RANGE_OPTIONS.find(o => o.value === period.value)?.label ?? '')

/** The window the charts draw: ends at the newest real sample, so the lines run to the edge of the plot */
const histWindow = computed(() => {
  const points = history.value
  const to = points.length > 0 ? (points[points.length - 1]?.ts ?? historyNow.value) : historyNow.value
  return { from: to - RANGE_MS[period.value], to }
})

function lastOf(pick: (_p: WsMetricsPointDto) => number | null): number | null {
  const points = history.value
  for (let i = points.length - 1; i >= 0; i--) {
    const point = points[i]
    const value = point ? pick(point) : null
    if (value !== null && Number.isFinite(value)) {
      return value
    }
  }
  return null
}

const chart = computed(() => ({
  lastConnections: lastOf(p => p.activeConnections),
  lastIn: lastOf(p => p.eventsInPerS),
  lastOut: lastOf(p => p.eventsOutPerS),
  lastLatency: lastOf(p => p.avgProcessingMs)
}))

const hasHistory = computed(() => history.value.length > 0)
const hasEvents = computed(() => history.value.some(p => eventsOf(p) !== null))
const hasLatency = computed(() => history.value.some(p => p.avgProcessingMs !== null))

/** Peaks and mean over the loaded history (client-side, no extra request) */
const stats = computed(() => {
  const conns = history.value.map(p => p.activeConnections).filter(v => Number.isFinite(v))
  const evts = history.value.map(eventsOf).filter((v): v is number => v !== null && Number.isFinite(v))
  const lats = history.value.map(p => p.avgProcessingMs).filter((v): v is number => v !== null && Number.isFinite(v))
  return {
    peakConnections: conns.length > 0 ? Math.max(...conns) : null,
    avgConnections: conns.length > 0 ? Math.round(conns.reduce((a, b) => a + b, 0) / conns.length) : null,
    peakEvents: evts.length > 0 ? Math.max(...evts) : null,
    peakLatency: lats.length > 0 ? Math.max(...lats) : null
  }
})

/** Service verdict from /websocket/health (null until the first answer) */
const healthStatus = ref<string | null>(null)
const service = computed(() => {
  if (healthStatus.value === 'healthy') { return { label: '服務正常', pill: 'ui-pill-green' } }
  if (healthStatus.value === 'degraded') { return { label: '服務降級', pill: 'ui-pill-orange' } }
  return null
})

onMounted(async () => {
  phoneQuery = window.matchMedia?.(PHONE_QUERY) ?? null
  phoneQuery?.addEventListener('change', onPhoneChange)
  document.addEventListener('visibilitychange', handleVisibility)
  await Promise.all([refreshData(), loadHistory()])
  if (autoRefresh.value) {
    startAutoRefresh()
  }
})

onUnmounted(() => {
  phoneQuery?.removeEventListener('change', onPhoneChange)
  document.removeEventListener('visibilitychange', handleVisibility)
  stopAutoRefresh()
})

watch(autoRefresh, (value) => {
  if (value) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
})

/** Do not poll a background tab; catch up once it is visible again. */
function handleVisibility() {
  if (document.hidden) {
    stopAutoRefresh()
  } else if (autoRefresh.value) {
    void refreshData()
    startAutoRefresh()
  }
}

async function refreshData() {
  isRefreshing.value = true
  error.value = null

  try {
    const [metricsRes, healthRes] = await Promise.all([
      apiClient.get<{ connections?: Metrics }>('/websocket/metrics'),
      apiClient.get('/websocket/health')
    ])

    // GET /websocket/metrics -> { status, data: { connections, locks, ... } }
    const connections = (metricsRes.data as { connections?: Metrics } | undefined)?.connections
    const previous = metrics.value?.registeredConnections
    metrics.value = connections ?? null
    connectionDelta.value =
      connections && previous !== undefined && connections.registeredConnections !== previous
        ? connections.registeredConnections - previous
        : null

    const healthObj = healthRes as { status?: string; data?: { status?: string } }
    healthStatus.value = healthObj.data?.status ?? healthObj.status ?? null
    if (metrics.value) {
      checkAlerts(metrics.value, healthRes)
    }
  } catch (err: unknown) {
    error.value = (err as {response?: {data?: {error?: string}}}).response?.data?.error || '無法載入監控資料'
    console.error('Failed to fetch monitoring data:', err)
  } finally {
    isRefreshing.value = false
  }
}

async function loadHistory() {
  historyLoading.value = true
  historyError.value = null
  try {
    const res = await presenceApi.getWsMetricsHistory(period.value)
    if (res.success && res.data) {
      history.value = res.data.points
    } else {
      history.value = []
      historyError.value = '無法載入歷史資料'
    }
  } catch (err) {
    history.value = []
    historyError.value = '無法載入歷史資料'
    console.error('Failed to fetch metrics history:', err)
  } finally {
    historyNow.value = Date.now()
    historyLoading.value = false
  }
}

function checkAlerts(current: Metrics, health: unknown) {
  // Rates are only meaningful once the broadcaster has a reference window
  if (current.windowSeconds > 0 && current.errorRate > 0.1) {
    addAlert({
      id: 'high-error-rate',
      severity: 'error',
      title: '高錯誤率',
      message: `錯誤率達到 ${(current.errorRate * 100).toFixed(2)}%，超過 10% 閾值`,
      timestamp: Date.now()
    })
  }

  if (current.averageLatency > 1000) {
    addAlert({
      id: 'high-latency',
      severity: 'warning',
      title: '高延遲',
      message: `平均延遲達到 ${Math.round(current.averageLatency)}ms，超過 1000ms 閾值`,
      timestamp: Date.now()
    })
  }

  const healthObj = health as { status?: string; data?: { status?: string } }
  if ((healthObj.data?.status ?? healthObj.status) === 'degraded') {
    addAlert({
      id: 'service-degraded',
      severity: 'warning',
      title: '服務降級',
      message: 'WebSocket 服務處於降級狀態',
      timestamp: Date.now()
    })
  }
}

function addAlert(alert: Alert) {
  // 避免重複添加相同 ID 的告警
  if (!alerts.value.find(a => a.id === alert.id)) {
    alerts.value.unshift(alert)
  }
}

function dismissAlert(id: string) {
  alerts.value = alerts.value.filter(a => a.id !== id)
}

function startAutoRefresh() {
  stopAutoRefresh()
  refreshInterval = setInterval(() => {
    pollCount += 1
    void refreshData()
    if (pollCount % HISTORY_EVERY_N_POLLS === 0) {
      void loadHistory()
    }
  }, POLL_MS)
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
}

function changePeriod(next: WsMetricsRange) {
  if (period.value === next) {
    return
  }
  period.value = next
  void loadHistory()
}

/** The backend reports raw floats: fixed digits keep the tiles from overflowing. */
function fmt(value: number | null | undefined, digits = 0): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—'
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(timestamp))
}
</script>

<style scoped>

.live {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 6px 0 12px;
  border-radius: 999px;
  background: var(--ui-fill);
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.ico {
  width: 14px;
  height: 14px;
}

.ico.spinning {
  animation: ws-spin 0.8s linear infinite;
}

@keyframes ws-spin {
  to {
    transform: rotate(360deg);
  }
}

/* verdict and movement under the lead number */
.lead-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-top: 12px;
}

.label-note {
  font-size: 13px;
  font-weight: 400;
  color: var(--ui-muted);
}

/* The board: the number now on the left, the trend that explains it on the right */
.board {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 20px 36px;
  align-items: center;
  padding: 24px 28px 14px;
}

.board-main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.board-kicker {
  font-size: 15px;
  font-weight: 600;
  color: var(--section-ink);
}

.board-num {
  margin-top: 4px;
  font: 600 72px / 1 var(--ui-font-display);
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.board-num.is-none {
  color: var(--ui-faint);
}

.board-num small {
  margin-left: 6px;
  font-size: 22px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--ui-muted);
}

.board-meaning {
  margin: 8px 0 0;
  font-size: 15px;
  line-height: 1.45;
  color: var(--ui-ink-2);
  text-wrap: pretty;
}

.board-chart {
  position: relative;
  min-width: 0;
  padding-left: 32px;
}

.board-chart::before {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 0;
  width: 0.5px;
  background: var(--ui-sep);
  content: '';
}

.board-chart .card-head,
.board-chart .chart-wrap {
  padding-right: 0;
  padding-left: 0;
}

.board-chart .card-head {
  padding-top: 0;
}

.range-facts {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 18px;
  margin: 0;
  font-size: 14px;
  color: var(--ui-muted);
}

.range-facts b,
.peak b {
  font: 600 22px / 1 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.range-facts .rf-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-ink);
}

.peak {
  margin-left: 6px;
  padding-left: 18px;
  border-left: 0.5px solid var(--ui-sep);
  font-size: 13px;
  color: var(--ui-muted);
}

.error-message {
  padding: 12px 16px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-red-soft);
  font-size: 13.5px;
  color: var(--ui-red-ink);
}

.bento {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 4px 16px;
  align-items: stretch;
}

.s8,
.s4,
.s6 {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.s8 {
  grid-column: span 8;
}

.s4 {
  grid-column: span 4;
}

.s6 {
  grid-column: span 6;
  margin-top: 12px;
}

.s12 {
  grid-column: span 12;
}

.s12 + .s12,
.s12 + .s6 {
  margin-top: 12px;
}

/* chart cards: one head row (the newest value, the range control), then the plot */
.chart-card {
  flex: 1;
}

.card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  min-height: 34px;
  padding: 16px 22px 0;
}

.cur {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  font-size: 13px;
  color: var(--ui-muted);
}

.cur b {
  font: 600 28px / 1 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 22px;
  margin: 0;
  font-size: 13px;
  color: var(--ui-muted);
}

.legend span {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
}

.legend b {
  font: 600 28px / 1 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.legend .sw {
  align-self: center;
  flex: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--c);
}

.chart-wrap {
  padding: 12px 22px 18px;
}

.axis-note {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--ui-muted);
}

/* A rate row: icon, name with its verdict, the number */
.rates-card {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  flex: 1;
}

.rates-card > .kpi-row::before {
  display: none;
}

.rates-card > .kpi-row + .kpi-row {
  border-left: 0.5px solid var(--ui-sep);
}

.kpi-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding-top: 18px;
  padding-bottom: 18px;
}

.kpi-label {
  font-size: 15px;
  font-weight: 600;
}

.kpi-main .ui-kpi-foot {
  margin-top: 2px;
}

.kpi-value {
  font: 600 28px / 1 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.kpi-value small {
  margin-left: 4px;
  font: 500 14px var(--ui-font-ui);
  letter-spacing: 0;
  color: var(--ui-muted);
}

.ui-kpi-ico.green,
.ui-kpi-ico.orange,
.ui-kpi-ico.red {
  background: var(--ui-fill);
  color: var(--ui-ink-2);
}

.ui-kpi-foot b {
  font-weight: 600;
  color: var(--ui-ink-2);
  font-variant-numeric: tabular-nums;
}

.foot-hint {
  white-space: nowrap;
}

.alerts {
  padding-bottom: 8px;
}

.al {
  position: relative;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  padding: 14px 22px;
}

.al + .al::before {
  content: '';
  position: absolute;
  top: 0;
  right: 22px;
  left: 68px;
  height: 0.5px;
  background: var(--ui-sep);
}

.al .ic {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.al .ic.warning {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.al .ic.error {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

.al .ic svg {
  width: 17px;
  height: 17px;
}

.al h4 {
  margin: 0;
  font-size: 14.5px;
  font-weight: 600;
}

.al p {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--ui-ink-2);
}

.al time {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.alert-dismiss {
  width: 32px;
  padding: 0;
}

.alert-dismiss svg {
  width: 14px;
  height: 14px;
}

@media (max-width: 1280px) {
  .s8,
  .s4,
  .s6 {
    grid-column: span 12;
  }

}

@media (max-width: 1024px) {
  .board {
    grid-template-columns: minmax(0, 1fr);
    padding: 22px 24px 14px;
  }

  .board-chart {
    padding: 16px 0 0;
  }

  .board-chart::before {
    top: 0;
    right: 0;
    bottom: auto;
    left: 0;
    width: auto;
    height: 0.5px;
  }

  .rates-card {
    grid-template-columns: minmax(0, 1fr);
  }

  .rates-card > .kpi-row + .kpi-row {
    border-top: 0.5px solid var(--ui-sep);
    border-left: 0;
  }
}

@media (max-width: 768px) {
  /* Phone: same order as the desktop (board, rates, events, latency) */
  .s6,
  .s4,
  .s8 {
    margin-top: 16px;
  }

  .kpi-row {
    gap: 12px;
  }

  .ui-kpi-foot {
    flex-wrap: wrap;
    row-gap: 4px;
  }

  .board {
    padding: 20px 16px 8px;
  }

  .board-num {
    font-size: 56px;
  }

  .peak {
    margin-left: 0;
    padding-left: 0;
    border-left: 0;
  }

  .board-chart .card-head .ui-seg {
    width: 100%;
  }

  .card-head {
    padding: 14px 16px 0;
  }

  .card-head .ui-seg {
    width: 100%;
  }

  .card-head .ui-seg > button {
    flex: 1;
    justify-content: center;
    min-height: 44px;
    padding: 0 6px;
  }

  .chart-wrap,
  .al {
    padding: 12px 16px 14px;
  }

  .al + .al::before {
    left: 62px;
  }
}
</style>
