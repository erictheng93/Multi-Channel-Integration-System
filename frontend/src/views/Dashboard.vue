<template>
  <AppLayout>
    <!--  LCP 優化：全頁面骨架屏 (初始載入時顯示) -->
    <DashboardSkeleton v-if="isInitialLoading" />

    <div
      v-else
      class="dashboard"
    >
      <!-- Welcome Section -->
      <WelcomeSection
        :user-name="currentAgent?.displayName || currentAgent?.name || '載入中...'"
        :current-date="currentDate"
        :loading="loading || statsLoading"
        @refresh="refreshData"
      />

      <!-- Stats Grid -->
      <StatsGrid>
        <StatCard
          :value="openConversations.length"
          label="待處理對話"
          :icon="ChatIcon"
          variant="pending"
        />
        <StatCard
          :value="assignedConversations.length"
          label="處理中對話"
          :icon="UserIcon"
          variant="active"
        />
        <StatCard
          :value="stats?.todayMessages || 0"
          label="今日訊息"
          :icon="MessageCircleIcon"
          variant="messages"
        />
        <StatCard
          :value="stats?.onlineAgents || 0"
          label="線上客服"
          :icon="UserIcon"
          variant="agents"
        />
      </StatsGrid>

      <!-- Main Content Grid -->
      <div class="content-grid">
        <!-- Recent Conversations -->
        <RecentConversationsCard
          :conversations="recentConversations"
          :loading="loading || statsLoading"
          @select="goToConversation"
          @refresh="refreshData"
        />

        <!-- Activity Feed -->
        <ActivityFeedCard
          :activities="importantActivities"
          :is-connected="activityStreamConnected"
          :is-connecting="activityStreamConnecting"
          :connection-state="activityConnectionState"
          :reconnect-attempts="activityReconnectAttempts"
          :latency="activityLatency"
          :get-activity-icon="getActivityIcon"
          :format-time="formatTime"
          :loading="loading"
          @reconnect="reconnectActivityStream"
        />
      </div>

      <!-- Performance Metrics -->
      <PerformanceMetrics
        :response-time="stats?.responseTime || '0分鐘'"
        :satisfaction-rate="stats?.satisfactionRate || 0"
        :resolved-today="stats?.resolvedToday || 0"
      />

      <!-- Analytics Comparison Section -  LCP 優化：延遲加載 -->
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
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useTokenRefresh } from '@/composables/useTokenRefresh'
import { useActivityTracker } from '@/composables/useActivityTracker'

// Dashboard composables
import { useDashboardStats } from '@/composables/dashboard/useDashboardStats'
import { useDashboardActivities } from '@/composables/dashboard/useDashboardActivities'
import { useDashboardData } from '@/composables/dashboard/useDashboardData'

// UI components
import AppLayout from '@/components/ui/AppLayout.vue'
import DashboardSkeleton from '@/components/ui/DashboardSkeleton.vue'
import MetricsComparisonDashboard from '@/components/analytics/MetricsComparisonDashboard.vue'

// Dashboard components
import {
  WelcomeSection,
  StatsGrid,
  StatCard,
  RecentConversationsCard,
  ActivityFeedCard,
  PerformanceMetrics
} from '@/components/dashboard'

// Icons
import { ChatIcon, UserIcon, MessageCircleIcon } from '@/components/icons'

const router = useRouter()
const { currentAgent } = useAuth()

// LCP 優化：初始載入狀態 - 用於顯示骨架屏
const isInitialLoading = ref(true)

// LCP 優化：延遲加載 Analytics 組件
const showAnalytics = ref(false)

// Debug auth data in development
if (import.meta.env.DEV) {
  import('@/utils/debug-auth').then(({ debugAuthData }) => {
    console.log(' Dashboard mounted - debugging auth data:')
    debugAuthData()
    console.log(' currentAgent from useAuth:', currentAgent.value)
  })
}

// Use dashboard composables
const { stats, loading: statsLoading, refresh: refreshStats } = useDashboardStats()

