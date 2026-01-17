import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useConversationActions } from '@/composables/useConversationActions'
import type { ConversationController } from '@/composables/useConversationActions'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'

// Mock dependencies
vi.mock('@/composables/useToast', () => ({
  useToast: vi.fn(),
}))

vi.mock('@/composables/useConfirm', () => ({
  useConfirm: vi.fn(),
}))

describe('useConversationActions', () => {
  let mockController: ConversationController
  let mockShowSuccess: ReturnType<typeof vi.fn>
  let mockShowError: ReturnType<typeof vi.fn>
  let mockShowConfirm: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Mock controller
    mockController = {
      closeConversation: vi.fn().mockResolvedValue(true),
      reopenConversation: vi.fn().mockResolvedValue(true),
    }

    // Mock toast
    mockShowSuccess = vi.fn()
    mockShowError = vi.fn()
    vi.mocked(useToast).mockReturnValue({
      showSuccess: mockShowSuccess,
      showError: mockShowError,
      showInfo: vi.fn(),
      showWarning: vi.fn(),
    })

    // Mock confirm
    mockShowConfirm = vi.fn().mockResolvedValue(true) // Default: user confirms
    vi.mocked(useConfirm).mockReturnValue({
      showConfirm: mockShowConfirm,
    })
  })

  describe('Initialization', () => {
    it('should initialize with isClosing = false', () => {
      const actions = useConversationActions(mockController)

      expect(actions.isClosing.value).toBe(false)
    })

    it('should accept custom options', () => {
      const actions = useConversationActions(mockController, {
        confirmBeforeClose: false,
        toastMessages: {
          closeSuccess: 'Custom success',
        },
      })

      expect(actions.isClosing.value).toBe(false)
    })
  })

  describe('Close conversation', () => {
    it('should show confirmation dialog before closing', async () => {
      const actions = useConversationActions(mockController)

      await actions.close()

      expect(mockShowConfirm).toHaveBeenCalledTimes(1)
      expect(mockShowConfirm).toHaveBeenCalledWith({
        title: '確定要關閉這個對話嗎？',
        message: '關閉後將無法繼續發送訊息',
        confirmText: '關閉對話',
        cancelText: '取消',
        type: 'warning',
      })
    })

    it('should use custom confirmation messages', async () => {
      const actions = useConversationActions(mockController, {
        closeConfirmation: {
          title: 'Custom Title',
          message: 'Custom Message',
          confirmText: 'Yes',
          cancelText: 'No',
        },
      })

      await actions.close()

      expect(mockShowConfirm).toHaveBeenCalledWith({
        title: 'Custom Title',
        message: 'Custom Message',
        confirmText: 'Yes',
        cancelText: 'No',
        type: 'warning',
      })
    })

    it('should not close if user cancels confirmation', async () => {
      mockShowConfirm.mockResolvedValue(false) // User cancels

      const actions = useConversationActions(mockController)
      const result = await actions.close()

      expect(result).toBe(false)
      expect(mockController.closeConversation).not.toHaveBeenCalled()
      expect(actions.isClosing.value).toBe(false)
    })

    it('should close conversation if user confirms', async () => {
      mockShowConfirm.mockResolvedValue(true) // User confirms
      mockController.closeConversation = vi.fn().mockResolvedValue(true)

      const actions = useConversationActions(mockController)
      const result = await actions.close()

      expect(result).toBe(true)
      expect(mockController.closeConversation).toHaveBeenCalledTimes(1)
      expect(mockShowSuccess).toHaveBeenCalledWith('對話已關閉')
    })

    it('should skip confirmation if confirmBeforeClose is false', async () => {
      const actions = useConversationActions(mockController, {
        confirmBeforeClose: false,
      })

      await actions.close()

      expect(mockShowConfirm).not.toHaveBeenCalled()
      expect(mockController.closeConversation).toHaveBeenCalledTimes(1)
    })

    it('should set isClosing to true during operation', async () => {
      // Create actions first, then capture its isClosing state during operation
      const actions = useConversationActions(mockController)
      let closingDuringOperation = false

      mockController.closeConversation = vi.fn().mockImplementation(async () => {
        // Capture the state from the SAME actions instance
        closingDuringOperation = actions.isClosing.value
        return true
      })

      await actions.close()

      expect(closingDuringOperation).toBe(true)
      expect(actions.isClosing.value).toBe(false) // Reset after
    })

    it('should show error toast if close fails', async () => {
      mockController.closeConversation = vi.fn().mockResolvedValue(false)

      const actions = useConversationActions(mockController)
      const result = await actions.close()

      expect(result).toBe(false)
      expect(mockShowError).toHaveBeenCalledWith('關閉失敗')
    })

    it('should use custom error message', async () => {
      mockController.closeConversation = vi.fn().mockResolvedValue(false)

      const actions = useConversationActions(mockController, {
        toastMessages: {
          closeError: 'Custom Error',
        },
      })

      await actions.close()

      expect(mockShowError).toHaveBeenCalledWith('Custom Error')
    })

    it('should handle exceptions gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockController.closeConversation = vi.fn().mockRejectedValue(new Error('Network error'))

      const actions = useConversationActions(mockController)
      const result = await actions.close()

      expect(result).toBe(false)
      expect(mockShowError).toHaveBeenCalledWith('關閉對話時發生錯誤')
      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(actions.isClosing.value).toBe(false) // Reset even on error

      consoleErrorSpy.mockRestore()
    })

    it('should reset isClosing even if operation fails', async () => {
      mockController.closeConversation = vi.fn().mockRejectedValue(new Error('Error'))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const actions = useConversationActions(mockController)

      expect(actions.isClosing.value).toBe(false)
      await actions.close()
      expect(actions.isClosing.value).toBe(false)

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Reopen conversation', () => {
    it('should reopen conversation successfully', async () => {
      mockController.reopenConversation = vi.fn().mockResolvedValue(true)

      const actions = useConversationActions(mockController)
      const result = await actions.reopen()

      expect(result).toBe(true)
      expect(mockController.reopenConversation).toHaveBeenCalledTimes(1)
      expect(mockShowSuccess).toHaveBeenCalledWith('對話已重新打開')
    })

    it('should show error toast if reopen fails', async () => {
      mockController.reopenConversation = vi.fn().mockResolvedValue(false)

      const actions = useConversationActions(mockController)
      const result = await actions.reopen()

      expect(result).toBe(false)
      expect(mockShowError).toHaveBeenCalledWith('重新打開失敗')
    })

    it('should use custom success message', async () => {
      const actions = useConversationActions(mockController, {
        toastMessages: {
          reopenSuccess: 'Custom Reopen Success',
        },
      })

      await actions.reopen()

      expect(mockShowSuccess).toHaveBeenCalledWith('Custom Reopen Success')
    })

    it('should use custom error message', async () => {
      mockController.reopenConversation = vi.fn().mockResolvedValue(false)

      const actions = useConversationActions(mockController, {
        toastMessages: {
          reopenError: 'Custom Reopen Error',
        },
      })

      await actions.reopen()

      expect(mockShowError).toHaveBeenCalledWith('Custom Reopen Error')
    })

    it('should handle exceptions gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockController.reopenConversation = vi.fn().mockRejectedValue(new Error('Network error'))

      const actions = useConversationActions(mockController)
      const result = await actions.reopen()

      expect(result).toBe(false)
      expect(mockShowError).toHaveBeenCalledWith('重新打開對話時發生錯誤')
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('should not require confirmation for reopen', async () => {
      const actions = useConversationActions(mockController)

      await actions.reopen()

      expect(mockShowConfirm).not.toHaveBeenCalled()
    })
  })

  describe('Integration scenarios', () => {
    it('should support close -> reopen workflow', async () => {
      const actions = useConversationActions(mockController)

      // Close
      const closeResult = await actions.close()
      expect(closeResult).toBe(true)
      expect(mockShowSuccess).toHaveBeenCalledWith('對話已關閉')

      // Reopen
      const reopenResult = await actions.reopen()
      expect(reopenResult).toBe(true)
      expect(mockShowSuccess).toHaveBeenCalledWith('對話已重新打開')

      expect(mockShowSuccess).toHaveBeenCalledTimes(2)
    })

    it('should handle concurrent close attempts gracefully', async () => {
      const actions = useConversationActions(mockController)

      // Start two close operations
      const promise1 = actions.close()
      const promise2 = actions.close()

      const [result1, result2] = await Promise.all([promise1, promise2])

      // Both should succeed (confirmation shown twice)
      expect(result1).toBe(true)
      expect(result2).toBe(true)
      expect(mockShowConfirm).toHaveBeenCalledTimes(2)
    })
  })
})
