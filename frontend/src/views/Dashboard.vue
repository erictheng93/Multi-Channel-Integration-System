<template>
  <AppLayout>
    <!-- ⚡ LCP 優化：全頁面骨架屏 (初始載入時顯示) -->
    <DashboardSkeleton v-if="isInitialLoading" />

    <div
      v-else
      class="dashboard"
    >
      <!-- Welcome Section -->
      <div class="welcome-section">
        <div class="welcome-content">
          <div class="welcome-greeting">
            <h1 class="welcome-title">
              {{ t('dashboard.welcome') }}，{{ currentAgent?.displayName || currentAgent?.name || '載入中...' }}
            </h1>
            <p class="welcome-subtitle">
              {{ currentDate }}
            </p>
          </div>
          <div class="welcome-actions">
            <PrimaryActionButton
              text="查看對話"
              :icon="ChatIcon"
              to="/conversations"
            />
            <RefreshButton
              :loading="loading"
              @refresh="refreshData"
            />
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="stats-overview">
        <div class="stats-grid">
          <div class="stat-card pending">
            <div class="stat-content">
              <div class="stat-number">
                {{ openConversations.length }}
              </div>
              <div class="stat-label">
                待處理對話
              </div>
            </div>
            <div class="stat-icon">
              <ChatIcon />
            </div>
          </div>

          <div class="stat-card active">
            <div class="stat-content">
              <div class="stat-number">
                {{ assignedConversations.length }}
              </div>
              <div class="stat-label">
                處理中對話
              </div>
            </div>
            <div class="stat-icon">
              <UserIcon />
            </div>
          </div>

          <div class="stat-card messages">
            <div class="stat-content">
              <div class="stat-number">
                {{ dashboardStats?.todayMessages || 0 }}
              </div>
              <div class="stat-label">
                今日訊息
              </div>
            </div>
            <div class="stat-icon">
              <ChatIcon />
            </div>
          </div>

          <div class="stat-card agents">
            <div class="stat-content">
              <div class="stat-number">
                {{ dashboardStats?.onlineAgents || 0 }}
              </div>
              <div class="stat-label">
                線上客服
              </div>
            </div>
            <div class="stat-icon">
              <UserIcon />
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="content-grid">
        <!-- Recent Conversations -->
        <div class="main-card conversations-card">
          <div class="card-header">
            <div class="card-title-group">
              <h2 class="card-title">
                最近對話
              </h2>
              <p class="card-subtitle">
                最新的客戶互動記錄
              </p>
            </div>
            <router-link
              to="/conversations"
              class="view-all-link"
            >
              查看全部
            </router-link>
          </div>
          <div class="card-body">
            <HamsterLoader
              v-if="loading || statsLoading"
              message="載入中..."
            />
            <EmptyState
              v-else-if="recentConversations.length === 0"
              title="暫無對話記錄"
              description="當有新的客戶對話時，會顯示在這裡"
            >
              <template #actions>
                <button
                  class="btn btn-primary"
                  @click="refreshData"
                >
                  刷新數據
                </button>
              </template>
            </EmptyState>
            <div
              v-else
              class="conversation-list"
            >
              <ConversationCard
                v-for="conversation in recentConversations"
                :key="conversation.id"
                :conversation="conversation"
                @select="goToConversation"
              />
            </div>
          </div>
        </div>

        <!-- Activity Feed -->
        <div class="side-card activity-card">
          <div class="card-header">
            <div class="card-title-group">
              <h2 class="card-title">
                活動動態
              </h2>
              <p class="card-subtitle">
                <!-- ✅ WebSocket connection status -->
                <span :class="['connection-status', activityStreamConnected ? 'connected' : 'disconnected']">
                  {{ activityStreamConnected ? '● 已連線' : '○ 未連線' }}
                </span>
                WebSocket 模式
              </p>
            </div>
            <div class="activity-actions">
              <router-link
                to="/activities"
                class="view-all-link"
              >
                查看全部
              </router-link>
              <!-- REMOVED: SSE reconnect button (Phase 1 cleanup) -->
            </div>
          </div>
          <div class="card-body">
            <HamsterLoader
              v-if="loading"
              message="載入中..."
            />
            <EmptyState
              v-else-if="importantActivities.length === 0" 
              title="暫無重要活動" 
              description="當有重要的系統活動時，會顯示在這裡"
            />
            <div
              v-else
              class="activity-list"
            >
              <div
                v-for="activity in importantActivities"
                :key="activity.id"
                class="activity-item"
                :class="activity.priority"
              >
                <div
                  class="activity-icon"
                  :class="activity.type"
                >
                  <component :is="getActivityIcon(activity.type)" />
                </div>
                <div class="activity-content">
                  <div class="activity-header">
                    <div class="activity-title">
                      {{ activity.title }}
                    </div>
                    <div
                      v-if="activity.priority === 'high'"
                      class="activity-priority"
                    >
                      🔴
                    </div>
                  </div>
                  <div class="activity-description">
                    {{ activity.description }}
                  </div>
                  <div class="activity-time">
                    {{ formatTime(activity.createdAt) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation Test (Debug) - Temporarily disabled -->
      <!-- <NavigationTest v-if="isDev" /> -->

      <!-- Performance Metrics -->
      <div class="performance-section">
        <div class="section-header">
          <h3 class="section-title">
            效能指標
          </h3>
          <p class="section-subtitle">
            今日系統表現概覽
          </p>
        </div>
        <div class="performance-grid">
          <div class="performance-card">
            <div class="performance-icon response-time">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 6V12L16 14"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  stroke-width="2"
                />
              </svg>
            </div>
            <div class="performance-content">
              <div class="performance-value">
                {{ dashboardStats?.responseTime || '0分鐘' }}
              </div>
              <div class="performance-label">
                平均回應時間
              </div>
            </div>
          </div>

          <div class="performance-card">
            <div class="performance-icon satisfaction">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <path
                  d="M8 14s1.5 2 4 2 4-2 4-2"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M9 9h.01"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M15 9h.01"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            </div>
            <div class="performance-content">
              <div class="performance-value">
                {{ dashboardStats?.satisfactionRate || 0 }}%
              </div>
              <div class="performance-label">
                客戶滿意度
              </div>
            </div>
          </div>

          <div class="performance-card">
            <div class="performance-icon resolved">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9 12l2 2 4-4"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  stroke-width="2"
                />
              </svg>
            </div>
            <div class="performance-content">
              <div class="performance-value">
                {{ dashboardStats?.resolvedToday || 0 }}
              </div>
              <div class="performance-label">
                今日已解決
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Analytics Comparison Section - ⚡ LCP 優化：延遲加載 -->
      <div
        v-if="showAnalytics"
        class="analytics-section content-ready"
      >
        <div class="section-header">
          <h3 class="section-title">
            數據趨勢分析
          </h3>
          <p class="section-subtitle">
            關鍵指標期間比較與趨勢洞察
          </p>
        </div>
        <MetricsComparisonDashboard
          title="對話指標趨勢分析"
          preset="conversation"
          :auto-refresh="true"
          :refresh-interval="60000"
        />
      </div>
      <!-- Analytics 加載佔位符 -->
      <div
        v-else
        class="analytics-section analytics-placeholder"
      >
        <div class="section-header">
          <h3 class="section-title">
            數據趨勢分析
          </h3>
          <p class="section-subtitle">
            正在準備載入...
          </p>
        </div>
        <div class="analytics-skeleton">
          <div class="skeleton-grid">
            <div class="skeleton-card" />
            <div class="skeleton-card" />
            <div class="skeleton-card" />
            <div class="skeleton-card" />
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed, watch, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '@/composables/useI18n'
import { useAuth } from '@/composables/useAuth'
import { useConversations } from '@/composables/useConversations'
import { useAsyncData } from '@/composables/useAsyncData'
import { useTokenRefresh } from '@/composables/useTokenRefresh'
import { useActivityTracker } from '@/composables/useActivityTracker'
import { useActivityStream } from '@/composables/useActivityStream'
import AppLayout from '@/components/ui/AppLayout.vue'
import DashboardSkeleton from '@/components/ui/DashboardSkeleton.vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConversationCard from '@/components/conversation/ConversationCard.vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'
import PrimaryActionButton from '@/components/ui/PrimaryActionButton.vue'
// import NavigationTest from '@/components/debug/NavigationTest.vue'
import { ChatIcon, UserIcon, MessageCircleIcon } from '@/components/icons'
import MetricsComparisonDashboard from '@/components/analytics/MetricsComparisonDashboard.vue'
import type { Conversation } from '@/types'

const router = useRouter()
const { currentAgent } = useAuth()
const { t } = useI18n()

// ⚡ LCP 優化：初始載入狀態 - 用於顯示骨架屏
const isInitialLoading = ref(true)

// ⚡ LCP 優化：延遲加載 Analytics 組件
const showAnalytics = ref(false)

// 開發模式檢查
// const isDev = computed(() => import.meta.env.DEV)

// Debug auth data in development
if (import.meta.env.DEV) {
  import('@/utils/debug-auth').then(({ debugAuthData }) => {
    console.log('🎯 Dashboard mounted - debugging auth data:')
    debugAuthData()
    
    // Also log currentAgent directly
    console.log('🎯 currentAgent from useAuth:', currentAgent.value)
  })
}

// 簡化方法 - 直接初始化，但使用不同的順序
const conversationsData = useConversations()
const conversations = conversationsData.conversations
const openConversations = conversationsData.openConversations
const assignedConversations = conversationsData.assignedConversations
const loading = conversationsData.loading
const refreshConversations = conversationsData.refreshConversations

const tokenRefreshData = useTokenRefresh()
const startTokenRefreshCheck = tokenRefreshData.startTokenRefreshCheck
const stopTokenRefreshCheck = tokenRefreshData.stopTokenRefreshCheck

const activityTrackerData = useActivityTracker()
const startTracking = activityTrackerData.startTracking
const stopTracking = activityTrackerData.stopTracking

// ✅ WebSocket-based Activity Stream (Phase 1完成)
const activityStreamData = useActivityStream({
  maxActivities: 50,
  autoConnect: true,
  priorityFilter: [] // 顯示所有優先級
})
const realtimeActivities = activityStreamData.activities
const activityStreamConnected = activityStreamData.isConnected

// 使用 useAsyncData 獲取統計數據
const { data: dashboardStats, pending: statsLoading, refresh: refreshStats } = useAsyncData(
  'dashboard-stats',
  async () => {
    // 模擬 API 調用獲取統計數據
    return {
      todayMessages: 156,
      onlineAgents: 3,
      responseTime: '2.5分鐘',
      satisfactionRate: 94,
      resolvedToday: 23
    }
  },
  { immediate: true }
)

// ✅ WebSocket-based Activity Stream - 篩選重要活動
// 只顯示最近2小時內的高優先級和中優先級活動
const importantActivities = computed(() => {
  const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000)

  return realtimeActivities.value
    .filter((activity) => {
      const activityTime = new Date(activity.createdAt).getTime()
      const isRecent = activityTime > twoHoursAgo
      const isImportant = activity.priority === 'high' || activity.priority === 'medium'
      return isRecent && isImportant
    })
    .slice(0, 8) // 最多顯示 8 個重要活動
})

const currentDate = computed(() => {
  return new Date().toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
})

const recentConversations = computed(() =>
  conversations.value?.slice(0, 5) || []
)

const goToConversation = (conversation: Conversation) => {
  router.push(`/conversations/${conversation.id}`)
}

const refreshData = async () => {
  await Promise.all([
    refreshConversations(),
    refreshStats()
  ])
}

const getActivityIcon = (type: string) => {
  const icons = {
    // 業務活動
    message: MessageCircleIcon,
    assignment: UserIcon,
    resolved: ChatIcon,
    urgent: MessageCircleIcon, // 可以用不同的緊急圖標
    
    // 系統狀態
    'system-error': MessageCircleIcon, // 可以用錯誤圖標
    'system-success': MessageCircleIcon, // 可以用成功圖標
    'system-warning': MessageCircleIcon, // 可以用警告圖標
    'system-info': MessageCircleIcon, // 可以用信息圖標
    
    // 用戶和設定
    user: UserIcon,
    settings: MessageCircleIcon, // 可以用設定圖標
    'settings-critical': MessageCircleIcon // 可以用重要設定圖標
  }
  return icons[type as keyof typeof icons] || MessageCircleIcon
}

const formatTime = (date: Date) => {
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

  if (diffInMinutes < 1) { return '剛剛' }
  if (diffInMinutes < 60) { return `${diffInMinutes} 分鐘前` }
  if (diffInMinutes < 1440) { return `${Math.floor(diffInMinutes / 60)} 小時前` }
  return date.toLocaleDateString('zh-TW')
}

// 監聽 currentAgent 變化 - 啟用調試
watch(() => currentAgent.value, (newAgent, oldAgent) => {
  console.log('👤 Dashboard: currentAgent changed', {
    old: oldAgent,
    new: newAgent,
    displayName: newAgent?.displayName,
    name: newAgent?.name
  })
}, { immediate: true, deep: true })

// 監聽路由變化，確保Dashboard正確重新渲染
watch(() => router.currentRoute.value.path, (newPath, oldPath) => {
  console.log('🔄 Dashboard: Route changed from', oldPath, 'to', newPath)
  
  // 如果路由到達Dashboard頁面，確保數據刷新
  if (newPath === '/dashboard') {
    console.log('🔄 Dashboard: Refreshing data due to route change')
    refreshData()
  }
}, { immediate: false })

onMounted(async () => {
  // 數據會自動載入，因為 useAsyncData 和 useConversations 都設置了 immediate: true
  console.log('🚀 Dashboard mounted')

  // ⚡ LCP 優化：快速切換到實際內容
  // 使用 requestAnimationFrame 確保骨架屏至少渲染一幀後再切換
  // 這可以避免閃爍並確保 LCP 元素盡快顯示
  window.requestAnimationFrame(() => {
    // 延遲一小段時間讓數據有機會載入
    setTimeout(() => {
      isInitialLoading.value = false
      console.log('⚡ [Dashboard] Initial skeleton hidden, showing content')
    }, 150) // 短暫延遲確保數據開始載入
  })

  // ⚡ LCP 優化：延遲加載 Analytics 組件
  // 等待主要內容渲染完成後，再加載 Analytics
  // 這可以顯著改善 LCP 指標
  const scheduleAnalyticsLoad = () => {
    showAnalytics.value = true
    console.log('⚡ [Dashboard] Analytics component loaded (deferred)')
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(scheduleAnalyticsLoad, { timeout: 3000 })
  } else {
    // Fallback: 延遲 500ms 讓 LCP 優先完成
    setTimeout(scheduleAnalyticsLoad, 500)
  }

  // 啟動 token 刷新檢查和活動追蹤
  startTokenRefreshCheck()
  startTracking()
})

onBeforeUnmount(() => {
  // 清理 token 刷新檢查和活動追蹤
  console.log('🛑 Stopping token refresh and activity tracking')
  stopTokenRefreshCheck()
  stopTracking()
})
</script>

<style scoped>
.dashboard {
  /* 動態容器尺寸，根據筆電螢幕調整 */
  max-width: clamp(1200px, 85vw, 1650px);
  margin: 0 auto;
  padding: clamp(1rem, 2vw, 2rem) clamp(0.5rem, 2vw, 1.5rem);
  min-height: 100%;
  /* 確保內容可以完整顯示並滾動 */
}

.welcome-section {
  margin-bottom: var(--space-12);
  padding: var(--space-8) 0;
}

.welcome-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 100%;
}

