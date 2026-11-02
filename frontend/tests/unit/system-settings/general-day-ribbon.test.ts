import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { RouterLinkStub } from '@vue/test-utils'
import GeneralDayRibbon from '@/components/system-settings/GeneralDayRibbon.vue'

const status = { tone: 'green' as const, text: '5 項正常，Webhook 待測', to: '/settings/maintenance/health' }

function mountRibbon(timezone: string, events: Array<{ key: string, at: number, what: string, icon: string, tone: 'green' | 'red' | 'accent', future?: boolean }>) {
  return mount(GeneralDayRibbon, {
    props: { modelValue: timezone, formId: 'settings-form', status, events },
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

describe('GeneralDayRibbon', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 01:30 UTC = 09:30 in Taipei, 10:30 in Tokyo
    vi.setSystemTime(new Date('2026-11-02T01:30:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('reads the current time in the selected zone', () => {
    expect(mountRibbon('Asia/Taipei', []).find('.rb-bubble').text()).toBe('09:30')
    expect(mountRibbon('Asia/Tokyo', []).find('.rb-bubble').text()).toBe('10:30')
  })

  it('places an instant on the ribbon and words it in the zone, with a pin only when it falls on that day', () => {
    const backup = { key: 'b', at: new Date('2026-11-01T19:00:00Z').getTime(), what: '自動備份完成', icon: '', tone: 'green' as const }
    const taipei = mountRibbon('Asia/Taipei', [backup])
    expect(taipei.findAll('.rb-pin')).toHaveLength(1)
    expect(taipei.find('.rb-legend').text()).toContain('今天 03:00')
    const tokyo = mountRibbon('Asia/Tokyo', [backup])
    expect(tokyo.find('.rb-legend').text()).toContain('今天 04:00')
    // 2026-11-01T10:00Z is the day before in UTC (it is now 01:30 UTC on the 2nd)
    const yesterday = { ...backup, at: new Date('2026-11-01T10:00:00Z').getTime() }
    const utc = mountRibbon('UTC', [yesterday])
    expect(utc.findAll('.rb-pin')).toHaveLength(0)
    expect(utc.find('.rb-legend').text()).toContain('昨天 10:00')
  })

  it('hands the picked zone to the parent', async () => {
    const wrapper = mountRibbon('Asia/Taipei', [])
    await wrapper.find('#timezone').setValue('UTC')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['UTC'])
    expect(wrapper.find('#timezone').attributes('form')).toBe('settings-form')
  })
})
