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
              :loading="loading || isUpdating"
              @refresh="refreshConversations"
            />
          </div>
        </header>

        <!-- SSE 更新指示器 -->
        <div
          v-if="isUpdating"
          class="updating-indicator"
        >
          <div class="updating-content">
            <div class="updating-spinner" />
            <!-- Glassmorphism Loading Indicator -->
            <div
              class="sync-message-container"
              role="status"
              aria-live="polite"
              aria-label="正在同步最新對話"
            >
              <div class="sync-icon-wrapper">
                <div
                  class="sync-icon"
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 24 24"
                    class="sync-svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M12,4V2C6.48,2 2,6.48 2,12H4C4,7.58 7.58,4 12,4Z"
                      class="sync-path"
                    />
                  </svg>
                </div>
              </div>
              <div class="sync-text-content">
                <div class="sync-primary-text">
                  正在同步最新對話
                </div>
                <div class="sync-secondary-text">
                  獲取最新消息中...
                </div>
              </div>
              <div
                class="sync-progress-dots"
                aria-hidden="true"
              >
                <div class="dot dot-1" />
                <div class="dot dot-2" />
                <div class="dot dot-3" />
              </div>
            </div>
          </div>
        </div>

        <div class="conversations-content">
          <div
            v-if="loading && displayedConversations.length === 0"
            class="loading-overlay"
          >
            <HamsterLoader message="載入對話列表中..." />
          </div>
          <div
            v-else-if="displayedConversations.length === 0"
            class="no-data"
          >
            <div class="no-data-content">
              <div class="no-data-icon">
                💬
              </div>
              <div class="no-data-text">
                暫無對話記錄
              </div>
            </div>
          </div>
          <div
            v-else
            class="conversations-table-container"
            :class="{ updating: isUpdating }"
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
                <TransitionGroup
                  name="conversation-list"
                  tag="tbody"
                  appear
                >
                  <tr
                    v-for="(conversation, index) in displayedConversations"
                    :key="conversation.id"
                    class="conversation-row"
                    :style="{ animationDelay: `${index * 50}ms` }"
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
                        {{ getAssignedTo(conversation) }}
                      </div>
                    </td>
                    <td class="time-cell">
                      <div class="timestamp">
                        {{ formatTime(conversation.updatedAt || (conversation as any).updated_at) }}
                      </div>
                    </td>
                  </tr>
                </TransitionGroup>
              </table>
            </div>

            <!-- Mobile Card View -->
            <div class="mobile-cards">
              <TransitionGroup
                name="conversation-card"
                appear
              >
                <div
                  v-for="(conversation, index) in displayedConversations"
                  :key="conversation.id"
                  class="conversation-card"
                  :style="{ animationDelay: `${index * 50}ms` }"
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
                      負責人: {{ getAssignedTo(conversation) }}
                    </div>
                    <div class="timestamp">
                      {{ formatTime(conversation.updatedAt || (conversation as any).updated_at) }}
                    </div>
                  </div>
                </div>
              </TransitionGroup>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useConversationsStore } from '@/stores/conversations'
// REMOVED: useActivityStream (SSE-based, replaced by WebSocket in Phase 1 cleanup)
// import { useActivityStream } from '@/composables/useActivityStream'
import type { ConversationFilters, Conversation } from '@/types'
import AppLayout from '@/components/ui/AppLayout.vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import { convertEmojiForConversationList } from '@/utils/layered-emoji-processor'

const router = useRouter()
const conversationsStore = useConversationsStore()

const filters = ref<ConversationFilters>({
  status: '', // 預設為空字串以顯示「所有狀態」
  platform: '' // 預設為空字串以顯示「所有平台」
})

// 🎯 平滑載入動畫系統
const isUpdating = ref(false)
const previousConversationIds = ref<string[]>([])
const animationDelay = ref(0)

// 直接使用 Store 數據，避免 useAsyncData 的複雜性
const loading = computed(() => conversationsStore.loading)
const conversations = computed(() => conversationsStore.conversations)

// 🎯 平滑載入系統：顯示的對話列表
const displayedConversations = computed(() => conversations.value)

