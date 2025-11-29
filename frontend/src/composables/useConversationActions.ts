// Conversation Actions Composable
// 對話操作 composable - 從 ConversationDetail.vue 提取

import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { useRouter } from 'vue-router'
import { useConversationsStore } from '@/stores/conversations'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import * as messageApi from '@/api/messages'
import type { Message, Conversation } from '@/types'

export interface ConversationActionsOptions {
  conversationId: ComputedRef<string> | Ref<string>
  conversation: ComputedRef<Conversation | undefined>
  messages: ComputedRef<Message[]>
}

export interface MessageSendData {
  content: string
  attachments: unknown[]
  file_attachments?: FileAttachmentData[]
}

export interface FileAttachmentData {
  id: string
  name: string
  size: number
  type: string
  url: string
}

export interface MessagePendingData {
  tempId: string
  content: string
  timestamp: string
  status: 'pending'
  attachments?: FileAttachmentData[]
}

export interface MessageConfirmedData {
  tempId: string
  messageId: string
  status: 'sent'
  sentAt: string
  platformMessageId?: string
}

export interface MessageFailedData {
  tempId: string
  error: string
  status: 'failed'
}

export interface UploadProgressData {
  tempId: string
  progress: number
  status: 'sending' | 'uploading'
}

export function useConversationActions(options: ConversationActionsOptions) {
  const { conversationId, conversation, messages } = options

  const router = useRouter()
  const conversationsStore = useConversationsStore()
  const authStore = useAuthStore()
  const { toast } = useToast()
  const confirm = useConfirm()

  // State
  const closing = ref(false)
  const reopening = ref(false)

  // ==================== Navigation ====================

  const goBack = () => {
    router.push('/conversations')
  }

  // ==================== Conversation Status Actions ====================

  const closeConversation = async () => {
    if (closing.value) return

    const confirmed = await confirm.confirmWarning(
      '關閉對話',
      '確定要關閉此對話嗎？關閉後可以重新打開。'
    )

    if (!confirmed) return

    closing.value = true
    try {
      const success = await conversationsStore.closeConversation(conversationId.value)
      if (success) {
        toast.success('對話已關閉')
      } else {
        toast.error('關閉對話失敗')
      }
    } catch (error) {
      console.error('Failed to close conversation:', error)
      toast.error('關閉對話失敗')
    } finally {
      closing.value = false
    }
  }

  const reopenConversation = async () => {
    if (reopening.value) return

    const confirmed = await confirm.confirmInfo(
      '重新打開對話',
      '確定要重新打開此對話嗎？'
    )

    if (!confirmed) return

    reopening.value = true
    try {
      const success = await conversationsStore.reopenConversation(conversationId.value)
      if (success) {
        toast.success('對話已重新打開')
      } else {
        toast.error('重新打開對話失敗')
      }
    } catch (error) {
      console.error('Failed to reopen conversation:', error)
      toast.error('重新打開對話失敗')
    } finally {
      reopening.value = false
    }
  }

  // ==================== Message Read Status ====================

  const markAsRead = async () => {
    try {
      await conversationsStore.markConversationAsRead(conversationId.value)
    } catch (error) {
      console.error('Failed to mark conversation as read:', error)
    }
  }

  // ==================== Message Actions ====================

  const copyMessage = (message: Message) => {
    navigator.clipboard.writeText(message.content)
    toast.success('訊息已複製到剪貼簿')
  }

  const replyToMessage = (message: Message, inputRef: Ref<{ setContent: (content: string) => void } | null>) => {
    if (inputRef.value?.setContent) {
      const senderName = message.senderType === 'customer' ? '客戶' : '客服'
      inputRef.value.setContent(`> ${senderName}: ${message.content}\n\n`)
    }
  }

  const forwardMessage = (message: Message) => {
    toast.info('轉發功能開發中')
    console.log('Forward message:', message.id)
  }

  const recallMessage = async (message: Message, httpMessages: { messages: Ref<Message[]> }) => {
    const confirmed = await confirm.confirmWarning(
      '撤回訊息',
      '確定要撤回此訊息嗎？此操作無法撤銷。',
      { confirmText: '撤回', cancelText: '取消' }
    )

    if (!confirmed) return

    try {
      await messageApi.recallMessage(conversationId.value, message.id)

      // Update local message state
      const messageList = httpMessages.messages.value
      const msgIndex = messageList.findIndex(m => m.id === message.id)
      if (msgIndex !== -1) {
        messageList[msgIndex] = {
          ...messageList[msgIndex],
          content: '[此訊息已撤回]',
          isRecalled: true
        }
      }

      toast.success('訊息已撤回')
    } catch (error) {
      console.error('Failed to recall message:', error)
      toast.error('撤回訊息失敗')
    }
  }

  // ==================== Quick Reply ====================

  const quickReplies = ref([
    { id: 1, text: '您好，請問有什麼可以幫助您的？' },
    { id: 2, text: '感謝您的耐心等待' },
    { id: 3, text: '我已收到您的問題，正在為您處理' },
    { id: 4, text: '請問還有其他問題嗎？' }
  ])

  const useQuickReply = (text: string, inputRef: Ref<{ setContent: (content: string) => void } | null>) => {
    if (inputRef.value?.setContent) {
      inputRef.value.setContent(text)
    }
  }

  // ==================== Computed ====================

  const canSendMessage = computed(() => {
    return conversation.value?.status !== 'closed'
  })

  const isClosed = computed(() => {
    return conversation.value?.status === 'closed'
  })

  return {
    // State
    closing,
    reopening,
    quickReplies,

    // Computed
    canSendMessage,
    isClosed,

    // Navigation
    goBack,

    // Conversation Actions
    closeConversation,
    reopenConversation,
    markAsRead,

    // Message Actions
    copyMessage,
    replyToMessage,
    forwardMessage,
    recallMessage,
    useQuickReply
  }
}
