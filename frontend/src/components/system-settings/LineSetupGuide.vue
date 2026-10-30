<!--
  LineSetupGuide.vue
  Beside the LINE form: the webhook address LINE must call (this deployment's real URL, copyable)
  Where each credential lives is stated in the credential rows themselves. Static help, no invented status.
-->
<template>
  <section class="guide">
    <h2 class="ui-group-label">
      Webhook 網址
    </h2>
    <article class="ui-card guide-card">
      <p class="guide-text">
        LINE 把訊息送到這個網址。到 LINE Developers 的 Messaging API 分頁照三步設定：
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
      <ol class="steps">
        <li>複製上方網址</li>
        <li>貼到 Webhook URL，按「Verify」確認可連線</li>
        <li>開啟「Use webhook」</li>
      </ol>
    </article>
  </section>
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
.guide {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.guide-card {
  flex: 1;
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
  font: 12px / 1.5 var(--ui-font-mono);
  color: var(--ui-ink-2);
  overflow-wrap: anywhere;
}

.steps {
  display: grid;
  gap: 8px;
  margin: 16px 0 0;
  padding: 0;
  font-size: 14px;
  color: var(--ui-ink-2);
  list-style: none;
  counter-reset: step;
}

.steps li {
  display: flex;
  gap: 10px;
  align-items: center;
  counter-increment: step;
}

@media (max-width: 768px) {
  .url-box {
    flex-direction: column;
    align-items: stretch;
  }

  .url-box .btn {
    width: 100%;
    min-height: 44px;
  }
}

.steps li::before {
  display: grid;
  flex: none;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--ui-accent-soft);
  font: 600 13px var(--ui-font-display);
  color: var(--ui-accent-ink, var(--ui-accent));
  content: counter(step);
}
</style>
