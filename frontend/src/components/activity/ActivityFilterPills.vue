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
          &#25152;&#26377;&#29992;&#25142;
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
          所有操作
        </option>
        <optgroup label="對話">
          <option value="conversation_assign">
            對話指派
          </option>
          <option value="conversation_transfer">
            對話轉移
          </option>
          <option value="conversation_close">
            對話關閉
          </option>
          <option value="conversation_reopen">
            重新開啟對話
          </option>
          <option value="conversation_unassign">
            取消對話指派
          </option>
          <option value="conversation_bulk_assign">
            批量對話指派
          </option>
        </optgroup>
        <optgroup label="訊息">
          <option value="message_send">
            發送訊息
          </option>
          <option value="message_recall">
            撤回訊息
          </option>
          <option value="message_forward">
            轉發訊息
          </option>
          <option value="message_received">
            收到訊息
          </option>
        </optgroup>
        <optgroup label="用戶">
          <option value="user_login">
            用戶登入
          </option>
          <option value="user_logout">
            用戶登出
          </option>
          <option value="user_create">
            建立用戶
          </option>
          <option value="user_update">
            更新用戶
          </option>
          <option value="user_delete">
            刪除用戶
          </option>
        </optgroup>
        <optgroup label="團隊">
          <option value="team_create">
            建立團隊
          </option>
          <option value="team_update">
            更新團隊
          </option>
          <option value="team_delete">
            刪除團隊
          </option>
          <option value="member_add">
            新增成員
          </option>
          <option value="member_remove">
            移除成員
          </option>
        </optgroup>
        <optgroup label="標籤">
          <option value="tag_create">
            建立標籤
          </option>
          <option value="tag_update">
            更新標籤
          </option>
          <option value="tag_delete">
            刪除標籤
          </option>
          <option value="tag_assign">
            指派標籤
          </option>
          <option value="tag_unassign">
            移除標籤
          </option>
        </optgroup>
        <optgroup label="客戶">
          <option value="customer_create">
            建立客戶
          </option>
          <option value="customer_update">
            更新客戶
          </option>
          <option value="customer_followed">
            客戶追蹤
          </option>
          <option value="customer_unfollowed">
            客戶取消追蹤
          </option>
        </optgroup>
        <optgroup label="系統">
          <option value="settings_update">
            設定更新
          </option>
          <option value="delayed_message_schedule">
            排程延遲訊息
          </option>
          <option value="delayed_message_cancel">
            取消延遲訊息
          </option>
        </optgroup>
      </select>

      <select
        class="filter-select"
        :class="{ 'filter-select--active': filters.resourceType !== '' }"
        :value="filters.resourceType"
        @change="onResourceTypeChange"
      >
        <option value="">
          所有資源
        </option>
        <option value="conversation">
          對話
        </option>
        <option value="message">
          訊息
        </option>
        <option value="user">
          用戶
        </option>
        <option value="team">
          團隊
        </option>
        <option value="customer">
          客戶
        </option>
        <option value="tag">
          標籤
        </option>
        <option value="system">
          系統
        </option>
        <option value="file">
          檔案
        </option>
        <option value="delayed_message">
          延遲訊息
        </option>
        <option value="qr_code">
          QR碼
        </option>
        <option value="integration">
          整合
        </option>
      </select>

      <select
        class="filter-select"
        :class="{ 'filter-select--active': dateRange !== 'week' }"
        :value="dateRange"
        @change="onDateRangeChange"
      >
        <option value="today">
          &#20170;&#22825;
        </option>
        <option value="week">
          &#26368;&#36817;&#19968;&#36913;
        </option>
        <option value="month">
          &#26368;&#36817;&#19968;&#20491;&#26376;
        </option>
        <option value="custom">
          &#33258;&#35330;&#31684;&#22285;
        </option>
      </select>

      <a
        v-if="hasActiveFilters"
        class="filter-clear"
        href="#"
        @click.prevent="$emit('clear')"
      >&#28165;&#38500;&#31721;&#36984;</a>
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
  color: #1C1C1E;
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
