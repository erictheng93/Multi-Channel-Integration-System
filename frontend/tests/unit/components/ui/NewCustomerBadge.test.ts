import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import NewCustomerBadge from '@/components/ui/NewCustomerBadge.vue'

describe('NewCustomerBadge.vue', () => {
  let mockNow: number

  beforeEach(() => {
    // Fix "now" to 2025-01-28 12:00:00 UTC
    mockNow = new Date('2025-01-28T12:00:00Z').getTime()
    vi.useFakeTimers()
    vi.setSystemTime(mockNow)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('顯示邏輯', () => {
    it('應該在 7 天內顯示新客戶標記', () => {
      // 3 days ago
      const createdAt = new Date('2025-01-25T12:00:00Z').getTime()

      const wrapper = mount(NewCustomerBadge, {
        props: { createdAt }
      })

      expect(wrapper.find('.new-customer-badge').exists()).toBe(true)
      expect(wrapper.text()).toContain('新客戶')
    })

    it('應該在剛好 7 天時顯示新客戶標記', () => {
      // Exactly 7 days ago
      const createdAt = new Date('2025-01-21T12:00:00Z').getTime()

      const wrapper = mount(NewCustomerBadge, {
        props: { createdAt }
      })

      expect(wrapper.find('.new-customer-badge').exists()).toBe(true)
    })

    it('應該在超過 7 天時不顯示標記', () => {
      // 8 days ago
      const createdAt = new Date('2025-01-20T12:00:00Z').getTime()

      const wrapper = mount(NewCustomerBadge, {
        props: { createdAt }
      })

      expect(wrapper.find('.new-customer-badge').exists()).toBe(false)
    })

    it('應該在今天加入時顯示標記', () => {
      // Today
      const createdAt = new Date('2025-01-28T08:00:00Z').getTime()

      const wrapper = mount(NewCustomerBadge, {
        props: { createdAt }
      })

      expect(wrapper.find('.new-customer-badge').exists()).toBe(true)
    })

    it('應該在 createdAt 為 undefined 時不顯示', () => {
      const wrapper = mount(NewCustomerBadge, {
        props: { createdAt: undefined as unknown as number }
      })

      expect(wrapper.find('.new-customer-badge').exists()).toBe(false)
    })
  })

  describe('自訂 thresholdDays', () => {
    it('應該支援自訂天數閾值', () => {
      // 10 days ago, but threshold is 14 days
      const createdAt = new Date('2025-01-18T12:00:00Z').getTime()

      const wrapper = mount(NewCustomerBadge, {
        props: {
          createdAt,
          thresholdDays: 14
        }
      })

      expect(wrapper.find('.new-customer-badge').exists()).toBe(true)
    })

    it('應該在超過自訂閾值時不顯示', () => {
      // 5 days ago, but threshold is 3 days
      const createdAt = new Date('2025-01-23T12:00:00Z').getTime()

      const wrapper = mount(NewCustomerBadge, {
        props: {
          createdAt,
          thresholdDays: 3
        }
      })

      expect(wrapper.find('.new-customer-badge').exists()).toBe(false)
    })
  })

  describe('Compact 模式', () => {
    it('應該在非 compact 模式顯示文字', () => {
      const createdAt = new Date('2025-01-27T12:00:00Z').getTime()

      const wrapper = mount(NewCustomerBadge, {
        props: { createdAt, compact: false }
      })

      expect(wrapper.find('.badge-text').exists()).toBe(true)
      expect(wrapper.text()).toContain('新客戶')
    })

    it('應該在 compact 模式只顯示圖標', () => {
      const createdAt = new Date('2025-01-27T12:00:00Z').getTime()

      const wrapper = mount(NewCustomerBadge, {
        props: { createdAt, compact: true }
      })

      expect(wrapper.find('.badge-icon').exists()).toBe(true)
      expect(wrapper.find('.badge-text').exists()).toBe(false)
    })

    it('應該在 compact 模式仍顯示加入時間文字', () => {
      const createdAt = new Date('2025-01-28T08:00:00Z').getTime()

      const wrapper = mount(NewCustomerBadge, {
        props: { createdAt, compact: true, showJoinedTime: true }
      })

      // Compact mode: icon only, no badge text
      expect(wrapper.find('.badge-icon').exists()).toBe(true)
      expect(wrapper.find('.badge-text').exists()).toBe(false)
      // But joined time should still show
      expect(wrapper.find('.joined-time').exists()).toBe(true)
      expect(wrapper.find('.joined-time').text()).toBe('今天加入')
    })

    it('應該在 compact + 隱藏時間模式下只顯示圖標', () => {
      const createdAt = new Date('2025-01-28T08:00:00Z').getTime()

      const wrapper = mount(NewCustomerBadge, {
        props: { createdAt, compact: true, showJoinedTime: false }
      })

      // Only icon, no text at all
      expect(wrapper.find('.badge-icon').exists()).toBe(true)
      expect(wrapper.find('.badge-text').exists()).toBe(false)
      expect(wrapper.find('.joined-time').exists()).toBe(false)
    })
  })

  describe('尺寸', () => {
    it('應該支援 small 尺寸', () => {
      const createdAt = new Date('2025-01-27T12:00:00Z').getTime()

      const wrapper = mount(NewCustomerBadge, {
        props: { createdAt, size: 'small' }
      })

      expect(wrapper.find('.new-customer-wrapper.small').exists()).toBe(true)
    })

    it('應該支援 medium 尺寸', () => {
      const createdAt = new Date('2025-01-27T12:00:00Z').getTime()

      const wrapper = mount(NewCustomerBadge, {
        props: { createdAt, size: 'medium' }
      })

      expect(wrapper.find('.new-customer-wrapper.medium').exists()).toBe(true)
    })

    it('應該在 small 尺寸下同時顯示徽章和加入時間', () => {
      const createdAt = new Date('2025-01-27T12:00:00Z').getTime()

      const wrapper = mount(NewCustomerBadge, {
        props: { createdAt, size: 'small' }
      })

      expect(wrapper.find('.new-customer-wrapper.small .new-customer-badge').exists()).toBe(true)
      expect(wrapper.find('.new-customer-wrapper.small .joined-time').exists()).toBe(true)
    })

    it('應該在 medium 尺寸下同時顯示徽章和加入時間', () => {
      const createdAt = new Date('2025-01-27T12:00:00Z').getTime()

      const wrapper = mount(NewCustomerBadge, {
        props: { createdAt, size: 'medium' }
      })

      expect(wrapper.find('.new-customer-wrapper.medium .new-customer-badge').exists()).toBe(true)
      expect(wrapper.find('.new-customer-wrapper.medium .joined-time').exists()).toBe(true)
    })
  })

  describe('加入時間文字', () => {
    it('應該在今天加入時顯示「今天加入」', () => {
      const createdAt = new Date('2025-01-28T08:00:00Z').getTime()

      const wrapper = mount(NewCustomerBadge, {
        props: { createdAt }
      })

      expect(wrapper.find('.joined-time').exists()).toBe(true)
      expect(wrapper.find('.joined-time').text()).toBe('今天加入')
    })

    it('應該在昨天加入時顯示「昨天加入」', () => {
      const createdAt = new Date('2025-01-27T08:00:00Z').getTime()

      const wrapper = mount(NewCustomerBadge, {
        props: { createdAt }
      })

      expect(wrapper.find('.joined-time').exists()).toBe(true)
      expect(wrapper.find('.joined-time').text()).toBe('昨天加入')
    })

    it('應該在多天前加入時顯示「X 天前加入」', () => {
      const createdAt = new Date('2025-01-25T08:00:00Z').getTime()

      const wrapper = mount(NewCustomerBadge, {
        props: { createdAt }
      })

      expect(wrapper.find('.joined-time').exists()).toBe(true)
      expect(wrapper.find('.joined-time').text()).toBe('3 天前加入')
    })

    it('應該可以隱藏加入時間文字', () => {
      const createdAt = new Date('2025-01-28T08:00:00Z').getTime()

      const wrapper = mount(NewCustomerBadge, {
        props: { createdAt, showJoinedTime: false }
      })

      expect(wrapper.find('.new-customer-badge').exists()).toBe(true)
      expect(wrapper.find('.joined-time').exists()).toBe(false)
    })
  })

  describe('不同日期格式支援', () => {
    it('應該支援 timestamp 數字格式', () => {
      const createdAt = new Date('2025-01-27T12:00:00Z').getTime()

      const wrapper = mount(NewCustomerBadge, {
        props: { createdAt }
      })

      expect(wrapper.find('.new-customer-badge').exists()).toBe(true)
    })

    it('應該支援 ISO 字串格式', () => {
      const createdAt = '2025-01-27T12:00:00Z'

      const wrapper = mount(NewCustomerBadge, {
        props: { createdAt }
      })

      expect(wrapper.find('.new-customer-badge').exists()).toBe(true)
    })

    it('應該支援 Date 物件', () => {
      const createdAt = new Date('2025-01-27T12:00:00Z')

      const wrapper = mount(NewCustomerBadge, {
        props: { createdAt }
      })

      expect(wrapper.find('.new-customer-badge').exists()).toBe(true)
    })
  })
})
