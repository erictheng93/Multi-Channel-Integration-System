<template>
  <div class="platform-status">
    <div class="platform-header">
      <div class="platform-info">
        <div
          class="platform-icon"
          :class="platformClass"
        >
          <component :is="platformIcon" />
        </div>
        <div class="platform-details">
          <h3 class="platform-name">
            {{ platformName }}
          </h3>
          <p class="platform-description">
            {{ platformDescription }}
          </p>
        </div>
      </div>
      
      <div
        class="status-indicator"
        :class="statusClass"
      >
        <div class="status-dot" />
        <span class="status-text">{{ statusText }}</span>
      </div>
    </div>

    <div
      v-if="showMetrics && metrics"
      class="platform-metrics"
    >
      <div class="metric-item">
        <span class="metric-label">今日訊息</span>
        <span class="metric-value">{{ metrics.messagesCount || 0 }}</span>
      </div>
      <div class="metric-item">
        <span class="metric-label">活躍對話</span>
        <span class="metric-value">{{ metrics.activeConversations || 0 }}</span>
      </div>
      <div class="metric-item">
        <span class="metric-label">回應時間</span>
        <span class="metric-value">{{ formatResponseTime(metrics.averageResponseTime) }}</span>
      </div>
      <div class="metric-item">
        <span class="metric-label">成功率</span>
        <span class="metric-value">{{ formatSuccessRate(metrics.successRate) }}</span>
      </div>
    </div>

    <div class="platform-actions">
      <button 
        v-if="status === 'disconnected' || status === 'error'"
        :disabled="connecting"
        class="btn btn-primary"
        @click="connectPlatform"
      >
        <LoadingSpinner
          v-if="connecting"
          size="xs"
          variant="white"
        />
        <component
          :is="ConnectIcon"
          v-else
        />
        {{ connecting ? '連接中...' : '連接' }}
      </button>

      <button 
        v-if="status === 'connected'"
        :disabled="testing"
        class="btn btn-secondary"
        @click="testConnection"
      >
        <LoadingSpinner
          v-if="testing"
          size="xs"
        />
        <component
          :is="TestIcon"
          v-else
        />
        {{ testing ? '測試中...' : '測試連接' }}
      </button>

      <button 
        v-if="status === 'connected'"
        :disabled="refreshing"
        class="btn btn-outline"
        title="刷新狀態"
        @click="refreshStatus"
      >
        <RefreshIcon :spinning="refreshing" />
      </button>

      <button 
        v-if="showSettings"
        class="btn btn-outline"
        title="設定"
        @click="openSettings"
      >
        <SettingsIcon />
      </button>
    </div>

    <!-- Webhook Status -->
    <div
      v-if="webhookStatus"
      class="webhook-status"
    >
      <div class="webhook-header">
        <h4>Webhook 狀態</h4>
        <div
          class="webhook-indicator"
          :class="webhookStatusClass"
        >
          <div class="status-dot" />
          <span>{{ webhookStatusText }}</span>
        </div>
      </div>
      
      <div class="webhook-details">
        <div class="webhook-item">
          <span class="webhook-label">端點:</span>
          <code class="webhook-url">{{ webhookStatus.endpoint }}</code>
        </div>
        <div class="webhook-item">
          <span class="webhook-label">最後驗證:</span>
          <span class="webhook-time">{{ formatTime(webhookStatus.lastVerified) }}</span>
        </div>
        <div
          v-if="webhookStatus.lastError"
          class="webhook-item"
        >
          <span class="webhook-label">錯誤:</span>
          <span class="webhook-error">{{ webhookStatus.lastError }}</span>
        </div>
      </div>

      <button 
        :disabled="verifyingWebhook"
        class="btn btn-sm btn-secondary"
        @click="verifyWebhook"
      >
        <LoadingSpinner
          v-if="verifyingWebhook"
          size="xs"
        />
        <component
          :is="CheckIcon"
          v-else
        />
        {{ verifyingWebhook ? '驗證中...' : '驗證 Webhook' }}
      </button>
    </div>

    <!-- Connection History -->
    <div
      v-if="showHistory && connectionHistory.length > 0"
      class="connection-history"
    >
      <h4>連接歷史</h4>
      <div class="history-list">
        <div 
          v-for="(entry, index) in connectionHistory.slice(0, 5)" 
          :key="index"
          class="history-item"
          :class="entry.status"
        >
          <div class="history-status">
            <CheckCircleIcon
              v-if="entry.status === 'success'"
              class="success-icon"
            />
            <XCircleIcon
              v-else
              class="error-icon"
            />
          </div>
          <div class="history-content">
            <span class="history-action">{{ entry.action }}</span>
            <span class="history-time">{{ formatTime(entry.timestamp) }}</span>
          </div>
          <div
            v-if="entry.error"
            class="history-error"
          >
            <span class="error-text">{{ entry.error }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { systemApi } from '@/api/system'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import {
  LineIcon,
  FacebookIcon,
  RefreshIcon,
  SettingsIcon,
  CheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ConnectIcon,
  TestIcon
} from '@/components/icons'

interface PlatformMetrics {
  messagesCount?: number;
  activeConversations?: number;
  averageResponseTime?: number; // in milliseconds
  successRate?: number; // 0-1
}

interface WebhookStatus {
  endpoint: string;
  isActive: boolean;
  lastVerified?: Date;
  lastError?: string;
}

interface ConnectionHistoryEntry {
  timestamp: Date;
  action: string;
  status: 'success' | 'error';
  error?: string;
}

interface Props {
  platform: 'line' | 'facebook';
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  showMetrics?: boolean;
  showHistory?: boolean;
  showSettings?: boolean;
  metrics?: PlatformMetrics;
  webhookStatus?: WebhookStatus;
}

/* eslint-disable no-unused-vars */
interface Emits {
  (e: 'connect'): void;
  (e: 'disconnect'): void;
  (e: 'test'): void;
  (e: 'refresh'): void;
  (e: 'settings'): void;
  (e: 'status-change', status: string): void;
}
/* eslint-enable no-unused-vars */

const props = withDefaults(defineProps<Props>(), {
  showMetrics: true,
  showHistory: false,
  showSettings: true,
  metrics: () => ({
    messagesCount: 0,
    activeConversations: 0,
    averageResponseTime: 0,
    successRate: 0
  }),
  webhookStatus: () => ({
    endpoint: '',
    isActive: false,
    lastVerified: undefined,
    lastError: undefined
  })
})

const emit = defineEmits<Emits>()

// State
const connecting = ref(false)
const testing = ref(false)
const refreshing = ref(false)
const verifyingWebhook = ref(false)
const connectionHistory = ref<ConnectionHistoryEntry[]>([])
const statusCheckInterval = ref<NodeJS.Timeout>()

// Icons are imported from @/components/icons

// Computed
const platformName = computed(() => {
  return props.platform === 'line' ? 'LINE' : 'Facebook Messenger'
})

const platformDescription = computed(() => {
  return props.platform === 'line' 
    ? 'LINE 官方帳號整合' 
    : 'Facebook Messenger 聊天機器人'
})

const platformIcon = computed(() => {
  return props.platform === 'line' ? LineIcon : FacebookIcon
})

const platformClass = computed(() => {
  return `platform-${props.platform}`
})

const statusClass = computed(() => {
  return `status-${props.status}`
})

const statusText = computed(() => {
  const statusMap = {
    connected: '已連接',
    disconnected: '未連接',
    error: '連接錯誤',
    connecting: '連接中...'
  }
  return statusMap[props.status] || '未知狀態'
})

const webhookStatusClass = computed(() => {
  if (!props.webhookStatus) {return 'status-unknown'}
  return props.webhookStatus.isActive ? 'status-connected' : 'status-error'
})

const webhookStatusText = computed(() => {
  if (!props.webhookStatus) {return '未設定'}
  return props.webhookStatus.isActive ? '正常運作' : '異常'
})

// Methods
const connectPlatform = async () => {
  connecting.value = true
  
  try {
    const response = await systemApi.testIntegration(props.platform, {})
    
    if (response.success) {
      emit('status-change', 'connected')
      addToHistory('平台連接', 'success')
    } else {
      emit('status-change', 'error')
      addToHistory('平台連接失敗', 'error', response.error)
    }
  } catch (error: unknown) {
    emit('status-change', 'error')
    const errorMessage = error instanceof Error ? error.message : '未知錯誤'
    addToHistory('平台連接失敗', 'error', errorMessage)
  } finally {
    connecting.value = false
  }
  
  emit('connect')
}

const testConnection = async () => {
  testing.value = true
  
  try {
    const response = await systemApi.testWebhook(props.platform)
    
    if (response.success && response.data) {
      const { success, responseTime, error } = response.data
      if (success) {
        addToHistory(`連接測試成功 (${responseTime}ms)`, 'success')
      } else {
        addToHistory('連接測試失敗', 'error', error)
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤'
    addToHistory('連接測試失敗', 'error', errorMessage)
  } finally {
    testing.value = false
  }
  
  emit('test')
}

const refreshStatus = async () => {
  refreshing.value = true
  
  try {
    // 這裡會調用健康檢查 API
    await new Promise(resolve => setTimeout(resolve, 1000)) // 模擬API調用
    addToHistory('狀態刷新', 'success')
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤'
    addToHistory('狀態刷新失敗', 'error', errorMessage)
  } finally {
    refreshing.value = false
  }
  
  emit('refresh')
}

const verifyWebhook = async () => {
  if (!props.webhookStatus) {return}
  
  verifyingWebhook.value = true
  
  try {
    const response = await systemApi.testWebhook(props.platform)
    
    if (response.success && response.data?.success) {
      addToHistory('Webhook 驗證成功', 'success')
    } else {
      addToHistory('Webhook 驗證失敗', 'error', response.data?.error)
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤'
    addToHistory('Webhook 驗證失敗', 'error', errorMessage)
  } finally {
    verifyingWebhook.value = false
  }
}

const openSettings = () => {
  emit('settings')
}

const addToHistory = (action: string, status: 'success' | 'error', error?: string) => {
  connectionHistory.value.unshift({
    timestamp: new Date(),
    action,
    status,
    error
  })
  
  // Keep only last 20 entries
  if (connectionHistory.value.length > 20) {
    connectionHistory.value = connectionHistory.value.slice(0, 20)
  }
}

const formatResponseTime = (time?: number): string => {
  if (!time) {return '--'}
  if (time < 1000) {return `${time}ms`}
  return `${(time / 1000).toFixed(1)}s`
}

const formatSuccessRate = (rate?: number): string => {
  if (rate === undefined) {return '--'}
  return `${Math.round(rate * 100)}%`
}

const formatTime = (date?: Date): string => {
  if (!date) {return '--'}
  return new Date(date).toLocaleString('zh-TW')
}

// Auto-refresh status every 30 seconds
const startStatusCheck = () => {
  statusCheckInterval.value = setInterval(() => {
    if (props.status === 'connected') {
      // Perform lightweight status check
      refreshStatus()
    }
  }, 30000)
}

// Lifecycle
onMounted(() => {
  if (props.showHistory) {
    startStatusCheck()
  }
})

onUnmounted(() => {
  if (statusCheckInterval.value) {
    clearInterval(statusCheckInterval.value)
  }
})
</script>

<style scoped>
.platform-status {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--gray-200);
}

.platform-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.platform-info {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.platform-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.platform-line {
  background: #00C300;
}

.platform-facebook {
  background: #1877F2;
}

.platform-details h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 var(--space-1) 0;
}

.platform-details p {
  font-size: 0.875rem;
  color: var(--gray-600);
  margin: 0;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  font-weight: 500;
}

.status-connected {
  background: var(--green-100);
  color: var(--green-700);
}

.status-disconnected {
  background: var(--gray-100);
  color: var(--gray-700);
}

.status-error {
  background: var(--red-100);
  color: var(--red-700);
}

.status-connecting {
  background: var(--primary-100);
  color: var(--primary-700);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.8;
}

.platform-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-6);
  padding: var(--space-4);
  background: var(--gray-50);
  border-radius: var(--radius-lg);
}

.metric-item {
  display: flex;
  flex-direction: column;
  text-align: center;
}

.metric-label {
  font-size: 0.75rem;
  color: var(--gray-600);
  margin-bottom: var(--space-1);
}

.metric-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gray-900);
}

