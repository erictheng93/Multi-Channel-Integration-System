<template>
  <Transition name="fade-in">
    <div
      v-if="replies.length > 0"
      class="quick-replies"
    >
      <button
        v-for="reply in visibleReplies"
        :key="reply.id"
        class="quick-reply-btn"
        :disabled="disabled"
        @click="handleSelect(reply)"
      >
        {{ reply.text }}
      </button>
      <button
        v-if="replies.length > MAX_VISIBLE"
        type="button"
        class="quick-reply-btn quick-reply-more"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? '收合' : `更多 ${replies.length - MAX_VISIBLE}` }}
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * Quick Replies Component
 *
 * 显示快速回复按钮列表，用于快速填充常用回复
 *
 * @component QuickReplies
 * @example
 * ```vue
 * <QuickReplies
 * :replies="quickReplies"
 * @select="handleQuickReply"
 * />
 * ```
 */

import { computed, ref } from 'vue'

export interface QuickReply {
  /** 唯一标识 */
  id: string
  /** 回复文本 */
  text: string
  /** 分类 (可选) */
  category?: string
  /** 是否启用 (可选) */
  enabled?: boolean
}

interface Props {
  /**
   * 快速回复列表
   */
  replies: QuickReply[]

  /**
   * 是否禁用所有按钮
   * @default false
   */
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

// At most three suggestions are shown; the rest sit behind 更多 so the row never needs a scroll to find the end
const MAX_VISIBLE = 3
const expanded = ref(false)
const visibleReplies = computed(() => (expanded.value ? props.replies : props.replies.slice(0, MAX_VISIBLE)))

const emit = defineEmits<Emits>()

interface Emits {
  /**
   * 选择快速回复时触发
   * @param _reply - 选中的快速回复
   */
  (_e: 'select', _reply: QuickReply): void
}

const handleSelect = (reply: QuickReply) => {
  emit('select', reply)
}
</script>

<style scoped>
/* Quick replies: one swipeable row of capsule chips */
.quick-replies {
  display: flex;
  gap: 8px;
  padding: 10px 0 2px;
  overflow-x: auto;
  -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent);
  mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent);
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.quick-replies::-webkit-scrollbar {
  display: none;
}

.quick-reply-btn {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: var(--ui-fill);
  color: var(--ui-ink-2);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--ui-dur) var(--ui-ease);
}

.quick-reply-btn:hover:not(:disabled) {
  background: var(--ui-fill-strong);
}

.quick-reply-more {
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--ui-sep);
  color: var(--ui-muted);
}

.quick-reply-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fade-in-enter-active {
  animation: fadeIn 0.3s ease-out;
}

.fade-in-leave-active {
  animation: fadeOut 0.2s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}

@media (pointer: coarse) {
  .quick-reply-btn {
    min-height: 44px;
  }
}
</style>
