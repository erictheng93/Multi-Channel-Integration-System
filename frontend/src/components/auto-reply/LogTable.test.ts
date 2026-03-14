import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LogTable from './LogTable.vue'
import type { AutoReplyLog, AutoReplyRule } from '@/api/autoReply'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMockLog(overrides: Partial<AutoReplyLog> = {}): AutoReplyLog {
  return {
    id: 1,
    rule_id: 1,
    rule_name: 'Test Rule',
    conversation_id: 'conv-1',
    customer_id: 1,
    trigger_content: 'hello',
    response_content: 'Hi there',
    matched_condition: 'contains:hello',
    platform: 'line',
    reply_method: 'reply_api',
    created_at: '2026-03-14T10:00:00Z',
    ...overrides,
  }
}

function makeMockRule(overrides: Partial<AutoReplyRule> = {}): AutoReplyRule {
  return {
    id: 1,
    teamId: 1,
    name: 'Test Rule',
    triggerType: 'keyword',
    priority: 100,
    isActive: true,
    createdBy: null,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    conditions: [],
    actions: [],
    ...overrides,
  }
}

const defaultPagination = { page: 1, limit: 20, total: 1 }

function mountTable(overrides: {
  logs?: AutoReplyLog[]
  rules?: AutoReplyRule[]
  pagination?: { page: number; limit: number; total: number }
  filterRuleId?: string
  filterPlatform?: string
} = {}) {
  return mount(LogTable, {
    props: {
      logs: overrides.logs ?? [makeMockLog()],
      rules: overrides.rules ?? [makeMockRule()],
      pagination: overrides.pagination ?? defaultPagination,
      filterRuleId: overrides.filterRuleId ?? '',
      filterPlatform: overrides.filterPlatform ?? '',
    },
  })
}

// ===========================================================================
// Rendering -- with data
// ===========================================================================

describe('LogTable -- rendering with data', () => {
  it('renders table with log rows', () => {
    const wrapper = mountTable({
      logs: [makeMockLog(), makeMockLog({ id: 2 })],
      pagination: { page: 1, limit: 20, total: 2 },
    })
    const rows = wrapper.find('.data-table tbody').findAll('tr')
    expect(rows).toHaveLength(2)
  })

  it('displays rule name in row', () => {
    const wrapper = mountTable({ logs: [makeMockLog({ rule_name: 'Welcome Rule' })] })
    expect(wrapper.find('.rule-name').text()).toBe('Welcome Rule')
  })

  it('displays trigger content', () => {
    const wrapper = mountTable({ logs: [makeMockLog({ trigger_content: 'hi there' })] })
    const triggerCells = wrapper.findAll('.col-trigger .truncated-text')
    expect(triggerCells[0]!.text()).toBe('hi there')
  })

  it('displays response content', () => {
    const wrapper = mountTable({ logs: [makeMockLog({ response_content: 'auto reply' })] })
    const responseCells = wrapper.findAll('.col-response .truncated-text')
    expect(responseCells[0]!.text()).toBe('auto reply')
  })

  it('displays platform label (LINE for line)', () => {
    const wrapper = mountTable({ logs: [makeMockLog({ platform: 'line' })] })
    const platformCell = wrapper.find('.platform-indicator')
    expect(platformCell.text()).toBe('LINE')
  })

  it('displays method label (Reply API for reply_api)', () => {
    const wrapper = mountTable({ logs: [makeMockLog({ reply_method: 'reply_api' })] })
    const methodBadge = wrapper.find('.method-badge')
    expect(methodBadge.text()).toBe('Reply API')
  })
})

// ===========================================================================
// Rendering -- empty state
// ===========================================================================

describe('LogTable -- empty state', () => {
  it('shows empty state when logs=[]', () => {
    const wrapper = mountTable({ logs: [], pagination: { page: 1, limit: 20, total: 0 } })
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })

  it('shows empty state message text', () => {
    const wrapper = mountTable({ logs: [], pagination: { page: 1, limit: 20, total: 0 } })
    expect(wrapper.find('.empty-title').text()).toContain('尚無回覆記錄')
  })
})

// ===========================================================================
// Filters
// ===========================================================================

describe('LogTable -- filters', () => {
  it('renders rule filter select', () => {
    const wrapper = mountTable()
    const selects = wrapper.findAll('.filter-select')
    expect(selects.length).toBeGreaterThanOrEqual(1)
  })

  it('renders platform filter select', () => {
    const wrapper = mountTable()
    const selects = wrapper.findAll('.filter-select')
    expect(selects.length).toBeGreaterThanOrEqual(2)
  })

  it('emits update:filterRuleId on rule filter change', async () => {
    const wrapper = mountTable({
      rules: [makeMockRule({ id: 5, name: 'Rule 5' })],
    })
    const selects = wrapper.findAll('.filter-select')
    // First select is rule filter
    await selects[0]!.setValue('5')

    expect(wrapper.emitted('update:filterRuleId')).toBeTruthy()
    expect(wrapper.emitted('update:filterRuleId')![0]).toEqual(['5'])
  })

  it('emits update:filterPlatform on platform filter change', async () => {
    const wrapper = mountTable()
    const selects = wrapper.findAll('.filter-select')
    // Second select is platform filter
    await selects[1]!.setValue('line')

    expect(wrapper.emitted('update:filterPlatform')).toBeTruthy()
    expect(wrapper.emitted('update:filterPlatform')![0]).toEqual(['line'])
  })
})

// ===========================================================================
// Pagination
// ===========================================================================

describe('LogTable -- pagination', () => {
  it('renders pagination when logs exist', () => {
    const wrapper = mountTable({
      logs: [makeMockLog()],
      pagination: { page: 1, limit: 20, total: 50 },
    })
    expect(wrapper.find('.pagination-footer').exists()).toBe(true)
  })

  it('emits page-change on next page click', async () => {
    const wrapper = mountTable({
      logs: [makeMockLog()],
      pagination: { page: 1, limit: 20, total: 50 },
    })
    // Find the "next page" button (last page-btn in pagination-buttons)
    const pageButtons = wrapper.findAll('.pagination-buttons .page-btn')
    const nextBtn = pageButtons[pageButtons.length - 1]! // last button is "下一頁"
    await nextBtn.trigger('click')

    expect(wrapper.emitted('page-change')).toBeTruthy()
    expect(wrapper.emitted('page-change')![0]).toEqual([2])
  })

  it('disables prev button on first page', () => {
    const wrapper = mountTable({
      logs: [makeMockLog()],
      pagination: { page: 1, limit: 20, total: 50 },
    })
    const pageButtons = wrapper.findAll('.pagination-buttons .page-btn')
    const prevBtn = pageButtons[0]! // first button is "上一頁"
    expect((prevBtn.element as HTMLButtonElement).disabled).toBe(true)
  })
})
