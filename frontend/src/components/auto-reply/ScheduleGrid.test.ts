import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ScheduleGrid from './ScheduleGrid.vue'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface ScheduleRow {
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

const defaultRows: ScheduleRow[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i,
  startTime: '09:00',
  endTime: '18:00',
  isActive: i >= 1 && i <= 5,
}))

function mountGrid(overrides: {
  rows?: ScheduleRow[]
  timezone?: string
  saving?: boolean
} = {}) {
  return mount(ScheduleGrid, {
    props: {
      rows: overrides.rows ?? defaultRows,
      timezone: overrides.timezone ?? 'Asia/Taipei',
      saving: overrides.saving ?? false,
    },
  })
}

// ===========================================================================
// Rendering
// ===========================================================================

describe('ScheduleGrid -- rendering', () => {
  it('renders 7 schedule rows', () => {
    const wrapper = mountGrid()
    expect(wrapper.findAll('.schedule-row')).toHaveLength(7)
  })

  it('displays day labels', () => {
    const wrapper = mountGrid()
    const labels = wrapper.findAll('.day-label')
    const texts = labels.map((l) => l.text())
    expect(texts).toEqual(['週日', '週一', '週二', '週三', '週四', '週五', '週六'])
  })

  it('renders time inputs for each row', () => {
    const wrapper = mountGrid()
    const timeInputs = wrapper.findAll('input[type="time"]')
    // 7 rows x 2 inputs (start + end) = 14
    expect(timeInputs).toHaveLength(14)
  })

  it('renders timezone select with current value', () => {
    const wrapper = mountGrid({ timezone: 'Asia/Tokyo' })
    const select = wrapper.find('.timezone-select')
    expect((select.element as HTMLSelectElement).value).toBe('Asia/Tokyo')
  })

  it('disables time inputs for inactive rows', () => {
    const wrapper = mountGrid()
    // dayOfWeek=0 (Sunday) is inactive
    const rows = wrapper.findAll('.schedule-row')
    const sundayInputs = rows[0]!.findAll('input[type="time"]')
    sundayInputs.forEach((input) => {
      expect((input.element as HTMLInputElement).disabled).toBe(true)
    })
  })

  it('applies inactive row styling', () => {
    const wrapper = mountGrid()
    const rows = wrapper.findAll('.schedule-row')
    // Sunday (index 0) and Saturday (index 6) are inactive
    expect(rows[0]!.classes()).toContain('schedule-row--inactive')
    expect(rows[6]!.classes()).toContain('schedule-row--inactive')
    // Monday (index 1) is active
    expect(rows[1]!.classes()).not.toContain('schedule-row--inactive')
  })

  it('renders toggle switch with correct aria-checked', () => {
    const wrapper = mountGrid()
    const toggles = wrapper.findAll('.toggle-switch')
    // Sunday (0) is inactive
    expect(toggles[0]!.attributes('aria-checked')).toBe('false')
    // Monday (1) is active
    expect(toggles[1]!.attributes('aria-checked')).toBe('true')
  })
})

// ===========================================================================
// Save button states
// ===========================================================================

describe('ScheduleGrid -- save button', () => {
  it('disables save button when saving=true', () => {
    const wrapper = mountGrid({ saving: true })
    const btn = wrapper.find('.save-btn')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows saving text when saving', () => {
    const wrapper = mountGrid({ saving: true })
    const btn = wrapper.find('.save-btn')
    expect(btn.text()).toContain('儲存中...')
  })

  it('shows normal text when not saving', () => {
    const wrapper = mountGrid({ saving: false })
    const btn = wrapper.find('.save-btn')
    expect(btn.text()).toContain('儲存排程')
  })
})

// ===========================================================================
// Emitted events
// ===========================================================================

describe('ScheduleGrid -- emitted events', () => {
  it('emits toggle-day on toggle switch click', async () => {
    const wrapper = mountGrid()
    const toggles = wrapper.findAll('.toggle-switch')
    await toggles[2]!.trigger('click') // Tuesday (dayOfWeek=2)

    expect(wrapper.emitted('toggle-day')).toBeTruthy()
    expect(wrapper.emitted('toggle-day')![0]).toEqual([2])
  })

  it('emits save on save button click', async () => {
    const wrapper = mountGrid()
    await wrapper.find('.save-btn').trigger('click')
    expect(wrapper.emitted('save')).toBeTruthy()
  })

  it('emits update-timezone on timezone change', async () => {
    const wrapper = mountGrid()
    const select = wrapper.find('.timezone-select')
    await select.setValue('Asia/Tokyo')

    expect(wrapper.emitted('update-timezone')).toBeTruthy()
    expect(wrapper.emitted('update-timezone')![0]).toEqual(['Asia/Tokyo'])
  })
})
