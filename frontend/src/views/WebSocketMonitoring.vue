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

      <!-- Lead: registered connections now against this range's peak -->
      <RingLead
        kicker="已註冊連線"
        :value="metrics ? metrics.registeredConnections : '—'"
        :unit="metrics ? '條' : ''"
        :busy="isRefreshing && !metrics"
        :tone="metrics ? '' : 'none'"
        :meaning="metrics ? `${metrics.onlineAgents} 位在線客服，多分頁與裝置各算一條` : ''"
        summary="連線數"
        :rings="connectionRings"
        :size="144"
      >
        <span
          v-if="metrics && connectionDelta !== null"
          class="ui-delta lead-delta"
          :class="connectionDelta >= 0 ? 'ui-delta-up' : 'ui-delta-down'"
        >{{ connectionDelta > 0 ? '+' : '' }}{{ connectionDelta }} 比上次刷新</span>
      </RingLead>

      <!-- Rates: one grouped row each, with its own trend -->
      <section aria-label="即時指標">
        <h2 class="ui-group-label">
          即時指標
          <span class="label-note">每 {{ POLL_SECONDS }} 秒更新，走勢為{{ rangeLabel }}</span>
        </h2>
        <div class="ui-group">
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
            <svg
              v-if="sparks.events.line"
              class="spark is-accent"
              :viewBox="`0 0 ${SPARK.width} ${SPARK.height}`"
              preserveAspectRatio="none"
              role="img"
              :aria-label="`事件 / 秒，${rangeLabel}走勢`"
            >
              <path
                :d="sparks.events.area"
                class="spark-area"
              />
              <path
                :d="sparks.events.line"
                class="spark-line"
              />
            </svg>
            <span
              v-else
              class="spark-gap"
            />
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
            <svg
              v-if="sparks.latency.line"
              class="spark is-orange"
              :viewBox="`0 0 ${SPARK.width} ${SPARK.height}`"
              preserveAspectRatio="none"
              role="img"
              :aria-label="`平均處理延遲，${rangeLabel}走勢`"
            >
              <path
                :d="sparks.latency.area"
                class="spark-area"
              />
              <path
                :d="sparks.latency.line"
                class="spark-line"
              />
            </svg>
            <span
              v-else
              class="spark-gap"
            />
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
            <svg
              v-if="sparks.error.line"
              class="spark is-red"
              :viewBox="`0 0 ${SPARK.width} ${SPARK.height}`"
              preserveAspectRatio="none"
              role="img"
              :aria-label="`錯誤率，${rangeLabel}走勢`"
            >
              <path
                :d="sparks.error.area"
                class="spark-area"
              />
              <path
                :d="sparks.error.line"
                class="spark-line"
              />
            </svg>
            <span
              v-else
              class="spark-gap"
            />
          </div>
        </div>
      </section>

      <section class="bento">
        <!-- 歷史趨勢 -->
        <section class="s8">
          <div class="label-row">
            <h2 class="ui-group-label">
              歷史趨勢
              <span class="label-note">已註冊連線與每秒事件量（每 5 分鐘取樣一次）</span>
            </h2>
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
          <div class="ui-group chart-card">
            <div class="legend">
              <span><i class="swatch-area" />已註冊連線<b
                v-if="chart.lastConnections !== null"
                class="is-conn"
              >{{ chart.lastConnections }}</b></span><span><i class="swatch-line" />事件 / 秒<b
                v-if="chart.lastEvents !== null"
                class="is-evt"
              >{{ fmt(chart.lastEvents, 2) }}</b></span>
            </div>
            <div class="chart-wrap">
              <svg
                v-if="chart.connections.count > 0"
                class="chart"
                :viewBox="`0 0 ${geom.width} ${geom.height}`"
                role="img"
                :aria-label="`${rangeLabel}已註冊連線與每秒事件趨勢`"
              >
                <g class="g">
                  <line
                    v-for="tick in chart.yLeft"
                    :key="`g${tick.pos}`"
                    :x1="geom.left"
                    :x2="geom.right"
                    :y1="tick.pos"
                    :y2="tick.pos"
                  />
                </g>
                <g
                  text-anchor="end"
                  class="ax-left"
                >
                  <text
                    v-for="tick in chart.yLeft"
                    :key="`l${tick.pos}`"
                    :x="geom.left - 8"
                    :y="tick.pos + 4"
                  >{{ tick.label }}</text>
                </g>
                <g
                  v-if="!phone"
                  text-anchor="start"
                  class="ax-right"
                >
                  <text
                    v-for="tick in chart.yRight"
                    :key="`r${tick.pos}`"
                    :x="geom.right + 8"
                    :y="tick.pos + 4"
                  >{{ tick.label }}</text>
                </g>
                <g text-anchor="middle">
                  <text
                    v-for="tick in chart.x"
                    :key="`x${tick.pos}`"
                    :x="tick.pos"
                    :y="geom.bottom + 24"
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
                  v-for="(d, i) in phoneEvents"
                  :key="`e${i}`"
                  :d="d"
                  fill="none"
                  stroke="var(--ui-indigo)"
                  stroke-width="2.2"
                  stroke-linejoin="round"
                  stroke-linecap="round"
                />
                <circle
                  v-for="(dot, i) in chart.connections.dots"
                  :key="`cd${i}`"
                  :cx="dot.x"
                  :cy="dot.y"
                  r="2.6"
                  fill="var(--ui-accent)"
                />
                <circle
                  v-for="(dot, i) in phoneEventDots"
                  :key="`ed${i}`"
                  :cx="dot.x"
                  :cy="dot.y"
                  r="2.4"
                  fill="var(--ui-indigo)"
                />
                <circle
                  v-if="chart.connections.last"
                  :cx="chart.connections.last.x"
                  :cy="chart.connections.last.y"
                  r="4"
                  fill="var(--ui-accent)"
                />
                <circle
                  v-if="chart.events.last && !phone"
                  :cx="chart.events.last.x"
                  :cy="chart.events.last.y"
                  r="4"
                  fill="var(--ui-indigo)"
                  stroke="var(--ui-surface)"
                  stroke-width="1.5"
                />
              </svg>
              <div
                v-else
                class="ui-empty"
              >
                <h3>{{ historyLoading ? '載入中...' : historyError ? '無法載入歷史資料' : '這段時間還沒有取樣資料' }}</h3>
                <p>{{ historyError || '系統每 5 分鐘記錄一次連線快照，累積後會顯示在這裡。' }}</p>
              </div>
              <!-- Phone: one axis cannot carry both series, so events get their own small chart on the same time range -->
              <template v-if="phone && chart.connections.count > 0">
                <div class="legend legend-second">
                  <span><i class="swatch-line" />事件 / 秒<b
                    v-if="chart.lastEvents !== null"
                    class="is-evt"
                  >{{ fmt(chart.lastEvents, 2) }}</b></span>
                </div>
                <svg
                  v-if="phoneChart.events.count > 0"
                  class="chart"
                  :viewBox="`0 0 ${PHONE_EVENTS.width} ${PHONE_EVENTS.height}`"
                  role="img"
                  :aria-label="`${rangeLabel}每秒事件趨勢`"
                >
                  <g class="g">
                    <line
                      v-for="tick in phoneChart.yEvents"
                      :key="`pg${tick.pos}`"
                      :x1="PHONE_EVENTS.left"
                      :x2="PHONE_EVENTS.right"
                      :y1="tick.pos"
                      :y2="tick.pos"
                    />
                  </g>
                  <g text-anchor="end">
                    <text
                      v-for="tick in phoneChart.yEvents"
                      :key="`pl${tick.pos}`"
                      :x="PHONE_EVENTS.left - 8"
                      :y="tick.pos + 4"
                    >{{ tick.label }}</text>
                  </g>
                  <g text-anchor="middle">
                    <text
                      v-for="tick in phoneChart.x"
                      :key="`px${tick.pos}`"
                      :x="tick.pos"
                      :y="PHONE_EVENTS.bottom + 22"
                    >{{ tick.label }}</text>
                  </g>
                  <path
                    v-for="(d, i) in phoneChart.events.areas"
                    :key="`pa${i}`"
                    :d="d"
                    fill="var(--ui-indigo)"
                    opacity="0.1"
                  />
                  <path
                    v-for="(d, i) in phoneChart.events.lines"
                    :key="`pe${i}`"
                    :d="d"
                    fill="none"
                    stroke="var(--ui-indigo)"
                    stroke-width="2.2"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                  />
                  <circle
                    v-for="(dot, i) in phoneChart.events.dots"
                    :key="`pd${i}`"
                    :cx="dot.x"
                    :cy="dot.y"
                    r="2.4"
                    fill="var(--ui-indigo)"
                  />
                  <circle
                    v-if="phoneChart.events.last"
                    :cx="phoneChart.events.last.x"
                    :cy="phoneChart.events.last.y"
                    r="4"
                    fill="var(--ui-indigo)"
                    stroke="var(--ui-surface)"
                    stroke-width="1.5"
                  />
                </svg>
                <p
                  v-else
                  class="axis-note"
                >
                  這段時間沒有事件取樣資料。
                </p>
              </template>
              <p
                v-if="chart.connections.count > 0"
                class="axis-note"
              >
                {{ phone ? '事件資料缺漏的時段（例如服務重啟後的第一次取樣）不連線。' : '藍色左軸：連線數；紫色右軸：事件 / 秒。事件資料缺漏的時段（例如服務重啟後的第一次取樣）不連線。' }}
              </p>
            </div>
          </div>
        </section>

        <!-- 即時概況 -->
        <section class="s4">
          <h2 class="ui-group-label">
            即時概況
            <span class="label-note">來自 MessageBroadcaster</span>
          </h2>
          <div class="ui-group facts-card">
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
              <h3 class="fact-group">
                {{ rangeLabel }}內
              </h3>
              <div class="fact">
                <span>連線峰值</span><b>{{ stats.peakConnections ?? '—' }}</b>
              </div>
              <div class="fact">
                <span>平均連線</span><b>{{ stats.avgConnections ?? '—' }}</b>
              </div>
              <div class="fact">
                <span>事件峰值 / 秒</span><b>{{ stats.peakEvents === null ? '—' : fmt(stats.peakEvents, 2) }}</b>
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
import RingLead from '@/components/lead/RingLead.vue'
import type { ServiceRing } from '@/components/ui/ServiceRings.vue'
import { CHART, CHART_COMPACT, RANGE_MS, SPARK, buildSeries, buildSpark, xTicks, yTicks } from '@/utils/ws-metrics-chart'
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

