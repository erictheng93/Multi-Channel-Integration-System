import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useConversationActions } from '@/composables/useConversationActions'
import type { ConversationController } from '@/composables/useConversationActions'

describe('useConversationActions (deprecated stub)', () => {
  let mockController: ConversationController

  beforeEach(() => {
    vi.clearAllMocks()
    mockController = {}
  })

  describe('Initialization', () => {
    it('should initialize with isClosing = false', () => {
      const actions = useConversationActions(mockController)
      expect(actions.isClosing.value).toBe(false)
    })

    it('should accept options without error', () => {
      const actions = useConversationActions(mockController, {
        confirmBeforeClose: false,
        toastMessages: { closeSuccess: 'Custom' },
      })
      expect(actions.isClosing.value).toBe(false)
    })
  })

  describe('Close (no-op)', () => {
    it('should return false (no-op)', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const actions = useConversationActions(mockController)
      const result = await actions.close()

      expect(result).toBe(false)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[useConversationActions] close() is deprecated and has no effect'
      )
      consoleWarnSpy.mockRestore()
    })
  })

  describe('Reopen (no-op)', () => {
    it('should return false (no-op)', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const actions = useConversationActions(mockController)
      const result = await actions.reopen()

      expect(result).toBe(false)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[useConversationActions] reopen() is deprecated and has no effect'
      )
      consoleWarnSpy.mockRestore()
    })
  })
})
