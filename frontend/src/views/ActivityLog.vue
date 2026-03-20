<template>
  <AppLayout>
    <div class="activity-log">
      <!-- Header -->
      <div class="activity-log__header">
        <div>
          <h1 class="activity-log__title">
            活動記錄
          </h1>
          <p class="activity-log__subtitle">
            查看系統操作記錄和用戶活動
          </p>
        </div>
        <div class="activity-log__actions">
          <button
            class="activity-log__action-btn"
            :disabled="loading"
            @click="exportActivities"
          >
            <DownloadIcon :size="16" />
            <span>匯出記錄</span>
          </button>
          <button
            class="activity-log__action-btn"
            :disabled="loading"
            @click="refreshData"
          >
            <RefreshIcon
              :size="16"
              :spinning="loading"
            />
            <span>刷新</span>
          </button>
        </div>
      </div>

      <!-- Stats Cards (admin only) -->
      <ActivityStatsCards
        v-if="isAdmin"
        :overview="overview"
        :loading="overviewLoading"
      />

      <!-- Filter Pills -->
      <ActivityFilterPills
        :filters="filters"
        :date-range="dateRange"
        :custom-date-range="customDateRange"
        :users="users"
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
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ROLES } from '@/constants/roles'
import { apiClient } from '@/api'
import { activitiesApi } from '@/api/activities'
import type { ActivityLog, ActivityOverview } from '@/api/activities'

import AppLayout from '@/components/ui/AppLayout.vue'
import ActivityStatsCards from '@/components/activity/ActivityStatsCards.vue'
import ActivityFilterPills from '@/components/activity/ActivityFilterPills.vue'
import ActivityTimeline from '@/components/activity/ActivityTimeline.vue'
import ActivityPagination from '@/components/activity/ActivityPagination.vue'
import ActivityEmptyState from '@/components/activity/ActivityEmptyState.vue'
import { DownloadIcon, RefreshIcon } from '@/components/icons'

interface User {
  id: string
  name: string
  role: string
}

const route = useRoute()
const authStore = useAuthStore()

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

// --- Computed ---
const isAdmin = computed(() => authStore.currentAgent?.role === ROLES.ADMIN)
const currentPage = computed(() => pagination.value?.page || 1)
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
})
</script>

<style scoped>
.activity-log {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
}

.activity-log__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 28px;
}

.activity-log__title {
  font-size: 28px;
  font-weight: 700;
  color: #1C1C1E;
  letter-spacing: -0.02em;
}

.activity-log__subtitle {
  font-size: 14px;
  color: #8E8E93;
  margin-top: 4px;
}

.activity-log__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.activity-log__action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #FFFFFF;
  color: #1C1C1E;
  border: none;
  border-radius: 9999px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.06);
  transition: background-color 200ms ease-out, box-shadow 200ms ease-out;
}

.activity-log__action-btn:hover:not(:disabled) {
  background: #F2F2F7;
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.1);
}

.activity-log__action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.activity-log__pagination {
  margin-top: 0;
}

.activity-log__error {
  background: #FFF2F2;
  color: #FF3B30;
  padding: 16px;
  border-radius: 12px;
  margin-top: 16px;
  font-size: 14px;
}

/* Responsive */
@media (max-width: 640px) {
  .activity-log {
    padding: 20px 16px;
  }

  .activity-log__header {
    flex-direction: column;
    gap: 16px;
  }

  .activity-log__title {
    font-size: 22px;
  }

  .activity-log__actions {
    align-self: stretch;
    justify-content: flex-end;
  }
}
</style>
