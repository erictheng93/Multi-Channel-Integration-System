<template>
  <Modal
    :show="show"
    size="lg"
    :show-header="false"
    :no-padding="true"
    @close="$emit('close')"
  >
    <!-- Custom Header with Tag Info -->
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

        <TagStatsOverview
          v-else-if="stats"
          :stats="stats"
          :enable-conversation-tags="ENABLE_CONVERSATION_TAGS"
        />
      </div>

      <!-- Customers Tab -->
      <div
        v-if="activeTab === 'customers'"
        class="tab-content"
      >
        <TagStatsCustomerList
          :loading="loadingCustomers"
          :error="customersError"
          :customers="customers"
          :pagination="pagination"
          @page-change="loadCustomers"
        />
      </div>
    </div>

    <!-- Footer Actions -->
    <template #footer>
      <button
        class="btn btn-secondary"
        @click="$emit('close')"
      >
        關閉
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import { getTagUsageStats, getTagCustomers, type Tag, type TagUsageStats, type TagCustomer } from '@/api/tags'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import TagStatsOverview from '@/components/customer/TagStatsOverview.vue'
import TagStatsCustomerList from '@/components/customer/TagStatsCustomerList.vue'

const props = defineProps<Props>()

defineEmits<{
  close: []
}>()

// Feature flag: conversation tags toggle
// Conversation tags enabled
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
/* Custom Header with Tag Color */

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--space-6) var(--space-6) var(--space-4);
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

@media (max-width: 640px) {
  .modal-content {
    max-height: 100vh;
    border-radius: 0;
  }
}
</style>
