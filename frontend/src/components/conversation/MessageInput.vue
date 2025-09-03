<template>
  <div class="message-input">
    <div class="input-container">
      <div class="input-wrapper">
        <textarea
          ref="textareaRef"
          v-model="messageText"
          placeholder="Type a message..."
          class="message-textarea"
          :disabled="disabled || sending"
          rows="1"
          @keydown="handleKeydown"
          @input="handleInput"
        />
        
        <div class="input-actions">
          <div class="emoji-picker-container">
            <button
              class="action-btn"
              type="button"
              :disabled="disabled || false"
              title="Emoji"
              @click="toggleEmojiPicker"
            >
              <SmileIcon />
            </button>
            
            <div
              v-if="showEmojiPicker"
              class="emoji-picker-popup"
            >
              <EmojiPicker @emoji-select="insertEmoji" />
            </div>
          </div>
          
          <button
            class="action-btn"
            type="button"
            :disabled="disabled || false"
            title="Attachment"
            @click="triggerFileUpload"
          >
            <PaperclipIcon />
          </button>
        </div>
      </div>
      
      <button
        :disabled="!canSend || sending"
        class="send-button"
        :class="{ 'sending': sending }"
        @click="sendMessage"
      >
        <SendIcon v-if="!sending" />
        <LoadingIcon
          v-else
          class="animate-spin"
        />
      </button>
    </div>
    
    <!-- File upload input -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
      accept="image/*,application/pdf,.doc,.docx"
      class="file-input"
      @change="handleFileSelect"
    >
    
    <!-- Attachments preview -->
    <div
      v-if="attachments.length > 0"
      class="attachments-preview"
    >
      <div
        v-for="(attachment, index) in attachments"
        :key="index"
        class="attachment-item"
      >
        <div class="attachment-info">
          <FileIcon />
          <span class="attachment-name">{{ attachment.name }}</span>
          <span class="attachment-size">({{ formatFileSize(attachment.size) }})</span>
        </div>
        <button
          class="remove-attachment"
          type="button"
          @click="removeAttachment(index)"
        >
          <XIcon />
        </button>
      </div>
    </div>
    
    <!-- Error message -->
    <div
      v-if="error"
      class="error-message"
    >
      <div class="error-content">
        <XCircleIcon class="error-icon" />
        <span>{{ error }}</span>
      </div>
      <button
        class="error-close"
        @click="error = ''"
      >
        <XIcon />
      </button>
    </div>
    
    <!-- Success message -->
    <div
      v-if="successMessage"
      class="success-message"
    >
      <div class="success-content">
        <CheckCircleIcon class="success-icon" />
        <span>{{ successMessage }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { messageApi } from '@/api/message'
import { 
  SendIcon, 
  SmileIcon, 
  PaperclipIcon, 
  FileIcon, 
  XIcon,
  LoadingIcon,
  XCircleIcon,
  CheckCircleIcon
} from '@/components/icons'
import EmojiPicker from '@/components/ui/EmojiPicker.vue'

interface Props {
  conversationId: string
  disabled?: boolean
}

interface Attachment {
  name: string
  size: number
  file: File
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'message-sent': [data: { content: string; attachments: Attachment[] }]
  'attachment-upload': [attachment: Attachment]
}>()

// defineExpose moved to end of script section

// Refs
const textareaRef = ref<HTMLTextAreaElement>()
const fileInputRef = ref<HTMLInputElement>()

// State
const messageText = ref('')
const attachments = ref<Attachment[]>([])
const sending = ref(false)
const error = ref('')
const successMessage = ref('')
const showEmojiPicker = ref(false)

// Computed
const canSend = computed(() => {
  return (messageText.value.trim().length > 0 || attachments.value.length > 0) && !props.disabled
})

// Methods
const handleInput = () => {
  error.value = ''
  autoResize()
}

const autoResize = () => {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    textareaRef.value.style.height = `${Math.min(textareaRef.value.scrollHeight, 120)  }px`
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  // Esc 鍵 - 清空輸入或關閉表情選擇器
  if (event.key === 'Escape') {
    event.preventDefault()
    if (showEmojiPicker.value) {
      showEmojiPicker.value = false
    } else if (messageText.value.trim()) {
      messageText.value = ''
      autoResize()
    }
    return
  }

  // Enter 鍵處理
  if (event.key === 'Enter') {
    // Shift+Enter - 換行
    if (event.shiftKey) {
      // 允許默認行為（換行）
      return
    }
    
    // Ctrl+Enter 或 Cmd+Enter - 發送消息
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      sendMessage()
      return
    }
    
    // 普通 Enter - 發送消息
    event.preventDefault()
    sendMessage()
    return
  }

  // Ctrl/Cmd + A - 全選文本
  if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
    // 允許默認行為
    return
  }

  // Ctrl/Cmd + Z - 撤銷
  if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
    // 允許默認行為
    return
  }

  // 上/下箭頭 - 瀏覽消息歷史（如果輸入框為空）
  if (!messageText.value.trim() && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault()
    // TODO: 實現消息歷史瀏覽功能
    console.log(`Message history navigation: ${event.key}`)
    return
  }
}

