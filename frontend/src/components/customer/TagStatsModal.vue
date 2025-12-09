<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="modal-overlay"
      @click="$emit('close')"
    >
      <div
        class="modal-content"
        @click.stop
      >
        <!-- Header -->
        <div class="modal-header">
          <div class="modal-title-section">
            <div
              class="tag-color-indicator"
              :style="{ backgroundColor: tag.color }"
            />
            <div>
              <h2 class="modal-title">
                {{ tag.name }}
              </h2>
              <p class="modal-subtitle">
                標籤使用統計
              </p>
            </div>
          </div>
          <button
            class="modal-close-btn"
            @click="$emit('close')"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <!-- Tabs -->
        <div class="tabs-header">
          <button
            class="tab-button"
            :class="{ active: activeTab === 'stats' }"
            @click="activeTab = 'stats'"
          >
            <svg
              class="tab-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            統計數據
          </button>
          <button
            class="tab-button"
            :class="{ active: activeTab === 'customers' }"
            @click="switchToCustomersTab"
          >
            <svg
              class="tab-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            客戶列表
            <span
              v-if="stats"
              class="tab-badge"
            >{{ stats.customers.total }}</span>
          </button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <!-- Stats Tab -->
          <div
            v-if="activeTab === 'stats'"
            class="tab-content"
          >
            <HamsterLoader
              v-if="loading"
              message="載入統計數據中..."
            />

            <div
              v-else-if="error"
              class="error-state"
            >
              <svg
                class="error-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p class="error-message">
                {{ error }}
              </p>
            </div>

            <div v-else-if="stats">
              <!-- Stats Overview -->
              <div
                class="stats-grid"
                :class="{ 'single-column': !ENABLE_CONVERSATION_TAGS }"
              >
                <!-- 已標記客戶卡片 -->
                <div class="stat-card">
                  <div class="stat-icon customers">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                  <div class="stat-content">
                    <div class="stat-value">
                      {{ stats.customers.total }}
                    </div>
                    <div class="stat-label">
                      已標記客戶
                    </div>
                  </div>
                </div>

                <!-- 已標記對話卡片 (暫時隱藏，保留未來擴展) -->
                <div
                  v-if="ENABLE_CONVERSATION_TAGS"
                  class="stat-card"
                >
                  <div class="stat-icon conversations">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                  </div>
                  <div class="stat-content">
                    <div class="stat-value">
                      {{ stats.conversations.total }}
                    </div>
                    <div class="stat-label">
                      已標記對話
                    </div>
                  </div>
                </div>
              </div>

              <!-- Platform Distribution -->
              <div
                v-if="stats.customers.total > 0"
                class="section"
              >
                <h3 class="section-title">
                  客戶平台分布
                </h3>
                <div class="platform-stats">
                  <div class="platform-item">
                    <div class="platform-info">
                      <svg
                        class="platform-icon line"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.771.039 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                      </svg>
                      <span class="platform-name">LINE OA</span>
                    </div>
                    <div class="platform-count">
                      {{ stats.customers.byPlatform.line }} 位
                      <span class="platform-percentage">({{ calculatePercentage(stats.customers.byPlatform.line, stats.customers.total) }}%)</span>
                    </div>
                  </div>
                  <div class="platform-item">
                    <div class="platform-info">
                      <svg
                        class="platform-icon facebook"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                      <span class="platform-name">Facebook</span>
                    </div>
                    <div class="platform-count">
                      {{ stats.customers.byPlatform.facebook }} 位
                      <span class="platform-percentage">({{ calculatePercentage(stats.customers.byPlatform.facebook, stats.customers.total) }}%)</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Conversation Status (暫時隱藏，保留未來擴展) -->
              <div
                v-if="ENABLE_CONVERSATION_TAGS && stats.conversations.total > 0"
                class="section"
              >
                <h3 class="section-title">
                  對話狀態分布
                </h3>
                <div class="conversation-stats">
                  <div class="conversation-item active">
                    <div class="conversation-label">
                      進行中
                    </div>
                    <div class="conversation-count">
                      {{ stats.conversations.active }} 則
                    </div>
                  </div>
                  <div class="conversation-item closed">
                    <div class="conversation-label">
                      已關閉
                    </div>
                    <div class="conversation-count">
                      {{ stats.conversations.closed }} 則
                    </div>
                  </div>
                </div>
              </div>

              <!-- Usage Trend (Last 30 Days) -->
              <div
                v-if="stats.usageTrend && stats.usageTrend.length > 0"
                class="section"
              >
                <h3 class="section-title">
                  使用趨勢（最近30天）
                </h3>
                <div class="usage-trend">
                  <div
                    v-for="trend in stats.usageTrend.slice(0, 7)"
                    :key="trend.date"
                    class="trend-item"
                  >
                    <div class="trend-date">
                      {{ formatTrendDate(trend.date) }}
                    </div>
                    <div class="trend-bar-container">
                      <div
                        class="trend-bar"
                        :style="{
                          width: calculateBarWidth(trend.assignments, stats.usageTrend) + '%'
                        }"
                      />
                    </div>
                    <div class="trend-count">
                      {{ trend.assignments }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Top Assigners -->
              <div
                v-if="stats.topAssigners && stats.topAssigners.length > 0"
                class="section"
              >
                <h3 class="section-title">
                  最活躍使用者（最近30天）
                </h3>
                <div class="assigners-list">
                  <div
                    v-for="(assigner, index) in stats.topAssigners.slice(0, 5)"
                    :key="index"
                    class="assigner-item"
                  >
                    <div class="assigner-rank">
                      #{{ index + 1 }}
                    </div>
                    <div class="assigner-info">
                      <div class="assigner-name">
                        {{ assigner.name }}
                      </div>
                      <div class="assigner-count">
                        標記了 {{ assigner.assignments }} 次
                      </div>
                    </div>
                    <div class="assigner-badge">
                      <svg
                        v-if="index === 0"
                        class="badge-icon gold"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                      </svg>
                      <svg
                        v-else-if="index === 1"
                        class="badge-icon silver"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                      </svg>
                      <svg
                        v-else-if="index === 2"
                        class="badge-icon bronze"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div
                v-if="stats.customers.total === 0 && stats.conversations.total === 0"
                class="empty-stats"
              >
                <svg
                  class="empty-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <p class="empty-message">
                  此標籤尚未被使用
                </p>
                <p class="empty-description">
                  開始為客戶或對話添加此標籤來追蹤使用情況
                </p>
              </div>
            </div>
          </div>

          <!-- Customers Tab -->
          <div
            v-if="activeTab === 'customers'"
            class="tab-content"
          >
            <HamsterLoader
              v-if="loadingCustomers"
              message="載入客戶列表中..."
            />

            <div
              v-else-if="customersError"
              class="error-state"
            >
              <svg
                class="error-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p class="error-message">
                {{ customersError }}
              </p>
            </div>

            <div
              v-else-if="customers.length === 0"
              class="empty-stats"
            >
              <svg
                class="empty-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <p class="empty-message">
                尚無客戶使用此標籤
              </p>
              <p class="empty-description">
                為客戶添加此標籤後，列表將會顯示在這裡
              </p>
            </div>

            <div
              v-else
              class="customers-list"
            >
              <div
                v-for="customer in customers"
                :key="customer.id"
                class="customer-row"
              >
                <div class="customer-avatar">
                  <img
                    v-if="customer.avatar_url"
                    :src="customer.avatar_url"
                    :alt="customer.display_name"
                  >
                  <div
                    v-else
                    class="avatar-placeholder"
                  >
                    {{ customer.display_name.charAt(0).toUpperCase() }}
                  </div>
                </div>
                <div class="customer-info">
                  <div class="customer-name">
                    {{ customer.display_name }}
                  </div>
                  <div class="customer-meta">
                    <span
                      class="platform-badge"
                      :class="customer.platform"
                    >
                      {{ customer.platform === 'line' ? 'LINE' : 'Facebook' }}
                    </span>
                    <span class="meta-separator">•</span>
                    <span class="assigned-date">
                      標記於 {{ formatDate(customer.assigned_at) }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Pagination -->
              <div
                v-if="pagination && pagination.totalPages > 1"
                class="pagination"
              >
                <button
                  class="pagination-btn"
                  :disabled="pagination.page === 1"
                  @click="loadCustomers(pagination.page - 1)"
                >
                  上一頁
                </button>
                <span class="pagination-info">
                  第 {{ pagination.page }} / {{ pagination.totalPages }} 頁
                </span>
                <button
                  class="pagination-btn"
                  :disabled="pagination.page === pagination.totalPages"
                  @click="loadCustomers(pagination.page + 1)"
                >
                  下一頁
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button
            class="btn btn-secondary"
            @click="$emit('close')"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { getTagUsageStats, getTagCustomers, type Tag, type TagUsageStats, type TagCustomer } from '@/api/tags'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'

const props = defineProps<Props>()

defineEmits<{
  close: []
}>()

// Feature flag: 對話標籤功能開關
// 已啟用對話標籤功能
const ENABLE_CONVERSATION_TAGS = true

interface Props {
  show: boolean
  tag: Tag
}

const activeTab = ref<'stats' | 'customers'>('stats')
const loading = ref(false)
const error = ref<string | null>(null)
const stats = ref<TagUsageStats | null>(null)

const loadingCustomers = ref(false)
const customersError = ref<string | null>(null)
const customers = ref<TagCustomer[]>([])
const pagination = ref<{
  page: number
  limit: number
  total: number
  totalPages: number
} | null>(null)

const loadStats = async () => {
  if (!props.show || !props.tag.id) {return}

  loading.value = true
  error.value = null
  stats.value = null

  try {
    const response = await getTagUsageStats(props.tag.id)
    if (response.success && response.data) {
      stats.value = response.data
    } else {
      error.value = '無法載入統計數據'
    }
  } catch (err) {
    console.error('Failed to load tag stats:', err)
    error.value = '載入統計數據時發生錯誤，請稍後再試'
  } finally {
    loading.value = false
  }
}

const loadCustomers = async (page = 1) => {
  if (!props.tag.id) {return}

  loadingCustomers.value = true
  customersError.value = null

  try {
    const response = await getTagCustomers(props.tag.id, { page, limit: 20 })
    if (response.success && response.data) {
      customers.value = response.data.customers
      pagination.value = response.data.pagination
    } else {
      customersError.value = '無法載入客戶列表'
    }
  } catch (err) {
    console.error('Failed to load tag customers:', err)
    customersError.value = '載入客戶列表時發生錯誤，請稍後再試'
  } finally {
    loadingCustomers.value = false
  }
}

const switchToCustomersTab = () => {
  activeTab.value = 'customers'
  if (customers.value.length === 0 && !customersError.value) {
    loadCustomers()
  }
}

const calculatePercentage = (value: number, total: number): string => {
  if (total === 0) {return '0'}
  return ((value / total) * 100).toFixed(1)
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

const formatTrendDate = (dateString: string): string => {
  const date = new Date(dateString)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return '今天'
  } else if (date.toDateString() === yesterday.toDateString()) {
    return '昨天'
  } else {
    return date.toLocaleDateString('zh-TW', {
      month: 'numeric',
      day: 'numeric'
    })
  }
}

const calculateBarWidth = (value: number, trendData: Array<{ date: string; assignments: number }>): number => {
  if (!trendData || trendData.length === 0) {return 0}
  const maxValue = Math.max(...trendData.map(t => t.assignments))
  if (maxValue === 0) {return 0}
  return Math.max((value / maxValue) * 100, 5) // Minimum 5% for visibility
}

watch(() => props.show, (newValue) => {
  if (newValue) {
    activeTab.value = 'stats'
    loadStats()
    customers.value = []
    pagination.value = null
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 2000;
  padding: var(--space-4);
}

.modal-content {
  width: 100%;
  max-width: 700px;
  max-height: 90vh;
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--space-6);
  border-bottom: 1px solid var(--gray-100);
}

.modal-title-section {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  flex: 1;
}

.tag-color-indicator {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--gray-900);
  letter-spacing: -0.025em;
}

.modal-subtitle {
  margin: var(--space-1) 0 0 0;
  font-size: 0.875rem;
  color: var(--gray-600);
}

.modal-close-btn {
  padding: var(--space-2);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--gray-400);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.modal-close-btn:hover {
  background: var(--gray-100);
  color: var(--gray-700);
}

.modal-close-btn svg {
  width: 20px;
  height: 20px;
  display: block;
}

.tabs-header {
  display: flex;
  border-bottom: 1px solid var(--gray-200);
  padding: 0 var(--space-6);
}

.tab-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-4);
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--gray-600);
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
}

