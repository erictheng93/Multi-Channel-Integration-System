<template>
  <div
    class="presence-badge"
    :class="badgeClasses"
  >
    <div class="presence-content">
      <!-- Online indicator -->
      <div class="presence-indicator">
        <div class="presence-dot" />
        <span class="presence-count">{{ onlineCount }}</span>
      </div>

      <!-- User details (shown on hover or when expanded) -->
      <div
        v-if="showDetails"
        class="presence-details"
      >
        <span class="presence-label">{{ onlineLabel }}</span>
      </div>
    </div>

    <!-- Tooltip with user list -->
    <div
      v-if="!showDetails && onlineUsers.length > 0"
      class="presence-tooltip"
    >
      <div class="tooltip-content">
        <div class="tooltip-header">
          <span class="tooltip-title">線上用戶</span>
          <span class="tooltip-count">{{ onlineCount }}</span>
        </div>
        <div class="tooltip-body">
          <div
            v-for="user in displayedUsers"
            :key="user"
            class="tooltip-user"
          >
            <div class="user-indicator" />
            <span class="user-name">{{ user }}</span>
          </div>
          <div
            v-if="hiddenUserCount > 0"
            class="tooltip-more"
          >
            還有 {{ hiddenUserCount }} 位用戶線上
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  onlineUsers: string[]
  maxUsersShown?: number
  showDetails?: boolean
  compact?: boolean
  variant?: 'default' | 'minimal' | 'detailed'
}

const props = withDefaults(defineProps<Props>(), {
  maxUsersShown: 5,
  showDetails: false,
  compact: false,
  variant: 'default'
})

// Computed properties
const onlineCount = computed(() => props.onlineUsers.length)

const badgeClasses = computed(() => ({
  'presence-compact': props.compact,
  'presence-detailed': props.showDetails,
  'presence-minimal': props.variant === 'minimal',
  'presence-default': props.variant === 'default',
  'presence-detailed-variant': props.variant === 'detailed',
  'presence-active': onlineCount.value > 0
}))

const onlineLabel = computed(() => {
  const count = onlineCount.value
  if (count === 0) {return '無人線上'}
  if (count === 1) {return '1 人線上'}
  return `${count} 人線上`
})

const displayedUsers = computed(() => {
  return props.onlineUsers.slice(0, props.maxUsersShown)
})

const hiddenUserCount = computed(() => {
  return Math.max(0, props.onlineUsers.length - props.maxUsersShown)
})
</script>

<style scoped>
.presence-badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  font-size: 0.75rem;
  user-select: none;
}

.presence-content {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  transition: all var(--transition-fast);
}

.presence-default .presence-content {
  background-color: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  color: var(--green-700);
}

.presence-minimal .presence-content {
  background-color: transparent;
  border: none;
  padding: 2px 4px;
}

.presence-detailed-variant .presence-content {
  background-color: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--gray-200);
  box-shadow: var(--shadow-sm);
  padding: var(--space-2) var(--space-3);
}

.presence-compact .presence-content {
  padding: 1px var(--space-1);
  gap: 2px;
}

/* Presence Indicator */
.presence-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.presence-dot {
  width: 6px;
  height: 6px;
  background-color: var(--green-500);
  border-radius: 50%;
  transition: all var(--transition-fast);
}

.presence-active .presence-dot {
  animation: presence-pulse 2s infinite;
}

.presence-compact .presence-dot {
  width: 4px;
  height: 4px;
}

.presence-count {
  font-weight: 600;
  font-size: 0.75rem;
  line-height: 1;
}

.presence-compact .presence-count {
  font-size: 0.625rem;
}

/* Presence Details */
.presence-details {
  display: flex;
  align-items: center;
}

.presence-label {
  font-weight: 500;
  white-space: nowrap;
}

/* Tooltip */
.presence-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
  opacity: 0;
  visibility: hidden;
  transition: all var(--transition-fast);
  z-index: 1000;
  pointer-events: none;
}

.presence-badge:hover .presence-tooltip {
  opacity: 1;
  visibility: visible;
}

.tooltip-content {
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  font-size: 0.75rem;
  white-space: nowrap;
  position: relative;
  max-width: 250px;
}

.tooltip-content::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.9);
}

.tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  padding-bottom: var(--space-1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.tooltip-title {
  font-weight: 600;
}

.tooltip-count {
  font-size: 0.625rem;
  padding: 2px 6px;
  background-color: rgba(34, 197, 94, 0.3);
  border-radius: var(--radius-full);
  font-weight: 500;
}

.tooltip-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 150px;
  overflow-y: auto;
}

.tooltip-user {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) 0;
}

.user-indicator {
  width: 4px;
  height: 4px;
  background-color: var(--green-400);
  border-radius: 50%;
  flex-shrink: 0;
}

.user-name {
  font-weight: 400;
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;
  text-overflow: ellipsis;
}

.tooltip-more {
  padding-top: var(--space-1);
  margin-top: var(--space-1);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  font-size: 0.625rem;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
}

/* Animations */
@keyframes presence-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.2);
  }
}

/* Variants */
.presence-minimal .presence-count {
  color: var(--green-600);
}

.presence-minimal .presence-dot {
  width: 4px;
  height: 4px;
}

/* State variations */
.presence-badge:not(.presence-active) .presence-dot {
  background-color: var(--gray-400);
  animation: none;
}

.presence-badge:not(.presence-active) .presence-content {
  background-color: rgba(156, 163, 175, 0.1);
  border-color: rgba(156, 163, 175, 0.2);
  color: var(--gray-500);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .presence-content {
    padding: 1px var(--space-1);
    gap: 1px;
  }

  .presence-count {
    font-size: 0.625rem;
  }

  .presence-dot {
    width: 4px;
    height: 4px;
  }

  .tooltip-content {
    font-size: 0.625rem;
    padding: var(--space-2);
    max-width: 200px;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .presence-default .presence-content {
    background-color: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.3);
    color: var(--green-300);
  }

  .presence-detailed-variant .presence-content {
    background-color: rgba(55, 65, 81, 0.9);
    border-color: rgba(75, 85, 99, 0.3);
    color: var(--gray-200);
  }
}
</style>