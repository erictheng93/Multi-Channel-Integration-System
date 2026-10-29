<template>
  <AppLayout>
    <div class="websocket-monitoring">
      <header class="ui-page-head">
        <div>
          <div class="ui-eyebrow">
            系統監控
          </div>
          <h1 class="ui-page-title">
            即時連線監控
          </h1>
          <p class="ui-page-sub">
            {{ subtitle }}
          </p>
        </div>
        <div class="ui-page-actions">
          <span class="live">
            每 {{ POLL_SECONDS }} 秒自動刷新
            <button
              type="button"
              class="ui-switch"
              role="switch"
              :aria-checked="autoRefresh"
              aria-label="自動刷新"
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
            {{ isRefreshing ? '刷新中...' : '刷新資料' }}
          </button>
        </div>
      </header>

      <!-- 錯誤訊息 -->
      <div
        v-if="error"
        class="error-message"
        role="alert"
      >
        {{ error }}
      </div>

      <!-- 即時指標 -->
      <section class="kpis">
        <article class="ui-card ui-kpi">
          <div class="ui-kpi-top">
            <span
              class="ui-kpi-ico blue"
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
                r="2"
              /><path d="M16.2 7.8a6 6 0 0 1 0 8.5M7.8 16.2a6 6 0 0 1 0-8.5" /></svg>
            </span>
            已註冊連線
          </div>
          <div class="ui-kpi-value">
            {{ metrics ? metrics.registeredConnections : '—' }}
          </div>
          <div class="ui-kpi-foot">
            <template v-if="metrics">
              <span
                v-if="connectionDelta !== null"
                class="ui-delta"
                :class="connectionDelta >= 0 ? 'ui-delta-up' : 'ui-delta-down'"
              >{{ connectionDelta > 0 ? '+' : '' }}{{ connectionDelta }}</span>
              {{ connectionDelta === null ? `${metrics.onlineAgents} 位在線客服` : '比上次刷新' }}
              <svg
                v-if="sparkPath"
                class="spark"
                viewBox="0 0 84 26"
                aria-hidden="true"
              >
                <path
                  :d="sparkPath"
                  fill="none"
                  stroke="var(--ui-accent)"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </template>
          </div>
        </article>

        <article class="ui-card ui-kpi">
          <div class="ui-kpi-top">
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
            事件 / 秒
          </div>
          <div class="ui-kpi-value">
            {{ eventsTotal === null ? '—' : fmt(eventsTotal, 2) }}
          </div>
          <div class="ui-kpi-foot">
            <template v-if="eventsTotal === null">
              {{ metrics ? RESAMPLE_HINT : '' }}
            </template>
            <template v-else>
              入 <b>{{ fmt(eventsIn, 2) }}</b> / 出 <b>{{ fmt(eventsOut, 2) }}</b>
            </template>
          </div>
        </article>

        <article class="ui-card ui-kpi">
          <div class="ui-kpi-top">
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
            平均處理延遲
          </div>
          <div class="ui-kpi-value">
            {{ latencyKnown ? fmt(metrics?.averageLatency, 0) : '—' }}<small v-if="latencyKnown">ms</small>
          </div>
          <div class="ui-kpi-foot">
            <template v-if="metrics && !latencyKnown">
              {{ RESAMPLE_HINT }}
            </template>
            <template v-else-if="metrics">
              <span
                class="ui-pill ui-pill-dot"
                :class="latency.pill"
              >{{ latency.label }}</span>{{ latency.hint }}
            </template>
          </div>
        </article>

        <article class="ui-card ui-kpi">
          <div class="ui-kpi-top">
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
            錯誤率
          </div>
          <div class="ui-kpi-value">
            {{ errorRate === null ? '—' : (errorRate * 100).toFixed(2) }}<small v-if="errorRate !== null">%</small>
          </div>
          <div class="ui-kpi-foot">
            <template v-if="errorRate === null">
              {{ metrics ? RESAMPLE_HINT : '' }}
            </template>
            <template v-else>
              <span
                class="ui-pill ui-pill-dot"
                :class="errorStatus.pill"
              >{{ errorStatus.label }}</span>{{ errorStatus.hint }}
            </template>
          </div>
        </article>
      </section>

      <section class="bento">
        <!-- 歷史趨勢 -->
        <article class="ui-card s8">
          <div class="ui-card-head">
            <div>
              <h2 class="ui-card-title">
                歷史趨勢
              </h2>
              <div class="ui-card-sub">
                已註冊連線與每秒事件量（每 5 分鐘取樣一次）
              </div>
            </div>
            <div class="ui-card-end">
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
          </div>
          <div class="legend">
            <span><i />已註冊連線</span><span><i class="b" />事件 / 秒</span>
          </div>
          <div class="chart-wrap">
            <svg
              v-if="chart.connections.count > 0"
              class="chart"
              :viewBox="`0 0 ${CHART.width} ${CHART.height}`"
              role="img"
              :aria-label="`${rangeLabel}已註冊連線與每秒事件趨勢`"
            >
              <g class="g">
                <line
                  v-for="tick in chart.yLeft"
                  :key="`g${tick.pos}`"
                  :x1="CHART.left"
                  :x2="CHART.right"
                  :y1="tick.pos"
                  :y2="tick.pos"
                />
              </g>
              <g text-anchor="end">
                <text
                  v-for="tick in chart.yLeft"
                  :key="`l${tick.pos}`"
                  :x="CHART.left - 8"
                  :y="tick.pos + 4"
                >{{ tick.label }}</text>
              </g>
              <g text-anchor="start">
                <text
                  v-for="tick in chart.yRight"
                  :key="`r${tick.pos}`"
                  :x="CHART.right + 8"
                  :y="tick.pos + 4"
                >{{ tick.label }}</text>
              </g>
              <g text-anchor="middle">
                <text
                  v-for="tick in chart.x"
                  :key="`x${tick.pos}`"
                  :x="tick.pos"
                  :y="CHART.bottom + 24"
                >{{ tick.label }}</text>
              </g>
              <path
                v-for="(d, i) in chart.connections.areas"
                :key="`a${i}`"
                :d="d"
                fill="var(--ui-accent)"
                opacity="0.1"
              />
              <path
                v-for="(d, i) in chart.connections.lines"
                :key="`c${i}`"
                :d="d"
                fill="none"
                stroke="var(--ui-accent)"
                stroke-width="2.4"
                stroke-linejoin="round"
                stroke-linecap="round"
              />
              <path
                v-for="(d, i) in chart.events.lines"
                :key="`e${i}`"
                :d="d"
                fill="none"
                stroke="var(--ui-teal)"
                stroke-width="2.2"
                stroke-linejoin="round"
                stroke-linecap="round"
              />
              <circle
                v-if="chart.connections.last"
                :cx="chart.connections.last.x"
                :cy="chart.connections.last.y"
                r="4"
                fill="var(--ui-accent)"
              />
              <circle
                v-if="chart.events.last"
                :cx="chart.events.last.x"
                :cy="chart.events.last.y"
                r="4"
                fill="var(--ui-teal)"
              />
            </svg>
            <div
              v-else
              class="ui-empty"
            >
              <h3>{{ historyLoading ? '載入中...' : historyError ? '無法載入歷史資料' : '這段時間還沒有取樣資料' }}</h3>
              <p>{{ historyError || '系統每 5 分鐘記錄一次連線快照，累積後會顯示在這裡。' }}</p>
            </div>
            <p
              v-if="chart.connections.count > 0"
              class="axis-note"
            >
              左軸：連線數；右軸：事件 / 秒。事件資料缺漏的時段不連線。
            </p>
          </div>
        </article>

        <!-- 即時概況 -->
        <article class="ui-card s4">
          <div class="ui-card-head">
            <div>
              <h2 class="ui-card-title">
                即時概況
              </h2>
              <div class="ui-card-sub">
                來自 MessageBroadcaster
              </div>
            </div>
          </div>
          <div
            v-if="metrics"
            class="facts"
          >
            <div class="fact">
              <span>在線客服</span><b>{{ metrics.onlineAgents }}</b>
            </div>
            <div class="fact">
              <span>已註冊連線</span><b>{{ metrics.registeredConnections }}</b>
            </div>
            <div class="fact">
              <span>取樣視窗</span><b>{{ sampled ? `${metrics.windowSeconds} 秒` : '—' }}</b>
            </div>
            <div class="fact">
              <span>最後更新</span><b>{{ lastUpdatedText }}</b>
            </div>
            <p class="fact-note">
              連線數為已註冊的連線（客服連線加對話房間），不代表每一條都有即時 socket。
            </p>
          </div>
          <div
            v-else
            class="ui-empty"
          >
            <p>{{ isRefreshing ? '載入中...' : '尚無資料' }}</p>
          </div>
        </article>

        <!-- 告警 -->
        <article
          v-if="alerts.length > 0"
          class="ui-card s12"
        >
          <div class="ui-card-head">
            <div>
              <h2 class="ui-card-title">
                系統告警
              </h2>
              <div class="ui-card-sub">
                {{ alerts.length }} 則待處理
              </div>
            </div>
          </div>
          <div class="alerts">
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
        </article>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { apiClient } from '@/api'
