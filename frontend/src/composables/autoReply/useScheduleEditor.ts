import { ref, reactive } from 'vue'
import type { AutoReplySchedule } from '@/api/autoReply'
import { saveSchedules } from '@/api/autoReply'
import { useAutoReplyStore } from '@/stores/autoReply'

interface ScheduleRow {
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

const DAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']

export function useScheduleEditor() {
  const store = useAutoReplyStore()
  const saving = ref(false)
  const timezone = ref('Asia/Taipei')
  const rows = reactive<ScheduleRow[]>(
    Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      startTime: '09:00',
      endTime: '18:00',
      isActive: i >= 1 && i <= 5 // Mon-Fri active by default
    }))
  )

  function loadFromSchedules(schedules: AutoReplySchedule[]) {
    // Reset to defaults first
    rows.forEach((row, i) => {
      row.startTime = '09:00'
      row.endTime = '18:00'
      row.isActive = i >= 1 && i <= 5
    })
    // Apply stored schedules
    for (const s of schedules) {
      const row = rows[s.dayOfWeek]
      if (row) {
        row.startTime = s.startTime
        row.endTime = s.endTime
        row.isActive = s.isActive
        if (s.timezone) {
          timezone.value = s.timezone
        }
      }
    }
  }

  function toggleDay(dayOfWeek: number) {
    const row = rows[dayOfWeek]
    if (row) {
      row.isActive = !row.isActive
    }
  }

  function updateTime(dayOfWeek: number, field: 'startTime' | 'endTime', value: string) {
    const row = rows[dayOfWeek]
    if (row) {
      row[field] = value
    }
  }

  async function save(): Promise<boolean> {
    saving.value = true
    try {
      await saveSchedules({
        timezone: timezone.value,
        schedules: rows.map(r => ({
          dayOfWeek: r.dayOfWeek,
          startTime: r.startTime,
          endTime: r.endTime,
          isActive: r.isActive
        }))
      })
      await store.fetchSchedules()
      return true
    } catch {
      return false
    } finally {
      saving.value = false
    }
  }

  function getDayLabel(dayOfWeek: number): string {
    return DAY_LABELS[dayOfWeek] || ''
  }

  function isWeekend(dayOfWeek: number): boolean {
    return dayOfWeek === 0 || dayOfWeek === 6
  }

  return {
    saving,
    timezone,
    rows,
    loadFromSchedules,
    toggleDay,
    updateTime,
    save,
    getDayLabel,
    isWeekend
  }
}
