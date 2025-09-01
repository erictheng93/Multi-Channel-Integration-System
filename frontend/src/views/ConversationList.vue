<template>
  <AppLayout>
    <div class="conversation-list">
      <!-- Header with Filters -->
      <div class="list-header">
        <div class="header-content">
          <div class="header-info">
            <h1 class="page-title">
              對話管理
            </h1>
            <p class="page-subtitle">
              管理所有客戶對話，快速回應客戶需求
            </p>
          </div>
          
          <div class="header-actions">
            <!-- 混合同步狀態指示器 -->
            <div v-if="syncStatus !== 'disconnected'" class="sync-status-indicator" :class="`status-${syncStatus}`">
              <div class="sync-dot" :class="{ 'syncing': isAutoRefreshing }"></div>
              <span class="sync-text">
                <template v-if="syncStatus === 'connected'">SSE連線</template>
                <template v-else-if="syncStatus === 'polling'">輪詢模式</template>
                <template v-else-if="syncStatus === 'connecting'">連線中</template>
                <template v-else-if="isAutoRefreshing">更新中</template>
                <template v-else>{{ syncStatus }}</template>
              </span>
            </div>
            
            <button
              class="btn btn-secondary"
              :disabled="loading"
              @click="refreshConversations"
            >
              <RefreshIcon :spinning="loading || isAutoRefreshing" />
              重新整理
            </button>
          </div>
        </div>

        <!-- Filters -->
        <div class="filters-section">
          <div class="filters">
            <div class="filter-group">
              <label class="filter-label">狀態篩選</label>
              <select
                v-model="filters.status"
                class="form-select"
                @change="loadConversations"
              >
                <option value="">
                  所有狀態
                </option>
                <option value="open">
                  待處理
                </option>
                <option value="assigned">
                  已指派
                </option>
                <option value="closed">
                  已關閉
                </option>
              </select>
            </div>
            
            <div class="filter-group">
              <label class="filter-label">平台篩選</label>
              <select
                v-model="filters.platform"
                class="form-select"
                @change="loadConversations"
              >
                <option value="">
                  所有平台
                </option>
                <option value="line">
                  LINE
                </option>
                <option value="facebook">
                  Facebook
                </option>
                <option value="instagram">
                  Instagram
                </option>
                <option value="whatsapp">
                  WhatsApp
                </option>
              </select>
            </div>
            
            <div class="filter-group">
              <label class="filter-label">指派狀態</label>
              <select
                v-model="filters.assignedTo"
                class="form-select"
                @change="loadConversations"
              >
                <option value="">
                  全部
                </option>
                <option value="me">
                  指派給我
                </option>
                <option value="unassigned">
                  未指派
                </option>
              </select>
            </div>
          </div>
          
          <!-- Stats -->
          <div class="quick-stats">
            <div class="stat-item">
              <span class="stat-number">{{ totalConversations }}</span>
              <span class="stat-label">總對話</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ unreadCount }}</span>
              <span class="stat-label">未讀</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="list-content">
        <LoadingSpinner
          v-if="loading"
          size="lg"
          text="載入對話中..."
        />
        
        <EmptyState 
          v-else-if="conversations.length === 0"
          title="沒有找到對話"
          description="目前沒有符合篩選條件的對話，請調整篩選條件或等待新對話"
        >
          <template #icon>
            <ChatIcon />
          </template>
          <template #actions>
            <button
              class="btn btn-primary"
              @click="clearFilters"
            >
              清除篩選
            </button>
            <button
              class="btn btn-secondary"
              @click="refreshConversations"
            >
              重新整理
            </button>
          </template>
        </EmptyState>
        
        <div
          v-else
          class="conversations-container"
        >
          <div class="conversations-grid">
            <ConversationCard
              v-for="conversation in conversations"
              :key="conversation.id"
              :conversation="conversation"
              :selected="selectedConversationId === conversation.id"
              @select="selectConversation"
            />
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="pagination"
      >
        <button 
          :disabled="currentPage === 1"
          class="btn btn-secondary"
          @click="changePage(currentPage - 1)"
        >
          <ChevronLeftIcon />
          上一頁
        </button>
        
        <div class="page-info">
          <span class="page-text">第 {{ currentPage }} / {{ totalPages }} 頁</span>
          <span class="total-text">共 {{ totalConversations }} 個對話</span>
        </div>
        
        <button 
          :disabled="currentPage === totalPages"
          class="btn btn-secondary"
          @click="changePage(currentPage + 1)"
        >
          下一頁
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth, useConversations } from '@/composables'
import type { Conversation, ConversationFilters } from '@/types'
import { useConversationsStore } from '@/stores/conversations'
import { conversationSync } from '@/services/conversationSync'
import AppLayout from '@/components/ui/AppLayout.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConversationCard from '@/components/conversation/ConversationCard.vue'

import { RefreshIcon, ChatIcon } from '@/components/icons'

// Chevron icons (small, can stay inline)
const ChevronLeftIcon = {
  template: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>`
}

const ChevronRightIcon = {
  template: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>`
}

const router = useRouter()
const { currentAgent } = useAuth()
const { conversations, loading } = useConversations()
const conversationsStore = useConversationsStore()

// State
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const selectedConversationId = ref<string | null>(null)
const filters = ref<ConversationFilters>({
  status: '', // 設定為空字串以顯示「所有狀態」
  platform: '', // 設定為空字串以顯示「所有平台」
  assignedTo: undefined
})

// Computed
const totalPages = computed(() => Math.ceil(total.value / pageSize.value))
const totalConversations = computed(() => total.value)
const unreadCount = computed(() => 
  conversations.value.filter((c: Conversation) => c.unreadCount && c.unreadCount > 0).length
)