import { presenceApi, type WsMetricsPointDto, type WsMetricsRange } from '@/api/presence'
import AppLayout from '@/components/ui/AppLayout.vue'
import { CHART, RANGE_MS, buildSeries, xTicks, yTicks } from '@/utils/ws-metrics-chart'

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
  const m = metrics.value
  if (!m) {
    return isRefreshing.value ? '載入中...' : '目前沒有可顯示的連線資料。'
  }
  const base = `目前有 ${m.registeredConnections} 條已註冊連線（${m.onlineAgents} 位在線客服，多分頁與裝置各算一條）。`
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

const lastUpdatedText = computed(() => {
  const ts = metrics.value?.lastUpdated
  return ts ? formatTime(ts) : '—'
})

const rangeLabel = computed(() => RANGE_OPTIONS.find(o => o.value === period.value)?.label ?? '')

/** Last connection counts as a tiny trend line in the first tile (real snapshots only). */
const sparkPath = computed(() => {
  const values = history.value.slice(-12).map(p => p.activeConnections)
  if (values.length < 3) {
    return ''
  }
  const min = Math.min(...values)
  const span = Math.max(1, Math.max(...values) - min)
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 84
      const y = 24 - ((v - min) / span) * 22
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
})

const chart = computed(() => {
  const to = historyNow.value
  const from = to - RANGE_MS[period.value]
  const points = history.value
  const connections = buildSeries(points, p => p.activeConnections, from, to)
  const events = buildSeries(
    points,
    p => (p.eventsInPerS === null || p.eventsOutPerS === null ? null : p.eventsInPerS + p.eventsOutPerS),
    from,
    to
  )
  return {
    connections,
    events,
    yLeft: yTicks(connections.max),
    yRight: yTicks(events.max),
    x: xTicks(from, to, period.value)
  }
})

