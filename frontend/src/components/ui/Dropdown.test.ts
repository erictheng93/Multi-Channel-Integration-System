import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import Dropdown from './Dropdown.vue'

const stubs = { ChevronDownIcon: true }
let wrapper: VueWrapper | undefined

// attachTo body so teleported menu and getElementById behave like a real page
const mountDropdown = (props = {}, slot = '<span data-testid="item">Item</span>') => {
  wrapper = mount(Dropdown, {
    props,
    slots: { default: slot },
    global: { stubs },
    attachTo: document.body
  })
  return wrapper
}

const trigger = () => document.querySelector<HTMLElement>('[role="button"]')!
const menu = () => document.querySelector<HTMLElement>('[role="menu"]')

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('Dropdown', () => {
  it('is closed by default', () => {
    mountDropdown()
    expect(menu()).toBeNull()
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
  })

  it('opens on trigger click and renders slot content', async () => {
    mountDropdown()
    await trigger().click()
    await wrapper!.vm.$nextTick()
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(menu()?.querySelector('[data-testid="item"]')).not.toBeNull()
  })

  it('wires aria-labelledby to the trigger id', async () => {
    mountDropdown()
    await trigger().click()
    await wrapper!.vm.$nextTick()
    const labelledBy = menu()!.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(trigger().id).toBe(labelledBy)
    expect(document.getElementById(labelledBy!)).toBe(trigger())
  })

  it('gives two instances in one app different trigger ids', () => {
    const Parent = defineComponent({ render: () => h('div', [h(Dropdown), h(Dropdown)]) })
    wrapper = mount(Parent, { global: { stubs }, attachTo: document.body }) as VueWrapper
    const ids = [...document.querySelectorAll('[role="button"]')].map(el => el.id)
    expect(ids).toHaveLength(2)
    expect(ids[0]).toBeTruthy()
    expect(ids[0]).not.toBe(ids[1])
  })

  it('does not open when disabled', async () => {
    mountDropdown({ disabled: true })
    await trigger().click()
    await wrapper!.vm.$nextTick()
    expect(menu()).toBeNull()
    expect(trigger().getAttribute('aria-disabled')).toBe('true')
    expect(trigger().getAttribute('tabindex')).toBe('-1')
  })

  it('opens with Enter on the trigger and closes with Escape on the menu', async () => {
    mountDropdown()
    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await wrapper!.vm.$nextTick()
    expect(menu()).not.toBeNull()

    menu()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper!.vm.$nextTick()
    expect(menu()).toBeNull()
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
  })

  it('mounts without crypto.randomUUID', async () => {
    vi.stubGlobal('crypto', {})
    expect(() => mountDropdown()).not.toThrow()
    expect(trigger().id).toBeTruthy()
  })

  describe('focus on close', () => {
    const itemSlot = '<template #default="{ close }"><button data-testid="item" @click="close">Item</button></template>'
    const item = () => document.querySelector<HTMLElement>('[data-testid="item"]')!

    const openWithFocusInMenu = async () => {
      mountDropdown({}, itemSlot)
      trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await wrapper!.vm.$nextTick()
      await wrapper!.vm.$nextTick() // open() registers the outside-click listener after a tick
      item().focus()
      expect(document.activeElement).toBe(item())
    }

    it('returns focus to the trigger when Escape closes the menu', async () => {
      await openWithFocusInMenu()
      menu()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await wrapper!.vm.$nextTick()
      expect(menu()).toBeNull()
      expect(document.activeElement).toBe(trigger())
    })

    it('returns focus to the trigger when an item calls the slot close', async () => {
      await openWithFocusInMenu()
      item().click()
      await wrapper!.vm.$nextTick()
      expect(menu()).toBeNull()
      expect(document.activeElement).toBe(trigger())
    })

    it('does not steal focus from an outside control on click-outside', async () => {
      await openWithFocusInMenu()
      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()
      input.click()
      await wrapper!.vm.$nextTick()
      expect(menu()).toBeNull()
      expect(document.activeElement).toBe(input)
    })

    it('restores focus to the trigger when focus fell to body (WebKit button click)', async () => {
      await openWithFocusInMenu()
      item().blur()
      expect(document.activeElement).toBe(document.body)
      item().click()
      await wrapper!.vm.$nextTick()
      expect(menu()).toBeNull()
      expect(document.activeElement).toBe(trigger())
    })

    it('does not move focus when close() is called on a closed dropdown', async () => {
      const w = mountDropdown({}, itemSlot)
      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()
      ;(w.vm as unknown as { close: () => void }).close()
      expect(document.activeElement).toBe(input)
      document.body.focus()
      ;(w.vm as unknown as { close: () => void }).close()
      expect(document.activeElement).not.toBe(trigger())
    })
  })
})
