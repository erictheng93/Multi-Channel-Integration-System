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

    <div class="phone">
      <div
        v-if="hasContent"
        class="thread"
      >
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
      <p
        v-else
        class="phone-empty"
      >
        輸入文字或加入圖片後，會在這裡預覽
      </p>
    </div>
    <p class="disclaimer">
      示意圖。實際字型、氣泡寬度與圖片裁切依客戶的 LINE 版本而異。
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

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
  display: flex;
  flex-direction: column;
  padding-bottom: 16px;
}

.phone {
  display: flex;
  flex: 1;
  flex-direction: column;
  width: min(100% - 44px, 300px);
  min-height: 300px;
  max-height: 460px;
  margin: 0 auto;
  padding: 18px 16px;
  border-radius: 28px;
  background: #8ea4c8;
}

.phone-empty {
  margin: auto;
  max-width: 220px;
  text-wrap: balance;
  font-size: 13.5px;
  line-height: 1.5;
  text-align: center;
  color: #1c1c1e;
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
  text-wrap: balance;
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
