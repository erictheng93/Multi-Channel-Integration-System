<template>
  <Transition name="fade-in">
    <div
      v-if="replies.length > 0"
      class="quick-replies-wrap"
    >
      <div
        ref="rail"
        class="quick-replies"
        :class="{ 'has-more': hasMore }"
        role="group"
        aria-label="快速回覆"
        @scroll.passive="measure"
        @wheel="onWheel"
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
      <button
        v-if="hasMore"
        type="button"
        class="quick-more"
        aria-label="看更多快速回覆"
        @click="scrollMore"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><path d="m9 6 6 6-6 6" /></svg>
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

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<Props>(), {
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

// One swipeable row of chips; the fade at the right edge shows only while more chips wait off screen
const rail = ref<HTMLElement | null>(null)
const hasMore = ref(false)
const measure = (): void => {
  const el = rail.value
  hasMore.value = !!el && el.scrollWidth - el.clientWidth - el.scrollLeft > 4
}
const scrollMore = (): void => {
  rail.value?.scrollBy({ left: Math.max(160, Math.round(rail.value.clientWidth * 0.7)), behavior: 'smooth' })
}
const onWheel = (e: WheelEvent): void => {
  const el = rail.value
  if (el && hasMore.value && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    el.scrollLeft += e.deltaY
    e.preventDefault()
  }
}
let observer: globalThis.ResizeObserver | null = null
onMounted(() => {
  void nextTick(() => {
    measure()
    if (rail.value && typeof window.ResizeObserver !== 'undefined') {
      observer = new window.ResizeObserver(measure)
      observer.observe(rail.value)
    }
  })
})
watch(() => props.replies, () => { void nextTick(measure) })
onBeforeUnmount(() => observer?.disconnect())


const handleSelect = (reply: QuickReply) => {
  emit('select', reply)
}
</script>

<style scoped>
/* Quick replies: one swipeable row of natural-width chips at every width (long text ellipsizes, the full
   text is in the tooltip). The fade at the right edge appears only while more chips wait off screen. */
.quick-replies-wrap {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.quick-more {
  display: grid;
  flex: none;
  margin-top: 6px;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-pill);
  color: var(--ui-accent);
  cursor: pointer;
}

.quick-more svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentcolor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.quick-replies {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  gap: 8px;
  padding: 10px 0 4px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
}

.quick-replies::-webkit-scrollbar {
  display: none;
}

.quick-replies.has-more {
  -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 40px), transparent);
  mask-image: linear-gradient(90deg, #000 calc(100% - 40px), transparent);
}

.quick-replies.has-more::after {
  flex: 0 0 24px;
  content: '';
}

.quick-reply-btn {
  flex: 0 0 auto;
  max-width: min(220px, 62vw);
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
  .quick-more {
    width: 44px;
    height: 44px;
  }

  .quick-reply-btn {
    min-height: 44px;
  }
}
</style>
