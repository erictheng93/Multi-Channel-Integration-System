import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'

let wrapper: VueWrapper | undefined
let opener: HTMLButtonElement | undefined

// A control behind the dialog that owns focus when the dialog opens
const mountDialog = async (props: Record<string, unknown> = {}) => {
  opener = document.createElement('button')
  opener.textContent = 'open'
  document.body.appendChild(opener)
  opener.focus()
  wrapper = mount(ConfirmDialog, {
    props: { title: 'Delete team?', message: 'Cannot be undone', ...props },
    attachTo: document.body
  })
  await nextTick()
  await nextTick()
  return wrapper
}

const dialog = () => document.querySelector<HTMLElement>('.dialog-container')!
const buttons = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.dialog-btn'))
const press = (key: string, shiftKey = false) => {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })
  document.activeElement!.dispatchEvent(event)
  return event
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('ConfirmDialog focus management', () => {
  it('moves focus to the cancel button for a danger dialog', async () => {
    await mountDialog({ type: 'danger' })
    expect(document.activeElement).toBe(buttons()[0])
  })

  it('moves focus to the cancel button for a warning dialog', async () => {
    await mountDialog({ type: 'warning' })
    expect(document.activeElement).toBe(buttons()[0])
  })

  it('moves focus to the confirm button for a default dialog', async () => {
    await mountDialog()
    expect(document.activeElement).toBe(buttons()[1])
  })

  it('wraps Tab from the last button to the first', async () => {
    await mountDialog()
    buttons()[1]!.focus()
    const event = press('Tab')
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(buttons()[0])
  })

  it('wraps Shift+Tab from the first button to the last', async () => {
    await mountDialog()
    buttons()[0]!.focus()
    const event = press('Tab', true)
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(buttons()[1])
  })

  it('pulls focus back into the dialog if it is outside when Tab is pressed', async () => {
    await mountDialog()
    opener!.focus()
    press('Tab')
    expect(dialog().contains(document.activeElement)).toBe(true)
  })

  it('cancels on Escape', async () => {
    const w = await mountDialog()
    press('Escape')
    expect(w.emitted('cancel')).toHaveLength(1)
  })

  it('restores focus to the previously focused element on close', async () => {
    const w = await mountDialog()
    buttons()[0]!.click()
    await nextTick()
    expect(w.emitted('close')).toHaveLength(1)
    expect(document.activeElement).toBe(opener)
  })

  it('lets only the topmost of two stacked dialogs handle Escape', async () => {
    const first = await mountDialog()
    const second = mount(ConfirmDialog, { props: { title: 'Second?' }, attachTo: document.body })
    await nextTick()
    await nextTick()

    press('Escape')
    expect(second.emitted('cancel')).toHaveLength(1)
    expect(first.emitted('cancel')).toBeUndefined()

    second.unmount()
    press('Escape')
    expect(first.emitted('cancel')).toHaveLength(1)
  })

  it('returns focus to where the launcher left it, not the element focused at mount', async () => {
    // A menu item has focus at mount; the menu then closes and focuses its trigger before the dialog takes focus
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    const item = document.createElement('button')
    document.body.appendChild(item)
    item.focus()
    wrapper = mount(ConfirmDialog, { props: { title: 'Delete team?', type: 'danger' }, attachTo: document.body })
    item.remove()
    trigger.focus()
    await nextTick()
    await nextTick()

    buttons()[0]!.click()
    await nextTick()
    expect(document.activeElement).toBe(trigger)
  })

  it('exposes dialog semantics wired to the title and message', async () => {
    await mountDialog()
    const el = dialog()
    expect(el.getAttribute('role')).toBe('alertdialog')
    expect(el.getAttribute('aria-modal')).toBe('true')
    const title = document.getElementById(el.getAttribute('aria-labelledby')!)
    const message = document.getElementById(el.getAttribute('aria-describedby')!)
    expect(title?.textContent).toContain('Delete team?')
    expect(message?.textContent).toContain('Cannot be undone')
  })
})