.tab-button:hover {
  color: var(--gray-900);
  background: var(--gray-50);
}

.tab-button.active {
  color: var(--primary-600);
  border-bottom-color: var(--primary-600);
}

.tab-icon {
  width: 18px;
  height: 18px;
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 var(--space-2);
  background: var(--primary-100);
  color: var(--primary-700);
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: var(--radius-full);
}

.tab-button.active .tab-badge {
  background: var(--primary-600);
  color: white;
}

.modal-body {
  padding: var(--space-6);
  flex: 1;
  overflow-y: auto;
}

.tab-content {
  animation: fadeIn 0.2s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.stats-grid.single-column {
  grid-template-columns: 1fr;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--gray-50);
  border-radius: var(--radius-xl);
  border: 1px solid var(--gray-200);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon.customers {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
}

.stat-icon.conversations {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
}

.stat-icon svg {
  width: 24px;
  height: 24px;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--gray-900);
  line-height: 1;
  margin-bottom: var(--space-1);
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--gray-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section {
  margin-bottom: var(--space-6);
}

.section-title {
  margin: 0 0 var(--space-3) 0;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--gray-900);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.platform-stats,
.conversation-stats {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.platform-item,
.conversation-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
}

.platform-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.platform-icon {
  width: 20px;
  height: 20px;
}

.platform-icon.line {
  color: #06C755;
}

.platform-icon.facebook {
  color: #1877F2;
}

.platform-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--gray-700);
}

