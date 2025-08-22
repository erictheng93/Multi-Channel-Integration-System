<template>
  <AppLayout>
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
          class="conversation-grid"
        >
          <div
            v-for="conversation in conversations"
            :key="conversation.id"
            class="conversation-card"
            @click="goToConversation(conversation.id)"
          >
            <div class="conversation-header">
              <div class="customer-info">
                <div class="customer-name">
                  {{ conversation.customer?.name || conversation.user?.name || '未知用戶' }}
                </div>
                <div
                  v-if="conversation.platform || conversation.user?.platform"
                  class="platform-badge"
                  :class="conversation.platform || conversation.user?.platform"
                >
                  {{ getPlatformText(conversation.platform || conversation.user?.platform || 'line') }}
                </div>
              </div>
              <div
                class="status-badge"
                :class="conversation.status"
              >
                {{ getStatusText(conversation.status) }}
              </div>
            </div>
          
            <div class="conversation-body">
              <div class="last-message">
                {{ conversation.lastMessage?.content || '暫無訊息' }}
              </div>
              <div class="conversation-meta">
                <div class="timestamp">
                  {{ formatTime(conversation.updatedAt) }}
                </div>
                <div
                  v-if="conversation.assignedAgent"
                  class="assigned-agent"
                >
                  指派給: {{ conversation.assignedAgent.name }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useConversations } from '@/composables'
import { useConversationsStore } from '@/stores/conversations'
import type { ConversationFilters } from '@/types'
import AppLayout from '@/components/ui/AppLayout.vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'

const router = useRouter()
const route = useRoute()
const { filterConversations, refreshConversations } = useConversations()
const conversationsStore = useConversationsStore()

const filters = ref<ConversationFilters>({
  status: undefined,
  platform: undefined
})

const loading = computed(() => conversationsStore.loading)
const conversations = computed(() => conversationsStore.conversations)

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

const applyFilters = () => {
  const activeFilters: ConversationFilters = {}
  if (filters.value.status) {activeFilters.status = filters.value.status}
  if (filters.value.platform) {activeFilters.platform = filters.value.platform}
  
  // 使用 filterConversations 方法
  filterConversations(activeFilters)
}

// 監聽路由變化，確保Conversations頁面正確重新渲染
watch(() => route.path, (newPath, oldPath) => {
  console.log('🔄 Conversations: Route changed from', oldPath, 'to', newPath)
  
  // 如果路由到達Conversations頁面，確保數據刷新
  if (newPath === '/conversations') {
    console.log('🔄 Conversations: Refreshing data due to route change')
    refreshConversations()
  }
}, { immediate: false })

onMounted(async () => {
  console.log('🚀 Conversations mounted')
  // 確保數據載入
  try {
    await conversationsStore.fetchConversations()
  } catch (error) {
    console.error('載入對話失敗:', error)
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
  max-width: 1200px;
  margin: 0 auto;
}

.conversation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}

.conversation-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: 1.5rem;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.conversation-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.customer-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.customer-name {
  font-weight: 500;
  font-size: 1.1rem;
}

.platform-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  color: white;
  width: fit-content;
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
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  color: white;
}

.status-badge.open {
  background-color: var(--warning-500);
}

.status-badge.assigned {
  background-color: var(--primary-500);
}

.status-badge.closed {
  background-color: var(--gray-500);
}

.conversation-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.last-message {
  color: #666;
  font-size: 0.9rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.conversation-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: #999;
}

.assigned-agent {
  color: var(--primary-500);
}

.loading, .no-data {
  text-align: center;
  padding: 3rem;
  color: #666;
  font-size: 1.1rem;
}
</style>