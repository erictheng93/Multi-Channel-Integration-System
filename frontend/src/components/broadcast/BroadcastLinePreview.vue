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
        <div
          v-else
          class="chat-empty"
        >
          <svg
            class="chat-empty-ico"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" /></svg>
          <b>還沒有內容</b>
          <span>輸入文字或加入圖片，客戶收到的樣子會即時出現在這裡。</span>
          <ul class="limits">
            <li>文字最多 2,000 字</li>
            <li>圖片最多 4 張</li>
            <li>文字在前，圖片依序在後</li>
          </ul>
        </div>
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
  flex: 0 1 auto;
  flex-direction: column;
  width: min(100% - 44px, 300px);
  min-height: 0;
  max-height: 560px;
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

.limits {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.limits li {
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.75);
  font-size: 12.5px;
  color: #3a3a3c;
}

.chat-empty {
  display: grid;
  flex: 1;
  align-content: center;
  justify-items: center;
  gap: 6px;
  padding: 20px 8px 24px;
  text-align: center;
  color: #4c4c50;
}

.chat-empty-ico {
  width: 34px;
  height: 34px;
  margin-bottom: 4px;
  color: #6b7280;
}

.chat-empty b {
  font-size: 15px;
  font-weight: 600;
  color: #1c1c1e;
}

.chat-empty span {
  max-width: 200px;
  font-size: 13px;
  line-height: 1.5;
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
