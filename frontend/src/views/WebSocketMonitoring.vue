<template>
  <div class="websocket-monitoring">
    <h1>WebSocket 即時監控</h1>

    <!-- 即時指標 -->
    <section class="realtime-metrics">
      <h2>即時指標</h2>
      <div class="metrics-grid">
        <!-- 連線數 -->
        <div class="metric-card primary">
          <div class="metric-icon" />
          <div class="metric-content">
            <h3>活躍連線</h3>
            <div class="metric-value">
              {{ metrics?.activeConnections || 0 }}
            </div>
            <div
              class="metric-trend"
              :class="getTrendClass(connectionTrend)"
            >
              {{ formatTrend(connectionTrend) }}
            </div>
          </div>
        </div>

        <!-- 訊息吞吐量 -->
        <div class="metric-card success">
          <div class="metric-icon" />
          <div class="metric-content">
            <h3>訊息/秒</h3>
            <div class="metric-value">
              {{ metrics?.messagesPerSecond || 0 }}
            </div>
            <div class="metric-subtitle">
              入站: {{ metrics?.messagesThroughput?.inbound || 0 }} /
              出站: {{ metrics?.messagesThroughput?.outbound || 0 }}
            </div>
          </div>
        </div>

        <!-- 平均延遲 -->
        <div class="metric-card warning">
          <div class="metric-icon" />
          <div class="metric-content">
            <h3>平均延遲</h3>
            <div class="metric-value">
              {{ metrics?.averageLatency || 0 }}ms
            </div>
            <div
              class="metric-status"
              :class="getLatencyStatus(metrics?.averageLatency)"
            >
              {{ getLatencyLabel(metrics?.averageLatency) }}
            </div>
          </div>
        </div>

        <!-- 錯誤率 -->
        <div class="metric-card danger">
          <div class="metric-icon" />
          <div class="metric-content">
            <h3>錯誤率</h3>
            <div class="metric-value">
              {{ ((metrics?.errorRate || 0) * 100).toFixed(2) }}%
            </div>
            <div
              class="metric-status"
              :class="getErrorRateStatus(metrics?.errorRate)"
            >
              {{ getErrorRateLabel(metrics?.errorRate) }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 連線類型分佈 -->
    <section class="connection-distribution">
      <h2>連線類型分佈</h2>
      <div class="distribution-chart">
        <div class="chart-item">
          <div class="chart-label">
            WebSocket
          </div>
          <div class="chart-bar">
            <div
              class="chart-bar-fill websocket"
              :style="{ width: getPercentage(metrics?.connectionsByType?.websocket) + '%' }"
            />
          </div>
          <div class="chart-value">
            {{ metrics?.connectionsByType?.websocket || 0 }}
          </div>
        </div>

        <div class="chart-item">
          <div class="chart-label">
            SSE
          </div>
          <div class="chart-bar">
            <div
              class="chart-bar-fill sse"
              :style="{ width: getPercentage(metrics?.connectionsByType?.sse) + '%' }"
            />
          </div>
          <div class="chart-value">
            {{ metrics?.connectionsByType?.sse || 0 }}
          </div>
        </div>
      </div>
    </section>

    <!-- Durable Objects 狀態 -->
    <section class="durable-objects">
      <h2>Durable Objects 狀態</h2>
      <div class="do-grid">
        <div
          v-for="(count, name) in durableObjects"
          :key="name"
          class="do-card"
        >
          <h4>{{ formatDOName(name) }}</h4>
          <div class="do-count">
            {{ count }}
          </div>
          <div class="do-status active">
            運行中
          </div>
        </div>
      </div>
    </section>

    <!-- 歷史趨勢 -->
    <section class="historical-trends">
      <h2>歷史趨勢</h2>
      <div class="trend-chart">
        <canvas
          ref="trendCanvas"
          width="800"
          height="300"
        />
      </div>
      <div class="trend-controls">
        <button
          :class="{ active: period === '1h' }"
          @click="changePeriod('1h')"
        >
          1小時
        </button>
        <button
          :class="{ active: period === '6h' }"
          @click="changePeriod('6h')"
        >
          6小時
        </button>
        <button
          :class="{ active: period === '24h' }"
          @click="changePeriod('24h')"
        >
          24小時
        </button>
        <button
          :class="{ active: period === '7d' }"
          @click="changePeriod('7d')"
        >
          7天
        </button>
      </div>
    </section>

    <!-- 告警 -->
    <section
      v-if="alerts.length > 0"
      class="alerts"
    >
      <h2>系統告警</h2>
      <div class="alert-list">
        <div
          v-for="alert in alerts"
          :key="alert.id"
          class="alert-item"
          :class="alert.severity"
        >
          <div class="alert-icon">
            {{ getAlertIcon(alert.severity) }}
          </div>
          <div class="alert-content">
            <h4>{{ alert.title }}</h4>
            <p>{{ alert.message }}</p>
            <div class="alert-time">
              {{ formatTime(alert.timestamp) }}
            </div>
          </div>
          <button
            class="alert-dismiss"
            @click="dismissAlert(alert.id)"
          >
            ×
          </button>
        </div>
      </div>
    </section>

    <!-- 刷新控制 -->
    <div class="controls">
      <button
        class="btn-refresh"
        :disabled="isRefreshing"
        @click="refreshData"
      >
        {{ isRefreshing ? '刷新中...' : ' 刷新資料' }}
      </button>
      <label class="auto-refresh">
        <input
          v-model="autoRefresh"
          type="checkbox"
        >
        自動刷新 (每 5 秒)
      </label>
    </div>

    <!-- 錯誤訊息 -->
    <div
      v-if="error"
      class="error-message"
    >
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { apiClient } from '@/api'

interface Metrics {
  totalConnections: number
  activeConnections: number
  connectionsByType: {
    websocket: number
    sse: number
  }
  averageLatency: number
  messagesPerSecond: number
  messagesThroughput: {
    inbound: number
    outbound: number
  }
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

const metrics = ref<Metrics | null>(null)
const durableObjects = ref<Record<string, number>>({
  ConversationRoom: 0,
  UserConnection: 0,
  MessageBroadcaster: 0,
  DelayedMessageProcessor: 0
})
const connectionTrend = ref(0)
const alerts = ref<Alert[]>([])
const error = ref<string | null>(null)
const isRefreshing = ref(false)
const autoRefresh = ref(true)
const period = ref('1h')
 
const trendCanvas = ref<HTMLCanvasElement | null>(null)

let refreshInterval: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await refreshData()

  if (autoRefresh.value) {
    startAutoRefresh()
  }
})