.platform-count {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--gray-900);
}

.platform-percentage {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--gray-500);
  margin-left: var(--space-1);
}

.conversation-item.active {
  border-left: 3px solid #10b981;
}

.conversation-item.closed {
  border-left: 3px solid var(--gray-400);
}

.conversation-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--gray-700);
}

.conversation-count {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--gray-900);
}

.empty-stats {
  text-align: center;
  padding: var(--space-12) var(--space-6);
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto var(--space-4);
  color: var(--gray-300);
}

.empty-message {
  margin: 0 0 var(--space-2) 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-700);
}

.empty-description {
  margin: 0;
  font-size: 0.875rem;
  color: var(--gray-500);
}

.error-state {
  text-align: center;
  padding: var(--space-12) var(--space-6);
}

.error-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto var(--space-4);
  color: var(--danger-500);
}

.error-message {
  margin: 0;
  font-size: 0.875rem;
  color: var(--gray-700);
}

.customers-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.customer-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.customer-row:hover {
  border-color: var(--gray-300);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.customer-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--gray-100);
}

.customer-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  font-weight: 700;
  font-size: 1.25rem;
}

.customer-info {
  flex: 1;
  min-width: 0;
}

.customer-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: var(--space-1);
}

.customer-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.8125rem;
  color: var(--gray-600);
}

