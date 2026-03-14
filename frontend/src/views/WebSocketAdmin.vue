<template>
  <div class="websocket-admin">
    <h1>WebSocket 遷移管理</h1>

    <!-- 狀態總覽 -->
    <section class="status-overview">
      <h2>系統狀態</h2>
      <div class="status-cards">
        <div
          class="status-card"
          :class="{ active: migrationConfig?.enableWebSocket }"
        >
          <h3>WebSocket</h3>
          <div class="status-indicator">
            <span
              class="dot"
              :class="{ active: migrationConfig?.enableWebSocket }"
            />
            {{ migrationConfig?.enableWebSocket ? '已啟用' : '已停用' }}
          </div>
        </div>

        <div
          class="status-card"
          :class="{ active: migrationConfig?.enableSSE }"
        >
          <h3>SSE (Fallback)</h3>
          <div class="status-indicator">
            <span
              class="dot"
              :class="{ active: migrationConfig?.enableSSE }"
            />
            {{ migrationConfig?.enableSSE ? '已啟用' : '已停用' }}
          </div>
        </div>

        <div class="status-card">
          <h3>發布策略</h3>
          <div class="status-value">
            {{ migrationConfig?.migrationStrategy || 'gradual' }}
          </div>
        </div>

        <div class="status-card">
          <h3>發布百分比</h3>
          <div class="status-value">
            {{ migrationConfig?.rolloutPercentage || 0 }}%
          </div>
        </div>
      </div>
    </section>

    <!-- 功能開關控制 -->
    <section class="feature-flags">
      <h2>功能開關</h2>
      <div class="controls">
        <div class="control-group">
          <label>
            <input
              v-model="localConfig.enableWebSocket"
              type="checkbox"
              @change="handleConfigChange"
            >
            啟用 WebSocket
          </label>
          <p class="help-text">
            啟用 WebSocket 即時通訊功能
          </p>
        </div>

        <div class="control-group">
          <label>
            <input
              v-model="localConfig.enableSSE"
              type="checkbox"
              @change="handleConfigChange"
            >
            啟用 SSE (Fallback)
          </label>
          <p class="help-text">
            作為 WebSocket 失敗時的備用方案
          </p>
        </div>

        <div class="control-group">
          <label for="rollout">發布百分比</label>
          <input
            id="rollout"
            v-model.number="localConfig.rolloutPercentage"
            type="range"
            min="0"
            max="100"
            step="5"
            @change="handleConfigChange"
          >
          <span class="range-value">{{ localConfig.rolloutPercentage }}%</span>
          <p class="help-text">
            逐步發布到指定百分比的用戶
          </p>
        </div>

        <div class="control-group">
          <label for="strategy">遷移策略</label>
          <select
            id="strategy"
            v-model="localConfig.migrationStrategy"
            @change="handleConfigChange"
          >
            <option value="immediate">
              立即切換 (immediate)
            </option>
            <option value="gradual">
              漸進式 (gradual)
            </option>
            <option value="canary">
              金絲雀 (canary)
            </option>
          </select>
          <p class="help-text">
            選擇遷移策略
          </p>
        </div>

        <button
          class="btn-primary"
          :disabled="saving"
          @click="saveConfig"
        >
          {{ saving ? '保存中...' : '保存配置' }}
        </button>
      </div>
    </section>

    <!-- 健康檢查 -->
    <section class="health-check">
      <h2>健康檢查</h2>
      <div class="health-info">
        <div
          v-if="healthStatus"
          class="health-card"
        >
          <div class="health-header">
            <h3>WebSocket 服務</h3>
            <span
              class="health-badge"
              :class="healthStatus.status"
            >
              {{ healthStatus.status }}
            </span>
          </div>
          <div class="health-metrics">
            <div class="metric">
              <span class="label">活躍連線</span>
              <span class="value">{{ healthStatus.activeConnections || 0 }}</span>
            </div>
            <div class="metric">
              <span class="label">總連線數</span>
              <span class="value">{{ healthStatus.totalConnections || 0 }}</span>
            </div>
            <div class="metric">
              <span class="label">平均延遲</span>
              <span class="value">{{ healthStatus.averageLatency || 0 }}ms</span>
            </div>
            <div class="metric">
              <span class="label">錯誤率</span>
              <span class="value">{{ ((healthStatus.errorRate || 0) * 100).toFixed(2) }}%</span>
            </div>
          </div>
        </div>

        <button
          class="btn-secondary"
          :disabled="refreshing"
          @click="refreshHealth"
        >
          {{ refreshing ? '刷新中...' : '刷新狀態' }}
        </button>
      </div>
    </section>

    <!-- 錯誤顯示 -->
    <div
      v-if="error"
      class="error-message"
    >
       {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { apiClient } from '@/api'
import { useToast } from '@/composables/useToast'

interface MigrationConfig {
  enableWebSocket: boolean
  enableSSE: boolean
  migrationStrategy: 'immediate' | 'gradual' | 'canary'
  rolloutPercentage: number
  featureFlags: {
    websocketConnections: boolean
    durableObjectMessaging: boolean
    distributedLocking: boolean
    batchMessageProcessing: boolean
    realTimeTypingIndicators: boolean
  }
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  websocketEnabled: boolean
  sseEnabled: boolean
  totalConnections: number
  activeConnections: number
  averageLatency: number
  errorRate: number
  timestamp: number
}

const migrationConfig = ref<MigrationConfig | null>(null)
const healthStatus = ref<HealthStatus | null>(null)
const error = ref<string | null>(null)
const saving = ref(false)
const refreshing = ref(false)

// Toast notifications
const { showSuccess } = useToast()

const localConfig = reactive<MigrationConfig>({
  enableWebSocket: false,
  enableSSE: true,
  migrationStrategy: 'gradual',
  rolloutPercentage: 0,
  featureFlags: {
    websocketConnections: false,
    durableObjectMessaging: false,
    distributedLocking: false,
    batchMessageProcessing: false,
    realTimeTypingIndicators: false
  }
})

onMounted(async () => {
  await Promise.all([
    fetchMigrationConfig(),
    fetchHealthStatus()
  ])
})

async function fetchMigrationConfig() {
  try {
    const response = await apiClient.get<{
      success: boolean
      config: MigrationConfig
    }>('/websocket/migration-status')
    const data = response.data as { success: boolean; config: MigrationConfig }
    migrationConfig.value = data.config

    // 同步到本地配置
    Object.assign(localConfig, data.config)
  } catch (err) {
    error.value = '無法載入遷移配置'
    console.error('Failed to fetch migration config:', err)
  }
}

async function fetchHealthStatus() {
  try {
    const response = await apiClient.get<HealthStatus>('/websocket/health')
    healthStatus.value = response.data as HealthStatus
  } catch (err) {
    error.value = '無法載入健康狀態'
    console.error('Failed to fetch health status:', err)
  }
}

function handleConfigChange() {
  // 驗證配置
  if (!localConfig.enableWebSocket && !localConfig.enableSSE) {
    error.value = '至少需要啟用一種通訊方式'
    localConfig.enableSSE = true
  }
}

async function saveConfig() {
  saving.value = true
  error.value = null

  try {
    const response = await apiClient.post<{
      success: boolean
      config: MigrationConfig
    }>('/websocket/migration-config', localConfig)
    const data = response.data as { success: boolean; config: MigrationConfig }
    migrationConfig.value = data.config

    showSuccess('配置已保存成功！')
  } catch (err: unknown) {
    error.value = (err as {response?: {data?: {error?: string}}}).response?.data?.error || '保存配置失敗'
    console.error('Failed to save config:', err)
  } finally {
    saving.value = false
  }
}

async function refreshHealth() {
  refreshing.value = true
  error.value = null

  try {
    await fetchHealthStatus()
  } catch (_err: unknown) {
    error.value = '刷新健康狀態失敗'
  } finally {
    refreshing.value = false
  }
}
</script>

<style scoped>
.websocket-admin {
  max-width: 1200px;
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

/* 狀態卡片 */
.status-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.status-card {
  padding: 1.5rem;
  border-radius: 8px;
  border: 2px solid #e0e0e0;
  transition: all 0.3s ease;
}

.status-card.active {
  border-color: #4caf50;
  background: #f1f8f4;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ccc;
}

.dot.active {
  background: #4caf50;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #333;
  margin-top: 0.5rem;
}

/* 控制組 */
.controls {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.control-group label {
  font-weight: 500;
  color: #333;
}

.help-text {
  font-size: 0.875rem;
  color: #666;
  margin: 0;
}

input[type="checkbox"] {
  margin-right: 0.5rem;
  width: 18px;
  height: 18px;
}

input[type="range"] {
  width: 100%;
  max-width: 400px;
}

.range-value {
  font-weight: bold;
  color: #333;
  margin-left: 1rem;
}

select {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  max-width: 300px;
}

/* 按鈕 */
.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #2196f3;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1976d2;
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
}

.btn-secondary:hover:not(:disabled) {
  background: #e0e0e0;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 健康檢查 */
.health-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.health-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
}

.health-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.health-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: uppercase;
}

.health-badge.healthy {
  background: #4caf50;
  color: white;
}

.health-badge.degraded {
  background: #ff9800;
  color: white;
}

.health-badge.unhealthy {
  background: #f44336;
  color: white;
}

.health-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.metric .label {
  font-size: 0.875rem;
  color: #666;
}

.metric .value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #333;
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
