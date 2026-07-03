import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BroadcastComposeCard from '@/components/broadcast/BroadcastComposeCard.vue'

const tags = [
  { id: 10, name: 'Manufacturing', color: '#111111', usageCount: 12, isActive: true },
  { id: 20, name: 'Retail', color: '#222222', usageCount: 8, isActive: true }
]

const preview = {
  total: 12,
  byPlatform: { line: 10, facebook: 2 },
  sendable: 10,
  skipped: []
}

describe('BroadcastComposeCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('emits preview when a tag is selected without requiring title or content', async () => {
    const wrapper = mount(BroadcastComposeCard, {
      props: {
        tags,
        preview: null,
        previewTagId: null,
        previewLoading: false,
        sending: false,
        error: null
      }
    })

    await wrapper.find('select').setValue('10')

    expect(wrapper.emitted('preview')?.[0]).toEqual([{ tagIds: [10] }])
  })

  it('does not send when the current preview belongs to a different tag', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mount(BroadcastComposeCard, {
      props: {
        tags,
        preview,
        previewTagId: 10,
        previewLoading: false,
        sending: false,
        error: null
      }
    })

    await wrapper.find('input').setValue('Campaign')
    await wrapper.find('textarea').setValue('Hello customers')
    await wrapper.find('select').setValue('20')
    await wrapper.find('form').trigger('submit')

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(wrapper.emitted('send')).toBeUndefined()
    expect(wrapper.emitted('preview')?.at(-1)).toEqual([{ tagIds: [20] }])
  })
})