/** Phone: a taller single-axis chart for connections, plus a second small chart for events */
const PHONE_EVENTS: ChartGeometry = { width: 360, height: 150, left: 34, right: 348, top: 12, bottom: 116 }
const PHONE_QUERY = '(max-width: 768px)'
const phone = ref(typeof window !== 'undefined' && window.matchMedia?.(PHONE_QUERY).matches === true)
let phoneQuery: ReturnType<typeof window.matchMedia> | null = null
function onPhoneChange(event: { matches: boolean }) {
  phone.value = event.matches
}
/** Events line on the combined (wide) chart only; the phone draws events in their own chart */
const phoneEvents = computed(() => (phone.value ? [] : chart.value.events.lines))
const phoneEventDots = computed(() => (phone.value ? [] : chart.value.events.dots))
const geom = computed(() => (phone.value ? CHART_COMPACT : CHART))

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

const chart = computed(() => {
  const points = history.value
  // The x-range ends at the newest real sample, so the lines run to the edge of the plot
  const newest = points.length > 0 ? (points[points.length - 1]?.ts ?? historyNow.value) : historyNow.value
  const to = newest
  const from = to - RANGE_MS[period.value]
  const g = geom.value
  const connections = buildSeries(points, p => p.activeConnections, from, to, g)
  const events = buildSeries(
    points,
    p => (p.eventsInPerS === null || p.eventsOutPerS === null ? null : p.eventsInPerS + p.eventsOutPerS),
    from,
    to,
    g
  )
  const lastValue = (pick: (_p: WsMetricsPointDto) => number | null): number | null => {
    for (let i = points.length - 1; i >= 0; i--) {
      const point = points[i]
      const value = point ? pick(point) : null
      if (value !== null && Number.isFinite(value)) {
        return value
      }
    }
    return null
  }
  return {
    connections,
    events,
    lastConnections: lastValue(p => p.activeConnections),
    lastEvents: lastValue(p => (p.eventsInPerS === null || p.eventsOutPerS === null ? null : p.eventsInPerS + p.eventsOutPerS)),
    yLeft: yTicks(connections.max, undefined, g),
    yRight: yTicks(events.max, undefined, g),
    x: xTicks(from, to, period.value, 5, g)
  }
})

