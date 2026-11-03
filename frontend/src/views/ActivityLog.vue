<template>
  <AppLayout>
    <div class="ui-page rl-page activity-log ui-rise">
      <!-- Header -->
      <UiPageHead
        title="活動記錄"
        :subtitle="headSummary ? headSummary : ''"
      >
        <template #actions>
          <button
            class="btn btn-secondary"
            aria-label="匯出記錄"
            :disabled="loading"
            @click="exportActivities"
          >
            <DownloadIcon :size="16" />
            <span class="al-lbl">匯出記錄</span>
          </button>
          <button
            class="btn btn-secondary"
            aria-label="刷新"
            :disabled="loading"
            @click="refreshData"
          >
            <RefreshIcon
              :size="16"
              :spinning="loading"
            />
            <span class="al-lbl">刷新</span>
          </button>
        </template>
      </UiPageHead>

      <!-- Stats Cards (admin only) -->
      <ActivityStatsCards
        v-if="isAdmin"
        :overview="overview"
        :loading="overviewLoading"
      />

      <!-- Phone: the biggest operation types as one-tap filter chips, always visible -->
      <div
        v-if="showInsights && topActions.length > 0"
        class="al-chips"
        role="group"
        aria-label="依操作類型篩選"
      >
        <button
          v-for="a in topActions"
          :key="a.key"
          type="button"
          class="al-chip"
          :aria-pressed="filters.action === a.key"
          @click="onInsightAction(filters.action === a.key ? '' : a.key)"
        >
          {{ a.label }} <b>{{ a.count.toLocaleString('en-US') }}</b>
        </button>
      </div>

      <!-- Phone and tablet: the rail is a collapsed section above the log instead of being dropped -->
      <details
        v-if="showInsights"
        class="ui-card al-more"
      >
        <summary>操作類型與最活躍成員</summary>
        <ActivityInsights
          :overview="overview"
          :active-action="filters.action"
          :legend="false"
          @filter-action="onInsightAction"
        />
      </details>

      <div
        class="al-grid"
        :class="{ 'has-aside': showInsights }"
      >
        <div class="al-main">
          <!-- Filter Pills -->
          <ActivityFilterPills
            :filters="filters"
            :date-range="dateRange"
            :custom-date-range="customDateRange"
            :users="users"
            :summary="rangeSummary"
            @update:filters="onFiltersUpdate"
            @update:date-range="dateRange = $event"
            @update:custom-date-range="Object.assign(customDateRange, $event)"
            @clear="clearFilters"
            @apply="applyFilters"
          />

          <!-- Loading State -->
          <ActivityEmptyState
            v-if="loading"
            variant="loading"
          />

          <!-- Timeline -->
          <ActivityTimeline
            v-else-if="activities.length > 0"
            :activities="activities"
            @restored="onActivityRestored"
          />

          <!-- Empty State -->
          <ActivityEmptyState
            v-else
            variant="empty"
          />

          <!-- Pagination (only when we have activities) -->
          <ActivityPagination
            v-if="!loading && activities.length > 0"
            :current-page="currentPage"
            :total-pages="totalPages"
            :total-records="totalRecords"
            :loading="loading"
            class="activity-log__pagination"
            @page-change="loadPage"
          />
          <p
            v-if="isAdmin && activities.length > 0 && !loading"
            class="al-legend"
          >
            還原：仍在期限內，可一鍵復原。已過期：記錄保留但不能復原。不可還原：登入、傳送訊息等操作本質上無法復原。
          </p>
        </div>
        <ActivityInsights
          v-if="showInsights"
          class="al-aside"
          :overview="overview"
          :active-action="filters.action"
          :legend="true"
          @filter-action="onInsightAction"
        />
      </div>

      <!-- Error Toast -->
      <div
        v-if="error"
        class="activity-log__error"
      >
        {{ error }}
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import UiPageHead from '@/components/ui/UiPageHead.vue'
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ROLES } from '@/constants/roles'
import { apiClient } from '@/api'
import { activitiesApi } from '@/api/activities'
import type { ActivityLog, ActivityOverview } from '@/api/activities'
import { useWebSocketStore } from '@/stores/websocket'
import type { WebSocketMessage } from '@/services/websocketClient'

