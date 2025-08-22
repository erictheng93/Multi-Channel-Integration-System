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
          <button
            class="action-btn"
            type="button"
            :disabled="disabled || false"
            title="Emoji"
            @click="toggleEmojiPicker"
          >
            <SmileIcon />
          </button>
          
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
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { messageApi } from '@/api/message'
import { 
  SendIcon, 
  SmileIcon, 
  PaperclipIcon, 
  FileIcon, 
  XIcon,
  LoadingIcon 
} from '@/components/icons'

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

// Refs
const textareaRef = ref<HTMLTextAreaElement>()
const fileInputRef = ref<HTMLInputElement>()

// State
const messageText = ref('')
const attachments = ref<Attachment[]>([])
const sending = ref(false)
const error = ref('')

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
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

const sendMessage = async () => {
  if (!canSend.value || sending.value) {return}
  
  const content = messageText.value.trim()
  const currentAttachments = [...attachments.value]
  
  if (!content && currentAttachments.length === 0) {return}
  
  sending.value = true
  error.value = ''
  
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
      
      // Emit success event
      emit('message-sent', {
        content,
        attachments: currentAttachments
      })
    } else {
      error.value = (response.error as { message?: string })?.message || 'Send failed'
    }
  } catch (err) {
    console.error('Send message error:', err)
    error.value = 'Network error, please try again'
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
  // TODO: Implement emoji picker
  error.value = 'Emoji function not implemented yet'
  setTimeout(() => {
    error.value = ''
  }, 3000)
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

// Auto-resize on mount
nextTick(() => {
  autoResize()
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
  padding: var(--space-2) var(--space-3);
  background: var(--red-50);
  border: 1px solid var(--red-200);
  border-radius: var(--radius-md);
  color: var(--red-700);
  font-size: 0.875rem;
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

@media (max-width: 768px) {
  .input-container {
    padding: var(--space-2);
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
}
</style>