.welcome-greeting {
  flex: 1;
}

.welcome-title {
  /* 流體字體，根據螢幕尺寸調整 */
  font-size: clamp(1.75rem, 1.5rem + 2vw, 2.8rem);
  font-weight: 800;
  color: var(--gray-900);
  margin-bottom: var(--space-2);
  letter-spacing: -0.025em;
}

.welcome-subtitle {
  font-size: 1rem;
  color: var(--gray-600);
  font-weight: 400;
}

.welcome-actions {
  display: flex;
  gap: var(--space-4);
  align-items: center;
}

.stats-overview {
  margin-bottom: var(--space-12);
}

.stats-grid {
  display: grid;
  /* 根據螢幕寬度動態調整列數和最小寬度 */
  grid-template-columns: repeat(auto-fit, minmax(clamp(240px, 20vw, 300px), 1fr));
  gap: clamp(1rem, 2vw, 2rem);
}

.stat-card {
  background: white;
  border-radius: var(--radius-2xl);
  padding: var(--space-8);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--gray-200);
  transition: background-color var(--transition-fast);
}

.stat-card.pending::before {
  background: linear-gradient(180deg, #f59e0b, #d97706);
}

.stat-card.active::before {
  background: linear-gradient(180deg, #3b82f6, #2563eb);
}

.stat-card.messages::before {
  background: linear-gradient(180deg, #10b981, #059669);
}

.stat-card.agents::before {
  background: linear-gradient(180deg, #8b5cf6, #7c3aed);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
}

.stat-content {
  flex: 1;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--gray-900);
  margin-bottom: var(--space-1);
  line-height: 1;
}

.stat-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-xl);
  background: var(--gray-50);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gray-600);
  flex-shrink: 0;
}