onMounted(async () => {
  document.addEventListener('visibilitychange', handleVisibility)
  await Promise.all([refreshData(), loadHistory()])
  if (autoRefresh.value) {
    startAutoRefresh()
  }
})

onUnmounted(() => {
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
.websocket-monitoring {
  /* AppLayout's .page-content is a flex column and already pads: max-width + auto margins alone
     would size to content */
  display: grid;
  gap: 20px;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
}

.live {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 6px 0 12px;
  border-radius: 999px;
  background: var(--ui-fill);
  font-size: 12.5px;
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

.error-message {
  padding: 12px 16px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-red-soft);
  font-size: 13.5px;
  color: var(--ui-red-ink);
}

.kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.ui-kpi-ico.blue {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.ui-kpi-ico.green {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.ui-kpi-ico.orange {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.ui-kpi-ico.red {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

.ui-kpi-foot b {
  font-weight: 600;
  color: var(--ui-ink-2);
  font-variant-numeric: tabular-nums;
}

.spark {
  width: 84px;
  height: 26px;
  margin-left: auto;
}

.bento {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}

.s8 {
  grid-column: span 8;
}

.s4 {
  grid-column: span 4;
}

.s12 {
  grid-column: span 12;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 0 22px 4px;
  font-size: 12px;
  color: var(--ui-muted);
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend i {
  width: 10px;
  height: 3px;
  border-radius: 2px;
  background: var(--ui-accent);
}

.legend i.b {
  background: var(--ui-teal);
}

.chart-wrap {
  padding: 4px 22px 18px;
}

svg.chart {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

svg.chart text {
  fill: var(--ui-muted);
  font: 500 11px var(--ui-font-ui);
  font-variant-numeric: tabular-nums;
}

svg.chart .g line {
  stroke: var(--ui-sep);
}

.axis-note {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--ui-muted);
}

.facts {
  padding: 0 22px 20px;
}

.fact {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 0;
  font-size: 13.5px;
  box-shadow: inset 0 -0.5px 0 var(--ui-sep);
}

.fact span {
  color: var(--ui-muted);
}

.fact b {
  font-variant-numeric: tabular-nums;
}

.fact-note {
  margin: 12px 0 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--ui-muted);
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
  right: 0;
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
  font-size: 12px;
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
  .s4 {
    grid-column: span 12;
  }
}

@media (max-width: 1024px) {
  .kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .legend,
  .chart-wrap,
  .facts {
    padding-right: 16px;
    padding-left: 16px;
  }

  .al {
    padding: 14px 16px;
  }

  .al + .al::before {
    left: 62px;
  }

  .ui-card-end,
  .ui-card-end .ui-seg {
    width: 100%;
    margin-left: 0;
  }

  .ui-card-end .ui-seg > button {
    flex: 1;
    justify-content: center;
    padding: 0 6px;
  }
}

@media (max-width: 480px) {
  .kpis {
    grid-template-columns: 1fr;
  }

  svg.chart text {
    font-size: 18px;
  }

  .spark {
    display: none;
  }
}
</style>
