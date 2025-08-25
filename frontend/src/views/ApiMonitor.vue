<template>
  <div class="api-monitor">
    <div class="monitor-header">
      <div class="header-left">
        <h1><i class="icon-monitor" />API 監控儀表板</h1>
        <p>實時監控系統API狀態</p>
      </div>
      <div class="header-right">
        <button
          class="refresh-btn"
          :disabled="isRefreshing"
          @click="refreshAll"
        >
          <i :class="['icon-refresh', { 'spinning': isRefreshing }]" />
          {{ isRefreshing ? '更新中...' : '刷新狀態' }}
        </button>
        <div class="auto-refresh">
          <label>
            <input
              v-model="autoRefresh"
              type="checkbox"
              @change="toggleAutoRefresh"
            >
            自動刷新 (30秒)
          </label>
        </div>
      </div>
    </div>

    <div class="monitor-stats">
      <div class="stat-card">
        <div class="stat-icon healthy">
          ✓
        </div>
        <div class="stat-info">
          <div class="stat-number">
            {{ healthyCount }}
          </div>
          <div class="stat-label">
            正常
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon warning">
          ⚠
        </div>
        <div class="stat-info">
          <div class="stat-number">
            {{ warningCount }}
          </div>
          <div class="stat-label">
            警告
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon error">
          ✗
        </div>
        <div class="stat-info">
          <div class="stat-number">
            {{ errorCount }}
          </div>
          <div class="stat-label">
            錯誤
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon info">
          i
        </div>
        <div class="stat-info">
          <div class="stat-number">
            {{ totalEndpoints }}
          </div>
          <div class="stat-label">
            總端點
          </div>
        </div>
      </div>
    </div>

    <div class="monitor-content">
      <div class="filter-bar">
        <div class="filter-group">
          <label>狀態篩選:</label>
          <select v-model="statusFilter">
            <option value="all">
              全部
            </option>
            <option value="healthy">
              正常
            </option>
            <option value="warning">
              警告
            </option>
            <option value="error">
              錯誤
            </option>
          </select>
        </div>
        <div class="filter-group">
          <label>分類篩選:</label>
          <select v-model="categoryFilter">
            <option value="all">
              全部
            </option>
            <option value="system">
              系統
            </option>
            <option value="auth">
              認證
            </option>
            <option value="conversation">
              對話
            </option>
            <option value="customer">
              客戶
            </option>
            <option value="team">
              團隊
            </option>
          </select>
        </div>
        <div class="filter-group">
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="搜索API端點..."
            class="search-input"
          >
        </div>
      </div>

      <div class="api-grid">
        <div 
          v-for="api in filteredApis" 
          :key="api.id"
          class="api-card"
          :class="[`status-${api.status}`, { 'expanded': expandedCard === api.id }]"
          @click="toggleCard(api.id)"
        >
          <div class="api-header">
            <div class="api-basic-info">
              <div
                class="api-method"
                :class="api.method.toLowerCase()"
              >
                {{ api.method }}
              </div>
              <div class="api-endpoint">
                {{ api.endpoint }}
              </div>
              <div
                class="api-status-badge"
                :class="api.status"
              >
                <span class="status-dot" />
                {{ getStatusText(api.status) }}
              </div>
            </div>
            <div class="api-metrics">
              <div class="metric">
                <span class="metric-label">響應時間</span>
                <span
                  class="metric-value"
                  :class="getResponseTimeClass(api.responseTime)"
                >
                  {{ api.responseTime }}ms
                </span>
              </div>
              <div class="metric">
                <span class="metric-label">成功率</span>
                <span
                  class="metric-value"
                  :class="getSuccessRateClass(api.successRate)"
                >
                  {{ api.successRate }}%
                </span>
              </div>
            </div>
          </div>

          <div
            v-if="expandedCard === api.id"
            class="api-details"
          >
            <div class="details-grid">
              <div class="detail-section">
                <h4>基本信息</h4>
                <div class="detail-item">
                  <span class="label">描述:</span>
                  <span>{{ api.description }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">分類:</span>
                  <span>{{ api.category }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">最後檢查:</span>
                  <span>{{ formatTime(api.lastCheck) }}</span>
                </div>
              </div>
              
              <div class="detail-section">
                <h4>性能指標</h4>
                <div class="detail-item">
                  <span class="label">平均響應時間:</span>
                  <span>{{ api.avgResponseTime }}ms</span>
                </div>
                <div class="detail-item">
                  <span class="label">24h請求數:</span>
                  <span>{{ api.requestCount }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">錯誤數:</span>
                  <span>{{ api.errorCount }}</span>
                </div>
              </div>
            </div>

            <div class="detail-actions">
              <button
                class="test-btn"
                :disabled="api.testing"
                @click.stop="testApi(api)"
              >
                <i class="icon-test" />
                {{ api.testing ? '測試中...' : '測試API' }}
              </button>
              <button
                class="logs-btn"
                @click.stop="viewLogs(api)"
              >
                <i class="icon-logs" />
                查看日誌
              </button>
              <button
                class="docs-btn"
                @click.stop="viewDocs(api)"
              >
                <i class="icon-docs" />
                API文檔
              </button>
            </div>

            <div
              v-if="api.error"
              class="error-info"
            >
              <h4>錯誤信息</h4>
              <div class="error-message">
                {{ api.error }}
              </div>
              <div class="error-time">
                {{ formatTime(api.errorTime) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="filteredApis.length === 0"
      class="empty-state"
    >
      <div class="empty-icon">
        🔍
      </div>
      <h3>未找到匹配的API</h3>
      <p>請調整篩選條件或搜索關鍵詞</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
// import { apiClient } from '../api/client'

interface ApiEndpoint {
  id: string
  endpoint: string
  method: string
  category: string
  description: string
  status: 'healthy' | 'warning' | 'error'
  responseTime: number
  avgResponseTime: number
  successRate: number
  requestCount: number
  errorCount: number
  lastCheck: Date
  error?: string
  errorTime?: Date
  testing?: boolean
}

const apis = ref<ApiEndpoint[]>([])
const isRefreshing = ref(false)
const autoRefresh = ref(true)
const expandedCard = ref<string | null>(null)
const statusFilter = ref('all')
const categoryFilter = ref('all')
const searchQuery = ref('')

let refreshInterval: number | null = null

const filteredApis = computed(() => {
  return apis.value.filter(api => {
    const matchesStatus = statusFilter.value === 'all' || api.status === statusFilter.value
    const matchesCategory = categoryFilter.value === 'all' || api.category === categoryFilter.value
    const matchesSearch = searchQuery.value === '' || 
      api.endpoint.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      api.description.toLowerCase().includes(searchQuery.value.toLowerCase())
    
    return matchesStatus && matchesCategory && matchesSearch
  })
})

const totalEndpoints = computed(() => apis.value.length)
const healthyCount = computed(() => apis.value.filter(api => api.status === 'healthy').length)
const warningCount = computed(() => apis.value.filter(api => api.status === 'warning').length)
const errorCount = computed(() => apis.value.filter(api => api.status === 'error').length)

// 初始化API列表
const initializeApis = (): ApiEndpoint[] => {
  return [
    {
      id: 'health',
      endpoint: '/api/system/health',
      method: 'GET',
      category: 'system',
      description: '系統健康檢查',
      status: 'healthy',
      responseTime: 0,
      avgResponseTime: 0,
      successRate: 100,
      requestCount: 0,
      errorCount: 0,
      lastCheck: new Date()
    },
    {
      id: 'system-info',
      endpoint: '/api/system/info',
      method: 'GET',
      category: 'system',
      description: '系統信息',
      status: 'healthy',
      responseTime: 0,
      avgResponseTime: 0,
      successRate: 100,
      requestCount: 0,
      errorCount: 0,
      lastCheck: new Date()
    },
    {
      id: 'auth-login',
      endpoint: '/api/auth/login',
      method: 'POST',
      category: 'auth',
      description: '用戶登入',
      status: 'healthy',
      responseTime: 0,
      avgResponseTime: 0,
      successRate: 100,
      requestCount: 0,
      errorCount: 0,
      lastCheck: new Date()
    },
    {
      id: 'conversations-list',
      endpoint: '/api/conversations',
      method: 'GET',
      category: 'conversation',
      description: '獲取對話列表',
      status: 'healthy',
      responseTime: 0,
      avgResponseTime: 0,
      successRate: 100,
      requestCount: 0,
      errorCount: 0,
      lastCheck: new Date()
    },
    {
      id: 'customers-list',
      endpoint: '/api/customers',
      method: 'GET',
      category: 'customer',
      description: '獲取客戶列表',
      status: 'healthy',
      responseTime: 0,
      avgResponseTime: 0,
      successRate: 100,
      requestCount: 0,
      errorCount: 0,
      lastCheck: new Date()
    },
    {
      id: 'team-members',
      endpoint: '/api/team/members',
      method: 'GET',
      category: 'team',
      description: '獲取團隊成員',
      status: 'healthy',
      responseTime: 0,
      avgResponseTime: 0,
      successRate: 100,
      requestCount: 0,
      errorCount: 0,
      lastCheck: new Date()
    }
  ]
}

const loadApiStatusFromBackend = async (): Promise<void> => {
  try {
    const response = await fetch('/api/system/api-status')
    const data = await response.json()
    
    if (data.success && data.data) {
      // 更新現有的API列表或創建新的
      const backendApis = data.data.endpoints.map((endpoint: any) => ({
        id: endpoint.id,
        endpoint: endpoint.endpoint,
        method: endpoint.method,
        category: endpoint.category,
        description: endpoint.description,
        status: endpoint.status,
        responseTime: endpoint.responseTime || 0,
        avgResponseTime: endpoint.avgResponseTime || 0,
        successRate: endpoint.successRate || 100,
        requestCount: endpoint.requestCount || 0,
        errorCount: endpoint.errorCount || 0,
        lastCheck: endpoint.lastCheck ? new Date(endpoint.lastCheck) : new Date(),
        error: endpoint.error,
        errorTime: endpoint.errorTime ? new Date(endpoint.errorTime) : undefined
      }))
      
      apis.value = backendApis
    }
  } catch (error) {
    console.error('Failed to load API status from backend:', error)
    // 如果後端失敗，使用前端檢查
    await checkAllApisManually()
  }
}

const checkApiStatus = async (api: ApiEndpoint): Promise<void> => {
  const startTime = Date.now()
  
  try {
    let response
    
    switch (api.endpoint) {
      case '/api/system/health':
        response = await fetch('/api/system/health')
        break
      case '/api/system/info':
        response = await fetch('/api/system/info', { method: 'HEAD' })
        
        // 如果是401錯誤，說明端點存在但需要認證，這是正常的
        if (response.status === 401) {
          api.status = 'warning'
          api.error = '需要認證'
          api.errorTime = new Date()
          api.responseTime = Date.now() - startTime
          api.lastCheck = new Date()
          api.requestCount++
          return
        }
        break
      default:
        // 對於需要認證的API，我們只檢查端點是否存在
        response = await fetch(api.endpoint, { method: 'HEAD' })
    }
    
    const responseTime = Date.now() - startTime
    api.responseTime = responseTime
    api.avgResponseTime = Math.round((api.avgResponseTime + responseTime) / 2)
    api.lastCheck = new Date()
    api.requestCount++
    
    if (response && response.ok) {
      api.status = responseTime > 1000 ? 'warning' : 'healthy'
      api.successRate = Math.min(100, Math.round((api.successRate * 0.9) + 10))
      api.error = undefined
      api.errorTime = undefined
    } else {
      api.status = 'error'
      api.errorCount++
      api.successRate = Math.max(0, Math.round(api.successRate * 0.9))
      api.error = response ? `HTTP ${response.status}` : '無響應'
      api.errorTime = new Date()
    }
  } catch (error) {
    const responseTime = Date.now() - startTime
    api.responseTime = responseTime
    api.lastCheck = new Date()
    api.requestCount++
    api.errorCount++
    api.status = 'error'
    api.successRate = Math.max(0, Math.round(api.successRate * 0.9))
    api.error = error instanceof Error ? error.message : '未知錯誤'
    api.errorTime = new Date()
  }
}

const checkAllApisManually = async (): Promise<void> => {
  await Promise.all(apis.value.map(api => checkApiStatus(api)))
}

const refreshAll = async (): Promise<void> => {
  if (isRefreshing.value) {return}
  
  isRefreshing.value = true
  
  try {
    // 優先使用後端API獲取狀態
    await loadApiStatusFromBackend()
  } finally {
    isRefreshing.value = false
  }
}

const testApi = async (api: ApiEndpoint): Promise<void> => {
  api.testing = true
  await checkApiStatus(api)
  api.testing = false
}

const toggleCard = (id: string): void => {
  expandedCard.value = expandedCard.value === id ? null : id
}

const toggleAutoRefresh = (): void => {
  if (autoRefresh.value) {
    refreshInterval = window.setInterval(refreshAll, 30000)
  } else {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }
}

const viewLogs = (api: ApiEndpoint): void => {
  console.log('View logs for:', api.endpoint)
  // TODO: 實現日誌查看功能
}

const viewDocs = (api: ApiEndpoint): void => {
  console.log('View docs for:', api.endpoint)
  // TODO: 實現API文檔功能
}

// 輔助函數
const getStatusText = (status: string): string => {
  const statusMap = {
    healthy: '正常',
    warning: '警告',
    error: '錯誤'
  }
  return statusMap[status as keyof typeof statusMap] || status
}

const getResponseTimeClass = (time: number): string => {
  if (time < 200) {return 'excellent'}
  if (time < 500) {return 'good'}
  if (time < 1000) {return 'fair'}
  return 'poor'
}

const getSuccessRateClass = (rate: number): string => {
  if (rate >= 98) {return 'excellent'}
  if (rate >= 95) {return 'good'}
  if (rate >= 90) {return 'fair'}
  return 'poor'
}

const formatTime = (date: Date | undefined): string => {
  if (!date) {return '未知'}
  
  return new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    month: 'short',
    day: 'numeric'
  }).format(date)
}

onMounted(async () => {
  // 先初始化默認API列表，然後從後端加載實際狀態
  apis.value = initializeApis()
  await refreshAll()
  
  if (autoRefresh.value) {
    refreshInterval = window.setInterval(refreshAll, 30000)
  }
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>
:root {
  --primary: #3b82f6;
  --primary-dark: #2563eb;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --border: #d1d5db;
  --border-light: #e5e7eb;
}

.api-monitor {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  padding-bottom: 20px;
  border-bottom: 2px solid var(--border-light);
}

.header-left h1 {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 8px 0;
  font-size: 28px;
  color: var(--text-primary);
}

.header-left p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 16px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--primary-dark);
  transform: translateY(-1px);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.icon-refresh.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.auto-refresh label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
}

.monitor-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 16px;
  border: 1px solid var(--border-light);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: bold;
}

.stat-icon.healthy {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.stat-icon.warning {
  background: rgba(251, 191, 36, 0.1);
  color: #fbbf24;
}

.stat-icon.error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.stat-icon.info {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.stat-number {
  font-size: 24px;
  font-weight: bold;
  color: var(--text-primary);
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group label {
  font-size: 14px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.filter-group select,
.search-input {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
}

.search-input {
  min-width: 200px;
}

.api-grid {
  display: grid;
  gap: 16px;
}

.api-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-left: 4px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
}

.api-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.api-card.status-healthy {
  border-left-color: #22c55e;
}

.api-card.status-warning {
  border-left-color: #fbbf24;
}

.api-card.status-error {
  border-left-color: #ef4444;
}

.api-header {
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.api-basic-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.api-method {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  min-width: 60px;
  text-align: center;
}

.api-method.get { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
.api-method.post { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
.api-method.put { background: rgba(251, 191, 36, 0.1); color: #fbbf24; }
.api-method.delete { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

.api-endpoint {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: var(--text-primary);
  flex: 1;
}

.api-status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.api-status-badge.healthy {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.api-status-badge.warning {
  background: rgba(251, 191, 36, 0.1);
  color: #fbbf24;
}

.api-status-badge.error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.api-metrics {
  display: flex;
  gap: 24px;
}

.metric {
  text-align: right;
}

.metric-label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.metric-value {
  font-size: 16px;
  font-weight: bold;
}

.metric-value.excellent { color: #22c55e; }
.metric-value.good { color: #84cc16; }
.metric-value.fair { color: #fbbf24; }
.metric-value.poor { color: #ef4444; }

.api-details {
  border-top: 1px solid var(--border-light);
  padding: 20px;
  background: rgba(248, 250, 252, 0.5);
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  margin-bottom: 20px;
}

.detail-section h4 {
  margin: 0 0 12px 0;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.detail-item .label {
  color: var(--text-secondary);
}

.detail-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.detail-actions button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.test-btn:hover { border-color: var(--primary); color: var(--primary); }
.logs-btn:hover { border-color: #6b7280; color: #6b7280; }
.docs-btn:hover { border-color: #059669; color: #059669; }

.error-info {
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  padding: 16px;
}

.error-info h4 {
  margin: 0 0 8px 0;
  color: #dc2626;
  font-size: 14px;
}

.error-message {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #7f1d1d;
  margin-bottom: 4px;
}

.error-time {
  font-size: 12px;
  color: var(--text-secondary);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  color: var(--text-primary);
}

@media (max-width: 768px) {
  .monitor-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .header-right {
    flex-direction: column;
    align-items: stretch;
  }
  
  .api-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .api-metrics {
    justify-content: space-between;
  }
}
</style>