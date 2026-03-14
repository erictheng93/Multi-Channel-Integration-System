<template>
  <div class="schedule-grid">
    <div class="schedule-header">
      <h3 class="schedule-title">
        營業時間設定
      </h3>
      <div class="schedule-actions">
        <select
          class="form-input timezone-select"
          :value="timezone"
          @change="emit('update-timezone', ($event.target as HTMLSelectElement).value)"
        >
          <option value="Asia/Taipei">
            Asia/Taipei (UTC+8)
          </option>
          <option value="Asia/Tokyo">
            Asia/Tokyo (UTC+9)
          </option>
          <option value="Asia/Hong_Kong">
            Asia/Hong_Kong (UTC+8)
          </option>
          <option value="Asia/Shanghai">
            Asia/Shanghai (UTC+8)
          </option>
          <option value="Asia/Singapore">
            Asia/Singapore (UTC+8)
          </option>
          <option value="America/New_York">
            America/New_York (UTC-5)
          </option>
          <option value="America/Los_Angeles">
            America/Los_Angeles (UTC-8)
          </option>
          <option value="Europe/London">
            Europe/London (UTC+0)
          </option>
          <option value="UTC">
            UTC
          </option>
        </select>
        <button
          class="btn btn-primary save-btn"
          :disabled="saving"
          @click="emit('save')"
        >
          <span
            v-if="saving"
            class="spinner"
          />
          {{ saving ? '儲存中...' : '儲存排程' }}
        </button>
      </div>
    </div>

    <div class="table-wrapper">
      <table class="schedule-table">
        <thead>
          <tr>
            <th class="col-day">
              星期
            </th>
            <th class="col-time">
              開始時間
            </th>
            <th class="col-time">
              結束時間
            </th>
            <th class="col-toggle">
              啟用
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.dayOfWeek"
            :class="[
              'schedule-row',
              { 'schedule-row--inactive': !row.isActive }
            ]"
          >
            <td class="col-day">
              <span
                class="day-label"
                :class="dayColorClass(row.dayOfWeek)"
              >
                {{ dayLabels[row.dayOfWeek] }}
              </span>
            </td>
            <td class="col-time">
              <input
                type="time"
                class="form-input time-input"
                :value="row.startTime"
                :disabled="!row.isActive"
                :class="{ 'time-input--disabled': !row.isActive }"
                @input="emit('update-time', row.dayOfWeek, 'startTime', ($event.target as HTMLInputElement).value)"
              >
            </td>
            <td class="col-time">
              <input
                type="time"
                class="form-input time-input"
                :value="row.endTime"
                :disabled="!row.isActive"
                :class="{ 'time-input--disabled': !row.isActive }"
                @input="emit('update-time', row.dayOfWeek, 'endTime', ($event.target as HTMLInputElement).value)"
              >
            </td>
            <td class="col-toggle">
              <div
                class="toggle-switch"
                :class="{ 'toggle-switch--on': row.isActive }"
                role="switch"
                :aria-checked="row.isActive"
                tabindex="0"
                @click="emit('toggle-day', row.dayOfWeek)"
                @keydown.enter="emit('toggle-day', row.dayOfWeek)"
                @keydown.space.prevent="emit('toggle-day', row.dayOfWeek)"
              >
                <div class="toggle-thumb" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
interface ScheduleRow {
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

defineProps<{
  rows: ScheduleRow[]
  timezone: string
  saving: boolean
}>()

const emit = defineEmits<{
  'toggle-day': [dayOfWeek: number]
  'update-time': [dayOfWeek: number, field: 'startTime' | 'endTime', value: string]
  'update-timezone': [value: string]
  'save': []
}>()

const dayLabels: Record<number, string> = {
  0: '週日',
  1: '週一',
  2: '週二',
  3: '週三',
  4: '週四',
  5: '週五',
  6: '週六',
}

function dayColorClass(dayOfWeek: number): string {
  if (dayOfWeek === 0) {return 'day-label--sunday'}
  if (dayOfWeek === 6) {return 'day-label--saturday'}
  return 'day-label--weekday'
}
</script>

<style scoped>
.schedule-grid {
  background: white;
  border-radius: var(--radius-lg);
  border: 1px solid var(--gray-100);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.schedule-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--gray-100);
  flex-wrap: wrap;
  gap: var(--space-3);
}

.schedule-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0;
}

.schedule-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.timezone-select {
  min-width: 200px;
  font-size: 0.875rem;
}

.save-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  white-space: nowrap;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.table-wrapper {
  overflow-x: auto;
}

.schedule-table {
  width: 100%;
  border-collapse: collapse;
}

.schedule-table thead {
  background: var(--gray-50, #f9fafb);
}

.schedule-table th {
  padding: var(--space-3) var(--space-4);
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--gray-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--gray-100);
}

.schedule-table td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--gray-100);
  vertical-align: middle;
}

.schedule-table tbody tr:last-child td {
  border-bottom: none;
}

.schedule-row--inactive td {
  background: var(--gray-50, #f9fafb);
}

.col-day {
  width: 100px;
}

.col-time {
  width: 160px;
}

.col-toggle {
  width: 80px;
  text-align: center;
}

.col-toggle:is(th) {
  text-align: center;
}

.day-label {
  display: inline-block;
  font-size: 0.875rem;
  font-weight: 600;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
}

.day-label--weekday {
  color: var(--gray-900);
}

.day-label--saturday {
  color: #b45309;
  background: #fef3c7;
}

.day-label--sunday {
  color: #dc2626;
  background: #fef2f2;
}

.time-input {
  font-size: 0.875rem;
  width: 130px;
  transition: opacity 0.15s ease;
}

.time-input--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Toggle Switch */
.toggle-switch {
  display: inline-flex;
  align-items: center;
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: var(--gray-300, #d1d5db);
  cursor: pointer;
  transition: background 0.2s ease;
  padding: 2px;
  position: relative;
  outline: none;
}

.toggle-switch:focus-visible {
  box-shadow: 0 0 0 2px var(--primary-50), 0 0 0 4px var(--primary-700);
}

.toggle-switch--on {
  background: #22c55e;
}

.toggle-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.2);
  transition: transform 0.2s ease;
}

.toggle-switch--on .toggle-thumb {
  transform: translateX(20px);
}

@media (max-width: 640px) {
  .schedule-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .schedule-actions {
    width: 100%;
    flex-direction: column;
  }

  .timezone-select {
    width: 100%;
  }

  .save-btn {
    width: 100%;
    justify-content: center;
  }

  .time-input {
    width: 110px;
  }
}
</style>
