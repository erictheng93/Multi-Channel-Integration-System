<template>
  <div
    v-if="isNewCustomer"
    class="new-customer-wrapper"
    :class="[size]"
  >
    <div class="new-customer-badge">
      <svg
        class="badge-icon"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
          fill="currentColor"
        />
      </svg>
      <span v-if="!compact" class="badge-text">{{ badgeText }}</span>
    </div>
    <span v-if="showJoinedTime" class="joined-time">{{ joinedTimeText }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  createdAt: number | string | Date
  /** Days within which to show the badge (default: 7) */
  thresholdDays?: number
  /** Compact mode - show only icon */
  compact?: boolean
  /** Badge size */
  size?: 'small' | 'medium'
  /** Show joined time text next to badge (default: true) */
  showJoinedTime?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  thresholdDays: 7,
  compact: false,
  size: 'small',
  showJoinedTime: true
})

const daysAgo = computed(() => {
  if (!props.createdAt) {
    return Infinity
  }

  const createdDate = new Date(props.createdAt)
  const now = new Date()
  const diffMs = now.getTime() - createdDate.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  return diffDays
})

const isNewCustomer = computed(() => {
  return daysAgo.value <= props.thresholdDays
})

// Badge text - 新客戶
const badgeText = computed(() => '新客戶')

// Joined time text displayed next to badge
const joinedTimeText = computed(() => {
  if (daysAgo.value === 0) {
    return '今天加入'
  } else if (daysAgo.value === 1) {
    return '昨天加入'
  } else {
    return `${daysAgo.value} 天前加入`
  }
})
</script>

<style scoped>
.new-customer-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.new-customer-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 1px 2px rgba(245, 158, 11, 0.3);
}

.joined-time {
  color: var(--gray-500);
  font-weight: 400;
  white-space: nowrap;
}

/* Small size */
.new-customer-wrapper.small .new-customer-badge {
  padding: 2px 6px;
  font-size: 0.625rem;
}

.new-customer-wrapper.small .badge-icon {
  width: 10px;
  height: 10px;
}

.new-customer-wrapper.small .joined-time {
  font-size: 0.625rem;
}

/* Medium size */
.new-customer-wrapper.medium .new-customer-badge {
  padding: 3px 8px;
  font-size: 0.75rem;
}

.new-customer-wrapper.medium .badge-icon {
  width: 12px;
  height: 12px;
}

.new-customer-wrapper.medium .joined-time {
  font-size: 0.75rem;
}

.badge-icon {
  flex-shrink: 0;
}

.badge-text {
  line-height: 1;
}
</style>
