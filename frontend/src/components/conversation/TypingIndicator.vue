<template>
  <div
    class="typing-indicator"
    :class="{ 'typing-active': isActive }"
  >
    <div class="typing-content">
      <!-- Typing animation -->
      <div class="typing-animation">
        <div class="typing-dot" />
        <div class="typing-dot" />
        <div class="typing-dot" />
      </div>

      <!-- Typing text -->
      <div class="typing-text">
        {{ typingText }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  typingUsers: string[]
  maxUsersShown?: number
  showAnimation?: boolean
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  maxUsersShown: 3,
  showAnimation: true,
  compact: false
})

// Computed properties
const isActive = computed(() => props.typingUsers.length > 0)

const typingText = computed(() => {
  const userCount = props.typingUsers.length

  if (userCount === 0) {
    return ''
  }

  if (userCount === 1) {
    const userName = props.typingUsers[0]
    return props.compact ? `${userName} 正在輸入` : `${userName} 正在輸入...`
  }

  if (userCount <= props.maxUsersShown) {
    const userNames = props.typingUsers.slice(0, userCount)
    const lastUser = userNames.pop()
    const otherUsers = userNames.join('、')

    if (userCount === 2) {
      return props.compact
        ? `${otherUsers} 和 ${lastUser} 正在輸入`
        : `${otherUsers} 和 ${lastUser} 正在輸入...`
    } else {
      return props.compact
        ? `${otherUsers} 和 ${lastUser} 正在輸入`
        : `${otherUsers} 和 ${lastUser} 正在輸入...`
    }
  }

  const visibleUsers = props.typingUsers.slice(0, props.maxUsersShown)
  const remainingCount = userCount - props.maxUsersShown
  const visibleNames = visibleUsers.join('、')

  return props.compact
    ? `${visibleNames} 等 ${userCount} 人正在輸入`
    : `${visibleNames} 和其他 ${remainingCount} 人正在輸入...`
})
</script>

<style scoped>
.typing-indicator {
  display: flex;
  align-items: center;
  opacity: 0;
  transform: translateY(4px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.typing-active {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.typing-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  color: var(--blue-700);
}

/* Typing Animation */
.typing-animation {
  display: flex;
  align-items: center;
  gap: 2px;
}

.typing-dot {
  width: 3px;
  height: 3px;
  background-color: var(--blue-500);
  border-radius: 50%;
  animation: typing-pulse 1.4s infinite ease-in-out;
}

.typing-dot:nth-child(1) {
  animation-delay: 0s;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

.typing-text {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

/* Animations */
@keyframes typing-pulse {
  0%, 60%, 100% {
    transform: scale(1);
    opacity: 0.5;
  }
  30% {
    transform: scale(1.2);
    opacity: 1;
  }
}

/* Compact variant */
.typing-indicator.compact .typing-content {
  padding: 2px var(--space-1);
  font-size: 0.625rem;
  gap: var(--space-1);
}

.typing-indicator.compact .typing-dot {
  width: 2px;
  height: 2px;
}

.typing-indicator.compact .typing-text {
  max-width: 150px;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .typing-content {
    padding: 2px var(--space-1);
    font-size: 0.625rem;
    gap: var(--space-1);
  }

  .typing-dot {
    width: 2px;
    height: 2px;
  }

  .typing-text {
    max-width: 120px;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .typing-content {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.3);
    color: var(--blue-300);
  }

  .typing-dot {
    background-color: var(--blue-400);
  }
}
</style>