.content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-8);
  margin-bottom: var(--space-12);
}

.main-card {
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
  overflow: hidden;
  transition: all var(--transition-fast);
}

.side-card {
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
  overflow: hidden;
}

.card-header {
  padding: var(--space-8);
  border-bottom: 1px solid var(--gray-100);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.card-title-group {
  flex: 1;
}

.card-title {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0 0 var(--space-1) 0;
  letter-spacing: -0.025em;
}

.card-subtitle {
  font-size: 0.875rem;
  color: var(--gray-600);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.connection-status {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  transition: all var(--transition-fast);
}

.connection-status.connected {
  color: var(--success-600);
  background: var(--success-50);
}

.connection-status.disconnected {
  color: var(--gray-500);
  background: var(--gray-100);
}

.view-all-link {
  color: var(--primary-600);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 600;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.view-all-link:hover {
  background: var(--primary-50);
  color: var(--primary-700);
}

.activity-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.btn-sm {
  padding: var(--space-1) var(--space-2);
  font-size: 0.75rem;
  border-radius: var(--radius-md);
}

.card-body {
  padding: 0 var(--space-8) var(--space-8) var(--space-8);
}

.conversation-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.activity-item {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  transition: background-color var(--transition-fast);
  position: relative;
}

.activity-item:hover {
  background-color: var(--gray-25);
}

.activity-item.high {
  border-left: 3px solid #ef4444;
  background-color: rgba(239, 68, 68, 0.02);
}

.activity-item.medium {
  border-left: 3px solid var(--warning-500);
  background-color: rgba(245, 158, 11, 0.02);
}

.activity-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-1);
}

.activity-priority {
  font-size: 12px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.activity-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
  font-size: 16px;
}

.activity-icon.message {
  background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
}

.activity-icon.assignment {
  background: linear-gradient(135deg, var(--warning-500), var(--warning-600));
}

.activity-icon.resolved {
  background: linear-gradient(135deg, var(--success-500), var(--success-600));
}

.activity-icon.urgent {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.activity-icon.system-error {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.activity-icon.system-success {
  background: linear-gradient(135deg, var(--success-500), var(--success-600));
}

.activity-icon.system-warning {
  background: linear-gradient(135deg, var(--warning-500), var(--warning-600));
}

.activity-icon.system-info {
  background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
}

.activity-icon.user {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
}

.activity-icon.settings {
  background: linear-gradient(135deg, #6b7280, #4b5563);
}

.activity-icon.settings-critical {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.activity-content {
  flex: 1;
  min-width: 0;
}

.activity-title {
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: var(--space-1);
  font-size: 0.875rem;
}

.activity-description {
  font-size: 0.8rem;
  color: var(--gray-600);
  margin-bottom: var(--space-2);
  line-height: 1.4;
}

.activity-time {
  font-size: 0.75rem;
  color: var(--gray-500);
  font-weight: 500;
}

.performance-section {
  margin-top: var(--space-12);
}

.analytics-section {
  margin-top: var(--space-12);
}

/* ⚡ LCP 優化：Analytics 骨架屏樣式 */
.analytics-placeholder {
  opacity: 0.7;
}

.analytics-skeleton {
  background: white;
  border-radius: var(--radius-2xl);
  padding: var(--space-8);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-6);
}

.skeleton-card {
  height: 120px;
  background: linear-gradient(90deg, var(--gray-100) 25%, var(--gray-50) 50%, var(--gray-100) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-xl);
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.section-header {
  margin-bottom: var(--space-8);
  text-align: center;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gray-900);
  margin-bottom: var(--space-2);
  letter-spacing: -0.025em;
}

.section-subtitle {
  font-size: 1rem;
  color: var(--gray-600);
  margin: 0;
}

.performance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-6);
}

.performance-card {
  background: white;
  border-radius: var(--radius-2xl);
  padding: var(--space-8);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
  display: flex;
  align-items: center;
  gap: var(--space-6);
  transition: all var(--transition-fast);
}

.performance-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
}

.performance-icon {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.performance-icon.response-time {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
}

.performance-icon.satisfaction {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
}

.performance-icon.resolved {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
}

.performance-content {
  flex: 1;
}

.performance-value {
  font-size: 2rem;
  font-weight: 800;
  color: var(--gray-900);
  margin-bottom: var(--space-1);
  line-height: 1;
}

.performance-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* 低解析度筆電特殊優化 (1080x720等) */
@media (min-width: 1025px) and (max-width: 1119px) {
  .dashboard {
    max-width: 1000px;
    padding: 1rem 0.75rem;
  }

  .welcome-title {
    font-size: clamp(1.5rem, 1.2rem + 1vw, 1.8rem);
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .content-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .welcome-section {
    margin-bottom: 2rem;
    padding: 1.5rem 0;
  }

  .performance-section {
    margin-top: 2rem;
  }

  .stat-card {
    padding: 1rem;
  }

  .stat-number {
    font-size: 2rem;
  }

  .card-header {
    padding: 1rem;
  }

  .card-body {
    padding: 0 1rem 1rem 1rem;
  }
}

/* 標準筆電斷點 */
@media (min-width: 1120px) and (max-width: 1279px) {
  .dashboard {
    max-width: 1200px;
  }

  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .welcome-title {
    font-size: clamp(1.75rem, 1.5rem + 1.2vw, 2rem);
  }
}

@media (min-width: 1280px) and (max-width: 1439px) {
  .dashboard {
    max-width: 1350px;
  }

  .welcome-title {
    font-size: clamp(2rem, 1.7rem + 1.5vw, 2.3rem);
  }
}

@media (min-width: 1440px) and (max-width: 1679px) {
  .dashboard {
    max-width: 1500px;
  }

  .welcome-title {
    font-size: clamp(2.2rem, 1.9rem + 1.8vw, 2.5rem);
  }
}

@media (min-width: 1680px) {
  .dashboard {
    max-width: 1650px;
  }

  .welcome-title {
    font-size: clamp(2.4rem, 2rem + 2vw, 2.8rem);
  }

  /* 防止內容過於分散 */
  .content-grid {
    max-width: 1400px;
    margin: 0 auto;
  }
}

/* Responsive Design */
@media (max-width: 1024px) {
  .dashboard {
    padding: var(--space-4) var(--space-3);
  }

  .content-grid {
    grid-template-columns: 1fr;
    gap: var(--space-6);
  }

  .welcome-content {
    flex-direction: column;
    text-align: center;
    gap: var(--space-6);
  }

  .welcome-title {
    font-size: 2rem;
  }

  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--space-4);
  }

  .performance-grid {
    grid-template-columns: 1fr;
    gap: var(--space-4);
  }
}

@media (max-width: 768px) {
  .dashboard {
    padding: var(--space-3) var(--space-2);
  }

  .welcome-title {
    font-size: 1.75rem;
  }

  .stat-card {
    padding: var(--space-6);
  }

  .stat-number {
    font-size: 2rem;
  }

  .card-header {
    padding: var(--space-6);
  }

  .card-body {
    padding: 0 var(--space-6) var(--space-6) var(--space-6);
  }

  .performance-card {
    padding: var(--space-6);
    gap: var(--space-4);
  }

  .performance-icon {
    width: 56px;
    height: 56px;
  }

  .performance-value {
    font-size: 1.75rem;
  }
}

@media (max-width: 640px) {
  .welcome-actions {
    flex-direction: column;
    width: 100%;
    gap: var(--space-3);
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stat-card {
    padding: var(--space-5);
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-5);
  }

  .card-body {
    padding: 0 var(--space-5) var(--space-5) var(--space-5);
  }

  .view-all-link {
    align-self: flex-end;
  }

  .activity-item {
    padding: var(--space-3);
    gap: var(--space-3);
  }

  .activity-icon {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }
}

@media (max-width: 320px) {
  .dashboard {
    padding: var(--space-2) var(--space-1);
  }

  .welcome-title {
    font-size: 1.5rem;
    line-height: 1.3;
  }

  .stat-number {
    font-size: 1.75rem;
  }

  .stat-card {
    padding: var(--space-4);
  }

  .card-header {
    padding: var(--space-4);
  }

  .card-body {
    padding: 0 var(--space-4) var(--space-4) var(--space-4);
  }

  .performance-value {
    font-size: 1.5rem;
  }

  .performance-icon {
    width: 48px;
    height: 48px;
  }

  .activity-item {
    padding: var(--space-2);
    gap: var(--space-2);
  }

  .activity-icon {
    width: 28px;
    height: 28px;
    font-size: 12px;
  }
}

/* Reduced Motion Preference */
@media (prefers-reduced-motion: reduce) {
  .stat-card,
  .main-card,
  .side-card,
  .performance-card,
  .activity-item,
  .view-all-link,
  .welcome-actions *,
  .btn {
    transition: none !important;
  }

  .activity-priority {
    animation: none !important;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
  }

  .animate-spin {
    animation: none !important;
  }
}
</style>