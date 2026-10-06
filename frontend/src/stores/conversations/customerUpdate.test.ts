import { describe, it, expect } from 'vitest'
import type { Conversation } from '@/types'
import { applyCustomerUpdate } from './helpers'

const mk = (id: string, customerId: string, name: string) =>
  ({
    id,
    userId: customerId,
    customer: { id: customerId, name, platform: 'line', platformUserId: 'U', createdAt: 0 },
    customerName: name
  }) as unknown as Conversation

describe('applyCustomerUpdate', () => {
  it('patches all matching conversations and leaves others', () => {
    const list = [mk('c1', '7', 'Old'), mk('c2', '7', 'Old'), mk('c3', '8', 'Other')]
    const n = applyCustomerUpdate(list, null, { customerId: 7, customName: 'VIP', platformName: 'Old', name: 'VIP' })
    expect(n).toBe(2)
    for (const c of list.slice(0, 2)) {
      expect(c.customer?.name).toBe('VIP')
      expect((c as unknown as { customerName: string }).customerName).toBe('VIP')
      expect((c.customer as unknown as { customName: string }).customName).toBe('VIP')
      expect((c.customer as unknown as { platformName: string }).platformName).toBe('Old')
    }
    expect(list[2]?.customer?.name).toBe('Other')
  })

  it('patches a current conversation that is not in the list', () => {
    const current = mk('c9', '7', 'Old')
    expect(applyCustomerUpdate([], current, { customerId: 7, customName: null, platformName: 'Old', name: 'Old' })).toBe(1)
  })
})