/** The same window the main chart draws, shared by the KPI sparklines and the phone events chart */
const histWindow = computed(() => {
  const points = history.value
  const to = points.length > 0 ? (points[points.length - 1]?.ts ?? historyNow.value) : historyNow.value
  return { from: to - RANGE_MS[period.value], to }
})

const eventsOf = (p: WsMetricsPointDto): number | null =>
  p.eventsInPerS === null || p.eventsOutPerS === null ? null : p.eventsInPerS + p.eventsOutPerS

/** Shape of each KPI over the selected range, from the same history samples as the main chart */
const sparks = computed(() => {
  const { from, to } = histWindow.value
  return {
    events: buildSpark(history.value, eventsOf, from, to),
    latency: buildSpark(history.value, p => p.avgProcessingMs, from, to),
    error: buildSpark(history.value, p => (p.errorRate === null ? null : p.errorRate * 100), from, to)
  }
})

const phoneChart = computed(() => {
  const { from, to } = histWindow.value
  const events = buildSeries(history.value, eventsOf, from, to, PHONE_EVENTS)
  return {
    events,
    yEvents: yTicks(events.max, undefined, PHONE_EVENTS),
    x: xTicks(from, to, period.value, 4, PHONE_EVENTS)
  }
})

/** Peak and mean over the loaded history (client-side, no extra request) */
/** One arc: connections now against the highest sample of the chosen range (same series, so they compare) */
const connectionRings = computed<ServiceRing[]>(() => {
  const peak = stats.value.peakConnections
  if (!metrics.value || peak === null || peak <= 0) { return [] }
  return [{
    label: `目前連線（${rangeLabel.value}峰值）`,
    value: metrics.value.activeConnections,
    total: Math.max(peak, metrics.value.activeConnections),
    of: '條',
    hue: 'var(--section-hue)'
  }]
})

