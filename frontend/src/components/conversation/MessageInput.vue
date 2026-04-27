<template>
  <div class="message-input">
    <!-- Reply Reference -->
    <ReplyReferenceBanner
      v-if="replyToMessage"
      :reply-to-message="replyToMessage"
      @clear-reply="clearReply"
    />

    <div class="input-container">
      <div class="input-wrapper">
        <textarea
          ref="textareaRef"
          v-model="messageText"
          placeholder="輸入訊息..."
          class="message-textarea"
          :disabled="disabled"
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
            @click="fileSelection.triggerFileUpload()"
          >
            <PaperclipIcon />
          </button>
        </div>
      </div>

      <button
        class="send-button"
        :class="{ sending }"
        @click="sendMessage"
      >
        <SendIcon />
        <span v-if="!sending">送出</span>
        <LoadingIcon
          v-else
          class="animate-spin loading-icon"
        />
      </button>
    </div>

    <!-- File upload input -->
    <input
      :ref="fileSelection.fileInputRef"
      type="file"
      multiple
      accept="image/*,application/pdf,.doc,.docx"
      class="file-input"
      @change="fileSelection.handleFileSelect($event)"
    >

    <!-- Attachments preview -->
    <AttachmentPreviewCards
      v-if="attachments.length > 0"
      :attachments="attachments"
      @remove-attachment="fileSelection.removeAttachment($event)"
    />

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
import { createLogger } from '@/utils/logger'

