<template>
  <div
    class="typing-indicator"
    :class="{ 'typing-active': isActive, 'compact': compact }"
  >
    <div class="typing-content">
      <!-- Typing animation -->
      <div class="flex items-center gap-0.5">
        <div class="typing-dot" />
        <div class="typing-dot" />
        <div class="typing-dot" />
      </div>

      <!-- Typing text -->
      <div class="font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] md:max-w-[120px]">
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
@reference "../../style.css";
/* Typing Indicator - Fade-in transition */
.typing-indicator {
  @apply flex items-center opacity-0 pointer-events-none;
  transform: translateY(4px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.typing-active {
  @apply opacity-100 pointer-events-auto;
  transform: translateY(0);
}

/* Typing Content - Base styles */
.typing-content {
  @apply flex items-center gap-2 py-1 px-2 rounded-full text-xs text-blue-700;
  @apply md:py-0.5 md:px-1 md:text-[0.625rem] md:gap-1;
  @apply dark:text-blue-300;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
}

@media (prefers-color-scheme: dark) {
  .typing-content {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.3);
  }
}

/* Typing Dot - Animated dots */
.typing-dot {
  @apply w-[3px] h-[3px] bg-blue-500 rounded-full md:w-0.5 md:h-0.5 dark:bg-blue-400;
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

/* Compact variant */
.typing-indicator.compact .typing-content {
  @apply py-0.5 px-1 text-[0.625rem] gap-1;
}

.typing-indicator.compact .typing-dot {
  @apply w-0.5 h-0.5;
}

.typing-indicator.compact .font-medium {
  max-width: 150px;
}

/* Animation */
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
</style>