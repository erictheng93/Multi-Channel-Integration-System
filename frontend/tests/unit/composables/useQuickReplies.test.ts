import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useQuickReplies } from '@/composables/useQuickReplies'
import type { QuickReply } from '@/composables/useQuickReplies'

describe('useQuickReplies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default replies', () => {
      const quickReplies = useQuickReplies()

      expect(quickReplies.replies.value.length).toBeGreaterThan(0)
      expect(quickReplies.loading.value).toBe(false)
    })

    it('should initialize with custom replies', () => {
      const customReplies: QuickReply[] = [
        { id: 'custom1', text: 'Custom reply 1' },
        { id: 'custom2', text: 'Custom reply 2' },
      ]

      const quickReplies = useQuickReplies({
        initialReplies: customReplies,
      })

      expect(quickReplies.replies.value).toEqual(customReplies)
    })

    it('should initialize with empty list', () => {
      const quickReplies = useQuickReplies({
        initialReplies: [],
      })

      expect(quickReplies.replies.value).toEqual([])
    })
  })

  describe('Filtered replies', () => {
    it('should filter out disabled replies by default', () => {
      const replies: QuickReply[] = [
        { id: '1', text: 'Enabled', enabled: true },
        { id: '2', text: 'Disabled', enabled: false },
        { id: '3', text: 'Default (enabled)' },
      ]

      const quickReplies = useQuickReplies({
        initialReplies: replies,
      })

      expect(quickReplies.filteredReplies.value).toHaveLength(2)
      expect(quickReplies.filteredReplies.value.find(r => r.id === '2')).toBeUndefined()
    })

    it('should apply custom filter', () => {
      const replies: QuickReply[] = [
        { id: '1', text: 'Hello', category: 'greeting' },
        { id: '2', text: 'Goodbye', category: 'farewell' },
        { id: '3', text: 'Thanks', category: 'gratitude' },
      ]

      const quickReplies = useQuickReplies({
        initialReplies: replies,
        filter: (reply) => reply.category === 'greeting',
      })

      expect(quickReplies.filteredReplies.value).toHaveLength(1)
      expect(quickReplies.filteredReplies.value[0].id).toBe('1')
    })

    it('should combine default and custom filters', () => {
      const replies: QuickReply[] = [
        { id: '1', text: 'Hello', category: 'greeting', enabled: true },
        { id: '2', text: 'Hi', category: 'greeting', enabled: false },
        { id: '3', text: 'Goodbye', category: 'farewell', enabled: true },
      ]

      const quickReplies = useQuickReplies({
        initialReplies: replies,
        filter: (reply) => reply.category === 'greeting',
      })

      // Should show only enabled + greeting
      expect(quickReplies.filteredReplies.value).toHaveLength(1)
      expect(quickReplies.filteredReplies.value[0].id).toBe('1')
    })
  })

  describe('Select reply', () => {
    it('should call onSelect when reply is selected', () => {
      const onSelect = vi.fn()
      const replies: QuickReply[] = [
        { id: '1', text: 'Test reply' },
      ]

      const quickReplies = useQuickReplies({
        initialReplies: replies,
        onSelect,
      })

      quickReplies.selectReply(replies[0])

      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onSelect).toHaveBeenCalledWith(replies[0])
    })

    it('should work without onSelect callback', () => {
      const replies: QuickReply[] = [
        { id: '1', text: 'Test reply' },
      ]

      const quickReplies = useQuickReplies({
        initialReplies: replies,
      })

      // Should not throw
      expect(() => {
        quickReplies.selectReply(replies[0])
      }).not.toThrow()
    })

    it('should select reply by ID', () => {
      const onSelect = vi.fn()
      const replies: QuickReply[] = [
        { id: '1', text: 'Reply 1' },
        { id: '2', text: 'Reply 2' },
      ]

      const quickReplies = useQuickReplies({
        initialReplies: replies,
        onSelect,
      })

      quickReplies.selectById('2')

      expect(onSelect).toHaveBeenCalledWith(replies[1])
    })

    it('should not call onSelect if ID not found', () => {
      const onSelect = vi.fn()
      const quickReplies = useQuickReplies({
        initialReplies: [],
        onSelect,
      })

      quickReplies.selectById('nonexistent')

      expect(onSelect).not.toHaveBeenCalled()
    })
  })

  describe('Add reply', () => {
    it('should add new reply', () => {
      const quickReplies = useQuickReplies({
        initialReplies: [],
      })

      const newReply: QuickReply = { id: 'new', text: 'New reply' }
      quickReplies.addReply(newReply)

      expect(quickReplies.replies.value).toHaveLength(1)
      expect(quickReplies.replies.value[0]).toEqual(newReply)
    })

    it('should not add reply with duplicate ID', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const initialReplies: QuickReply[] = [
        { id: '1', text: 'Existing' },
      ]

      const quickReplies = useQuickReplies({
        initialReplies,
      })

      const duplicate: QuickReply = { id: '1', text: 'Duplicate' }
      quickReplies.addReply(duplicate)

      expect(quickReplies.replies.value).toHaveLength(1)
      expect(quickReplies.replies.value[0].text).toBe('Existing')
      expect(consoleWarnSpy).toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })
  })

  describe('Remove reply', () => {
    it('should remove reply by ID', () => {
      const replies: QuickReply[] = [
        { id: '1', text: 'Reply 1' },
        { id: '2', text: 'Reply 2' },
        { id: '3', text: 'Reply 3' },
      ]

      const quickReplies = useQuickReplies({
        initialReplies: replies,
      })

      quickReplies.removeReply('2')

      expect(quickReplies.replies.value).toHaveLength(2)
      expect(quickReplies.replies.value.find(r => r.id === '2')).toBeUndefined()
    })

    it('should do nothing if ID not found', () => {
      const replies: QuickReply[] = [
        { id: '1', text: 'Reply 1' },
      ]

      const quickReplies = useQuickReplies({
        initialReplies: replies,
      })

      quickReplies.removeReply('nonexistent')

      expect(quickReplies.replies.value).toHaveLength(1)
    })
  })

  describe('Refresh replies', () => {
    it('should load replies from API', async () => {
      const apiReplies: QuickReply[] = [
        { id: 'api1', text: 'API reply 1' },
        { id: 'api2', text: 'API reply 2' },
      ]

      const loadReplies = vi.fn().mockResolvedValue(apiReplies)

      const quickReplies = useQuickReplies({
        initialReplies: [],
        loadReplies,
        autoLoad: false,
      })

      await quickReplies.refresh()

      expect(loadReplies).toHaveBeenCalledTimes(1)
      expect(quickReplies.replies.value).toEqual(apiReplies)
    })

    it('should set loading state during refresh', async () => {
      const loadReplies = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return []
      })

      const quickReplies = useQuickReplies({
        loadReplies,
        autoLoad: false,
      })

      expect(quickReplies.loading.value).toBe(false)

      const refreshPromise = quickReplies.refresh()
      expect(quickReplies.loading.value).toBe(true)

      await refreshPromise
      expect(quickReplies.loading.value).toBe(false)
    })

    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const loadReplies = vi.fn().mockRejectedValue(new Error('API error'))

      const quickReplies = useQuickReplies({
        initialReplies: [{ id: '1', text: 'Initial' }],
        loadReplies,
        autoLoad: false,
      })

      await quickReplies.refresh()

      // Should keep initial replies on error
      expect(quickReplies.replies.value).toHaveLength(1)
      expect(quickReplies.loading.value).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('should warn if no loadReplies function provided', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const quickReplies = useQuickReplies({
        initialReplies: [],
      })

      await quickReplies.refresh()

      expect(consoleWarnSpy).toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })
  })

  describe('Auto load', () => {
    it('should auto-load replies if autoLoad is true', async () => {
      const apiReplies: QuickReply[] = [
        { id: 'auto1', text: 'Auto-loaded reply' },
      ]

      const loadReplies = vi.fn().mockResolvedValue(apiReplies)

      useQuickReplies({
        loadReplies,
        autoLoad: true,
      })

      // Wait for auto-load
      await vi.waitFor(() => {
        expect(loadReplies).toHaveBeenCalled()
      })
    })

    it('should not auto-load if autoLoad is false', () => {
      const loadReplies = vi.fn()

      useQuickReplies({
        loadReplies,
        autoLoad: false,
      })

      expect(loadReplies).not.toHaveBeenCalled()
    })
  })

  describe('Clear replies', () => {
    it('should clear all replies', () => {
      const replies: QuickReply[] = [
        { id: '1', text: 'Reply 1' },
        { id: '2', text: 'Reply 2' },
      ]

      const quickReplies = useQuickReplies({
        initialReplies: replies,
      })

      expect(quickReplies.replies.value).toHaveLength(2)

      quickReplies.clear()

      expect(quickReplies.replies.value).toHaveLength(0)
    })
  })

  describe('Integration scenarios', () => {
    it('should support full CRUD workflow', () => {
      const onSelect = vi.fn()
      const quickReplies = useQuickReplies({
        initialReplies: [],
        onSelect,
      })

      // Add
      quickReplies.addReply({ id: '1', text: 'Reply 1' })
      quickReplies.addReply({ id: '2', text: 'Reply 2' })
      expect(quickReplies.replies.value).toHaveLength(2)

      // Select
      quickReplies.selectById('1')
      expect(onSelect).toHaveBeenCalled()

      // Remove
      quickReplies.removeReply('1')
      expect(quickReplies.replies.value).toHaveLength(1)

      // Clear
      quickReplies.clear()
      expect(quickReplies.replies.value).toHaveLength(0)
    })

    it('should support filter + select workflow', () => {
      const onSelect = vi.fn()
      const replies: QuickReply[] = [
        { id: '1', text: 'Greeting 1', category: 'greeting' },
        { id: '2', text: 'Greeting 2', category: 'greeting', enabled: false },
        { id: '3', text: 'Farewell', category: 'farewell' },
      ]

      const quickReplies = useQuickReplies({
        initialReplies: replies,
        filter: (r) => r.category === 'greeting',
        onSelect,
      })

      // Should show only enabled greeting
      expect(quickReplies.filteredReplies.value).toHaveLength(1)

      quickReplies.selectReply(quickReplies.filteredReplies.value[0])
      expect(onSelect).toHaveBeenCalledWith(replies[0])
    })
  })
})