import AppLayout from '@/components/ui/AppLayout.vue'
import ActivityInsights from '@/components/activity/ActivityInsights.vue'
import ActivityStatsCards from '@/components/activity/ActivityStatsCards.vue'
import ActivityFilterPills from '@/components/activity/ActivityFilterPills.vue'
import ActivityTimeline from '@/components/activity/ActivityTimeline.vue'
import ActivityPagination from '@/components/activity/ActivityPagination.vue'
import ActivityEmptyState from '@/components/activity/ActivityEmptyState.vue'
import { getActionLabel } from '@/components/activity/utils'
import { DownloadIcon, RefreshIcon } from '@/components/icons'

interface User {
  id: string
  name: string
  role: string
}

const route = useRoute()
const authStore = useAuthStore()
const wsStore = useWebSocketStore()

// --- State ---
const activities = ref<ActivityLog[]>([])
const users = ref<User[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// Overview (admin only)
const overview = ref<ActivityOverview | null>(null)
const overviewLoading = ref(false)

// Filters
const filters = reactive({
  userId: '',
  action: '',
  resourceType: ''
})

const dateRange = ref('week')
const customDateRange = reactive({
  start: '',
  end: ''
})

// Pagination
const pagination = ref({
  page: 1,
  pageSize: 50,
  total: 0,
  totalPages: 0
})
const activitySubscriptionId = ref<string | null>(null)

// --- Computed ---
const isAdmin = computed(() => authStore.currentAgent?.role === ROLES.ADMIN)
const showInsights = computed(() => isAdmin.value && !!overview.value && (Object.keys(overview.value.actionStats).length > 0 || overview.value.topUsers.length > 0))
const topActions = computed(() =>
  Object.entries(overview.value?.actionStats ?? {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({ key, label: getActionLabel(key), count }))
)
const currentPage = computed(() => pagination.value?.page || 1)

/** Page header sentence from loaded data only (overview for admins, list total otherwise). */
const headSummary = computed(() => {
  if (isAdmin.value && overview.value) {
    // the week card under the head already states the period total
    return '誰在什麼時間做了什麼；點開一列可看詳情。'
  }
  if (!loading.value && pagination.value.total > 0) {
    return `目前篩選條件下共 ${pagination.value.total.toLocaleString('zh-TW')} 筆記錄。`
  }
  return ''
})

/** "顯示 1–50 / 1,284 筆" */
const rangeSummary = computed(() => {
  const total = pagination.value.total
  if (loading.value || total === 0 || activities.value.length === 0) { return '' }
  const from = (pagination.value.page - 1) * pagination.value.pageSize + 1
  const to = from + activities.value.length - 1
  return `顯示 ${from}–${to} / ${total.toLocaleString('zh-TW')} 筆`
})
const totalPages = computed(() => pagination.value?.totalPages || 0)
const totalRecords = computed(() => pagination.value?.total || 0)

// --- Helpers ---
const getDateFilters = (): { startDate: string; endDate: string } => {
  const now = new Date()
  let startDate = ''
  let endDate = ''

  switch (dateRange.value) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      break
    case 'week': {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      startDate = weekAgo.toISOString()
      break
    }
    case 'month': {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      startDate = monthAgo.toISOString()
      break
    }
    case 'custom':
      if (customDateRange.start) {
        startDate = new Date(customDateRange.start).toISOString()
      }
      if (customDateRange.end) {
        endDate = new Date(customDateRange.end).toISOString()
      }
      break
  }

  return { startDate, endDate }
}

const getDaysFromDateRange = (): number => {
  switch (dateRange.value) {
    case 'today': return 1
    case 'week': return 7
    case 'month': return 30
    case 'custom': {
      if (customDateRange.start && customDateRange.end) {
        const start = new Date(customDateRange.start).getTime()
        const end = new Date(customDateRange.end).getTime()
        return Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)))
      }
      return 7
    }
    default: return 7
  }
}

