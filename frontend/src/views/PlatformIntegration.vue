<template>
  <AppLayout>
    <div class="platform-integration">
      <div class="page-header">
        <div class="header-content">
          <h1 class="page-title">
            平台集成管理
          </h1>
          <p class="page-subtitle">
            管理 LINE 和 Facebook Messenger 集成設定
          </p>
        </div>
        <div class="header-actions">
          <RefreshButton
            :loading="loading"
            @refresh="refreshAll"
          />
        </div>
      </div>

      <!-- Platform Status Cards -->
      <div class="platforms-grid">
        <PlatformStatus
          platform="line"
          :status="lineStatus"
          :metrics="lineMetrics"
          :webhook-status="lineWebhookStatus"
          show-history
          @connect="handleConnect('line')"
          @test="handleTest('line')"
          @refresh="handleRefresh('line')"
          @settings="openPlatformSettings('line')"
          @status-change="handleStatusChange('line', $event)"
        />

        <PlatformStatus
          platform="facebook"
          :status="facebookStatus"
          :metrics="facebookMetrics"
          :webhook-status="facebookWebhookStatus"
          show-history
          @connect="handleConnect('facebook')"
          @test="handleTest('facebook')"
          @refresh="handleRefresh('facebook')"
          @settings="openPlatformSettings('facebook')"
          @status-change="handleStatusChange('facebook', $event)"
        />
      </div>

      <!-- Platform Switching -->
      <div class="platform-switch-section">
        <div class="section-header">
          <h2 class="section-title">
            平台切換
          </h2>
          <p class="section-subtitle">
            選擇活躍的平台進行對話處理
          </p>
        </div>
        
        <div class="switch-options">
          <div
            class="switch-option"
            :class="{ active: activePlatform === 'all' }"
          >
            <input
              id="platform-all"
              v-model="activePlatform"
              type="radio"
              value="all"
              @change="handlePlatformSwitch"
            >
            <label for="platform-all">
              <div class="option-icon">
                <UsersIcon />
              </div>
              <div class="option-content">
                <h3>全部平台</h3>
                <p>同時處理所有平台的對話</p>
              </div>
            </label>
          </div>

          <div
            class="switch-option"
            :class="{ active: activePlatform === 'line', disabled: lineStatus !== 'connected' }"
          >
            <input
              id="platform-line"
              v-model="activePlatform"
              type="radio"
              value="line"
              :disabled="lineStatus !== 'connected'"
              @change="handlePlatformSwitch"
            >
            <label for="platform-line">
              <div class="option-icon line">
                <LineIcon />
              </div>
              <div class="option-content">
                <h3>僅 LINE</h3>
                <p>只處理 LINE 平台的對話</p>
                <span
                  v-if="lineStatus !== 'connected'"
                  class="option-status"
                >需要先連接</span>
              </div>
            </label>
          </div>

          <div
            class="switch-option"
            :class="{ active: activePlatform === 'facebook', disabled: facebookStatus !== 'connected' }"
          >
            <input
              id="platform-facebook"
              v-model="activePlatform"
              type="radio"
              value="facebook"
              :disabled="facebookStatus !== 'connected'"
              @change="handlePlatformSwitch"
            >
            <label for="platform-facebook">
              <div class="option-icon facebook">
                <FacebookIcon />
              </div>
              <div class="option-content">
                <h3>僅 Facebook</h3>
                <p>只處理 Facebook Messenger 的對話</p>
                <span
                  v-if="facebookStatus !== 'connected'"
                  class="option-status"
                >需要先連接</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      <!-- Integration Statistics -->
      <div class="integration-stats">
        <div class="stats-header">
          <h2 class="section-title">
            集成統計
          </h2>
          <div class="stats-period">
            <select
              v-model="statsPeriod"
              @change="loadStats"
            >
              <option value="1h">
                過去1小時
              </option>
              <option value="24h">
                過去24小時
              </option>
              <option value="7d">
                過去7天
              </option>
              <option value="30d">
                過去30天
              </option>
            </select>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-header">
              <h3>總訊息數</h3>
              <MessageCircleIcon />
            </div>
            <div class="stat-value">
              {{ totalMessages }}
            </div>
            <div class="stat-breakdown">
              <span class="breakdown-item line">
                <span class="breakdown-dot" />
                LINE: {{ lineMessages }}
              </span>
              <span class="breakdown-item facebook">
                <span class="breakdown-dot" />
                Facebook: {{ facebookMessages }}
              </span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-header">
              <h3>活躍對話</h3>
              <ChatIcon />
            </div>
            <div class="stat-value">
              {{ activeConversations }}
            </div>
            <div class="stat-breakdown">
              <span class="breakdown-item line">
                <span class="breakdown-dot" />
                LINE: {{ lineConversations }}
              </span>
              <span class="breakdown-item facebook">
                <span class="breakdown-dot" />
                Facebook: {{ facebookConversations }}
              </span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-header">
              <h3>平均回應時間</h3>
              <ClockIcon />
            </div>
            <div class="stat-value">
              {{ averageResponseTime }}
            </div>
            <div class="stat-breakdown">
              <span class="breakdown-item line">
                <span class="breakdown-dot" />
                LINE: {{ lineResponseTime }}
              </span>
              <span class="breakdown-item facebook">
                <span class="breakdown-dot" />
                Facebook: {{ facebookResponseTime }}
              </span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-header">
              <h3>成功率</h3>
              <CheckCircleIcon />
            </div>
            <div class="stat-value">
              {{ overallSuccessRate }}
            </div>
            <div class="stat-breakdown">
              <span class="breakdown-item line">
                <span class="breakdown-dot" />
                LINE: {{ lineSuccessRate }}
              </span>
              <span class="breakdown-item facebook">
                <span class="breakdown-dot" />
                Facebook: {{ facebookSuccessRate }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Platform Settings Modal -->
      <Modal
        :show="showSettingsModal"
        :title="`${currentPlatform === 'line' ? 'LINE' : 'Facebook'} 設定`"
        size="md"
        @close="closeSettingsModal"
      >
        <div class="platform-config">
          <div v-if="currentPlatform === 'line'">
            <div class="config-group">
              <label class="config-label">Channel ID</label>
              <input
                v-model="lineConfig.channelId"
                type="text"
                class="config-input"
                placeholder="輸入 LINE Channel ID"
              >
            </div>

            <div class="config-group">
              <label class="config-label">Channel Secret</label>
              <input
                v-model="lineConfig.channelSecret"
                type="password"
                class="config-input"
                placeholder="輸入 LINE Channel Secret"
              >
            </div>

            <div class="config-group">
              <label class="config-label">Access Token</label>
              <input
                v-model="lineConfig.accessToken"
                type="password"
                class="config-input"
                placeholder="輸入 LINE Access Token"
              >
            </div>
          </div>

          <div v-else>
            <div class="config-group">
              <label class="config-label">App ID</label>
              <input
                v-model="facebookConfig.appId"
                type="text"
                class="config-input"
                placeholder="輸入 Facebook App ID"
              >
            </div>

            <div class="config-group">
              <label class="config-label">App Secret</label>
              <input
                v-model="facebookConfig.appSecret"
                type="password"
                class="config-input"
                placeholder="輸入 Facebook App Secret"
              >
            </div>

            <div class="config-group">
              <label class="config-label">Page ID</label>
              <input
                v-model="facebookConfig.pageId"
                type="text"
                class="config-input"
                placeholder="輸入 Facebook Page ID"
              >
            </div>

            <div class="config-group">
              <label class="config-label">Page Access Token</label>
              <input
                v-model="facebookConfig.pageToken"
                type="password"
                class="config-input"
                placeholder="輸入 Page Access Token"
              >
            </div>
          </div>
        </div>

        <template #footer>
          <button
            class="btn btn-secondary"
            @click="closeSettingsModal"
          >
            取消
          </button>
          <button
            :disabled="testingConfig"
            class="btn btn-outline"
            @click="testPlatformConfig"
          >
            <HamsterLoader
              v-if="testingConfig"
              message="測試中..."
            />
            <TestIcon v-else />
            測試設定
          </button>
          <button
            :disabled="savingConfig"
            class="btn btn-primary"
            @click="savePlatformConfig"
          >
            <HamsterLoader
              v-if="savingConfig"
              message="保存中..."
            />
            儲存設定
          </button>
        </template>
      </Modal>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('PlatformIntegration')
import { ref, computed, onMounted } from 'vue'
import { systemApi } from '@/api/system'
import { useToast } from '@/composables/useToast'
import { getBackendUrl } from '@/config/runtime'
import AppLayout from '@/components/ui/AppLayout.vue'
import Modal from '@/components/ui/Modal.vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import PlatformStatus from '@/components/platform/PlatformStatus.vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'
import {
  // RefreshIcon,
  UsersIcon,
  LineIcon,
  FacebookIcon,
  MessageCircleIcon,
  ChatIcon,
  ClockIcon,
  CheckCircleIcon,
  TestIcon
} from '@/components/icons'

// State
const { showSuccess, showError } = useToast()

const loading = ref(false)
const showSettingsModal = ref(false)
const currentPlatform = ref<'line' | 'facebook'>('line')
const activePlatform = ref('all')
const statsPeriod = ref('24h')
const testingConfig = ref(false)
const savingConfig = ref(false)

// Platform Status
const lineStatus = ref<'connected' | 'disconnected' | 'error' | 'connecting'>('disconnected')
const facebookStatus = ref<'connected' | 'disconnected' | 'error' | 'connecting'>('disconnected')

// Platform Metrics
const lineMetrics = ref({
  messagesCount: 0,
  activeConversations: 0,
  averageResponseTime: 0,
  successRate: 0
})

const facebookMetrics = ref({
  messagesCount: 0,
  activeConversations: 0,
  averageResponseTime: 0,
  successRate: 0
})

// Webhook Status
const lineWebhookStatus = ref({
  endpoint: `${getBackendUrl()  }/api/webhook`,
  isActive: false,
  lastVerified: new Date(),
  lastError: undefined
})

const facebookWebhookStatus = ref({
  endpoint: `${getBackendUrl()}/api/webhook/facebook`,
  isActive: false,
  lastVerified: new Date(),
  lastError: undefined
})

// Platform Configuration
const lineConfig = ref({
  channelId: '',
  channelSecret: '',
  accessToken: ''
})

const facebookConfig = ref({
  appId: '',
  appSecret: '',
  pageId: '',
  pageToken: ''
})

// Statistics
const totalMessages = ref(0)
const lineMessages = ref(0)
const facebookMessages = ref(0)
const activeConversations = ref(0)
const lineConversations = ref(0)
const facebookConversations = ref(0)

// Computed
const averageResponseTime = computed(() => {
  const lineTime = lineMetrics.value.averageResponseTime
  const facebookTime = facebookMetrics.value.averageResponseTime
  const avgTime = (lineTime + facebookTime) / 2
  return formatResponseTime(avgTime)
})

const lineResponseTime = computed(() => formatResponseTime(lineMetrics.value.averageResponseTime))
const facebookResponseTime = computed(() => formatResponseTime(facebookMetrics.value.averageResponseTime))

const overallSuccessRate = computed(() => {
  const lineRate = lineMetrics.value.successRate
  const facebookRate = facebookMetrics.value.successRate
  const avgRate = (lineRate + facebookRate) / 2
  return formatSuccessRate(avgRate)
})

const lineSuccessRate = computed(() => formatSuccessRate(lineMetrics.value.successRate))
const facebookSuccessRate = computed(() => formatSuccessRate(facebookMetrics.value.successRate))

// Methods
const formatResponseTime = (time: number): string => {
  if (time < 1000) {return `${Math.round(time)}ms`}
  return `${(time / 1000).toFixed(1)}s`
}

const formatSuccessRate = (rate: number): string => {
  return `${Math.round(rate * 100)}%`
}

const loadPlatformStatus = async () => {
  try {
    const response = await systemApi.healthCheck()
    if (response.data) {
      const { overall } = response.data
      const isHealthy = overall?.status === 'healthy' || overall?.status === 'warning'
      lineStatus.value = isHealthy ? 'connected' : 'disconnected'
      facebookStatus.value = isHealthy ? 'connected' : 'disconnected'

      // Update webhook status
      lineWebhookStatus.value.isActive = isHealthy
      facebookWebhookStatus.value.isActive = isHealthy
    }
  } catch (error) {
    console.error('載入平台狀態失敗:', error)
    lineStatus.value = 'error'
    facebookStatus.value = 'error'
  }
}

const loadPlatformMetrics = async () => {
  try {
    const response = await systemApi.getMetrics()
    if (response.success && response.data) {
      // Mock platform-specific metrics (在實際實現中，這些數據應該從 API 獲取)
      const { totalConversations, messagesToday, averageResponseTime } = response.data
      
      // LINE metrics (假設 70% 的流量來自 LINE)
      lineMetrics.value = {
        messagesCount: Math.round(messagesToday * 0.7),
        activeConversations: Math.round(totalConversations * 0.7),
        averageResponseTime: averageResponseTime * 1000, // Convert to ms
        successRate: 0.95
      }
      
      // Facebook metrics (假設 30% 的流量來自 Facebook)
      facebookMetrics.value = {
        messagesCount: Math.round(messagesToday * 0.3),
        activeConversations: Math.round(totalConversations * 0.3),
        averageResponseTime: averageResponseTime * 1000 * 1.2, // Slightly slower
        successRate: 0.92
      }
    }
  } catch (error) {
    console.error('載入平台指標失敗:', error)
  }
}

const loadStats = async () => {
  try {
    const response = await systemApi.getStats(statsPeriod.value as '1h' | '24h' | '7d' | '30d')
    if (response.success && response.data) {
      const { stats } = response.data
      
      totalMessages.value = stats.messages.total
      lineMessages.value = Math.round(stats.messages.total * 0.7)
      facebookMessages.value = Math.round(stats.messages.total * 0.3)
      
      activeConversations.value = stats.conversations.total
      lineConversations.value = Math.round(stats.conversations.total * 0.7)
      facebookConversations.value = Math.round(stats.conversations.total * 0.3)
    }
  } catch (error) {
    console.error('載入統計資料失敗:', error)
  }
}

const refreshAll = async () => {
  loading.value = true
  try {
    await Promise.all([
      loadPlatformStatus(),
      loadPlatformMetrics(),
      loadStats()
    ])
  } finally {
    loading.value = false
  }
}

// Platform event handlers
const handleConnect = async (platform: 'line' | 'facebook') => {
  frontendLogger.debug(`連接 ${platform} 平台`)
}

const handleTest = async (platform: 'line' | 'facebook') => {
  frontendLogger.debug(`測試 ${platform} 平台連接`)
}

const handleRefresh = async (platform: 'line' | 'facebook') => {
  if (platform === 'line') {
    await loadPlatformMetrics()
  } else {
    await loadPlatformMetrics()
  }
}

const handleStatusChange = (platform: 'line' | 'facebook', status: string) => {
  if (platform === 'line') {
    lineStatus.value = status as 'connected' | 'disconnected' | 'error' | 'connecting'
  } else {
    facebookStatus.value = status as 'connected' | 'disconnected' | 'error' | 'connecting'
  }
}

const handlePlatformSwitch = () => {
  // 這裡可以實現平台切換邏輯
  frontendLogger.debug(`切換到 ${activePlatform.value} 平台`)
}

// Settings modal
const openPlatformSettings = (platform: 'line' | 'facebook') => {
  currentPlatform.value = platform
  showSettingsModal.value = true
  loadPlatformConfig(platform)
}

const closeSettingsModal = () => {
  showSettingsModal.value = false
  currentPlatform.value = 'line'
}

const loadPlatformConfig = async (platform: 'line' | 'facebook') => {
  try {
    const response = await systemApi.getSettings()
    if (response.success && response.data) {
      const { integrations } = response.data
      
      if (platform === 'line' && integrations?.line) {
        lineConfig.value = {
          channelId: integrations.line.channelId || '',
          channelSecret: integrations.line.channelSecret || '',
          accessToken: integrations.line.accessToken || ''
        }
      } else if (platform === 'facebook' && integrations?.facebook) {
        facebookConfig.value = {
          appId: integrations.facebook.appId || '',
          appSecret: integrations.facebook.appSecret || '',
          pageId: integrations.facebook.pageId || '',
          pageToken: integrations.facebook.pageToken || ''
        }
      }
    }
  } catch (error) {
    console.error('載入平台設定失敗:', error)
  }
}

const testPlatformConfig = async () => {
  testingConfig.value = true
  
  try {
    const config = currentPlatform.value === 'line' ? lineConfig.value : facebookConfig.value
    const response = await systemApi.testIntegration(currentPlatform.value, config)
    
    if (response.success) {
      showSuccess('測試成功', '平台設定測試完成')
    } else {
      showError('測試失敗', response.error || '設定測試失敗')
    }
  } catch (error: unknown) {
    showError('測試失敗', error instanceof Error ? error.message : String(error))
  } finally {
    testingConfig.value = false
  }
}

const savePlatformConfig = async () => {
  savingConfig.value = true
  
  try {
    const config = currentPlatform.value === 'line' ? lineConfig.value : facebookConfig.value
    const settings = {
      integrations: {
        [currentPlatform.value]: config
      }
    }
    
    const response = await systemApi.updateSettings(settings)
    
    if (response.success) {
      showSuccess('設定已儲存', '平台設定已成功更新')
      closeSettingsModal()
      await refreshAll()
    } else {
      showError('儲存失敗', response.error || '設定儲存失敗')
    }
  } catch (error: unknown) {
    showError('儲存失敗', error instanceof Error ? error.message : String(error))
  } finally {
    savingConfig.value = false
  }
}

// Icons are imported from @/components/icons

// Lifecycle
onMounted(() => {
  refreshAll()
})
</script>

<style scoped>
.platform-integration {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-6);
  background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
  border-radius: var(--radius-xl);
  color: white;
}