const sendMessage = async () => {
  if (!canSend.value || sending.value) {return}
  
  const content = messageText.value.trim()
  const currentAttachments = [...attachments.value]
  
  if (!content && currentAttachments.length === 0) {return}
  
  sending.value = true
  error.value = ''
  successMessage.value = ''
  
  try {
    const attachmentIds: string[] = []
    
    // Upload attachments first if any
    if (currentAttachments.length > 0) {
      for (const attachment of currentAttachments) {
        try {
          const uploadResponse = await messageApi.uploadAttachment(props.conversationId, {
            file: attachment.file,
            messageType: attachment.file.type.startsWith('image/') ? 'image' : 'file'
          })
          
          if (uploadResponse.success && uploadResponse.data) {
            attachmentIds.push(uploadResponse.data.url) // 使用 URL 作為標識符
          } else {
            throw new Error(uploadResponse.error || 'File upload failed')
          }
        } catch (uploadError) {
          console.error('Attachment upload error:', uploadError)
          error.value = `File ${attachment.name} upload failed`
          return
        }
      }
    }
    
    // Send message with attachment IDs
    const response = await messageApi.send(props.conversationId, {
      content,
      messageType: currentAttachments.length > 0 ? 'file' : 'text',
      platform: 'line',
      attachmentIds
    })
    
    if (response.success) {
      // Clear input
      messageText.value = ''
      attachments.value = []
      
      // Reset textarea height
      await nextTick()
      autoResize()
      
      // Show success message
      successMessage.value = '訊息發送成功'
      setTimeout(() => {
        successMessage.value = ''
      }, 3000)
      
      // Emit success event
      emit('message-sent', {
        content,
        attachments: currentAttachments
      })
    } else {
      const errorMsg = (response.error as { message?: string })?.message || '發送失敗'
      error.value = errorMsg
      
      // 提供重試建議
      if (errorMsg.includes('網路')) {
        error.value += ' - 請檢查網路連接後重試'
      }
    }
  } catch (err) {
    console.error('Send message error:', err)
    
    // 根據錯誤類型提供不同的提示
    if (err instanceof TypeError && err.message.includes('fetch')) {
      error.value = '網路連接失敗，請檢查網路後重試'
    } else if (err instanceof Error) {
      error.value = `發送失敗：${err.message}`
    } else {
      error.value = '發送失敗，請重試'
    }
  } finally {
    sending.value = false
  }
}

const triggerFileUpload = () => {
  fileInputRef.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files
  
  if (!files) {return}
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    
    if (!file) {continue}
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      error.value = `File ${file.name} exceeds 10MB limit`
      continue
    }
    
    const attachment: Attachment = {
      name: file.name,
      size: file.size,
      file
    }
    
    attachments.value.push(attachment)
    emit('attachment-upload', attachment)
  }
  
  // Clear input
  target.value = ''
}

