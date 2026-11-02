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
          tabindex="0"
          role="textbox"
          aria-readonly="true"
          aria-label="Webhook 網址"
          :title="webhookUrl"
        ><template
          v-for="part in urlParts"
          :key="part"
        >{{ part }}<wbr></template></code>
        <button
          type="button"
          class="btn btn-secondary btn-sm copy-btn"
          :aria-label="copied ? '已複製' : '複製網址'"
          @click="copy"
        >
          <svg
            v-if="!copied"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><rect
            x="9"
            y="9"
            width="11"
            height="11"
            rx="2.5"
          /><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" /></svg>
          <svg
            v-else
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><path d="M5 12.5 10 17.5 19 7" /></svg>
          <span>{{ copied ? '已複製' : '複製' }}</span>
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
/** Break points only at slashes, so a narrow screen wraps the path onto a second line instead of splitting the domain */
const urlParts = webhookUrl.split(/(?=\/)/)
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
  align-items: center;
  padding: 8px 8px 8px 14px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-fill);
}

.url {
  flex: 1;
  min-width: 0;
  padding: 6px 0;
  font: 13.5px / 1.55 var(--ui-font-mono);
  color: var(--ui-ink);
}

.copy-btn {
  display: inline-flex;
  flex: none;
  gap: 6px;
  align-items: center;
  min-height: 40px;
}

.copy-btn {
  justify-content: center;
  width: 40px;
  padding: 0;
}

.copy-btn svg {
  width: 18px;
  height: 18px;
}

/* icon only: the name stays for assistive tech (aria-label) */
.copy-btn span {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.steps {
  display: grid;
  gap: 12px;
  margin: 20px 0 0;
  padding: 0;
  font-size: 15px;
  color: var(--ui-ink);
  list-style: none;
  counter-reset: step;
}

.steps li {
  display: flex;
  gap: 12px;
  align-items: center;
  counter-increment: step;
}

@media (max-width: 768px) {
  .copy-btn {
    width: 44px;
    min-height: 44px;
  }

  .url {
    font-size: 12px;
  }

}

.steps li::before {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--ui-accent-soft);
  font: 700 15px var(--ui-font-display);
  color: var(--ui-accent-ink, var(--ui-accent));
  content: counter(step);
}
</style>
