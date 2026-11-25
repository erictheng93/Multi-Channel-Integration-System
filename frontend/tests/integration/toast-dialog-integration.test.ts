import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { useToast } from '@/composables/useToast'
import { useConfirmDialog } from '@/composables/useConfirmDialog'

/**
 * Integration of the useToast / useConfirmDialog singletons with the real
 * Toast.vue / ConfirmDialog.vue components mounted into document.body.
 *
 * The composables unmount and detach their DOM 300ms after a close, so all
 * timing here runs on fake timers instead of real sleeps.
 */

const REMOVE_DELAY_MS = 300

describe('Toast and ConfirmDialog integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(async () => {
    useToast().clearToasts()
    useConfirmDialog().clearDialogs()
    await vi.advanceTimersByTimeAsync(REMOVE_DELAY_MS + 1)
    vi.useRealTimers()
    // Nothing may leak into the next test through the singletons
    expect(document.querySelectorAll('.toast-container')).toHaveLength(0)
    expect(document.querySelectorAll('.dialog-overlay')).toHaveLength(0)
  })

  describe('useToast', () => {
    it.each([
      ['showSuccess', 'toast-success'],
      ['showError', 'toast-error'],
      ['showWarning', 'toast-warning'],
      ['showInfo', 'toast-info']
    ] as const)('%s renders title, description and the %s class', async (method, cls) => {
      useToast()[method]('Title text', 'Description text')
      await nextTick()

      const toast = document.querySelector('.toast-container')
      expect(toast).toBeTruthy()
      expect(toast?.textContent).toContain('Title text')
      expect(toast?.textContent).toContain('Description text')
      expect(toast?.classList.contains(cls)).toBe(true)
    })

    it('stacks one container per toast', async () => {
      const { showSuccess, showError } = useToast()

      showSuccess('one')
      showError('two')
      showSuccess('three')
      await nextTick()

      expect(document.querySelectorAll('.toast-container')).toHaveLength(3)
    })

    it('auto-closes after its duration and removes the DOM after the exit animation delay', async () => {
      useToast().showSuccess('timed', undefined, { duration: 1000 })
      await nextTick()
      expect(document.querySelectorAll('.toast-container')).toHaveLength(1)

      await vi.advanceTimersByTimeAsync(999)
      expect(document.querySelectorAll('.toast-container')).toHaveLength(1)

      await vi.advanceTimersByTimeAsync(1 + REMOVE_DELAY_MS)
      expect(document.querySelectorAll('.toast-container')).toHaveLength(0)
    })

    it('error toasts stay longer than the default 4s toast', async () => {
      const { showSuccess, showError } = useToast()
      showSuccess('default duration')
      showError('error duration')
      await nextTick()

      await vi.advanceTimersByTimeAsync(4000 + REMOVE_DELAY_MS + 1)

      const remaining = document.querySelectorAll('.toast-container')
      expect(remaining).toHaveLength(1)
      expect(remaining[0]?.classList.contains('toast-error')).toBe(true)
    })

    it('clearToasts removes every toast', async () => {
      const { showSuccess, clearToasts } = useToast()
      showSuccess('Toast 1')
      showSuccess('Toast 2')
      showSuccess('Toast 3')
      await nextTick()
      expect(document.querySelectorAll('.toast-container')).toHaveLength(3)

      clearToasts()
      await vi.advanceTimersByTimeAsync(REMOVE_DELAY_MS + 1)

      expect(document.querySelectorAll('.toast-container')).toHaveLength(0)
    })
  })

  describe('useConfirmDialog', () => {
    it('shows a confirm dialog with title and message', async () => {
      const promise = useConfirmDialog().showConfirm({
        title: 'Confirm action',
        message: 'Are you sure?'
      })
      await nextTick()

      const dialog = document.querySelector('.dialog-overlay')
      expect(dialog).toBeTruthy()
      expect(dialog?.textContent).toContain('Confirm action')
      expect(dialog?.textContent).toContain('Are you sure?')

      useConfirmDialog().clearDialogs()
      await promise
    })

    it.each([
      ['showWarning', 'dialog-warning'],
      ['showDanger', 'dialog-danger']
    ] as const)('%s renders the %s variant', async (method, cls) => {
      const promise = useConfirmDialog()[method]('Heads up', 'Cannot be undone')
      await nextTick()

      const dialog = document.querySelector('.dialog-container')
      expect(dialog?.classList.contains(cls)).toBe(true)

      useConfirmDialog().clearDialogs()
      await promise
    })

    it('resolves true when the primary button is clicked', async () => {
      const promise = useConfirmDialog().showConfirm({ title: 'Confirm' })
      await nextTick()

      const confirmBtn = document.querySelector('.dialog-btn-primary') as HTMLButtonElement
      expect(confirmBtn).toBeTruthy()
      confirmBtn.click()

      await expect(promise).resolves.toBe(true)
    })

    it('resolves false when the secondary button is clicked', async () => {
      const promise = useConfirmDialog().showDanger('Delete everything?', 'No way back')
      await nextTick()

      const cancelBtn = document.querySelector('.dialog-btn-secondary') as HTMLButtonElement
      expect(cancelBtn).toBeTruthy()
      cancelBtn.click()

      await expect(promise).resolves.toBe(false)
    })

    it('clearDialogs resolves every pending dialog with false and removes the DOM', async () => {
      const { showConfirm, clearDialogs } = useConfirmDialog()
      const promise1 = showConfirm({ title: 'Dialog 1' })
      const promise2 = showConfirm({ title: 'Dialog 2' })
      await nextTick()
      expect(document.querySelectorAll('.dialog-overlay').length).toBeGreaterThan(0)

      clearDialogs()

      await expect(Promise.all([promise1, promise2])).resolves.toEqual([false, false])
      await vi.advanceTimersByTimeAsync(REMOVE_DELAY_MS + 1)
      expect(document.querySelectorAll('.dialog-overlay')).toHaveLength(0)
    })
  })
})
