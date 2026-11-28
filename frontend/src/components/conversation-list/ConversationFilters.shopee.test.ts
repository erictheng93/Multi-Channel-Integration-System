import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConversationFilters from './ConversationFilters.vue'
import PlatformBadge from '@/components/ui/PlatformBadge.vue'

describe('Shopee in conversation UI', () => {
  it('platform filter offers Shopee and emits it', async () => {
    const wrapper = mount(ConversationFilters, { props: { filters: {} as never } })
    const select = wrapper.find('#conv-filter-platform')
    expect(select.findAll('option').map(o => o.text())).toContain('蝦皮')
    await select.setValue('shopee')
    expect(wrapper.emitted('update:filter')?.[0]).toEqual(['platform', 'shopee'])
  })

  it('badge shows the 蝦皮 label', () => {
    const wrapper = mount(PlatformBadge, { props: { platform: 'shopee' } })
    expect(wrapper.text()).toBe('蝦皮')
    expect(wrapper.classes()).toContain('platform-shopee')
  })
})
