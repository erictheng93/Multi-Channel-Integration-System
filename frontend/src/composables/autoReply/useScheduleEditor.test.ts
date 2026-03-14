import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockSaveSchedules = vi.fn()
vi.mock('@/api/autoReply', () => ({
  saveSchedules: (...args: unknown[]) => mockSaveSchedules(...args),
}))

const mockFetchSchedules = vi.fn()
vi.mock('@/stores/autoReply', () => ({
  useAutoReplyStore: () => ({
    fetchSchedules: mockFetchSchedules,
  }),
}))

import { useScheduleEditor } from './useScheduleEditor'

describe('useScheduleEditor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockSaveSchedules.mockResolvedValue(undefined)
    mockFetchSchedules.mockResolvedValue(undefined)
  })

  it('initializes 7 rows with Mon-Fri active and Sat/Sun inactive', () => {
    const { rows } = useScheduleEditor()

    expect(rows).toHaveLength(7)
    for (let i = 0; i < 7; i++) {
      const row = rows[i]!
      expect(row.dayOfWeek).toBe(i)
      expect(row.startTime).toBe('09:00')
      expect(row.endTime).toBe('18:00')
    }
    // Sun (0) inactive
    expect(rows[0]!.isActive).toBe(false)
    // Mon-Fri (1-5) active
    for (let i = 1; i <= 5; i++) {
      expect(rows[i]!.isActive).toBe(true)
    }
    // Sat (6) inactive
    expect(rows[6]!.isActive).toBe(false)
  })

  it('defaults timezone to Asia/Taipei', () => {
    const { timezone } = useScheduleEditor()
    expect(timezone.value).toBe('Asia/Taipei')
  })

  it('loadFromSchedules applies stored data and resets others to defaults', () => {
    const { rows, loadFromSchedules } = useScheduleEditor()

    // Mutate a row first to verify reset behavior
    rows[1]!.startTime = '07:00'
    rows[1]!.endTime = '22:00'

    loadFromSchedules([
      { id: 1, teamId: 1, dayOfWeek: 0, startTime: '10:00', endTime: '14:00', isActive: true, timezone: 'Asia/Taipei' },
      { id: 2, teamId: 1, dayOfWeek: 3, startTime: '08:00', endTime: '20:00', isActive: false, timezone: 'Asia/Taipei' },
    ])

    // Applied schedules
    expect(rows[0]!.startTime).toBe('10:00')
    expect(rows[0]!.endTime).toBe('14:00')
    expect(rows[0]!.isActive).toBe(true)

    expect(rows[3]!.startTime).toBe('08:00')
    expect(rows[3]!.endTime).toBe('20:00')
    expect(rows[3]!.isActive).toBe(false)

    // Row 1 should be reset to defaults (not the mutated values)
    expect(rows[1]!.startTime).toBe('09:00')
    expect(rows[1]!.endTime).toBe('18:00')
    expect(rows[1]!.isActive).toBe(true)
  })

  it('loadFromSchedules updates timezone from schedule data', () => {
    const { timezone, loadFromSchedules } = useScheduleEditor()

    loadFromSchedules([
      { id: 3, teamId: 1, dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isActive: true, timezone: 'America/New_York' },
    ])

    expect(timezone.value).toBe('America/New_York')
  })

  it('toggleDay toggles isActive for a given dayOfWeek', () => {
    const { rows, toggleDay } = useScheduleEditor()

    // Monday (1) starts active
    expect(rows[1]!.isActive).toBe(true)
    toggleDay(1)
    expect(rows[1]!.isActive).toBe(false)
    toggleDay(1)
    expect(rows[1]!.isActive).toBe(true)

    // Sunday (0) starts inactive
    expect(rows[0]!.isActive).toBe(false)
    toggleDay(0)
    expect(rows[0]!.isActive).toBe(true)
  })

  it('updateTime updates startTime or endTime for a given day', () => {
    const { rows, updateTime } = useScheduleEditor()

    updateTime(2, 'startTime', '07:30')
    expect(rows[2]!.startTime).toBe('07:30')
    expect(rows[2]!.endTime).toBe('18:00')

    updateTime(2, 'endTime', '21:00')
    expect(rows[2]!.endTime).toBe('21:00')
  })

  it('save calls saveSchedules with correct payload, then fetchSchedules, and returns true', async () => {
    const { save, timezone, rows } = useScheduleEditor()

    timezone.value = 'Asia/Tokyo'
    rows[0]!.isActive = true

    const result = await save()

    expect(result).toBe(true)
    expect(mockSaveSchedules).toHaveBeenCalledOnce()
    const callArg = (mockSaveSchedules.mock.calls[0] as [{ timezone: string; schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }> }])[0]
    expect(callArg.timezone).toBe('Asia/Tokyo')
    expect(callArg.schedules).toHaveLength(7)
    expect(callArg.schedules[0]).toEqual({
      dayOfWeek: 0,
      startTime: '09:00',
      endTime: '18:00',
      isActive: true,
    })
    expect(mockFetchSchedules).toHaveBeenCalledOnce()
  })

  it('save returns false on API error', async () => {
    mockSaveSchedules.mockRejectedValueOnce(new Error('Network error'))

    const { save, saving } = useScheduleEditor()
    const result = await save()

    expect(result).toBe(false)
    expect(saving.value).toBe(false)
    expect(mockFetchSchedules).not.toHaveBeenCalled()
  })

  it('getDayLabel returns correct Chinese labels for each day', () => {
    const { getDayLabel } = useScheduleEditor()

    const expected = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
    for (let i = 0; i < 7; i++) {
      expect(getDayLabel(i)).toBe(expected[i])
    }
    // Out of range returns empty string
    expect(getDayLabel(7)).toBe('')
    expect(getDayLabel(-1)).toBe('')
  })

  it('isWeekend returns true for 0 (Sun) and 6 (Sat), false for 1-5', () => {
    const { isWeekend } = useScheduleEditor()

    expect(isWeekend(0)).toBe(true)
    expect(isWeekend(6)).toBe(true)
    for (let i = 1; i <= 5; i++) {
      expect(isWeekend(i)).toBe(false)
    }
  })
})
