<template>
  <div class="filter-pills">
    <div class="filter-pills__selects">
      <select
        class="filter-select"
        :class="{ 'filter-select--active': filters.userId !== '' }"
        :value="filters.userId"
        @change="onUserChange"
      >
        <option value="">
          All Users
        </option>
        <option
          v-for="user in users"
          :key="user.id"
          :value="user.id"
        >
          {{ user.name }}
        </option>
      </select>

      <select
        class="filter-select"
        :class="{ 'filter-select--active': filters.action !== '' }"
        :value="filters.action"
        @change="onActionChange"
      >
        <option value="">
          All Actions
        </option>
        <option value="conversation_assign">
          conversation_assign
        </option>
        <option value="conversation_transfer">
          conversation_transfer
        </option>
        <option value="conversation_close">
          conversation_close
        </option>
        <option value="message_send">
          message_send
        </option>
        <option value="user_login">
          user_login
        </option>
        <option value="settings_update">
          settings_update
        </option>
      </select>

      <select
        class="filter-select"
        :class="{ 'filter-select--active': filters.resourceType !== '' }"
        :value="filters.resourceType"
        @change="onResourceTypeChange"
      >
        <option value="">
          All Resources
        </option>
        <option value="conversation">
          conversation
        </option>
        <option value="message">
          message
        </option>
        <option value="user">
          user
        </option>
        <option value="system">
          system
        </option>
      </select>

      <select
        class="filter-select"
        :class="{ 'filter-select--active': dateRange !== 'week' }"
        :value="dateRange"
        @change="onDateRangeChange"
      >
        <option value="today">
          Today
        </option>
        <option value="week">
          This Week
        </option>
        <option value="month">
          This Month
        </option>
        <option value="custom">
          Custom
        </option>
      </select>

      <a
        v-if="hasActiveFilters"
        class="filter-clear"
        href="#"
        @click.prevent="$emit('clear')"
      >Clear Filters</a>
    </div>

    <div
      v-if="dateRange === 'custom'"
      class="custom-date-card"
    >
      <div class="custom-date-inputs">
        <input
          type="date"
          class="date-input"
          :value="customDateRange.start"
          @change="onCustomStartChange"
        >
        <span class="date-separator">-</span>
        <input
          type="date"
          class="date-input"
          :value="customDateRange.end"
          @change="onCustomEndChange"
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Filters {
  userId: string
  action: string
  resourceType: string
}

interface DateRange {
  start: string
  end: string
}

interface User {
  id: string
  name: string
  role: string
}

const props = defineProps<{
  filters: Filters
  dateRange: string
  customDateRange: DateRange
  users: User[]
}>()

const emit = defineEmits<{
  'update:filters': [value: Filters]
  'update:dateRange': [value: string]
  'update:customDateRange': [value: DateRange]
  clear: []
  apply: []
}>()

const hasActiveFilters = computed(() => {
  return (
    props.filters.userId !== '' ||
    props.filters.action !== '' ||
    props.filters.resourceType !== '' ||
    props.dateRange !== 'week'
  )
})

function onUserChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('update:filters', { ...props.filters, userId: value })
  emit('apply')
}

function onActionChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('update:filters', { ...props.filters, action: value })
  emit('apply')
}

function onResourceTypeChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('update:filters', { ...props.filters, resourceType: value })
  emit('apply')
}

function onDateRangeChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('update:dateRange', value)
  emit('apply')
}

function onCustomStartChange(event: Event) {
  const value = (event.target as HTMLInputElement).value
  emit('update:customDateRange', { ...props.customDateRange, start: value })
}

function onCustomEndChange(event: Event) {
  const value = (event.target as HTMLInputElement).value
  emit('update:customDateRange', { ...props.customDateRange, end: value })
}
</script>

<style scoped>
.filter-pills {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-pills__selects {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.filter-select {
  appearance: none;
  -webkit-appearance: none;
  background-color: #F2F2F7;
  color: #4B5563;
  border: none;
  border-radius: 9999px;
  padding: 10px 36px 10px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238E8E93' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  transition: background-color 150ms ease-out, color 150ms ease-out, box-shadow 150ms ease-out;
}

.filter-select:focus {
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
}

.filter-select--active {
  background-color: #007AFF;
  color: #FFFFFF;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23FFFFFF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
}

.filter-clear {
  font-size: 14px;
  font-weight: 500;
  color: #007AFF;
  text-decoration: none;
  margin-left: 4px;
  transition: opacity 150ms ease-out;
}

.filter-clear:hover {
  opacity: 0.75;
}

.custom-date-card {
  background: #FFFFFF;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.06);
  padding: 16px;
  margin-top: 0;
}

.custom-date-inputs {
  display: flex;
  align-items: center;
  gap: 12px;
}

.date-input {
  border: none;
  background: #F2F2F7;
  border-radius: 12px;
  padding: 8px 12px;
  font-size: 14px;
  color: #1C1C1E;
  outline: none;
}

.date-input:focus {
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
}

.date-separator {
  color: #8E8E93;
  font-size: 14px;
}
</style>