// --- Data Loading ---
const loadActivities = async (page = 1) => {
  loading.value = true
  error.value = null

  try {
    const dateFilters = getDateFilters()
    const result = await activitiesApi.list({
      page,
      pageSize: pagination.value.pageSize,
      userId: filters.userId || undefined,
      action: filters.action || undefined,
      resourceType: filters.resourceType || undefined,
      startDate: dateFilters.startDate || undefined,
      endDate: dateFilters.endDate || undefined
    })

    if (result.success && result.data) {
      // API returns { data: { items, page, pageSize, total, totalPages, ... } }
      const responseData = result.data as unknown as {
        items: ActivityLog[]
        page: number
        pageSize: number
        total: number
        totalPages: number
      }
      activities.value = responseData.items || []
      pagination.value = {
        page: responseData.page || 1,
        pageSize: responseData.pageSize || 50,
        total: responseData.total || 0,
        totalPages: responseData.totalPages || 0
      }
    } else {
      throw new Error(result.error || 'Failed to load activities')
    }
  } catch (err) {
    console.error('Failed to load activities:', err)
    error.value = err instanceof Error ? err.message : 'Failed to load activities'
    activities.value = []
    pagination.value = { page: 1, pageSize: 50, total: 0, totalPages: 0 }
  } finally {
    loading.value = false
  }
}

const loadUsers = async () => {
  if (!isAdmin.value) { return }

  try {
    const data = await apiClient.get<Array<{ id: string; name: string; role: string }>>('/teams/members')
    if (data.success && data.data) {
      users.value = (data.data as unknown as Array<{ id: string; name: string; role: string }>).map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role
      }))
    }
  } catch (err) {
    console.error('Failed to load users:', err)
  }
}

const loadOverview = async () => {
  if (!isAdmin.value) {return}
  overviewLoading.value = true
  try {
    const days = getDaysFromDateRange()
    const data = await activitiesApi.getOverview(days)
    if (data.success && data.data) {
      overview.value = data.data as unknown as ActivityOverview
    }
  } catch (err) {
    console.error('Failed to load overview:', err)
    overview.value = null
  } finally {
    overviewLoading.value = false
  }
}

// --- Actions ---
const onFiltersUpdate = (updated: typeof filters) => {
  Object.assign(filters, updated)
}

const onInsightAction = (action: string) => {
  filters.action = action
  applyFilters()
}

const applyFilters = () => {
  pagination.value.page = 1
  loadActivities(1)
  loadOverview()
}

const clearFilters = () => {
  filters.userId = ''
  filters.action = ''
  filters.resourceType = ''
  dateRange.value = 'week'
  customDateRange.start = ''
  customDateRange.end = ''
  applyFilters()
}

const loadPage = (page: number) => {
  loadActivities(page)
}

const onActivityRestored = async (_restoredId: number) => {
  await loadActivities(pagination.value.page)
}

const onActivitySocketMessage = (message: WebSocketMessage) => {
  if (message.type === 'resource.restored') {
    loadActivities(pagination.value.page)
  }
}

