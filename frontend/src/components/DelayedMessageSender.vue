<template>
  <div class="delayed-message-sender">
    <!-- 訊息輸入區域 -->
    <div class="message-input-container">
      <div class="input-group">
        <textarea
          v-model="messageContent"
          class="message-input"
          placeholder="輸入訊息內容..."
          rows="3"
          @keydown.enter.exact.prevent="sendMessage"
          @keydown.enter.shift.exact="addNewLine"
        />
        <div class="input-actions">
          <button
            class="btn btn-primary"
            :disabled="!canSend"
            @click="sendMessage"
          >
            立即發送
          </button>
          <button
            class="btn btn-secondary"
            :class="{ active: showDelayOptions }"
            @click="showDelayOptions = !showDelayOptions"
          >
            延遲發送
          </button>
        </div>
      </div>

      <!-- 延遲發送選項 -->
      <div
        v-if="showDelayOptions"
        class="delay-options"
      >
        <div class="delay-controls">
          <label class="delay-label">延遲時間：</label>

          <!-- 主要選擇方式：下拉選擇框 + 自訂選項 -->
          <div class="delay-selector-group">
            <select
              v-model="selectedDelayOption"
              class="delay-select"
              @change="handleDelayOptionChange"
            >
              <option
                v-for="preset in delayPresets"
                :key="preset.value"
                :value="preset.value"
              >
                {{ preset.label }}
              </option>
              <option value="custom">
                自訂時間...
              </option>
            </select>

            <!-- 自訂輸入框（當選擇自訂時顯示） -->
            <div
              v-if="selectedDelayOption === 'custom'"
              class="custom-input-group"
            >
              <input
                v-model.number="customDelaySeconds"
                type="number"
                min="1"
                max="120"
                class="custom-delay-input"
                placeholder="輸入秒數"
                @input="validateCustomDelay"
                @blur="applyCustomDelay"
              >
              <span class="delay-unit">秒</span>
            </div>
          </div>

          <!-- 快速選擇按鈕（保留作為輔助選項） -->
          <div class="quick-delay-buttons">
            <button
              v-for="preset in quickPresets"
              :key="preset.value"
              class="quick-delay-btn"
              :class="{ active: delaySeconds === preset.value }"
              @click="setQuickDelay(preset.value)"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>

        <div class="delay-actions">
          <button
            class="btn btn-warning"
            :disabled="!canSendDelayed"
            @click="sendDelayedMessage"
          >
            <i class="icon-clock" />
            延遲 {{ delaySeconds }} 秒發送
          </button>
          <button
            class="btn btn-link"
            @click="showDelayOptions = false"
          >
            取消
          </button>
        </div>

        <div
          v-if="delaySeconds > 0"
          class="delay-info"
        >
          <small class="text-muted">
            訊息將在 {{ formatScheduledTime }} 發送，在此之前可以撤回
          </small>
        </div>
      </div>
    </div>

    <!-- 待發送訊息列表 -->
    <div
      v-if="pendingMessages.length > 0"
      class="pending-messages"
    >
      <h4 class="pending-title">
        <i class="icon-clock" />
        待發送訊息 ({{ pendingMessages.length }})
      </h4>

      <div class="pending-list">
        <div
          v-for="message in pendingMessages"
          :key="message.id"
          class="pending-message-item"
        >
          <div class="message-content">
            <p class="content-text">
              {{ message.content }}
            </p>
            <div class="message-meta">
              <span class="scheduled-time">
                <i class="icon-clock" />
                {{ formatTime(message.scheduledSendTime) }}
              </span>
              <span
                class="countdown"
                :class="getCountdownClass(message)"
              >
                {{ getCountdown(message) }}
              </span>
            </div>
          </div>

          <div class="message-actions">
            <button
              v-if="message.canRecall"
              class="btn btn-sm btn-danger"
              :disabled="recallingMessages.has(message.id)"
              @click="recallMessage(message.id)"
            >
              <i class="icon-x" />
              {{ recallingMessages.has(message.id) ? '撤回中...' : '撤回' }}
            </button>
            <span
              v-else
              class="status-badge"
              :class="message.status"
            >
              {{ getStatusText(message.status) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDelayedMessage, type PendingMessage } from '../composables/useDelayedMessage'

interface Props {
  conversationId: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'messageSent': [message: { id: string; content: string; delay: number }]
  'messageRecalled': [messageId: string]
}>()

// 組合式函數
const {
  sendDelayedMessage: sendDelayed,
  recallMessage: recall,
  getPendingMessages,
  pendingMessages,
  isLoading
} = useDelayedMessage()

// 響應式數據
const messageContent = ref('')
const showDelayOptions = ref(false)
const delaySeconds = ref(5)
const recallingMessages = ref(new Set<string>())

// 延遲預設選項（下拉選擇框）
const delayPresets = [
  { label: '5秒 (推薦)', value: 5 },
  { label: '10秒', value: 10 },
  { label: '15秒', value: 15 },
  { label: '30秒', value: 30 },
  { label: '60秒', value: 60 },
  { label: '120秒', value: 120 }
]

// 快速選擇按鈕（常用選項）
const quickPresets = [
  { label: '5秒', value: 5 },
  { label: '10秒', value: 10 },
  { label: '15秒', value: 15 },
  { label: '30秒', value: 30 },
  { label: '60秒', value: 60 },
  { label: '120秒', value: 120 }
]

// UI 狀態
const selectedDelayOption = ref<number | 'custom'>(15) // 預設選擇 15 秒
const customDelaySeconds = ref(15)

// 計算屬性
const canSend = computed(() => {
  return messageContent.value.trim().length > 0 && !isLoading.value
})

const canSendDelayed = computed(() => {
  return canSend.value && delaySeconds.value >= 1 && delaySeconds.value <= 120
})

const formatScheduledTime = computed(() => {
  if (delaySeconds.value <= 0) {
    return ''
  }
  const scheduledTime = new Date(Date.now() + delaySeconds.value * 1000)
  return scheduledTime.toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
})

// 定時器
let countdownTimer: NodeJS.Timeout | null = null

// 方法
const validateCustomDelay = () => {
  if (customDelaySeconds.value < 1) {
    customDelaySeconds.value = 1
  }
  if (customDelaySeconds.value > 120) {
    customDelaySeconds.value = 120
  }
}

const handleDelayOptionChange = () => {
  if (selectedDelayOption.value !== 'custom') {
    delaySeconds.value = selectedDelayOption.value as number
  }
}

const applyCustomDelay = () => {
  if (selectedDelayOption.value === 'custom' && customDelaySeconds.value) {
    delaySeconds.value = customDelaySeconds.value
  }
}

const setQuickDelay = (seconds: number) => {
  delaySeconds.value = seconds
  selectedDelayOption.value = seconds
}

const addNewLine = () => {
  messageContent.value += '\n'
}

const sendMessage = async () => {
  if (!canSend.value) {
    return
  }

  try {
    // 這裡調用原有的立即發送邏輯
    emit('messageSent', {
      id: Date.now().toString(),
      content: messageContent.value,
      delay: 0
    })

    messageContent.value = ''
    showDelayOptions.value = false
  } catch (error) {
    console.error('發送訊息失敗:', error)
  }
}

const sendDelayedMessage = async () => {
  if (!canSendDelayed.value) {
    return
  }

  try {
    const result = await sendDelayed({
      conversationId: props.conversationId,
      content: messageContent.value,
      delaySeconds: delaySeconds.value
    })

    if (result.success) {
      messageContent.value = ''
      showDelayOptions.value = false

      // 重新載入待發送訊息列表
      await loadPendingMessages()

      emit('messageSent', {
        id: result.data?.messageId || Date.now().toString(),
        content: messageContent.value,
        delay: delaySeconds.value
      })
    }
  } catch (error) {
    console.error('發送延遲訊息失敗:', error)
  }
}

const recallMessage = async (messageId: string) => {
  if (recallingMessages.value.has(messageId)) {
    return
  }

  recallingMessages.value.add(messageId)

  try {
    const result = await recall(messageId)

    if (result.success) {
      // 重新載入待發送訊息列表
      await loadPendingMessages()
      emit('messageRecalled', messageId)
    }
  } catch (error) {
    console.error('撤回訊息失敗:', error)
  } finally {
    recallingMessages.value.delete(messageId)
  }
}

const loadPendingMessages = async () => {
  try {
    await getPendingMessages(props.conversationId)
  } catch (error) {
    console.error('載入待發送訊息失敗:', error)
  }
}

const formatTime = (timeString: string) => {
  return new Date(timeString).toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const getCountdown = (message: PendingMessage) => {
  const now = Date.now()
  const scheduledTime = new Date(message.scheduledSendTime).getTime()
  const remaining = Math.max(0, scheduledTime - now)

  if (remaining === 0) {
    return '即將發送'
  }

  const seconds = Math.ceil(remaining / 1000)
  if (seconds < 60) {
    return `${seconds}秒後發送`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}分${remainingSeconds}秒後發送`
}

const getCountdownClass = (message: PendingMessage) => {
  const now = Date.now()
  const scheduledTime = new Date(message.scheduledSendTime).getTime()
  const remaining = scheduledTime - now

  if (remaining <= 5000) {
    return 'urgent' // 5秒內
  }
  if (remaining <= 15000) {
    return 'warning' // 15秒內
  }
  return 'normal'
}

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: '待發送',
    sent: '已發送',
    cancelled: '已撤回',
    failed: '發送失敗'
  }
  return statusMap[status] || status
}

const startCountdownTimer = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }

  countdownTimer = setInterval(() => {
    // 觸發重新計算倒數時間
    // Vue 的響應式系統會自動更新 UI
  }, 1000)
}

const stopCountdownTimer = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

// 初始化延遲時間
const initializeDelayTime = () => {
  delaySeconds.value = 15
  selectedDelayOption.value = 15
  customDelaySeconds.value = 15
}

// 生命週期
onMounted(() => {
  initializeDelayTime()
  loadPendingMessages()
  startCountdownTimer()
})

onUnmounted(() => {
  stopCountdownTimer()
})

// 監聽對話 ID 變化
watch(() => props.conversationId, () => {
  loadPendingMessages()
})

// 監聽待發送訊息變化，自動啟動/停止定時器
watch(() => pendingMessages.value.length, (newLength) => {
  if (newLength > 0) {
    startCountdownTimer()
  } else {
    stopCountdownTimer()
  }
})
</script>

<style scoped>
.delayed-message-sender {
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  background: #fff;
}

.message-input-container {
  padding: 16px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  resize: vertical;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
}

.message-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn {
  padding: 8px 16px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
}

.btn-secondary.active {
  background: #374151;
}

.btn-warning {
  background: #f59e0b;
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background: #d97706;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.btn-link {
  background: transparent;
  color: #6b7280;
  border: none;
}

.btn-link:hover {
  color: #374151;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.delay-options {
  margin-top: 16px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.delay-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.delay-label {
  font-weight: 500;
  color: #374151;
}

.delay-selector-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.delay-select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.delay-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.custom-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px;
  background: #f3f4f6;
  border-radius: 4px;
}

.custom-delay-input {
  width: 80px;
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  text-align: center;
  font-size: 14px;
}

.custom-delay-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.delay-unit {
  color: #6b7280;
  font-size: 14px;
}

.quick-delay-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.quick-delay-btn {
  padding: 4px 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  color: #374151;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-delay-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.quick-delay-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.delay-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.delay-info {
  margin-top: 8px;
}

.text-muted {
  color: #6b7280;
}

.pending-messages {
  border-top: 1px solid #e5e7eb;
  padding: 16px;
  background: #fafafa;
}

.pending-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pending-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pending-message-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.message-content {
  flex: 1;
  margin-right: 12px;
}

.content-text {
  margin: 0 0 8px 0;
  color: #374151;
  line-height: 1.4;
}

.message-meta {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 12px;
}

.scheduled-time {
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 4px;
}

.countdown {
  font-weight: 500;
}

.countdown.normal {
  color: #059669;
}

.countdown.warning {
  color: #d97706;
}

.countdown.urgent {
  color: #dc2626;
  animation: pulse 1s infinite;
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.7;
  }
}

.message-actions {
  display: flex;
  align-items: center;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.sent {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.cancelled {
  background: #fee2e2;
  color: #991b1b;
}

.status-badge.failed {
  background: #fef2f2;
  color: #b91c1c;
}

.icon-clock::before {
  content: '⏰';
}

.icon-x::before {
  content: '✕';
}
</style>