const removeAttachment = (index: number) => {
  attachments.value.splice(index, 1)
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) {return '0 B'}
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))  } ${  sizes[i]}`
}

const toggleEmojiPicker = () => {
  showEmojiPicker.value = !showEmojiPicker.value
}

const insertEmoji = (emoji: string) => {
  const textarea = textareaRef.value
  if (!textarea) {return}

  const startPos = textarea.selectionStart
  const endPos = textarea.selectionEnd
  const textBefore = messageText.value.substring(0, startPos)
  const textAfter = messageText.value.substring(endPos)

  messageText.value = textBefore + emoji + textAfter

  // 關閉表情選擇器
  showEmojiPicker.value = false

  // 將光標定位到插入的表情符號後面
  nextTick(() => {
    if (textarea) {
      const newPos = startPos + emoji.length
      textarea.setSelectionRange(newPos, newPos)
      textarea.focus()
      autoResize()
    }
  })
}

// 外部調用的快速發送消息方法
const sendQuickMessage = async (quickText: string) => {
  if (!quickText.trim() || sending.value) {return false}
  
  // 設置消息內容
  messageText.value = quickText.trim()
  
  // 等待下一幀更新完成
  await nextTick()
  
  // 發送消息
  await sendMessage()
  
  return true
}

// Watch for prop changes
watch(() => props.conversationId, () => {
  // Clear input when conversation changes
  messageText.value = ''
  attachments.value = []
  error.value = ''
  
  nextTick(() => {
    autoResize()
  })
})

// 點擊外部關閉表情選擇器
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Element
  if (showEmojiPicker.value && !target.closest('.emoji-picker-container')) {
    showEmojiPicker.value = false
  }
}

// 生命周期管理
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  autoResize()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// 暴露方法給父組件調用
defineExpose({
  sendQuickMessage,
  focus: () => textareaRef.value?.focus()
})
</script>

<style scoped>
.message-input {
  max-width: 800px;
  margin: 0 auto;
}

.input-container {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  background: white;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-xl);
  padding: var(--space-3);
  box-shadow: var(--shadow-sm);
}

.input-wrapper {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
}

.message-textarea {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  font-size: 0.875rem;
  line-height: 1.5;
  padding: var(--space-2) 0;
  background: transparent;
  color: var(--gray-900);
  min-height: 20px;
  max-height: 120px;
}

.message-textarea::placeholder {
  color: var(--gray-400);
}

.message-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.input-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.emoji-picker-container {
  position: relative;
}

.emoji-picker-popup {
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: var(--space-2);
  z-index: 1000;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  color: var(--gray-500);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.action-btn:hover:not(:disabled) {
  background: var(--gray-100);
  color: var(--gray-700);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn svg {
  width: 18px;
  height: 18px;
}

.send-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--primary-500);
  color: white;
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.send-button:hover:not(:disabled) {
  background: var(--primary-600);
  transform: scale(1.05);
}

.send-button:disabled {
  background: var(--gray-300);
  cursor: not-allowed;
  transform: none;
}

.send-button.sending {
  background: var(--primary-400);
}

.send-button svg {
  width: 18px;
  height: 18px;
}

.file-input {
  display: none;
}

.attachments-preview {
  margin-top: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.attachment-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
}

.attachment-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.attachment-info svg {
  width: 16px;
  height: 16px;
  color: var(--gray-500);
  flex-shrink: 0;
}

.attachment-name {
  font-size: 0.875rem;
  color: var(--gray-900);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-size {
  font-size: 0.75rem;
  color: var(--gray-500);
  flex-shrink: 0;
}

.remove-attachment {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  color: var(--gray-400);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.remove-attachment:hover {
  background: var(--red-100);
  color: var(--red-600);
}

.remove-attachment svg {
  width: 14px;
  height: 14px;
}

.error-message {
  margin-top: var(--space-2);
  padding: var(--space-3);
  background: var(--red-50);
  border: 1px solid var(--red-200);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.error-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--red-700);
}

.error-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.error-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: none;
  color: var(--red-500);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.error-close:hover {
  background: var(--red-100);
  color: var(--red-700);
}

.error-close svg {
  width: 12px;
  height: 12px;
}

.success-message {
  margin-top: var(--space-2);
  padding: var(--space-3);
  background: var(--green-50);
  border: 1px solid var(--green-200);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  animation: slideIn 0.3s ease-out;
}

.success-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--green-700);
}

.success-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 平板設備優化 */
@media (max-width: 1024px) {
  .message-input {
    max-width: none;
    margin: 0;
  }

  .emoji-picker-popup {
    right: auto;
    left: 0;
  }
}

@media (max-width: 768px) {
  .input-container {
    padding: var(--space-2);
    gap: var(--space-2);
  }

  .message-textarea {
    font-size: 1rem; /* iOS 防縮放 */
    min-height: 22px;
    padding: var(--space-2) 0;
  }
  
  .send-button {
    width: 36px;
    height: 36px;
  }
  
  .send-button svg {
    width: 16px;
    height: 16px;
  }
  
  .action-btn {
    width: 28px;
    height: 28px;
  }
  
  .action-btn svg {
    width: 16px;
    height: 16px;
  }

  .emoji-picker-popup {
    position: fixed;
    bottom: 60px;
    left: var(--space-2);
    right: var(--space-2);
    margin-bottom: 0;
    z-index: 9999;
  }

  .attachments-preview {
    margin-top: var(--space-2);
  }

  .attachment-item {
    padding: var(--space-2);
  }

  .attachment-name {
    font-size: 0.75rem;
  }

  .attachment-size {
    font-size: 0.625rem;
  }

  .error-message,
  .success-message {
    padding: var(--space-2);
    font-size: 0.75rem;
  }
}

/* 小屏設備進一步優化 */
@media (max-width: 480px) {
  .input-container {
    padding: var(--space-1) var(--space-2);
  }

  .input-actions {
    gap: 2px;
  }

  .action-btn {
    width: 24px;
    height: 24px;
  }

  .action-btn svg {
    width: 14px;
    height: 14px;
  }

  .send-button {
    width: 32px;
    height: 32px;
  }

  .send-button svg {
    width: 14px;
    height: 14px;
  }

  /* 確保表情選擇器不會被虛擬鍵盤遮蓋 */
  .emoji-picker-popup {
    bottom: 50px;
    left: var(--space-1);
    right: var(--space-1);
  }
}

/* 觸摸設備優化 */
@media (pointer: coarse) {
  .action-btn {
    min-width: 44px;
    min-height: 44px;
  }

  .send-button {
    min-width: 44px;
    min-height: 44px;
  }

  .quick-reply-btn {
    min-height: 44px;
  }

  .remove-attachment {
    min-width: 32px;
    min-height: 32px;
  }

  .error-close {
    min-width: 28px;
    min-height: 28px;
  }
}
</style>