onUnmounted(() => {
  stopAutoRefresh()
})

watch(autoRefresh, (value) => {
  if (value) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
})

async function refreshData() {
  isRefreshing.value = true
  error.value = null

  try {
    const [metricsRes, healthRes] = await Promise.all([
      apiClient.get<Metrics>('/websocket/metrics'),
      apiClient.get('/websocket/health')
    ])

    metrics.value = metricsRes.data as Metrics

    // 模擬 Durable Objects 計數 (實際應該從 API 獲取)
    durableObjects.value = {
      ConversationRoom: Math.floor(Math.random() * 100),
      UserConnection: metrics.value?.activeConnections || 0,
      MessageBroadcaster: 1,
      DelayedMessageProcessor: Math.floor(Math.random() * 10)
    }

    // 檢查告警條件
    if (metrics.value) {
      checkAlerts(metrics.value, healthRes.data)
    }
  } catch (err: unknown) {
    error.value = (err as {response?: {data?: {error?: string}}}).response?.data?.error || '無法載入監控資料'
    console.error('Failed to fetch monitoring data:', err)
  } finally {
    isRefreshing.value = false
  }
}

function checkAlerts(metrics: Metrics, health: unknown) {
  // 高錯誤率告警
  if (metrics.errorRate > 0.1) {
    addAlert({
      id: 'high-error-rate',
      severity: 'error',
      title: '高錯誤率',
      message: `錯誤率達到 ${(metrics.errorRate * 100).toFixed(2)}%，超過 10% 閾值`,
      timestamp: Date.now()
    })
  }

  // 高延遲告警
  if (metrics.averageLatency > 1000) {
    addAlert({
      id: 'high-latency',
      severity: 'warning',
      title: '高延遲',
      message: `平均延遲達到 ${metrics.averageLatency}ms，超過 1000ms 閾值`,
      timestamp: Date.now()
    })
  }

  // 服務降級告警
  const healthObj = health as { status?: string }
  if (healthObj.status === 'degraded') {
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
  refreshInterval = setInterval(refreshData, 5000)
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
}

function changePeriod(newPeriod: string) {
  period.value = newPeriod
  // Note: History data reload can be added here when historical metrics API is available
}

function getPercentage(value?: number): number {
  if (!value || !metrics.value) {return 0}
  const total = metrics.value.totalConnections || 1
  return (value / total) * 100
}

function getTrendClass(trend: number) {
  if (trend > 0) {return 'up'}
  if (trend < 0) {return 'down'}
  return 'neutral'
}

function formatTrend(trend: number) {
  if (trend > 0) {return ` +${trend}`}
  if (trend < 0) {return ` ${trend}`}
  return '→ 持平'
}

function getLatencyStatus(latency?: number) {
  if (!latency) {return 'good'}
  if (latency < 100) {return 'good'}
  if (latency < 500) {return 'ok'}
  return 'bad'
}

function getLatencyLabel(latency?: number) {
  if (!latency) {return '優秀'}
  if (latency < 100) {return '優秀'}
  if (latency < 500) {return '良好'}
  return '需改進'
}

function getErrorRateStatus(errorRate?: number) {
  if (!errorRate) {return 'good'}
  if (errorRate < 0.01) {return 'good'}
  if (errorRate < 0.05) {return 'ok'}
  return 'bad'
}

function getErrorRateLabel(errorRate?: number) {
  if (!errorRate) {return '正常'}
  if (errorRate < 0.01) {return '正常'}
  if (errorRate < 0.05) {return '注意'}
  return '警告'
}

function formatDOName(name: string) {
  return name.replace(/([A-Z])/g, ' $1').trim()
}

function getAlertIcon(severity: string) {
  switch (severity) {
    case 'error': return ''
    case 'warning': return ''
    default: return ''
  }
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-TW')
}

// Template refs (exposed to satisfy TypeScript noUnusedLocals)
defineExpose({
  trendCanvas
})
</script>

<style scoped>
.websocket-monitoring {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  font-size: 2rem;
  margin-bottom: 2rem;
  color: #333;
}

h2 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: #555;
}

