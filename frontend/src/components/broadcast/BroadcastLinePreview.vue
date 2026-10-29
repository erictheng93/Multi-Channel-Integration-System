<template>
  <section
    class="ui-card preview-card"
    aria-labelledby="broadcast-line-preview-title"
  >
    <div class="ui-card-head">
      <div>
        <h2
          id="broadcast-line-preview-title"
          class="ui-card-title"
        >
          LINE 預覽
        </h2>
        <p class="ui-card-sub">
          <template v-if="hasContent">
            客戶看到的順序：{{ order }}
          </template>
          <template v-else>
            即時顯示客戶端的樣子
          </template>
        </p>
      </div>
    </div>

    <UiEmptyState
      v-if="!hasContent"
      compact
      title="尚無預覽內容"
      description="輸入文字或加入圖片後，會在這裡預覽。"
    >
      <template #icon>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        ><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></svg>
      </template>
    </UiEmptyState>
    <div
      v-else
      class="phone"
    >
      <div class="thread">
        <div
          v-if="content"
          class="bubble"
        >
          {{ content }}
        </div>
        <img
          v-for="(url, index) in imageUrls"
          :key="url"
          class="pic"
          :src="url"
          :alt="`預覽圖片 ${index + 1}`"
        >
      </div>
    </div>
    <p class="disclaimer">
      示意圖。實際字型、氣泡寬度與圖片裁切依客戶的 LINE 版本而異。
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'

const props = defineProps<{
  content: string
  imageUrls: string[]
}>()

const hasContent = computed(() => props.content.length > 0 || props.imageUrls.length > 0)
const order = computed(() => {
  const parts: string[] = []
  if (props.content) {parts.push('文字')}
  if (props.imageUrls.length) {parts.push(`依序 ${props.imageUrls.length} 張圖片`)}
  return parts.join('，再')
})
</script>

<style scoped>
.preview-card {
  padding-bottom: 16px;
}

.phone {
  min-height: 140px;
  margin: 0 22px;
  padding: 16px;
  border-radius: var(--ui-r-inner);
  background: #8ea4c8;
}

.thread {
  display: grid;
  gap: 8px;
  justify-items: start;
}

.bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 4px 18px 18px 18px;
  background: #fff;
  font-size: 13.5px;
  line-height: 1.5;
  color: #1c1c1e;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.pic {
  display: block;
  width: 62%;
  max-width: 220px;
  aspect-ratio: 1;
  border-radius: 4px 18px 18px 18px;
  background: #fff;
  object-fit: cover;
}

.disclaimer {
  margin: 10px 22px 0;
  font-size: 13px;
  color: var(--ui-muted);
}
</style>