const stats = computed(() => {
  const conns = history.value.map(p => p.activeConnections).filter(v => Number.isFinite(v))
  const evts = history.value.map(eventsOf).filter((v): v is number => v !== null && Number.isFinite(v))
  return {
    peakConnections: conns.length > 0 ? Math.max(...conns) : null,
    avgConnections: conns.length > 0 ? Math.round(conns.reduce((a, b) => a + b, 0) / conns.length) : null,
    peakEvents: evts.length > 0 ? Math.max(...evts) : null
  }
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

.lead-delta {
  align-self: flex-start;
  margin-top: 10px;
}

.label-note {
  font-size: 13px;
  font-weight: 400;
  color: var(--ui-muted);
}

.label-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 8px;
}

.label-row .ui-group-label {
  margin: 0;
  white-space: nowrap;
}

.chart-card {
  padding-top: 16px;
}

.s4 > .ui-group-label {
  margin-top: 16px;
}

.facts-card {
  height: calc(100% - 44px);
}

/* A rate row: icon, name with its verdict, the number, then the trend */
.kpi-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto 220px;
  gap: 16px;
  padding-top: 16px;
  padding-bottom: 16px;
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

.kpi-row .spark {
  height: 36px;
  margin-top: 0;
}

.error-message {
  padding: 12px 16px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-red-soft);
  font-size: 13.5px;
  color: var(--ui-red-ink);
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

.bento {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
  align-items: stretch;
}

.s8 {
  grid-column: span 8;
}

.s4 {
  display: flex;
  flex-direction: column;
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
  font-size: 13px;
  color: var(--ui-muted);
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend i {
  flex: none;
}

.legend b {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.legend b.is-conn {
  color: var(--ui-accent);
}

.legend b.is-evt {
  color: var(--ui-indigo);
}

.legend i.swatch-area {
  width: 16px;
  height: 10px;
  border-top: 2.4px solid var(--ui-accent);
  background: color-mix(in srgb, var(--ui-accent) 14%, transparent);
}

.legend i.swatch-line {
  width: 16px;
  height: 0;
  border-top: 2.2px solid var(--ui-indigo);
}

.legend-second {
  padding: 14px 0 0;
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

/* each axis wears its series colour, so a reader never has to guess which scale a line belongs to */
svg.chart .ax-left text {
  fill: var(--ui-accent);
}

svg.chart .ax-right text {
  fill: var(--ui-indigo);
}

/* KPI sparkline: pinned to the card floor, so a taller card grows a chart instead of an empty strip */
.spark {
  display: block;
  width: 100%;
  height: 40px;
  margin-top: auto;
  overflow: visible;
}

.spark-line {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.spark-area {
  fill: currentColor;
  opacity: 0.1;
}

.spark.is-accent {
  color: var(--ui-accent);
}

.spark.is-orange {
  color: var(--ui-orange);
}

.spark.is-red {
  color: var(--ui-red);
}

.fact-group {
  margin: 14px 0 0;
  padding-bottom: 2px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-muted);
}

.axis-note {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--ui-muted);
}

.facts {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 0 22px 20px;
}

.foot-hint {
  white-space: nowrap;
}

.fact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
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
  margin: auto 0 0;
  padding-top: 12px;
  font-size: 13px;
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
  .s4 {
    grid-column: span 12;
  }
}

@media (max-width: 768px) {
  .kpi-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 12px;
  }

  .kpi-row .spark,
  .kpi-row .spark-gap {
    grid-column: 1 / -1;
  }

  .s4 > .ui-group-label {
    margin-top: 0;
  }

  .label-row .label-note {
    display: none;
  }

  .facts-card {
    height: auto;
  }

  .ui-kpi-foot {
    flex-wrap: wrap;
    row-gap: 4px;
  }

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

@media (max-width: 768px) {
  svg.chart text {
    font-size: 11px;
  }
}
</style>
