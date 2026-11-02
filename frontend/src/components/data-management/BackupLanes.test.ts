import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BackupLanes from './BackupLanes.vue'
import type { BackupItem, BackupPolicy } from '@/api/backup'

const DAY = 24 * 3600 * 1000
const item = (tier: string, daysAgo: number, size = 1_000_000): BackupItem => ({
  key: `${tier}/${tier}-${daysAgo}.sql.gz`,
  tier,
  size,
  uploaded: new Date(Date.now() - daysAgo * DAY).toISOString(),
})

const policy = {
  source: 'configuration-constants',
  note: '',
  schedule: { cron: '0 19 * * *', timezone: 'Asia/Taipei', localTime: '03:00', description: '' },
  retentionDays: { daily: 30, monthly: 365, manual: 90, members: 30, tags: 30, assignments: 30 },
} as unknown as BackupPolicy

function mountLanes(items: BackupItem[]) {
  return mount(BackupLanes, { props: { kicker: '最近自動備份', value: '今天 03:00', items, policy } })
}

describe('BackupLanes', () => {
  it('draws one lane per kind of backup that exists, with a tick per file', () => {
    const wrapper = mountLanes([item('daily', 0), item('daily', 1), item('daily', 2), item('monthly', 1), item('tags', 0)])
    const lanes = wrapper.findAll('.lane')
    expect(lanes.map((l) => l.find('.lane-name b').text())).toEqual(['每日', '每月', '資料匯出'])
    expect(lanes[0]?.findAll('.lane-tick')).toHaveLength(3)
    expect(lanes[0]?.find('.lane-n').text()).toContain('3 份')
    expect(lanes[0]?.find('.lane-name small').text()).toBe('保留 30 天')
  })

  it('puts today on the right and the oldest mark on the left of the axis', () => {
    const wrapper = mountLanes([item('daily', 0), item('monthly', 40)])
    const labels = wrapper.findAll('.axis span').map((s) => s.text())
    expect(labels[0]).toBe('1 年')
    expect(labels[labels.length - 1]).toBe('今天')
    const ticks = wrapper.findAll('.lane')[0]?.findAll('.lane-tick') ?? []
    expect(parseFloat(ticks[0]?.attributes('style')?.replace('left: ', '') ?? '0')).toBeGreaterThan(99.9)
  })

  it('shows the headline figures and no lanes when there are no files', () => {
    const wrapper = mountLanes([])
    expect(wrapper.find('.hero-lanes').exists()).toBe(false)
    expect(wrapper.find('.hero-facts').exists()).toBe(false)
    const full = mountLanes([item('daily', 0, 2_000_000), item('manual', 3, 3_000_000)])
    expect(full.find('.hero-facts').text()).toContain('2 份')
  })
})
