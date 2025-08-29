<template>
  <AppLayout>
    <div class="conversations-safe">
      <header class="conversations-header">
        <h1>對話管理（安全模式）</h1>
        <div class="debug-info">
          <span>認證狀態: {{ authStatus }}</span>
          <span>載入狀態: {{ loadingStatus }}</span>
        </div>
      </header>

      <div class="conversations-content">
        <!-- 載入中 -->
        <div
          v-if="isLoading"
          class="loading"
        >
          載入對話中...
        </div>
        
        <!-- 錯誤訊息 -->
        <div
          v-else-if="error"
          class="error"
        >
          <h3>載入失敗</h3>
          <p>{{ error }}</p>
          <button
            class="retry-btn"
            @click="retryLoad"
          >
            重試
          </button>
        </div>
        
        <!-- 對話列表 -->
        <div
          v-else-if="conversations.length > 0"
          class="conversation-list"
        >
          <div 
            v-for="conv in conversations" 
            :key="conv.id"
            class="conversation-card"
          >
            <div class="card-header">
              <span class="customer-name">{{ conv.customer?.name || '未知用戶' }}</span>
              <span
                class="status-badge"
                :class="conv.status"
              >{{ conv.status }}</span>
            </div>
            <div class="last-message">
              {{ conv.lastMessage?.content || '暫無訊息' }}
            </div>
          </div>
        </div>
        
        <!-- 無資料 -->
        <div
          v-else
          class="no-data"
        >
          暫無對話記錄
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { conversationApi } from '@/api/conversations'
import AppLayout from '@/components/ui/AppLayout.vue'
import type { Conversation } from '@/types'

// Stores
const authStore = useAuthStore()

// State
const conversations = ref<Conversation[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const loadAttempts = ref(0)

// Computed
const authStatus = computed(() => authStore.isAuthenticated ? '已登入' : '未登入')
const loadingStatus = computed(() => {
  if (isLoading.value) {return '載入中...'}
  if (error.value) {return '載入失敗'}
  if (conversations.value.length > 0) {return `已載入 ${conversations.value.length} 個對話`}
  return '無資料'
})

// Methods
const loadConversations = async () => {
  // 防止重複載入
  if (isLoading.value) {
    console.log('Already loading, skipping...')
    return
  }
  
  console.log('🔄 Loading conversations (safe mode)...')
  isLoading.value = true
  error.value = null
  loadAttempts.value++
  
  // 檢查認證
  if (!authStore.isAuthenticated) {
    console.warn('Not authenticated, cannot load conversations')
    error.value = '請先登入'
    isLoading.value = false
    return
  }
  
  try {
    // 直接調用 API，避免複雜的 store 邏輯
    const response = await conversationApi.list({
      page: 1,
      pageSize: 20
    })
    
    if (response.success && response.data) {
      conversations.value = response.data.items || []
      console.log(`✅ Loaded ${conversations.value.length} conversations`)
    } else {
      throw new Error(response.error || '載入失敗')
    }
  } catch (err) {
    console.error('Failed to load conversations:', err)
    error.value = err instanceof Error ? err.message : '載入對話失敗'
    
    // 如果是認證錯誤，不要重試
    if (error.value.includes('401') || error.value.includes('未授權')) {
      console.warn('Authentication error, not retrying')
    }
  } finally {
    isLoading.value = false
  }
}

const retryLoad = () => {
  console.log('Retrying load...')
  loadConversations()
}

// Lifecycle
onMounted(() => {
  console.log('🚀 ConversationsSafe mounted')
  console.log('Auth status:', authStore.isAuthenticated)
  console.log('Token exists:', !!authStore.token)
  
  // 只載入一次，避免任何可能的循環
  if (authStore.isAuthenticated && loadAttempts.value === 0) {
    loadConversations()
  }
})
</script>

<style scoped>
.conversations-safe {
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

.debug-info {
  display: flex;
  gap: 2rem;
  font-size: 0.875rem;
  color: #666;
}

.debug-info span {
  padding: 0.25rem 0.75rem;
  background: #f0f0f0;
  border-radius: 4px;
}

.conversations-content {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.loading, .error, .no-data {
  text-align: center;
  padding: 3rem;
}

.error {
  color: #e53e3e;
}

.error h3 {
  margin-bottom: 1rem;
}

.retry-btn {
  margin-top: 1rem;
  padding: 0.5rem 1.5rem;
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.retry-btn:hover {
  background: #3182ce;
}

.conversation-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}

.conversation-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: transform 0.2s;
}

.conversation-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.card-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.customer-name {
  font-weight: 500;
  color: #333;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  color: white;
}

.status-badge.open {
  background: #f6ad55;
}

.status-badge.assigned {
  background: #4299e1;
}

.status-badge.closed {
  background: #a0aec0;
}

.last-message {
  color: #666;
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>