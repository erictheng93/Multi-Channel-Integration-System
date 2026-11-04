/* eslint-disable no-unused-vars */
import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import NotificationCard from '../NotificationCard.vue'
import type { Notification } from '@/stores/notifications'

const notification = {
  id: 'n1',
  type: 'new_message',
  title: 'T',
  content: 'C',
  priority: 'normal',
  isRead: false,
  createdAt: new Date().toISOString()
} as unknown as Notification

type Rect = ReturnType<Element['getBoundingClientRect']>
function rect(top: number, bottom: number): Rect {
  return { top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON: () => ({}) } as Rect
}

describe('NotificationCard overflow menu', () => {
  const spy = Element.prototype.getBoundingClientRect
  afterEach(() => { Element.prototype.getBoundingClientRect = spy })

  async function open(triggerBottom: number, containerBottom: number): Promise<boolean> {
    const host = document.createElement('div')
    host.className = 'notif-main'
    document.body.appendChild(host)
    Element.prototype.getBoundingClientRect = function (this: Element): Rect {
      if (this.classList.contains('notif-main')) { return rect(0, containerBottom) }
      if (this.classList.contains('notification-more')) { return rect(triggerBottom - 44, triggerBottom) }
      if (this.classList.contains('more-menu')) { return rect(0, 100) }
      return rect(0, 0)
    }
    const wrapper = mount(NotificationCard, {
      attachTo: host,
      props: { notification, index: 0, isFocused: false }
    })
    await wrapper.get('.more-btn').trigger('click')
    await nextTick()
    await nextTick()
    const up = wrapper.get('.more-menu').classes().includes('is-up')
    wrapper.unmount()
    host.remove()
    return up
  }

  it('opens upward when the container would clip it below', async () => {
    expect(await open(480, 500)).toBe(true)
  })

  it('opens downward when there is room', async () => {
    expect(await open(200, 800)).toBe(false)
  })
})
