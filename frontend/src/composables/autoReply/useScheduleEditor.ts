import { ref, reactive, onUnmounted } from 'vue'
import type { AutoReplySchedule } from '@/api/autoReply'
import { saveSchedules } from '@/api/autoReply'
import { useAutoReplyStore } from '@/stores/autoReply'
import { useToast } from '@/composables/useToast'

interface ScheduleRow {
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

const DAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
const AUTO_SAVE_DELAY = 800

export function useScheduleEditor() {
  const store = useAutoReplyStore()
  const { showSuccess, showError } = useToast()
  const saving = ref(false)
  const timezone = ref('Asia/Taipei')
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
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

  /** Auto-save: persist current state to backend with toast feedback */
  async function autoSave(): Promise<void> {
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
      showSuccess('營業時間已儲存')
    } catch {
      showError('儲存營業時間失敗', '請稍後再試')
    } finally {
      saving.value = false
    }
  }

  /** Debounced auto-save for continuous inputs (time fields) */
  function debouncedAutoSave(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void autoSave()
    }, AUTO_SAVE_DELAY)
  }

  function toggleDay(dayOfWeek: number) {
    const row = rows[dayOfWeek]
    if (row) {
      row.isActive = !row.isActive
    }
    void autoSave()
  }

  function updateTime(dayOfWeek: number, field: 'startTime' | 'endTime', value: string) {
    const row = rows[dayOfWeek]
    if (row) {
      row[field] = value
    }
    debouncedAutoSave()
  }

  function updateTimezone(value: string) {
    timezone.value = value
    void autoSave()
  }

  // Keep save() for backward compat but it's no longer the primary path
  async function save(): Promise<boolean> {
    try {
      await autoSave()
      return true
    } catch {
      return false
    }
  }

  function cleanup() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  function getDayLabel(dayOfWeek: number): string {
    return DAY_LABELS[dayOfWeek] || ''
  }

  function isWeekend(dayOfWeek: number): boolean {
    return dayOfWeek === 0 || dayOfWeek === 6
  }

  onUnmounted(cleanup)

  return {
    saving,
    timezone,
    rows,
    loadFromSchedules,
    toggleDay,
    updateTime,
    updateTimezone,
    save,
    cleanup,
    getDayLabel,
    isWeekend
  }
}
