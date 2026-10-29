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
      <div class="phone-head">
        <span
          class="phone-avatar"
          aria-hidden="true"
        >{{ accountInitial }}</span>
        <span class="phone-name">{{ accountName }}</span>
        <span class="phone-tag">LINE</span>
      </div>
      <div class="chat">
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
          class="bubble bubble-empty"
        >
          輸入文字或加入圖片後，會在這裡預覽
        </p>
      </div>
    </div>
    <p class="disclaimer">
      示意圖。實際字型、氣泡寬度與圖片裁切依客戶的 LINE 版本而異。
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getLineQuota } from '@/api/broadcasts'

const props = defineProps<{
  content: string
  imageUrls: string[]
}>()

// The official account name comes from the same quota snapshot the quota card shows
const accountName = ref('LINE 官方帳號')
const accountInitial = computed(() => Array.from(accountName.value)[0] ?? 'L')
onMounted(async () => {
  try {
    const snapshot = await getLineQuota()
    const label = snapshot.items[0]?.label
    if (label) {
      accountName.value = label
    }
  } catch {
    // keep the generic name; the quota card already reports the failure
  }
})

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
  overflow: hidden;
  border-radius: 28px;
  background: var(--ui-surface);
  box-shadow: 0 0 0 1px rgba(60, 60, 67, 0.16), 0 8px 24px rgba(0, 0, 0, 0.06);
}

.phone-head {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 12px 16px;
  box-shadow: 0 1px 0 var(--ui-sep);
}

.phone-avatar {
  display: grid;
  flex: none;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  background: var(--ui-line);
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.phone-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ui-ink);
}

.phone-tag {
  flex: none;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--ui-green-soft);
  font-size: 12px;
  font-weight: 600;
  color: var(--ui-green-ink);
}

.chat {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 16px;
  overflow-y: auto;
  background: #e8edf5;
}

.thread {
  display: grid;
  gap: 8px;
  justify-items: start;
}

.bubble-empty {
  margin: 0;
  max-width: 78%;
  border: 1.5px dashed rgba(60, 60, 67, 0.4);
  background: transparent;
  color: var(--ui-ink-2);
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