const {
  activities: importantActivities,
  isConnected: activityStreamConnected,
  isConnecting: activityStreamConnecting,
  connectionState: activityConnectionState,
  reconnectAttempts: activityReconnectAttempts,
  latency: activityLatency,
  reconnect: reconnectActivityStream,
  getActivityIcon,
  formatTime
} = useDashboardActivities({
  importantTimeRange: 2, // 2 hours
  maxImportantActivities: 8
})

const {
  openConversations,
  assignedConversations,
  recentConversations,
  loading,
  currentDate,
  goToConversation,
  refresh: refreshConversations
} = useDashboardData({
  recentConversationsCount: 5
})

// Token refresh and activity tracking
const tokenRefreshData = useTokenRefresh()
const startTokenRefreshCheck = tokenRefreshData.startTokenRefreshCheck
const stopTokenRefreshCheck = tokenRefreshData.stopTokenRefreshCheck

const activityTrackerData = useActivityTracker()
const startTracking = activityTrackerData.startTracking
const stopTracking = activityTrackerData.stopTracking

/**
 * 刷新所有數據
 */
const refreshData = async () => {
  await Promise.all([
    refreshConversations(),
    refreshStats()
  ])
}

// 監聽 currentAgent 變化 - 啟用調試
watch(() => currentAgent.value, (newAgent, oldAgent) => {
  console.log(' Dashboard: currentAgent changed', {
    old: oldAgent,
    new: newAgent,
    displayName: newAgent?.displayName,
    name: newAgent?.name
  })
}, { immediate: true, deep: true })

// 監聽路由變化，確保Dashboard正確重新渲染
watch(() => router.currentRoute.value.path, (newPath, oldPath) => {
  console.log(' Dashboard: Route changed from', oldPath, 'to', newPath)

  // 如果路由到達Dashboard頁面，確保數據刷新
  if (newPath === '/dashboard') {
    console.log(' Dashboard: Refreshing data due to route change')
    refreshData()
  }
}, { immediate: false })

onMounted(async () => {
  // 數據會自動載入，因為 composables 都設置了 immediate: true
  console.log(' Dashboard mounted')

  // LCP 優化：快速切換到實際內容
  // 使用 requestAnimationFrame 確保骨架屏至少渲染一幀後再切換
  window.requestAnimationFrame(() => {
    // 延遲一小段時間讓數據有機會載入
    setTimeout(() => {
      isInitialLoading.value = false
      console.log('[Dashboard] Initial skeleton hidden, showing content')
    }, 150) // 短暫延遲確保數據開始載入
  })

  // LCP 優化：延遲加載 Analytics 組件
  // 等待主要內容渲染完成後，再加載 Analytics
  const scheduleAnalyticsLoad = () => {
    showAnalytics.value = true
    console.log('[Dashboard] Analytics component loaded (deferred)')
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
  console.log(' Stopping token refresh and activity tracking')
  stopTokenRefreshCheck()
  stopTracking()
})
</script>

<style scoped>
.dashboard {
  /* 移除 max-width 和 margin: 0 auto，讓內容占滿整個 page-content */
  /* 不再居中，消除兩側空白 */
  width: 100%;
  margin: 0;
  padding: clamp(1rem, 2vw, 2rem) 0;
  min-height: 100%;
  /* 確保內容可以完整顯示並滾動 */
}

.content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-8);
  margin-bottom: var(--space-12);
}

.analytics-section {
  margin-top: var(--space-12);
}

/* LCP 優化：Analytics 骨架屏樣式 */
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

/* 低解析度筆電特殊優化 (1080x720等) */
@media (min-width: 1025px) and (max-width: 1119px) {
  .dashboard {
    padding: 1rem 0;
  }

  .content-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
}

/* Responsive Design */
@media (max-width: 1024px) {
  .dashboard {
    padding: var(--space-4) 0;
  }

  .content-grid {
    grid-template-columns: 1fr;
    gap: var(--space-6);
  }
}

@media (max-width: 768px) {
  .dashboard {
    padding: var(--space-3) 0;
  }
}

@media (max-width: 320px) {
  .dashboard {
    padding: var(--space-2) 0;
  }
}

/* Reduced Motion Preference */
@media (prefers-reduced-motion: reduce) {
  .skeleton-card {
    animation: none !important;
    background: var(--gray-100);
  }
}
</style>
