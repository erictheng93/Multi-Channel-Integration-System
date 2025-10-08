<template>
  <span class="highlighted-message">
    <template v-if="hasQuery">
      <span
        v-for="(segment, index) in textSegments"
        :key="index"
        :class="{ 'highlight': segment.highlight }"
      >
        {{ segment.text }}
      </span>
    </template>
    <template v-else>
      {{ text }}
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { highlightTextSegments } from '@/utils/searchHighlight'

interface Props {
  /**
   * 要顯示的文本
   */
  text: string

  /**
   * 搜索查詢字符串（用於高亮）
   */
  query?: string

  /**
   * 是否區分大小寫
   * @default false
   */
  caseSensitive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  query: '',
  caseSensitive: false
})

// 是否有查詢
const hasQuery = computed(() => {
  return !!props.query && props.query.trim().length > 0
})

// 文本分段（帶高亮標記）
const textSegments = computed(() => {
  if (!hasQuery.value) {
    return [{ text: props.text, highlight: false }]
  }

  return highlightTextSegments(props.text, props.query, {
    caseSensitive: props.caseSensitive
  })
})
</script>

<style scoped>
.highlighted-message {
  display: inline;
  word-break: break-word;
}

.highlight {
  background-color: var(--yellow-200, #fef08a);
  color: var(--yellow-900, #713f12);
  padding: 0 2px;
  border-radius: 2px;
  font-weight: 500;
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .highlight {
    background-color: var(--yellow-700, #a16207);
    color: var(--yellow-50, #fefce8);
  }
}
</style>