.platform-badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 600;
}

.platform-badge.line {
  background: #06C755;
  color: white;
}

.platform-badge.facebook {
  background: #1877F2;
  color: white;
}

.meta-separator {
  color: var(--gray-400);
}

.assigned-date {
  color: var(--gray-500);
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-4);
  margin-top: var(--space-4);
}

.pagination-btn {
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-lg);
  background: white;
  color: var(--gray-700);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.pagination-btn:hover:not(:disabled) {
  background: var(--gray-50);
  border-color: var(--gray-400);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-info {
  font-size: 0.875rem;
  color: var(--gray-600);
  font-weight: 500;
}

.modal-footer {
  padding: var(--space-6);
  border-top: 1px solid var(--gray-100);
  display: flex;
  justify-content: flex-end;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  border: none;
  border-radius: var(--radius-lg);
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-secondary {
  background: var(--gray-100);
  color: var(--gray-700);
  border: 1px solid var(--gray-200);
}

.btn-secondary:hover {
  background: var(--gray-200);
  color: var(--gray-900);
}

/* Usage Trend Styles */
.usage-trend {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.trend-item {
  display: grid;
  grid-template-columns: 80px 1fr 50px;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.trend-item:hover {
  border-color: var(--primary-300);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

.trend-date {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--gray-700);
}

.trend-bar-container {
  height: 24px;
  background: var(--gray-100);
  border-radius: var(--radius-md);
  overflow: hidden;
  position: relative;
}

.trend-bar {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #2563eb);
  border-radius: var(--radius-md);
  transition: width var(--transition-normal);
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.3);
}

.trend-count {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--gray-900);
  text-align: right;
}

/* Top Assigners Styles */
.assigners-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.assigner-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.assigner-item:hover {
  border-color: var(--gray-300);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transform: translateX(4px);
}

.assigner-rank {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gray-100);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--gray-700);
  flex-shrink: 0;
}

.assigner-item:first-child .assigner-rank {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: white;
}

.assigner-item:nth-child(2) .assigner-rank {
  background: linear-gradient(135deg, #d1d5db, #9ca3af);
  color: white;
}

.assigner-item:nth-child(3) .assigner-rank {
  background: linear-gradient(135deg, #d97706, #b45309);
  color: white;
}

.assigner-info {
  flex: 1;
  min-width: 0;
}

.assigner-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: var(--space-1);
}

.assigner-count {
  font-size: 0.8125rem;
  color: var(--gray-600);
}

.assigner-badge {
  flex-shrink: 0;
}

.badge-icon {
  width: 24px;
  height: 24px;
}

.badge-icon.gold {
  color: #fbbf24;
  filter: drop-shadow(0 2px 4px rgba(251, 191, 36, 0.5));
}

.badge-icon.silver {
  color: #9ca3af;
  filter: drop-shadow(0 2px 4px rgba(156, 163, 175, 0.5));
}

.badge-icon.bronze {
  color: #d97706;
  filter: drop-shadow(0 2px 4px rgba(217, 119, 6, 0.5));
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .modal-content {
    max-height: 100vh;
    border-radius: 0;
  }

  .trend-item {
    grid-template-columns: 60px 1fr 40px;
    gap: var(--space-2);
  }

  .trend-date {
    font-size: 0.75rem;
  }

  .assigner-rank {
    width: 32px;
    height: 32px;
    font-size: 0.75rem;
  }

  .assigner-name {
    font-size: 0.875rem;
  }

  .assigner-count {
    font-size: 0.75rem;
  }
}
</style>