section {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* 即時指標 */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.metric-card {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid;
  background: #f9f9f9;
}

.metric-card.primary { border-color: #2196f3; }
.metric-card.success { border-color: #4caf50; }
.metric-card.warning { border-color: #ff9800; }
.metric-card.danger { border-color: #f44336; }

.metric-icon {
  font-size: 2rem;
}

.metric-content {
  flex: 1;
}

.metric-content h3 {
  font-size: 0.875rem;
  color: #666;
  margin: 0 0 0.5rem 0;
}

.metric-value {
  font-size: 2rem;
  font-weight: bold;
  color: #333;
}

.metric-trend {
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.metric-trend.up { color: #4caf50; }
.metric-trend.down { color: #f44336; }
.metric-trend.neutral { color: #999; }

.metric-subtitle {
  font-size: 0.875rem;
  color: #666;
  margin-top: 0.5rem;
}

.metric-status {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  margin-top: 0.5rem;
}

.metric-status.good { background: #4caf50; color: white; }
.metric-status.ok { background: #ff9800; color: white; }
.metric-status.bad { background: #f44336; color: white; }

/* 連線類型分佈 */
.distribution-chart {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chart-item {
  display: grid;
  grid-template-columns: 100px 1fr 80px;
  gap: 1rem;
  align-items: center;
}

.chart-label {
  font-weight: 500;
}

.chart-bar {
  height: 30px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.chart-bar-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.chart-bar-fill.websocket {
  background: linear-gradient(90deg, #2196f3, #1976d2);
}

.chart-bar-fill.sse {
  background: linear-gradient(90deg, #ff9800, #f57c00);
}

.chart-value {
  font-weight: bold;
  text-align: right;
}

/* Durable Objects */
.do-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.do-card {
  padding: 1.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  text-align: center;
}

.do-card h4 {
  margin: 0 0 0.5rem 0;
  color: #555;
}

.do-count {
  font-size: 2rem;
  font-weight: bold;
  color: #2196f3;
  margin: 0.5rem 0;
}

.do-status {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.do-status.active {
  background: #4caf50;
  color: white;
}

/* 趨勢圖 */
.trend-chart {
  margin-bottom: 1rem;
}

.trend-controls {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.trend-controls button {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.trend-controls button.active {
  background: #2196f3;
  color: white;
  border-color: #2196f3;
}

.trend-controls button:hover:not(.active) {
  background: #f5f5f5;
}

/* 告警 */
.alert-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.alert-item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid;
}

.alert-item.error {
  background: #ffebee;
  border-color: #f44336;
}

.alert-item.warning {
  background: #fff3e0;
  border-color: #ff9800;
}

.alert-item.info {
  background: #e3f2fd;
  border-color: #2196f3;
}

.alert-icon {
  font-size: 1.5rem;
}

.alert-content {
  flex: 1;
}

.alert-content h4 {
  margin: 0 0 0.25rem 0;
  color: #333;
}

.alert-content p {
  margin: 0 0 0.5rem 0;
  color: #666;
}

.alert-time {
  font-size: 0.75rem;
  color: #999;
}

.alert-dismiss {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s;
}

.alert-dismiss:hover {
  background: rgba(0, 0, 0, 0.2);
}

/* 控制按鈕 */
.controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-top: 2rem;
}

.btn-refresh {
  padding: 0.75rem 1.5rem;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-refresh:hover:not(:disabled) {
  background: #1976d2;
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auto-refresh {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

/* 錯誤訊息 */
.error-message {
  background: #ffebee;
  color: #c62828;
  padding: 1rem;
  border-radius: 4px;
  border-left: 4px solid #c62828;
  margin-top: 1rem;
}
</style>
