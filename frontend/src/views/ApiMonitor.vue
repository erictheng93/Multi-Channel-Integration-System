<template>
  <AppLayout>
    <div class="api-monitor">
      <!-- Header Section -->
      <div class="page-header">
        <div class="header-content">
          <div class="header-info">
            <h1 class="page-title">
              API 監控儀表板
            </h1>
            <p class="page-subtitle">
              實時監控系統API狀態，快速診斷問題
            </p>
          </div>
        </div>
      </div>

      <!-- Control Actions -->
      <div class="control-actions">
        <div class="auto-refresh-control">
          <label class="auto-refresh-label">
            <input
              v-model="autoRefresh"
              type="checkbox"
              @change="toggleAutoRefresh"
            >
            <span>自動刷新 (15秒)</span>
          </label>
        </div>
        <RefreshButton
          :loading="isRefreshing"
          @refresh="refreshAll"
        />
      </div>

      <!-- Stats Overview -->
      <div class="stats-overview">
        <div class="stats-grid">
          <div
            class="stat-card healthy clickable"
            @click="showStatDetails('healthy')"
          >
            <div class="stat-content">
              <div class="stat-number">
                {{ healthyCount }}
              </div>
              <div class="stat-label">
                正常端點
              </div>
            </div>
            <div class="stat-icon">
              <HealthyIcon />
            </div>
          </div>
          
          <div
            class="stat-card warning clickable"
            @click="showStatDetails('warning')"
          >
            <div class="stat-content">
              <div class="stat-number">
                {{ warningCount }}
              </div>
              <div class="stat-label">
                警告端點
              </div>
            </div>
            <div class="stat-icon">
              <WarningIcon />
            </div>
          </div>
          
          <div
            class="stat-card error clickable"
            @click="showStatDetails('error')"
          >
            <div class="stat-content">
              <div class="stat-number">
                {{ errorCount }}
              </div>
              <div class="stat-label">
                錯誤端點
              </div>
            </div>
            <div class="stat-icon">
              <ErrorIcon />
            </div>
          </div>
          
          <div
            class="stat-card total clickable"
            @click="showStatDetails('all')"
          >
            <div class="stat-content">
              <div class="stat-number">
                {{ totalEndpoints }}
              </div>
              <div class="stat-label">
                總端點數
              </div>
            </div>
            <div class="stat-icon">
              <TotalIcon />
            </div>
          </div>
        </div>
      </div>

      <!-- Content Section -->
      <div class="content-section">
        <div class="content-header">
          <h2 class="content-title">
            <MonitorIcon />
            API 端點監控 ({{ filteredApis.length }})
          </h2>
          <div class="content-filters">
            <div class="filter-group">
              <label>狀態:</label>
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
              <label>分類:</label>
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
        </div>

        <!-- Content -->
        <div class="content-body">
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

          <div
            v-else
            class="api-grid"
          >
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
      </div>
    </div>

    <!-- 統計詳情模態框 -->
    <div
      v-if="showStatModal"
      class="modal-overlay"
      @click="closeStatModal"
    >
      <div
        class="modal"
        @click.stop
      >
        <div class="modal-header">
          <h2>{{ statModalTitle }}</h2>
          <button
            class="close-btn"
            @click="closeStatModal"
          >
            &times;
          </button>
        </div>
        <div class="modal-content">
          <div class="stat-detail-summary">
            <div class="summary-item">
              <span class="summary-label">總數量:</span>
              <span class="summary-value">{{ statModalApis.length }}</span>
            </div>
            <div
              v-if="selectedStatType !== 'all'"
              class="summary-item"
            >
              <span class="summary-label">佔比:</span>
              <span class="summary-value">{{ Math.round((statModalApis.length / totalEndpoints) * 100) }}%</span>
            </div>
          </div>
          
          <div class="stat-detail-list">
            <div 
              v-for="api in statModalApis" 
              :key="api.id"
              class="stat-detail-item"
              :class="`status-${api.status}`"
            >
              <div class="detail-item-header">
                <div
                  class="api-method-badge"
                  :class="api.method.toLowerCase()"
                >
                  {{ api.method }}
                </div>
                <div class="api-endpoint-text">
                  {{ api.endpoint }}
                </div>
                <div
                  class="api-status-indicator"
                  :class="api.status"
                >
                  <span class="status-dot" />
                  {{ getStatusText(api.status) }}
                </div>
              </div>
              
              <div class="detail-item-info">
                <div class="info-row">
                  <span class="info-label">描述:</span>
                  <span class="info-value">{{ api.description }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">分類:</span>
                  <span class="info-value">{{ getCategoryText(api.category) }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">響應時間:</span>
                  <span
                    class="info-value"
                    :class="getResponseTimeClass(api.responseTime)"
                  >
                    {{ api.responseTime }}ms
                  </span>
                </div>
                <div class="info-row">
                  <span class="info-label">成功率:</span>
                  <span
                    class="info-value"
                    :class="getSuccessRateClass(api.successRate)"
                  >
                    {{ api.successRate }}%
                  </span>
                </div>
                <div
                  v-if="api.error"
                  class="info-row error-row"
                >
                  <span class="info-label">錯誤原因:</span>
                  <span class="info-value error-text">{{ api.error }}</span>
                </div>
                <div
                  v-if="api.errorTime"
                  class="info-row"
                >
                  <span class="info-label">錯誤時間:</span>
                  <span class="info-value">{{ formatTime(api.errorTime) }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">最後檢查:</span>
                  <span class="info-value">{{ formatTime(api.lastCheck) }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div
            v-if="statModalApis.length === 0"
            class="empty-stat-detail"
          >
            <div class="empty-icon">
              📊
            </div>
            <p>目前沒有{{ statModalTitle }}的API端點</p>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppLayout from '../components/ui/AppLayout.vue'
import RefreshButton from '../components/ui/RefreshButton.vue'
// import { apiClient } from '../api/client'

// Icon components
const HealthyIcon = {
  template: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22,4 12,14.01 9,11.01"/>
  </svg>`
}

const WarningIcon = {
  template: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
    <path d="M12 9v4"/>
    <path d="m12 17 .01 0"/>
  </svg>`
}

const ErrorIcon = {
  template: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/>
    <path d="m15 9-6 6"/>
    <path d="m9 9 6 6"/>
  </svg>`
}

const TotalIcon = {
  template: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M3 3v18h18"/>
    <path d="M7 12h10"/>
    <path d="M7 8h7"/>
    <path d="M7 16h6"/>
  </svg>`
}

const MonitorIcon = {
  template: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect width="20" height="14" x="2" y="3" rx="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
    <path d="M7 13h5l2-4 2 4h1"/>
  </svg>`
}

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
const showStatModal = ref(false)
const selectedStatType = ref<string>('')
const statModalApis = ref<ApiEndpoint[]>([])

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
      const backendApis = data.data.endpoints.map((endpoint: Partial<ApiEndpoint>) => ({
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
    refreshInterval = window.setInterval(refreshAll, 15000)
  } else {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }
}

const showStatDetails = (type: string): void => {
  selectedStatType.value = type
  
  switch (type) {
    case 'healthy':
      statModalApis.value = apis.value.filter(api => api.status === 'healthy')
      break
    case 'warning':
      statModalApis.value = apis.value.filter(api => api.status === 'warning')
      break
    case 'error':
      statModalApis.value = apis.value.filter(api => api.status === 'error')
      break
    case 'all':
    default:
      statModalApis.value = [...apis.value]
      break
  }
  
  showStatModal.value = true
}

const closeStatModal = (): void => {
  showStatModal.value = false
  selectedStatType.value = ''
  statModalApis.value = []
}

const statModalTitle = computed(() => {
  const titleMap = {
    healthy: '正常狀態的API',
    warning: '警告狀態的API',
    error: '錯誤狀態的API',
    all: '所有API端點'
  }
  return titleMap[selectedStatType.value as keyof typeof titleMap] || 'API詳情'
})

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

const getCategoryText = (category: string): string => {
  const categoryMap = {
    system: '系統',
    auth: '認證',
    conversation: '對話',
    customer: '客戶',
    team: '團隊',
    message: '訊息',
    integration: '整合'
  }
  return categoryMap[category as keyof typeof categoryMap] || category
}

onMounted(async () => {
  // 先初始化默認API列表，然後從後端加載實際狀態
  apis.value = initializeApis()
  await refreshAll()
  
  if (autoRefresh.value) {
    refreshInterval = window.setInterval(refreshAll, 15000)
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
  /* 主要顏色 */
  --primary: #3b82f6;
  --primary-dark: #2563eb;
  --primary-600: #2563eb;
  --primary-700: #1d4ed8;
  
  /* 文字顏色 */
  --text-primary: #111827;
  --text-secondary: #6b7280;
  
  /* 邊框顏色 */
  --border: #d1d5db;
  --border-light: #e5e7eb;
  
  /* 灰色系統 */
  --gray-100: #f3f4f6;
  --gray-200: #e5e7eb;
  --gray-300: #d1d5db;
  --gray-900: #111827;
  
  /* 間距系統 */
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  
  /* 字體大小 */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  
  /* 圓角系統 */
  --radius-md: 0.375rem;
  
  /* 過渡動畫 */
  --transition-fast: 150ms ease-in-out;
}

/* 頁面容器 */
.api-monitor {
  padding: 0;
}

/* 頁面標題區域 */
.page-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2.5rem 2rem;
  margin-bottom: 2rem;
  border-radius: 16px;
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.15);
}

.header-content {
  display: flex;
  justify-content: center;
  align-items: center;
  max-width: 1400px;
  margin: 0 auto;
  text-align: center;
}

.header-info {
  flex: 1;
}

.page-title {
  font-size: 2rem;
  font-weight: 700;
  color: white;
  margin: 0 0 0.5rem 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.page-subtitle {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
  font-weight: 400;
}

/* 控制操作區域 */
.control-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  max-width: 1400px;
  margin: 0 auto 2rem auto;
  padding: 1rem 0;
}

.auto-refresh-control {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.2s;
}

.auto-refresh-control:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
}

.auto-refresh-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
}

.auto-refresh-label input[type="checkbox"] {
  margin: 0;
  accent-color: #667eea;
}


/* 統計概覽區域 */
.stats-overview {
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.stat-card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  border-radius: 16px 16px 0 0;
  transition: all 0.3s;
}

.stat-card.healthy::before {
  background: linear-gradient(90deg, #22c55e, #16a34a);
}

.stat-card.warning::before {
  background: linear-gradient(90deg, #f59e0b, #d97706);
}

.stat-card.error::before {
  background: linear-gradient(90deg, #ef4444, #dc2626);
}

.stat-card.total::before {
  background: linear-gradient(90deg, #3b82f6, #2563eb);
}

.stat-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
}

.stat-content {
  flex: 1;
}

.stat-number {
  font-size: 3rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
  background: linear-gradient(135deg, #1e293b, #334155);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-card.healthy .stat-number {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-card.warning .stat-number {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-card.error .stat-number {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-card.total .stat-number {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-label {
  font-size: 1rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-icon {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.3s;
}

.stat-card.healthy .stat-icon {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(22, 163, 74, 0.15));
  color: #16a34a;
}

.stat-card.warning .stat-icon {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.15));
  color: #d97706;
}

.stat-card.error .stat-icon {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.15));
  color: #dc2626;
}

.stat-card.total .stat-icon {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.15));
  color: #2563eb;
}

/* 內容區域 */
.content-section {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  max-width: 1400px;
  margin: 0 auto;
}

.content-header {
  padding: 2rem;
  border-bottom: 1px solid #f1f5f9;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.content-title {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.content-title svg {
  color: #667eea;
}

.content-filters {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #64748b;
  white-space: nowrap;
}

.filter-group select,
.search-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  background: white;
  transition: all 0.2s;
}

.filter-group select:focus,
.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-input {
  min-width: 200px;
}

.content-body {
  padding: 2rem;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #64748b;
}

.empty-state .empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  color: #374151;
  font-size: 1.25rem;
}

.empty-state p {
  margin: 0;
  font-size: 1rem;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  font-weight: 500;
  line-height: 1;
  border-radius: var(--radius-md);
  border: 1px solid var(--gray-300);
  background-color: var(--gray-100);
  color: var(--gray-900);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-decoration: none;
  white-space: nowrap;
}

.detail-actions button:hover:not(:disabled) {
  background-color: var(--gray-200);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.detail-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

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

/* 模態框樣式 - 修復滾動問題 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  backdrop-filter: blur(4px);
  overflow-y: auto;
  /* 防止背景滾動 */
  overscroll-behavior: contain;
}

.modal {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 900px;
  width: 100%;
  margin: 40px auto;
  animation: modalSlideIn 0.3s ease-out;
  position: relative;
  max-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2rem;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px 16px 0 0;
  color: white;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: white;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: white;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.modal-content {
  padding: 2rem;
  overflow-y: auto;
  flex: 1;
  max-height: calc(80vh - 120px);
}

.stat-detail-summary {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--border-light);
  border-radius: 8px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.summary-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.stat-detail-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stat-detail-item {
  background: white;
  border-radius: 12px;
  border: 1px solid var(--border);
  padding: 16px;
  transition: all 0.2s;
}

.stat-detail-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stat-detail-item.status-healthy {
  border-left: 4px solid #22c55e;
}

.stat-detail-item.status-warning {
  border-left: 4px solid #fbbf24;
}

.stat-detail-item.status-error {
  border-left: 4px solid #ef4444;
}

.detail-item-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.api-method-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  min-width: 60px;
  text-align: center;
}

.api-endpoint-text {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: var(--text-primary);
  flex: 1;
  min-width: 200px;
}

.api-status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.detail-item-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.info-label {
  font-size: 13px;
  color: var(--text-secondary);
  min-width: 80px;
}

.info-value {
  font-size: 13px;
  color: var(--text-primary);
  text-align: right;
}

.error-row .info-label,
.error-row .error-text {
  color: #ef4444;
}

.error-text {
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.empty-stat-detail {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}

.empty-stat-detail .empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

/* 響應式設計 - 平板 */
@media (max-width: 768px) {
  .page-header {
    padding: 2rem 1.5rem;
    margin-bottom: 1rem;
  }

  .control-actions {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
    padding: 1rem 1.5rem;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .content-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .content-filters {
    justify-content: stretch;
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .filter-group {
    flex-direction: column;
    gap: 0.25rem;
  }

  .search-input {
    min-width: auto;
  }
  
  .api-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .api-metrics {
    justify-content: space-between;
  }

  .modal-overlay {
    padding: 12px;
  }

  .modal {
    margin: 20px auto;
  }

  .modal-content {
    padding: 1.5rem;
    max-height: calc(90vh - 120px);
  }

  .modal-header {
    padding: 1.5rem;
  }

  .stat-detail-summary {
    flex-direction: column;
    gap: 12px;
  }

  .detail-item-header {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .api-endpoint-text {
    min-width: auto;
  }

  .detail-item-info {
    grid-template-columns: 1fr;
  }
}

/* 響應式設計 - 手機 */
@media (max-width: 480px) {
  .page-header {
    padding: 1.5rem 1rem;
    margin-bottom: 0.5rem;
  }

  .page-title {
    font-size: 1.5rem;
  }

  .page-subtitle {
    font-size: 1rem;
  }

  .control-actions {
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .stat-card {
    padding: 1.5rem;
  }

  .stat-number {
    font-size: 2rem;
  }

  .stat-icon {
    width: 60px;
    height: 60px;
  }

  .content-section {
    border-radius: 12px;
  }

  .content-header {
    padding: 1.5rem 1rem;
  }

  .content-title {
    font-size: 1.25rem;
  }

  .content-body {
    padding: 1rem;
  }

  .api-card {
    border-radius: 8px;
  }

  .api-header {
    padding: 1rem;
  }

  .api-details {
    padding: 1rem;
  }

  .details-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .detail-actions {
    flex-direction: column;
    gap: 0.5rem;
  }

  .modal {
    margin: 10px auto;
    border-radius: 12px;
  }

  .modal-header {
    padding: 1rem;
    border-radius: 12px 12px 0 0;
  }

  .modal-header h2 {
    font-size: 1.125rem;
  }

  .modal-content {
    padding: 1rem;
  }
}

/* Reduced Motion Preference */
@media (prefers-reduced-motion: reduce) {
  .api-card,
  .stat-card,
  .btn,
  .btn-refresh,
  .btn-clear,
  .modal,
  .form-select,
  .form-input,
  .auto-refresh-controls,
  .spinner {
    transition: none !important;
    transform: none !important;
    animation: none !important;
  }

  .api-card:hover {
    transform: none !important;
  }

  .loading-spinner {
    animation: none !important;
  }

  @keyframes spin {
    0%, 100% {
      transform: rotate(0deg);
    }
  }
}
</style>