// 🎯 監聽對話變化並處理動畫邏輯
watch(conversations, (currentConversations) => {
  // 檢測新對話的邏輯
  if (previousConversationIds.value.length > 0) {
    const currentIds = new Set(currentConversations.map(conv => conv.id))
    const previousIds = new Set(previousConversationIds.value)
    
    // 如果有新對話加入，觸發動畫
    const hasNewConversations = currentConversations.some(conv => !previousIds.has(conv.id))
    const hasRemovedConversations = previousConversationIds.value.some(id => !currentIds.has(id))
    
    if (hasNewConversations || hasRemovedConversations) {
      animationDelay.value = Date.now()
    }
  }
  
  // 更新前一個狀態
  previousConversationIds.value = currentConversations.map(conv => conv.id)
}, { deep: true })

console.log('🔍 [ConversationsTable] Initial state:', {
  loading: loading.value,
  conversationsLength: conversations.value.length,
  storeState: conversationsStore.$state
})

// 🎯 平滑更新函數
const performSmoothUpdate = async () => {
  if (isUpdating.value) {return} // 防止重複更新
  
  isUpdating.value = true
  console.log('📢 [ConversationsTable] Starting smooth update...')
  
  try {
    await conversationsStore.fetchConversations()
    
    // 短暫的視覺反饋
    await nextTick()
    setTimeout(() => {
      isUpdating.value = false
      console.log('✅ [ConversationsTable] Smooth update completed')
    }, 800) // 800ms 的更新指示器顯示時間
    
  } catch (error) {
    console.error('❌ [ConversationsTable] Update failed:', error)
    isUpdating.value = false
  }
}

// 刷新對話列表的函數
const refreshConversations = () => {
  console.log('🔄 [ConversationsTable] Manual refresh requested')
  performSmoothUpdate()
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

const getLastMessageText = (conversation: Conversation) => {
  const content = conversation.lastMessage?.content || '暫無訊息'
  return convertEmojiForConversationList(content)
}

const getAssignedTo = (conversation: Conversation) => {
  // 優先顯示個人指派
  if (conversation.assignedAgent?.name) {
    return `👤 ${conversation.assignedAgent.name}`
  }
  // 其次顯示團隊指派
  if (conversation.assignedTeam?.name) {
    return `👥 ${conversation.assignedTeam.name}`
  }
  // 都沒有則顯示未指派
  return '未指派'
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

  // 🔧 FIX: 每次 mount 都刷新數據，確保返回列表時顯示最新狀態
  // 使用 loadWithCache 提供最佳 UX：
  // - 如果有緩存數據：立即顯示，背景靜默更新（只顯示更新指示器，非全屏載入）
  // - 如果無緩存數據：顯示載入狀態
  try {
    await conversationsStore.loadWithCache(filters.value)
  } catch (error) {
    console.error('載入對話失敗:', error)
    // 即使載入失敗，也不要讓頁面白屏
    // conversationsStore 已經有自己的錯誤處理
  }

  // ✅ 方案 B 阶段 1: 启动实时同步
  // Store 层统一管理 WebSocket 连接，所有使用 store 的组件自动获得实时更新
  console.log('🔌 [ConversationsTable] Initializing real-time sync from Store...')
  conversationsStore.initializeRealtime()
})

// ✅ 清理实时同步资源
onUnmounted(() => {
  console.log('👋 [ConversationsTable] Component unmounting, cleaning up...')
  conversationsStore.cleanup()
})
</script>

<style scoped>
.conversations {
  background-color: #f8f9fa;
  min-height: calc(100vh - 120px);
  position: relative;
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
  transition: all 0.3s ease;
}

.filters select:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

/* 🎯 Glassmorphism 更新指示器 */
.updating-indicator {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(244, 129, 32, 0.2);
  padding: 1rem 2rem;
  text-align: center;
  box-shadow:
    0 8px 32px rgba(244, 129, 32, 0.1),
    0 2px 16px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  animation: slideInFromTop 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.updating-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  max-width: 500px;
  margin: 0 auto;
}

.updating-spinner {
  display: none; /* Hide old spinner */
}

