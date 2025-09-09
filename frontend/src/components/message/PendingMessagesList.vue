<template>
  <div class="pending-messages-list">
    <div class="list-header">
      <div class="header-content">
        <h3 class="list-title">
          <ClockIcon />
          待發送訊息
        </h3>
        <p class="list-subtitle">
          {{ totalCount }} 條待發送訊息
        </p>
      </div>
      <div class="header-actions">
        <button
          class="btn btn-ghost btn-sm"
          :disabled="loading"
          @click="refreshList"
        >
          <RefreshIcon :spinning="loading" />
          刷新
        </button>
      </div>
    </div>

    <div
      v-if="loading && !messages.length"
      class="loading-state"
    >
      <HamsterLoader message="載入中..." />
    </div>

    <div
      v-else-if="!messages.length"
      class="empty-state"
    >
      <EmptyState
        title="暫無待發送訊息"
        description="當您設定延遲發送訊息時，會顯示在這裡"
      >
        <template #actions>
          <button
            class="btn btn-primary"
            @click="$emit('create-delayed')"
          >
            創建延遲訊息
          </button>
        </template>
      </EmptyState>
    </div>

    <div
      v-else
      class="messages-list"
    >
      <div
        v-for="message in messages"
        :key="message.id"
        class="message-item"
        :class="{
          'can-recall': message.can_recall,
          'sending-soon': isNearSendTime(message)
        }"
      >
        <div class="message-content">
          <div class="message-header">
            <div class="conversation-info">
              <strong>{{ message.customer_name || '未知客戶' }}</strong>
              <PlatformBadge :platform="message.platform" />
            </div>
            <div class="message-status">
              <span
                class="status-badge"
                :class="getStatusClass(message)"
              >
                {{ getStatusText(message) }}
              </span>
            </div>
          </div>

          <div class="message-text">
            {{ message.content }}
          </div>

          <div class="message-meta">
            <div class="timing-info">
              <div class="scheduled-time">
                <ClockIcon size="sm" />
                預定發送：{{ formatDateTime(message.scheduled_send_time) }}
              </div>
              <div
                v-if="message.can_recall"
                class="countdown"
              >
                <span class="countdown-text">
                  {{ getCountdown(message.scheduled_send_time) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="message-actions">
          <button
            v-if="message.can_recall"
            class="btn btn-sm btn-danger"
            :disabled="recallingMessageId === message.id"
            @click="recallMessage(message)"
          >
            <HamsterLoader
              v-if="recallingMessageId === message.id"
              message="處理中..."
            />
            <XCircleIcon v-else />
            撤回
          </button>
          <button
            class="btn btn-sm btn-ghost"
            @click="viewDetails(message)"
          >
            <EyeIcon />
            詳情
          </button>
        </div>
      </div>
    </div>

    <!-- 分頁 -->
    <div
      v-if="totalPages > 1"
      class="pagination"
    >
      <button
        class="btn btn-sm btn-ghost"
        :disabled="currentPage <= 1 || loading"
        @click="changePage(currentPage - 1)"
      >
        上一頁
      </button>
      <span class="page-info">
        第 {{ currentPage }} 頁，共 {{ totalPages }} 頁
      </span>
      <button
        class="btn btn-sm btn-ghost"
        :disabled="currentPage >= totalPages || loading"
        @click="changePage(currentPage + 1)"
      >
        下一頁
      </button>
    </div>

    <!-- 撤回確認Modal -->
    <Modal
      v-if="showRecallModal"
      :show="showRecallModal"
      @close="showRecallModal = false"
    >
      <template #header>
        <h3>確認撤回訊息</h3>
      </template>
      <template #body>
        <div class="recall-confirmation">
          <div class="warning-icon">
            <XCircleIcon />
          </div>
          <div class="confirmation-content">
            <p>確定要撤回這條延遲訊息嗎？</p>
            <div class="message-preview">
              "{{ selectedMessage?.content }}"
            </div>
            <p class="warning-text">
              撤回後無法復原，訊息將不會發送給客戶。
            </p>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="modal-actions">
          <button
            class="btn btn-ghost"
            :disabled="!!recallingMessageId"
            @click="showRecallModal = false"
          >
            取消
          </button>
          <button
            class="btn btn-danger"
            :disabled="!!recallingMessageId"
            @click="confirmRecall"
          >
            <HamsterLoader
              v-if="recallingMessageId"
              message="處理中..."
            />
            確認撤回
          </button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuth } from '@/composables'
import { useToast } from '@/composables/useToast'
import { 
  ClockIcon, 
  RefreshIcon, 
  XCircleIcon, 
  EyeIcon 
} from '@/components/icons'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PlatformBadge from '@/components/ui/PlatformBadge.vue'
import Modal from '@/components/ui/Modal.vue'
import { apiClient } from '@/api/base'

interface PendingMessage {
  id: string
  conversation_id: string
  customer_name: string
  content: string
  platform: string
  scheduled_send_time: string
  recall_deadline: string
  status: string
  can_recall: boolean
  message_type: string
}

const emit = defineEmits<{
  'create-delayed': []
  'message-recalled': [messageId: string]
}>()

const { currentAgent } = useAuth()
const { showError } = useToast()

const loading = ref(false)
const messages = ref<PendingMessage[]>([])
const currentPage = ref(1)
const pageSize = ref(10)
const totalCount = ref(0)
const recallingMessageId = ref<string | null>(null)
const showRecallModal = ref(false)
const selectedMessage = ref<PendingMessage | null>(null)

let countdownTimer: number | null = null

const totalPages = computed(() => Math.ceil(totalCount.value / pageSize.value))

const isNearSendTime = (message: PendingMessage) => {
  const sendTime = new Date(message.scheduled_send_time)
  const now = new Date()
  const diffMinutes = (sendTime.getTime() - now.getTime()) / (1000 * 60)
  return diffMinutes <= 1 && diffMinutes > 0
}

const getStatusClass = (message: PendingMessage) => {
  if (!message.can_recall) {return 'status-expired'}
  if (isNearSendTime(message)) {return 'status-sending'}
  return 'status-pending'
}

const getStatusText = (message: PendingMessage) => {
  if (!message.can_recall) {return '即將發送'}
  if (isNearSendTime(message)) {return '發送中'}
  return '待發送'
}

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const getCountdown = (scheduledTime: string) => {
  const sendTime = new Date(scheduledTime)
  const now = new Date()
  const diff = sendTime.getTime() - now.getTime()
  
  if (diff <= 0) {return '即將發送'}
  
  const minutes = Math.floor(diff / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  
  if (minutes > 0) {
    return `${minutes}分${seconds}秒`
  }
  return `${seconds}秒`
}

const loadPendingMessages = async (page = 1) => {
  if (!currentAgent.value) {return}
  
  loading.value = true
  
  try {
    const response = await apiClient.get(`/messages/pending?page=${page}&pageSize=${pageSize.value}`)
    
    if (response.success) {
      interface PendingMessagesResponse {
        items?: Array<unknown>
        total?: number
      }
      
      const data = response.data as PendingMessagesResponse
      messages.value = (data?.items as PendingMessage[]) || []
      totalCount.value = data?.total || 0
      currentPage.value = page
    } else {
      console.error('Load pending messages failed:', response.error)
    }
  } catch (error) {
    console.error('Load pending messages error:', error)
  } finally {
    loading.value = false
  }
}

const refreshList = () => {
  loadPendingMessages(currentPage.value)
}

const changePage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    loadPendingMessages(page)
  }
}

