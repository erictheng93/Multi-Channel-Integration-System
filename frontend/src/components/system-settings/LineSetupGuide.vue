<!--
  LineSetupGuide.vue
  Beside the LINE form: the webhook address LINE must call (this deployment's real URL, copyable)
  Where each credential lives is stated in the credential rows themselves. Static help, no invented status.
-->
<template>
  <article class="ui-card guide-card">
    <h2 class="guide-title">
      Webhook 網址
    </h2>
    <p class="guide-text">
      在 LINE Developers 的 Messaging API 設定中，把這個網址填入 Webhook URL 並開啟「Use webhook」。
    </p>
    <div class="url-box">
      <code
        class="url"
        :title="webhookUrl"
      >{{ webhookUrl }}</code>
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        @click="copy"
      >
        {{ copied ? '已複製' : '複製' }}
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { getBackendUrl } from '@/config/runtime'

const webhookUrl = `${getBackendUrl()}/api/webhook`
const copied = ref(false)

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(webhookUrl)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1800)
  } catch {
    copied.value = false
  }
}
</script>

<style scoped>
.guide-card {
  padding: 18px 20px;
}

.guide-title {
  margin: 0;
  font: 600 var(--ui-t-head, 15px) var(--ui-font-display);
  letter-spacing: -0.01em;
}

.guide-text {
  margin: 6px 0 12px;
  font-size: var(--ui-t-meta);
  line-height: 1.55;
  color: var(--ui-muted);
}

.url-box {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 8px 8px 8px 12px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-fill);
}

.url {
  flex: 1;
  min-width: 0;
  padding-top: 4px;
  font: 12.5px / 1.5 var(--ui-font-mono);
  color: var(--ui-ink-2);
  overflow-wrap: anywhere;
}
</style>
