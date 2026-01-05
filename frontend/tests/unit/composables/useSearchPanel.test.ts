import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { useSearchPanel } from '@/composables/useSearchPanel'
import type { Message } from '@/types'

describe('useSearchPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with closed state', () => {
      const panel = useSearchPanel()

      expect(panel.isOpen.value).toBe(false)
      expect(panel.searchRef.value).toBeNull()
    })

    it('should accept custom options', () => {
      const onSearchResults = vi.fn()
      const onSearchClear = vi.fn()

      const panel = useSearchPanel({
        onSearchResults,
        onSearchClear,
        autoFocus: false,
      })

      expect(panel.isOpen.value).toBe(false)
    })
  })

  describe('Toggle functionality', () => {
    it('should toggle panel visibility', async () => {
      const panel = useSearchPanel()

      expect(panel.isOpen.value).toBe(false)

      await panel.toggle()
      expect(panel.isOpen.value).toBe(true)

      await panel.toggle()
      expect(panel.isOpen.value).toBe(false)
    })

    it('should focus search input when toggled open with autoFocus', async () => {
      const panel = useSearchPanel({ autoFocus: true })
      const mockFocus = vi.fn()
      panel.searchRef.value = { focus: mockFocus }

      await panel.toggle()
      await nextTick()

      expect(panel.isOpen.value).toBe(true)
      expect(mockFocus).toHaveBeenCalledTimes(1)
    })

    it('should not focus when toggled open with autoFocus disabled', async () => {
      const panel = useSearchPanel({ autoFocus: false })
      const mockFocus = vi.fn()
      panel.searchRef.value = { focus: mockFocus }

      await panel.toggle()
      await nextTick()

      expect(panel.isOpen.value).toBe(true)
      expect(mockFocus).not.toHaveBeenCalled()
    })

    it('should call onSearchClear when toggled closed', async () => {
      const onSearchClear = vi.fn()
      const panel = useSearchPanel({ onSearchClear })

      // Open first
      await panel.toggle()
      expect(panel.isOpen.value).toBe(true)

      // Close
      await panel.toggle()
      expect(panel.isOpen.value).toBe(false)
      expect(onSearchClear).toHaveBeenCalledTimes(1)
    })
  })

  describe('Open functionality', () => {
    it('should open panel', async () => {
      const panel = useSearchPanel()

      await panel.open()

      expect(panel.isOpen.value).toBe(true)
    })

    it('should focus search input when opened with autoFocus', async () => {
      const panel = useSearchPanel({ autoFocus: true })
      const mockFocus = vi.fn()
      panel.searchRef.value = { focus: mockFocus }

      await panel.open()
      await nextTick()

      expect(mockFocus).toHaveBeenCalledTimes(1)
    })

    it('should not focus when opened with autoFocus disabled', async () => {
      const panel = useSearchPanel({ autoFocus: false })
      const mockFocus = vi.fn()
      panel.searchRef.value = { focus: mockFocus }

      await panel.open()
      await nextTick()

      expect(mockFocus).not.toHaveBeenCalled()
    })

    it('should not reopen if already open', async () => {
      const panel = useSearchPanel()
      const mockFocus = vi.fn()
      panel.searchRef.value = { focus: mockFocus }

      // Open first time
      await panel.open()
      expect(panel.isOpen.value).toBe(true)

      mockFocus.mockClear()

      // Try to open again
      await panel.open()
      expect(panel.isOpen.value).toBe(true)
      expect(mockFocus).not.toHaveBeenCalled() // Should not focus again
    })
  })

  describe('Close functionality', () => {
    it('should close panel', async () => {
      const panel = useSearchPanel()

      // Open first
      await panel.open()
      expect(panel.isOpen.value).toBe(true)

      // Close
      panel.close()
      expect(panel.isOpen.value).toBe(false)
    })

    it('should call onSearchClear when closed', async () => {
      const onSearchClear = vi.fn()
      const panel = useSearchPanel({ onSearchClear })

      await panel.open()
      panel.close()

      expect(onSearchClear).toHaveBeenCalledTimes(1)
    })

    it('should be idempotent - closing twice should only call onSearchClear once', () => {
      const onSearchClear = vi.fn()
      const panel = useSearchPanel({ onSearchClear })

      panel.isOpen.value = true
      panel.close()
      panel.close()

      expect(onSearchClear).toHaveBeenCalledTimes(2) // Called each time close() is invoked
    })
  })

  describe('Search results handling', () => {
    it('should handle search results', () => {
      const onSearchResults = vi.fn()
      const panel = useSearchPanel({ onSearchResults })

      const mockResults: Message[] = [
        {
          id: '1',
          content: 'test message 1',
          conversationId: 'conv1',
          senderId: 'user1',
          senderType: 'customer',
          platform: 'line',
          direction: 'incoming',
          status: 'sent',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          content: 'test message 2',
          conversationId: 'conv1',
          senderId: 'user1',
          senderType: 'customer',
          platform: 'line',
          direction: 'incoming',
          status: 'sent',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]

      panel.handleSearchResults(mockResults)

      expect(onSearchResults).toHaveBeenCalledTimes(1)
      expect(onSearchResults).toHaveBeenCalledWith(mockResults)
    })

    it('should work without onSearchResults callback', () => {
      const panel = useSearchPanel()
      const mockResults: Message[] = []

      // Should not throw error
      expect(() => {
        panel.handleSearchResults(mockResults)
      }).not.toThrow()
    })
  })

  describe('Search clear handling', () => {
    it('should handle search clear', () => {
      const onSearchClear = vi.fn()
      const panel = useSearchPanel({ onSearchClear })

      panel.isOpen.value = true
      panel.handleSearchClear()

      expect(panel.isOpen.value).toBe(false)
      expect(onSearchClear).toHaveBeenCalledTimes(1)
    })

    it('should close panel when handleSearchClear is called', async () => {
      const panel = useSearchPanel()

      await panel.open()
      expect(panel.isOpen.value).toBe(true)

      panel.handleSearchClear()
      expect(panel.isOpen.value).toBe(false)
    })
  })

  describe('Search ref management', () => {
    it('should handle null searchRef gracefully', async () => {
      const panel = useSearchPanel()

      panel.searchRef.value = null

      // Should not throw error
      await expect(panel.open()).resolves.not.toThrow()
      await expect(panel.toggle()).resolves.not.toThrow()
    })

    it('should handle searchRef without focus method', async () => {
      const panel = useSearchPanel()

      // @ts-expect-error - Testing invalid ref
      panel.searchRef.value = {}

      // Should not throw error
      await expect(panel.open()).resolves.not.toThrow()
    })
  })

  describe('Integration scenarios', () => {
    it('should support full workflow: open -> search -> clear -> close', async () => {
      const onSearchResults = vi.fn()
      const onSearchClear = vi.fn()
      const panel = useSearchPanel({
        onSearchResults,
        onSearchClear,
      })

      // 1. Open panel
      await panel.open()
      expect(panel.isOpen.value).toBe(true)

      // 2. Search
      const results: Message[] = [
        {
          id: '1',
          content: 'found',
          conversationId: 'conv1',
          senderId: 'user1',
          senderType: 'customer',
          platform: 'line',
          direction: 'incoming',
          status: 'sent',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]
      panel.handleSearchResults(results)
      expect(onSearchResults).toHaveBeenCalledWith(results)

      // 3. Clear search
      panel.handleSearchClear()
      expect(panel.isOpen.value).toBe(false)
      expect(onSearchClear).toHaveBeenCalledTimes(1)
    })

    it('should support toggle workflow', async () => {
      const onSearchClear = vi.fn()
      const panel = useSearchPanel({ onSearchClear })
      const mockFocus = vi.fn()
      panel.searchRef.value = { focus: mockFocus }

      // Toggle open
      await panel.toggle()
      expect(panel.isOpen.value).toBe(true)
      expect(mockFocus).toHaveBeenCalledTimes(1)

      // Toggle close
      await panel.toggle()
      expect(panel.isOpen.value).toBe(false)
      expect(onSearchClear).toHaveBeenCalledTimes(1)
    })
  })
})
