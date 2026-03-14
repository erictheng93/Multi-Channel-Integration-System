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
/* ====== Quick Replies Styles ====== */
.quick-replies {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
  padding: 0.5rem 0;
}

.quick-reply-btn {
  padding: 0.5rem 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 9999px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.quick-reply-btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #6366f1;
  color: #6366f1;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(99, 102, 241, 0.1);
}

.quick-reply-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(99, 102, 241, 0.1);
}

.quick-reply-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Fade in animation */
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

/* Responsive */
@media (max-width: 768px) {
  .quick-replies {
    gap: 0.375rem;
    padding: 0.375rem 0;
  }

  .quick-reply-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }
}
</style>