.header-content h1 {
  font-size: 1.875rem;
  font-weight: 700;
  margin-bottom: var(--space-2);
}

.header-content p {
  font-size: 1.125rem;
  opacity: 0.9;
}

.header-actions .btn {
  color: var(--primary-600);
  background-color: white;
  border-color: white;
}

.platforms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: var(--space-6);
}

.platform-switch-section {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--gray-200);
}

.section-header {
  margin-bottom: var(--space-6);
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 var(--space-2) 0;
}

.section-subtitle {
  color: var(--gray-600);
  margin: 0;
}

.switch-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-4);
}

.switch-option {
  position: relative;
}

.switch-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.switch-option label {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 2px solid var(--gray-200);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.switch-option.active label {
  border-color: var(--primary-500);
  background-color: var(--primary-50);
}

.switch-option.disabled label {
  opacity: 0.5;
  cursor: not-allowed;
}

.option-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--gray-100);
  color: var(--gray-600);
}

.option-icon.line {
  background-color: #00C300;
  color: white;
}

.option-icon.facebook {
  background-color: #1877F2;
  color: white;
}

.option-content h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 var(--space-1) 0;
}

.option-content p {
  color: var(--gray-600);
  margin: 0;
}

.option-status {
  font-size: 0.75rem;
  color: var(--red-600);
  font-weight: 500;
  margin-top: var(--space-1);
  display: block;
}

