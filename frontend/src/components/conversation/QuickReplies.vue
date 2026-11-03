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
        :title="reply.text"
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
/* Quick replies: an even two-column grid on wide screens (no ragged second row, long text ellipsizes and the
   full text is in the tooltip); on a phone one swipeable row (the fade at the right edge says there is more,
   and the spacer lets the last chip scroll clear of it) */
.quick-replies {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  max-height: 84px;
  padding: 10px 0 4px;
  overflow-y: auto;
}

.quick-reply-btn {
  min-width: 0;
  min-height: 32px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--ui-dur) var(--ui-ease);
}

@media (max-width: 768px) {
  .quick-replies {
    display: flex;
    max-height: none;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 56px), transparent);
    mask-image: linear-gradient(90deg, #000 calc(100% - 56px), transparent);
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .quick-replies::-webkit-scrollbar {
    display: none;
  }

  .quick-replies::after {
    flex: 0 0 48px;
    content: '';
  }

  .quick-reply-btn {
    flex: 0 0 auto;
    max-width: 78vw;
  }
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
