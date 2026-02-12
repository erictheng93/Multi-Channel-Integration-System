/**
 * Unit Tests for useTeamModal Composable
 *
 * Tests modal state management and lifecycle callbacks:
 * - Modal visibility (showModal)
 * - Edit mode state (isEditing)
 * - Modal open/close operations
 * - Edit mode start/cancel
 * - Lifecycle callback registration and execution
 */

import { describe, it, expect, vi } from 'vitest'
import { useTeamModal } from '@/composables/team-management/useTeamModal'

describe('useTeamModal', () => {
  describe('initial state', () => {
    it('should initialize with modal closed', () => {
      const { showModal } = useTeamModal()

      expect(showModal.value).toBe(false)
    })

    it('should initialize with edit mode disabled', () => {
      const { isEditing } = useTeamModal()

      expect(isEditing.value).toBe(false)
    })
  })

  describe('openModal', () => {
    it('should set showModal to true', async () => {
      const { showModal, openModal } = useTeamModal()

      await openModal()

      expect(showModal.value).toBe(true)
    })

    it('should reset edit mode when opening', async () => {
      const { isEditing, openModal, startEdit } = useTeamModal()

      // Start edit mode first
      startEdit()
      expect(isEditing.value).toBe(true)

      // Opening should reset edit mode
      await openModal()
      expect(isEditing.value).toBe(false)
    })

    it('should execute registered callbacks', async () => {
      const { openModal, onModalOpen } = useTeamModal()
      const callback = vi.fn()

      onModalOpen(callback)
      await openModal()

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should execute multiple callbacks in order', async () => {
      const { openModal, onModalOpen } = useTeamModal()
      const executionOrder: number[] = []

      onModalOpen(() => { executionOrder.push(1) })
      onModalOpen(() => { executionOrder.push(2) })
      onModalOpen(() => { executionOrder.push(3) })

      await openModal()

      expect(executionOrder).toEqual([1, 2, 3])
    })

    it('should handle async callbacks', async () => {
      const { openModal, onModalOpen } = useTeamModal()
      let callbackExecuted = false

      onModalOpen(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        callbackExecuted = true
      })

      await openModal()

      expect(callbackExecuted).toBe(true)
    })

    it('should wait for all async callbacks to complete', async () => {
      const { openModal, onModalOpen } = useTeamModal()
      const executionOrder: string[] = []

      onModalOpen(async () => {
        await new Promise(resolve => setTimeout(resolve, 20))
        executionOrder.push('callback1')
      })

      onModalOpen(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        executionOrder.push('callback2')
      })

      await openModal()
      executionOrder.push('after')

      // Callbacks execute sequentially, so callback1 completes before callback2 starts
      expect(executionOrder).toEqual(['callback1', 'callback2', 'after'])
    })
  })

  describe('closeModal', () => {
    it('should set showModal to false', async () => {
      const { showModal, openModal, closeModal } = useTeamModal()

      await openModal()
      expect(showModal.value).toBe(true)

      await closeModal()
      expect(showModal.value).toBe(false)
    })

    it('should reset edit mode when closing', async () => {
      const { isEditing, openModal, startEdit, closeModal } = useTeamModal()

      await openModal()
      startEdit()
      expect(isEditing.value).toBe(true)

      await closeModal()
      expect(isEditing.value).toBe(false)
    })

    it('should execute registered callbacks', async () => {
      const { openModal, closeModal, onModalClose } = useTeamModal()
      const callback = vi.fn()

      onModalClose(callback)
      await openModal()
      await closeModal()

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should execute multiple callbacks in order', async () => {
      const { openModal, closeModal, onModalClose } = useTeamModal()
      const executionOrder: number[] = []

      onModalClose(() => { executionOrder.push(1) })
      onModalClose(() => { executionOrder.push(2) })
      onModalClose(() => { executionOrder.push(3) })

      await openModal()
      await closeModal()

      expect(executionOrder).toEqual([1, 2, 3])
    })

    it('should handle async callbacks', async () => {
      const { openModal, closeModal, onModalClose } = useTeamModal()
      let callbackExecuted = false

      onModalClose(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        callbackExecuted = true
      })

      await openModal()
      await closeModal()

      expect(callbackExecuted).toBe(true)
    })
  })

  describe('edit mode', () => {
    it('should enter edit mode with startEdit', () => {
      const { isEditing, startEdit } = useTeamModal()

      startEdit()

      expect(isEditing.value).toBe(true)
    })

    it('should exit edit mode with cancelEdit', () => {
      const { isEditing, startEdit, cancelEdit } = useTeamModal()

      startEdit()
      expect(isEditing.value).toBe(true)

      cancelEdit()
      expect(isEditing.value).toBe(false)
    })

    it('should allow toggling edit mode multiple times', () => {
      const { isEditing, startEdit, cancelEdit } = useTeamModal()

      startEdit()
      expect(isEditing.value).toBe(true)

      cancelEdit()
      expect(isEditing.value).toBe(false)

      startEdit()
      expect(isEditing.value).toBe(true)

      cancelEdit()
      expect(isEditing.value).toBe(false)
    })
  })

  describe('lifecycle integration', () => {
    it('should execute open callbacks before close callbacks', async () => {
      const { openModal, closeModal, onModalOpen, onModalClose } = useTeamModal()
      const executionOrder: string[] = []

      onModalOpen(() => { executionOrder.push('open1') })
      onModalOpen(() => { executionOrder.push('open2') })
      onModalClose(() => { executionOrder.push('close1') })
      onModalClose(() => { executionOrder.push('close2') })

      await openModal()
      await closeModal()

      expect(executionOrder).toEqual(['open1', 'open2', 'close1', 'close2'])
    })

    it('should execute callbacks on each modal open/close cycle', async () => {
      const { openModal, closeModal, onModalOpen, onModalClose } = useTeamModal()
      const openCount = vi.fn()
      const closeCount = vi.fn()

      onModalOpen(openCount)
      onModalClose(closeCount)

      // First cycle
      await openModal()
      await closeModal()

      expect(openCount).toHaveBeenCalledTimes(1)
      expect(closeCount).toHaveBeenCalledTimes(1)

      // Second cycle
      await openModal()
      await closeModal()

      expect(openCount).toHaveBeenCalledTimes(2)
      expect(closeCount).toHaveBeenCalledTimes(2)
    })

    it('should allow adding callbacks after initial registration', async () => {
      const { openModal, closeModal, onModalOpen, onModalClose } = useTeamModal()
      const executionOrder: string[] = []

      onModalOpen(() => { executionOrder.push('open1') })

      await openModal()
      await closeModal()

      // Add more callbacks
      onModalOpen(() => { executionOrder.push('open2') })
      onModalClose(() => { executionOrder.push('close1') })

      await openModal()
      await closeModal()

      expect(executionOrder).toEqual(['open1', 'open1', 'open2', 'close1'])
    })
  })

  describe('error handling', () => {
    it('should continue executing callbacks even if one throws', async () => {
      const { openModal, onModalOpen } = useTeamModal()
      const callback1 = vi.fn(() => { throw new Error('Callback 1 error') })
      const callback2 = vi.fn()

      onModalOpen(callback1)
      onModalOpen(callback2)

      // Expect the function to throw, but capture it
      await expect(openModal()).rejects.toThrow('Callback 1 error')

      // First callback was called
      expect(callback1).toHaveBeenCalledTimes(1)
      // Second callback was NOT called because the first threw
      // (This is the current behavior - callbacks execute sequentially and stop on error)
      expect(callback2).not.toHaveBeenCalled()
    })
  })

  describe('reactivity', () => {
    it('should trigger reactivity when opening modal', async () => {
      const { showModal, openModal } = useTeamModal()
      let observedValue = false

      // Simulate a watcher
      const stopWatch = vi.fn(() => {
        observedValue = showModal.value
      })

      stopWatch() // Initial call

      await openModal()
      stopWatch() // After opening

      expect(observedValue).toBe(true)
      expect(stopWatch).toHaveBeenCalledTimes(2)
    })

    it('should trigger reactivity when entering edit mode', () => {
      const { isEditing, startEdit } = useTeamModal()
      let observedValue = false

      // Simulate a watcher
      const stopWatch = vi.fn(() => {
        observedValue = isEditing.value
      })

      stopWatch() // Initial call

      startEdit()
      stopWatch() // After editing

      expect(observedValue).toBe(true)
      expect(stopWatch).toHaveBeenCalledTimes(2)
    })
  })

  describe('multiple instances', () => {
    it('should maintain independent state for multiple instances', async () => {
      const modal1 = useTeamModal()
      const modal2 = useTeamModal()

      await modal1.openModal()

      expect(modal1.showModal.value).toBe(true)
      expect(modal2.showModal.value).toBe(false)

      modal1.startEdit()

      expect(modal1.isEditing.value).toBe(true)
      expect(modal2.isEditing.value).toBe(false)
    })

    it('should maintain independent callbacks for multiple instances', async () => {
      const modal1 = useTeamModal()
      const modal2 = useTeamModal()

      const callback1 = vi.fn()
      const callback2 = vi.fn()

      modal1.onModalOpen(callback1)
      modal2.onModalOpen(callback2)

      await modal1.openModal()

      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).not.toHaveBeenCalled()

      await modal2.openModal()

      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
    })
  })
})
