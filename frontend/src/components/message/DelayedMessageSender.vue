<template>
  <div class="delayed-message-sender">
    <div class="sender-header">
      <h3 class="sender-title">
        <ClockIcon />
        延遲發送訊息
      </h3>
      <p class="sender-subtitle">
        設定延遲時間，可在發送前撤回
      </p>
    </div>

    <form
      class="sender-form"
      @submit.prevent="sendDelayedMessage"
    >
      <!-- 收件人選擇 -->
      <div class="form-group">
        <label class="form-label">收件人</label>
        <select 
          v-model="formData.conversationId" 
          class="form-select"
          :disabled="loading"
          required
        >
          <option value="">
            選擇對話
          </option>
          <option 
            v-for="conversation in conversations" 
            :key="conversation.id" 
            :value="conversation.id"
          >
            {{ conversation.customer?.name || '未知客戶' }} ({{ conversation.platform }})
          </option>
        </select>
      </div>

      <!-- 訊息內容 -->
      <div class="form-group">
        <label class="form-label">訊息內容</label>
        <textarea
          v-model="formData.content"
          class="form-textarea"
          :class="{ 'error': errors.content }"
          placeholder="輸入訊息內容..."
          rows="4"
          :disabled="loading"
          required
        />
        <div
          v-if="errors.content"
          class="error-message"
        >
          {{ errors.content }}
        </div>
      </div>

      <!-- 延遲時間設定 -->
      <div class="form-group">
        <label class="form-label">延遲時間</label>
        <div class="delay-controls">
          <div class="delay-input-group">
            <input
              v-model.number="formData.delaySeconds"
              type="number"
              min="1"
              max="120"
              class="delay-input"
              :disabled="loading"
              required
            >
            <span class="delay-unit">秒</span>
          </div>
          <div class="delay-presets">
            <button
              v-for="preset in delayPresets"
              :key="preset.value"
              type="button"
              class="preset-btn"
              :class="{ 'active': formData.delaySeconds === preset.value }"
              :disabled="loading"
              @click="formData.delaySeconds = preset.value"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- 發送按鈕 -->
      <div class="form-actions">
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="loading || !isValid"
        >
          <HamsterLoader
            v-if="loading"
            message="傳送中..."
          />
          <ClockIcon v-else />
          {{ loading ? '發送中...' : `延遲 ${formData.delaySeconds} 秒發送` }}
        </button>
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="loading"
          @click="resetForm"
        >
          重設
        </button>
      </div>
    </form>

    <!-- 成功/錯誤提示 -->
    <div
      v-if="result"
      class="result-message"
      :class="result.success ? 'success' : 'error'"
    >
      <div class="result-icon">
        <CheckIcon v-if="result.success" />
        <XCircleIcon v-else />
      </div>
      <div class="result-content">
        <div class="result-title">
          {{ result.success ? '延遲訊息已排程' : '發送失敗' }}
        </div>
        <div class="result-description">
          {{ result.message }}
        </div>
        <div
          v-if="result.success && result.messageId"
          class="result-actions"
        >
          <button
            class="btn btn-sm btn-outline"
            @click="$emit('view-pending', result.messageId)"
          >
            查看待發送訊息
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useConversations } from '@/composables'
import { ClockIcon, CheckIcon, XCircleIcon } from '@/components/icons'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import { messagesApi, type DelayedMessageResponse } from '@/api/messages'

interface DelayedMessageForm {
  conversationId: string
  content: string
  delaySeconds: number
}

interface DelayedMessageResult {
  success: boolean
  message: string
  messageId?: string
  scheduledSendTime?: string
  recallDeadline?: string
}

const emit = defineEmits<{
  'view-pending': [messageId: string]
  'message-sent': [result: DelayedMessageResult]
}>()

const { conversations, refreshConversations } = useConversations()

const loading = ref(false)
const result = ref<DelayedMessageResult | null>(null)

const formData = ref<DelayedMessageForm>({
  conversationId: '',
  content: '',
  delaySeconds: 30
})

const errors = ref<Partial<Record<keyof DelayedMessageForm, string>>>({})

const delayPresets = [
  { label: '30秒', value: 30 },
  { label: '1分鐘', value: 60 },
  { label: '2分鐘', value: 120 },
  { label: '5分鐘', value: 300 }
]

const isValid = computed(() => {
  return formData.value.conversationId && 
         formData.value.content.trim() && 
         formData.value.delaySeconds >= 1 && 
         formData.value.delaySeconds <= 120
})

const validateForm = () => {
  errors.value = {}
  
  if (!formData.value.content.trim()) {
    errors.value.content = '請輸入訊息內容'
  } else if (formData.value.content.length > 1000) {
    errors.value.content = '訊息內容不能超過1000字元'
  }
  
  return Object.keys(errors.value).length === 0
}

