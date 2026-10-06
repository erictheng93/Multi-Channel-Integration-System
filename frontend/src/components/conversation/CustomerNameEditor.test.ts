import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

const updateCustomerName = vi.hoisted(() => vi.fn())
const applyCustomerUpdate = vi.hoisted(() => vi.fn())
vi.mock('@/api/customers', () => ({ updateCustomerName }))
vi.mock('@/stores/conversations', () => ({ useConversationsStore: () => ({ applyCustomerUpdate }) }))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ showError: vi.fn() }) }))

import CustomerNameEditor from './CustomerNameEditor.vue'

const mountIt = (customName: string | null = null) =>
  mount(CustomerNameEditor, {
    props: { customerId: 5, displayName: customName ?? 'Alice', customName, platformName: 'Alice', platform: 'line' }
  })

describe('CustomerNameEditor', () => {
  beforeEach(() => {
    updateCustomerName.mockReset().mockResolvedValue({})
    applyCustomerUpdate.mockReset()
  })

  it('shows platform name only when a nickname is set', () => {
    expect(mountIt().text()).not.toContain('LINE 名稱')
    expect(mountIt('小美').text()).toContain('LINE 名稱：Alice')
  })

  it('Esc cancels without calling the API', async () => {
    const w = mountIt()
    await w.find('button.edit-btn').trigger('click')
    await w.find('input').setValue('x')
    await w.find('input').trigger('keydown.esc')
    expect(w.find('input').exists()).toBe(false)
    expect(updateCustomerName).not.toHaveBeenCalled()
  })

  it('Enter saves the trimmed value', async () => {
    const w = mountIt()
    await w.find('button.edit-btn').trigger('click')
    await w.find('input').setValue('  小美  ')
    await w.find('input').trigger('keydown.enter')
    expect(updateCustomerName).toHaveBeenCalledWith(5, '小美')
  })

  it('empty input sends null', async () => {
    const w = mountIt('小美')
    await w.find('button.edit-btn').trigger('click')
    await w.find('input').setValue('   ')
    await w.find('input').trigger('keydown.enter')
    expect(updateCustomerName).toHaveBeenCalledWith(5, null)
  })

  it('rolls back on error', async () => {
    updateCustomerName.mockRejectedValue(new Error('boom'))
    const w = mountIt()
    await w.find('button.edit-btn').trigger('click')
    await w.find('input').setValue('N')
    await w.find('input').trigger('keydown.enter')
    await new Promise(r => setTimeout(r))
    expect(applyCustomerUpdate).toHaveBeenCalledTimes(2)
    expect(applyCustomerUpdate.mock.calls[1]?.[0].customName).toBeNull()
  })
})