.integration-stats {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--gray-200);
}

.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.stats-period select {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  background: white;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-6);
}

.stat-card {
  padding: var(--space-4);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  background: var(--gray-50);
}

.stat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.stat-header h3 {
  font-size: 1rem;
  font-weight: 500;
  color: var(--gray-600);
  margin: 0;
}

.stat-header svg {
  width: 20px;
  height: 20px;
  color: var(--primary-500);
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--gray-900);
  margin-bottom: var(--space-3);
}

.stat-breakdown {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.breakdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.875rem;
  color: var(--gray-600);
}

.breakdown-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.breakdown-item.line .breakdown-dot {
  background-color: #00C300;
}

.breakdown-item.facebook .breakdown-dot {
  background-color: #1877F2;
}

/* Platform Config Styles (保留業務樣式) */
.platform-config {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.config-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.config-label {
  font-weight: 500;
  color: var(--gray-700);
}

.config-input {
  padding: var(--space-3);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  transition: border-color var(--transition-fast);
}

.config-input:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgb(59 130 246 / 0.1);
}

/* Responsive */
@media (max-width: 1024px) {
  .platforms-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    text-align: center;
    gap: var(--space-4);
  }
  
  .switch-options {
    grid-template-columns: 1fr;
  }
  
  .stats-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }
}
</style>