const sendDelayedMessage = async () => {
  if (!validateForm()) {return}
  
  loading.value = true
  result.value = null
  
  try {
    interface ConversationType {
      id: string
      assignedAgentId?: string
      customer?: { platformId?: string }
      platform?: string
    }
    
    const selectedConversation = conversations.value?.find((c: ConversationType) => c.id === formData.value.conversationId)
    if (!selectedConversation) {
      throw new Error('找不到選擇的對話')
    }

    if (selectedConversation.platform !== 'line' && selectedConversation.platform !== 'facebook') {
      throw new Error('不支援的訊息平台')
    }

    if (!selectedConversation.customer?.platformId) {
      throw new Error('找不到客戶平台識別碼')
    }

    const response = await messagesApi.sendDelayedMessage({
      conversationId: formData.value.conversationId,
      content: formData.value.content.trim(),
      delaySeconds: formData.value.delaySeconds,
      messageType: 'text',
      senderId: selectedConversation.assignedAgentId, // 當前客服ID
      recipientPlatformId: selectedConversation.customer?.platformId,
      platform: selectedConversation.platform
    })

    if (response.success) {
      const data = response.data as DelayedMessageResponse
      result.value = {
        success: true,
        message: `訊息將在 ${formData.value.delaySeconds} 秒後發送，撤回截止時間：${new Date(data?.recallDeadline || Date.now()).toLocaleTimeString()}`,
        messageId: data?.messageId,
        scheduledSendTime: data?.scheduledSendTime,
        recallDeadline: data?.recallDeadline
      }
      
      if (result.value) {
        emit('message-sent', result.value)
      }
      resetForm()
    } else {
      result.value = {
        success: false,
        message: response.error || '發送失敗，請稍後再試'
      }
    }
  } catch (error) {
    console.error('Send delayed message error:', error)
    result.value = {
      success: false,
      message: '網路錯誤，請檢查連線狀態'
    }
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  formData.value = {
    conversationId: '',
    content: '',
    delaySeconds: 30
  }
  errors.value = {}
  result.value = null
}

onMounted(() => {
  if (!conversations.value?.length) {
    refreshConversations()
  }
})
</script>

<style scoped>
.delayed-message-sender {
  background: white;
  border-radius: var(--radius-2xl);
  padding: var(--space-8);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
}

.sender-header {
  margin-bottom: var(--space-8);
  text-align: center;
}

.sender-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0 0 var(--space-2) 0;
}

.sender-subtitle {
  color: var(--gray-600);
  margin: 0;
  font-size: 0.875rem;
}

.sender-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-label {
  font-weight: 600;
  color: var(--gray-900);
  font-size: 0.875rem;
}

.form-select,
.form-textarea {
  width: 100%;
  padding: var(--space-3);
  border: 2px solid var(--gray-200);
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  transition: all var(--transition-fast);
  background: white;
}

.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.form-textarea.error {
  border-color: var(--red-500);
  background: var(--red-50);
}

.delay-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.delay-input-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  max-width: 200px;
}

.delay-input {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border: 2px solid var(--gray-200);
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  text-align: center;
}

.delay-input:focus {
  outline: none;
  border-color: var(--primary-500);
}

.delay-unit {
  font-size: 0.875rem;
  color: var(--gray-600);
  font-weight: 500;
}

.delay-presets {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.preset-btn {
  padding: var(--space-2) var(--space-4);
  border: 2px solid var(--gray-200);
  border-radius: var(--radius-lg);
  background: white;
  color: var(--gray-700);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.preset-btn:hover {
  border-color: var(--primary-300);
  background: var(--primary-50);
}

.preset-btn.active {
  border-color: var(--primary-500);
  background: var(--primary-500);
  color: white;
}

.preset-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-actions {
  display: flex;
  gap: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--gray-100);
}

.result-message {
  margin-top: var(--space-6);
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}

.result-message.success {
  background: var(--green-50);
  border: 1px solid var(--green-200);
  color: var(--green-800);
}

.result-message.error {
  background: var(--red-50);
  border: 1px solid var(--red-200);
  color: var(--red-800);
}

.result-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 2px;
}

.result-content {
  flex: 1;
}

.result-title {
  font-weight: 600;
  margin-bottom: var(--space-1);
}

.result-description {
  font-size: 0.875rem;
  line-height: 1.4;
  margin-bottom: var(--space-3);
}

.result-actions {
  display: flex;
  gap: var(--space-2);
}

.error-message {
  color: var(--red-600);
  font-size: 0.8125rem;
  margin-top: var(--space-1);
}

@media (max-width: 768px) {
  .delayed-message-sender {
    padding: var(--space-6);
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .delay-presets {
    justify-content: center;
  }
}
</style>
