<template>
  <Transition name="fade-in">
    <div
      v-if="replies.length > 0"
      class="quick-replies"
    >
      <button
        v-for="reply in replies"
        :key="reply.id"
        class="quick-reply-btn"
        :disabled="disabled"
        @click="handleSelect(reply)"
      >
        {{ reply.text }}
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

withDefaults(defineProps<Props>(), {
  disabled: false,
})

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
/* Quick replies: one swipeable row of capsule chips; the soft fade at the right edge says there is more */
.quick-replies {
  display: flex;
  gap: 8px;
  padding: 10px 0 4px;
  overflow-x: auto;
  -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 72px), transparent);
  mask-image: linear-gradient(90deg, #000 calc(100% - 72px), transparent);
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.quick-replies::-webkit-scrollbar {
  display: none;
}

.quick-reply-btn {
  flex: 0 0 auto;
  max-width: 260px;
  min-height: 32px;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--ui-dur) var(--ui-ease);
}

.quick-reply-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ui-accent) 16%, var(--ui-surface));
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