const props = defineProps<Props>()
  const emit = defineEmits<{
    'message-sent': [data: {
      content: string
      attachments: MessageInputAttachment[]
      file_attachments?: FileAttachmentEmitData[]
    }]
    'message-pending': [data: {
      tempId: string
      correlationId?: string
      content: string
      attachments: MessageInputAttachment[]
      status: 'uploading' | 'sending'
      uploadProgress?: number
    }]
    'upload-progress': [data: {
      tempId: string
      correlationId?: string
      progress: number
      status: 'uploading' | 'sending'
    }]
    'message-confirmed': [data: {
      tempId: string
      correlationId?: string
      realId: string
      file_attachments?: FileAttachmentEmitData[]
    }]
    'message-failed': [data: {
      tempId: string
      correlationId?: string
      error: string
      retryData?: {
        content: string
        attachments: MessageInputAttachment[]
      }
    }]
    'attachment-upload': [attachment: MessageInputAttachment]
  }>()
  const frontendLogger = createLogger('MessageInput')
  import { ref, nextTick, watch, onMounted, onUnmounted, toRef } from 'vue'
  import {
    SendIcon,
    SmileIcon,
    PaperclipIcon,
    XIcon,
    LoadingIcon,
    XCircleIcon,
    CheckCircleIcon,
  } from '@/components/icons'
  import EmojiPicker from '@/components/ui/EmojiPicker.vue'
  import ReplyReferenceBanner from './input/ReplyReferenceBanner.vue'
  import AttachmentPreviewCards from './input/AttachmentPreviewCards.vue'

  // Composables
  import { useFileTypeDetection } from '@/composables/message-input/useFileTypeDetection'
  import { useFileSelection } from '@/composables/message-input/useFileSelection'
  import { useFileUploadProgress } from '@/composables/message-input/useFileUploadProgress'
  import { useMessageSending } from '@/composables/message-input/useMessageSending'

  // Types (re-export for backward compat with tests that access internal types)
  import type { MessageInputAttachment, FileAttachmentEmitData } from '@/types/message-input'

  // ═══════════════════════════════════════════════════════════════════
  // Props & Emits
  // ═══════════════════════════════════════════════════════════════════

  interface Props {
    conversationId: string
    disabled?: boolean
  }

  // ═══════════════════════════════════════════════════════════════════
  // Composable setup
  // ═══════════════════════════════════════════════════════════════════

  const { formatFileSize } = useFileTypeDetection()

  const error = ref('')
  const successMessage = ref('')

  const fileSelection = useFileSelection({
    onError: (msg) => { error.value = msg },
    onAttachmentAdd: (attachment) => { emit('attachment-upload', attachment) },
  })

  const conversationIdRef = toRef(props, 'conversationId')
  const { uploadAttachmentWithProgress } = useFileUploadProgress(conversationIdRef)

  const messageSending = useMessageSending({
    conversationId: () => props.conversationId,
    uploadAttachment: uploadAttachmentWithProgress,
    emit: emit as never, // The emit signatures are compatible
  })

  // ═══════════════════════════════════════════════════════════════════
  // Local refs — textarea, emoji, reply
  // ═══════════════════════════════════════════════════════════════════

  const textareaRef = ref<globalThis.HTMLTextAreaElement>()

  const messageText = ref('')
  const showEmojiPicker = ref(false)
  const replyToMessage = ref<{ content: string; senderName: string } | null>(null)

  // Top-level ref aliases for template auto-unwrapping
  const sending = messageSending.sending
  const attachments = fileSelection.attachments

  // ═══════════════════════════════════════════════════════════════════
  // Textarea handlers
  // ═══════════════════════════════════════════════════════════════════

  const handleInput = () => {
    error.value = ''
    autoResize()
  }

  const autoResize = () => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
      textareaRef.value.style.height = `${Math.min(textareaRef.value.scrollHeight, 120)}px`
    }
  }

  const handleKeydown = (event: KeyboardEvent) => {
    // Esc — close emoji / clear reply / clear text
    if (event.key === 'Escape') {
      event.preventDefault()
      if (showEmojiPicker.value) {
        showEmojiPicker.value = false
      } else if (replyToMessage.value) {
        replyToMessage.value = null
      } else if (messageText.value.trim()) {
        messageText.value = ''
        autoResize()
      }
      return
    }

    // Enter handling
    if (event.key === 'Enter') {
      // Shift+Enter = newline
      if (event.shiftKey) {
        return
      }
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        sendMessage()
        return
      }
      event.preventDefault()
      sendMessage()
      return
    }

    // Allow default for Ctrl/Cmd+A, Ctrl/Cmd+Z
    if ((event.ctrlKey || event.metaKey) && (event.key === 'a' || event.key === 'z')) {
      return
    }

    // Arrow keys for message history (placeholder)
    if (!messageText.value.trim() && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      frontendLogger.debug(`Message history navigation: ${event.key}`)
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Send message (wrapper that orchestrates composables)
  // ═══════════════════════════════════════════════════════════════════

  const sendMessage = async () => {
    const content = messageText.value.trim()
    const currentAttachments = [...attachments.value]

    if (!content && currentAttachments.length === 0) {
      return
    }

    // Clear UI immediately (optimistic)
    error.value = ''
    successMessage.value = ''
    messageText.value = ''
    fileSelection.clearAttachments()
    replyToMessage.value = null

    await nextTick()
    autoResize()

    try {
      await messageSending.executeSend(content, currentAttachments)
    } catch (err) {
      // Error already emitted to parent by the composable;
      // show inline error in the input area
      if (err instanceof Error) {
        error.value = err.message
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Emoji
  // ═══════════════════════════════════════════════════════════════════

  const toggleEmojiPicker = () => {
    showEmojiPicker.value = !showEmojiPicker.value
  }

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.value
    if (!textarea) {
      return
    }

    const startPos = textarea.selectionStart
    const endPos = textarea.selectionEnd
    const textBefore = messageText.value.substring(0, startPos)
    const textAfter = messageText.value.substring(endPos)

    messageText.value = textBefore + emoji + textAfter
    showEmojiPicker.value = false

    nextTick(() => {
      if (textarea) {
        const newPos = startPos + emoji.length
        textarea.setSelectionRange(newPos, newPos)
        textarea.focus()
        autoResize()
      }
    })
  }

  // ═══════════════════════════════════════════════════════════════════
  // External API (exposed to parent via defineExpose)
  // ═══════════════════════════════════════════════════════════════════

  const sendQuickMessage = async (quickText: string) => {
    if (!quickText.trim() || sending.value) {
      return false
    }
    messageText.value = quickText.trim()
    await nextTick()
    await sendMessage()
    return true
  }

  const setMessageText = (text: string) => {
    if (!text.trim()) {
      return false
    }
    messageText.value = text.trim()
    nextTick(() => {
      autoResize()
      textareaRef.value?.focus()
    })
    return true
  }

  const setReplyTo = (content: string, senderName: string) => {
    replyToMessage.value = { content, senderName }
    nextTick(() => { textareaRef.value?.focus() })
  }

  const clearReply = () => {
    replyToMessage.value = null
  }

  // ═══════════════════════════════════════════════════════════════════
  // Watchers & lifecycle
  // ═══════════════════════════════════════════════════════════════════

  watch(
    () => props.conversationId,
    () => {
      fileSelection.cleanupBlobUrls()
      messageText.value = ''
      fileSelection.clearAttachments()
      replyToMessage.value = null
      error.value = ''
      nextTick(() => { autoResize() })
    },
  )

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as globalThis.Element
    if (showEmojiPicker.value && !target.closest('.emoji-picker-container')) {
      showEmojiPicker.value = false
    }
  }

  onMounted(() => {
    document.addEventListener('click', handleClickOutside)
    autoResize()
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
    fileSelection.cleanupBlobUrls()
  })

  // ═══════════════════════════════════════════════════════════════════
  // defineExpose — must match parent contract exactly
  // ═══════════════════════════════════════════════════════════════════

  defineExpose({
    sendQuickMessage,
    setMessageText,
    setReplyTo,
    clearReply,
    addFiles: fileSelection.addFiles,
    handleFilesDropped: fileSelection.addFiles,
    focus: () => textareaRef.value?.focus(),
    // Keep formatFileSize accessible for backward compat (used by test line 441)
    formatFileSize,
  })
</script>

<style scoped>
  /* Core layout */
  .message-input {
    max-width: 1000px;
    margin: 0 auto;
    width: 100%;
  }

  .input-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 1rem;
    padding: 0.5rem 0.75rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    transition: all 0.2s ease;
  }

  .input-container:focus-within {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }

  .input-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .message-textarea {
    flex: 1;
    border: none;
    outline: none;
    resize: none;
    font-size: 1rem;
    line-height: 1.4;
    padding: 0.6em 0;
    background: transparent;
    color: var(--gray-900);
    min-height: 24px;
    max-height: 120px;
    vertical-align: middle;
  }

  .message-textarea::placeholder {
    color: var(--gray-400);
    font-size: 1rem;
  }

  .message-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Action buttons */
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

  /* Send button */
  .send-button {
    --bezier: cubic-bezier(0.22, 0.61, 0.36, 1);
    --edge-light: hsla(0, 0%, 50%, 0.8);
    --text-light: rgba(255, 255, 255, 0.4);
    --back-color: 140, 70%;

    cursor: pointer;
    padding: 1em 2em;
    border-radius: 0.7em;
    min-height: 3.5em;
    min-width: 7em;
    display: flex;
    align-items: center;
    gap: 0.7em;
    justify-content: center;
    flex-shrink: 0;

    font-size: 18px;
    letter-spacing: 0.05em;
    line-height: 1;
    font-weight: 600;

    background: linear-gradient(
      140deg,
      hsla(var(--back-color), 60%, 1) min(2em, 20%),
      hsla(var(--back-color), 55%, 0.6) min(8em, 100%)
    );
    color: #000;
    border: 0;
    box-shadow: inset 0.4px 1px 4px var(--edge-light);

    transition: all 0.1s var(--bezier);
  }

  .send-button:hover {
    --edge-light: hsla(0, 0%, 50%, 1);
    text-shadow: 0px 0px 10px var(--text-light);
    box-shadow:
      inset 0.4px 1px 4px var(--edge-light),
      2px 4px 8px hsla(0, 0%, 0%, 0.295);
    transform: scale(1.1);
  }

  .send-button:active {
    --text-light: rgba(255, 255, 255, 1);

    background: linear-gradient(
      140deg,
      hsla(var(--back-color), 60%, 1) min(2em, 20%),
      hsla(var(--back-color), 55%, 0.6) min(8em, 100%)
    );
    box-shadow:
      inset 0.4px 1px 8px var(--edge-light),
      0px 0px 8px hsla(var(--back-color), 50%, 0.6);
    text-shadow: 0px 0px 20px var(--text-light);
    color: #000;
    letter-spacing: 0.1em;
    transform: scale(1);
  }

  .send-button.sending {
    --back-color: 140, 60%;
    animation: pulse-green 2s infinite;
  }

  .send-button svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .send-button span {
    font-weight: 600;
    white-space: nowrap;
  }

  .send-button .loading-icon {
    width: 20px;
    height: 20px;
  }

  @keyframes pulse-green {
    0%,
    100% {
      background: linear-gradient(
        140deg,
        hsla(140, 60%, 60%, 1) min(2em, 20%),
        hsla(140, 60%, 55%, 0.6) min(8em, 100%)
      );
    }
    50% {
      background: linear-gradient(
        140deg,
        hsla(140, 80%, 70%, 1) min(2em, 20%),
        hsla(140, 80%, 65%, 0.6) min(8em, 100%)
      );
    }
  }

  .file-input {
    display: none;
  }

  /* Error & success messages */
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
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* ═══════ Responsive ═══════ */

  /* Tablet */
  @media (max-width: 1024px) {
    .message-input {
      max-width: 1500px;
      margin: 0 auto;
    }

    .emoji-picker-popup {
      right: auto;
      left: 0;
    }
  }

  @media (max-width: 768px) {
    .input-container {
      padding: 12px 16px;
      gap: 10px;
      border-radius: 18px;
    }

    .message-textarea {
      font-size: 1rem;
      min-height: 24px;
      padding: 0.6em 0;
      line-height: 1.4;
    }

    .send-button {
      min-width: 5.5em;
      min-height: 3em;
      padding: 0.8em 1.5em;
      font-size: 16px;
      gap: 0.6em;
    }

    .send-button svg {
      width: 18px;
      height: 18px;
    }

    .send-button .loading-icon {
      width: 18px;
      height: 18px;
    }

    .action-btn {
      width: 32px;
      height: 32px;
      border-radius: 16px;
    }

    .action-btn svg {
      width: 18px;
      height: 18px;
    }

    .emoji-picker-popup {
      position: fixed;
      bottom: 60px;
      left: var(--space-2);
      right: var(--space-2);
      margin-bottom: 0;
      z-index: 9999;
    }

    .error-message,
    .success-message {
      padding: var(--space-2);
      font-size: 0.75rem;
    }
  }

  /* Small screens */
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
      min-width: 4.5em;
      min-height: 2.5em;
      padding: 0.6em 1em;
      font-size: 14px;
      gap: 0.5em;
    }

    .send-button svg {
      width: 16px;
      height: 16px;
    }

    .send-button .loading-icon {
      width: 16px;
      height: 16px;
    }

    .emoji-picker-popup {
      bottom: 50px;
      left: var(--space-1);
      right: var(--space-1);
    }
  }

  /* Touch devices */
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

    .error-close {
      min-width: 28px;
      min-height: 28px;
    }
  }
</style>
