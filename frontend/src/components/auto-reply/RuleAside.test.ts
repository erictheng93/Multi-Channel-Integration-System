import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RuleAside from './RuleAside.vue'
import type { AutoReplyLog, AutoReplyRule } from '@/api/autoReply'

const rule = (over: Partial<AutoReplyRule>): AutoReplyRule => ({
  id: 1,
  teamId: null,
  name: '報價詢問',
  triggerType: 'keyword',
  priority: 10,
  isActive: true,
  allowPushFallback: false,
  createdBy: 'a',
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
  conditions: [{ id: 1, conditionType: 'contains', value: '報價', caseSensitive: false, matchMode: 'any' }],
  actions: [{ id: 1, actionType: 'reply_text', content: '請提供規格', sortOrder: 0 }],
  ...over,
} as AutoReplyRule)

const log = (id: number): AutoReplyLog => ({
  id,
  rule_id: 1,
  rule_name: '報價詢問',
  conversation_id: 'c',
  customer_id: 1,
  trigger_content: `問 ${id}`,
  response_content: 'x',
  matched_condition: 'contains',
  platform: 'line',
  reply_method: 'reply_api',
  created_at: new Date().toISOString(),
})

function mountAside(logs: AutoReplyLog[] = [], isBusinessHours = true) {
  return mount(RuleAside, { props: { rules: [rule({})], logs, isBusinessHours } })
}

describe('RuleAside', () => {
  it('explains itself until something is typed', () => {
    const wrapper = mountAside()
    expect(wrapper.find('.tester-hint').exists()).toBe(true)
    expect(wrapper.find('.verdict').exists()).toBe(false)
  })

  it('names the rule that would answer the typed message and its reply', async () => {
    const wrapper = mountAside()
    await wrapper.find('input').setValue('請問報價')
    expect(wrapper.find('.verdict-rule strong').text()).toBe('報價詢問')
    expect(wrapper.find('.verdict-reply').text()).toBe('請提供規格')
  })

  it('says so when no rule would answer', async () => {
    const wrapper = mountAside()
    await wrapper.find('input').setValue('你好')
    expect(wrapper.find('.verdict-none').exists()).toBe(true)
  })

  it('opens the winning rule on click', async () => {
    const wrapper = mountAside()
    await wrapper.find('input').setValue('報價')
    await wrapper.find('.verdict-rule').trigger('click')
    expect(wrapper.emitted('open-rule')?.[0]).toEqual([1])
  })

  it('lists at most four recent triggers and links to the log tab', async () => {
    const wrapper = mountAside([1, 2, 3, 4, 5, 6, 7].map(log))
    expect(wrapper.findAll('.recent-list li')).toHaveLength(4)
    await wrapper.find('.aside-link').trigger('click')
    expect(wrapper.emitted('open-logs')).toHaveLength(1)
  })

  it('shows an empty line when nothing has fired yet', () => {
    expect(mountAside().find('.recent-empty').exists()).toBe(true)
  })
})