const recallMessage = (message: PendingMessage) => {
  selectedMessage.value = message
  showRecallModal.value = true
}

const confirmRecall = async () => {
  if (!selectedMessage.value || !currentAgent.value) {return}
  
  recallingMessageId.value = selectedMessage.value.id
  
  try {
    const response = await apiClient.post('/messages/recall', {
      messageId: selectedMessage.value.id,
      userId: currentAgent.value.id
    })
    
    if (response.success) {
      // 從列表中移除已撤回的訊息
      if (selectedMessage.value) {
        messages.value = messages.value.filter(m => m.id !== selectedMessage.value?.id)
      }
      totalCount.value = Math.max(0, totalCount.value - 1)
      
      if (selectedMessage.value) {
        emit('message-recalled', selectedMessage.value.id)
      }
      showRecallModal.value = false
      selectedMessage.value = null
    } else {
      console.error('Recall message failed:', response.error)
      showError('撤回失敗', response.error || '請稍後再試')
    }
  } catch (error) {
    console.error('Recall message error:', error)
    showError('網路錯誤', '請檢查連線狀態')
  } finally {
    recallingMessageId.value = null
  }
}

const viewDetails = (message: PendingMessage) => {
  // 可以實現訊息詳情查看功能
  console.log('View message details:', message)
}

