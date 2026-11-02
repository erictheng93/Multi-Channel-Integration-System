<template>
  <div class="ui-card schedule-grid">
    <div class="schedule-header">
      <h3 class="schedule-title">
        營業時間設定
      </h3>
      <div class="schedule-actions">
        <select
          class="ui-select timezone-select"
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
                class="ui-input time-input"
                :value="row.startTime"
                :disabled="!row.isActive"
                :class="{ 'time-input--disabled': !row.isActive }"
                @input="emit('update-time', row.dayOfWeek, 'startTime', ($event.target as HTMLInputElement).value)"
              >
            </td>
            <td class="col-time">
              <input
                type="time"
                class="ui-input time-input"
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
}>()

const emit = defineEmits<{
  'toggle-day': [dayOfWeek: number]
  'update-time': [dayOfWeek: number, field: 'startTime' | 'endTime', value: string]
  'update-timezone': [value: string]
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
  overflow: hidden;
}

.schedule-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 22px 12px;
}

.schedule-title {
  margin: 0;
  font: 600 var(--ui-t-title) / 1.25 var(--ui-font-display);
  letter-spacing: -0.015em;
}

.timezone-select {
  width: auto;
  min-width: 220px;
  height: 38px;
  border-radius: 999px;
}

.table-wrapper {
  overflow-x: auto;
  padding-bottom: 8px;
}

.schedule-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.schedule-table th {
  padding: 10px 14px;
  box-shadow: inset 0 -0.5px 0 var(--ui-sep);
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-muted);
  text-align: left;
  white-space: nowrap;
}

.schedule-table td {
  padding: 10px 14px;
  box-shadow: inset 0 -0.5px 0 var(--ui-sep);
}

.schedule-table tr:last-child td {
  box-shadow: none;
}

.schedule-table th:first-child,
.schedule-table td:first-child {
  padding-left: 22px;
}

.schedule-table th:last-child,
.schedule-table td:last-child {
  padding-right: 22px;
}

.col-toggle {
  width: 80px;
}

.day-label {
  font-size: 14px;
  font-weight: 600;
}

.day-label--sunday {
  color: var(--ui-red-ink);
}

.day-label--saturday {
  color: var(--ui-accent);
}

.time-input {
  width: 140px;
  height: 38px;
  font-variant-numeric: tabular-nums;
}

.schedule-row--inactive .day-label {
  color: var(--ui-muted);
}

.time-input--disabled {
  opacity: 0.45;
}

.toggle-switch {
  position: relative;
  width: 44px;
  height: 26px;
  border-radius: 999px;
  background: var(--ui-fill-strong);
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.toggle-switch:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}

.toggle-switch--on {
  background: var(--ui-green);
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow:
    0 2px 4px rgb(0 0 0 / 0.15),
    0 0 0 0.5px rgb(0 0 0 / 0.04);
  transition: transform var(--ui-dur) var(--ui-ease);
}

.toggle-switch--on .toggle-thumb {
  transform: translateX(18px);
}

@media (max-width: 768px) {
  .schedule-header {
    padding: 16px;
  }

  .timezone-select {
    width: 100%;
  }

  .time-input {
    width: 110px;
  }
}
</style>