.platform-actions {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

.platform-actions .btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.webhook-status {
  padding: var(--space-4);
  background: var(--gray-50);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-4);
}

.webhook-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.webhook-header h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0;
}

.webhook-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.875rem;
  font-weight: 500;
}

.webhook-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.webhook-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.875rem;
}

.webhook-label {
  color: var(--gray-600);
  font-weight: 500;
  min-width: 80px;
}

.webhook-url {
  background: var(--gray-100);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--gray-700);
}

.webhook-time {
  color: var(--gray-700);
}

.webhook-error {
  color: var(--red-600);
  font-weight: 500;
}

.connection-history h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 var(--space-3) 0;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.history-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: white;
  border-radius: var(--radius-md);
  border: 1px solid var(--gray-200);
}

.history-status {
  flex-shrink: 0;
}

.success-icon {
  color: var(--green-600);
  width: 16px;
  height: 16px;
}

.error-icon {
  color: var(--red-600);
  width: 16px;
  height: 16px;
}

.history-content {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-action {
  font-weight: 500;
  color: var(--gray-900);
}

.history-time {
  font-size: 0.75rem;
  color: var(--gray-500);
}

.history-error {
  flex-shrink: 0;
}

.error-text {
  font-size: 0.75rem;
  color: var(--red-600);
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Responsive */
@media (max-width: 768px) {
  .platform-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
  }
  
  .platform-metrics {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .platform-actions {
    flex-wrap: wrap;
  }
  
  .history-content {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }
}
</style>