const startCountdownTimer = () => {
  countdownTimer = window.setInterval(() => {
    // 強制更新倒計時顯示
    if (messages.value.length > 0) {
      // 檢查是否有訊息需要更新狀態
      const needsRefresh = messages.value.some(message => {
        const sendTime = new Date(message.scheduled_send_time)
        const now = new Date()
        return message.can_recall && now >= sendTime
      })
      
      if (needsRefresh) {
        refreshList()
      }
    }
  }, 1000)
}

const stopCountdownTimer = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

onMounted(() => {
  loadPendingMessages()
  startCountdownTimer()
})

onUnmounted(() => {
  stopCountdownTimer()
})
</script>

<style scoped>
.pending-messages-list {
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
  overflow: hidden;
}

.list-header {
  padding: var(--space-6) var(--space-8);
  border-bottom: 1px solid var(--gray-100);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-content {
  flex: 1;
}

.list-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0 0 var(--space-1) 0;
}

.list-subtitle {
  color: var(--gray-600);
  margin: 0;
  font-size: 0.875rem;
}

.header-actions {
  display: flex;
  gap: var(--space-3);
}

.loading-state {
  padding: var(--space-12);
  display: flex;
  justify-content: center;
}

.empty-state {
  padding: var(--space-8);
}

.messages-list {
  max-height: 600px;
  overflow-y: auto;
}

.message-item {
  padding: var(--space-6) var(--space-8);
  border-bottom: 1px solid var(--gray-100);
  display: flex;
  gap: var(--space-6);
  align-items: flex-start;
  transition: all var(--transition-fast);
}

.message-item:hover {
  background: var(--gray-25);
}

.message-item.can-recall {
  border-left: 4px solid var(--yellow-400);
}

.message-item.sending-soon {
  border-left: 4px solid var(--orange-400);
  background: var(--orange-25);
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.conversation-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.message-status .status-badge {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-pending {
  background: var(--yellow-100);
  color: var(--yellow-800);
}

.status-sending {
  background: var(--orange-100);
  color: var(--orange-800);
}

.status-expired {
  background: var(--gray-100);
  color: var(--gray-600);
}

.message-text {
  color: var(--gray-900);
  line-height: 1.5;
  margin-bottom: var(--space-4);
  font-size: 0.875rem;
}

.message-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.timing-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.scheduled-time {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--gray-600);
  font-size: 0.8125rem;
}

.countdown {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.countdown-text {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--orange-600);
  background: var(--orange-50);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
}

.message-actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}

.pagination {
  padding: var(--space-4) var(--space-8);
  border-top: 1px solid var(--gray-100);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-info {
  font-size: 0.875rem;
  color: var(--gray-600);
}

.recall-confirmation {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
}

.warning-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  color: var(--red-500);
}

.confirmation-content {
  flex: 1;
}

.message-preview {
  background: var(--gray-50);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  margin: var(--space-3) 0;
  font-style: italic;
  color: var(--gray-700);
  border-left: 4px solid var(--gray-300);
}

.warning-text {
  color: var(--red-600);
  font-size: 0.875rem;
  margin: var(--space-2) 0 0 0;
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .list-header {
    flex-direction: column;
    gap: var(--space-4);
    align-items: flex-start;
  }
  
  .message-item {
    flex-direction: column;
    gap: var(--space-4);
  }
  
  .message-actions {
    align-self: flex-end;
  }
  
  .pagination {
    flex-direction: column;
    gap: var(--space-3);
    text-align: center;
  }
}
</style>