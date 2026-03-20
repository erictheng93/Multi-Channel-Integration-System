import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

vi.mock('@/components/icons', () => {
  const stub = defineComponent({
    name: 'IconStub',
    props: { size: { type: Number, default: 24 } },
    setup() {
      return () => h('svg', { class: 'icon-stub' })
    },
  })
  return {
    ChevronLeftIcon: stub,
    ChevronRightIcon: stub,
  }
})

import ActivityPagination from './ActivityPagination.vue'

function mountPagination(props: {
  currentPage: number
  totalPages: number
  totalRecords: number
  loading?: boolean
}) {
  return mount(ActivityPagination, {
    props: {
      currentPage: props.currentPage,
      totalPages: props.totalPages,
      totalRecords: props.totalRecords,
      loading: props.loading ?? false,
    },
  })
}

describe('ActivityPagination', () => {
  it('renders page info text', () => {
    const wrapper = mountPagination({ currentPage: 2, totalPages: 5, totalRecords: 100 })
    const info = wrapper.find('.pagination__info')
    expect(info.exists()).toBe(true)
    expect(info.text()).toContain('2')
    expect(info.text()).toContain('5')
    expect(info.text()).toContain('100')
  })

  it('prev button is disabled on page 1', () => {
    const wrapper = mountPagination({ currentPage: 1, totalPages: 5, totalRecords: 50 })
    const buttons = wrapper.findAll('.pagination__btn')
    expect(buttons[0]!.attributes('disabled')).toBeDefined()
  })

  it('prev button is enabled when not on page 1', () => {
    const wrapper = mountPagination({ currentPage: 3, totalPages: 5, totalRecords: 50 })
    const buttons = wrapper.findAll('.pagination__btn')
    expect(buttons[0]!.attributes('disabled')).toBeUndefined()
  })

  it('next button is disabled on last page', () => {
    const wrapper = mountPagination({ currentPage: 5, totalPages: 5, totalRecords: 50 })
    const buttons = wrapper.findAll('.pagination__btn')
    expect(buttons[1]!.attributes('disabled')).toBeDefined()
  })

  it('next button is enabled when not on last page', () => {
    const wrapper = mountPagination({ currentPage: 3, totalPages: 5, totalRecords: 50 })
    const buttons = wrapper.findAll('.pagination__btn')
    expect(buttons[1]!.attributes('disabled')).toBeUndefined()
  })

  it('emits page-change with page-1 when prev clicked', async () => {
    const wrapper = mountPagination({ currentPage: 3, totalPages: 5, totalRecords: 50 })
    const buttons = wrapper.findAll('.pagination__btn')
    await buttons[0]!.trigger('click')
    const emitted = wrapper.emitted('page-change')
    expect(emitted).toBeTruthy()
    expect(emitted![0]![0]).toBe(2)
  })

  it('emits page-change with page+1 when next clicked', async () => {
    const wrapper = mountPagination({ currentPage: 3, totalPages: 5, totalRecords: 50 })
    const buttons = wrapper.findAll('.pagination__btn')
    await buttons[1]!.trigger('click')
    const emitted = wrapper.emitted('page-change')
    expect(emitted).toBeTruthy()
    expect(emitted![0]![0]).toBe(4)
  })

  it('does not emit page-change when prev clicked on page 1', async () => {
    const wrapper = mountPagination({ currentPage: 1, totalPages: 5, totalRecords: 50 })
    const buttons = wrapper.findAll('.pagination__btn')
    await buttons[0]!.trigger('click')
    expect(wrapper.emitted('page-change')).toBeFalsy()
  })

  it('does not emit page-change when next clicked on last page', async () => {
    const wrapper = mountPagination({ currentPage: 5, totalPages: 5, totalRecords: 50 })
    const buttons = wrapper.findAll('.pagination__btn')
    await buttons[1]!.trigger('click')
    expect(wrapper.emitted('page-change')).toBeFalsy()
  })

  it('both buttons are disabled when loading is true', () => {
    const wrapper = mountPagination({ currentPage: 3, totalPages: 5, totalRecords: 50, loading: true })
    const buttons = wrapper.findAll('.pagination__btn')
    expect(buttons[0]!.attributes('disabled')).toBeDefined()
    expect(buttons[1]!.attributes('disabled')).toBeDefined()
  })
})