const exportActivities = async () => {
  try {
    loading.value = true
    const dateFilters = getDateFilters()
    const result = await activitiesApi.export({
      userId: filters.userId || undefined,
      action: filters.action || undefined,
      resourceType: filters.resourceType || undefined,
      startDate: dateFilters.startDate || undefined,
      endDate: dateFilters.endDate || undefined
    })

    if (result.success && result.data) {
      const url = window.URL.createObjectURL(result.data)
      const link = document.createElement('a')
      link.href = url
      const now = new Date()
      link.download = `activity-log-${now.toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    }
  } catch (err) {
    console.error('Export failed:', err)
    error.value = err instanceof Error ? err.message : 'Export failed'
  } finally {
    loading.value = false
  }
}

const refreshData = async () => {
  await Promise.all([
    loadActivities(1),
    loadUsers(),
    loadOverview()
  ])
}

// --- Route watcher ---
watch(() => route.path, (newPath) => {
  if (newPath === '/activities') {
    refreshData()
  }
}, { immediate: false })

// --- Lifecycle ---
onMounted(() => {
  loadActivities()
  loadUsers()
  loadOverview()
  activitySubscriptionId.value = wsStore.subscribe('activity', onActivitySocketMessage)
})

onUnmounted(() => {
  if (activitySubscriptionId.value) {
    wsStore.unsubscribe(activitySubscriptionId.value)
  }
})
</script>

<style scoped>

.activity-log__error {
  padding: 14px 16px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-red-soft);
  font-size: 14px;
  color: var(--ui-red-ink);
}

/* The log beside a rail of what the period was made of; the rail sits level with the filters */
.al-grid {
  display: grid;
  gap: 20px;
  align-items: start;
  min-width: 0;
}

.al-grid.has-aside {
  grid-template-columns: minmax(0, 1fr) 300px;
}

.al-main {
  display: grid;
  gap: 20px;
  min-width: 0;
}

.al-legend {
  margin: 0;
  padding: 0 6px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--ui-muted);
}

.al-grid.has-aside .al-legend {
  display: none;
}

.al-aside {
  position: sticky;
  top: 20px;
}

.al-more {
  display: none;
  padding: 0;
}
.al-chips {
  display: none;
}
.al-more summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 0 20px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  list-style: none;
}
.al-more summary::-webkit-details-marker {
  display: none;
}
.al-more summary::after {
  width: 8px;
  height: 8px;
  margin-right: 4px;
  border-right: 2px solid var(--ui-muted);
  border-bottom: 2px solid var(--ui-muted);
  transform: rotate(45deg);
  content: '';
  transition: transform var(--ui-dur) var(--ui-ease);
}
.al-more[open] summary::after {
  transform: rotate(-135deg);
}
@media (max-width: 1024px) {
  .al-grid.has-aside {
    grid-template-columns: minmax(0, 1fr);
  }

  .al-aside {
    display: none;
  }

  .al-grid.has-aside .al-legend {
    display: block;
  }

  .al-more {
    display: block;
  }

  .al-chips {
    display: flex;
    gap: 8px;
    margin: 0 -4px;
    padding: 0 4px 2px;
    flex-wrap: wrap;
  }

  .al-chip {
    flex: none;
    min-height: 44px;
    padding: 0 16px;
    border: 0;
    border-radius: 999px;
    background: var(--ui-surface);
    box-shadow: var(--ui-shadow-pill);
    font: 500 14px var(--ui-font-ui);
    color: var(--ui-ink);
    cursor: pointer;
  }

  .al-chip b {
    margin-left: 4px;
    font-variant-numeric: tabular-nums;
  }

  .al-chip[aria-pressed='true'] {
    background: var(--section-hue-soft, var(--ui-accent-soft));
    font-weight: 600;
    box-shadow: inset 0 0 0 1.5px var(--section-ink, var(--ui-accent));
  }
}

.al-more :deep(.insights) {
  padding: 0 12px 12px;
}
.al-more :deep(.ins-list) {
  box-shadow: none;
  background: var(--ui-fill);
}

@media (max-width: 768px) {
  /* the two header actions are icon buttons; the label stays for assistive tech */
  .ui-page-actions {
    justify-content: flex-end;
  }
  .ui-page-actions > .btn {
    flex: none;
    min-height: 44px;
  }
}
</style>