// Methods
async function loadConversations() {
  // 使用 store 的方法來載入對話
  try {
    const apiFilters: Record<string, unknown> = { ...filters.value }
    if (apiFilters.assignedTo === 'me') {
      apiFilters.assignedTo = currentAgent.value?.id
    } else if (apiFilters.assignedTo === 'unassigned') {
      apiFilters.assignedTo = undefined
    } else {
      delete apiFilters.assignedTo
    }

    await conversationsStore.fetchConversations(apiFilters, currentPage.value)
    total.value = conversationsStore.pagination.total
  } catch (error) {
    console.error('載入對話失敗:', error)
  }
}

function selectConversation(conversation: Conversation) {
  selectedConversationId.value = conversation.id
  router.push(`/conversations/${conversation.id}`)
}

function changePage(page: number) {
  if (page < 1 || page > totalPages.value) {return}
  currentPage.value = page
  loadConversations()
}


function clearFilters() {
  filters.value = {
    status: '',
    platform: '',
    assignedTo: undefined
  }
  currentPage.value = 1
  loadConversations()
}

// 混合同步相關狀態
const syncStatus = ref<'disconnected' | 'connecting' | 'connected' | 'polling' | 'error'>('disconnected')
const isAutoRefreshing = ref(false)
// Sync error and last update are handled by the sync service itself

// 設置同步服務回調
conversationSync.onData((data: Conversation[]) => {
  console.log('📥 [ConversationList] Received data from sync service:', data.length)
  // Note: conversations is readonly from useConversations, so we refresh the store instead
  conversationsStore.setConversations(data)
  total.value = data.length
  isAutoRefreshing.value = false
})

conversationSync.onStatus((status) => {
  console.log('📊 [ConversationList] Sync status changed:', status)
  syncStatus.value = status
  
  // 更新刷新狀態指示器
  if (status === 'connecting') {
    isAutoRefreshing.value = true
  } else if (status === 'connected' || status === 'polling') {
    isAutoRefreshing.value = false
  }
})

// 手動刷新
async function refreshConversations() {
  console.log('🔄 [ConversationList] Manual refresh triggered')
  currentPage.value = 1
  isAutoRefreshing.value = true
  
  try {
    await conversationSync.refresh()
  } catch (error) {
    console.error('Manual refresh failed:', error)
    // 回退到原始方法
    await loadConversations()
  } finally {
    isAutoRefreshing.value = false
  }
}

// Watch for filter changes
watch(filters, () => {
  currentPage.value = 1
}, { deep: true })

// Lifecycle
onMounted(async () => {
  console.log('🚀 [ConversationList] Component mounted, starting sync service')
  
  // 初始加載數據
  await loadConversations()
  
  // 啟動混合同步服務
  await conversationSync.start()
})

onUnmounted(() => {
  console.log('🛑 [ConversationList] Component unmounted, stopping sync service')
  conversationSync.stop()
})
</script>

<style scoped>
.conversation-list {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.list-header {
  background-color: white;
  border-bottom: 1px solid var(--gray-200);
  padding: var(--space-6);
}

.header-content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.page-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0 0 var(--space-2) 0;
}

.page-subtitle {
  font-size: 1rem;
  color: var(--gray-600);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.sync-status-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid;
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.sync-status-indicator.status-connected {
  background-color: var(--green-50);
  border-color: var(--green-200);
  color: var(--green-700);
}

.sync-status-indicator.status-polling {
  background-color: var(--yellow-50);
  border-color: var(--yellow-200);
  color: var(--yellow-700);
}

.sync-status-indicator.status-connecting {
  background-color: var(--blue-50);
  border-color: var(--blue-200);
  color: var(--blue-700);
}

.sync-status-indicator.status-error {
  background-color: var(--red-50);
  border-color: var(--red-200);
  color: var(--red-700);
}

.sync-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-connected .sync-dot {
  background-color: var(--green-500);
}

.status-polling .sync-dot {
  background-color: var(--yellow-500);
}

.status-connecting .sync-dot, .sync-dot.syncing {
  background-color: var(--blue-500);
  animation: pulse 1.5s ease-in-out infinite;
}

.status-error .sync-dot {
  background-color: var(--red-500);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.1);
  }
}

.filters-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
}

.filters {
  display: flex;
  gap: var(--space-4);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.filter-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--gray-700);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.quick-stats {
  display: flex;
  gap: var(--space-6);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.stat-number {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-600);
  line-height: 1;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--gray-600);
  font-weight: 500;
  margin-top: var(--space-1);
}

.list-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.conversations-container {
  flex: 1;
  padding: var(--space-6);
  overflow: hidden;
}



.conversations-grid {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: var(--space-4);
  align-content: start;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-6);
  background-color: white;
  border-top: 1px solid var(--gray-200);
}

.page-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.page-text {
  font-weight: 600;
  color: var(--gray-900);
}

.total-text {
  font-size: 0.875rem;
  color: var(--gray-600);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .conversations-grid {
    grid-template-columns: 1fr;
    padding: var(--space-4);
  }
  
  .filters-section {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-4);
  }
  
  .quick-stats {
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: var(--space-4);
  }
  
  .header-actions {
    width: 100%;
  }
  
  .filters {
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .filter-group {
    width: 100%;
  }
  
  .pagination {
    flex-direction: column;
    gap: var(--space-4);
  }
  
  .page-title {
    font-size: 1.5rem;
  }
  
  .list-header {
    padding: var(--space-4);
  }
}

@media (max-width: 640px) {
  .conversations-grid {
    padding: var(--space-3);
    gap: var(--space-3);
  }
  
  .quick-stats {
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .stat-item {
    flex-direction: row;
    justify-content: space-between;
    padding: var(--space-3);
    background-color: var(--gray-50);
    border-radius: var(--radius-lg);
  }
}
</style>