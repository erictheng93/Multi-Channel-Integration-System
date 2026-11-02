/**
 * At 1024px and below the sidebar's children are hidden, so every 資料管理 page carries the in-page
 * section nav; without it 匯出對話 and 資料備份 cannot reach each other on a tablet.
 */

import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import DataExport from '@/components/data-management/DataExport.vue'
import DataBackup from '@/components/data-management/DataBackup.vue'

vi.mock('@/api/backup', () => ({
  listBackups: vi.fn().mockResolvedValue({ items: [] }),
  runBackup: vi.fn(),
  downloadBackup: vi.fn()
}))

describe('資料管理 section nav', () => {
  it.each([
    ['DataExport', DataExport],
    ['DataBackup', DataBackup]
  ])('%s renders the data section nav', (_name, page) => {
    const wrapper = shallowMount(page)
    expect(wrapper.find('ui-section-nav-stub').attributes('section')).toBe('data')
  })
})
