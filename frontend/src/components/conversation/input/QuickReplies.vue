<template>
  <div
    v-if="quickReplies.length > 0"
    class="quick-replies"
  >
    <button
      v-for="(reply, index) in quickReplies"
      :key="index"
      class="quick-reply-btn"
      @click="handleQuickReply(reply)"
    >
      {{ reply.text }}
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * QuickReplies - 快速回覆組件
 *
 * 顯示常用的快速回覆按鈕，讓客服人員可以快速回應客戶。
 *
 * 使用示例：
 * <QuickReplies
 *   :quick-replies="[
 *     { text: '您好，有什麼可以幫助您的？' },
 *     { text: '感謝您的來信，我們會盡快處理' }
 *   ]"
 *   @select="handleQuickReply"
 * />
 */

// ===== Types =====
export interface QuickReply {
  /** 回覆文字 */
  text: string
  /** 快捷鍵提示（可選，已棄用） */
  shortcut?: string
}

// ===== Props =====
defineProps<{
  quickReplies: QuickReply[]
}>()

// ===== Emits =====
const emit = defineEmits<{
  select: [reply: QuickReply]
}>()

// ===== Methods =====

/**
 * 處理快速回覆選擇
 */
function handleQuickReply(reply: QuickReply) {
  emit('select', reply)
}
</script>

<style scoped>
.quick-replies {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
  padding: 0.75rem 1rem;
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
}

.quick-reply-btn:hover {
  background: #f8fafc;
  border-color: #6366f1;
  color: #6366f1;
  transform: translateY(-1px);
}

.quick-reply-btn:active {
  transform: translateY(0);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .quick-replies {
    padding: 0.5rem 0.75rem;
    gap: 0.375rem;
  }

  .quick-reply-btn {
    padding: 0.375rem 0.875rem;
    font-size: 0.75rem;
  }
}
</style>
