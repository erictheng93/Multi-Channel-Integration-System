<template>
  <AppLayout>
    <ErrorBoundary>
      <div class="conversations">
        <header class="conversations-header">
          <h1>對話管理</h1>
          <div class="filters">
            <select
              v-model="filters.status"
              @change="applyFilters"
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
            <select
              v-model="filters.platform"
              @change="applyFilters"
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
            <RefreshButton
              :loading="loading"
              @refresh="refreshConversations"
            />
          </div>
        </header>

        <div class="conversations-content">
          <div
            v-if="loading"
            class="loading"
          >
            載入中...
          </div>
          <div
            v-else-if="conversations.length === 0"
            class="no-data"
          >
            暫無對話記錄
          </div>
          <div
            v-else
            class="conversations-table-container"
          >
            <!-- Desktop Table View -->
            <div class="desktop-table">
              <table class="conversations-table">
                <thead>
                  <tr>
                    <th class="customer-col">
                      客戶
                    </th>
                    <th class="platform-col">
                      平台
                    </th>
                    <th class="status-col">
                      狀態
                    </th>
                    <th class="message-col">
                      最後訊息
                    </th>
                    <th class="agent-col">
                      負責人
                    </th>
                    <th class="time-col">
                      更新時間
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="conversation in conversations"
                    :key="conversation.id"
                    class="conversation-row"
                    @click="goToConversation(conversation.id)"
                  >
                    <td class="customer-cell">
                      <div class="customer-info">
                        <div class="customer-name">
                          {{ conversation.customer?.name || conversation.user?.name || (conversation as any).customer_name || '未知用戶' }}
                        </div>
                        <div class="customer-id">
                          ID: {{ conversation.userId }}
                        </div>
                      </div>
                    </td>
                    <td class="platform-cell">
                      <div
                        class="platform-badge"
                        :class="conversation.platform || conversation.user?.platform"
                      >
                        {{ getPlatformText(conversation.platform || conversation.user?.platform || 'line') }}
                      </div>
                    </td>
                    <td class="status-cell">
                      <div
                        class="status-badge"
                        :class="conversation.status"
                      >
                        {{ getStatusText(conversation.status) }}
                      </div>
                    </td>
                    <td class="message-cell">
                      <div class="last-message">
                        {{ getLastMessageText(conversation) }}
                      </div>
                    </td>
                    <td class="agent-cell">
                      <div class="assigned-agent">
                        {{ conversation.assignedAgent?.name || '未指派' }}
                      </div>
                    </td>
                    <td class="time-cell">
                      <div class="timestamp">
                        {{ formatTime(conversation.updatedAt || (conversation as any).updated_at) }}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile Card View -->
            <div class="mobile-cards">
              <div
                v-for="conversation in conversations"
                :key="conversation.id"
                class="conversation-card"
                @click="goToConversation(conversation.id)"
              >
                <div class="card-header">
                  <div class="customer-info">
                    <div class="customer-name">
                      {{ conversation.customer?.name || conversation.user?.name || (conversation as any).customer_name || '未知用戶' }}
                    </div>
                    <div class="customer-id">
                      ID: {{ conversation.userId }}
                    </div>
                  </div>
                  <div class="badges">
                    <div
                      class="platform-badge"
                      :class="conversation.platform || conversation.user?.platform"
                    >
                      {{ getPlatformText(conversation.platform || conversation.user?.platform || 'line') }}
                    </div>
                    <div
                      class="status-badge"
                      :class="conversation.status"
                    >
                      {{ getStatusText(conversation.status) }}
                    </div>
                  </div>
                </div>
                <div class="card-body">
                  <div class="last-message">
                    {{ getLastMessageText(conversation) }}
                  </div>
                </div>
                <div class="card-footer">
                  <div class="assigned-agent">
                    負責人: {{ conversation.assignedAgent?.name || '未指派' }}
                  </div>
                  <div class="timestamp">
                    {{ formatTime(conversation.updatedAt || (conversation as any).updated_at) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConversationsStore } from '@/stores/conversations'
import { useActivityStream } from '@/composables/useActivityStream'
import type { ConversationFilters } from '@/types'
import AppLayout from '@/components/ui/AppLayout.vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import { convertEmojiDescriptions } from '@/utils/emoji-utils'

const router = useRouter()
const conversationsStore = useConversationsStore()

// 🚨 關鍵修復：添加 SSE 連接以實現實時更新
const activityStreamData = useActivityStream()

const filters = ref<ConversationFilters>({
  status: '', // 預設為空字串以顯示「所有狀態」
  platform: '' // 預設為空字串以顯示「所有平台」
})

// 直接使用 Store 數據，避免 useAsyncData 的複雜性
const loading = computed(() => conversationsStore.loading)
const conversations = computed(() => conversationsStore.conversations)

console.log('🔍 [ConversationsTable] Initial state:', {
  loading: loading.value,
  conversationsLength: conversations.value.length,
  storeState: conversationsStore.$state
})

// 監聽 SSE 活動更新，自動刷新對話列表
watch(() => activityStreamData.activities.value, (newActivities, oldActivities) => {
  if (newActivities.length !== oldActivities?.length) {
    console.log('📢 [ConversationsTable] Received SSE update, refreshing conversations...')
    conversationsStore.fetchConversations()
  }
}, { deep: true })

// 刷新對話列表的函數
const refreshConversations = () => {
  console.log('🔄 [ConversationsTable] Manual refresh requested')
  conversationsStore.fetchConversations()
}

const getPlatformText = (platform: string) => {
  const platformMap = {
    line: 'LINE',
    facebook: 'Facebook',
    instagram: 'Instagram',
    whatsapp: 'WhatsApp'
  }
  return platformMap[platform as keyof typeof platformMap] || platform
}

const getStatusText = (status: string) => {
  const statusMap = {
    open: '待處理',
    assigned: '已指派',
    closed: '已關閉'
  }
  return statusMap[status as keyof typeof statusMap] || status
}

const formatTime = (date: Date | number) => {
  const dateObj = typeof date === 'number' ? new Date(date) : date
  return dateObj.toLocaleString('zh-TW')
}

const goToConversation = (id: string) => {
  router.push(`/conversations/${id}`)
}

const getLastMessageText = (conversation: any) => {
  const content = conversation.lastMessage?.content || conversation.last_message_content || '暫無訊息'
  return convertEmojiDescriptions(content)
}

const applyFilters = () => {
  const activeFilters: ConversationFilters = {}
  if (filters.value.status) {activeFilters.status = filters.value.status}
  if (filters.value.platform) {activeFilters.platform = filters.value.platform}
  
  console.log('🔍 [ConversationsTable] Applying filters:', activeFilters)
  // 直接使用 store 的 fetchConversations 方法重新載入數據
  conversationsStore.fetchConversations(activeFilters)
}

onMounted(async () => {
  console.log('🚀 ConversationsTable mounted')
  // 確保數據載入 - 添加更好的錯誤處理和防止白屏
  try {
    // 檢查是否已經有數據（避免重複載入）
    if (conversationsStore.conversations.length === 0 && !conversationsStore.loading) {
      await conversationsStore.fetchConversations()
    }
  } catch (error) {
    console.error('載入對話失敗:', error)
    // 即使載入失敗，也不要讓頁面白屏
    // conversationsStore 已經有自己的錯誤處理
  }
})
</script>

<style scoped>
.conversations {
  background-color: #f8f9fa;
  min-height: calc(100vh - 120px);
}

.conversations-header {
  background: white;
  padding: 1rem 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.conversations-header h1 {
  margin: 0;
  color: #333;
}

.filters {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.filters select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.conversations-content {
  padding: 2rem;
  max-width: 100%;
  margin: 0 auto;
}

.conversations-table-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

/* Desktop Table Styles */
.desktop-table {
  display: block;
  overflow-x: auto;
}

.conversations-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.conversations-table thead {
  background-color: #f8f9fa;
}

.conversations-table th {
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #555;
  border-bottom: 2px solid #e9ecef;
  white-space: nowrap;
}

.conversations-table td {
  padding: 1rem;
  border-bottom: 1px solid #e9ecef;
  vertical-align: top;
}

.conversation-row {
  cursor: pointer;
  transition: background-color 0.2s;
}

.conversation-row:hover {
  background-color: #f8f9fa;
}

/* Table Column Widths */
.customer-col { width: 20%; }
.platform-col { width: 10%; }
.status-col { width: 10%; }
.message-col { width: 35%; }
.agent-col { width: 15%; }
.time-col { width: 10%; }

/* Cell Content Styles */
.customer-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.customer-name {
  font-weight: 500;
  color: #333;
}

.customer-id {
  font-size: 0.85rem;
  color: #666;
}

.platform-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  color: white;
  text-align: center;
}

.platform-badge.line {
  background-color: #00c300;
}

.platform-badge.facebook {
  background-color: #1877f2;
}

.platform-badge.instagram {
  background-color: #e4405f;
}

.platform-badge.whatsapp {
  background-color: #25d366;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  color: white;
  text-align: center;
}

.status-badge.open {
  background-color: #f39c12;
}

.status-badge.assigned {
  background-color: #3498db;
}

.status-badge.closed {
  background-color: #95a5a6;
}

.last-message {
  color: #555;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-width: 350px;
}

.assigned-agent {
  color: #3498db;
  font-weight: 500;
}

.timestamp {
  color: #666;
  font-size: 0.85rem;
}

/* Mobile Card Styles */
.mobile-cards {
  display: none;
}

.conversation-card {
  background: white;
  border-bottom: 1px solid #e9ecef;
  padding: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.conversation-card:hover {
  background-color: #f8f9fa;
}

.conversation-card:last-child {
  border-bottom: none;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.card-header .customer-info {
  flex: 1;
}

.badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.card-body {
  margin-bottom: 0.75rem;
}

.card-body .last-message {
  max-width: none;
  -webkit-line-clamp: 3;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  color: #666;
}

.loading, .no-data {
  text-align: center;
  padding: 3rem;
  color: #666;
  font-size: 1.1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* Responsive Design */
@media (max-width: 1024px) {
  .conversations-table {
    font-size: 13px;
  }
  
  .conversations-table th,
  .conversations-table td {
    padding: 0.75rem 0.5rem;
  }
  
  .last-message {
    max-width: 250px;
  }
}

@media (max-width: 768px) {
  .conversations-header {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
  
  .filters {
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .conversations-content {
    padding: 1rem;
  }
  
  /* Hide desktop table on mobile */
  .desktop-table {
    display: none;
  }
  
  /* Show mobile cards on mobile */
  .mobile-cards {
    display: block;
  }
  
  .conversations-table-container {
    box-shadow: none;
    border-radius: 0;
  }
}

@media (max-width: 480px) {
  .conversations-header {
    padding: 1rem;
  }
  
  .filters {
    flex-direction: column;
    width: 100%;
  }
  
  .filters select {
    width: 100%;
    max-width: 200px;
  }
  
  .conversation-card {
    padding: 0.75rem;
  }
  
  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .badges {
    width: 100%;
    justify-content: flex-start;
  }
  
  .card-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
}
</style>