/* Glassmorphism Sync Message Container */
.sync-message-container {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  background: rgba(244, 129, 32, 0.08);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 16px;
  border: 1px solid rgba(244, 129, 32, 0.15);
  box-shadow:
    0 4px 20px rgba(244, 129, 32, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
  animation: syncContainerPulse 2s ease-in-out infinite;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sync-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sync-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(244, 129, 32, 0.12);
  border-radius: 50%;
  animation: syncIconRotate 2s linear infinite;
  box-shadow:
    0 2px 8px rgba(244, 129, 32, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.sync-svg {
  width: 16px;
  height: 16px;
  fill: #F48120;
  filter: drop-shadow(0 1px 2px rgba(244, 129, 32, 0.3));
}

.sync-path {
  animation: syncPathDraw 1.5s ease-in-out infinite;
}

.sync-text-content {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  flex: 1;
}

.sync-primary-text {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1a1a1a;
  letter-spacing: 0.2px;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
}

.sync-secondary-text {
  font-size: 0.8rem;
  font-weight: 400;
  color: #666;
  opacity: 0.85;
  animation: syncTextFade 2s ease-in-out infinite;
}

.sync-progress-dots {
  display: flex;
  gap: 0.375rem;
  align-items: center;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, #F48120, #e8741d);
  box-shadow:
    0 1px 3px rgba(244, 129, 32, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  animation: dotPulse 1.4s ease-in-out infinite;
}

.dot-1 {
  animation-delay: 0s;
}

.dot-2 {
  animation-delay: 0.2s;
}

.dot-3 {
  animation-delay: 0.4s;
}

@keyframes slideInFromTop {
  from {
    opacity: 0;
    transform: translateY(-100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Glassmorphism Animation Keyframes */
@keyframes syncContainerPulse {
  0%, 100% {
    box-shadow:
      0 4px 20px rgba(244, 129, 32, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.4);
    background: rgba(244, 129, 32, 0.08);
  }
  50% {
    box-shadow:
      0 6px 28px rgba(244, 129, 32, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.5);
    background: rgba(244, 129, 32, 0.12);
  }
}

@keyframes syncIconRotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes syncPathDraw {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
}

@keyframes syncTextFade {
  0%, 100% {
    opacity: 0.85;
  }
  50% {
    opacity: 0.6;
  }
}

@keyframes dotPulse {
  0%, 70%, 100% {
    transform: scale(1);
    opacity: 0.7;
  }
  35% {
    transform: scale(1.3);
    opacity: 1;
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.conversations-content {
  padding: 2rem;
  max-width: 100%;
  margin: 0 auto;
  position: relative;
}

/* 🎯 載入覆蓋層 */
.loading-overlay {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  animation: fadeIn 0.3s ease-out;
}

/* 🎯 改進的空資料狀態 */
.no-data {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: 4rem 2rem;
  text-align: center;
  animation: fadeIn 0.4s ease-out;
}

.no-data-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  max-width: 400px;
  margin: 0 auto;
}

.no-data-icon {
  font-size: 3rem;
  opacity: 0.6;
  animation: float 3s ease-in-out infinite;
}

.no-data-text {
  font-size: 1.1rem;
  color: #666;
  font-weight: 500;
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

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.conversations-table-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
  position: relative;
  transition: all 0.3s ease;
}

.conversations-table-container.updating {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(248, 250, 252, 0.98) 50%,
    rgba(255, 255, 255, 0.95) 100%
  );
}

.conversations-table-container.updating::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(59, 130, 246, 0.1),
    transparent
  );
  animation: shimmer 1.5s infinite;
  pointer-events: none;
  z-index: 1;
}

@keyframes shimmer {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
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

/* 🎯 TransitionGroup 動畫效果 */
.conversation-list-enter-active,
.conversation-list-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.conversation-list-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

.conversation-list-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

.conversation-list-move {
  transition: transform 0.3s ease;
}

.conversation-card-enter-active,
.conversation-card-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.conversation-card-enter-from {
  opacity: 0;
  transform: translateX(-30px) scale(0.98);
}

.conversation-card-leave-to {
  opacity: 0;
  transform: translateX(30px) scale(0.98);
}

.conversation-card-move {
  transition: transform 0.3s ease;
}

.conversation-row {
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  animation: slideInFromBottom var(--animation-duration, 0.4s) cubic-bezier(0.4, 0, 0.2, 1) backwards;
}

.conversation-row:hover {
  background-color: #f8f9fa;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.conversation-row:active {
  transform: translateY(0);
  transition-duration: 0.1s;
}

@keyframes slideInFromBottom {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 設置動畫延遲的 CSS 變量 */
.conversation-row:nth-child(1) { --animation-duration: 0.3s; }
.conversation-row:nth-child(2) { --animation-duration: 0.4s; }
.conversation-row:nth-child(3) { --animation-duration: 0.5s; }
.conversation-row:nth-child(4) { --animation-duration: 0.6s; }
.conversation-row:nth-child(5) { --animation-duration: 0.7s; }

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
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  animation: slideInFromLeft var(--animation-duration, 0.4s) cubic-bezier(0.4, 0, 0.2, 1) backwards;
}

.conversation-card:hover {
  background-color: #f8f9fa;
  transform: translateX(4px);
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.08),
    -4px 0 0 rgba(59, 130, 246, 0.3);
}

.conversation-card:active {
  transform: translateX(2px);
  transition-duration: 0.1s;
}

@keyframes slideInFromLeft {
  0% {
    opacity: 0;
    transform: translateX(-30px) scale(0.98);
  }
  100% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

/* 設置卡片動畫延遲 */
.conversation-card:nth-child(1) { --animation-duration: 0.3s; }
.conversation-card:nth-child(2) { --animation-duration: 0.4s; }
.conversation-card:nth-child(3) { --animation-duration: 0.5s; }
.conversation-card:nth-child(4) { --animation-duration: 0.6s; }
.conversation-card:nth-child(5) { --animation-duration: 0.7s; }

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

/* 🎯 性能優化 */
.conversation-row,
.conversation-card {
  contain: layout style paint;
  will-change: transform, opacity;
}

/* 減少動畫量的用戶偏好 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .conversation-row,
  .conversation-card {
    animation: none;
  }

  .updating-spinner {
    animation: none;
  }

  .no-data-icon {
    animation: none;
  }

  /* Glassmorphism Reduced Motion */
  .sync-message-container {
    animation: none;
  }

  .sync-icon {
    animation: none;
  }

  .sync-path {
    animation: none;
  }

  .sync-secondary-text {
    animation: none;
    opacity: 0.85;
  }

  .dot {
    animation: none;
    opacity: 0.7;
    transform: scale(1);
  }
}

/* 原有的 loading 和 no-data 樣式已被新的取代 */

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
  
  /* 🎯 移動端動畫優化 */
  .updating-indicator {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
  }

  .updating-spinner {
    width: 16px;
    height: 16px;
  }

  /* Glassmorphism Mobile Responsive */
  .sync-message-container {
    gap: 0.75rem;
    padding: 0.625rem 1rem;
    border-radius: 12px;
  }

  .sync-icon {
    width: 24px;
    height: 24px;
  }

  .sync-svg {
    width: 14px;
    height: 14px;
  }

  .sync-primary-text {
    font-size: 0.875rem;
  }

  .sync-secondary-text {
    font-size: 0.75rem;
  }

  .dot {
    width: 5px;
    height: 5px;
  }

  .sync-progress-dots {
    gap: 0.25rem;
  }
  
  .no-data {
    padding: 3rem 1rem;
  }
  
  .no-data-icon {
    font-size: 2.5rem;
  }
  
  /* 簡化移動端動畫以提升性能 */
  .conversation-card:hover {
    transform: translateX(2px);
    box-shadow: 
      0 2px 8px rgba(0, 0, 0, 0.06),
      -2px 0 0 rgba(59, 130, 246, 0.2);
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

  /* Extra Small Screen Glassmorphism Adjustments */
  .updating-indicator {
    padding: 0.5rem 0.75rem;
  }

  .sync-message-container {
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 10px;
    flex-direction: column;
    text-align: center;
  }

  .sync-text-content {
    align-items: center;
  }

  .sync-primary-text {
    font-size: 0.8rem;
  }

  .sync-secondary-text {
    font-size: 0.7rem;
  }

  .sync-progress-dots {
    justify-content: center;
    gap: 0.2rem;
  }

  .dot {
    width: 4px;
    height: 4px;
  }
}
</style>